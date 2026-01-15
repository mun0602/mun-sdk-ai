// Task Module - Quản lý task scheduler và execution
// Ported from Flet Python logic (droidrun_app_flet.py)

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::{command, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use uuid::Uuid;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Global map to track running task processes by task_id
lazy_static::lazy_static! {
    static ref RUNNING_TASKS: Mutex<HashMap<String, u32>> = Mutex::new(HashMap::new());
}

/// Helper to create a tokio command with hidden window on Windows
fn new_async_command(program: &str) -> tokio::process::Command {
    let mut std_cmd = std::process::Command::new(program);
    #[cfg(windows)]
    std_cmd.creation_flags(CREATE_NO_WINDOW);
    tokio::process::Command::from(std_cmd)
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub device_id: String,
    pub profile_id: String,
    pub prompt: String,
    pub status: TaskStatus,
    pub progress: i32,
    pub current_step: i32,
    pub max_steps: i32,
    pub logs: Vec<TaskLog>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
    // Emulator config for scheduled tasks
    pub emulator_index: Option<String>,
    // Provider config for scheduled tasks
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    // Macro config for scheduled tasks
    pub macro_id: Option<String>,
    pub task_source: Option<String>, // "template" | "macro" | "custom"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskLog {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    pub id: String,
    pub task: Task,
    pub schedule_time: String,
    pub repeat: Option<RepeatConfig>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepeatConfig {
    pub interval_minutes: i32,
    pub max_runs: Option<i32>,
    pub current_runs: i32,
    pub repeat_type: Option<String>, // "daily" | "weekly"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskResult {
    pub task_id: String,
    pub device_id: String,
    pub success: bool,
    pub output: String,
    pub screenshots: Vec<String>,
    pub duration_ms: i64,
}

/// Parameters for running a task on a device (Flet logic)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskParams {
    pub device_id: String,
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub prompt: String,
    pub base_url: Option<String>,
    pub vision: Option<bool>,
    pub reasoning: Option<bool>,
    // Tracing config
    pub tracing: Option<TracingParams>,
}

/// Tracing parameters passed from frontend
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TracingParams {
    pub enabled: bool,
    pub provider: String,
    pub phoenix_url: Option<String>,
    pub phoenix_project_name: Option<String>,
    pub langfuse_secret_key: Option<String>,
    pub langfuse_public_key: Option<String>,
    pub langfuse_host: Option<String>,
    pub langfuse_user_id: Option<String>,
    pub save_trajectory: String,
}

/// Tạo task mới
#[command]
pub async fn create_task(
    name: String,
    device_id: String,
    profile_id: String,
    prompt: String,
    max_steps: i32,
    emulator_index: Option<String>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    macro_id: Option<String>,
    task_source: Option<String>,
) -> Result<Task, String> {
    let task = Task {
        id: Uuid::new_v4().to_string(),
        name,
        device_id,
        profile_id,
        prompt,
        status: TaskStatus::Pending,
        progress: 0,
        current_step: 0,
        max_steps,
        logs: vec![],
        created_at: Utc::now().to_rfc3339(),
        started_at: None,
        completed_at: None,
        error: None,
        emulator_index,
        provider,
        api_key,
        model,
        base_url,
        macro_id,
        task_source,
    };

    Ok(task)
}

/// Internal function to run task on a single device
/// Used by both run_task and run_parallel_tasks
async fn run_task_internal(
    window: &tauri::Window,
    device_id: String,
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    base_url: Option<String>,
    vision: Option<bool>,
    reasoning: Option<bool>,
    tracing: Option<TracingParams>,
) -> Result<TaskResult, String> {
    let start_time = std::time::Instant::now();

    // ============ BACKEND AI REQUEST LIMIT CHECK ============
    // This is the security layer - cannot be bypassed from frontend
    match crate::license::check_and_use_ai_request("task").await {
        Ok(remaining) => {
            log::info!("[AI Limit] Request approved. Remaining: {}", remaining);
            let _ = window.emit("task-output", serde_json::json!({
                "device_id": device_id,
                "line": format!("[AI] ✓ Remaining requests: {}", remaining),
                "stream": "ai_limit"
            }));
        }
        Err(e) => {
            log::error!("[AI Limit] Request denied: {}", e);
            let _ = window.emit("task-output", serde_json::json!({
                "device_id": device_id,
                "line": format!("[AI] ✗ {}", e),
                "stream": "ai_limit"
            }));
            return Err(format!("AI request limit: {}", e));
        }
    }
    // ========================================================

    // Get the path to run_droidrun.py helper script
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

    // Z.AI and mun-ai use OpenAILike internally (Flet logic)
    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike".to_string(),
        _ => provider.clone(),
    };

    // Get actual credentials for mun-ai (inject hidden creds)
    let (final_base_url, final_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);
    
    let base_url_str = final_base_url.trim().to_string();
    let vision_str = if vision.unwrap_or(true) { "true" } else { "false" };
    let reasoning_str = if reasoning.unwrap_or(false) { "true" } else { "false" };

    // Build tracing JSON config
    let tracing_json = if let Some(ref t) = tracing {
        serde_json::json!({
            "enabled": t.enabled,
            "provider": t.provider,
            "phoenix_url": t.phoenix_url.clone().unwrap_or_default(),
            "phoenix_project_name": t.phoenix_project_name.clone().unwrap_or_default(),
            "langfuse_secret_key": t.langfuse_secret_key.clone().unwrap_or_default(),
            "langfuse_public_key": t.langfuse_public_key.clone().unwrap_or_default(),
            "langfuse_host": t.langfuse_host.clone().unwrap_or_default(),
            "langfuse_user_id": t.langfuse_user_id.clone().unwrap_or_default(),
            "save_trajectory": t.save_trajectory.clone(),
        }).to_string()
    } else {
        "{}".to_string()
    };

    // Build arguments for the helper script
    let args = vec![
        script_path.to_string_lossy().to_string(),
        device_id.clone(),
        actual_provider.clone(),
        model.clone(),
        prompt.clone(),
        final_api_key.clone(),
        base_url_str.clone(),
        vision_str.to_string(),
        reasoning_str.to_string(),
        tracing_json,
    ];

    // Set API key environment variable based on provider (Flet logic: ENV_VAR_NAMES)
    let env_key = match provider.to_lowercase().as_str() {
        "openai" | "z.ai" | "openailike" | "mun-ai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "googlegenai" | "google" | "gemini" => "GOOGLE_API_KEY",
        "deepseek" => "DEEPSEEK_API_KEY",
        "ollama" => "OLLAMA_API_KEY",
        _ => "OPENAI_API_KEY",
    };

    // Log command for debugging
    let cmd_display = format!("python {}", args.join(" ").replace(&final_api_key, "***"));
    println!("[DroidRun][{}] Executing: {}", device_id, cmd_display);

    // Run python helper script with API key as environment variable
    let mut cmd = new_async_command("python");
    cmd.args(&args)
       .env(env_key, &final_api_key)
       .env("PYTHONIOENCODING", "utf-8")
       .env("PYTHONLEGACYWINDOWSSTDIO", "0");

    // Set both OPENAI_BASE_URL and OPENAI_API_BASE for compatibility (Flet logic)
    if !base_url_str.is_empty() {
        cmd.env("OPENAI_BASE_URL", &base_url_str);
        cmd.env("OPENAI_API_BASE", &base_url_str);
    }

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Không thể chạy droidrun: {}\nCommand: {}", e, cmd_display))?;

    // Register the process for cancellation support
    if let Some(pid) = child.id() {
        register_running_task(&device_id, pid);
    }

    // Take both pipes immediately
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Read stdout and stderr CONCURRENTLY to prevent deadlock
    let window_stdout = window.clone();
    let device_id_stdout = device_id.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stdout).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            // Check if this is an event line
            if line.starts_with("[EVENT] ") {
                // Parse JSON event and emit typed event
                let json_str = &line[8..];
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(json_str) {
                    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    
                    // Add device_id to event
                    let mut event_with_device = event.clone();
                    if let Some(obj) = event_with_device.as_object_mut() {
                        obj.insert("device_id".to_string(), serde_json::Value::String(device_id_stdout.clone()));
                    }
                    
                    match event_type {
                        "screenshot" => {
                            let _ = window_stdout.emit("agent-screenshot", &event_with_device);
                        }
                        "plan" => {
                            let _ = window_stdout.emit("agent-plan", &event_with_device);
                        }
                        "action" => {
                            let _ = window_stdout.emit("agent-action", &event_with_device);
                        }
                        "thinking" => {
                            let _ = window_stdout.emit("agent-thinking", &event_with_device);
                        }
                        "execution_result" => {
                            let _ = window_stdout.emit("agent-execution", &event_with_device);
                        }
                        "result" => {
                            let _ = window_stdout.emit("agent-result", &event_with_device);
                        }
                        "executor_input" => {
                            let _ = window_stdout.emit("agent-executor-input", &event_with_device);
                        }
                        _ => {
                            // Unknown event type, emit generic
                            let _ = window_stdout.emit("agent-event", &event_with_device);
                        }
                    }
                }
                // Don't add raw event line to regular output
                continue;
            }
            
            let prefixed_line = format!("[{}] {}", device_id_stdout, line);
            println!("[DroidRun] {}", prefixed_line);

            // Stream to frontend in real-time with device prefix
            if let Err(e) = window_stdout.emit("task-output", &prefixed_line) {
                eprintln!("[DroidRun] Failed to emit output: {}", e);
            }

            lines.push(line);
        }
        lines
    });

    let window_stderr = window.clone();
    let device_id_stderr = device_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            let prefixed_line = format!("[{}][STDERR] {}", device_id_stderr, line);
            eprintln!("[DroidRun] {}", prefixed_line);

            if let Err(e) = window_stderr.emit("task-output", &prefixed_line) {
                eprintln!("[DroidRun] Failed to emit stderr: {}", e);
            }

            lines.push(line);
        }
        lines
    });

    // Wait for I/O tasks to complete FIRST
    let (stdout_result, stderr_result) = tokio::join!(stdout_handle, stderr_handle);

    let stdout_lines = stdout_result.unwrap_or_else(|e| {
        eprintln!("[DroidRun] stdout task error: {}", e);
        vec!["[ERROR] Failed to read stdout".to_string()]
    });

    let stderr_lines = stderr_result.unwrap_or_else(|e| {
        eprintln!("[DroidRun] stderr task error: {}", e);
        vec!["[ERROR] Failed to read stderr".to_string()]
    });

    // Wait for process to complete
    use tokio::time::{timeout, Duration};

    let status = timeout(
        Duration::from_secs(600), // 10 minutes timeout
        child.wait()
    )
    .await
    .map_err(|_| format!("[{}] Task timeout after 10 minutes", device_id))?
    .map_err(|e| format!("[{}] Lỗi khi chờ process: {}", device_id, e))?;

    let stdout = stdout_lines.join("\n");
    let stderr_content = stderr_lines.join("\n");
    let duration = start_time.elapsed().as_millis() as i64;
    let exit_code = status.code().unwrap_or(-1);

    // Unregister task when finished
    unregister_running_task(&device_id);

    println!("[DroidRun][{}] Exit code: {}, Duration: {}ms", device_id, exit_code, duration);

    if status.success() {
        Ok(TaskResult {
            task_id: Uuid::new_v4().to_string(),
            device_id,
            success: true,
            output: stdout,
            screenshots: vec![],
            duration_ms: duration,
        })
    } else {
        let mut error_msg = format!("[{}] Task thất bại (exit code: {})", device_id, exit_code);
        if !stderr_content.is_empty() {
            error_msg.push_str(&format!("\n--- STDERR ---\n{}", stderr_content.trim()));
        }
        
        // ============================================
        // ScripterAgent Self-Healing Integration
        // ============================================
        // Collect recent logs for error analysis
        let recent_logs: Vec<String> = stdout_lines.iter()
            .rev()
            .take(30) // Increased from 20 to 30 for better context
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        
        // Attempt AI-powered error analysis and self-healing suggestions
        if let Ok(self_heal_result) = analyze_error_and_suggest_fix(
            &error_msg,
            &prompt,
            &recent_logs,
            &device_id,
        ).await {
            // Emit detailed self-healing analysis to frontend
            let _ = window.emit("scripter-self-heal", serde_json::json!({
                "device_id": device_id,
                "error": error_msg,
                "analysis": self_heal_result.analysis,
                "root_cause": self_heal_result.root_cause,
                "suggestions": self_heal_result.suggestions,
                "auto_fix_available": self_heal_result.auto_fix_available,
                "retry_params": self_heal_result.retry_params,
            }));
            
            error_msg.push_str(&format!(
                "\n\n--- 🔧 SCRIPTER SELF-HEALING ---\n📋 Root Cause: {}\n\n💡 Suggestions:\n{}\n",
                self_heal_result.root_cause,
                self_heal_result.suggestions.iter()
                    .enumerate()
                    .map(|(i, s)| format!("  {}. {}", i + 1, s))
                    .collect::<Vec<_>>()
                    .join("\n")
            ));
        }
        
        Err(error_msg)
    }
}

/// Self-healing analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfHealResult {
    pub analysis: String,
    pub root_cause: String,
    pub suggestions: Vec<String>,
    pub auto_fix_available: bool,
    pub retry_params: Option<serde_json::Value>,
}

/// Analyze error and suggest fixes using ScripterAgent
async fn analyze_error_and_suggest_fix(
    error_message: &str,
    task_description: &str,
    logs: &[String],
    device_id: &str,
) -> Result<SelfHealResult, String> {
    let profile = crate::config::get_active_profile()
        .await
        .map_err(|e| format!("No AI profile: {}", e))?
        .ok_or("No active AI profile set")?;
    
    let (base_url, api_key) = crate::config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    let system_prompt = r#"You are ScripterAgent's Self-Healing module, an expert at diagnosing Android automation failures.

Analyze the error and provide a structured JSON response:

{
    "root_cause": "Brief 1-line description of the root cause",
    "analysis": "Detailed technical analysis of what went wrong",
    "suggestions": [
        "Specific actionable fix #1",
        "Specific actionable fix #2",
        "Specific actionable fix #3"
    ],
    "auto_fix_available": true/false,
    "retry_params": {
        "wait_longer": true/false,
        "additional_wait_ms": 1000,
        "alternative_selector": "...",
        "skip_step": false
    }
}

COMMON ANDROID AUTOMATION ISSUES:
1. Element not found → suggest waiting longer, using alternative selectors, or scrolling
2. App not responding → suggest force restart or wait for app load
3. Network timeout → suggest retry with longer timeout
4. Permission denied → suggest granting permission via ADB
5. Screen state changed → suggest re-analyzing screen before action
6. Wrong coordinates → suggest using element text/index instead of coordinates

Be concise but actionable. Focus on PRACTICAL fixes the automation can apply."#;

    let user_prompt = format!(
        "Device: {}\n\nTask: {}\n\nError: {}\n\nRecent logs:\n{}\n\nAnalyze and suggest fixes:",
        device_id,
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
            "temperature": 0.2,
            "max_tokens": 1500
        }))
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}")
        .to_string();
    
    // Try to parse structured JSON response
    let result: SelfHealResult = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&extract_json_from_response(&content)) {
        SelfHealResult {
            root_cause: parsed.get("root_cause")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string(),
            analysis: parsed.get("analysis")
                .and_then(|v| v.as_str())
                .unwrap_or(&content)
                .to_string(),
            suggestions: parsed.get("suggestions")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect())
                .unwrap_or_else(|| vec!["Retry the task".to_string()]),
            auto_fix_available: parsed.get("auto_fix_available")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            retry_params: parsed.get("retry_params").cloned(),
        }
    } else {
        // Fallback to unstructured response
        SelfHealResult {
            root_cause: "Error analysis completed".to_string(),
            analysis: content,
            suggestions: vec!["Review the error details and retry".to_string()],
            auto_fix_available: false,
            retry_params: None,
        }
    };
    
    Ok(result)
}

/// Helper function to extract JSON from AI response (may be wrapped in markdown)
fn extract_json_from_response(content: &str) -> String {
    let content = content.trim();
    
    // Try to find JSON block in markdown
    if let Some(start) = content.find("```json") {
        let json_start = start + 7;
        if let Some(end) = content[json_start..].find("```") {
            return content[json_start..json_start + end].trim().to_string();
        }
    }
    
    // Try to find generic code block
    if let Some(start) = content.find("```") {
        let block_start = start + 3;
        // Skip language identifier if present
        let json_start = if let Some(newline) = content[block_start..].find('\n') {
            block_start + newline + 1
        } else {
            block_start
        };
        if let Some(end) = content[json_start..].find("```") {
            return content[json_start..json_start + end].trim().to_string();
        }
    }
    
    // Try to find JSON object directly
    if let Some(start) = content.find('{') {
        if let Some(end) = content.rfind('}') {
            if end > start {
                return content[start..=end].to_string();
            }
        }
    }
    
    // Return as-is
    content.to_string()
}

/// Chạy task với Python droidrun (single device)
#[command]
pub async fn run_task(
    window: tauri::Window,
    device_id: String,
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    base_url: Option<String>,
    vision: Option<bool>,
    reasoning: Option<bool>,
    tracing: Option<TracingParams>,
) -> Result<TaskResult, String> {
    run_task_internal(
        &window,
        device_id,
        provider,
        api_key,
        model,
        prompt,
        base_url,
        vision,
        reasoning,
        tracing,
    ).await
}

/// Ping provider to test API key and connection - REAL API TEST with chat completion
#[command]
pub async fn ping_provider(
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> Result<String, String> {
    // Get actual credentials (injects hidden creds for mun-ai)
    let (actual_base_url, actual_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);
    
    if actual_api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };

    println!("[PING] Testing {} with model {}", actual_provider, model);

    // Use chat/completions endpoint for real test
    use reqwest;
    use tokio::time::{timeout, Duration};

    let client = reqwest::Client::new();

    match actual_provider {
        "OpenAI" | "OpenAILike" => {
            let url = format!("{}/chat/completions", actual_base_url);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5
            });

            let result = timeout(
                Duration::from_secs(15),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", actual_api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        Ok(format!("✓ {} - Model {} hoạt động", provider, model))
                    } else if status.as_u16() == 401 {
                        Err("✗ API key không hợp lệ".to_string())
                    } else if status.as_u16() == 429 {
                        let body = response.text().await.unwrap_or_default();
                        if body.contains("balance") || body.contains("recharge") {
                            Err("✗ Hết credit - cần nạp tiền".to_string())
                        } else {
                            Err("✗ Rate limit - thử lại sau".to_string())
                        }
                    } else if status.as_u16() == 404 {
                        Err(format!("✗ Model '{}' không tồn tại", model))
                    } else {
                        let body = response.text().await.unwrap_or_default();
                        Err(format!("✗ Lỗi {}: {}", status.as_u16(), body.chars().take(100).collect::<String>()))
                    }
                }
                Ok(Err(e)) => {
                    if e.is_timeout() {
                        Err("✗ Timeout - kiểm tra mạng".to_string())
                    } else if e.is_connect() {
                        Err("✗ Không kết nối được - kiểm tra Base URL".to_string())
                    } else {
                        Err(format!("✗ Lỗi: {}", e))
                    }
                }
                Err(_) => Err("✗ Timeout 15s".to_string()),
            }
        }
        "Anthropic" => {
            let url = "https://api.anthropic.com/v1/messages";
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5
            });

            let result = timeout(
                Duration::from_secs(15),
                client.post(url)
                    .header("x-api-key", &api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        Ok(format!("✓ Anthropic - Model {} hoạt động", model))
                    } else if status.as_u16() == 401 {
                        Err("✗ API key không hợp lệ".to_string())
                    } else {
                        Err(format!("✗ Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("✗ Lỗi: {}", e)),
                Err(_) => Err("✗ Timeout".to_string()),
            }
        }
        "GoogleGenAI" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );
            let body = serde_json::json!({
                "contents": [{"parts": [{"text": "Hi"}]}]
            });

            let result = timeout(
                Duration::from_secs(15),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        Ok(format!("✓ Google AI - Model {} hoạt động", model))
                    } else {
                        Err(format!("✗ Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("✗ Lỗi: {}", e)),
                Err(_) => Err("✗ Timeout".to_string()),
            }
        }
        "DeepSeek" => {
            let base = base_url.as_deref().unwrap_or("https://api.deepseek.com/v1");
            let url = format!("{}/chat/completions", base);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5
            });

            let result = timeout(
                Duration::from_secs(15),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        Ok(format!("✓ DeepSeek - Model {} hoạt động", model))
                    } else {
                        Err(format!("✗ Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("✗ Lỗi: {}", e)),
                Err(_) => Err("✗ Timeout".to_string()),
            }
        }
        "Ollama" => {
            let base = base_url.as_deref().unwrap_or("http://localhost:11434");
            let url = format!("{}/api/generate", base);
            
            let body = serde_json::json!({
                "model": model,
                "prompt": "Hi",
                "stream": false
            });

            let result = timeout(
                Duration::from_secs(30),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        Ok(format!("✓ Ollama - Model {} hoạt động", model))
                    } else {
                        Err(format!("✗ Lỗi {} - kiểm tra model đã pull chưa", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("✗ Không kết nối được Ollama: {}", e)),
                Err(_) => Err("✗ Timeout - Ollama chậm hoặc model lớn".to_string()),
            }
        }
        _ => {
            Ok(format!("✓ Config OK: {} với model {}", provider, model))
        }
    }
}

/// Chạy nhiều task song song trên nhiều thiết bị (Flet logic: asyncio.gather)
/// This is the REAL parallel execution, not simulation
#[command]
pub async fn run_parallel_tasks(
    window: tauri::Window,
    tasks: Vec<TaskParams>,
    max_parallel: i32,
) -> Result<Vec<TaskResult>, String> {
    use tokio::sync::Semaphore;

    println!("[PARALLEL] Starting parallel execution for {} devices", tasks.len());
    
    // Emit start message
    let _ = window.emit("task-output", &format!("[PARALLEL] Starting {} tasks...", tasks.len()));

    let semaphore = Arc::new(Semaphore::new(max_parallel as usize));
    let window = Arc::new(window);
    
    // Create futures for all tasks (Flet logic: asyncio.gather)
    let mut handles = vec![];

    for task_params in tasks {
        let permit = semaphore.clone().acquire_owned().await
            .map_err(|e| format!("Semaphore error: {}", e))?;
        
        let window_clone = window.clone();
        let device_id = task_params.device_id.clone();
        
        println!("[PARALLEL] Spawning task for device: {}", device_id);
        let _ = window_clone.emit("task-output", &format!("[{}] >>> STARTING agent <<<", device_id));

        let handle = tokio::spawn(async move {
            let result = run_task_internal(
                &window_clone,
                task_params.device_id.clone(),
                task_params.provider,
                task_params.api_key,
                task_params.model,
                task_params.prompt,
                task_params.base_url,
                task_params.vision,
                task_params.reasoning,
                task_params.tracing,
            ).await;

            // Release semaphore permit
            drop(permit);

            match result {
                Ok(task_result) => {
                    let _ = window_clone.emit("task-output", 
                        &format!("[{}] ✓ Task completed successfully", task_params.device_id));
                    Ok(task_result)
                }
                Err(e) => {
                    let _ = window_clone.emit("task-output", 
                        &format!("[{}] ✗ Task failed: {}", task_params.device_id, e));
                    Err(e)
                }
            }
        });

        handles.push((device_id, handle));
    }

    // Wait for all tasks to complete (like asyncio.gather)
    let mut results = vec![];
    let mut success_count = 0;
    let total_count = handles.len();

    for (device_id, handle) in handles {
        match handle.await {
            Ok(Ok(result)) => {
                success_count += 1;
                results.push(result);
            }
            Ok(Err(e)) => {
                println!("[PARALLEL][{}] Task error: {}", device_id, e);
                // Create failed result
                results.push(TaskResult {
                    task_id: Uuid::new_v4().to_string(),
                    device_id: device_id.clone(),
                    success: false,
                    output: e,
                    screenshots: vec![],
                    duration_ms: 0,
                });
            }
            Err(e) => {
                println!("[PARALLEL][{}] Join error: {}", device_id, e);
                results.push(TaskResult {
                    task_id: Uuid::new_v4().to_string(),
                    device_id: device_id.clone(),
                    success: false,
                    output: format!("Task panicked: {}", e),
                    screenshots: vec![],
                    duration_ms: 0,
                });
            }
        }
    }

    // Emit completion message (Flet logic)
    let _ = window.emit("task-output", 
        &format!("[DONE] {}/{} tasks succeeded", success_count, total_count));

    println!("[PARALLEL] Completed: {}/{} succeeded", success_count, total_count);

    Ok(results)
}

/// Hủy task - kill process Python đang chạy
#[command]
pub async fn cancel_task(task_id: String) -> Result<bool, String> {
    println!("[TASK] Cancel requested for task: {}", task_id);
    
    // Get PID from running tasks map
    let pid = {
        let tasks = RUNNING_TASKS.lock().map_err(|e| format!("Lock error: {}", e))?;
        tasks.get(&task_id).copied()
    };
    
    if let Some(pid) = pid {
        println!("[TASK] Killing process PID: {}", pid);
        
        #[cfg(windows)]
        {
            // On Windows, use taskkill to kill process tree
            let output = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            
            match output {
                Ok(result) => {
                    let stdout = String::from_utf8_lossy(&result.stdout);
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    println!("[TASK] taskkill output: {} {}", stdout, stderr);
                }
                Err(e) => {
                    println!("[TASK] taskkill error: {}", e);
                }
            }
        }
        
        #[cfg(not(windows))]
        {
            // On Unix, use kill -9
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
        
        // Remove from running tasks
        {
            let mut tasks = RUNNING_TASKS.lock().map_err(|e| format!("Lock error: {}", e))?;
            tasks.remove(&task_id);
        }
        
        Ok(true)
    } else {
        println!("[TASK] No running process found for task: {}", task_id);
        Ok(false)
    }
}

/// Register a running task process
pub fn register_running_task(task_id: &str, pid: u32) {
    if let Ok(mut tasks) = RUNNING_TASKS.lock() {
        tasks.insert(task_id.to_string(), pid);
        println!("[TASK] Registered task {} with PID {}", task_id, pid);
    }
}

/// Unregister a finished task process
pub fn unregister_running_task(task_id: &str) {
    if let Ok(mut tasks) = RUNNING_TASKS.lock() {
        tasks.remove(task_id);
        println!("[TASK] Unregistered task {}", task_id);
    }
}

/// Input parameters for scheduling a task (từ frontend)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleTaskInput {
    pub prompt: String,
    pub device_id: String,
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub emulator_index: Option<String>,
    pub macro_id: Option<String>,
    pub task_source: Option<String>,
}

/// Lên lịch task
#[command]
pub async fn schedule_task(
    task: ScheduleTaskInput,
    schedule_time: String,
    repeat: Option<RepeatConfig>,
) -> Result<ScheduledTask, String> {
    // Convert input to full Task
    let full_task = Task {
        id: Uuid::new_v4().to_string(),
        name: format!("Scheduled Task"),
        device_id: task.device_id,
        profile_id: String::new(),
        prompt: task.prompt,
        status: TaskStatus::Pending,
        progress: 0,
        current_step: 0,
        max_steps: 50,
        logs: vec![],
        created_at: Utc::now().to_rfc3339(),
        started_at: None,
        completed_at: None,
        error: None,
        emulator_index: task.emulator_index,
        provider: task.provider,
        api_key: task.api_key,
        model: task.model,
        base_url: task.base_url,
        macro_id: task.macro_id,
        task_source: task.task_source,
    };
    
    let scheduled = ScheduledTask {
        id: Uuid::new_v4().to_string(),
        task: full_task,
        schedule_time,
        repeat,
        enabled: true,
    };

    println!("[SCHEDULER] Task scheduled: {} at {}", scheduled.id, scheduled.schedule_time);
    if let Some(ref emu_idx) = scheduled.task.emulator_index {
        println!("[SCHEDULER] Emulator index: {} will be launched when task runs", emu_idx);
    }

    Ok(scheduled)
}

/// Launch emulator và chờ Android khởi động, trả về device_id (ADB address)
/// Sau khi khởi động, kiểm tra và cài DroidRun Portal nếu cần
async fn launch_emulator_and_wait(emulator_index: &str) -> Result<String, String> {
    use crate::emulator::{launch_emulator, get_emulator_instances, connect_emulator_adb};
    use crate::adb::{check_droidrun_portal, setup_droidrun_portal};
    
    println!("[SCHEDULER] Launching emulator index: {}", emulator_index);
    
    // 1. Launch emulator
    let launch_result = launch_emulator(emulator_index.to_string()).await?;
    if !launch_result.success {
        return Err(format!("Không thể khởi động emulator: {}", launch_result.message));
    }
    
    println!("[SCHEDULER] Emulator launched, waiting for Android to start...");
    
    // 2. Poll for Android to start (max 90 seconds)
    let max_attempts = 90;
    for attempt in 1..=max_attempts {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        
        // Check emulator status
        if let Ok(instances_result) = get_emulator_instances().await {
            if let Some(instances) = instances_result.instances {
                for instance in instances {
                    if instance.index == emulator_index {
                        if instance.is_android_started {
                            // Android started, connect ADB
                            if let (Some(host), Some(port)) = (instance.adb_host, instance.adb_port) {
                                println!("[SCHEDULER] Android started! Connecting ADB to {}:{}", host, port);
                                
                                // Connect ADB
                                let connect_result = connect_emulator_adb(host.clone(), port).await?;
                                if connect_result.success {
                                    let device_id = format!("{}:{}", host, port);
                                    println!("[SCHEDULER] ADB connected: {}", device_id);
                                    
                                    // Wait a bit more for device to be fully ready
                                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                                    
                                    // 3. Check DroidRun Portal with ping
                                    println!("[SCHEDULER] Checking DroidRun Portal...");
                                    let ping_result = check_droidrun_portal(device_id.clone()).await;
                                    
                                    match ping_result {
                                        Ok(result) if result.success => {
                                            println!("[SCHEDULER] ✓ DroidRun Portal is ready!");
                                        }
                                        _ => {
                                            // Portal not ready, need to setup
                                            println!("[SCHEDULER] DroidRun Portal not found, installing...");
                                            println!("[SCHEDULER] This may take 2-4 minutes...");
                                            
                                            // Run setup
                                            match setup_droidrun_portal(device_id.clone()).await {
                                                Ok(setup_result) => {
                                                    if setup_result.success {
                                                        println!("[SCHEDULER] ✓ DroidRun Portal installed successfully!");
                                                    } else {
                                                        println!("[SCHEDULER] ⚠ Setup completed but may have issues: {}", setup_result.output);
                                                    }
                                                }
                                                Err(e) => {
                                                    println!("[SCHEDULER] ⚠ Failed to setup DroidRun: {}", e);
                                                }
                                            }
                                            
                                            // Wait for Portal to initialize after install (2 minutes)
                                            println!("[SCHEDULER] Waiting 120s for Portal to initialize...");
                                            tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;
                                            
                                            // Verify with ping again
                                            if let Ok(verify_result) = check_droidrun_portal(device_id.clone()).await {
                                                if verify_result.success {
                                                    println!("[SCHEDULER] ✓ DroidRun Portal verified and ready!");
                                                } else {
                                                    println!("[SCHEDULER] ⚠ Portal may not be fully ready: {}", verify_result.output);
                                                }
                                            }
                                        }
                                    }
                                    
                                    return Ok(device_id);
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        if attempt % 10 == 0 {
            println!("[SCHEDULER] Still waiting for Android... ({}s)", attempt);
        }
    }
    
    Err(format!("Timeout: Android không khởi động sau {} giây", max_attempts))
}

/// Chạy scheduled task - tự động launch emulator nếu cần
#[command]
pub async fn run_scheduled_task(
    window: tauri::Window,
    scheduled_task: ScheduledTask,
) -> Result<TaskResult, String> {
    let task = &scheduled_task.task;
    
    println!("[SCHEDULER] Running scheduled task: {}", scheduled_task.id);
    
    // Check if we need to launch emulator
    let device_id = if let Some(ref emulator_index) = task.emulator_index {
        // Check if device is already connected
        let existing_device_id = task.device_id.clone();
        
        // Try to check if device exists
        let check_output = new_async_command("adb")
            .args(["devices"])
            .output()
            .await;
        
        let device_exists = if let Ok(output) = check_output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains(&existing_device_id) && stdout.contains("device")
        } else {
            false
        };
        
        if device_exists {
            println!("[SCHEDULER] Device {} already connected", existing_device_id);
            
            // Wake up device screen first
            let _ = window.emit("task-output", "[SCHEDULER] Đánh thức màn hình thiết bị...");
            use crate::adb::{wake_device, check_droidrun_portal, setup_droidrun_portal};
            let _ = wake_device(existing_device_id.clone()).await;
            
            // Still need to check DroidRun Portal for already running emulator
            let _ = window.emit("task-output", "[SCHEDULER] Kiểm tra DroidRun Portal...");
            
            let ping_result = check_droidrun_portal(existing_device_id.clone()).await;
            match ping_result {
                Ok(result) if result.success => {
                    let _ = window.emit("task-output", "[SCHEDULER] ✓ DroidRun Portal sẵn sàng!");
                }
                _ => {
                    let _ = window.emit("task-output", "[SCHEDULER] DroidRun Portal chưa cài, đang cài đặt...");
                    let _ = window.emit("task-output", "[SCHEDULER] Quá trình này mất 2-4 phút...");
                    
                    match setup_droidrun_portal(existing_device_id.clone()).await {
                        Ok(setup_result) => {
                            if setup_result.success {
                                let _ = window.emit("task-output", "[SCHEDULER] ✓ Đã cài DroidRun Portal!");
                            } else {
                                let _ = window.emit("task-output", &format!(
                                    "[SCHEDULER] ⚠ Cài đặt có thể chưa hoàn tất: {}", 
                                    setup_result.output
                                ));
                            }
                        }
                        Err(e) => {
                            let _ = window.emit("task-output", &format!(
                                "[SCHEDULER] ⚠ Lỗi cài DroidRun: {}", e
                            ));
                        }
                    }
                    
                    // Wait for Portal to initialize
                    let _ = window.emit("task-output", "[SCHEDULER] Chờ 120s để Portal khởi động...");
                    tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;
                }
            }
            
            existing_device_id
        } else {
            // Need to launch emulator
            println!("[SCHEDULER] Device not found, launching emulator...");
            let _ = window.emit("task-output", &format!(
                "[SCHEDULER] Đang khởi động emulator {} cho scheduled task...", 
                emulator_index
            ));
            
            launch_emulator_and_wait(emulator_index).await?
        }
    } else {
        task.device_id.clone()
    };
    
    // Check if this is a macro task
    if let Some(ref task_source) = task.task_source {
        if task_source == "macro" {
            if let Some(ref macro_id) = task.macro_id {
                println!("[SCHEDULER] Running macro: {}", macro_id);
                let _ = window.emit("task-output", &format!(
                    "[SCHEDULER] Chạy macro {} trên device: {}", 
                    macro_id, device_id
                ));
                
                // Call replay_macro command
                use crate::macro_cmd::replay_macro;
                let replay_result = replay_macro(
                    window.clone(),
                    macro_id.clone(),
                    device_id.clone(),
                    None,  // delay
                    None,  // start_from
                    None,  // max_steps
                    None,  // dry_run
                ).await;
                
                let start_time = std::time::Instant::now();
                let duration = start_time.elapsed().as_millis() as i64;
                
                return match replay_result {
                    Ok(result) => {
                        Ok(TaskResult {
                            task_id: scheduled_task.id.clone(),
                            device_id,
                            success: result.success,
                            output: result.message,
                            screenshots: vec![],
                            duration_ms: duration,
                        })
                    }
                    Err(e) => {
                        Err(format!("Macro replay failed: {}", e))
                    }
                };
            } else {
                return Err("Macro ID không được cấu hình".to_string());
            }
        }
    }
    
    // Regular AI task - Get provider config
    let provider = task.provider.clone().ok_or("Provider không được cấu hình")?;
    let api_key = task.api_key.clone().ok_or("API key không được cấu hình")?;
    let model = task.model.clone().ok_or("Model không được cấu hình")?;
    let base_url = task.base_url.clone();
    
    // Load vision/reasoning from profile if profile_id exists
    let (vision, reasoning) = if !task.profile_id.is_empty() {
        match crate::config::load_config().await {
            Ok(config) => {
                if let Some(profile) = config.profiles.iter().find(|p| p.id == task.profile_id) {
                    println!("[SCHEDULER] Loaded profile: {} (vision={}, reasoning={})", 
                        profile.name, profile.vision, profile.reasoning);
                    (profile.vision, profile.reasoning)
                } else {
                    println!("[SCHEDULER] Profile not found, using defaults (vision=true, reasoning=false)");
                    (true, false)
                }
            }
            Err(e) => {
                println!("[SCHEDULER] Failed to load config: {}, using defaults", e);
                (true, false)
            }
        }
    } else {
        println!("[SCHEDULER] No profile_id, using defaults (vision=true, reasoning=false)");
        (true, false)
    };
    
    let _ = window.emit("task-output", &format!(
        "[SCHEDULER] Bắt đầu chạy task trên device: {} (vision={}, reasoning={})", 
        device_id, vision, reasoning
    ));

    // Ensure DroidRun Portal is ready before running task
    let _ = window.emit("task-output", "[SCHEDULER] Kiểm tra DroidRun Portal...");
    match crate::adb::check_droidrun_portal(device_id.clone()).await {
        Ok(result) => {
            if result.success {
                let _ = window.emit("task-output", "[SCHEDULER] ✓ DroidRun Portal sẵn sàng!");
            } else {
                // Portal not ready, run setup
                let _ = window.emit("task-output", "[SCHEDULER] Portal chưa sẵn sàng, đang setup...");
                if let Ok(setup_result) = crate::adb::setup_droidrun_portal(device_id.clone()).await {
                    if setup_result.success {
                        let _ = window.emit("task-output", "[SCHEDULER] ✓ Setup thành công!");
                    }
                }
            }
        }
        Err(e) => {
            let _ = window.emit("task-output", &format!(
                "[SCHEDULER] ⚠ Không thể kiểm tra DroidRun Portal: {}", e
            ));
        }
    }
    
    // Run the actual task
    run_task_internal(
        &window,
        device_id,
        provider,
        api_key,
        model,
        task.prompt.clone(),
        base_url,
        Some(vision),    // vision from profile
        Some(reasoning), // reasoning from profile
        None,            // tracing
    ).await
}

/// Nâng cao lời nhắc bằng AI - biến prompt đơn giản thành prompt chi tiết từng bước
#[command]
pub async fn enhance_prompt(
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    base_url: Option<String>,
) -> Result<String, String> {
    // Get actual credentials (injects hidden creds for mun-ai)
    let (actual_base_url, actual_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);
    
    if actual_api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    if prompt.trim().is_empty() {
        return Err("Prompt không được để trống".to_string());
    }

    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };

    println!("[ENHANCE] Enhancing prompt with {} using model {}", actual_provider, model);

    use reqwest;
    use tokio::time::{timeout, Duration};

    let client = reqwest::Client::new();

    // System prompt to translate prompt to English
    let system_prompt = r#"You are an expert AI assistant specializing in Android device automation.
Your task is to translate the user's prompt into clear, actionable English for an AI agent to execute on an Android device.

RULES:
1. Translate the original prompt to English accurately
2. Keep the same meaning and intent as the original
3. Use clear, unambiguous language suitable for automation
4. Include important details like: app names, button locations, specific actions
5. Return ONLY the translated prompt, no explanations or comments
6. If the prompt is already in English, just return it as-is with minor improvements if needed

EXAMPLES:
- Input: "Mở Facebook"
- Output: "Open Facebook app on the Android device. Wait for the app to load and display the home screen."

- Input: "Đăng nhập"
- Output: "Enter username in the username field, then enter password in the password field. Tap the Login button to complete."

- Input: "Xem 5 video trên TikTok và like 2 video"
- Output: "Open TikTok, watch 5 videos by swiping up. Like 2 random videos by tapping the heart icon."

Now translate the following prompt:"#;

    match actual_provider {
        "OpenAI" | "OpenAILike" => {
            let url = format!("{}/chat/completions", actual_base_url);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            });

            let result = timeout(
                Duration::from_secs(30),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", actual_api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let enhanced = json["choices"][0]["message"]["content"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim()
                            .to_string();
                        
                        Ok(enhanced)
                    } else {
                        let body = response.text().await.unwrap_or_default();
                        Err(format!("Lỗi API {}: {}", status.as_u16(), body.chars().take(200).collect::<String>()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout 30s".to_string()),
            }
        }
        "Anthropic" => {
            let url = "https://api.anthropic.com/v1/messages";
            let body = serde_json::json!({
                "model": model,
                "system": system_prompt,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500
            });

            let result = timeout(
                Duration::from_secs(30),
                client.post(url)
                    .header("x-api-key", &api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let enhanced = json["content"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim()
                            .to_string();
                        
                        Ok(enhanced)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        "GoogleGenAI" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );
            let body = serde_json::json!({
                "contents": [
                    {
                        "parts": [
                            {"text": format!("{}\n\nPrompt gốc: {}", system_prompt, prompt)}
                        ]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": 500,
                    "temperature": 0.7
                }
            });

            let result = timeout(
                Duration::from_secs(30),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let enhanced = json["candidates"][0]["content"]["parts"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim()
                            .to_string();
                        
                        Ok(enhanced)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        "DeepSeek" => {
            let base = base_url.as_deref().unwrap_or("https://api.deepseek.com/v1");
            let url = format!("{}/chat/completions", base);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 500,
                "temperature": 0.7
            });

            let result = timeout(
                Duration::from_secs(30),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let enhanced = json["choices"][0]["message"]["content"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim()
                            .to_string();
                        
                        Ok(enhanced)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        "Ollama" => {
            let base = base_url.as_deref().unwrap_or("http://localhost:11434");
            let url = format!("{}/api/generate", base);
            
            let body = serde_json::json!({
                "model": model,
                "prompt": format!("{}\n\nPrompt gốc: {}", system_prompt, prompt),
                "stream": false,
                "options": {
                    "num_predict": 500,
                    "temperature": 0.7
                }
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let enhanced = json["response"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim()
                            .to_string();
                        
                        Ok(enhanced)
                    } else {
                        Err(format!("Lỗi {} - kiểm tra model đã pull chưa", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Không kết nối được Ollama: {}", e)),
                Err(_) => Err("Timeout - Ollama chậm hoặc model lớn".to_string()),
            }
        }
        _ => {
            Err(format!("Provider '{}' chưa hỗ trợ tính năng nâng cao prompt", provider))
        }
    }
}

/// Tạo skill tự động bằng AI từ mô tả của người dùng
#[command]
pub async fn generate_skill(
    provider: String,
    api_key: String,
    model: String,
    description: String,
    base_url: Option<String>,
) -> Result<serde_json::Value, String> {
    // Get actual credentials (injects hidden creds for mun-ai)
    let (actual_base_url, actual_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);

    if actual_api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    if description.trim().is_empty() {
        return Err("Mô tả skill không được để trống".to_string());
    }

    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };

    println!("[GENERATE_SKILL] Generating skill with {} using model {}", actual_provider, model);

    use reqwest;
    use tokio::time::{timeout, Duration};

    let client = reqwest::Client::new();

    let system_prompt = r##"You are an expert at creating automation skills for Android devices.
Given a user's description, generate a complete skill configuration in JSON format.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.

The JSON must have this exact structure:
{
  "name": "Short skill name (2-4 words)",
  "description": "Brief description of what the skill does",
  "icon": "one of: sparkles, heart, smartphone, message, zap, settings",
  "color": "hex color like #4f6ef7",
  "category": "one of: social, testing, automation, custom",
  "timeout": 180,
  "onError": "skip",
  "variables": [
    {
      "name": "variable_name_snake_case",
      "label": "Display Label",
      "type": "string or number or boolean or text",
      "default": "default value"
    }
  ],
  "prompt": "Detailed step-by-step instructions for the AI agent."
}

RULES:
1. The prompt should be detailed, clear, step-by-step instructions in English
2. Include relevant variables that users might want to customize
3. Use appropriate icon and color based on the skill type
4. Keep variable names in snake_case
5. The prompt should reference variables using double curly braces syntax
6. For boolean variables, use conditional sections

EXAMPLE for "Like videos on TikTok":
{
  "name": "TikTok Engagement",
  "description": "Watch and like videos on TikTok",
  "icon": "heart",
  "color": "#ff0050",
  "category": "social",
  "timeout": 300,
  "onError": "skip",
  "variables": [
    {"name": "video_count", "label": "Video count", "type": "number", "default": 5},
    {"name": "like_videos", "label": "Like videos", "type": "boolean", "default": true}
  ],
  "prompt": "Open TikTok app. Watch the specified number of videos by swiping up. Like videos if enabled."
}"##;

    let user_message = format!("Create a skill for: {}", description);

    match actual_provider {
        "OpenAI" | "OpenAILike" => {
            let url = format!("{}/chat/completions", actual_base_url);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "max_tokens": 20000,
                "temperature": 0.7
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", actual_api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["choices"][0]["message"]["content"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        // Extract JSON from response (may be wrapped in markdown)
                        let json_str = extract_json_from_response(content);
                        
                        // Parse the skill JSON from response
                        let skill: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}. Response: {}", e, &content[..content.len().min(200)]))?;
                        
                        Ok(skill)
                    } else {
                        let body = response.text().await.unwrap_or_default();
                        Err(format!("Lỗi API {}: {}", status.as_u16(), body.chars().take(200).collect::<String>()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout 60s".to_string()),
            }
        }
        "Anthropic" => {
            let url = "https://api.anthropic.com/v1/messages";
            let body = serde_json::json!({
                "model": model,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "max_tokens": 3000
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(url)
                    .header("x-api-key", &actual_api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["content"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        let json_str = extract_json_from_response(content);
                        let skill: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}", e))?;
                        
                        Ok(skill)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        "GoogleGenAI" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, actual_api_key
            );
            let body = serde_json::json!({
                "contents": [
                    {
                        "parts": [
                            {"text": format!("{}\n\n{}", system_prompt, user_message)}
                        ]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": 20000,
                    "temperature": 0.7
                }
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["candidates"][0]["content"]["parts"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        let json_str = extract_json_from_response(content);
                        let skill: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}", e))?;
                        
                        Ok(skill)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        _ => {
            Err(format!("Provider '{}' chưa hỗ trợ tính năng tạo skill với AI", provider))
        }
    }
}

/// Generate clarifying questions for a task before creating workflow
/// AI analyzes the task and returns questions to get more details
#[command]
pub async fn generate_clarifying_questions(
    provider: String,
    api_key: String,
    model: String,
    task_description: String,
    base_url: Option<String>,
) -> Result<serde_json::Value, String> {
    // Get actual credentials (injects hidden creds for mun-ai)
    let (actual_base_url, actual_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);

    if actual_api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let _actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };

    println!("[CLARIFY] Generating questions for: {}", task_description);

    let system_prompt = r##"You are an AI assistant that helps plan Android automation tasks.

Analyze the user's task description and generate clarifying questions to get more details.
The questions should help understand:
1. Specific parameters (how many? how long? how often?)
2. Optional features (like, comment, save, skip ads?)
3. Stopping conditions (stop after X minutes? after X items?)
4. Preferences (random delays? specific timing?)

Return ONLY a JSON object with this structure:
{
  "task_summary": "Brief summary of what user wants to do",
  "app_detected": "App name if mentioned (TikTok, Kuaishou, YouTube, etc.) or null",
  "questions": [
    {
      "id": "video_count",
      "question": "Bạn muốn xem bao nhiêu video?",
      "type": "number",
      "default": 10,
      "required": true
    },
    {
      "id": "watch_time",
      "question": "Thời gian xem mỗi video (giây)?",
      "type": "range",
      "min": 3,
      "max": 30,
      "default": [5, 15],
      "required": true
    },
    {
      "id": "enable_like",
      "question": "Có muốn tự động like video không?",
      "type": "boolean",
      "default": false,
      "required": false
    }
  ]
}

Question types: "number", "text", "boolean", "range", "select"
For "select" type, include "options": ["option1", "option2"]
For "range" type, include "min", "max" and "default": [minVal, maxVal]

Return 3-5 relevant questions based on the task."##;

    use reqwest;
    use tokio::time::{timeout, Duration};

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/chat/completions", actual_base_url.trim_end_matches('/'));

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": format!("Task: {}", task_description)}
        ],
        "temperature": 0.3,
        "max_tokens": 4000
    });

    let response = timeout(Duration::from_secs(60), async {
        client
            .post(&url)
            .header("Authorization", format!("Bearer {}", actual_api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
    })
    .await
    .map_err(|_| "Request timeout after 60 seconds")?
    .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = response_json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No content in response")?;

    // Parse JSON from content (may have markdown code blocks)
    let json_str = if content.contains("```") {
        content
            .split("```")
            .nth(1)
            .unwrap_or(content)
            .trim_start_matches("json")
            .trim()
    } else {
        content.trim()
    };

    let result: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse questions JSON: {}. Content: {}", e, content))?;

    println!("[CLARIFY] Generated {} questions", result["questions"].as_array().map(|a| a.len()).unwrap_or(0));

    Ok(result)
}

/// Analyze screen using DroidRun agent and return the action it takes
/// Uses DroidRun's built-in Vision capabilities instead of calling API directly
#[command]
pub async fn analyze_screen_for_action(
    device_id: String,
    task: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    step_context: Option<String>,
) -> Result<serde_json::Value, String> {
    println!("[DROIDRUN_VISION] Analyzing screen for task: {}", task);
    
    // Map provider for DroidRun
    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };
    
    // Build DroidRun command with --steps 1 to get single action
    let mut cmd = tokio::process::Command::new("python");
    cmd.arg("-m").arg("droidrun").arg("run");
    
    // Build task description with context
    let full_task = if let Some(ctx) = step_context {
        format!("{}\n\nPrevious steps completed:\n{}\n\nWhat is the single next action?", task, ctx)
    } else {
        format!("{}\n\nThis is the first step. What single action should be taken?", task)
    };
    
    cmd.arg(&full_task);
    cmd.arg("--device").arg(&device_id);
    cmd.arg("--provider").arg(actual_provider);
    cmd.arg("--model").arg(&model);
    cmd.arg("--steps").arg("1"); // Only 1 step!
    cmd.arg("--save-trajectory").arg("action");
    cmd.arg("--no-vision"); // Use UI Tree instead of Vision - works with any LLM
    
    if let Some(url) = &base_url {
        cmd.arg("--api_base").arg(url);
    }
    
    // Set environment
    cmd.env("OPENAI_API_KEY", &api_key);
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    
    println!("[DROIDRUN_VISION] Running DroidRun for single step...");
    
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        cmd.output()
    ).await
        .map_err(|_| "DroidRun timeout after 120s")?
        .map_err(|e| format!("Failed to run DroidRun: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let _stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    println!("[DROIDRUN_VISION] DroidRun output length: {} chars", stdout.len());
    
    // Find trajectories folder and parse macro.json
    let trajectories_dir = std::path::Path::new("trajectories");
    if trajectories_dir.exists() {
        // Find latest trajectory folder
        if let Ok(entries) = std::fs::read_dir(trajectories_dir) {
            let mut folders: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .collect();
            folders.sort_by(|a, b| b.path().cmp(&a.path())); // Latest first
            
            if let Some(latest) = folders.first() {
                let macro_path = latest.path().join("macro.json");
                if macro_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&macro_path) {
                        if let Ok(macro_data) = serde_json::from_str::<serde_json::Value>(&content) {
                            // Get first action from macro
                            if let Some(actions) = macro_data["actions"].as_array() {
                                if let Some(action) = actions.first() {
                                    let action_type = action["action"].as_str().unwrap_or("tap");
                                    let description = action["description"].as_str()
                                        .or_else(|| action["reason"].as_str())
                                        .unwrap_or("Action from DroidRun");
                                    
                                    return Ok(serde_json::json!({
                                        "action": action_type,
                                        "params": action["params"],
                                        "description": description,
                                        "reasoning": action["reason"],
                                        "is_complete": false,
                                        "confidence": 0.9,
                                        "source": "droidrun"
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Try to extract action from stdout
    if stdout.contains("Tapped") || stdout.contains("tapped") {
        // Parse coordinates from stdout like "Tapped element with index 11 at coordinates (70, 907)"
        let re = regex::Regex::new(r"at coordinates \((\d+), (\d+)\)").ok();
        if let Some(caps) = re.and_then(|r| r.captures(&stdout)) {
            let x: i32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let y: i32 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            
            return Ok(serde_json::json!({
                "action": "tap",
                "params": {"x": x, "y": y},
                "description": "Tap action from DroidRun",
                "reasoning": "Detected from DroidRun output",
                "is_complete": false,
                "confidence": 0.8,
                "source": "droidrun_stdout"
            }));
        }
    }
    
    // Check if goal achieved
    if stdout.contains("Goal achieved") || stdout.contains("🎉") {
        return Ok(serde_json::json!({
            "action": "done",
            "params": {},
            "description": "Task completed",
            "reasoning": "DroidRun reported goal achieved",
            "is_complete": true,
            "confidence": 1.0,
            "source": "droidrun"
        }));
    }
    
    Err(format!(
        "Could not parse DroidRun action. Output: {}...", 
        stdout.chars().take(500).collect::<String>()
    ))
}

/// Tạo workflow tự động bằng AI từ mô tả của người dùng
#[command]
pub async fn generate_workflow(
    provider: String,
    api_key: String,
    model: String,
    description: String,
    base_url: Option<String>,
) -> Result<serde_json::Value, String> {
    // Get actual credentials (injects hidden creds for mun-ai)
    let (actual_base_url, actual_api_key) = crate::config::get_provider_credentials(&provider, &base_url, &api_key);

    if actual_api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    if description.trim().is_empty() {
        return Err("Mô tả workflow không được để trống".to_string());
    }

    let actual_provider = match provider.as_str() {
        "Z.AI" | "mun-ai" => "OpenAILike",
        _ => &provider,
    };

    println!("[GENERATE_WORKFLOW] Using {} with model {}", actual_provider, model);

    // System prompt to generate workflow JSON - detailed guide
    let system_prompt = r##"You are an expert Android automation workflow designer.
Create a complete workflow JSON from the user's description.

WORKFLOW STRUCTURE:
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "color": "#4f6ef7",
  "timeout": 300,
  "inputs": [...],
  "steps": [...]
}

INPUT FORMAT (variables user can configure):
{"name": "video_count", "label": "Number of videos", "type": "number", "default": 5}
{"name": "like_enabled", "label": "Enable likes", "type": "boolean", "default": true}
{"name": "username", "label": "Username", "type": "string", "default": ""}

STEP TYPES:

1. ACTION - Interact with device:
{"id": "step-1", "type": "action", "name": "Open TikTok", "action": "open_app", "params": {"package": "com.zhiliaoapp.musically"}}
{"id": "step-2", "type": "action", "name": "Tap like", "action": "tap", "params": {"target": "heart button"}}

2. WAIT - Delay execution:
{"id": "step-3", "type": "wait", "name": "Wait for load", "duration": "3000"}

3. PROMPT - AI agent instruction (most powerful):
{"id": "step-4", "type": "prompt", "name": "Watch video", "prompt": "Watch the current video for 5-10 seconds, then swipe up to next video", "save_to": "watch_result"}

4. LOOP - Repeat steps:
{"id": "step-5", "type": "loop", "name": "Video loop", "count": "{{video_count}}", "variable": "i", "body": [...nested steps...]}

5. CONDITION - If/else logic:
{"id": "step-6", "type": "condition", "name": "Check like", "condition": "{{like_enabled}}", "then": [...steps if true...], "else_branch": [...steps if false...]}

6. PYTHON - Run Python code:
{"id": "step-7", "type": "python", "name": "Random delay", "script": "import random; return {'delay': random.randint(3, 8)}", "save_to": "random_delay"}

RULES:
- Use {{input_name}} to reference inputs in step parameters
- Each step needs unique id (step-1, step-2, step-3...)
- For nested steps use step-X-Y format (step-3-1, step-3-2...)
- Use PROMPT type for complex AI-driven actions
- Always start with opening the app
- Add WAIT steps after navigation for loading
- Return ONLY valid JSON, no markdown or explanation

EXAMPLE - TikTok engagement workflow:
{
  "name": "TikTok Auto Engagement",
  "description": "Watch videos and like automatically",
  "color": "#ff0050",
  "timeout": 600,
  "inputs": [
    {"name": "video_count", "label": "Videos to watch", "type": "number", "default": 10},
    {"name": "like_rate", "label": "Like percentage", "type": "number", "default": 50}
  ],
  "steps": [
    {"id": "step-1", "type": "action", "name": "Open TikTok", "action": "open_app", "params": {"package": "com.zhiliaoapp.musically"}},
    {"id": "step-2", "type": "wait", "name": "Wait load", "duration": "4000"},
    {"id": "step-3", "type": "loop", "name": "Watch loop", "count": "{{video_count}}", "variable": "i", "body": [
      {"id": "step-3-1", "type": "prompt", "name": "Watch video", "prompt": "Watch the current video for 5-10 seconds. If video is interesting based on content, double tap to like. Then swipe up to next video.", "save_to": "watch_result"},
      {"id": "step-3-2", "type": "wait", "name": "Brief pause", "duration": "1000"}
    ]}
  ]
}

Now create a workflow based on this description:"##;

    use reqwest;
    use tokio::time::{timeout, Duration};
    
    // Build client with longer timeout and SSL config
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .danger_accept_invalid_certs(true)  // Accept self-signed certs
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    match actual_provider {
        "OpenAI" | "OpenAILike" => {
            let url = format!("{}/chat/completions", actual_base_url);
            
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": description}
                ],
                "max_tokens": 20000,
                "temperature": 0.7
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(&url)
                    .header("Authorization", format!("Bearer {}", actual_api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["choices"][0]["message"]["content"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        let json_str = extract_json_from_response(content);
                        let workflow: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}. Raw: {}", e, json_str.chars().take(200).collect::<String>()))?;
                        
                        Ok(workflow)
                    } else {
                        let body = response.text().await.unwrap_or_default();
                        Err(format!("Lỗi API {}: {}", status.as_u16(), body.chars().take(200).collect::<String>()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout 60s".to_string()),
            }
        }
        "Anthropic" => {
            let url = "https://api.anthropic.com/v1/messages";
            let body = serde_json::json!({
                "model": model,
                "system": system_prompt,
                "messages": [{"role": "user", "content": description}],
                "max_tokens": 2000
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(url)
                    .header("x-api-key", &actual_api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["content"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        let json_str = extract_json_from_response(content);
                        let workflow: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}", e))?;
                        
                        Ok(workflow)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        "GoogleGenAI" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, actual_api_key
            );
            let body = serde_json::json!({
                "contents": [{"parts": [{"text": format!("{}\n\n{}", system_prompt, description)}]}],
                "generationConfig": {
                    "maxOutputTokens": 2000,
                    "temperature": 0.7
                }
            });

            let result = timeout(
                Duration::from_secs(60),
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
            ).await;

            match result {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if status.is_success() {
                        let json: serde_json::Value = response.json().await
                            .map_err(|e| format!("Lỗi parse JSON: {}", e))?;
                        
                        let content = json["candidates"][0]["content"]["parts"][0]["text"]
                            .as_str()
                            .ok_or("Không tìm thấy nội dung phản hồi")?
                            .trim();
                        
                        let json_str = extract_json_from_response(content);
                        let workflow: serde_json::Value = serde_json::from_str(&json_str)
                            .map_err(|e| format!("AI trả về JSON không hợp lệ: {}", e))?;
                        
                        Ok(workflow)
                    } else {
                        Err(format!("Lỗi {}", status.as_u16()))
                    }
                }
                Ok(Err(e)) => Err(format!("Lỗi kết nối: {}", e)),
                Err(_) => Err("Timeout".to_string()),
            }
        }
        _ => {
            Err(format!("Provider '{}' chưa hỗ trợ tính năng tạo workflow với AI", provider))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_status() {
        assert_eq!(TaskStatus::Pending, TaskStatus::Pending);
        assert_ne!(TaskStatus::Running, TaskStatus::Completed);
    }

    #[test]
    fn test_provider_mapping() {
        let provider = "Z.AI";
        let actual = match provider {
            "Z.AI" => "OpenAILike",
            _ => provider,
        };
        assert_eq!(actual, "OpenAILike");
    }
}
