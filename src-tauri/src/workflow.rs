// Workflow Engine Module - Step-based Task Automation
// Hỗ trợ các step types: action, condition, loop, while, parallel, python, prompt, wait, extract

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tauri::{command, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Helper to create a tokio command with hidden window on Windows
fn new_async_command(program: &str) -> tokio::process::Command {
    let std_cmd = std::process::Command::new(program);
    #[cfg(windows)]
    std_cmd.creation_flags(CREATE_NO_WINDOW);
    tokio::process::Command::from(std_cmd)
}

// ============================================
// Data Models
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub category: Option<String>,
    
    /// Input variables - user can configure before running
    pub inputs: Vec<WorkflowInput>,
    
    /// Workflow steps - the actual execution flow
    pub steps: Vec<WorkflowStep>,
    
    /// Output variable names to return after execution
    pub outputs: Vec<String>,
    
    /// Max execution time in seconds
    pub timeout: Option<i32>,
    
    /// Global delay between steps in milliseconds (default: 800)
    pub step_delay: Option<u64>,
    
    pub created_at: Option<String>,
    pub is_builtin: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowInput {
    pub name: String,
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub input_type: String, // "string", "number", "boolean", "select", "text"
    pub default: Option<serde_json::Value>,
    pub options: Option<Vec<SelectOption>>, // For "select" type
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectOption {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStep {
    pub id: String,
    
    /// Step type: action, condition, loop, while, parallel, python, prompt, wait, extract, skill
    #[serde(rename = "type")]
    pub step_type: String,
    
    pub name: Option<String>,
    
    // For ACTION step
    pub action: Option<String>,
    pub params: Option<HashMap<String, serde_json::Value>>,
    
    // For CONDITION step
    pub condition: Option<String>,
    pub then: Option<Vec<WorkflowStep>>,
    #[serde(rename = "else")]
    pub else_branch: Option<Vec<WorkflowStep>>,
    
    // For LOOP step
    pub count: Option<String>, // Can be number or variable like "{{video_count}}"
    pub variable: Option<String>, // Loop variable name
    pub body: Option<Vec<WorkflowStep>>,
    
    // For WHILE step
    pub max_iterations: Option<i32>,
    
    // For PARALLEL step
    pub branches: Option<Vec<Vec<WorkflowStep>>>,
    
    // For PYTHON step
    pub script: Option<String>,
    pub save_to: Option<String>, // Variable name to save result
    
    // For AI PYTHON step (ScripterAgent) - LLM generates code from prompt
    pub ai_prompt: Option<String>,
    
    // For PROMPT step
    pub prompt: Option<String>,
    
    // For WAIT step
    pub duration: Option<String>, // Can be number or variable
    pub wait_condition: Option<String>,
    
    // Delay after this step completes (in milliseconds)
    pub delay_after: Option<u64>,
    
    // For EXTRACT step
    pub selector: Option<String>,
    
    // For SKILL step
    pub skill_id: Option<String>,
    
    // Error handling
    pub on_error: Option<ErrorConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorConfig {
    pub strategy: String, // "abort", "skip", "retry", "fallback"
    pub retries: Option<i32>,
    pub fallback: Option<Vec<WorkflowStep>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowContext {
    /// Input values provided by user
    pub inputs: HashMap<String, serde_json::Value>,
    
    /// Runtime variables (results from steps, loop variables, etc)
    pub variables: HashMap<String, serde_json::Value>,
    
    /// Device ID for ADB commands
    pub device_id: String,
    
    /// Current step being executed
    pub current_step_id: Option<String>,
    
    /// Execution logs
    pub logs: Vec<WorkflowLog>,
    
    // ============ Shared State for ScripterAgent ============
    /// Action history - records of completed steps for AI analysis
    #[serde(default)]
    pub history: Vec<ActionRecord>,
    
    /// Current plan/goal from ManagerAgent
    #[serde(default)]
    pub plan: Option<String>,
    
    /// Error context for self-healing
    #[serde(default)]
    pub last_error: Option<ErrorContext>,
}

/// Record of an executed action for history tracking
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActionRecord {
    pub step_id: String,
    pub step_type: String,
    pub action: Option<String>,
    pub result: Option<serde_json::Value>,
    pub success: bool,
    pub timestamp: String,
    pub duration_ms: i64,
}

/// Error context for self-healing analysis
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ErrorContext {
    pub step_id: String,
    pub error_message: String,
    pub retry_count: i32,
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLog {
    pub timestamp: String,
    pub level: String, // "info", "success", "warning", "error"
    pub step_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowResult {
    pub success: bool,
    pub workflow_id: String,
    pub outputs: HashMap<String, serde_json::Value>,
    pub logs: Vec<WorkflowLog>,
    pub duration_ms: i64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonScriptResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub output: String,
    pub error: Option<String>,
}

// ============================================
// Calibration Mode - LLM Vision analysis
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationResult {
    pub success: bool,
    pub description: String,
    pub total_steps: i32,
    pub steps: Vec<CalibrationStep>,
    pub workflow: Option<WorkflowDefinition>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationStep {
    pub order: i32,
    pub action: String,
    pub description: String,
    pub params: HashMap<String, serde_json::Value>,
    pub wait_after: i32,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingResult {
    pub success: bool,
    pub message: Option<String>,
    pub total_actions: i32,
    pub workflow: Option<WorkflowDefinition>,
    pub error: Option<String>,
}

/// Record workflow by running DroidRun agent and capturing actions
/// Step 2 of new flow: Execute with DroidRun and record real coordinates
#[command]
pub async fn record_workflow(
    window: tauri::Window,
    device_id: String,
    task: String,
    provider: String,
    api_key: String,
    model: Option<String>,
    base_url: Option<String>,
    max_steps: Option<i32>,
    vision: Option<bool>,
) -> Result<RecordingResult, String> {
    println!("[RECORDER] Starting recording for: {}", task);
    println!("[RECORDER] Device: {}, Provider: {}", device_id, provider);
    
    // Check and use AI request
    match crate::license::check_and_use_ai_request("record_workflow").await {
        Ok(remaining) => {
            println!("[RECORDER] AI request used, remaining: {}", remaining);
        }
        Err(e) => {
            return Err(format!("AI request failed: {}", e));
        }
    }
    
    let _ = window.emit("recording-start", serde_json::json!({
        "device_id": device_id,
        "task": task,
    }));
    
    // Set API key environment variable
    std::env::set_var("OPENAI_API_KEY", &api_key);
    if !api_key.is_empty() {
        std::env::set_var("OPENAI_API_KEY", &api_key);
    }
    
    // Get trajectories folder path
    let traj_base = if cfg!(debug_assertions) {
        let cwd = std::env::current_dir().unwrap_or_default();
        if cwd.join("trajectories").exists() || cwd.ends_with("src-tauri") {
            cwd.join("trajectories")
        } else {
            cwd.join("src-tauri/trajectories")
        }
    } else {
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Cannot get exe path: {}", e))?
            .parent()
            .ok_or("Cannot get exe parent dir")?
            .to_path_buf();
        exe_dir.join("trajectories")
    };
    
    // Get latest trajectory folder timestamp before running
    let traj_before: Vec<_> = if traj_base.exists() {
        std::fs::read_dir(&traj_base)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).collect())
            .unwrap_or_default()
    } else {
        vec![]
    };
    
    // Build command: python -m droidrun run <task> [options]
    let mut cmd = new_async_command("python");
    
    // Map Z.AI and other OpenAI-compatible providers to OpenAILike
    let actual_provider = match provider.to_lowercase().as_str() {
        "z.ai" | "zai" => "OpenAILike",
        "openailike" => "OpenAILike",
        "openai" => "OpenAI",
        "anthropic" => "Anthropic",
        "googlegenai" | "google" | "gemini" => "GoogleGenAI",
        "deepseek" => "DeepSeek",
        "ollama" => "Ollama",
        _ => &provider,
    };
    
    cmd.arg("-m").arg("droidrun").arg("run")
       .arg(&task)
       .arg("--device").arg(&device_id)
       .arg("--provider").arg(actual_provider)
       .arg("--save-trajectory").arg("action")
       .arg("--steps").arg(max_steps.unwrap_or(30).to_string());
    
    if let Some(m) = &model {
        cmd.arg("--model").arg(m);
    }
    
    if let Some(url) = &base_url {
        cmd.arg("--api_base").arg(url);
    }
    
    // Vision flag
    if vision.unwrap_or(false) {
        cmd.arg("--vision");
    } else {
        cmd.arg("--no-vision");
    }
    
    // Set working directory to src-tauri so trajectories are saved there
    let work_dir = if cfg!(debug_assertions) {
        let cwd = std::env::current_dir().unwrap_or_default();
        if cwd.ends_with("src-tauri") {
            cwd
        } else {
            cwd.join("src-tauri")
        }
    } else {
        std::env::current_exe()
            .map_err(|e| format!("Cannot get exe path: {}", e))?
            .parent()
            .ok_or("Cannot get exe parent dir")?
            .to_path_buf()
    };
    cmd.current_dir(&work_dir);
    
    // Set environment for UTF-8
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    
    println!("[RECORDER] Running: python -m droidrun run \"{}\" --device {} --provider {} ...", 
             task.chars().take(50).collect::<String>(), device_id, provider);
    
    let _ = window.emit("recording-progress", serde_json::json!({
        "status": "running",
        "message": "DroidRun agent is executing task..."
    }));
    
    // Execute with timeout
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(300), // 5 min timeout
        cmd.output()
    ).await
    .map_err(|_| "Recording timeout after 5 minutes")?
    .map_err(|e| format!("Failed to run droidrun: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    println!("[RECORDER] DroidRun output:\n{}", stdout.chars().take(1000).collect::<String>());
    if !stderr.is_empty() {
        println!("[RECORDER] DroidRun stderr:\n{}", stderr.chars().take(500).collect::<String>());
    }
    
    // Find new trajectory folder (created after we started)
    let traj_after: Vec<_> = if traj_base.exists() {
        std::fs::read_dir(&traj_base)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).collect())
            .unwrap_or_default()
    } else {
        vec![]
    };
    
    let new_traj_folder = traj_after.iter()
        .filter(|p| !traj_before.contains(p))
        .max_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok());
    
    // If no new folder, find the most recent one
    let traj_folder = new_traj_folder.cloned().or_else(|| {
        traj_after.iter()
            .max_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok())
            .cloned()
    });
    
    if let Some(folder) = &traj_folder {
        println!("[RECORDER] Found trajectory folder: {:?}", folder);
        
        // Parse macro.json for actions
        let macro_path = folder.join("macro.json");
        if macro_path.exists() {
            let macro_json = std::fs::read_to_string(&macro_path)
                .map_err(|e| format!("Cannot read macro.json: {}", e))?;
            
            let macro_data: serde_json::Value = serde_json::from_str(&macro_json)
                .map_err(|e| format!("Invalid macro.json: {}", e))?;
            
            // Build workflow from macro
            let actions = macro_data.get("actions").and_then(|a| a.as_array()).cloned().unwrap_or_default();
            let total_actions = actions.len() as i32;
            
            // Convert to workflow steps
            let mut steps = Vec::new();
            for (i, action) in actions.iter().enumerate() {
                let action_type = action.get("action_type")
                    .or(action.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("tap");
                
                let description = action.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                
                // Build params based on action type
                let mut params = serde_json::Map::new();
                if action_type.contains("tap") || action_type.contains("Tap") {
                    if let Some(x) = action.get("x").and_then(|v| v.as_i64()) {
                        params.insert("x".to_string(), serde_json::json!(x));
                    }
                    if let Some(y) = action.get("y").and_then(|v| v.as_i64()) {
                        params.insert("y".to_string(), serde_json::json!(y));
                    }
                    if let Some(idx) = action.get("element_index").and_then(|v| v.as_i64()) {
                        params.insert("element_index".to_string(), serde_json::json!(idx));
                    }
                    if let Some(text) = action.get("element_text").and_then(|v| v.as_str()) {
                        params.insert("element_text".to_string(), serde_json::json!(text));
                    }
                }
                
                let step = WorkflowStep {
                    id: format!("step-{}", i + 1),
                    step_type: "action".to_string(),
                    name: Some(if description.is_empty() {
                        format!("Step {}", i + 1)
                    } else {
                        description.chars().take(50).collect::<String>()
                    }),
                    action: Some(if action_type.contains("tap") || action_type.contains("Tap") {
                        "tap".to_string()
                    } else if action_type.contains("swipe") || action_type.contains("Swipe") {
                        "swipe".to_string()
                    } else if action_type.contains("type") || action_type.contains("Type") || action_type.contains("Input") {
                        "input_text".to_string()
                    } else if action_type.contains("back") || action_type.contains("Back") {
                        "back".to_string()
                    } else {
                        action_type.to_lowercase()
                    }),
                    params: Some(params.into_iter().collect()),
                    duration: None,
                    delay_after: None,
                    prompt: None,
                    script: None,
                    save_to: None,
                    count: None,
                    variable: None,
                    body: None,
                    condition: None,
                    then: None,
                    else_branch: None,
                    max_iterations: None,
                    branches: None,
                    wait_condition: None,
                    selector: None,
                    skill_id: None,
                    on_error: None,
                    ai_prompt: None,
                };
                steps.push(step);
                
                // Add wait after action
                steps.push(WorkflowStep {
                    id: format!("wait-{}", i + 1),
                    step_type: "wait".to_string(),
                    name: Some("Wait".to_string()),
                    duration: Some("500".to_string()),
                    delay_after: None,
                    action: None,
                    params: None,
                    prompt: None,
                    script: None,
                    save_to: None,
                    count: None,
                    variable: None,
                    body: None,
                    condition: None,
                    then: None,
                    else_branch: None,
                    max_iterations: None,
                    branches: None,
                    wait_condition: None,
                    selector: None,
                    skill_id: None,
                    on_error: None,
                    ai_prompt: None,
                });
            }
            
            let workflow = WorkflowDefinition {
                id: format!("recorded-{}", chrono::Utc::now().timestamp_millis()),
                name: macro_data.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&task)
                    .chars().take(50).collect::<String>(),
                description: Some(task.clone()),
                icon: Some("🎯".to_string()),
                color: Some("#10B981".to_string()),
                category: Some("recorded".to_string()),
                timeout: Some(300),
                step_delay: Some(3000), // Default 3s delay between steps
                inputs: vec![],
                steps,
                outputs: vec![],
                is_builtin: Some(false),
                created_at: None,
            };
            
            let _ = window.emit("recording-complete", serde_json::json!({
                "success": true,
                "workflow": workflow,
                "total_actions": total_actions,
            }));
            
            return Ok(RecordingResult {
                success: true,
                message: Some(format!("Recording complete! {} actions", total_actions)),
                total_actions,
                workflow: Some(workflow),
                error: None,
            });
        }
    }
    
    // No trajectory found or no macro.json
    let _ = window.emit("recording-complete", serde_json::json!({
        "success": false,
        "error": "No macro.json found - DroidRun may have failed",
    }));
    
    let error_msg = if stderr.is_empty() {
        format!("Recording completed but no macro.json found. DroidRun output:\n{}", 
                stdout.chars().take(800).collect::<String>())
    } else {
        format!("Recording failed.\nStdout:\n{}\n\nStderr:\n{}", 
                stdout.chars().take(500).collect::<String>(),
                stderr.chars().take(500).collect::<String>())
    };
    
    Err(error_msg)
}

/// Execute a single action on device via ADB
async fn execute_single_action(
    device_id: &str,
    action_type: &str,
    params: &std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let mut cmd = new_async_command("adb");
    cmd.arg("-s").arg(device_id);
    
    match action_type.to_lowercase().as_str() {
        "tap" => {
            let x = params.get("x").ok_or("Missing x coordinate")?;
            let y = params.get("y").ok_or("Missing y coordinate")?;
            cmd.args(&["shell", "input", "tap", x, y]);
        }
        "swipe" | "swipe_up" | "swipe_down" | "swipe_left" | "swipe_right" => {
            let (x1, y1, x2, y2) = match action_type.to_lowercase().as_str() {
                "swipe_up" => ("500", "1500", "500", "500"),
                "swipe_down" => ("500", "500", "500", "1500"),
                "swipe_left" => ("800", "500", "200", "500"),
                "swipe_right" => ("200", "500", "800", "500"),
                _ => {
                    let x1 = params.get("x1").or(params.get("start_x")).map(|s| s.as_str()).unwrap_or("500");
                    let y1 = params.get("y1").or(params.get("start_y")).map(|s| s.as_str()).unwrap_or("1500");
                    let x2 = params.get("x2").or(params.get("end_x")).map(|s| s.as_str()).unwrap_or("500");
                    let y2 = params.get("y2").or(params.get("end_y")).map(|s| s.as_str()).unwrap_or("500");
                    (x1, y1, x2, y2)
                }
            };
            let duration = params.get("duration").map(|s| s.as_str()).unwrap_or("300");
            cmd.args(&["shell", "input", "swipe", x1, y1, x2, y2, duration]);
        }
        "input_text" | "type" => {
            let text = params.get("text").ok_or("Missing text to input")?;
            // Escape text for shell
            let escaped_text = text.replace(' ', "%s").replace("'", "\\'");
            cmd.args(&["shell", "input", "text", &escaped_text]);
        }
        "back" => {
            cmd.args(&["shell", "input", "keyevent", "4"]);
        }
        "home" => {
            cmd.args(&["shell", "input", "keyevent", "3"]);
        }
        "enter" => {
            cmd.args(&["shell", "input", "keyevent", "66"]);
        }
        "open_app" => {
            let package = params.get("package").ok_or("Missing package name")?;
            cmd.args(&["shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"]);
        }
        "wait" => {
            // Wait is handled separately, just return Ok
            let duration_str = params.get("duration").map(|s| s.as_str()).unwrap_or("1000");
            let duration_ms: u64 = duration_str.parse().unwrap_or(1000);
            tokio::time::sleep(std::time::Duration::from_millis(duration_ms)).await;
            return Ok(());
        }
        _ => {
            return Err(format!("Unknown action type: {}", action_type));
        }
    }
    
    let output = cmd.output().await
        .map_err(|e| format!("Failed to run ADB: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ADB command failed: {}", stderr));
    }
    
    Ok(())
}

/// Execute a list of actions directly on device
/// Used by wizard Step 2 to execute LLM-planned actions
#[command]
pub async fn execute_actions(
    window: tauri::Window,
    device_id: String,
    actions: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    use std::collections::HashMap;
    
    println!("[EXECUTE] Starting execution of {} actions on {}", actions.len(), device_id);
    
    let _ = window.emit("execution-start", serde_json::json!({
        "device_id": device_id,
        "total_actions": actions.len(),
    }));
    
    let mut results: Vec<serde_json::Value> = Vec::new();
    let mut success_count = 0;
    let mut error_count = 0;
    
    for (i, action) in actions.iter().enumerate() {
        let action_type = action.get("action")
            .or_else(|| action.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        
        let params: HashMap<String, String> = if let Some(p) = action.get("params").and_then(|v| v.as_object()) {
            p.iter()
                .map(|(k, v)| (k.clone(), v.to_string().trim_matches('"').to_string()))
                .collect()
        } else {
            HashMap::new()
        };
        
        let description = action.get("description")
            .or_else(|| action.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Action");
        
        println!("[EXECUTE] Step {}/{}: {} - {}", i + 1, actions.len(), action_type, description);
        
        let _ = window.emit("execution-progress", serde_json::json!({
            "step": i + 1,
            "total": actions.len(),
            "action": action_type,
            "description": description,
        }));
        
        // Execute action
        let exec_result = execute_single_action(&device_id, action_type, &params).await;
        
        match exec_result {
            Ok(_) => {
                success_count += 1;
                results.push(serde_json::json!({
                    "step": i + 1,
                    "action": action_type,
                    "status": "success",
                    "description": description,
                }));
            }
            Err(e) => {
                error_count += 1;
                println!("[EXECUTE] Error at step {}: {}", i + 1, e);
                results.push(serde_json::json!({
                    "step": i + 1,
                    "action": action_type,
                    "status": "error",
                    "error": e,
                    "description": description,
                }));
            }
        }
        
        // Small delay between actions
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    
    let _ = window.emit("execution-complete", serde_json::json!({
        "success": error_count == 0,
        "success_count": success_count,
        "error_count": error_count,
    }));
    
    Ok(serde_json::json!({
        "success": error_count == 0,
        "total_actions": actions.len(),
        "success_count": success_count,
        "error_count": error_count,
        "results": results,
    }))
}

/// Run DroidRun agent to execute a task and return the recorded macro
#[command]
pub async fn run_droidrun_task(
    window: tauri::Window,
    device_id: String,
    task: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    max_steps: Option<i32>,
) -> Result<serde_json::Value, String> {
    use std::process::Stdio;
    
    println!("[DROIDRUN_TASK] Starting: {}", task);
    
    // Check and use AI request
    match crate::license::check_and_use_ai_request("droidrun_task").await {
        Ok(remaining) => {
            println!("[DROIDRUN_TASK] AI request used, remaining: {}", remaining);
        }
        Err(e) => {
            return Err(format!("AI request failed: {}", e));
        }
    }
    
    // Get actual credentials (injects hidden creds for mun-ai)
    let (final_base_url, final_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);
    
    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };
    
    let steps = max_steps.unwrap_or(50);
    
    // Use run_droidrun.py wrapper instead of CLI to support custom headers
    let script_path = std::env::current_exe()
        .map_err(|e| format!("Cannot get exe path: {}", e))?
        .parent()
        .ok_or("Cannot get parent dir")?
        .join("run_droidrun.py");
    
    // Fallback to src-tauri directory during development
    let script_path = if script_path.exists() {
        script_path
    } else {
        std::path::PathBuf::from("src-tauri/run_droidrun.py")
    };
    
    // Build command using wrapper script
    let mut cmd = new_async_command("python");
    cmd.arg(script_path.to_string_lossy().as_ref());
    cmd.arg(&device_id);
    cmd.arg(actual_provider);
    cmd.arg(&model);
    cmd.arg(&task);
    cmd.arg(&final_api_key);
    cmd.arg(&final_base_url);
    cmd.arg("false"); // vision
    cmd.arg("false"); // reasoning
    // Enable trajectory recording to generate macro.json
    cmd.arg(r#"{"save_trajectory":"action"}"#);
    
    cmd.env("OPENAI_API_KEY", &final_api_key);
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONLEGACYWINDOWSSTDIO", "0");
    
    // Set base URL env vars for compatibility
    if !final_base_url.is_empty() {
        cmd.env("OPENAI_BASE_URL", &final_base_url);
        cmd.env("OPENAI_API_BASE", &final_base_url);
    }
    
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    let _ = window.emit("droidrun-progress", serde_json::json!({
        "status": "starting",
        "message": format!("Starting DroidRun: {}", task),
    }));
    
    println!("[DROIDRUN_TASK] Running DroidRun with {} steps...", steps);
    
    let output = cmd.output().await
        .map_err(|e| format!("Failed to run DroidRun: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    println!("[DROIDRUN_TASK] Output: {} chars, Exit: {:?}", 
        stdout.len(), output.status.code());
    
    // Log stderr if there's an error
    if !stderr.is_empty() {
        println!("[DROIDRUN_TASK] Stderr: {}", stderr);
    }
    
    // If process failed, return error with both stdout and stderr
    if !output.status.success() {
        return Err(format!(
            "DroidRun failed (exit {}). Stdout: {}\nStderr: {}",
            output.status.code().unwrap_or(-1),
            stdout.chars().take(500).collect::<String>(),
            stderr.chars().take(500).collect::<String>()
        ));
    }
    
    // Find the latest trajectory folder
    let trajectories_dir = std::path::Path::new("trajectories");
    let mut macro_data: Option<serde_json::Value> = None;
    let mut trajectory_path = String::new();
    
    if trajectories_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(trajectories_dir) {
            let mut folders: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .collect();
            
            // Sort by name descending (latest first since folder names include timestamp)
            folders.sort_by(|a, b| b.path().cmp(&a.path()));
            
            if let Some(latest) = folders.first() {
                trajectory_path = latest.path().to_string_lossy().to_string();
                
                // Try macro.json first, then trajectory.json
                let macro_path = latest.path().join("macro.json");
                let trajectory_json_path = latest.path().join("trajectory.json");
                
                if macro_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&macro_path) {
                        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                            macro_data = Some(data);
                        }
                    }
                } else if trajectory_json_path.exists() {
                    // Convert trajectory.json to macro format
                    if let Ok(content) = std::fs::read_to_string(&trajectory_json_path) {
                        if let Ok(traj_data) = serde_json::from_str::<Vec<serde_json::Value>>(&content) {
                            // Extract actions from trajectory
                            let actions: Vec<serde_json::Value> = traj_data.iter()
                                .filter_map(|event| {
                                    let event_type = event.get("type")?.as_str()?;
                                    if event_type.contains("Action") || event_type.contains("action") {
                                        Some(serde_json::json!({
                                            "action_type": event.get("action").and_then(|a| a.as_str()).unwrap_or("unknown"),
                                            "description": event.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                                            "x": event.get("x").and_then(|v| v.as_i64()),
                                            "y": event.get("y").and_then(|v| v.as_i64()),
                                            "text": event.get("text").and_then(|t| t.as_str()),
                                        }))
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            
                            macro_data = Some(serde_json::json!({
                                "actions": actions,
                                "source": "trajectory.json",
                            }));
                        }
                    }
                }
            }
        }
    }
    
    let _ = window.emit("droidrun-progress", serde_json::json!({
        "status": "complete",
        "message": "DroidRun completed",
    }));
    
    if let Some(data) = macro_data {
        let actions = data["actions"].as_array().map(|a| a.len()).unwrap_or(0);
        println!("[DROIDRUN_TASK] ✓ Macro loaded: {} actions", actions);
        
        Ok(serde_json::json!({
            "success": true,
            "macro": data,
            "trajectory_path": trajectory_path,
            "total_actions": actions,
            "stdout_preview": stdout.chars().take(500).collect::<String>(),
        }))
    } else {
        Err(format!(
            "DroidRun did not generate macro.json. Output: {}",
            stdout.chars().take(500).collect::<String>()
        ))
    }
}

/// Calibrate workflow using LLM Vision
/// Analyzes current screen and generates accurate workflow steps
#[command]
pub async fn calibrate_workflow(
    window: tauri::Window,
    device_id: String,
    description: String,
    provider: String,
    api_key: String,
    model: Option<String>,
    base_url: Option<String>,
    num_screens: Option<i32>,
) -> Result<CalibrationResult, String> {
    println!("[CALIBRATOR] Starting calibration for: {}", description);
    println!("[CALIBRATOR] Device: {}, Provider: {}", device_id, provider);
    
    let _ = window.emit("calibration-start", serde_json::json!({
        "device_id": device_id,
        "description": description,
    }));
    
    // Get calibrator script path
    let calibrator_path = if cfg!(debug_assertions) {
        // In dev mode, check current dir first, then try src-tauri
        let cwd = std::env::current_dir().unwrap_or_default();
        let path1 = cwd.join("workflow_calibrator.py");
        let path2 = cwd.join("src-tauri/workflow_calibrator.py");
        if path1.exists() {
            path1
        } else if path2.exists() {
            path2
        } else {
            // Fallback for tauri dev running from src-tauri
            std::path::PathBuf::from("workflow_calibrator.py")
        }
    } else {
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Cannot get exe path: {}", e))?
            .parent()
            .ok_or("Cannot get exe parent dir")?
            .to_path_buf();
        exe_dir.join("workflow_calibrator.py")
    };
    
    println!("[CALIBRATOR] Script path: {:?}", calibrator_path);
    
    // Build command
    let mut cmd = new_async_command("py");
    cmd.arg(&calibrator_path)
       .arg(&device_id)
       .arg(&description)
       .arg("--provider").arg(&provider)
       .arg("--api-key").arg(&api_key);
    
    if let Some(m) = model {
        cmd.arg("--model").arg(&m);
    }
    
    if let Some(url) = base_url {
        cmd.arg("--base-url").arg(&url);
    }
    
    if let Some(n) = num_screens {
        cmd.arg("--screens").arg(n.to_string());
    }
    
    // Create temp output file
    let output_file = std::env::temp_dir().join(format!("calibration_{}.json", uuid::Uuid::new_v4()));
    cmd.arg("--output").arg(&output_file);
    
    let _ = window.emit("calibration-progress", serde_json::json!({
        "status": "analyzing",
        "message": "Đang phân tích màn hình với LLM Vision..."
    }));
    
    // Execute
    let output = cmd.output().await
        .map_err(|e| format!("Calibrator error: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    println!("[CALIBRATOR] stdout: {}", stdout);
    if !stderr.is_empty() {
        println!("[CALIBRATOR] stderr: {}", stderr);
    }
    
    // Read result from output file
    if output.status.success() && output_file.exists() {
        let content = std::fs::read_to_string(&output_file)
            .map_err(|e| format!("Cannot read calibration result: {}", e))?;
        
        let workflow: WorkflowDefinition = serde_json::from_str(&content)
            .map_err(|e| format!("Cannot parse calibration result: {}", e))?;
        
        let steps: Vec<CalibrationStep> = workflow.steps.iter().enumerate()
            .filter(|(_, s)| s.step_type == "action")
            .map(|(i, s)| CalibrationStep {
                order: i as i32,
                action: s.action.clone().unwrap_or_default(),
                description: s.name.clone().unwrap_or_default(),
                params: s.params.clone().unwrap_or_default(),
                wait_after: 1000,
                confidence: Some(0.9),
            })
            .collect();
        
        let _ = std::fs::remove_file(&output_file);
        
        let _ = window.emit("calibration-complete", serde_json::json!({
            "success": true,
            "total_steps": steps.len(),
        }));
        
        Ok(CalibrationResult {
            success: true,
            description,
            total_steps: steps.len() as i32,
            steps,
            workflow: Some(workflow),
            error: None,
        })
    } else {
        let _ = std::fs::remove_file(&output_file);
        
        let _ = window.emit("calibration-complete", serde_json::json!({
            "success": false,
            "error": stderr.clone(),
        }));
        
        Err(format!("Calibration failed: {}", if stderr.is_empty() { stdout } else { stderr }))
    }
}

// ============================================
// Python Script Execution
// ============================================

/// Run a Python script with context/inputs
/// The script can access: device, ai, context, inputs
#[command]
pub async fn run_python_script(
    window: tauri::Window,
    script: String,
    inputs: HashMap<String, serde_json::Value>,
    context: HashMap<String, serde_json::Value>,
    device_id: String,
) -> Result<PythonScriptResult, String> {
    println!("[ScripterAgent] Running Python script on device: {}", device_id);
    
    let start_time = std::time::Instant::now();
    
    // Create temporary files for script, context, and result
    let temp_dir = std::env::temp_dir();
    let script_id = Uuid::new_v4().to_string();
    let script_path = temp_dir.join(format!("scripter_script_{}.py", script_id));
    let context_path = temp_dir.join(format!("scripter_context_{}.json", script_id));
    let result_path = temp_dir.join(format!("scripter_result_{}.json", script_id));
    
    // Write user script to temp file
    std::fs::write(&script_path, &script)
        .map_err(|e| format!("Cannot write script file: {}", e))?;
    
    // Write context to temp file
    let context_json = serde_json::json!({
        "inputs": inputs,
        "context": context,
        "device_id": device_id,
    });
    std::fs::write(&context_path, serde_json::to_string_pretty(&context_json).unwrap_or_default())
        .map_err(|e| format!("Cannot write context file: {}", e))?;
    
    // Find scripter_wrapper.py
    let wrapper_path = find_scripter_wrapper()?;
    println!("[ScripterAgent] Using wrapper: {:?}", wrapper_path);
    
    // Run: python scripter_wrapper.py <script_path> <context_path> <result_path>
    let mut cmd = new_async_command("python");
    cmd.arg(&wrapper_path)
       .arg(&script_path)
       .arg(&context_path)
       .arg(&result_path)
       .env("PYTHONIOENCODING", "utf-8")
       .env("PYTHONLEGACYWINDOWSSTDIO", "0")
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());
    
    let mut child = cmd.spawn()
        .map_err(|e| format!("Cannot run Python: {}", e))?;
    
    // Stream output
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    let window_stdout = window.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            println!("[ScripterAgent] {}", line);
            let _ = window_stdout.emit("scripter-output", &line);
            lines.push(line);
        }
        lines
    });
    
    let window_stderr = window.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            eprintln!("[ScripterAgent][STDERR] {}", line);
            let _ = window_stderr.emit("scripter-output", &format!("[STDERR] {}", line));
            lines.push(line);
        }
        lines
    });
    
    // Wait for completion
    let (stdout_result, stderr_result) = tokio::join!(stdout_handle, stderr_handle);
    let stdout_lines = stdout_result.unwrap_or_default();
    let stderr_lines = stderr_result.unwrap_or_default();
    
    // Wait for process with timeout
    use tokio::time::{timeout, Duration};
    let status = timeout(
        Duration::from_secs(300), // 5 minutes timeout
        child.wait()
    )
    .await
    .map_err(|_| "Python script timeout after 5 minutes")?
    .map_err(|e| format!("Process error: {}", e))?;
    
    let duration = start_time.elapsed().as_millis() as i64;
    
    // Read result file
    let script_result: Option<serde_json::Value> = if result_path.exists() {
        let content = std::fs::read_to_string(&result_path).ok();
        content.and_then(|c| serde_json::from_str(&c).ok())
    } else {
        None
    };
    
    // Cleanup temp files
    let _ = std::fs::remove_file(&script_path);
    let _ = std::fs::remove_file(&context_path);
    let _ = std::fs::remove_file(&result_path);
    
    // Parse result from wrapper
    let (success, result, error) = if let Some(ref res) = script_result {
        let success = res.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
        let result = res.get("result").cloned();
        let error = res.get("error").and_then(|v| v.as_str()).map(String::from);
        (success, result, error)
    } else {
        (status.success(), None, if !status.success() { Some(stderr_lines.join("\n")) } else { None })
    };
    
    let output = stdout_lines.join("\n");
    
    println!("[ScripterAgent] Script completed in {}ms, success={}", duration, success);
    
    Ok(PythonScriptResult {
        success,
        result,
        output,
        error,
    })
}

/// Find scripter_wrapper.py in various locations
fn find_scripter_wrapper() -> Result<std::path::PathBuf, String> {
    let possible_paths = vec![
        // Development paths
        std::path::PathBuf::from("src-tauri/scripter_wrapper.py"),
        std::path::PathBuf::from("scripter_wrapper.py"),
        // Production paths (next to executable)
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|dir| dir.join("scripter_wrapper.py")))
            .unwrap_or_default(),
        // Resource directory
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|dir| dir.join("../Resources/scripter_wrapper.py")))
            .unwrap_or_default(),
    ];
    
    for path in possible_paths {
        if path.exists() {
            return Ok(path);
        }
    }
    
    Err("scripter_wrapper.py not found. Please ensure it exists in src-tauri/ directory.".to_string())
}

// ============================================
// ScripterAgent - AI Python Code Generation
// ============================================

/// Generate Python code from natural language prompt using LLM (ScripterAgent)
async fn generate_python_from_prompt(
    prompt: &str,
    context: &WorkflowContext,
) -> Result<String, String> {
    // Build context info for LLM
    let context_info = serde_json::json!({
        "inputs": context.inputs,
        "variables": context.variables,
        "device_id": context.device_id,
    });
    
    // ScripterAgent system prompt - matches the Python wrapper capabilities
    let system_prompt = r#"Bạn là ScripterAgent, một chuyên gia lập trình Python phụ trách xử lý logic "off-device" cho hệ thống tự động hóa DroidRun.

NHIỆM VỤ CỦA BẠN:
Viết mã Python để thực hiện các tác vụ như gọi API, xử lý tệp tin (JSON/CSV), hoặc biến đổi dữ liệu phức tạp dựa trên yêu cầu của người dùng.

MÔI TRƯỜNG THỰC THI:
- Mã của bạn sẽ được chạy trong một wrapper script có sẵn các biến: `inputs` (dữ liệu đầu vào), `context` (biến môi trường), và `device_id`.
- Bạn có quyền truy cập các hàm helper:
    - `get_input(name, default=None)`: Lấy giá trị từ đầu vào workflow.
    - `get_context(name, default=None)`: Lấy giá trị biến tạm từ các bước trước.
    - `set_result(key, value)`: QUAN TRỌNG - Dùng hàm này để lưu kết quả trả về cho các bước sau của workflow.
    - `log(message, level="info")`: Ghi log với timestamp (level: info/warning/error).
    - `http_get(url, headers=None, timeout=30)`: Gọi HTTP GET với error handling.
    - `http_post(url, data=None, json_data=None, headers=None, timeout=30)`: Gọi HTTP POST.
    - `read_json_file(filepath)`: Đọc file JSON.
    - `write_json_file(filepath, data)`: Ghi file JSON.
    - `read_csv_file(filepath, has_header=True)`: Đọc file CSV.
    - `write_csv_file(filepath, data, headers=None)`: Ghi file CSV.
    - `parse_number(text, default=0.0)`: Parse số từ text (xử lý format tiền tệ).
    - `format_number(num, decimals=2, thousands_sep=",")`: Format số với dấu phân cách.
    - `random_delay(min_ms=100, max_ms=500)`: Tạo delay ngẫu nhiên.
    - `timestamp_now()`: Lấy timestamp hiện tại.

CÁC THƯ VIỆN ĐƯỢC PHÉP:
- `requests` (gọi API), `json`, `csv`, `pathlib`, `re` (regex), `datetime`, `math`, `random`, `base64`.

HẠN CHẾ (AN TOÀN):
- KHÔNG sử dụng `os`, `sys`, hoặc `subprocess`.
- KHÔNG thực hiện các hành động tương tác thiết bị (chạm, vuốt) vì bạn là Agent chạy trên máy tính (off-device).

ĐỊNH DẠNG PHẢN HỒI:
- Chỉ trả về mã Python nguyên bản, không nằm trong khối markdown.
- Luôn kết thúc bằng việc gọi `set_result` để lưu lại dữ liệu cần thiết.
- Xử lý lỗi bằng try/except.
- In thông tin quan trọng bằng log() hoặc print().

VÍ DỤ YÊU CẦU: "Lấy giá vàng từ API và tính số lượng mua được với ngân sách 10tr"
VÍ DỤ MÃ BẠN VIẾT:
budget = get_input('budget', 10000000)
try:
    result = http_get('https://api.example.com/gold-price')
    if result['success']:
        price = result['data']['price']
        amount = budget / price
        log(f"Giá vàng: {format_number(price)} VND/chỉ")
        set_result('gold_amount', amount)
        set_result('current_price', price)
    else:
        log(f"Lỗi API: {result.get('error')}", "error")
        set_result('error', result.get('error'))
except Exception as e:
    log(f"Lỗi: {e}", "error")
    set_result('error', str(e))"#;

    let user_prompt = format!(
        "Context: {}\n\nTask: {}\n\nGenerate Python code:",
        serde_json::to_string_pretty(&context_info).unwrap_or_default(),
        prompt
    );
    
    // Get AI profile from config
    let profile = crate::config::get_active_profile()
        .await
        .map_err(|e| format!("No AI profile configured: {}", e))?
        .ok_or("No active AI profile set")?;
    
    let (base_url, api_key) = crate::config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    // Call LLM API
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": profile.provider.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 2000
        }))
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM API error: {}", error_text));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LLM response: {}", e))?;
    
    let code = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No code in LLM response")?
        .to_string();
    
    // Clean up code (remove markdown code blocks if present)
    let code = code
        .trim()
        .trim_start_matches("```python")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();
    
    println!("[ScripterAgent] Generated {} bytes of Python code", code.len());
    
    Ok(code)
}

/// Analyze workflow/task error using ScripterAgent
pub async fn analyze_error_with_ai(
    error_message: &str,
    task_description: &str,
    logs: &[String],
) -> Result<String, String> {
    let profile = crate::config::get_active_profile()
        .await
        .map_err(|e| format!("No AI profile: {}", e))?
        .ok_or("No active AI profile set")?;
    
    let (base_url, api_key) = crate::config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    let system_prompt = r#"You are an error analysis expert for Android automation tasks.
Analyze the error and provide:
1. Root cause analysis
2. Suggested fixes
3. Parameter adjustments if applicable

Be concise and actionable."#;

    let user_prompt = format!(
        "Task: {}\n\nError: {}\n\nRecent logs:\n{}\n\nAnalyze and suggest fixes:",
        task_description,
        error_message,
        logs.join("\n")
    );
    
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": profile.provider.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 1000
        }))
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let analysis = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Unable to analyze error")
        .to_string();
    
    Ok(analysis)
}

// ============================================
// Workflow Execution
// ============================================

/// Run a complete workflow
#[command]
pub async fn run_workflow(
    window: tauri::Window,
    workflow: WorkflowDefinition,
    inputs: HashMap<String, serde_json::Value>,
    device_id: String,
) -> Result<WorkflowResult, String> {
    println!("[WORKFLOW] Starting workflow: {} on device: {}", workflow.name, device_id);
    let start_time = std::time::Instant::now();
    
    let mut context = WorkflowContext {
        inputs: inputs.clone(),
        variables: HashMap::new(),
        device_id: device_id.clone(),
        current_step_id: None,
        logs: vec![],
        history: vec![],
        plan: workflow.description.clone(),
        last_error: None,
    };
    
    // Add log helper
    fn add_log(context: &mut WorkflowContext, level: &str, step_id: Option<&str>, message: &str) {
        context.logs.push(WorkflowLog {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.to_string(),
            step_id: step_id.map(|s| s.to_string()),
            message: message.to_string(),
        });
    }
    
    add_log(&mut context, "info", None, &format!("🚀 Starting workflow: {}", workflow.name));
    
    // Emit start event
    let _ = window.emit("workflow-start", serde_json::json!({
        "workflow_id": workflow.id,
        "workflow_name": workflow.name,
        "device_id": device_id,
    }));
    
    // Execute steps
    let mut error: Option<String> = None;
    for step in &workflow.steps {
        context.current_step_id = Some(step.id.clone());
        
        add_log(&mut context, "info", Some(&step.id), 
            &format!("▶️ Step: {}", step.name.as_deref().unwrap_or(&step.step_type)));
        
        // Emit step start event
        let _ = window.emit("workflow-step", serde_json::json!({
            "step_id": step.id,
            "step_type": step.step_type,
            "step_name": step.name,
            "status": "running",
        }));
        
        match execute_step(&window, step, &mut context).await {
            Ok(()) => {
                add_log(&mut context, "success", Some(&step.id), "✓ Step completed");
                let _ = window.emit("workflow-step", serde_json::json!({
                    "step_id": step.id,
                    "status": "completed",
                }));
                
                // ✅ CRITICAL: Add delay after action steps to ensure device responsiveness
                if step.step_type == "action" {
                    // Priority: step.delay_after > workflow.step_delay > default 800ms
                    let global_delay = workflow.step_delay.unwrap_or(800);
                    let base_delay = step.delay_after.unwrap_or(global_delay);
                    
                    // Add ±15% variance for more human-like timing
                    use rand::Rng;
                    let variance = (base_delay as f64 * 0.15) as u64;
                    let min_delay = base_delay.saturating_sub(variance);
                    let max_delay = base_delay + variance;
                    let actual_delay = rand::thread_rng().gen_range(min_delay..=max_delay);
                    
                    println!("[WORKFLOW] Delay {}ms (base: {}ms ±15%)", actual_delay, base_delay);
                    tokio::time::sleep(tokio::time::Duration::from_millis(actual_delay)).await;
                }
            }
            Err(e) => {
                add_log(&mut context, "error", Some(&step.id), &format!("✗ Error: {}", e));
                let _ = window.emit("workflow-step", serde_json::json!({
                    "step_id": step.id,
                    "status": "failed",
                    "error": e.clone(),
                }));
                
                // Handle error based on strategy
                let should_abort = match &step.on_error {
                    Some(config) => match config.strategy.as_str() {
                        "skip" => {
                            add_log(&mut context, "warning", Some(&step.id), "Skipping failed step");
                            false
                        }
                        "retry" => {
                            let retries = config.retries.unwrap_or(3);
                            let mut retry_success = false;
                            for retry in 1..=retries {
                                add_log(&mut context, "info", Some(&step.id), 
                                    &format!("Retry {}/{}", retry, retries));
                                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                                if execute_step(&window, step, &mut context).await.is_ok() {
                                    retry_success = true;
                                    break;
                                }
                            }
                            !retry_success
                        }
                        "fallback" => {
                            if let Some(fallback_steps) = &config.fallback {
                                add_log(&mut context, "info", Some(&step.id), "Running fallback steps");
                                for fb_step in fallback_steps {
                                    if let Err(fb_err) = execute_step(&window, fb_step, &mut context).await {
                                        add_log(&mut context, "error", Some(&fb_step.id), 
                                            &format!("Fallback failed: {}", fb_err));
                                    }
                                }
                            }
                            false
                        }
                        _ => true, // "abort" or unknown
                    }
                    None => true, // Default: abort on error
                };
                
                if should_abort {
                    error = Some(e);
                    break;
                }
            }
        }
    }
    
    let duration_ms = start_time.elapsed().as_millis() as i64;
    let success = error.is_none();
    
    // Build outputs from context
    let mut outputs = HashMap::new();
    for output_name in &workflow.outputs {
        if let Some(value) = context.variables.get(output_name) {
            outputs.insert(output_name.clone(), value.clone());
        }
    }
    
    if success {
        add_log(&mut context, "success", None, &format!("✅ Workflow completed in {}ms", duration_ms));
    } else {
        add_log(&mut context, "error", None, &format!("❌ Workflow failed: {:?}", error));
    }
    
    // Emit complete event
    let _ = window.emit("workflow-complete", serde_json::json!({
        "workflow_id": workflow.id,
        "success": success,
        "duration_ms": duration_ms,
        "error": error,
    }));
    
    Ok(WorkflowResult {
        success,
        workflow_id: workflow.id,
        outputs,
        logs: context.logs,
        duration_ms,
        error,
    })
}

/// Execute a single workflow step (uses BoxFuture for recursion)
fn execute_step<'a>(
    window: &'a tauri::Window,
    step: &'a WorkflowStep,
    context: &'a mut WorkflowContext,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        match step.step_type.as_str() {
            "action" => execute_action_step(window, step, context).await,
            "condition" => execute_condition_step(window, step, context).await,
            "loop" => execute_loop_step(window, step, context).await,
            "while" => execute_while_step(window, step, context).await,
            "parallel" => execute_parallel_step(window, step, context).await,
            "python" => execute_python_step(window, step, context).await,
            "scripter" => execute_scripter_step(window, step, context).await,
            "prompt" => execute_prompt_step(window, step, context).await,
            "wait" => execute_wait_step(step, context).await,
            "extract" => execute_extract_step(step, context).await,
            "skill" => execute_skill_step(window, step, context).await,
            _ => Err(format!("Unknown step type: {}", step.step_type)),
        }
    })
}

/// Compile template value - replace {{variable}} with actual values
fn compile_value(template: &str, context: &WorkflowContext) -> String {
    let mut result = template.to_string();
    
    // Replace {{input_name}} with input values
    for (key, value) in &context.inputs {
        let placeholder = format!("{{{{{}}}}}", key);
        let value_str = match value {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            _ => value.to_string(),
        };
        result = result.replace(&placeholder, &value_str);
    }
    
    // Replace {{variable_name}} and {{variable.key}} with context values
    for (key, value) in &context.variables {
        let placeholder = format!("{{{{{}}}}}", key);
        let value_str = match value {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Object(obj) => {
                // Also handle nested access like {{result.key}}
                for (sub_key, sub_value) in obj {
                    let nested_placeholder = format!("{{{{{}.{}}}}}", key, sub_key);
                    let sub_value_str = match sub_value {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::Bool(b) => b.to_string(),
                        _ => sub_value.to_string(),
                    };
                    result = result.replace(&nested_placeholder, &sub_value_str);
                }
                serde_json::to_string(value).unwrap_or_default()
            }
            _ => value.to_string(),
        };
        result = result.replace(&placeholder, &value_str);
    }
    
    result
}

// ============================================
// Step Executors
// ============================================

async fn execute_action_step(
    _window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let action = step.action.as_ref().ok_or("Action step missing 'action' field")?;
    let device_id = &context.device_id;
    
    // Get params and compile values
    let params: HashMap<String, String> = step.params.as_ref()
        .map(|p| {
            p.iter()
                .map(|(k, v)| {
                    let value_str = match v {
                        serde_json::Value::String(s) => compile_value(s, context),
                        _ => v.to_string(),
                    };
                    (k.clone(), value_str)
                })
                .collect()
        })
        .unwrap_or_default();
    
    println!("[WORKFLOW] Action: {} with params: {:?}", action, params);
    
    // Helper to run action via DroidRun API (Python executor)
    async fn run_droidrun_action(device_id: &str, action: &str, args: &[&str]) -> Result<String, String> {
        // Get the path to droidrun_executor.py
        let executor_path = if cfg!(debug_assertions) {
            std::path::PathBuf::from("src-tauri/droidrun_executor.py")
        } else {
            // In production, the script is bundled with the app
            let exe_dir = std::env::current_exe()
                .map_err(|e| format!("Cannot get exe path: {}", e))?
                .parent()
                .ok_or("Cannot get exe parent dir")?
                .to_path_buf();
            exe_dir.join("droidrun_executor.py")
        };
        
        // Build command: py droidrun_executor.py <device_id> <action> [args...]
        let mut cmd = new_async_command("py");
        cmd.arg(&executor_path)
           .arg(device_id)
           .arg(action);
        
        for arg in args {
            cmd.arg(arg);
        }
        
        println!("[WORKFLOW] Running: py {} {} {} {:?}", 
            executor_path.display(), device_id, action, args);
        
        let output = cmd.output().await
            .map_err(|e| format!("DroidRun executor error: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        
        if output.status.success() {
            // Parse JSON response
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if json.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let message = json.get("message").and_then(|v| v.as_str()).unwrap_or("OK");
                    println!("[WORKFLOW] ✓ {}", message);
                    return Ok(message.to_string());
                } else {
                    let error = json.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown error");
                    return Err(error.to_string());
                }
            }
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("DroidRun action failed: {} | {}", stdout.trim(), stderr.trim()))
        }
    }
    
    // Fallback to ADB if DroidRun fails
    async fn run_adb_fallback(device_id: &str, args: &[&str]) -> Result<String, String> {
        println!("[WORKFLOW] Fallback to ADB: {:?}", args);
        
        let mut cmd_args = vec!["-s", device_id];
        cmd_args.extend(args);
        
        let mut cmd = new_async_command("adb");
        cmd.args(&cmd_args);
        
        let output = cmd.output().await
            .map_err(|e| format!("ADB error: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if output.status.success() {
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("ADB failed: {}", stderr))
        }
    }
    
    // Try DroidRun API first, fallback to ADB if fails
    let result = match action.as_str() {
        "open_app" | "start_app" => {
            let package = params.get("package").ok_or("Missing 'package' param")?;
            let activity = params.get("activity").map(|s| s.as_str()).unwrap_or("");
            
            match run_droidrun_action(device_id, "open_app", &[package, activity]).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    println!("[WORKFLOW] DroidRun failed: {}, trying ADB fallback", e);
                    run_adb_fallback(device_id, &["shell", "monkey", "-p", package, "1"]).await?;
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    Ok(())
                }
            }
        }
        
        "tap" => {
            let x = params.get("x").ok_or("Missing 'x' param")?;
            let y = params.get("y").ok_or("Missing 'y' param")?;
            
            match run_droidrun_action(device_id, "tap", &[x, y]).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    println!("[WORKFLOW] DroidRun failed: {}, trying ADB fallback", e);
                    run_adb_fallback(device_id, &["shell", "input", "tap", x, y]).await?;
                    Ok(())
                }
            }
        }
        
        "tap_index" | "tap_by_index" => {
            let index = params.get("index").ok_or("Missing 'index' param")?;
            run_droidrun_action(device_id, "tap_index", &[index]).await?;
            Ok(())
        }
        
        "tap_element" | "tap_text" => {
            // Find element by text and tap - only available via DroidRun
            let text = params.get("text").ok_or("Missing 'text' param")?;
            run_droidrun_action(device_id, "tap_text", &[text]).await?;
            Ok(())
        }
        
        "swipe" => {
            // Support both x1/y1/x2/y2 and start_x/start_y/end_x/end_y formats
            let x1 = params.get("x1")
                .or_else(|| params.get("start_x"))
                .ok_or("Missing 'x1' or 'start_x' param")?;
            let y1 = params.get("y1")
                .or_else(|| params.get("start_y"))
                .ok_or("Missing 'y1' or 'start_y' param")?;
            let x2 = params.get("x2")
                .or_else(|| params.get("end_x"))
                .ok_or("Missing 'x2' or 'end_x' param")?;
            let y2 = params.get("y2")
                .or_else(|| params.get("end_y"))
                .ok_or("Missing 'y2' or 'end_y' param")?;
            let duration = params.get("duration").map(|s| s.as_str()).unwrap_or("300");
            
            match run_droidrun_action(device_id, "swipe", &[x1, y1, x2, y2, duration]).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    println!("[WORKFLOW] DroidRun failed: {}, trying ADB fallback", e);
                    run_adb_fallback(device_id, &["shell", "input", "swipe", x1, y1, x2, y2, duration]).await?;
                    Ok(())
                }
            }
        }
        
        "swipe_up" => {
            match run_droidrun_action(device_id, "swipe_up", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "swipe", "500", "1500", "500", "500", "300"]).await?;
                    Ok(())
                }
            }
        }
        
        "swipe_down" => {
            match run_droidrun_action(device_id, "swipe_down", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "swipe", "500", "500", "500", "1500", "300"]).await?;
                    Ok(())
                }
            }
        }
        
        "swipe_left" => {
            match run_droidrun_action(device_id, "swipe_left", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "swipe", "800", "500", "100", "500", "300"]).await?;
                    Ok(())
                }
            }
        }
        
        "swipe_right" => {
            match run_droidrun_action(device_id, "swipe_right", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "swipe", "100", "500", "800", "500", "300"]).await?;
                    Ok(())
                }
            }
        }
        
        "type" | "input_text" => {
            let text = params.get("text").ok_or("Missing 'text' param")?;
            let clear = params.get("clear").map(|s| s.as_str()).unwrap_or("false");
            
            match run_droidrun_action(device_id, "input_text", &[text, clear]).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    println!("[WORKFLOW] DroidRun failed: {}, trying ADB fallback", e);
                    let escaped = text.replace(" ", "%s").replace("'", "\\'");
                    run_adb_fallback(device_id, &["shell", "input", "text", &escaped]).await?;
                    Ok(())
                }
            }
        }
        
        "back" => {
            match run_droidrun_action(device_id, "back", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_BACK"]).await?;
                    Ok(())
                }
            }
        }
        
        "home" => {
            match run_droidrun_action(device_id, "home", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_HOME"]).await?;
                    Ok(())
                }
            }
        }
        
        "enter" => {
            match run_droidrun_action(device_id, "enter", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_ENTER"]).await?;
                    Ok(())
                }
            }
        }
        
        "press_key" => {
            let keycode = params.get("keycode").ok_or("Missing 'keycode' param")?;
            match run_droidrun_action(device_id, "press_key", &[keycode]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "keyevent", keycode]).await?;
                    Ok(())
                }
            }
        }
        
        "recent_apps" => {
            run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_APP_SWITCH"]).await?;
            Ok(())
        }
        
        "screenshot" => {
            let output_path = params.get("path").map(|s| s.as_str()).unwrap_or("screenshot.png");
            match run_droidrun_action(device_id, "screenshot", &[output_path]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    // Fallback: save on device then pull
                    run_adb_fallback(device_id, &["shell", "screencap", "-p", "/sdcard/temp_screenshot.png"]).await?;
                    run_adb_fallback(device_id, &["pull", "/sdcard/temp_screenshot.png", output_path]).await?;
                    Ok(())
                }
            }
        }
        
        "wake" => {
            run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_WAKEUP"]).await?;
            Ok(())
        }
        
        "dismiss_popup" => {
            // Try back button to dismiss popups
            match run_droidrun_action(device_id, "back", &[]).await {
                Ok(_) => Ok(()),
                Err(_) => {
                    run_adb_fallback(device_id, &["shell", "input", "keyevent", "KEYCODE_BACK"]).await?;
                    Ok(())
                }
            }
        }
        
        "get_state" => {
            // Get UI state - only available via DroidRun
            run_droidrun_action(device_id, "get_state", &[]).await?;
            Ok(())
        }
        
        "long_press" => {
            let x = params.get("x").ok_or("Missing 'x' param")?;
            let y = params.get("y").ok_or("Missing 'y' param")?;
            let duration = params.get("duration").map(|s| s.as_str()).unwrap_or("2000");
            run_droidrun_action(device_id, "long_press", &[x, y, duration]).await?;
            Ok(())
        }
        
        "double_tap" => {
            let x = params.get("x").ok_or("Missing 'x' param")?;
            let y = params.get("y").ok_or("Missing 'y' param")?;
            run_droidrun_action(device_id, "double_tap", &[x, y]).await?;
            Ok(())
        }
        
        _ => {
            Err(format!("Unknown action: {}", action))
        }
    };
    
    result
}

async fn execute_condition_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let condition = step.condition.as_ref().ok_or("Condition step missing 'condition' field")?;
    let compiled = compile_value(condition, context);
    
    // Evaluate condition
    let result = match compiled.to_lowercase().as_str() {
        "true" | "1" | "yes" => true,
        "false" | "0" | "no" | "" => false,
        _ => !compiled.is_empty(),
    };
    
    println!("[WORKFLOW] Condition '{}' = {} -> {}", condition, compiled, result);
    
    let branch = if result { &step.then } else { &step.else_branch };
    if let Some(steps) = branch {
        for sub_step in steps {
            execute_step(window, sub_step, context).await?;
        }
    }
    
    Ok(())
}

async fn execute_loop_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let count_str = step.count.as_ref().ok_or("Loop step missing 'count' field")?;
    let compiled = compile_value(count_str, context);
    let count: i32 = compiled.parse().map_err(|_| format!("Invalid loop count: {}", compiled))?;
    let var_name = step.variable.as_deref().unwrap_or("i");
    
    println!("[WORKFLOW] Loop {} iterations, variable: {}", count, var_name);
    
    let body = step.body.as_ref().ok_or("Loop step missing 'body' field")?;
    
    for i in 0..count {
        context.variables.insert(var_name.to_string(), serde_json::json!(i));
        println!("[WORKFLOW] Loop iteration {}/{}", i + 1, count);
        
        for sub_step in body {
            execute_step(window, sub_step, context).await?;
        }
    }
    
    Ok(())
}

async fn execute_while_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let condition = step.condition.as_ref().ok_or("While step missing 'condition' field")?;
    let max_iterations = step.max_iterations.unwrap_or(100);
    let body = step.body.as_ref().ok_or("While step missing 'body' field")?;
    
    let mut iteration = 0;
    loop {
        if iteration >= max_iterations {
            println!("[WORKFLOW] While loop reached max iterations: {}", max_iterations);
            break;
        }
        
        let compiled = compile_value(condition, context);
        let should_continue = match compiled.to_lowercase().as_str() {
            "true" | "1" | "yes" => true,
            _ => false,
        };
        
        if !should_continue {
            break;
        }
        
        println!("[WORKFLOW] While iteration {}", iteration + 1);
        for sub_step in body {
            execute_step(window, sub_step, context).await?;
        }
        
        iteration += 1;
    }
    
    Ok(())
}

async fn execute_parallel_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let branches = step.branches.as_ref().ok_or("Parallel step missing 'branches' field")?;
    
    println!("[WORKFLOW] Parallel execution with {} branches", branches.len());
    
    // For now, run branches sequentially (true parallel would need thread-safe context)
    // TODO: Implement proper parallel execution with Arc<Mutex<Context>>
    for (i, branch) in branches.iter().enumerate() {
        println!("[WORKFLOW] Parallel branch {}", i + 1);
        for sub_step in branch {
            execute_step(window, sub_step, context).await?;
        }
    }
    
    Ok(())
}

async fn execute_python_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    // Check if this is an AI-generated script step (ScripterAgent)
    let script = if let Some(ai_prompt) = &step.ai_prompt {
        // Use LLM to generate Python code from natural language prompt
        let compiled_prompt = compile_value(ai_prompt, context);
        println!("[ScripterAgent] Generating code for: {}", &compiled_prompt[..compiled_prompt.len().min(100)]);
        
        let _ = window.emit("workflow-step", serde_json::json!({
            "step_id": step.id,
            "status": "generating",
            "message": "ScripterAgent generating Python code..."
        }));
        
        generate_python_from_prompt(&compiled_prompt, context).await?
    } else if let Some(script) = &step.script {
        // Use provided script directly
        script.clone()
    } else {
        return Err("Python step requires either 'script' or 'aiPrompt' field".to_string());
    };
    
    println!("[WORKFLOW] Executing Python script...");
    
    let result = run_python_script(
        window.clone(),
        script,
        context.inputs.clone(),
        context.variables.clone(),
        context.device_id.clone(),
    ).await?;
    
    if !result.success {
        return Err(result.error.unwrap_or_else(|| "Python script failed".to_string()));
    }
    
    // Save result to context variable if specified
    if let Some(save_to) = &step.save_to {
        if let Some(result_value) = result.result {
            context.variables.insert(save_to.clone(), result_value);
        }
    }
    
    Ok(())
}

/// Execute ScripterAgent step - AI generates and runs Python code with Shared State
async fn execute_scripter_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let prompt = step.prompt.as_ref()
        .or(step.ai_prompt.as_ref())
        .ok_or("Scripter step requires 'prompt' or 'aiPrompt' field")?;
    
    let compiled_prompt = compile_value(prompt, context);
    let step_start = std::time::Instant::now();
    
    println!("[ScripterAgent] Task: {}", &compiled_prompt[..compiled_prompt.len().min(100)]);
    
    let _ = window.emit("workflow-step", serde_json::json!({
        "step_id": step.id,
        "status": "scripter-thinking",
        "message": "ScripterAgent analyzing task..."
    }));
    
    // Build enhanced context with Shared State for ScripterAgent
    let shared_state = serde_json::json!({
        "inputs": context.inputs,
        "variables": context.variables,
        "device_id": context.device_id,
        "history": context.history,
        "plan": context.plan,
        "last_error": context.last_error,
    });
    
    // Get AI profile
    let profile = crate::config::get_active_profile()
        .await
        .map_err(|e| format!("No AI profile: {}", e))?
        .ok_or("No active AI profile set")?;
    
    let (base_url, api_key) = crate::config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    // Enhanced system prompt with Shared State awareness
    let system_prompt = r#"You are ScripterAgent, an expert Python code generator for workflow automation.

## SHARED STATE (Context from previous steps):
You have access to the workflow's Shared State containing:
- `inputs`: User-provided input parameters
- `context`: Variables from previous steps (use these!)
- `device_id`: Android device ID for ADB commands
- `history`: List of previously executed actions
- `plan`: Current workflow goal
- `last_error`: Information about any previous errors

## AVAILABLE MODULES:
- requests: HTTP requests (REST API, webhooks)
- json, csv: Data parsing
- re: Regex operations
- datetime: Date/time
- base64: Encoding
- pathlib: File operations

## OUTPUT REQUIREMENTS:
1. Return ONLY valid Python code
2. Use `result = {...}` to set output value
3. Handle errors with try/except
4. Print important info with print()
5. Access previous step results via `context` dict

EXAMPLE:
```
import requests

# Access context from previous steps
previous_data = context.get('extracted_text', '')

try:
    response = requests.post("https://api.example.com/process", 
        json={"data": previous_data})
    result = {"status": "success", "response": response.json()}
except Exception as e:
    result = {"status": "error", "message": str(e)}
```"#;

    let user_prompt = format!(
        "SHARED STATE:\n{}\n\nTASK: {}\n\nGenerate Python code:",
        serde_json::to_string_pretty(&shared_state).unwrap_or_default(),
        compiled_prompt
    );
    
    // Call LLM
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": profile.provider.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 3000
        }))
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM API error: {}", error_text));
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let code = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No code in response")?
        .trim()
        .trim_start_matches("```python")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();
    
    println!("[ScripterAgent] Generated {} bytes of code", code.len());
    
    let _ = window.emit("workflow-step", serde_json::json!({
        "step_id": step.id,
        "status": "scripter-executing",
        "message": "Executing generated code..."
    }));
    
    // Execute the generated code
    let script_result = run_python_script(
        window.clone(),
        code,
        context.inputs.clone(),
        context.variables.clone(),
        context.device_id.clone(),
    ).await?;
    
    let duration = step_start.elapsed().as_millis() as i64;
    
    // Record action in history for future steps
    context.history.push(ActionRecord {
        step_id: step.id.clone(),
        step_type: "scripter".to_string(),
        action: Some(compiled_prompt.chars().take(100).collect()),
        result: script_result.result.clone(),
        success: script_result.success,
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_ms: duration,
    });
    
    if !script_result.success {
        // Store error context for self-healing
        context.last_error = Some(ErrorContext {
            step_id: step.id.clone(),
            error_message: script_result.error.clone().unwrap_or_default(),
            retry_count: 0,
            suggested_fix: None,
        });
        return Err(script_result.error.unwrap_or_else(|| "ScripterAgent execution failed".to_string()));
    }
    
    // Save result to context variable
    if let Some(save_to) = &step.save_to {
        if let Some(result_value) = script_result.result {
            context.variables.insert(save_to.clone(), result_value);
        }
    }
    
    // Clear last error on success
    context.last_error = None;
    
    Ok(())
}

async fn execute_prompt_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let prompt = step.prompt.as_ref().ok_or("Prompt step missing 'prompt' field")?;
    let compiled_prompt = compile_value(prompt, context);
    
    println!("[WORKFLOW] Running AI prompt: {}", &compiled_prompt[..compiled_prompt.len().min(100)]);
    
    // Emit event for frontend to handle (requires active profile)
    let _ = window.emit("workflow-prompt-request", serde_json::json!({
        "step_id": step.id,
        "prompt": compiled_prompt,
        "device_id": context.device_id,
        "save_to": step.save_to,
    }));
    
    // Note: Actual prompt execution would be handled by frontend using active profile
    // This is a placeholder - in real implementation, would call run_task
    
    Ok(())
}

async fn execute_wait_step(
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    if let Some(duration_str) = &step.duration {
        let compiled = compile_value(duration_str, context);
        let duration_ms: u64 = compiled.parse().unwrap_or(1000);
        
        println!("[WORKFLOW] Waiting {}ms", duration_ms);
        tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
    } else if let Some(condition) = &step.wait_condition {
        // Wait for condition - poll until condition is true
        let max_wait = 30000; // 30 seconds max
        let start = std::time::Instant::now();
        
        loop {
            let compiled = compile_value(condition, context);
            if compiled.to_lowercase() == "true" {
                break;
            }
            if start.elapsed().as_millis() > max_wait {
                return Err(format!("Wait condition timeout: {}", condition));
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }
    } else {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
    
    Ok(())
}

async fn execute_extract_step(
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let selector = step.selector.as_ref().ok_or("Extract step missing 'selector' field")?;
    let save_to = step.save_to.as_ref().ok_or("Extract step missing 'save_to' field")?;
    
    println!("[WORKFLOW] Extract '{}' -> {}", selector, save_to);
    
    // TODO: Implement actual extraction using screen analysis
    // For now, just create a placeholder
    context.variables.insert(save_to.clone(), serde_json::json!(null));
    
    Ok(())
}

async fn execute_skill_step(
    window: &tauri::Window,
    step: &WorkflowStep,
    context: &mut WorkflowContext,
) -> Result<(), String> {
    let skill_id = step.skill_id.as_ref().ok_or("Skill step missing 'skill_id' field")?;
    
    println!("[WORKFLOW] Running skill: {}", skill_id);
    
    // Emit event for frontend to handle skill execution
    let _ = window.emit("workflow-skill-request", serde_json::json!({
        "step_id": step.id,
        "skill_id": skill_id,
        "device_id": context.device_id,
        "inputs": context.inputs,
    }));
    
    // Note: Actual skill execution would be handled by frontend
    
    Ok(())
}

// ============================================
// Python Workflow Executor
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonWorkflowResult {
    pub success: bool,
    pub steps_executed: i32,
    pub total_steps: i32,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

/// Execute workflow using Python backend for reliable timing
#[command]
pub async fn run_workflow_python(
    workflow: serde_json::Value,
    device_id: String,
    app_handle: tauri::AppHandle,
) -> Result<PythonWorkflowResult, String> {
    use std::io::Write;
    
    log::info!("[run_workflow_python] Starting workflow execution via Python");
    
    // Get executor path (relative to app directory)
    let exe_dir = app_handle.path()
        .resource_dir()
        .map_err(|e| format!("Cannot get resource dir: {}", e))?;
    
    // Try multiple possible locations for the executor
    let possible_paths = vec![
        exe_dir.join("droidrun_executor.py"),
        exe_dir.join("../droidrun_executor.py"),
        std::path::PathBuf::from("src-tauri/droidrun_executor.py"),
        std::path::PathBuf::from("droidrun_executor.py"),
    ];
    
    let executor_path = possible_paths
        .iter()
        .find(|p: &&std::path::PathBuf| p.exists())
        .cloned()
        .ok_or_else(|| "droidrun_executor.py not found".to_string())?;
    
    log::info!("[run_workflow_python] Using executor: {:?}", executor_path);
    
    // Write workflow to temp file
    let temp_dir = std::env::temp_dir();
    let workflow_file = temp_dir.join(format!("workflow_{}.json", Uuid::new_v4()));
    
    {
        let mut file = std::fs::File::create(&workflow_file)
            .map_err(|e| format!("Cannot create temp file: {}", e))?;
        let json_str = serde_json::to_string_pretty(&workflow)
            .map_err(|e| format!("Cannot serialize workflow: {}", e))?;
        file.write_all(json_str.as_bytes())
            .map_err(|e| format!("Cannot write workflow: {}", e))?;
    }
    
    log::info!("[run_workflow_python] Workflow saved to: {:?}", workflow_file);
    
    // Run Python executor
    let mut cmd = new_async_command("python");
    cmd.arg(&executor_path)
        .arg("--workflow")
        .arg(&workflow_file)
        .arg(&device_id)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let mut child = cmd.spawn()
        .map_err(|e| format!("Cannot spawn Python: {}", e))?;
    
    // Stream stderr for progress updates
    if let Some(stderr) = child.stderr.take() {
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::info!("[Python] {}", line);
                let _ = app_handle_clone.emit("workflow-progress", &line);
            }
        });
    }
    
    // Wait for completion and get stdout
    let output = child.wait_with_output().await
        .map_err(|e| format!("Python execution failed: {}", e))?;
    
    // Clean up temp file
    let _ = std::fs::remove_file(&workflow_file);
    
    // Parse result
    let stdout = String::from_utf8_lossy(&output.stdout);
    log::info!("[run_workflow_python] Output: {}", stdout);
    
    if output.status.success() {
        let result: PythonWorkflowResult = serde_json::from_str(&stdout)
            .map_err(|e| format!("Cannot parse Python output: {} - {}", e, stdout))?;
        Ok(result)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Python failed: {}", stderr))
    }
}

// ============================================
// Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_value() {
        let mut context = WorkflowContext {
            inputs: HashMap::from([
                ("count".to_string(), serde_json::json!(5)),
                ("name".to_string(), serde_json::json!("test")),
            ]),
            variables: HashMap::from([
                ("result".to_string(), serde_json::json!({"value": 42})),
            ]),
            device_id: "test".to_string(),
            current_step_id: None,
            logs: vec![],
        };

        assert_eq!(compile_value("{{count}}", &context), "5");
        assert_eq!(compile_value("Hello {{name}}!", &context), "Hello test!");
        assert_eq!(compile_value("{{result.value}}", &context), "42");
    }
}