# ⚠️ Workflow Engine vs DroidRun - Sự khác biệt quan trọng

## 🎯 TL;DR

**Workflow Engine KHÔNG sử dụng DroidRun!**

Workflow Engine sử dụng **ADB trực tiếp**, không qua DroidRun Portal hay DroidAgent.

---

## 📊 So sánh chi tiết

| Tính năng | Workflow Engine | DroidRun (Task) |
|-----------|----------------|-----------------|
| **File code** | `workflow.rs` | `task.rs` |
| **Giao tiếp với device** | ADB trực tiếp | DroidRun Portal + ADB |
| **Commands** | `adb shell input tap/swipe/...` | `python run_droidrun.py` |
| **AI/LLM** | ❌ Không | ✅ Có (OpenAI, Gemini, ...) |
| **Natural Language** | ❌ Không | ✅ Có |
| **DroidRun Portal** | ❌ Không cần | ✅ Bắt buộc |
| **Python SDK** | ❌ Không (trừ Python step) | ✅ Có |
| **Định nghĩa** | JSON workflow definition | Natural language prompt |
| **Phức tạp** | Đơn giản, script-based | Phức tạp, AI-powered |
| **Tốc độ** | Nhanh | Chậm hơn (do AI) |
| **Chi phí** | Miễn phí | Tốn API key |

---

## 🔧 Workflow Engine - Cách hoạt động

### Kiến trúc

```
[WorkflowPanel] → [workflow.rs] → [ADB] → [Device]
                       ↓
                  execute_step()
                       ↓
              ┌────────┴────────┐
              ↓                 ↓
        execute_action_step()  execute_loop_step()
              ↓
         run_adb()
              ↓
    adb shell input tap 500 1000
```

### Ví dụ code

```rust
// workflow.rs - execute_action_step()
async fn run_adb(device_id: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-s", device_id];
    cmd_args.extend(args);
    
    let mut cmd = new_async_command("adb");
    cmd.args(&cmd_args);
    
    let output = cmd.output().await
        .map_err(|e| format!("ADB error: {}", e))?;
    
    // ...
}

// Ví dụ: Tap action
"tap" => {
    let x = params.get("x").ok_or("Missing 'x' param")?;
    let y = params.get("y").ok_or("Missing 'y' param")?;
    run_adb(device_id, &["shell", "input", "tap", x, y]).await?;
}
```

**Thực tế chạy:**
```bash
adb -s emulator-5554 shell input tap 500 1000
```

---

## 🤖 DroidRun (Task) - Cách hoạt động

### Kiến trúc

```
[ExecutionPanel] → [task.rs] → [run_droidrun.py] → [DroidRun SDK] → [LLM API] → [Device]
                                                           ↓
                                                    DroidRun Portal
                                                           ↓
                                                    Accessibility Tree
```

### Ví dụ code

```rust
// task.rs - run_task_internal()
pub async fn run_task_internal(
    window: &tauri::Window,
    device_id: String,
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    // ...
) -> Result<TaskResult, String> {
    // Get run_droidrun.py path
    let script_path = get_resource_path()
        .join("run_droidrun.py");
    
    // Build command
    let mut cmd = new_async_command("python");
    cmd.arg(&script_path)
       .arg("--device").arg(&device_id)
       .arg("--provider").arg(&provider)
       .arg("--api-key").arg(&api_key)
       .arg("--model").arg(&model)
       .arg("--prompt").arg(&prompt);
    
    // Execute
    let mut child = cmd.spawn()?;
    // ...
}
```

**Thực tế chạy:**
```bash
python run_droidrun.py \
  --device emulator-5554 \
  --provider openai \
  --api-key sk-xxx \
  --model gpt-4 \
  --prompt "Open TikTok and like 5 videos"
```

**DroidRun SDK sẽ:**
1. Kết nối DroidRun Portal trên device
2. Lấy Accessibility Tree (UI structure)
3. Gửi screenshot + UI tree + prompt → LLM
4. LLM trả về actions (tap, swipe, ...)
5. Thực thi actions qua Portal

---

## 🎭 Khi nào dùng cái nào?

### ✅ Dùng Workflow Engine khi:

1. **Biết chính xác steps cần làm**
   - Ví dụ: Tap (500, 1000) → Wait 2s → Swipe up
   
2. **Không cần AI**
   - Workflow đơn giản, lặp lại
   
3. **Muốn nhanh và miễn phí**
   - Không tốn API key
   
4. **Automation cố định**
   - Macro, script tự động

### ✅ Dùng DroidRun (Task) khi:

1. **Không biết chính xác UI**
   - Ví dụ: "Tìm nút Like và tap vào"
   
2. **Cần AI hiểu ngữ cảnh**
   - Natural language: "Like 5 videos on TikTok"
   
3. **UI thay đổi thường xuyên**
   - AI tự adapt với UI mới
   
4. **Task phức tạp**
   - Cần reasoning, decision making

---

## 🔍 Tại sao Workflow không dùng DroidRun?

### Lý do thiết kế:

1. **Performance**
   - ADB trực tiếp nhanh hơn nhiều
   - Không cần wait LLM response (2-5s/request)

2. **Cost**
   - Miễn phí hoàn toàn
   - Không tốn API key

3. **Reliability**
   - Không phụ thuộc LLM API
   - Không bị rate limit

4. **Simplicity**
   - Dễ debug
   - Dễ hiểu flow

5. **Use case khác nhau**
   - Workflow: Automation cố định
   - DroidRun: AI-powered flexible tasks

---

## 💡 Có thể kết hợp không?

### ✅ Có! Qua Python step

Workflow có thể gọi DroidRun trong Python step:

```javascript
{
  "type": "python",
  "script": `
from droidrun.agent.core import Agent
from droidrun import DeviceConfig, DroidrunConfig

# Use DroidRun for complex task
device_config = DeviceConfig(serial="{{device_id}}")
config = DroidrunConfig(device=device_config)
agent = Agent(goal="Find and tap the like button", config=config)
result = await agent.run()

return {"success": result.success}
  `,
  "save_to": "droidrun_result"
}
```

**Nhưng:**
- Cần cài DroidRun SDK
- Cần API key
- Chậm hơn nhiều

---

## 🐛 Debug: Tại sao điện thoại không có thao tác?

### Nếu dùng Workflow Engine:

**Kiểm tra ADB:**
```bash
# 1. Device có kết nối không?
adb devices

# 2. Test tap thủ công
adb shell input tap 500 1000

# 3. Test swipe thủ công
adb shell input swipe 500 1500 500 500 300
```

**Nếu ADB hoạt động → Vấn đề ở workflow definition**
- Kiểm tra tọa độ
- Kiểm tra thời gian wait
- Xem logs trong ExecutionPanel

### Nếu dùng DroidRun (Task):

**Kiểm tra DroidRun Portal:**
```bash
# 1. Portal có cài không?
adb shell pm list packages | grep droidrun

# 2. Portal có chạy không?
adb shell dumpsys activity | grep droidrun

# 3. Test ping
python -c "from droidrun import ping; ping('device_id')"
```

**Nếu Portal không có → Cài đặt:**
```bash
droidrun setup
```

---

## 📚 Tài liệu liên quan

- **Workflow Guide**: [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)
- **Workflow Architecture**: [WORKFLOW_ARCHITECTURE.md](./WORKFLOW_ARCHITECTURE.md)
- **DroidRun Docs**: [INDEX.md](./INDEX.md)

---

## 🎓 Kết luận

| | Workflow Engine | DroidRun |
|---|---|---|
| **Công nghệ** | ADB commands | AI + DroidRun SDK |
| **Định nghĩa** | JSON workflow | Natural language |
| **Tốc độ** | ⚡ Rất nhanh | 🐌 Chậm (do AI) |
| **Chi phí** | 💰 Miễn phí | 💸 Tốn API key |
| **Độ phức tạp** | 📝 Đơn giản | 🧠 Phức tạp |
| **Use case** | Fixed automation | Flexible AI tasks |

**Chọn đúng tool cho đúng việc!** 🎯

---

**Cập nhật**: 2026-01-09
