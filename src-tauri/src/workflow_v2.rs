// Workflow Engine v2 - Sử dụng Portal Client thay vì ADB
// File này demo cách tích hợp Portal Client vào workflow engine

use crate::portal_client::{PortalClient, create_portal_client};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, Emitter};

// Import các types từ workflow.rs
pub use crate::workflow::{
    WorkflowDefinition, WorkflowStep, WorkflowContext, WorkflowResult, WorkflowLog
};

/// Calculate humanlike delay based on action context
/// This simulates natural human timing patterns
fn calculate_humanlike_delay(prev_action: &str, next_action: &str, context: &str) -> u64 {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    
    // Base delay ranges for different action transitions (in ms)
    let (base_min, base_max) = match (prev_action, next_action) {
        // After tap, reading/thinking time before next action
        ("tap", "tap") => (300, 800),
        ("tap", "swipe") => (500, 1200),
        ("tap", "input_text") => (400, 1000),
        
        // After swipe (viewing new content)
        ("swipe", "tap") => (800, 2000),  // Looking at new content
        ("swipe", "swipe") => (1500, 4000), // Browsing/scrolling
        ("swipe_up", "swipe_up") => (1000, 3000),
        ("swipe_up", "tap") => (500, 1500),
        
        // After typing (reviewing/thinking)
        ("input_text", "tap") => (300, 700),
        ("type", "tap") => (300, 700),
        
        // After opening app (loading time)
        ("open_app", _) => (2000, 4000),
        ("start_app", _) => (2000, 4000),
        
        // Navigation actions
        ("back", _) => (500, 1200),
        ("home", _) => (800, 1500),
        
        // Default human-like pause
        _ => (500, 1500),
    };
    
    // Adjust based on context hints
    let (adj_min, adj_max) = if context.contains("fast") || context.contains("quick") {
        (base_min / 2, base_max / 2)
    } else if context.contains("slow") || context.contains("careful") {
        (base_min * 2, base_max * 2)
    } else if context.contains("browse") || context.contains("scroll") {
        (base_min + 500, base_max + 1000)
    } else {
        (base_min, base_max)
    };
    
    // Add natural variance (gaussian-like distribution using multiple random samples)
    let r1 = rng.gen_range(adj_min..=adj_max);
    let r2 = rng.gen_range(adj_min..=adj_max);
    let r3 = rng.gen_range(adj_min..=adj_max);
    
    // Average of 3 samples creates more natural bell-curve distribution
    (r1 + r2 + r3) / 3
}

/// Extended WorkflowContext với Portal Client
pub struct WorkflowContextV2 {
    /// Input values provided by user
    pub inputs: HashMap<String, serde_json::Value>,
    
    /// Runtime variables
    pub variables: HashMap<String, serde_json::Value>,
    
    /// Device ID 
    pub device_id: String,
    
    /// Current step being executed
    pub current_step_id: Option<String>,
    
    /// Execution logs
    pub logs: Vec<WorkflowLog>,
    
    /// Portal Client for HTTP REST API calls
    pub portal: Option<PortalClient>,
    
    /// Use Portal (true) or fallback to ADB (false)
    pub use_portal: bool,
}

impl WorkflowContextV2 {
    /// Tạo context mới với Portal Client
    pub async fn new(device_id: &str, inputs: HashMap<String, serde_json::Value>) -> Self {
        // Try to create Portal client
        let (portal, use_portal) = match create_portal_client(device_id).await {
            Ok(client) => {
                println!("[WORKFLOW-V2] Portal client connected ✓");
                (Some(client), true)
            }
            Err(e) => {
                println!("[WORKFLOW-V2] Portal not available: {}, using ADB fallback", e);
                (None, false)
            }
        };
        
        Self {
            inputs,
            variables: HashMap::new(),
            device_id: device_id.to_string(),
            current_step_id: None,
            logs: vec![],
            portal,
            use_portal,
        }
    }
    
    /// Add log entry
    pub fn add_log(&mut self, level: &str, step_id: Option<&str>, message: &str) {
        self.logs.push(WorkflowLog {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.to_string(),
            step_id: step_id.map(|s| s.to_string()),
            message: message.to_string(),
        });
    }
}

/// Execute action step using Portal Client (nếu có) hoặc ADB (fallback)
pub async fn execute_action_v2(
    context: &mut WorkflowContextV2,
    step: &WorkflowStep,
) -> Result<(), String> {
    let action = step.action.as_ref().ok_or("Missing action field")?;
    
    // Get and compile params
    let params = get_compiled_params(step, context);
    
    println!("[WORKFLOW-V2] Action: {} | Params: {:?} | Portal: {}", 
        action, params, context.use_portal);
    
    // Try Portal first, fallback to ADB if needed
    if context.use_portal {
        if let Some(ref portal) = context.portal {
            return execute_via_portal(portal, action, &params).await;
        }
    }
    
    // Fallback to ADB
    execute_via_adb(&context.device_id, action, &params).await
}

/// Execute action via Portal HTTP API (FAST)
async fn execute_via_portal(
    portal: &PortalClient,
    action: &str,
    params: &HashMap<String, String>,
) -> Result<(), String> {
    println!("[PORTAL] Executing: {}", action);
    
    match action {
        "tap" => {
            if let Some(text) = params.get("text") {
                // Tap by text (tìm element theo text)
                portal.tap_element_by_text(text).await?;
            } else {
                let x: i32 = params.get("x").and_then(|s| s.parse().ok()).unwrap_or(540);
                let y: i32 = params.get("y").and_then(|s| s.parse().ok()).unwrap_or(1200);
                portal.tap(x, y).await?;
            }
        }
        
        "tap_index" | "tap_by_index" => {
            let index: i32 = params.get("index").and_then(|s| s.parse().ok()).unwrap_or(0);
            portal.tap_by_index(index).await?;
        }
        
        "swipe" => {
            let x1: i32 = params.get("x1").and_then(|s| s.parse().ok()).unwrap_or(500);
            let y1: i32 = params.get("y1").and_then(|s| s.parse().ok()).unwrap_or(1500);
            let x2: i32 = params.get("x2").and_then(|s| s.parse().ok()).unwrap_or(500);
            let y2: i32 = params.get("y2").and_then(|s| s.parse().ok()).unwrap_or(500);
            let duration: i32 = params.get("duration").and_then(|s| s.parse().ok()).unwrap_or(300);
            portal.swipe(x1, y1, x2, y2, duration).await?;
        }
        
        "swipe_up" => portal.swipe_up().await?,
        "swipe_down" => portal.swipe_down().await?,
        "swipe_left" => portal.swipe_left().await?,
        "swipe_right" => portal.swipe_right().await?,
        
        "input_text" | "type" => {
            let text = params.get("text").cloned().unwrap_or_default();
            let clear = params.get("clear").map(|s| s == "true").unwrap_or(false);
            let index = params.get("index").and_then(|s| s.parse().ok());
            portal.input_text(&text, index, clear).await?;
        }
        
        "back" => portal.back().await?,
        "home" => portal.home().await?,
        "enter" => portal.enter().await?,
        
        "open_app" | "start_app" => {
            let package = params.get("package").ok_or("Missing package param")?;
            let activity = params.get("activity").map(|s| s.as_str());
            portal.start_app(package, activity).await?;
        }
        
        "press_key" => {
            let keycode: i32 = params.get("keycode").and_then(|s| s.parse().ok()).unwrap_or(4);
            portal.press_key(keycode).await?;
        }
        
        _ => {
            return Err(format!("Unknown action: {}", action));
        }
    }
    
    Ok(())
}

/// Execute action via ADB (FALLBACK - slower)
async fn execute_via_adb(
    device_id: &str,
    action: &str,
    params: &HashMap<String, String>,
) -> Result<(), String> {
    use tokio::process::Command;
    
    println!("[ADB] Executing: {} (fallback)", action);
    
    let args: Vec<String> = match action {
        "tap" => {
            let x = params.get("x").cloned().unwrap_or_else(|| "540".to_string());
            let y = params.get("y").cloned().unwrap_or_else(|| "1200".to_string());
            vec!["shell".to_string(), "input".to_string(), "tap".to_string(), x, y]
        }
        
        "swipe" => {
            let x1 = params.get("x1").cloned().unwrap_or_else(|| "500".to_string());
            let y1 = params.get("y1").cloned().unwrap_or_else(|| "1500".to_string());
            let x2 = params.get("x2").cloned().unwrap_or_else(|| "500".to_string());
            let y2 = params.get("y2").cloned().unwrap_or_else(|| "500".to_string());
            let dur = params.get("duration").cloned().unwrap_or_else(|| "300".to_string());
            vec!["shell".to_string(), "input".to_string(), "swipe".to_string(), x1, y1, x2, y2, dur]
        }
        
        "swipe_up" => {
            vec!["shell".to_string(), "input".to_string(), "swipe".to_string(), 
                 "500".to_string(), "1500".to_string(), "500".to_string(), "500".to_string(), "300".to_string()]
        }
        
        "swipe_down" => {
            vec!["shell".to_string(), "input".to_string(), "swipe".to_string(),
                 "500".to_string(), "500".to_string(), "500".to_string(), "1500".to_string(), "300".to_string()]
        }
        
        "input_text" | "type" => {
            let text = params.get("text").cloned().unwrap_or_default();
            let escaped = text.replace(" ", "%s");
            vec!["shell".to_string(), "input".to_string(), "text".to_string(), escaped]
        }
        
        "back" => {
            vec!["shell".to_string(), "input".to_string(), "keyevent".to_string(), "KEYCODE_BACK".to_string()]
        }
        
        "home" => {
            vec!["shell".to_string(), "input".to_string(), "keyevent".to_string(), "KEYCODE_HOME".to_string()]
        }
        
        "open_app" | "start_app" => {
            let package = params.get("package").cloned().unwrap_or_default();
            vec!["shell".to_string(), "monkey".to_string(), "-p".to_string(), package, "1".to_string()]
        }
        
        _ => {
            return Err(format!("Unknown action for ADB fallback: {}", action));
        }
    };
    
    // Build ADB command
    let mut cmd = Command::new("adb");
    cmd.arg("-s").arg(device_id);
    cmd.args(&args);
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output().await
        .map_err(|e| format!("ADB error: {}", e))?;
    
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("ADB command failed: {}", stderr))
    }
}

/// Get compiled params từ step
fn get_compiled_params(
    step: &WorkflowStep, 
    context: &WorkflowContextV2
) -> HashMap<String, String> {
    step.params.as_ref()
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
        .unwrap_or_default()
}

/// Compile template value - replace {{variable}} with actual values
fn compile_value(template: &str, context: &WorkflowContextV2) -> String {
    let mut result = template.to_string();
    
    // Replace inputs
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
    
    // Replace variables
    for (key, value) in &context.variables {
        let placeholder = format!("{{{{{}}}}}", key);
        let value_str = match value {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Object(obj) => {
                // Handle nested like {{result.key}}
                for (sub_key, sub_value) in obj {
                    let nested = format!("{{{{{}.{}}}}}", key, sub_key);
                    let sub_str = match sub_value {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::Bool(b) => b.to_string(),
                        _ => sub_value.to_string(),
                    };
                    result = result.replace(&nested, &sub_str);
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
// Example Usage
// ============================================

/// Run workflow với Portal Client (command cho frontend)
#[command]
pub async fn run_workflow_v2(
    window: tauri::Window,
    workflow: WorkflowDefinition,
    inputs: HashMap<String, serde_json::Value>,
    device_id: String,
) -> Result<WorkflowResult, String> {
    println!("[WORKFLOW-V2] Starting: {} on device: {}", workflow.name, device_id);
    let start_time = std::time::Instant::now();
    
    // Create context with Portal Client
    let mut context = WorkflowContextV2::new(&device_id, inputs).await;
    
    context.add_log("info", None, &format!("🚀 Starting workflow: {}", workflow.name));
    context.add_log("info", None, &format!("📡 Using Portal: {}", context.use_portal));
    
    // Emit start event
    let _ = window.emit("workflow-start", serde_json::json!({
        "workflow_id": workflow.id,
        "workflow_name": workflow.name,
        "device_id": device_id,
        "use_portal": context.use_portal,
    }));
    
    // Execute steps
    let mut error: Option<String> = None;
    
    for step in &workflow.steps {
        context.current_step_id = Some(step.id.clone());
        
        context.add_log("info", Some(&step.id), 
            &format!("▶️ Step: {}", step.name.as_deref().unwrap_or(&step.step_type)));
        
        // Emit step event
        let _ = window.emit("workflow-step", serde_json::json!({
            "step_id": step.id,
            "step_type": step.step_type,
            "step_name": step.name,
            "status": "running",
        }));
        
        // Execute step based on type
        let result = match step.step_type.as_str() {
            "action" => execute_action_v2(&mut context, step).await,
            "wait" => {
                let duration_str = step.duration.as_deref().unwrap_or("1000");
                let compiled = compile_value(duration_str, &context);
                let duration_ms: u64 = compiled.parse().unwrap_or(1000);
                println!("[WORKFLOW-V2] Wait {}ms", duration_ms);
                tokio::time::sleep(tokio::time::Duration::from_millis(duration_ms)).await;
                Ok(())
            }
            "random_wait" => {
                // Parse min/max từ params
                let min_str = step.params.as_ref()
                    .and_then(|p| p.get("min"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("1000");
                let max_str = step.params.as_ref()
                    .and_then(|p| p.get("max"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("3000");
                
                let min: u64 = compile_value(min_str, &context).parse().unwrap_or(1000);
                let max: u64 = compile_value(max_str, &context).parse().unwrap_or(3000);
                
                use rand::Rng;
                let delay = rand::thread_rng().gen_range(min..=max);
                println!("[WORKFLOW-V2] Random wait {}ms (range: {}-{})", delay, min, max);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                Ok(())
            }
            "ai_wait" => {
                // AI-powered humanlike delay based on context
                let prev_action = step.params.as_ref()
                    .and_then(|p| p.get("prev_action"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let next_action = step.params.as_ref()
                    .and_then(|p| p.get("next_action"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let context_hint = step.params.as_ref()
                    .and_then(|p| p.get("context"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                
                // Calculate humanlike delay based on action types
                let delay = calculate_humanlike_delay(prev_action, next_action, context_hint);
                println!("[WORKFLOW-V2] AI wait {}ms (prev: {}, next: {})", delay, prev_action, next_action);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                Ok(())
            }
            // Add more step types as needed...
            _ => {
                Err(format!("Step type '{}' not implemented in V2 yet", step.step_type))
            }
        };
        
        match result {
            Ok(()) => {
                context.add_log("success", Some(&step.id), "✓ Step completed");
                let _ = window.emit("workflow-step", serde_json::json!({
                    "step_id": step.id,
                    "status": "completed",
                }));
                
                // ✅ CRITICAL: Add delay after action steps to ensure device responsiveness
                if step.step_type == "action" {
                    // Use custom delay if specified, otherwise default to 800ms
                    let base_delay = step.delay_after.unwrap_or(800);
                    
                    // Add ±15% variance for more human-like timing
                    use rand::Rng;
                    let variance = (base_delay as f64 * 0.15) as u64;
                    let min_delay = base_delay.saturating_sub(variance);
                    let max_delay = base_delay + variance;
                    let actual_delay = rand::thread_rng().gen_range(min_delay..=max_delay);
                    
                    println!("[WORKFLOW-V2] Delay {}ms (base: {}ms ±15%)", actual_delay, base_delay);
                    tokio::time::sleep(tokio::time::Duration::from_millis(actual_delay)).await;
                }
            }
            Err(e) => {
                context.add_log("error", Some(&step.id), &format!("✗ Error: {}", e));
                let _ = window.emit("workflow-step", serde_json::json!({
                    "step_id": step.id,
                    "status": "failed",
                    "error": e.clone(),
                }));
                error = Some(e);
                break;
            }
        }
    }
    
    let duration_ms = start_time.elapsed().as_millis() as i64;
    let success = error.is_none();
    
    if success {
        context.add_log("success", None, &format!("✅ Workflow completed in {}ms", duration_ms));
    } else {
        context.add_log("error", None, &format!("❌ Workflow failed: {:?}", error));
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
        outputs: context.variables,
        logs: context.logs,
        duration_ms,
        error,
    })
}
