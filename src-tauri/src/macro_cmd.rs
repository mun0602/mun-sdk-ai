// Macro Module - Record and replay macros
// Uses droidrun CLI: droidrun macro replay

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Helper to create a tokio command with hidden window on Windows
fn new_async_command(program: &str) -> Command {
    let mut std_cmd = std::process::Command::new(program);
    #[cfg(windows)]
    std_cmd.creation_flags(CREATE_NO_WINDOW);
    Command::from(std_cmd)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MacroInfo {
    pub name: String,
    pub path: String,
    pub steps: i32,
    pub created_at: String,
    pub prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MacroResult {
    pub success: bool,
    pub macro_path: String,
    pub message: String,
    // AI usage tracking
    pub ai_remaining: Option<i32>,
    pub ai_used: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MacroStep {
    pub step_number: i32,
    pub screenshot_path: String,
    pub action: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MacroPreview {
    pub name: String,
    pub path: String,
    pub goal: Option<String>,
    pub steps: Vec<MacroStep>,
    pub total_steps: i32,
    pub created_at: String,
    pub raw_json: String,
}

/// Get trajectories directory
fn get_trajectories_dir() -> PathBuf {
    // First, check relative to exe (for dev mode: src-tauri/trajectories)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check if we're in dev mode (target/debug or target/release)
            let src_tauri = exe_dir.parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("trajectories"));
            
            if let Some(ref dir) = src_tauri {
                if dir.exists() {
                    return dir.clone();
                }
            }
            
            // Check trajectories next to exe
            let next_to_exe = exe_dir.join("trajectories");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }
    
    // Check current working directory
    let cwd_trajectories = std::env::current_dir()
        .map(|p| p.join("trajectories"))
        .unwrap_or_else(|_| PathBuf::from("trajectories"));
    
    if cwd_trajectories.exists() {
        return cwd_trajectories;
    }
    
    // Check src-tauri/trajectories (for dev mode)
    let src_tauri_trajectories = PathBuf::from("src-tauri/trajectories");
    if src_tauri_trajectories.exists() {
        return src_tauri_trajectories;
    }
    
    // Try app data directory
    if let Some(data_dir) = dirs::data_local_dir() {
        let app_dir = data_dir.join("MUN SDK AI").join("trajectories");
        if app_dir.exists() {
            return app_dir;
        }
    }
    
    // Fallback - create in current directory
    PathBuf::from("trajectories")
}

/// Get path to run_droidrun.py script
#[allow(dead_code)]
fn get_run_droidrun_script_path() -> PathBuf {
    // First, check relative to exe (for production builds)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check next to exe (production)
            let next_to_exe = exe_dir.join("run_droidrun.py");
            if next_to_exe.exists() {
                return next_to_exe;
            }
            
            // Check in _up_/resources (tauri bundled resources)
            let resources = exe_dir.join("../Resources/run_droidrun.py");
            if resources.exists() {
                return resources;
            }
            
            // Check if we're in dev mode (target/debug or target/release)
            // Go up to src-tauri and find run_droidrun.py
            let src_tauri = exe_dir.parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("run_droidrun.py"));
            
            if let Some(ref script) = src_tauri {
                if script.exists() {
                    return script.clone();
                }
            }
        }
    }
    
    // Check current working directory
    let cwd_script = std::env::current_dir()
        .map(|p| p.join("run_droidrun.py"))
        .unwrap_or_else(|_| PathBuf::from("run_droidrun.py"));
    
    if cwd_script.exists() {
        return cwd_script;
    }
    
    // Check src-tauri/run_droidrun.py (for dev mode)
    let src_tauri_script = PathBuf::from("src-tauri/run_droidrun.py");
    if src_tauri_script.exists() {
        return src_tauri_script;
    }
    
    // Fallback - assume it's in current directory
    PathBuf::from("run_droidrun.py")
}

/// List all available macros
#[command]
pub async fn list_macros() -> Result<Vec<MacroInfo>, String> {
    let trajectories_dir = get_trajectories_dir();
    
    if !trajectories_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut macros = Vec::new();
    
    let entries = fs::read_dir(&trajectories_dir)
        .map_err(|e| format!("Cannot read trajectories directory: {}", e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Check if this directory contains a macro.json or trajectory.json file
            let macro_json = path.join("macro.json");
            let trajectory_json = path.join("trajectory.json");
            
            // Use macro.json if exists, otherwise use trajectory.json
            let config_file = if macro_json.exists() {
                Some(macro_json)
            } else if trajectory_json.exists() {
                Some(trajectory_json.clone())
            } else {
                None
            };
            
            if let Some(config_path) = config_file {
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                
                // Count steps from trajectory.json or PNG files
                let steps = if trajectory_json.exists() {
                    // Count action events in trajectory.json
                    fs::read_to_string(&trajectory_json)
                        .ok()
                        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
                        .and_then(|json| json.as_array().map(|arr| {
                            arr.iter().filter(|event| {
                                event.get("type")
                                    .and_then(|t| t.as_str())
                                    .map(|t| t == "CodeActCodeEvent" || t == "CodeActResponseEvent")
                                    .unwrap_or(false)
                            }).count() as i32
                        }))
                        .unwrap_or(0)
                } else {
                    // Count PNG files as fallback
                    fs::read_dir(&path)
                        .map(|entries| {
                            entries.flatten()
                                .filter(|e| {
                                    e.path().extension()
                                        .map(|ext| ext == "png")
                                        .unwrap_or(false)
                                })
                                .count() as i32
                        })
                        .unwrap_or(0)
                };
                
                // Get creation time
                let created_at = fs::metadata(&path)
                    .and_then(|m| m.created())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Local> = t.into();
                        datetime.format("%Y-%m-%d %H:%M").to_string()
                    })
                    .unwrap_or_else(|_| "Unknown".to_string());
                
                // Try to read name and prompt from config file
                let (display_name, prompt) = fs::read_to_string(&config_path)
                    .ok()
                    .and_then(|content| {
                        serde_json::from_str::<serde_json::Value>(&content).ok()
                    })
                    .map(|json| {
                        let name = json.get("name")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let prompt = json.get("goal")
                            .or_else(|| json.get("prompt"))
                            .or_else(|| json.get("description"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        (name, prompt)
                    })
                    .unwrap_or((None, None));
                
                // Use custom name if available, otherwise use folder name
                let final_name = display_name.unwrap_or(name);
                
                macros.push(MacroInfo {
                    name: final_name,
                    path: path.to_string_lossy().to_string(),
                    steps,
                    created_at,
                    prompt,
                });
            }
        }
    }
    
    // Sort by creation time (newest first)
    macros.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(macros)
}

/// Record a new macro using droidrun CLI with --save-trajectory
/// Improved with retry logic, timeout handling, and progress tracking
#[command]
pub async fn record_macro(
    window: tauri::Window,
    device_id: String,
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    _macro_name: String,
    base_url: Option<String>,
    vision: Option<bool>,
    _tracing_enabled: Option<bool>,
    _tracing_provider: Option<String>,
    _langfuse_secret_key: Option<String>,
    _langfuse_public_key: Option<String>,
    _langfuse_host: Option<String>,
    max_steps: Option<i32>,
    step_delay: Option<i32>,
) -> Result<MacroResult, String> {
    use tauri::Emitter;
    use std::time::Duration;
    
    const MAX_RETRIES: i32 = 3;
    const TIMEOUT_SECONDS: u64 = 300; // 5 minutes timeout per attempt
    
    // Z.AI uses OpenAILike internally
    let actual_provider = match provider.as_str() {
        "Z.AI" => "OpenAILike".to_string(),
        _ => provider.clone(),
    };
    
    let steps_limit = max_steps.unwrap_or(1000); // Default 1000 steps for complex tasks
    let _delay_seconds = step_delay.unwrap_or(1); // Reserved for future use
    
    // Set API key env based on provider
    let env_key = match provider.to_lowercase().as_str() {
        "openai" | "z.ai" | "openailike" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "googlegenai" | "google" | "gemini" => "GOOGLE_API_KEY",
        "deepseek" => "DEEPSEEK_API_KEY",
        _ => "OPENAI_API_KEY",
    };
    
    let vision_enabled = vision.unwrap_or(false); // Default false for stability
    
    let _ = window.emit("macro-output", &format!("[RECORD] Starting: {}", prompt));
    let _ = window.emit("macro-output", &format!("[RECORD] Provider: {} | Model: {}", actual_provider, model));
    let _ = window.emit("macro-output", &format!("[RECORD] Device: {} | Vision: {} | Max Steps: {}", device_id, vision_enabled, steps_limit));
    let _ = window.emit("macro-output", &format!("[RECORD] Timeout: {}s | Max Retries: {}", TIMEOUT_SECONDS, MAX_RETRIES));
    let _ = window.emit("macro-output", "[RECORD] Using CLI mode: python -m droidrun run --save-trajectory action");
    
    let mut last_error = String::new();
    let mut trajectory_path = String::new();
    
    // Retry loop
    for attempt in 1..=MAX_RETRIES {
        if attempt > 1 {
            let _ = window.emit("macro-output", &format!("[RETRY] Attempt {}/{} - Waiting 3s before retry...", attempt, MAX_RETRIES));
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
        
        let _ = window.emit("macro-output", &format!("[PROGRESS] Attempt {}/{}", attempt, MAX_RETRIES));
        
        // Use droidrun CLI directly instead of Python script
        // python -m droidrun run "goal" -d device -p provider -m model --save-trajectory action
        let mut args = vec![
            "-m".to_string(),
            "droidrun".to_string(),
            "run".to_string(),
            prompt.clone(),
            "-d".to_string(),
            device_id.clone(),
            "-p".to_string(),
            actual_provider.clone(),
            "-m".to_string(),
            model.clone(),
            "--steps".to_string(),
            steps_limit.to_string(),
            "--save-trajectory".to_string(),
            "action".to_string(),
        ];
        
        // Add vision flag
        if vision_enabled {
            args.push("--vision".to_string());
        } else {
            args.push("--no-vision".to_string());
        }
        
        // Add base URL if provided
        if let Some(ref url) = base_url {
            if !url.is_empty() {
                args.push("--api_base".to_string());
                args.push(url.clone());
            }
        }
        
        let _ = window.emit("macro-output", &format!("[DEBUG] Running: python {}", args.join(" ")));
        
        let mut cmd = new_async_command("python");
        cmd.args(&args)
           .env(env_key, &api_key)
           .env("PYTHONIOENCODING", "utf-8")
           .env("PYTHONUTF8", "1")
           .env("PYTHONLEGACYWINDOWSSTDIO", "0");
        
        // Set base URL env for OpenAI-like
        if let Some(ref url) = base_url {
            if !url.is_empty() {
                cmd.env("OPENAI_BASE_URL", url);
                cmd.env("OPENAI_API_BASE", url);
            }
        }
        
        let child_result = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        
        let mut child = match child_result {
            Ok(c) => c,
            Err(e) => {
                last_error = format!("Cannot run droidrun: {}", e);
                let _ = window.emit("macro-output", &format!("[ERROR] {}", last_error));
                continue;
            }
        };
        
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        
        // Track current step for progress
        let window_clone = window.clone();
        let stdout_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            let mut traj_path = String::new();
            let mut current_step = 0;
            
            while let Ok(Some(line)) = reader.next_line().await {
                // Parse step progress
                if line.contains("Step") || line.contains("step") {
                    current_step += 1;
                    let _ = window_clone.emit("macro-progress", serde_json::json!({
                        "step": current_step,
                        "status": "running"
                    }));
                }
                
                let _ = window_clone.emit("macro-output", &line);
                
                // Capture trajectory folder path
                if line.contains("Trajectory saved") || line.contains("trajectory folder") || line.contains("Saving trajectory") {
                    if let Some(path) = line.split(':').last() {
                        traj_path = path.trim().to_string();
                    }
                }
                if line.contains("trajectories/") || line.contains("trajectories\\") {
                    if let Some(start) = line.find("trajectories") {
                        let path_part = &line[start..];
                        if let Some(end) = path_part.find(|c: char| c.is_whitespace() || c == '"' || c == '\'') {
                            traj_path = path_part[..end].to_string();
                        } else {
                            traj_path = path_part.trim().to_string();
                        }
                    }
                }
            }
            traj_path
        });
        
        let window_clone2 = window.clone();
        let stderr_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            let mut traj_path = String::new();
            
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = window_clone2.emit("macro-output", &line);
                
                if line.contains("Trajectory") || line.contains("trajectory") {
                    if let Some(path) = line.split(':').last() {
                        let p = path.trim();
                        if p.contains("trajectories/") || p.contains("trajectories\\") {
                            traj_path = p.to_string();
                        }
                    }
                }
            }
            traj_path
        });
        
        // Wait with timeout
        let timeout_result = tokio::time::timeout(
            Duration::from_secs(TIMEOUT_SECONDS),
            async {
                let stdout_path = stdout_handle.await.unwrap_or_default();
                let stderr_path = stderr_handle.await.unwrap_or_default();
                let status = child.wait().await;
                (stdout_path, stderr_path, status)
            }
        ).await;
        
        match timeout_result {
            Ok((stdout_path, stderr_path, status_result)) => {
                trajectory_path = if !stdout_path.is_empty() { stdout_path } else { stderr_path };
                
                match status_result {
                    Ok(status) => {
                        if !trajectory_path.is_empty() || status.success() {
                            // Success! Break out of retry loop
                            let _ = window.emit("macro-output", &format!("[SUCCESS] Recording completed on attempt {}", attempt));
                            break;
                        } else {
                            last_error = format!("Process exited with status: {:?}", status.code());
                            let _ = window.emit("macro-output", &format!("[WARN] {}", last_error));
                        }
                    }
                    Err(e) => {
                        last_error = format!("Error waiting for process: {}", e);
                        let _ = window.emit("macro-output", &format!("[ERROR] {}", last_error));
                    }
                }
            }
            Err(_) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                last_error = format!("Timeout after {}s", TIMEOUT_SECONDS);
                let _ = window.emit("macro-output", &format!("[TIMEOUT] {} - killing process", last_error));
            }
        }
    }
    
    // Check if we got a trajectory path
    if trajectory_path.is_empty() && last_error.is_empty() {
        last_error = "No trajectory saved".to_string();
    }
    
    let status_success = !trajectory_path.is_empty();
    
    // Success if trajectory was saved, even if agent failed to complete goal
    if !trajectory_path.is_empty() {
        // Update macro.json with custom name if provided
        if !_macro_name.is_empty() {
            let macro_json_path = std::path::PathBuf::from(&trajectory_path).join("macro.json");
            if macro_json_path.exists() {
                if let Ok(content) = fs::read_to_string(&macro_json_path) {
                    if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                        json["name"] = serde_json::Value::String(_macro_name.clone());
                        if let Ok(updated) = serde_json::to_string_pretty(&json) {
                            let _ = fs::write(&macro_json_path, updated);
                            let _ = window.emit("macro-output", &format!("[INFO] Saved macro name: {}", _macro_name));
                        }
                    }
                }
            }
        }
        
        let _ = window.emit("macro-output", &format!("[SUCCESS] Macro recorded: {}", trajectory_path));
        
        // Track AI usage - only when using mun-ai (Z.AI provider or mun-ai base_url)
        let uses_mun_ai = provider.to_lowercase() == "z.ai" 
            || base_url.as_ref().map(|u| u.contains("mun-ai")).unwrap_or(false);
        
        let (ai_remaining, ai_used) = if uses_mun_ai {
            match crate::license::check_and_use_ai_request("record_macro").await {
                Ok(remaining) => {
                    let _ = window.emit("macro-output", &format!("[AI] Remaining AI requests: {}", remaining));
                    let _ = window.emit("ai-usage-updated", serde_json::json!({ "remaining": remaining }));
                    (Some(remaining), None)
                },
                Err(e) => {
                    let _ = window.emit("macro-output", &format!("[AI] Warning: {}", e));
                    (None, None)
                }
            }
        } else {
            // Not using mun-ai, no tracking needed
            (None, None)
        };
        
        Ok(MacroResult {
            success: true,
            macro_path: trajectory_path,
            message: "Macro recorded successfully".to_string(),
            ai_remaining,
            ai_used,
        })
    } else if status_success {
        let _ = window.emit("macro-output", "[SUCCESS] Macro recorded");
        
        // Track AI usage - only when using mun-ai
        let uses_mun_ai = provider.to_lowercase() == "z.ai" 
            || base_url.as_ref().map(|u| u.contains("mun-ai")).unwrap_or(false);
        
        let (ai_remaining, ai_used) = if uses_mun_ai {
            match crate::license::check_and_use_ai_request("record_macro").await {
                Ok(remaining) => (Some(remaining), None),
                Err(_) => (None, None)
            }
        } else {
            (None, None)
        };
        
        Ok(MacroResult {
            success: true,
            macro_path: String::new(),
            message: "Macro recorded successfully".to_string(),
            ai_remaining,
            ai_used,
        })
    } else {
        let _ = window.emit("macro-output", &format!("[ERROR] Failed to record macro after {} retries: {}", MAX_RETRIES, last_error));
        Err(format!("Failed to record macro: {}", last_error))
    }
}

/// Replay a macro
#[command]
pub async fn replay_macro(
    window: tauri::Window,
    device_id: String,
    macro_path: String,
    delay: Option<f64>,
    start_from: Option<i32>,
    max_steps: Option<i32>,
    dry_run: Option<bool>,
) -> Result<MacroResult, String> {
    use tauri::Emitter;
    
    // Build droidrun macro replay command
    let mut args = vec![
        "-m".to_string(),
        "droidrun".to_string(),
        "macro".to_string(),
        "replay".to_string(),
        macro_path.clone(),
        "-d".to_string(),
        device_id.clone(),
    ];
    
    let delay_val = delay.unwrap_or(1.0);
    args.push("--delay".to_string());
    args.push(delay_val.to_string());
    
    if let Some(s) = start_from {
        if s > 1 {
            args.push("--start-from".to_string());
            args.push(s.to_string());
        }
    }
    
    if let Some(m) = max_steps {
        if m > 0 {
            args.push("--max-steps".to_string());
            args.push(m.to_string());
        }
    }
    
    if dry_run.unwrap_or(false) {
        args.push("--dry-run".to_string());
    }
    
    let _ = window.emit("macro-output", &format!("[REPLAY] Starting: {}", macro_path));
    let _ = window.emit("macro-output", &format!("[REPLAY] Device: {} | Delay: {}s", device_id, delay_val));
    
    let mut cmd = new_async_command("python");
    cmd.args(&args)
       .env("PYTHONIOENCODING", "utf-8")
       .env("PYTHONUTF8", "1")
       .env("PYTHONLEGACYWINDOWSSTDIO", "0");
    
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Cannot run macro replay: {}", e))?;
    
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    // Stream output
    let window_clone = window.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit("macro-output", &line);
        }
    });
    
    let window_clone2 = window.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone2.emit("macro-output", &line);
        }
    });
    
    let _ = stdout_handle.await;
    let _ = stderr_handle.await;
    
    let status = child.wait().await
        .map_err(|e| format!("Error waiting for process: {}", e))?;
    
    if status.success() {
        let _ = window.emit("macro-output", "[SUCCESS] Macro replay completed!");
        Ok(MacroResult {
            success: true,
            macro_path,
            message: "Macro replayed successfully".to_string(),
            ai_remaining: None,
            ai_used: None,
        })
    } else {
        let _ = window.emit("macro-output", "[ERROR] Failed to replay macro");
        Err("Failed to replay macro".to_string())
    }
}

/// Delete a macro
#[command]
pub async fn delete_macro(macro_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&macro_path);
    
    if path.exists() && path.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Cannot delete macro: {}", e))?;
        Ok(true)
    } else {
        Err("Macro not found".to_string())
    }
}

/// Export a macro to a zip file
#[command]
pub async fn export_macro(macro_path: String, export_path: String) -> Result<String, String> {
    use std::io::{Read, Write};
    use zip::write::SimpleFileOptions;
    
    let path = PathBuf::from(&macro_path);
    
    if !path.exists() || !path.is_dir() {
        return Err("Macro not found".to_string());
    }
    
    let macro_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("macro");
    
    // Create zip file path
    let zip_path = if export_path.is_empty() {
        let downloads = dirs::download_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")));
        downloads.join(format!("{}.zip", macro_name))
    } else {
        PathBuf::from(&export_path)
    };
    
    let file = fs::File::create(&zip_path)
        .map_err(|e| format!("Cannot create zip file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    
    // Add all files in macro directory
    fn add_dir_to_zip(
        zip: &mut zip::ZipWriter<fs::File>,
        dir: &PathBuf,
        base: &PathBuf,
        options: SimpleFileOptions,
    ) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path.strip_prefix(base)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace("\\", "/");
            
            if path.is_dir() {
                zip.add_directory(&name, options)
                    .map_err(|e| format!("Cannot add directory: {}", e))?;
                add_dir_to_zip(zip, &path, base, options)?;
            } else {
                zip.start_file(&name, options)
                    .map_err(|e| format!("Cannot start file: {}", e))?;
                let mut file = fs::File::open(&path)
                    .map_err(|e| format!("Cannot open file: {}", e))?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)
                    .map_err(|e| format!("Cannot read file: {}", e))?;
                zip.write_all(&buffer)
                    .map_err(|e| format!("Cannot write file: {}", e))?;
            }
        }
        Ok(())
    }
    
    add_dir_to_zip(&mut zip, &path, &path, options)?;
    
    zip.finish()
        .map_err(|e| format!("Cannot finish zip: {}", e))?;
    
    Ok(zip_path.to_string_lossy().to_string())
}

/// Import a macro from a zip file
#[command]
pub async fn import_macro(zip_path: String) -> Result<MacroInfo, String> {
    let zip_file = fs::File::open(&zip_path)
        .map_err(|e| format!("Cannot open zip file: {}", e))?;
    
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Invalid zip file: {}", e))?;
    
    // Check if macro.json exists in the archive
    let has_macro_json = (0..archive.len()).any(|i| {
        archive.by_index(i)
            .map(|f| f.name() == "macro.json" || f.name().ends_with("/macro.json"))
            .unwrap_or(false)
    });
    
    if !has_macro_json {
        return Err("Invalid macro file: macro.json not found".to_string());
    }
    
    // Extract to trajectories directory with unique name
    let trajectories_dir = get_trajectories_dir();
    if !trajectories_dir.exists() {
        fs::create_dir_all(&trajectories_dir)
            .map_err(|e| format!("Cannot create trajectories directory: {}", e))?;
    }
    
    // Generate unique folder name
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let macro_dir = trajectories_dir.join(format!("imported_{}", timestamp));
    fs::create_dir_all(&macro_dir)
        .map_err(|e| format!("Cannot create macro directory: {}", e))?;
    
    // Extract files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Cannot read zip entry: {}", e))?;
        
        let outpath = macro_dir.join(file.name());
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Cannot create directory: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Cannot create parent directory: {}", e))?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Cannot create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Cannot extract file: {}", e))?;
        }
    }
    
    // Read macro info
    let macro_json = macro_dir.join("macro.json");
    let (name, prompt) = if macro_json.exists() {
        fs::read_to_string(&macro_json)
            .ok()
            .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
            .map(|json| {
                let name = json.get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let prompt = json.get("goal")
                    .or_else(|| json.get("prompt"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                (name, prompt)
            })
            .unwrap_or((None, None))
    } else {
        (None, None)
    };
    
    // Count steps
    let steps = fs::read_dir(&macro_dir)
        .map(|entries| {
            entries.flatten()
                .filter(|e| {
                    e.path().extension()
                        .map(|ext| ext == "png")
                        .unwrap_or(false)
                })
                .count() as i32
        })
        .unwrap_or(0);
    
    Ok(MacroInfo {
        name: name.unwrap_or_else(|| format!("imported_{}", timestamp)),
        path: macro_dir.to_string_lossy().to_string(),
        steps,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        prompt,
    })
}

/// Preview a macro - get all screenshots and action details
#[command]
pub async fn preview_macro(macro_path: String) -> Result<MacroPreview, String> {
    let path = PathBuf::from(&macro_path);
    
    if !path.exists() || !path.is_dir() {
        return Err("Macro not found".to_string());
    }
    
    let macro_json_path = path.join("macro.json");
    if !macro_json_path.exists() {
        return Err("macro.json not found".to_string());
    }
    
    // Read macro.json
    let raw_json = fs::read_to_string(&macro_json_path)
        .map_err(|e| format!("Cannot read macro.json: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Get name and goal
    let name = json.get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string()
        });
    
    let goal = json.get("goal")
        .or_else(|| json.get("prompt"))
        .or_else(|| json.get("description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    // Get steps from JSON (if available)
    let json_steps = json.get("steps")
        .or_else(|| json.get("actions"))
        .and_then(|v| v.as_array());
    
    // Find all PNG screenshots and build step info
    let mut steps = Vec::new();
    let mut png_files: Vec<_> = fs::read_dir(&path)
        .map_err(|e| format!("Cannot read macro directory: {}", e))?
        .flatten()
        .filter(|e| {
            e.path().extension()
                .map(|ext| ext == "png")
                .unwrap_or(false)
        })
        .collect();
    
    // Sort by filename (step_0.png, step_1.png, etc.)
    png_files.sort_by(|a, b| {
        let a_name = a.file_name().to_string_lossy().to_string();
        let b_name = b.file_name().to_string_lossy().to_string();
        // Extract number from filename
        let a_num: i32 = a_name.chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);
        let b_num: i32 = b_name.chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);
        a_num.cmp(&b_num)
    });
    
    for (i, entry) in png_files.iter().enumerate() {
        let screenshot_path = entry.path().to_string_lossy().to_string();
        
        // Try to get action info from JSON steps
        let (action, description) = if let Some(json_steps) = json_steps {
            if let Some(step) = json_steps.get(i) {
                let action = step.get("action")
                    .or_else(|| step.get("type"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let desc = step.get("description")
                    .or_else(|| step.get("thought"))
                    .or_else(|| step.get("summary"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                (action, desc)
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };
        
        steps.push(MacroStep {
            step_number: i as i32,
            screenshot_path,
            action,
            description,
        });
    }
    
    let total_steps = steps.len() as i32;
    
    // Get creation time
    let created_at = fs::metadata(&path)
        .and_then(|m| m.created())
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            datetime.format("%Y-%m-%d %H:%M").to_string()
        })
        .unwrap_or_else(|_| "Unknown".to_string());
    
    Ok(MacroPreview {
        name,
        path: macro_path,
        goal,
        steps,
        total_steps,
        created_at,
        raw_json,
    })
}

/// Rename a macro by updating the name field in macro.json
#[command]
pub async fn rename_macro(macro_path: String, new_name: String) -> Result<bool, String> {
    let path = PathBuf::from(&macro_path);
    
    if !path.exists() || !path.is_dir() {
        return Err("Macro not found".to_string());
    }
    
    let macro_json_path = path.join("macro.json");
    if !macro_json_path.exists() {
        return Err("macro.json not found".to_string());
    }
    
    // Read existing JSON
    let content = fs::read_to_string(&macro_json_path)
        .map_err(|e| format!("Cannot read macro.json: {}", e))?;
    
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Update name field
    if let Some(obj) = json.as_object_mut() {
        obj.insert("name".to_string(), serde_json::Value::String(new_name.clone()));
    } else {
        return Err("Invalid macro.json structure".to_string());
    }
    
    // Write back
    let updated_content = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Cannot serialize JSON: {}", e))?;
    
    fs::write(&macro_json_path, updated_content)
        .map_err(|e| format!("Cannot write macro.json: {}", e))?;
    
    Ok(true)
}

/// Get screenshot as base64 for preview
#[command]
pub async fn get_macro_screenshot(screenshot_path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let path = PathBuf::from(&screenshot_path);
    
    if !path.exists() {
        return Err("Screenshot not found".to_string());
    }
    
    let data = fs::read(&path)
        .map_err(|e| format!("Cannot read screenshot: {}", e))?;
    
    let base64_data = STANDARD.encode(&data);
    
    Ok(format!("data:image/png;base64,{}", base64_data))
}
