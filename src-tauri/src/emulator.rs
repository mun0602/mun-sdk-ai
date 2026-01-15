// Emulator Module - Quản lý Android Emulators (MuMu, LDPlayer, etc.)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Global custom emulator path
static CUSTOM_EMULATOR_PATH: Mutex<Option<String>> = Mutex::new(None);
static CUSTOM_BLUESTACKS_PATH: Mutex<Option<String>> = Mutex::new(None);

/// Set custom MuMu emulator path from settings
#[command]
pub fn set_emulator_path(path: String) {
    let mut custom_path = CUSTOM_EMULATOR_PATH.lock().unwrap();
    if path.is_empty() {
        *custom_path = None;
    } else {
        *custom_path = Some(path);
    }
}

/// Get current MuMu emulator path
#[command]
pub fn get_emulator_path() -> Option<String> {
    let custom_path = CUSTOM_EMULATOR_PATH.lock().unwrap();
    if let Some(ref path) = *custom_path {
        return Some(path.clone());
    }
    detect_mumu_path()
}

/// Set custom BlueStacks path from settings
#[command]
pub fn set_bluestacks_path(path: String) {
    let mut custom_path = CUSTOM_BLUESTACKS_PATH.lock().unwrap();
    if path.is_empty() {
        *custom_path = None;
    } else {
        *custom_path = Some(path);
    }
}

/// Get current BlueStacks path
#[command]
pub fn get_bluestacks_path() -> Option<String> {
    let custom_path = CUSTOM_BLUESTACKS_PATH.lock().unwrap();
    if let Some(ref path) = *custom_path {
        return Some(path.clone());
    }
    detect_bluestacks_path()
}

/// Helper to create a command with hidden window on Windows
fn new_command(program: &str) -> Command {
    let cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmulatorInstance {
    pub index: String,
    pub name: String,
    pub is_running: bool,
    pub is_android_started: bool,
    pub adb_port: Option<u16>,
    pub adb_host: Option<String>,
    pub player_state: Option<String>,
    pub pid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmulatorConfig {
    pub emulator_type: String, // "mumu", "ldplayer", "nox", etc.
    pub manager_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmulatorResult {
    pub success: bool,
    pub message: String,
    pub instances: Option<Vec<EmulatorInstance>>,
}

/// Default MuMu path - can be customized via settings
const DEFAULT_MUMU_PATH: &str = r"C:\NetEase\MuMu\nx_main\MuMuManager.exe";

/// Detect MuMu installation path from registry or common locations
fn detect_mumu_path() -> Option<String> {
    // Check custom path first
    {
        let custom_path = CUSTOM_EMULATOR_PATH.lock().unwrap();
        if let Some(ref path) = *custom_path {
            // If custom path is a directory, look for MuMuManager.exe inside
            let manager_path = if std::path::Path::new(path).is_dir() {
                format!("{}\\MuMuManager.exe", path)
            } else {
                path.clone()
            };
            if std::path::Path::new(&manager_path).exists() {
                return Some(manager_path);
            }
        }
    }

    // Try registry first
    #[cfg(windows)]
    {
        let output = new_command("reg")
            .args([
                "query",
                r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MuMuPlayer",
                "/v",
                "DisplayIcon",
            ])
            .output();

        if let Ok(result) = output {
            let stdout = String::from_utf8_lossy(&result.stdout);
            // Parse registry output to get path
            for line in stdout.lines() {
                if line.contains("DisplayIcon") {
                    // Extract path from: DisplayIcon    REG_SZ    "D:\NetEase\MuMu\..."
                    if let Some(path_start) = line.find('"') {
                        let path = &line[path_start + 1..];
                        if let Some(path_end) = path.find('"') {
                            let icon_path = &path[..path_end];
                            // Convert icon path to MuMuManager path
                            if let Some(nx_main_pos) = icon_path.find("nx_main") {
                                let base_path = &icon_path[..nx_main_pos + 7];
                                let manager_path = format!("{}\\MuMuManager.exe", base_path);
                                if std::path::Path::new(&manager_path).exists() {
                                    return Some(manager_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback to default path
    if std::path::Path::new(DEFAULT_MUMU_PATH).exists() {
        return Some(DEFAULT_MUMU_PATH.to_string());
    }

    // Try common paths
    let common_paths = [
        r"C:\Program Files\Netease\MuMu\nx_main\MuMuManager.exe",
        r"D:\Program Files\Netease\MuMu\nx_main\MuMuManager.exe",
        r"C:\NetEase\MuMu\nx_main\MuMuManager.exe",
    ];

    for path in common_paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    None
}

/// Detect BlueStacks installation path
fn detect_bluestacks_path() -> Option<String> {
    // Check custom path first
    {
        let custom_path = CUSTOM_BLUESTACKS_PATH.lock().unwrap();
        if let Some(ref path) = *custom_path {
            let bstk_path = if std::path::Path::new(path).is_dir() {
                path.clone()
            } else {
                std::path::Path::new(path)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or(path.clone())
            };
            let vmmgr = format!("{}\\BstkVMMgr.exe", bstk_path);
            if std::path::Path::new(&vmmgr).exists() {
                return Some(bstk_path);
            }
        }
    }

    // Try common paths
    let common_paths = [
        r"C:\Program Files\BlueStacks_nxt",
        r"D:\Program Files\BlueStacks_nxt",
        r"C:\Program Files (x86)\BlueStacks_nxt",
    ];

    for path in common_paths {
        let vmmgr = format!("{}\\BstkVMMgr.exe", path);
        if std::path::Path::new(&vmmgr).exists() {
            return Some(path.to_string());
        }
    }

    None
}

/// Get list of all MuMu emulator instances
#[command]
pub async fn get_emulator_instances() -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    let output = new_command(&mumu_path)
        .args(["info", "--vmindex", "all"])
        .output()
        .map_err(|e| format!("Không thể chạy MuMuManager: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse JSON response
    let json: HashMap<String, serde_json::Value> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Không thể parse JSON: {} - Output: {}", e, stdout))?;

    let mut instances = Vec::new();

    for (index, info) in json.iter() {
        let instance = EmulatorInstance {
            index: index.clone(),
            name: info.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
            is_running: info.get("is_process_started").and_then(|v| v.as_bool()).unwrap_or(false),
            is_android_started: info.get("is_android_started").and_then(|v| v.as_bool()).unwrap_or(false),
            adb_port: info.get("adb_port").and_then(|v| v.as_u64()).map(|v| v as u16),
            adb_host: info.get("adb_host_ip").and_then(|v| v.as_str()).map(|s| s.to_string()),
            player_state: info.get("player_state").and_then(|v| v.as_str()).map(|s| s.to_string()),
            pid: info.get("pid").and_then(|v| v.as_u64()).map(|v| v as u32),
        };
        instances.push(instance);
    }

    // Sort by index
    instances.sort_by(|a, b| {
        a.index.parse::<i32>().unwrap_or(0).cmp(&b.index.parse::<i32>().unwrap_or(0))
    });

    Ok(EmulatorResult {
        success: true,
        message: format!("Tìm thấy {} emulator(s)", instances.len()),
        instances: Some(instances),
    })
}

/// Launch emulator instance(s) by index
/// vmindex can be: "0", "1", "0,1,2", "all"
#[command]
pub async fn launch_emulator(vmindex: String) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Launching instance(s): {}", vmindex);

    let output = new_command(&mumu_path)
        .args(["control", "--vmindex", &vmindex, "launch"])
        .output()
        .map_err(|e| format!("Không thể khởi động emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Check result
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0");

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã khởi động emulator: {}", vmindex)
        } else {
            format!("Lỗi khởi động emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Shutdown emulator instance(s) by index
#[command]
pub async fn shutdown_emulator(vmindex: String) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Shutting down instance(s): {}", vmindex);

    let output = new_command(&mumu_path)
        .args(["control", "--vmindex", &vmindex, "shutdown"])
        .output()
        .map_err(|e| format!("Không thể tắt emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0");

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã tắt emulator: {}", vmindex)
        } else {
            format!("Lỗi tắt emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Create new MuMu emulator instance(s)
#[command]
pub async fn create_mumu_instance(count: u32) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Creating {} new instance(s)", count);

    let output = new_command(&mumu_path)
        .args(["create", "-n", &count.to_string()])
        .output()
        .map_err(|e| format!("Không thể tạo emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0") || output.status.success();

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã tạo {} emulator mới", count)
        } else {
            format!("Lỗi tạo emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Clone MuMu emulator instance
#[command]
pub async fn clone_mumu_instance(vmindex: String) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Cloning instance: {}", vmindex);

    let output = new_command(&mumu_path)
        .args(["clone", "-v", &vmindex])
        .output()
        .map_err(|e| format!("Không thể clone emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0") || output.status.success();

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã clone emulator {}", vmindex)
        } else {
            format!("Lỗi clone emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Delete MuMu emulator instance
#[command]
pub async fn delete_mumu_instance(vmindex: String) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Deleting instance: {}", vmindex);

    let output = new_command(&mumu_path)
        .args(["delete", "-v", &vmindex])
        .output()
        .map_err(|e| format!("Không thể xóa emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0") || output.status.success();

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã xóa emulator {}", vmindex)
        } else {
            format!("Lỗi xóa emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Rename MuMu emulator instance
#[command]
pub async fn rename_mumu_instance(vmindex: String, new_name: String) -> Result<EmulatorResult, String> {
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;

    println!("[Emulator] Renaming instance {} to: {}", vmindex, new_name);

    let output = new_command(&mumu_path)
        .args(["rename", "-v", &vmindex, "-n", &new_name])
        .output()
        .map_err(|e| format!("Không thể đổi tên emulator: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let success = stdout.contains("\"errcode\": 0") || stdout.contains("\"errcode\":0") || output.status.success();

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã đổi tên emulator {} thành {}", vmindex, new_name)
        } else {
            format!("Lỗi đổi tên emulator: {}", stdout)
        },
        instances: None,
    })
}

/// Connect to emulator ADB after it's started
#[command]
pub async fn connect_emulator_adb(adb_host: String, adb_port: u16) -> Result<EmulatorResult, String> {
    let address = format!("{}:{}", adb_host, adb_port);
    
    println!("[Emulator] Connecting ADB to: {}", address);

    let output = new_command("adb")
        .args(["connect", &address])
        .output()
        .map_err(|e| format!("Không thể kết nối ADB: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let success = stdout.contains("connected") && !stdout.contains("cannot");

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã kết nối ADB: {}", address)
        } else {
            format!("Lỗi kết nối ADB: {}", stdout)
        },
        instances: None,
    })
}

/// Launch emulator and wait for Android to start, then connect ADB
#[command]
pub async fn launch_and_connect_emulator(vmindex: String) -> Result<EmulatorResult, String> {
    // 1. Launch emulator
    let launch_result = launch_emulator(vmindex.clone()).await?;
    if !launch_result.success {
        return Ok(launch_result);
    }

    // 2. Wait for Android to start (poll status)
    let mumu_path = detect_mumu_path().ok_or("Không tìm thấy MuMu Emulator")?;
    
    let mut attempts = 0;
    let max_attempts = 60; // 60 seconds timeout
    
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        attempts += 1;
        
        let output = new_command(&mumu_path)
            .args(["info", "--vmindex", &vmindex])
            .output();
        
        if let Ok(result) = output {
            let stdout = String::from_utf8_lossy(&result.stdout);
            
            // Check if Android is started
            if stdout.contains("\"is_android_started\": true") || stdout.contains("\"is_android_started\":true") {
                // Parse to get ADB info
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let adb_host = json.get("adb_host_ip")
                        .and_then(|v| v.as_str())
                        .unwrap_or("127.0.0.1");
                    let adb_port = json.get("adb_port")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(16384) as u16;
                    
                    // 3. Connect ADB
                    return connect_emulator_adb(adb_host.to_string(), adb_port).await;
                }
            }
        }
        
        if attempts >= max_attempts {
            return Ok(EmulatorResult {
                success: false,
                message: "Timeout: Android không khởi động sau 60 giây".to_string(),
                instances: None,
            });
        }
    }
}

/// Check if MuMu is installed
#[command]
pub async fn check_mumu_installed() -> Result<bool, String> {
    Ok(detect_mumu_path().is_some())
}

/// Get MuMu installation path
#[command]
pub async fn get_mumu_path() -> Result<Option<String>, String> {
    Ok(detect_mumu_path())
}

/// Check if BlueStacks is installed
#[command]
pub async fn check_bluestacks_installed() -> Result<bool, String> {
    Ok(detect_bluestacks_path().is_some())
}

/// Get BlueStacks instances
#[command]
pub async fn get_bluestacks_instances() -> Result<EmulatorResult, String> {
    let bstk_path = detect_bluestacks_path().ok_or("Không tìm thấy BlueStacks")?;
    let vmmgr = format!("{}\\BstkVMMgr.exe", bstk_path);

    // Get all VMs
    let output = new_command(&vmmgr)
        .args(["list", "vms"])
        .output()
        .map_err(|e| format!("Không thể chạy BstkVMMgr: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Get running VMs
    let running_output = new_command(&vmmgr)
        .args(["list", "runningvms"])
        .output()
        .ok();
    let running_stdout = running_output
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let mut instances = Vec::new();
    let mut idx = 0;

    // Parse output: "Name" {uuid}
    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with('"') {
            if let Some(end_quote) = line[1..].find('"') {
                let name = line[1..end_quote + 1].to_string();
                let is_running = running_stdout.contains(&name);
                
                let instance = EmulatorInstance {
                    index: format!("bs-{}", idx),
                    name: name.clone(),
                    is_running,
                    is_android_started: is_running,
                    adb_port: if is_running { Some(5555 + (idx as u16 * 10)) } else { None },
                    adb_host: Some("127.0.0.1".to_string()),
                    player_state: if is_running { Some("running".to_string()) } else { None },
                    pid: None,
                };
                instances.push(instance);
                idx += 1;
            }
        }
    }

    Ok(EmulatorResult {
        success: true,
        message: format!("Tìm thấy {} BlueStacks instance(s)", instances.len()),
        instances: Some(instances),
    })
}

/// Launch BlueStacks instance by name
#[command]
pub async fn launch_bluestacks(instance_name: String) -> Result<EmulatorResult, String> {
    let bstk_path = detect_bluestacks_path().ok_or("Không tìm thấy BlueStacks")?;
    let player = format!("{}\\HD-Player.exe", bstk_path);

    println!("[Emulator] Launching BlueStacks instance: {}", instance_name);

    new_command(&player)
        .args(["--instance", &instance_name])
        .spawn()
        .map_err(|e| format!("Không thể khởi động BlueStacks: {}", e))?;

    Ok(EmulatorResult {
        success: true,
        message: format!("Đang khởi động BlueStacks: {}", instance_name),
        instances: None,
    })
}

/// Shutdown BlueStacks instance by name
#[command]
pub async fn shutdown_bluestacks(instance_name: String) -> Result<EmulatorResult, String> {
    let bstk_path = detect_bluestacks_path().ok_or("Không tìm thấy BlueStacks")?;
    let vmmgr = format!("{}\\BstkVMMgr.exe", bstk_path);

    println!("[Emulator] Shutting down BlueStacks instance: {}", instance_name);

    let output = new_command(&vmmgr)
        .args(["controlvm", &instance_name, "poweroff"])
        .output()
        .map_err(|e| format!("Không thể tắt BlueStacks: {}", e))?;

    let success = output.status.success();

    Ok(EmulatorResult {
        success,
        message: if success {
            format!("Đã tắt BlueStacks: {}", instance_name)
        } else {
            format!("Lỗi tắt BlueStacks: {}", String::from_utf8_lossy(&output.stderr))
        },
        instances: None,
    })
}

/// Get all emulator instances (both MuMu and BlueStacks)
#[command]
pub async fn get_all_emulator_instances() -> Result<EmulatorResult, String> {
    let mut all_instances = Vec::new();

    // Get MuMu instances
    if detect_mumu_path().is_some() {
        if let Ok(result) = get_emulator_instances().await {
            if let Some(instances) = result.instances {
                all_instances.extend(instances);
            }
        }
    }

    // Get BlueStacks instances
    if detect_bluestacks_path().is_some() {
        if let Ok(result) = get_bluestacks_instances().await {
            if let Some(instances) = result.instances {
                all_instances.extend(instances);
            }
        }
    }

    Ok(EmulatorResult {
        success: true,
        message: format!("Tìm thấy {} emulator(s) tổng cộng", all_instances.len()),
        instances: Some(all_instances),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_mumu() {
        // This test will vary based on system
        let path = detect_mumu_path();
        println!("MuMu path: {:?}", path);
    }

    #[test]
    fn test_detect_bluestacks() {
        let path = detect_bluestacks_path();
        println!("BlueStacks path: {:?}", path);
    }
}
