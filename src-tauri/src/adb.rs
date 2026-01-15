// ADB Module - Quản lý các lệnh ADB
// Ported from Flet Python logic (droidrun_app_flet.py)

use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::command;
use std::time::Duration;
use std::net::SocketAddr;
use tokio::net::TcpStream;
use tokio::time::timeout;
use futures::future::join_all;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Timeout for TCP port check (ms)
const PORT_CHECK_TIMEOUT_MS: u64 = 100;

/// Max concurrent port scans
const MAX_CONCURRENT_SCANS: usize = 20;

/// Global scrcpy path (set from config)
static SCRCPY_PATH: std::sync::RwLock<Option<String>> = std::sync::RwLock::new(None);

/// Set scrcpy path from settings
pub fn set_scrcpy_path(path: String) {
    if let Ok(mut guard) = SCRCPY_PATH.write() {
        *guard = if path.is_empty() { None } else { Some(path) };
    }
}

/// Get scrcpy path
fn get_scrcpy_path() -> Option<String> {
    SCRCPY_PATH.read().ok().and_then(|g| g.clone())
}

/// Helper to create a command with hidden window on Windows
fn new_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub id: String,
    pub status: String,
    pub model: Option<String>,
    pub android_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

// Emulator ports - Extended list for multiple emulator instances (from Flet)
// LDPlayer: 5555, 5557, 5559... (odd ports)
// Nox: 62001, 62025, 62026...
// Memu: 21503, 21513, 21523...
// BlueStacks: 5555, 5556, 5565, 5575...
// Android Studio AVD: 5554, 5556, 5558...
const EMULATOR_PORTS: &[u16] = &[
    // Standard ADB ports
    5555, 5556, 5557, 5558, 5559, 5560,
    // LDPlayer instances (5555, 5557, 5559...)
    5561, 5563, 5565, 5567, 5569, 5571, 5573, 5575, 5577, 5579,
    // Nox Player
    62001, 62025, 62026, 62027, 62028, 62029, 62030,
    // Memu
    21503, 21513, 21523, 21533, 21543, 21553,
    // BlueStacks
    5585, 5595,
];

/// Chạy lệnh ADB với các tham số
#[command]
pub async fn run_adb_command(args: Vec<String>) -> Result<AdbResult, String> {
    let output = new_command("adb")
        .args(&args)
        .output()
        .map_err(|e| format!("Không thể chạy ADB: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(AdbResult {
        success: output.status.success(),
        output: stdout,
        error: if stderr.is_empty() { None } else { Some(stderr) },
    })
}

/// Lấy danh sách thiết bị đã kết nối (adb devices + getprop để lấy thông tin chi tiết)
#[command]
pub async fn get_connected_devices() -> Result<Vec<DeviceInfo>, String> {
    let output = new_command("adb")
        .args(["devices", "-l"])
        .output()
        .map_err(|e| format!("Không thể chạy ADB: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("[ADB] Raw device list:\n{}", stdout);

    // First pass: collect device IDs
    let mut device_ids: Vec<String> = Vec::new();
    for line in stdout.lines().skip(1) {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == "device" {
            device_ids.push(parts[0].to_string());
        }
    }

    // Fetch device properties
    let mut devices = Vec::new();
    let mut seen_serials: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_models: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for id in device_ids {
        // Get multiple properties in one shell call
        let props = get_device_properties_batch_sync(&id);
        
        let serial = props.get("ro.serialno").cloned();
        let model = props.get("ro.product.model").cloned();
        let android_version = props.get("ro.build.version.release").cloned();

        // Check for duplicates based on serial
        let mut is_duplicate = false;
        if let Some(ref s) = serial {
            if !s.is_empty() && s != "unknown" {
                if seen_serials.contains(s) {
                    println!("[ADB] Skipping duplicate device {} (serial: {})", id, s);
                    is_duplicate = true;
                } else {
                    seen_serials.insert(s.clone());
                }
            }
        }

        // Secondary check: same model
        if !is_duplicate {
            if let Some(ref m) = model {
                if !m.is_empty() {
                    let is_tcp = id.contains(':');
                    
                    if let Some(existing_id) = seen_models.get(m) {
                        let existing_is_tcp = existing_id.contains(':');
                        
                        if is_tcp && !existing_is_tcp {
                            println!("[ADB] Skipping TCP duplicate {} (USB {} exists)", id, existing_id);
                            is_duplicate = true;
                        } else if !is_tcp && existing_is_tcp {
                            println!("[ADB] Replacing TCP {} with USB {}", existing_id, id);
                            devices.retain(|d: &DeviceInfo| &d.id != existing_id);
                            seen_models.insert(m.clone(), id.clone());
                        } else {
                            println!("[ADB] Skipping duplicate {} (model {} exists)", id, m);
                            is_duplicate = true;
                        }
                    } else {
                        seen_models.insert(m.clone(), id.clone());
                    }
                }
            }
        }

        if is_duplicate {
            continue;
        }

        println!("[ADB] Found device: {} - {:?} - Android {:?}", id, model, android_version);

        devices.push(DeviceInfo {
            id,
            status: "device".to_string(),
            model,
            android_version,
        });
    }

    println!("[ADB] Total unique devices: {}", devices.len());
    Ok(devices)
}

/// Get multiple device properties in a single shell call
fn get_device_properties_batch_sync(device_id: &str) -> std::collections::HashMap<String, String> {
    let mut props = std::collections::HashMap::new();
    
    // Single shell call to get all properties at once
    let output = new_command("adb")
        .args(["-s", device_id, "shell", 
               "getprop ro.serialno; getprop ro.product.model; getprop ro.build.version.release"])
        .output();
    
    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = stdout.lines().collect();
            
            if lines.len() >= 1 && !lines[0].trim().is_empty() {
                props.insert("ro.serialno".to_string(), lines[0].trim().to_string());
            }
            if lines.len() >= 2 && !lines[1].trim().is_empty() {
                props.insert("ro.product.model".to_string(), lines[1].trim().to_string());
            }
            if lines.len() >= 3 && !lines[2].trim().is_empty() {
                props.insert("ro.build.version.release".to_string(), lines[2].trim().to_string());
            }
        }
    }
    
    props
}

/// Kết nối ADB qua TCP/IP
#[command]
pub async fn adb_connect(address: String) -> Result<AdbResult, String> {
    let output = new_command("adb")
        .args(["connect", &address])
        .output()
        .map_err(|e| format!("Không thể kết nối: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let success = stdout.contains("connected") || stdout.contains("already connected");

    Ok(AdbResult {
        success,
        output: stdout,
        error: None,
    })
}

/// Ngắt kết nối ADB
#[command]
pub async fn adb_disconnect(address: String) -> Result<AdbResult, String> {
    let output = new_command("adb")
        .args(["disconnect", &address])
        .output()
        .map_err(|e| format!("Không thể ngắt kết nối: {}", e))?;

    Ok(AdbResult {
        success: output.status.success(),
        output: String::from_utf8_lossy(&output.stdout).to_string(),
        error: None,
    })
}

/// Kiểm tra ADB có được cài đặt không
#[command]
pub async fn test_adb() -> Result<bool, String> {
    let result = new_command("adb")
        .args(["version"])
        .output();

    Ok(result.is_ok() && result.unwrap().status.success())
}

/// Check if a TCP port is open (fast async check)
async fn check_port_open(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    match timeout(
        Duration::from_millis(PORT_CHECK_TIMEOUT_MS),
        TcpStream::connect(addr)
    ).await {
        Ok(Ok(_)) => true,
        _ => false,
    }
}

/// Check multiple ports in parallel, return list of open ports
async fn find_open_ports(ports: &[u16]) -> Vec<u16> {
    let futures: Vec<_> = ports.iter().map(|&port| async move {
        if check_port_open(port).await {
            Some(port)
        } else {
            None
        }
    }).collect();
    
    let results = join_all(futures).await;
    results.into_iter().filter_map(|x| x).collect()
}

/// Try to connect ADB to a single address with timeout
async fn try_adb_connect(address: String) -> Option<String> {
    // Run adb connect in a blocking task with timeout
    let result = tokio::task::spawn_blocking(move || {
        let output = new_command("adb")
            .args(["connect", &address])
            .output();
        
        if let Ok(result) = output {
            let stdout = String::from_utf8_lossy(&result.stdout).to_string();
            if stdout.contains("connected") && !stdout.contains("cannot") && !stdout.contains("failed") {
                return Some(address);
            }
        }
        None
    }).await;
    
    result.unwrap_or(None)
}

/// Auto-connect to emulators by scanning common ports (FAST version)
/// This is called on app startup to find running emulators
#[command]
pub async fn auto_connect_emulators() -> Result<Vec<String>, String> {
    println!("[ADB] Auto-connecting to emulators (fast scan)...");
    let start = std::time::Instant::now();
    
    // Step 1: Quick TCP port scan (parallel, ~100ms total)
    let ports_to_scan: Vec<u16> = EMULATOR_PORTS.iter().take(15).copied().collect();
    let open_ports = find_open_ports(&ports_to_scan).await;
    
    println!("[ADB] Found {} open ports in {:?}", open_ports.len(), start.elapsed());
    
    if open_ports.is_empty() {
        return Ok(Vec::new());
    }
    
    // Step 2: Connect to open ports in parallel
    let connect_futures: Vec<_> = open_ports.into_iter().map(|port| {
        let address = format!("127.0.0.1:{}", port);
        try_adb_connect(address)
    }).collect();
    
    let results = join_all(connect_futures).await;
    let connected: Vec<String> = results.into_iter().filter_map(|x| x).collect();
    
    println!("[ADB] Auto-connected to {} emulator(s) in {:?}", connected.len(), start.elapsed());
    Ok(connected)
}

/// Scan all emulator ports and connect (FAST version - parallel scan)
#[command]
pub async fn scan_emulator_ports() -> Result<Vec<String>, String> {
    println!("[ADB] Scanning all emulator ports (fast parallel scan)...");
    let start = std::time::Instant::now();
    
    // Step 1: Quick TCP port scan for ALL ports (parallel)
    let open_ports = find_open_ports(EMULATOR_PORTS).await;
    
    println!("[ADB] Found {} open ports in {:?}", open_ports.len(), start.elapsed());
    
    if open_ports.is_empty() {
        println!("[ADB] No open emulator ports found");
        return Ok(Vec::new());
    }
    
    // Step 2: Connect to open ports in parallel (batch to avoid overwhelming)
    let mut all_connected = Vec::new();
    
    for chunk in open_ports.chunks(MAX_CONCURRENT_SCANS) {
        let connect_futures: Vec<_> = chunk.iter().map(|&port| {
            let address = format!("127.0.0.1:{}", port);
            try_adb_connect(address)
        }).collect();
        
        let results = join_all(connect_futures).await;
        let connected: Vec<String> = results.into_iter().filter_map(|x| x).collect();
        all_connected.extend(connected);
    }
    
    println!("[ADB] Total emulators found: {} in {:?}", all_connected.len(), start.elapsed());
    Ok(all_connected)
}

/// Check DroidRun Portal status using: droidrun ping -d <device>
/// Returns true if Portal is installed and accessible
#[command]
pub async fn check_droidrun_portal(device_id: String) -> Result<AdbResult, String> {
    println!("[DroidRun] Checking Portal on device: {}", device_id);
    
    let output = new_command("py")
        .args(["-m", "droidrun", "ping", "-d", &device_id])
        .output()
        .map_err(|e| format!("Không thể chạy droidrun ping: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = stdout.to_lowercase().contains("good to go") || 
                  stdout.to_lowercase().contains("accessible");
    
    println!("[DroidRun] Ping result: success={}", success);
    
    Ok(AdbResult {
        success,
        output: stdout,
        error: if stderr.is_empty() { None } else { Some(stderr) },
    })
}

/// Install/Setup DroidRun Portal using: droidrun setup -d <device>
/// This installs Portal APK and enables accessibility service
#[command]
pub async fn setup_droidrun_portal(device_id: String) -> Result<AdbResult, String> {
    println!("[DroidRun] Installing Portal on device: {}", device_id);
    
    let output = new_command("py")
        .args(["-m", "droidrun", "setup", "-d", &device_id])
        .output()
        .map_err(|e| format!("Không thể chạy droidrun setup: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = stdout.to_lowercase().contains("success") || 
                  output.status.success();
    
    println!("[DroidRun] Setup result: success={}", success);
    
    Ok(AdbResult {
        success,
        output: stdout,
        error: if stderr.is_empty() { None } else { Some(stderr) },
    })
}


/// Wake up device screen using KEYCODE_WAKEUP
#[command]
pub async fn wake_device(device_id: String) -> Result<AdbResult, String> {
    println!("[ADB] Waking up device: {}", device_id);
    
    // Send KEYCODE_WAKEUP (224) to wake up the screen
    let output = new_command("adb")
        .args(["-s", &device_id, "shell", "input", "keyevent", "KEYCODE_WAKEUP"])
        .output()
        .map_err(|e| format!("Không thể đánh thức thiết bị: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();
    
    if success {
        println!("[ADB] Device {} woken up successfully", device_id);
    } else {
        println!("[ADB] Failed to wake device {}: {}", device_id, stderr);
    }
    
    Ok(AdbResult {
        success,
        output: stdout,
        error: if stderr.is_empty() { None } else { Some(stderr) },
    })
}

/// Launch scrcpy to view/control device screen
#[command]
pub async fn launch_scrcpy(device_id: String) -> Result<AdbResult, String> {
    println!("[Scrcpy] Launching for device: {}", device_id);
    
    // Get current exe directory
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    // Get current working directory
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    
    // Get custom scrcpy path from settings
    let custom_scrcpy_path = get_scrcpy_path();
    
    println!("[Scrcpy] exe_dir: {:?}", exe_dir);
    println!("[Scrcpy] cwd: {:?}", cwd);
    println!("[Scrcpy] custom_path: {:?}", custom_scrcpy_path);
    
    // Try multiple possible locations for scrcpy
    let mut possible_paths: Vec<std::path::PathBuf> = vec![];
    
    // 1. Custom path from settings (highest priority)
    if let Some(ref custom_path) = custom_scrcpy_path {
        let custom = std::path::PathBuf::from(custom_path);
        // Try both with and without scrcpy.exe suffix
        if custom.ends_with("scrcpy.exe") {
            possible_paths.push(custom.clone());
        } else {
            possible_paths.push(custom.join("scrcpy.exe"));
            possible_paths.push(custom.clone());
        }
    }
    
    // 2. Add default paths
    possible_paths.extend(vec![
        // Production: bundled in resources folder next to exe
        exe_dir.join("scrcpy-win64-v3.3.4/scrcpy.exe"),
        exe_dir.join("scrcpy.exe"),
        // CWD relative (dev mode with tauri dev)
        cwd.join("scrcpy-win64-v3.3.4/scrcpy.exe"),
        // Parent of exe (sometimes exe is in target/debug)
        exe_dir.parent().map(|p| p.join("scrcpy-win64-v3.3.4/scrcpy.exe")).unwrap_or_default(),
        exe_dir.parent().and_then(|p| p.parent()).map(|p| p.join("scrcpy-win64-v3.3.4/scrcpy.exe")).unwrap_or_default(),
        // Go up from target/debug to project root
        exe_dir.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).map(|p| p.join("scrcpy-win64-v3.3.4/scrcpy.exe")).unwrap_or_default(),
    ]);
    
    // Remove empty paths
    possible_paths.retain(|p| !p.as_os_str().is_empty());
    
    // Log all paths being checked
    for (i, path) in possible_paths.iter().enumerate() {
        let exists = path.exists();
        println!("[Scrcpy] Path {}: {:?} (exists: {})", i, path, exists);
    }
    
    // Find first existing path
    let scrcpy_path = possible_paths.iter()
        .find(|p| p.exists());
    
    // If not found in predefined paths, try to find scrcpy in PATH
    if scrcpy_path.is_none() {
        println!("[Scrcpy] Not found in predefined paths, trying PATH...");
        
        // Try running scrcpy directly (if it's in PATH)
        let result = new_command("scrcpy")
            .args(["-s", &device_id, "--window-title", &format!("DroidRun - {}", device_id)])
            .spawn();
        
        match result {
            Ok(_) => {
                println!("[Scrcpy] Launched from PATH for {}", device_id);
                return Ok(AdbResult {
                    success: true,
                    output: "Scrcpy đã khởi động (từ PATH)".to_string(),
                    error: None,
                });
            }
            Err(e) => {
                println!("[Scrcpy] Not found in PATH: {}", e);
            }
        }
        
        return Ok(AdbResult {
            success: false,
            output: String::new(),
            error: Some(format!(
                "Không tìm thấy scrcpy.exe. Đã thử:\n{}\nHãy cài scrcpy vào thư mục dự án hoặc thêm vào PATH.",
                possible_paths.iter().map(|p| format!("- {:?}", p)).collect::<Vec<_>>().join("\n")
            )),
        });
    }
    
    let scrcpy_path = scrcpy_path.unwrap();
    let scrcpy_dir = scrcpy_path.parent().unwrap();
    
    println!("[Scrcpy] Using path: {:?}", scrcpy_path);
    
    // Launch scrcpy as detached process (non-blocking)
    let result = new_command(scrcpy_path.to_str().unwrap())
        .args(["-s", &device_id, "--window-title", &format!("DroidRun - {}", device_id)])
        .current_dir(scrcpy_dir)
        .spawn();
    
    match result {
        Ok(_) => {
            println!("[Scrcpy] Launched successfully for {}", device_id);
            Ok(AdbResult {
                success: true,
                output: "Scrcpy đã khởi động".to_string(),
                error: None,
            })
        }
        Err(e) => {
            println!("[Scrcpy] Failed to launch: {}", e);
            Ok(AdbResult {
                success: false,
                output: String::new(),
                error: Some(format!("Không thể khởi động scrcpy: {}", e)),
            })
        }
    }
}

/// Kiểm tra APK đã cài trên thiết bị (generic)
#[command]
pub async fn check_apk_installed(device_id: String, package_name: String) -> Result<bool, String> {
    let output = new_command("adb")
        .args(["-s", &device_id, "shell", "pm", "list", "packages", &package_name])
        .output()
        .map_err(|e| format!("Lỗi: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains(&package_name))
}

/// Cài đặt APK lên thiết bị
#[command]
pub async fn install_apk(device_id: String, apk_path: String) -> Result<AdbResult, String> {
    let output = new_command("adb")
        .args(["-s", &device_id, "install", "-r", &apk_path])
        .output()
        .map_err(|e| format!("Không thể cài đặt APK: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let success = stdout.contains("Success");

    Ok(AdbResult {
        success,
        output: stdout,
        error: if success { None } else { Some("Cài đặt thất bại".to_string()) },
    })
}

/// Chụp màn hình thiết bị
#[command]
pub async fn take_screenshot(device_id: String, save_path: String) -> Result<AdbResult, String> {
    // Chụp màn hình và lưu vào thiết bị
    let _ = new_command("adb")
        .args(["-s", &device_id, "shell", "screencap", "-p", "/sdcard/screenshot.png"])
        .output()
        .map_err(|e| format!("Lỗi chụp màn hình: {}", e))?;

    // Pull về máy tính
    let output = new_command("adb")
        .args(["-s", &device_id, "pull", "/sdcard/screenshot.png", &save_path])
        .output()
        .map_err(|e| format!("Lỗi lưu ảnh: {}", e))?;

    // Xóa file trên thiết bị
    let _ = new_command("adb")
        .args(["-s", &device_id, "shell", "rm", "/sdcard/screenshot.png"])
        .output();

    Ok(AdbResult {
        success: output.status.success(),
        output: format!("Đã lưu ảnh tại: {}", save_path),
        error: None,
    })
}

/// Get list of emulator ports for frontend display
#[command]
pub async fn get_emulator_ports() -> Result<Vec<u16>, String> {
    Ok(EMULATOR_PORTS.to_vec())
}

/// Restart ADB server (useful when devices are stuck)
#[command]
pub async fn restart_adb_server() -> Result<AdbResult, String> {
    println!("[ADB] Restarting ADB server...");

    // Kill server
    let _ = new_command("adb")
        .args(["kill-server"])
        .output();

    // Wait a bit
    std::thread::sleep(Duration::from_millis(500));

    // Start server
    let output = new_command("adb")
        .args(["start-server"])
        .output()
        .map_err(|e| format!("Không thể khởi động ADB: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    
    println!("[ADB] ADB server restarted");

    Ok(AdbResult {
        success: output.status.success(),
        output: stdout,
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emulator_ports() {
        assert!(EMULATOR_PORTS.contains(&5555));
        assert!(EMULATOR_PORTS.contains(&62001)); // Nox
        assert!(EMULATOR_PORTS.contains(&21503)); // Memu
    }
}
