// MUN SDK AI - Main Library
// Cấu trúc module hóa để dễ bảo trì

#![allow(ambiguous_glob_reexports)]

mod adb;
mod agents;
mod ai_client;
mod batch_executor;
mod config;
mod custom_tools;
mod device_tools;
mod emulator;
mod license;
mod macro_cmd;
mod portal_client;
mod prompt_templates;
mod task;
mod telemetry;
mod trajectory;
mod utils;
mod workflow;

pub use adb::*;
pub use agents::*;
pub use ai_client::*;
pub use batch_executor::*;
pub use config::*;
pub use custom_tools::*;
pub use device_tools::*;
pub use emulator::*;
pub use license::*;
pub use macro_cmd::*;
pub use prompt_templates::*;
pub use task::*;
pub use telemetry::*;
pub use trajectory::*;
pub use utils::*;
pub use workflow::*;

use tauri::Manager;
use tauri::Emitter;
use tauri::command;

// File operations commands
#[command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read file: {}", e))
}

#[command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Cannot write file: {}", e))
}

// Sleep command for reliable delays
#[command]
async fn sleep_ms(ms: u64) -> Result<(), String> {
    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
    Ok(())
}

/// Run a ScripterAgent skill - execute AI-generated Python code from natural language
/// This is the main entry point for "smart" off-device automation tasks
#[command]
async fn run_scripter_skill(
    window: tauri::Window,
    prompt: String,
    device_id: Option<String>,
    inputs: Option<std::collections::HashMap<String, serde_json::Value>>,
    context_vars: Option<std::collections::HashMap<String, serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let device = device_id.unwrap_or_else(|| "none".to_string());
    let input_data = inputs.unwrap_or_default();
    let context_data = context_vars.unwrap_or_default();
    
    println!("[ScripterAgent] Running skill: {}", &prompt[..prompt.len().min(100)]);
    
    // Emit start event
    let _ = window.emit("scripter-skill-start", serde_json::json!({
        "prompt": prompt,
        "device_id": device,
    }));
    
    // Get active AI profile
    let profile = config::get_active_profile()
        .await
        .map_err(|e| format!("No AI profile: {}", e))?
        .ok_or("No active AI profile set")?;
    
    let (base_url, api_key) = config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    // ScripterAgent system prompt - matches scripter_wrapper.py capabilities
    let system_prompt = r#"Bạn là ScripterAgent, một chuyên gia lập trình Python phụ trách xử lý logic "off-device" cho hệ thống tự động hóa DroidRun.

NHIỆM VỤ: Viết mã Python để thực hiện tác vụ được yêu cầu.

MÔI TRƯỜNG THỰC THI - Các biến và hàm có sẵn:
- `inputs`: Dictionary chứa dữ liệu đầu vào
- `context`: Dictionary chứa biến từ các bước trước
- `device_id`: ID thiết bị Android (tham khảo)

HÀM HELPER:
- `get_input(name, default=None)`: Lấy giá trị đầu vào
- `get_context(name, default=None)`: Lấy biến context
- `set_result(key, value)`: LƯU KẾT QUẢ (BẮT BUỘC gọi để trả về dữ liệu)
- `log(message, level="info")`: Ghi log
- `http_get(url, headers=None, timeout=30)`: HTTP GET
- `http_post(url, data=None, json_data=None, headers=None, timeout=30)`: HTTP POST
- `read_json_file(filepath)` / `write_json_file(filepath, data)`: Đọc/ghi JSON
- `read_csv_file(filepath, has_header=True)` / `write_csv_file(filepath, data, headers=None)`: CSV
- `parse_number(text, default=0.0)`: Parse số từ text
- `format_number(num, decimals=2, thousands_sep=",")`: Format số
- `random_delay(min_ms=100, max_ms=500)`: Delay ngẫu nhiên
- `timestamp_now()`: Timestamp hiện tại

THƯ VIỆN: requests, json, csv, re, datetime, math, random, base64, pathlib

QUY TẮC:
1. Chỉ trả về mã Python, KHÔNG markdown
2. Luôn gọi set_result() để lưu kết quả
3. Xử lý lỗi với try/except
4. KHÔNG dùng os, sys, subprocess"#;

    let user_prompt = format!(
        "Context:\n```json\n{}\n```\n\nTask: {}\n\nGenerate Python code:",
        serde_json::to_string_pretty(&serde_json::json!({
            "inputs": input_data,
            "context": context_data,
            "device_id": device,
        })).unwrap_or_default(),
        prompt
    );
    
    // Call LLM to generate Python code
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
        let _ = window.emit("scripter-skill-error", serde_json::json!({
            "error": format!("LLM API error: {}", error_text),
        }));
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
    
    println!("[ScripterAgent] Generated {} bytes of Python code", code.len());
    
    // Emit code generated event
    let _ = window.emit("scripter-skill-code", serde_json::json!({
        "code": code,
        "code_length": code.len(),
    }));
    
    // Execute the generated Python code via scripter_wrapper.py
    let script_result = workflow::run_python_script(
        window.clone(),
        code.clone(),
        input_data,
        context_data,
        device,
    ).await?;
    
    if script_result.success {
        let result = script_result.result.unwrap_or(serde_json::json!({
            "output": script_result.output
        }));
        
        let _ = window.emit("scripter-skill-complete", serde_json::json!({
            "success": true,
            "result": result,
        }));
        
        Ok(result)
    } else {
        let error = script_result.error.unwrap_or_else(|| "Script execution failed".to_string());
        
        let _ = window.emit("scripter-skill-error", serde_json::json!({
            "error": error,
            "output": script_result.output,
        }));
        
        Err(error)
    }
}

/// Execute raw Python code directly (for advanced users)
#[command]
async fn run_scripter_code(
    window: tauri::Window,
    code: String,
    device_id: Option<String>,
    inputs: Option<std::collections::HashMap<String, serde_json::Value>>,
    context_vars: Option<std::collections::HashMap<String, serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let device = device_id.unwrap_or_else(|| "none".to_string());
    let input_data = inputs.unwrap_or_default();
    let context_data = context_vars.unwrap_or_default();
    
    println!("[ScripterAgent] Running raw code ({} bytes)", code.len());
    
    let script_result = workflow::run_python_script(
        window,
        code,
        input_data,
        context_data,
        device,
    ).await?;
    
    if script_result.success {
        Ok(script_result.result.unwrap_or(serde_json::json!({
            "output": script_result.output
        })))
    } else {
        Err(script_result.error.unwrap_or_else(|| "Script execution failed".to_string()))
    }
}

// ============================================
// Smart Skills - Pre-built ScripterAgent tasks
// ============================================

/// Send webhook notification (Telegram, Discord, etc.)
#[command]
async fn send_webhook_notification(
    window: tauri::Window,
    webhook_url: String,
    message: String,
    extra_data: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let script = format!(r#"
import requests
import json

try:
    payload = {{
        "content": {message:?},  # Discord format
        "text": {message:?},     # Slack format
    }}
    
    extra = {extra}
    if extra:
        payload.update(extra)
    
    response = requests.post({url:?}, json=payload, timeout=10)
    response.raise_for_status()
    
    result = {{"success": True, "status_code": response.status_code}}
except Exception as e:
    result = {{"success": False, "error": str(e)}}
"#,
        message = message,
        url = webhook_url,
        extra = serde_json::to_string(&extra_data.unwrap_or(serde_json::json!({}))).unwrap_or_default()
    );
    
    let result = workflow::run_python_script(
        window,
        script,
        std::collections::HashMap::new(),
        std::collections::HashMap::new(),
        "none".to_string(),
    ).await;
    
    match result {
        Ok(r) => Ok(r.result.unwrap_or(serde_json::json!({"success": true}))),
        Err(e) => Err(e),
    }
}

/// Extract OTP from text using regex patterns
#[command]
async fn extract_otp_from_text(
    window: tauri::Window,
    text: String,
    pattern: Option<String>,
) -> Result<serde_json::Value, String> {
    let script = format!(r#"
import re

text = {text:?}
pattern = {pattern:?} or r'\b(\d{{4,8}})\b'

try:
    matches = re.findall(pattern, text)
    
    # Filter likely OTPs (4-8 digits, not years like 2024)
    otps = []
    for m in matches:
        if isinstance(m, tuple):
            m = m[0] if m else ""
        if m.isdigit() and 4 <= len(m) <= 8:
            # Skip year-like numbers
            if not (len(m) == 4 and m.startswith('20')):
                otps.append(m)
    
    result = {{
        "success": True,
        "otps": otps,
        "first_otp": otps[0] if otps else None,
        "count": len(otps)
    }}
except Exception as e:
    result = {{"success": False, "error": str(e)}}
"#,
        text = text,
        pattern = pattern.unwrap_or_default()
    );
    
    let result = workflow::run_python_script(
        window,
        script,
        std::collections::HashMap::new(),
        std::collections::HashMap::new(),
        "none".to_string(),
    ).await;
    
    match result {
        Ok(r) => Ok(r.result.unwrap_or(serde_json::json!({"success": false}))),
        Err(e) => Err(e),
    }
}

/// Call external REST API with ScripterAgent
#[command]
async fn call_rest_api(
    window: tauri::Window,
    url: String,
    method: Option<String>,
    headers: Option<serde_json::Value>,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let method_str = method.unwrap_or_else(|| "GET".to_string());
    let headers_json = serde_json::to_string(&headers.unwrap_or(serde_json::json!({}))).unwrap_or_default();
    let body_json = serde_json::to_string(&body.unwrap_or(serde_json::json!({}))).unwrap_or_default();
    
    let script = format!(r#"
import requests
import json

try:
    url = {url:?}
    method = {method:?}
    headers = json.loads({headers:?})
    body = json.loads({body:?})
    
    if method.upper() == "GET":
        response = requests.get(url, headers=headers, params=body, timeout=30)
    elif method.upper() == "POST":
        response = requests.post(url, headers=headers, json=body, timeout=30)
    elif method.upper() == "PUT":
        response = requests.put(url, headers=headers, json=body, timeout=30)
    elif method.upper() == "DELETE":
        response = requests.delete(url, headers=headers, timeout=30)
    else:
        raise ValueError(f"Unsupported method: {{method}}")
    
    try:
        data = response.json()
    except:
        data = response.text
    
    result = {{
        "success": response.ok,
        "status_code": response.status_code,
        "data": data
    }}
except Exception as e:
    result = {{"success": False, "error": str(e)}}
"#,
        url = url,
        method = method_str,
        headers = headers_json,
        body = body_json
    );
    
    let result = workflow::run_python_script(
        window,
        script,
        std::collections::HashMap::new(),
        std::collections::HashMap::new(),
        "none".to_string(),
    ).await;
    
    match result {
        Ok(r) => Ok(r.result.unwrap_or(serde_json::json!({"success": false}))),
        Err(e) => Err(e),
    }
}

/// Extract structured data from text using LLM with custom JSON schema
/// Flexible alternative to extract_otp_from_text - supports any schema
#[command]
async fn extract_structured_data(
    window: tauri::Window,
    text: String,
    schema: serde_json::Value,
    description: Option<String>,
) -> Result<serde_json::Value, String> {
    // ============ LICENSE CHECK ============
    match crate::license::check_and_use_ai_request("structured_extract").await {
        Ok(remaining) => {
            log::info!("[StructuredExtract] AI request approved. Remaining: {}", remaining);
        }
        Err(e) => {
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": format!("AI limit: {}", e),
            }));
            return Err(format!("AI request limit: {}", e));
        }
    }
    // =======================================
    
    // Emit start event
    let _ = window.emit("structured-extract-start", serde_json::json!({
        "text_length": text.len(),
        "schema": schema,
        "description": description,
    }));
    
    // Get active AI profile
    let profile = config::get_active_profile()
        .await
        .map_err(|e| {
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": format!("No AI profile: {}", e),
            }));
            format!("No AI profile: {}", e)
        })?
        .ok_or_else(|| {
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": "No active AI profile set",
            }));
            "No active AI profile set".to_string()
        })?;
    
    let (base_url, api_key) = config::get_provider_credentials(
        &profile.provider.name,
        &profile.provider.base_url,
        &profile.provider.api_key,
    );
    
    let schema_str = serde_json::to_string_pretty(&schema).unwrap_or_default();
    let context_str = description.unwrap_or_else(|| "No additional context provided.".to_string());
    
    let system_prompt = format!(r#"You are a data extraction specialist. Extract information from the given text and return a JSON object matching the provided schema.

SCHEMA:
{}

TEXT:
{}

CONTEXT:
{}

Return ONLY valid JSON matching the schema. No explanations."#,
        schema_str,
        text,
        context_str
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
                {"role": "system", "content": "You are a data extraction specialist. Return ONLY valid JSON, no explanations."},
                {"role": "user", "content": system_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 2000
        }))
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("LLM request failed: {}", e);
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": error_msg,
            }));
            error_msg
        })?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        let _ = window.emit("structured-extract-error", serde_json::json!({
            "error": format!("LLM API error: {}", error_text),
        }));
        return Err(format!("LLM API error: {}", error_text));
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| {
            let error_msg = format!("Failed to parse response: {}", e);
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": error_msg,
            }));
            error_msg
        })?;
    
    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| {
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": "No content in response",
            }));
            "No content in response".to_string()
        })?;
    
    // Clean up markdown code blocks if present
    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    
    // Parse the JSON result
    let extracted: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| {
            // Truncate raw_response to prevent leaking sensitive data
            let truncated_raw: String = json_str.chars().take(500).collect();
            let error_msg = format!("Invalid JSON from LLM: {}", e);
            let _ = window.emit("structured-extract-error", serde_json::json!({
                "error": error_msg,
                "raw_response_preview": if json_str.len() > 500 { 
                    format!("{}...[truncated]", truncated_raw) 
                } else { 
                    truncated_raw 
                },
            }));
            format!("{} - Raw preview: {}", error_msg, json_str.chars().take(200).collect::<String>())
        })?;
    
    // Emit success event
    let _ = window.emit("structured-extract-complete", serde_json::json!({
        "success": true,
        "data": extracted,
    }));
    
    Ok(serde_json::json!({
        "success": true,
        "data": extracted
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())

        .setup(|app| {
            // Log khởi động
            log::info!("MUN SDK AI đang khởi động...");

            // Initialize telemetry (check env var)
            telemetry::init_telemetry();

            // Load config và set paths
            if let Ok(config) = config::load_config_sync() {
                if let Some(ref path) = config.settings.emulator_path {
                    emulator::set_emulator_path(path.clone());
                }
                if let Some(ref path) = config.settings.bluestacks_path {
                    emulator::set_bluestacks_path(path.clone());
                }
                if let Some(ref path) = config.settings.scrcpy_path {
                    adb::set_scrcpy_path(path.clone());
                }
            }

            // Lấy window chính
            if let Some(window) = app.get_webview_window("main") {
                // Set title
                let _ = window.set_title("MUN SDK AI");

                #[cfg(debug_assertions)]
                {
                    // Mở DevTools trong development mode
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ADB commands
            adb::run_adb_command,
            adb::get_connected_devices,
            adb::adb_connect,
            adb::adb_disconnect,
            adb::test_adb,
            adb::check_apk_installed,
            adb::install_apk,
            adb::take_screenshot,
            // New ADB commands (simplified)
            adb::auto_connect_emulators,
            adb::scan_emulator_ports,
            adb::wake_device,
            adb::launch_scrcpy,
            adb::check_droidrun_portal,     // Check: droidrun ping
            adb::setup_droidrun_portal,     // Install: droidrun setup
            adb::get_emulator_ports,
            adb::restart_adb_server,
            // File commands
            read_file,
            write_file,
            sleep_ms,
            // ScripterAgent commands
            run_scripter_skill,
            run_scripter_code,
            // Smart Skills
            send_webhook_notification,
            extract_otp_from_text,
            call_rest_api,
            extract_structured_data,
            // Custom Tools commands
            custom_tools::list_custom_tools,
            custom_tools::run_custom_tool,
            custom_tools::get_custom_tools_prompt,
            custom_tools::reload_custom_tools_cmd,
            // AI Client commands (centralized LLM calls with tracing)
            ai_client::ai_chat_completion,
            ai_client::ai_generate_python,
            ai_client::ai_extract_data,
            ai_client::send_telemetry,
            // Telemetry commands
            telemetry::send_telemetry_event,
            telemetry::is_telemetry_enabled_cmd,
            telemetry::get_telemetry_status,
            // License commands
            license::check_license,
            license::activate_license,
            license::logout_license,
            license::use_ai_request,
            license::get_ai_request_status,
            // Config commands
            config::load_config,
            config::save_config,
            config::create_profile,
            config::update_profile,
            config::delete_profile,
            config::set_active_profile,
            config::get_active_profile,
            config::update_settings,
            // Task commands
            task::create_task,
            task::run_task,
            task::ping_provider,
            task::run_parallel_tasks,
            task::cancel_task,
            task::schedule_task,
            task::run_scheduled_task,
            task::enhance_prompt,
            task::generate_skill,
            task::generate_workflow,
            task::generate_clarifying_questions,
            task::analyze_screen_for_action,
            // Utils commands
            utils::check_python_installed,
            utils::get_python_version,
            utils::get_droidrun_version,
            utils::install_python,
            utils::install_droidrun_package,
            utils::install_openai_like,
            utils::update_droidrun_package,
            utils::update_openai_like,
            utils::install_droidrun,
            utils::open_url,
            utils::get_system_info,
            utils::check_adb_installed,
            utils::get_adb_version,
            utils::check_all_prerequisites,
            // Macro commands
            macro_cmd::list_macros,
            macro_cmd::record_macro,
            macro_cmd::replay_macro,
            macro_cmd::delete_macro,
            macro_cmd::export_macro,
            macro_cmd::import_macro,
            macro_cmd::preview_macro,
            macro_cmd::rename_macro,
            macro_cmd::get_macro_screenshot,
            // Emulator commands
            emulator::get_emulator_instances,
            emulator::launch_emulator,
            emulator::shutdown_emulator,
            emulator::connect_emulator_adb,
            emulator::launch_and_connect_emulator,
            emulator::check_mumu_installed,
            emulator::get_mumu_path,
            emulator::set_emulator_path,
            emulator::get_emulator_path,
            emulator::set_bluestacks_path,
            emulator::get_bluestacks_path,
            // MuMu management commands
            emulator::create_mumu_instance,
            emulator::clone_mumu_instance,
            emulator::delete_mumu_instance,
            emulator::rename_mumu_instance,
            // BlueStacks commands
            emulator::check_bluestacks_installed,
            emulator::get_bluestacks_instances,
            emulator::launch_bluestacks,
            emulator::shutdown_bluestacks,
            emulator::get_all_emulator_instances,
            // Workflow commands
            workflow::run_python_script,
            workflow::run_workflow,
            workflow::run_workflow_python,
            workflow::calibrate_workflow,
            workflow::record_workflow,
            workflow::execute_actions,
            workflow::run_droidrun_task,
            // Custom tools commands
            custom_tools::list_custom_tools,
            custom_tools::run_custom_tool,
            custom_tools::get_custom_tools_prompt,
            // Batch Executor commands (Multi-device)
            batch_executor::start_batch_execution,
            batch_executor::cancel_batch_execution,
            batch_executor::get_batch_status,
            batch_executor::get_running_batches,
            batch_executor::get_available_devices_for_batch,
            batch_executor::run_workflow_on_all_devices,
            batch_executor::run_workflow_on_devices,
            // Trajectory commands (Debug & Playback)
            trajectory::list_trajectories_cmd,
            trajectory::load_trajectory_cmd,
            trajectory::delete_trajectory_cmd,
            trajectory::get_trajectory_screenshot_path,
            // Device Tools commands (Standardized Device Control)
            device_tools::create_android_tools,
            device_tools::device_tap_by_index,
            device_tools::device_swipe,
            device_tools::device_get_state,
            device_tools::start_trajectory_recording,
            device_tools::stop_trajectory_recording,
            // Multi-Agent System commands
            agents::run_agent_task,
            // Prompt Templates commands
            prompt_templates::render_agent_prompt,
            prompt_templates::get_default_prompts,
            prompt_templates::validate_prompt_template,
        ])
        .run(tauri::generate_context!())
        .expect("Lỗi khởi chạy ứng dụng Tauri");
}
