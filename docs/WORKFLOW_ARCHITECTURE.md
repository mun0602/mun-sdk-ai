# Kiến trúc Workflow Engine - DroidRun

## 📐 Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGƯỜI DÙNG                              │
│                              ↓                                  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WorkflowPanel.jsx                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ Workflow   │  │   Create   │  │    Run     │         │  │
│  │  │   List     │  │   Editor   │  │   Button   │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────┐          │  │
│  │  │  Input Form (video_count, like_rate, ...)  │          │  │
│  │  └────────────────────────────────────────────┘          │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────┐          │  │
│  │  │  Execution Logs & Results                  │          │  │
│  │  └────────────────────────────────────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
                    invoke("run_workflow")
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                   TAURI BACKEND (Rust)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  workflow.rs - Workflow Engine                           │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │  run_workflow()                                 │     │  │
│  │  │  • Parse workflow definition                    │     │  │
│  │  │  • Merge inputs with defaults                   │     │  │
│  │  │  • Initialize context                           │     │  │
│  │  │  • Execute steps sequentially                   │     │  │
│  │  └─────────────────────────────────────────────────┘     │  │
│  │                        ↓                                  │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │  execute_step()                                 │     │  │
│  │  │  • Match step type                              │     │  │
│  │  │  • Compile template variables                   │     │  │
│  │  │  • Call appropriate executor                    │     │  │
│  │  └─────────────────────────────────────────────────┘     │  │
│  │                        ↓                                  │  │
│  │  ┌──────────┬──────────┬──────────┬──────────┐           │  │
│  │  │ Action   │ Loop     │Condition │ Python   │           │  │
│  │  │ Executor │ Executor │ Executor │ Executor │           │  │
│  │  └──────────┴──────────┴──────────┴──────────┘           │  │
│  │       ↓          ↓          ↓          ↓                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ADB Command Handler                                     │  │
│  │  • Build ADB command                                     │  │
│  │  • Execute via tokio::process::Command                   │  │
│  │  • Capture output                                        │  │
│  │  • Return result                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
                        ADB Commands
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANDROID DEVICE                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📱 Device Actions                                        │  │
│  │                                                           │  │
│  │  • open_app    → Launch application                      │  │
│  │  • tap         → Touch screen at coordinates             │  │
│  │  • swipe       → Swipe gesture                           │  │
│  │  • input_text  → Type text                               │  │
│  │  • press_back  → Press back button                       │  │
│  │  • press_home  → Press home button                       │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Luồng thực thi chi tiết

### 1. Khởi tạo Workflow

```
User clicks "Run" on workflow
         ↓
Frontend gathers inputs
         ↓
invoke("run_workflow", {
  workflow: WorkflowDefinition,
  inputs: { video_count: 5, like_rate: 50 },
  device_id: "emulator-5554"
})
         ↓
Backend receives command
```

### 2. Workflow Execution

```rust
// workflow.rs
pub async fn run_workflow(
    window: tauri::Window,
    workflow: WorkflowDefinition,
    inputs: HashMap<String, serde_json::Value>,
    device_id: String,
) -> Result<WorkflowResult, String> {
    
    // 1. Initialize context
    let mut context = WorkflowContext {
        inputs,
        variables: HashMap::new(),
        device_id,
        logs: Vec::new(),
        ...
    };
    
    // 2. Execute each step
    for step in workflow.steps {
        execute_step(&window, &step, &mut context).await?;
    }
    
    // 3. Return result
    Ok(WorkflowResult { ... })
}
```

### 3. Step Execution

```
execute_step()
     ↓
Match step.type:
     ↓
┌────┴────┬────────┬──────────┬─────────┬──────────┐
│         │        │          │         │          │
action  wait  random_wait  loop  condition  python
│         │        │          │         │          │
↓         ↓        ↓          ↓         ↓          ↓
```

#### Action Step Flow

```
execute_action_step()
         ↓
Compile params with template variables
  "{{video_count}}" → "5"
         ↓
Match action type:
         ↓
┌────────┴─────────┬──────────┬───────────┐
│                  │          │           │
open_app         tap      swipe_up    input_text
│                  │          │           │
↓                  ↓          ↓           ↓
Build ADB command
         ↓
adb -s <device> shell <command>
         ↓
Execute via tokio::process::Command
         ↓
Return result
```

#### Loop Step Flow

```
execute_loop_step()
         ↓
Compile count: "{{video_count}}" → 5
         ↓
for i in 0..5 {
    context.variables[variable] = i;
    
    for sub_step in body {
        execute_step(sub_step, context)?;
    }
}
```

#### Condition Step Flow

```
execute_condition_step()
         ↓
Compile condition: "{{like_decision.should_like}}" → "true"
         ↓
Evaluate condition
         ↓
    ┌───┴───┐
    │       │
  true    false
    │       │
    ↓       ↓
Execute  Execute
 then    else_branch
```

#### Python Step Flow

```
execute_python_step()
         ↓
Compile script with variables
         ↓
Create Python process
         ↓
Pass context & inputs via stdin
         ↓
Execute Python code
         ↓
Capture stdout (JSON result)
         ↓
Parse result
         ↓
Save to context[save_to]
```

## 📦 Data Flow

### Template Variable Compilation

```
Input: "{{video_count}}"
         ↓
compile_value(template, context)
         ↓
Search in context.inputs
         ↓
Found: video_count = 5
         ↓
Replace: "5"
```

### Nested Variables

```
Input: "{{like_decision.should_like}}"
         ↓
Split by '.'
         ↓
context.variables["like_decision"]["should_like"]
         ↓
Result: true
```

### Context Evolution

```
Initial Context:
{
  inputs: { video_count: 5, like_rate: 50 },
  variables: {},
  device_id: "emulator-5554"
}
         ↓
After Python step (save_to: "like_decision"):
{
  inputs: { video_count: 5, like_rate: 50 },
  variables: {
    like_decision: { should_like: true }
  },
  device_id: "emulator-5554"
}
         ↓
After Loop (variable: "i"):
{
  inputs: { video_count: 5, like_rate: 50 },
  variables: {
    like_decision: { should_like: true },
    i: 3  // Current iteration
  },
  device_id: "emulator-5554"
}
```

## 🎯 Step Types Reference

### Action Step
```
Type: "action"
Purpose: Thực hiện hành động trên device
Executors: execute_action_step()
ADB: Yes
```

### Wait Step
```
Type: "wait"
Purpose: Chờ cố định
Executors: execute_wait_step()
ADB: No
```

### Random Wait Step
```
Type: "random_wait"
Purpose: Chờ ngẫu nhiên (mô phỏng người)
Executors: execute_random_wait_step()
ADB: No
```

### Loop Step
```
Type: "loop"
Purpose: Lặp lại steps
Executors: execute_loop_step()
Recursive: Yes
```

### While Step
```
Type: "while"
Purpose: Lặp có điều kiện
Executors: execute_while_step()
Recursive: Yes
```

### Condition Step
```
Type: "condition"
Purpose: Rẽ nhánh
Executors: execute_condition_step()
Recursive: Yes
```

### Python Step
```
Type: "python"
Purpose: Chạy Python script
Executors: execute_python_step()
Process: Spawn python.exe
```

### Parallel Step
```
Type: "parallel"
Purpose: Chạy đồng thời
Executors: execute_parallel_step()
Async: tokio::join!
```

## 🔍 Example: TikTok Workflow Execution Trace

```
[START] Workflow: TikTok Auto Engagement
  Inputs: { video_count: 3, like_rate: 50 }
  Device: emulator-5554

[STEP-1] type=action, action=open_app
  Params: { package: "com.zhiliaoapp.musically" }
  ADB: adb -s emulator-5554 shell monkey -p com.zhiliaoapp.musically ...
  Result: ✅ Success

[STEP-2] type=wait, duration=3000
  Wait: 3000ms
  Result: ✅ Success

[STEP-3] type=loop, count=3, variable=i
  
  [ITERATION 0]
    [STEP-3-1] type=random_wait, min=3000, max=10000
      Random delay: 6234ms
      Result: ✅ Success
    
    [STEP-3-2] type=python, save_to=like_decision
      Script: import random; return {'should_like': random.randint(1, 100) <= 50}
      Result: { should_like: true }
      Context updated: like_decision = { should_like: true }
      Result: ✅ Success
    
    [STEP-3-3] type=condition, condition={{like_decision.should_like}}
      Compiled: "true"
      Branch: THEN
      
      [STEP-3-3-1] type=action, action=tap
        Params: { target: "center", double: true }
        ADB: adb -s emulator-5554 shell input tap 540 1200
        ADB: adb -s emulator-5554 shell input tap 540 1200
        Result: ✅ Success
      
      [STEP-3-3-2] type=random_wait, min=500, max=1500
        Random delay: 987ms
        Result: ✅ Success
    
    [STEP-3-4] type=action, action=swipe_up
      ADB: adb -s emulator-5554 shell input swipe 520 1450 520 550 300
      Result: ✅ Success
    
    [STEP-3-5] type=random_wait, min=500, max=2000
      Random delay: 1234ms
      Result: ✅ Success
  
  [ITERATION 1]
    ... (tương tự)
  
  [ITERATION 2]
    ... (tương tự)

[END] Workflow completed
  Duration: 45.6s
  Steps executed: 17
  Steps failed: 0
  Status: ✅ Success
```

## 🚀 Performance Considerations

### Async Execution
- Tất cả ADB commands chạy async với `tokio`
- Parallel steps thực thi đồng thời với `tokio::join!`
- Python scripts chạy trong separate process

### Error Handling
- Mỗi step có thể config `error_handling`
- Options: `continue`, `stop`, `retry`
- Retry với exponential backoff

### Timeout
- Workflow-level timeout
- Step-level timeout
- ADB command timeout (30s default)

---

**Tài liệu này giải thích chi tiết kiến trúc và luồng hoạt động của Workflow Engine**
