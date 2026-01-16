// Utils Module - Các tiện ích chung
use std::process::Command;
use tauri::command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Helper to create a command with hidden window on Windows
fn new_command(program: &str) -> Command {
    #[cfg(windows)]
    let mut cmd = Command::new(program);
    #[cfg(not(windows))]
    let cmd = Command::new(program);
    
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Find available Python executable (python3.11 > python3 > python)
fn get_python_cmd() -> &'static str {
    if Command::new("python3.11").arg("--version").output().is_ok() {
        return "python3.11";
    }
    if Command::new("python3").arg("--version").output().is_ok() {
        return "python3";
    }
    "python"
}

/// Kiểm tra Python đã cài đặt chưa
#[command]
pub async fn check_python_installed() -> Result<bool, String> {
    let python_cmd = get_python_cmd();
    let result = new_command(python_cmd)
        .args(["--version"])
        .output();

    if result.is_err() {
        // Try python3
        let result3 = new_command("python3")
            .args(["--version"])
            .output();
        return Ok(result3.is_ok() && result3.unwrap().status.success());
    }

    Ok(result.unwrap().status.success())
}

/// Lấy phiên bản Python
#[command]
pub async fn get_python_version() -> Result<String, String> {
    let python_cmd = get_python_cmd();
    let output = new_command(python_cmd)
        .args(["--version"])
        .output()
        .or_else(|_| {
            new_command("python3")
                .args(["--version"])
                .output()
        })
        .map_err(|e| format!("Không tìm thấy Python: {}", e))?;

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        let version = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Ok(version);
    }
    Ok(version)
}

/// Lấy phiên bản droidrun
#[command]
pub async fn get_droidrun_version() -> Result<String, String> {
    let python_cmd = get_python_cmd();
    let output = new_command(python_cmd)
        .args(["-c", "import droidrun; print(droidrun.__version__)"])
        .output()
        .or_else(|_| {
            new_command("python3")
                .args(["-c", "import droidrun; print(droidrun.__version__)"])
                .output()
        })
        .map_err(|e| format!("Không thể lấy version droidrun: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("droidrun chưa được cài đặt".to_string())
    }
}

/// Cài đặt Python 3.12 qua winget (Windows only)
#[command]
pub async fn install_python(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    println!("[INSTALL] Installing Python 3.12 via winget");
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "python",
        "status": "installing",
        "message": "Đang kiểm tra winget...",
    }));
    
    // Step 1: Check if winget is available
    let winget_check = new_command("winget")
        .arg("--version")
        .output();
    
    if winget_check.is_err() {
        let error_msg = "Winget không khả dụng.\n\
                        Hãy tải Python 3.12 trực tiếp:\n\
                        https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe\n\n\
                        Lưu ý: Tick chọn 'Add Python to PATH' khi cài đặt";
        let _ = window.emit("install-progress", serde_json::json!({
            "component": "python",
            "status": "error",
            "message": error_msg,
            "manual_link": "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe",
            "fallback_link": "https://www.python.org/downloads/",
        }));
        return Err(error_msg.to_string());
    }
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "python",
        "status": "installing",
        "message": "Đang cài Python 3.12...",
    }));
    
    // Step 2: Install Python via winget
    let result = new_command("winget")
        .args(["install", "Python.Python.3.12", "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    
    match result {
        Ok(output) if output.status.success() => {
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "python",
                "status": "success",
                "message": "Python 3.12 đã cài đặt thành công. Vui lòng khởi động lại ứng dụng.",
            }));
            Ok("Python 3.12 đã cài đặt thành công. Vui lòng khởi động lại ứng dụng để cập nhật PATH.".to_string())
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            // Check if already installed
            if stderr.contains("already installed") || stdout.contains("already installed") || stdout.contains("No applicable update found") {
                let _ = window.emit("install-progress", serde_json::json!({
                    "component": "python",
                    "status": "success",
                    "message": "Python 3.12 đã được cài đặt sẵn",
                }));
                return Ok("Python 3.12 đã được cài đặt sẵn".to_string());
            }
            
            // Fallback: provide manual installation guide
            let error_msg = format!(
                "Không thể cài Python tự động.\n\
                 Lỗi: {}\n\n\
                 Hãy cài thủ công:\n\
                 1. Tải Python 3.12 từ: https://www.python.org/downloads/\n\
                 2. Tick chọn 'Add Python to PATH' khi cài đặt\n\
                 3. Khởi động lại ứng dụng này",
                stderr.chars().take(100).collect::<String>()
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "python",
                "status": "error",
                "message": error_msg,
                "manual_link": "https://www.python.org/downloads/",
            }));
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!(
                "Lỗi chạy winget: {}\n\n\
                 Hãy cài Python 3.12 thủ công:\n\
                 1. Tải từ: https://www.python.org/downloads/\n\
                 2. Tick chọn 'Add Python to PATH'\n\
                 3. Khởi động lại ứng dụng",
                e
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "python",
                "status": "error",
                "message": error_msg,
                "manual_link": "https://www.python.org/downloads/",
            }));
            Err(error_msg)
        }
    }
}

/// Cập nhật DroidRun SDK lên phiên bản mới nhất
#[command]
pub async fn update_droidrun_package(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    println!("[UPDATE] Updating DroidRun SDK");
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "droidrun",
        "status": "installing",
        "message": "Đang kiểm tra phiên bản hiện tại...",
    }));
    
    // Get current version
    let current_version = new_command("python")
        .args(["-c", "import droidrun; print(droidrun.__version__)"])
        .output()
        .or_else(|_| {
            new_command("python3")
                .args(["-c", "import droidrun; print(droidrun.__version__)"])
                .output()
        })
        .ok()
        .and_then(|o| if o.status.success() {
            Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        });
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "droidrun",
        "status": "installing",
        "message": format!("Đang cập nhật DroidRun{}...", 
            current_version.as_ref().map(|v| format!(" từ {}", v)).unwrap_or_default()),
    }));
    
    // Update with --upgrade flag
    let result = new_command("pip")
        .args(["install", "--upgrade", "--no-cache-dir", "droidrun"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "--upgrade", "--no-cache-dir", "droidrun"])
                .output()
        });
    
    match result {
        Ok(output) if output.status.success() => {
            // Verify and get new version
            let verify_result = new_command("python")
                .args(["-c", "import droidrun; print(droidrun.__version__)"])
                .output()
                .or_else(|_| {
                    new_command("python3")
                        .args(["-c", "import droidrun; print(droidrun.__version__)"])
                        .output()
                });
            
            match verify_result {
                Ok(verify_output) if verify_output.status.success() => {
                    let new_version = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                    
                    let msg = if let Some(ref old_ver) = current_version {
                        if old_ver == &new_version {
                            format!("DroidRun SDK {} đã là phiên bản mới nhất", new_version)
                        } else {
                            format!("Đã cập nhật DroidRun SDK: {} → {}", old_ver, new_version)
                        }
                    } else {
                        format!("DroidRun SDK {} đã cài đặt và hoạt động tốt", new_version)
                    };
                    
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "droidrun",
                        "status": "success",
                        "message": msg.clone(),
                        "version": new_version,
                        "old_version": current_version,
                    }));
                    Ok(msg)
                }
                _ => {
                    let msg = "Cập nhật hoàn tất nhưng không thể verify. Thử khởi động lại ứng dụng.";
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "droidrun",
                        "status": "success",
                        "message": msg,
                    }));
                    Ok(msg.to_string())
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            // pip might still report success in stdout
            if stdout.contains("Requirement already satisfied") || stdout.contains("Successfully installed") {
                let verify_result = new_command("python")
                    .args(["-c", "import droidrun; print(droidrun.__version__)"])
                    .output();
                
                if let Ok(verify_output) = verify_result {
                    if verify_output.status.success() {
                        let version = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                        let msg = format!("DroidRun SDK {} đã là phiên bản mới nhất", version);
                        
                        let _ = window.emit("install-progress", serde_json::json!({
                            "component": "droidrun",
                            "status": "success",
                            "message": msg.clone(),
                            "version": version,
                        }));
                        return Ok(msg);
                    }
                }
            }
            
            let error_msg = format!(
                "Không thể cập nhật DroidRun.\n\
                 Lỗi: {}\n\n\
                 Hãy thử:\n\
                 pip install --upgrade droidrun",
                stderr.chars().take(100).collect::<String>()
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "droidrun",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install --upgrade droidrun",
            }));
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!(
                "Lỗi chạy pip: {}\n\n\
                 Hãy thử:\n\
                 pip install --upgrade droidrun",
                e
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "droidrun",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install --upgrade droidrun",
            }));
            Err(error_msg)
        }
    }
}

/// Cập nhật OpenAI-Like LLM Provider lên phiên bản mới nhất
#[command]
pub async fn update_openai_like(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    println!("[UPDATE] Updating llama-index-llms-openai-like");
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "openai-like",
        "status": "installing",
        "message": "Đang cập nhật OpenAI-Like Provider...",
    }));
    
    // Update with --upgrade flag
    let result = new_command("pip")
        .args(["install", "--upgrade", "--no-cache-dir", "llama-index-llms-openai-like"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "--upgrade", "--no-cache-dir", "llama-index-llms-openai-like"])
                .output()
        });
    
    match result {
        Ok(output) if output.status.success() => {
            // Verify installation
            let verify_result = new_command("python")
                .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                .output()
                .or_else(|_| {
                    new_command("python3")
                        .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                        .output()
                });
            
            match verify_result {
                Ok(verify_output) if verify_output.status.success() => {
                    let verify_msg = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                    let success_msg = format!("OpenAI-Like Provider đã cập nhật thành công - {}", verify_msg);
                    
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "openai-like",
                        "status": "success",
                        "message": success_msg.clone(),
                        "verified": true,
                    }));
                    Ok(success_msg)
                }
                _ => {
                    let msg = "Cập nhật hoàn tất nhưng không thể import. Thử khởi động lại ứng dụng.";
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "openai-like",
                        "status": "success",
                        "message": msg,
                        "verified": false,
                    }));
                    Ok(msg.to_string())
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            if stdout.contains("Requirement already satisfied") || stdout.contains("Successfully installed") {
                let verify_result = new_command("python")
                    .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                    .output();
                
                if let Ok(verify_output) = verify_result {
                    if verify_output.status.success() {
                        let msg = "OpenAI-Like Provider đã là phiên bản mới nhất";
                        
                        let _ = window.emit("install-progress", serde_json::json!({
                            "component": "openai-like",
                            "status": "success",
                            "message": msg,
                            "verified": true,
                        }));
                        return Ok(msg.to_string());
                    }
                }
            }
            
            let error_msg = format!(
                "Không thể cập nhật OpenAI-Like.\n\
                 Lỗi: {}\n\n\
                 Hãy thử:\n\
                 pip install --upgrade llama-index-llms-openai-like",
                stderr.chars().take(100).collect::<String>()
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "openai-like",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install --upgrade llama-index-llms-openai-like",
            }));
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!(
                "Lỗi chạy pip: {}\n\n\
                 Hãy thử:\n\
                 pip install --upgrade llama-index-llms-openai-like",
                e
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "openai-like",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install --upgrade llama-index-llms-openai-like",
            }));
            Err(error_msg)
        }
    }
}

/// Cài đặt DroidRun SDK
#[command]
pub async fn install_droidrun_package(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    println!("[INSTALL] Installing DroidRun SDK");
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "droidrun",
        "status": "installing",
        "message": "Đang kiểm tra pip...",
    }));
    
    // Step 1: Check if pip is available
    let pip_check = new_command("pip")
        .arg("--version")
        .output()
        .or_else(|_| {
            new_command("pip3")
                .arg("--version")
                .output()
        });
    
    if pip_check.is_err() {
        let error_msg = "pip không khả dụng.\n\
                        Hãy cài Python trước (cần Python 3.8+)\n\
                        Hoặc cài thủ công: python -m ensurepip --upgrade";
        let _ = window.emit("install-progress", serde_json::json!({
            "component": "droidrun",
            "status": "error",
            "message": error_msg,
        }));
        return Err(error_msg.to_string());
    }
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "droidrun",
        "status": "installing",
        "message": "Đang cài DroidRun SDK...",
    }));
    
    // Step 2: Install DroidRun
    let result = new_command("pip")
        .args(["install", "droidrun"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "droidrun"])
                .output()
        });
    
    match result {
        Ok(output) if output.status.success() => {
            // Verify installation by checking version
            let verify_result = new_command("python")
                .args(["-c", "import droidrun; print(droidrun.__version__)"])
                .output()
                .or_else(|_| {
                    new_command("python3")
                        .args(["-c", "import droidrun; print(droidrun.__version__)"])
                        .output()
                });
            
            match verify_result {
                Ok(verify_output) if verify_output.status.success() => {
                    let version = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                    let success_msg = format!("DroidRun SDK {} đã cài đặt và hoạt động tốt", version);
                    
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "droidrun",
                        "status": "success",
                        "message": success_msg.clone(),
                        "version": version,
                    }));
                    Ok(success_msg)
                }
                _ => {
                    let msg = "DroidRun đã cài nhưng không thể verify. Thử khởi động lại ứng dụng.";
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "droidrun",
                        "status": "success",
                        "message": msg,
                    }));
                    Ok(msg.to_string())
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            if stdout.contains("Requirement already satisfied") || stdout.contains("Successfully installed") {
                // Also verify if already installed
                let verify_result = new_command("python")
                    .args(["-c", "import droidrun; print(droidrun.__version__)"])
                    .output()
                    .or_else(|_| {
                        new_command("python3")
                            .args(["-c", "import droidrun; print(droidrun.__version__)"])
                            .output()
                    });
                
                if let Ok(verify_output) = verify_result {
                    if verify_output.status.success() {
                        let version = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                        let msg = format!("DroidRun SDK {} đã sẵn sàng", version);
                        
                        let _ = window.emit("install-progress", serde_json::json!({
                            "component": "droidrun",
                            "status": "success",
                            "message": msg.clone(),
                            "version": version,
                        }));
                        return Ok(msg);
                    }
                }
                
                let _ = window.emit("install-progress", serde_json::json!({
                    "component": "droidrun",
                    "status": "success",
                    "message": "DroidRun SDK đã được cài đặt",
                }));
                return Ok("DroidRun SDK đã được cài đặt".to_string());
            }
            
            // Fallback: provide manual command
            let error_msg = format!(
                "Không thể cài DroidRun tự động.\n\
                 Lỗi: {}\n\n\
                 Hãy mở Command Prompt và chạy:\n\
                 pip install droidrun",
                stderr.chars().take(100).collect::<String>()
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "droidrun",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install droidrun",
            }));
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!(
                "Lỗi chạy pip: {}\n\n\
                 Hãy đảm bảo Python đã cài và thử:\n\
                 pip install droidrun\n\
                 hoặc: python -m pip install droidrun",
                e
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "droidrun",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install droidrun",
            }));
            Err(error_msg)
        }
    }
}

/// Cài đặt OpenAI-Like LLM Provider
#[command]
pub async fn install_openai_like(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    println!("[INSTALL] Installing llama-index-llms-openai-like");
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "openai-like",
        "status": "installing",
        "message": "Đang kiểm tra pip...",
    }));
    
    // Step 1: Check if pip is available
    let pip_check = new_command("pip")
        .arg("--version")
        .output()
        .or_else(|_| {
            new_command("pip3")
                .arg("--version")
                .output()
        });
    
    if pip_check.is_err() {
        let error_msg = "pip không khả dụng.\n\
                        Hãy cài Python trước (cần Python 3.8+)";
        let _ = window.emit("install-progress", serde_json::json!({
            "component": "openai-like",
            "status": "error",
            "message": error_msg,
        }));
        return Err(error_msg.to_string());
    }
    
    let _ = window.emit("install-progress", serde_json::json!({
        "component": "openai-like",
        "status": "installing",
        "message": "Đang cài OpenAI-Like Provider...",
    }));
    
    // Step 2: Install llama-index-llms-openai-like
    let result = new_command("pip")
        .args(["install", "llama-index-llms-openai-like"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "llama-index-llms-openai-like"])
                .output()
        });
    
    match result {
        Ok(output) if output.status.success() => {
            // Verify installation by importing
            let verify_result = new_command("python")
                .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                .output()
                .or_else(|_| {
                    new_command("python3")
                        .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                        .output()
                });
            
            match verify_result {
                Ok(verify_output) if verify_output.status.success() => {
                    let verify_msg = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                    let success_msg = format!("OpenAI-Like Provider đã cài đặt thành công - {}", verify_msg);
                    
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "openai-like",
                        "status": "success",
                        "message": success_msg.clone(),
                        "verified": true,
                    }));
                    Ok(success_msg)
                }
                _ => {
                    let msg = "OpenAI-Like đã cài nhưng không thể import. Thử khởi động lại ứng dụng.";
                    let _ = window.emit("install-progress", serde_json::json!({
                        "component": "openai-like",
                        "status": "success",
                        "message": msg,
                        "verified": false,
                    }));
                    Ok(msg.to_string())
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            if stdout.contains("Requirement already satisfied") || stdout.contains("Successfully installed") {
                // Also verify if already installed
                let verify_result = new_command("python")
                    .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                    .output()
                    .or_else(|_| {
                        new_command("python3")
                            .args(["-c", "from llama_index.llms.openai_like import OpenAILike; print('OpenAI-Like OK')"])
                            .output()
                    });
                
                if let Ok(verify_output) = verify_result {
                    if verify_output.status.success() {
                        let verify_msg = String::from_utf8_lossy(&verify_output.stdout).trim().to_string();
                        let msg = format!("OpenAI-Like Provider đã sẵn sàng - {}", verify_msg);
                        
                        let _ = window.emit("install-progress", serde_json::json!({
                            "component": "openai-like",
                            "status": "success",
                            "message": msg.clone(),
                            "verified": true,
                        }));
                        return Ok(msg);
                    }
                }
                
                let _ = window.emit("install-progress", serde_json::json!({
                    "component": "openai-like",
                    "status": "success",
                    "message": "OpenAI-Like Provider đã được cài đặt",
                }));
                return Ok("OpenAI-Like Provider đã được cài đặt".to_string());
            }
            
            // Fallback: provide manual command
            let error_msg = format!(
                "Không thể cài OpenAI-Like tự động.\n\
                 Lỗi: {}\n\n\
                 Hãy mở Command Prompt và chạy:\n\
                 pip install llama-index-llms-openai-like",
                stderr.chars().take(100).collect::<String>()
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "openai-like",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install llama-index-llms-openai-like",
            }));
            Err(error_msg)
        }
        Err(e) => {
            let error_msg = format!(
                "Lỗi chạy pip: {}\n\n\
                 Hãy đảm bảo Python đã cài và thử:\n\
                 pip install llama-index-llms-openai-like",
                e
            );
            
            let _ = window.emit("install-progress", serde_json::json!({
                "component": "openai-like",
                "status": "error",
                "message": error_msg,
                "manual_command": "pip install llama-index-llms-openai-like",
            }));
            Err(error_msg)
        }
    }
}

/// Cài đặt tất cả thành phần (deprecated - dùng các command riêng lẻ)
#[command]
pub async fn install_droidrun(window: tauri::Window) -> Result<String, String> {
    use tauri::Emitter;
    
    let total = 3;
    let mut installed = 0;
    let mut errors: Vec<String> = Vec::new();
    
    // Step 1: Install Python 3.12 via winget
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 0,
        "total": total,
        "percent": 0,
        "package": "Đang cài: Python 3.12",
        "status": "installing",
    }));
    
    println!("[INSTALL] Step 1/3: Installing Python 3.12 via winget");
    
    let python_result = new_command("winget")
        .args(["install", "Python.Python.3.12", "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    
    let python_success = match python_result {
        Ok(result) if result.status.success() => {
            println!("[INSTALL] ✓ Python 3.12 installed successfully");
            installed += 1;
            true
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            let stdout = String::from_utf8_lossy(&result.stdout);
            println!("[INSTALL] Python installation output: {}", stdout);
            if stderr.contains("already installed") || stdout.contains("already installed") {
                println!("[INSTALL] ✓ Python 3.12 already installed");
                installed += 1;
                true
            } else {
                println!("[INSTALL] Python installation failed: {}", stderr);
                errors.push(format!("Python 3.12: {}", stderr.chars().take(100).collect::<String>()));
                false
            }
        }
        Err(e) => {
            println!("[INSTALL] Python installation error: {}", e);
            errors.push(format!("Python 3.12: {}", e));
            false
        }
    };
    
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 1,
        "total": total,
        "percent": 33,
        "package": if python_success { "✓ Python 3.12" } else { "✗ Python 3.12" },
        "status": if python_success { "success" } else { "error" },
    }));
    
    // Step 2: Install DroidRun
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 1,
        "total": total,
        "percent": 33,
        "package": "Đang cài: DroidRun Core",
        "status": "installing",
    }));
    
    println!("[INSTALL] Step 2/3: Installing droidrun");
    
    let droidrun_result = new_command("pip")
        .args(["install", "droidrun"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "droidrun"])
                .output()
        });
    
    let droidrun_success = match droidrun_result {
        Ok(result) if result.status.success() => {
            println!("[INSTALL] ✓ DroidRun installed successfully");
            installed += 1;
            true
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            println!("[INSTALL] DroidRun installation failed: {}", stderr);
            errors.push(format!("DroidRun: {}", stderr.chars().take(100).collect::<String>()));
            false
        }
        Err(e) => {
            println!("[INSTALL] DroidRun installation error: {}", e);
            errors.push(format!("DroidRun: {}", e));
            false
        }
    };
    
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 2,
        "total": total,
        "percent": 66,
        "package": if droidrun_success { "✓ DroidRun Core" } else { "✗ DroidRun Core" },
        "status": if droidrun_success { "success" } else { "error" },
    }));
    
    // Step 3: Install llama-index-llms-openai-like only
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 2,
        "total": total,
        "percent": 66,
        "package": "Đang cài: OpenAI-Like Provider",
        "status": "installing",
    }));
    
    println!("[INSTALL] Step 3/3: Installing llama-index-llms-openai-like");
    
    let openai_like_result = new_command("pip")
        .args(["install", "llama-index-llms-openai-like"])
        .output()
        .or_else(|_| {
            new_command("pip3")
                .args(["install", "llama-index-llms-openai-like"])
                .output()
        });
    
    let openai_like_success = match openai_like_result {
        Ok(result) if result.status.success() => {
            println!("[INSTALL] ✓ llama-index-llms-openai-like installed successfully");
            installed += 1;
            true
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            println!("[INSTALL] OpenAI-Like installation failed: {}", stderr);
            errors.push(format!("OpenAI-Like: {}", stderr.chars().take(100).collect::<String>()));
            false
        }
        Err(e) => {
            println!("[INSTALL] OpenAI-Like installation error: {}", e);
            errors.push(format!("OpenAI-Like: {}", e));
            false
        }
    };
    
    let _ = window.emit("install-progress", serde_json::json!({
        "current": 3,
        "total": total,
        "percent": 100,
        "package": if openai_like_success { "✓ OpenAI-Like Provider" } else { "✗ OpenAI-Like Provider" },
        "status": if openai_like_success { "success" } else { "error" },
    }));
    
    // Final progress
    let _ = window.emit("install-progress", serde_json::json!({
        "current": total,
        "total": total,
        "percent": 100,
        "package": "Hoàn tất",
    }));
    
    if installed == total {
        Ok(format!("Cài đặt thành công {} thành phần", installed))
    } else if installed > 0 {
        Ok(format!("Đã cài {} / {} thành phần. Lỗi: {}", installed, total, errors.join("; ")))
    } else {
        Err(format!("Không thể cài đặt. Lỗi: {}. Hãy thử chạy: winget install Python.Python.3.12 && pip install droidrun llama-index-llms-openai-like", errors.join("; ")))
    }
}

/// Mở URL trong browser
#[command]
pub async fn open_url(url: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        new_command("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("Không thể mở URL: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        new_command("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Không thể mở URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        new_command("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Không thể mở URL: {}", e))?;
    }

    Ok(true)
}

/// Lấy thông tin hệ thống
#[command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
}

/// Kiểm tra ADB đã cài đặt chưa
#[command]
pub async fn check_adb_installed() -> Result<bool, String> {
    let result = new_command("adb")
        .args(["version"])
        .output();

    Ok(result.is_ok() && result.unwrap().status.success())
}

/// Lấy phiên bản ADB
#[command]
pub async fn get_adb_version() -> Result<String, String> {
    let output = new_command("adb")
        .args(["version"])
        .output()
        .map_err(|e| format!("Không tìm thấy ADB: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let version = stdout
            .lines()
            .next()
            .unwrap_or("unknown")
            .replace("Android Debug Bridge version ", "")
            .trim()
            .to_string();
        Ok(format!("ADB {}", version))
    } else {
        Err("ADB chưa được cài đặt".to_string())
    }
}

/// Kiểm tra llama-index-llms-openai-like đã cài đặt chưa
pub async fn check_openai_like_installed() -> Result<bool, String> {
    let output = new_command("python")
        .args(["-c", "import llama_index.llms.openai_like"])
        .output()
        .or_else(|_| {
            new_command("python3")
                .args(["-c", "import llama_index.llms.openai_like"])
                .output()
        });

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// Kiểm tra tất cả prerequisites
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct PrerequisiteStatus {
    pub python: ComponentStatus,
    pub droidrun: ComponentStatus,
    pub adb: ComponentStatus,
    pub openai_like: ComponentStatus,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ComponentStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub message: String,
}

#[command]
pub async fn check_all_prerequisites() -> Result<PrerequisiteStatus, String> {
    // Check Python
    let python = match get_python_version().await {
        Ok(version) => ComponentStatus {
            installed: true,
            version: Some(version.clone()),
            message: format!("{} đã cài đặt", version),
        },
        Err(_) => ComponentStatus {
            installed: false,
            version: None,
            message: "Python chưa được cài đặt".to_string(),
        },
    };

    // Check droidrun
    let droidrun = match get_droidrun_version().await {
        Ok(version) => ComponentStatus {
            installed: true,
            version: Some(version.clone()),
            message: format!("droidrun {} đã cài đặt", version),
        },
        Err(_) => ComponentStatus {
            installed: false,
            version: None,
            message: "droidrun chưa được cài đặt".to_string(),
        },
    };

    // Check ADB
    let adb = match get_adb_version().await {
        Ok(version) => ComponentStatus {
            installed: true,
            version: Some(version.clone()),
            message: format!("{} đã cài đặt", version),
        },
        Err(_) => ComponentStatus {
            installed: false,
            version: None,
            message: "ADB chưa được cài đặt".to_string(),
        },
    };

    // Check llama-index-llms-openai-like
    let openai_like = match check_openai_like_installed().await {
        Ok(true) => ComponentStatus {
            installed: true,
            version: None,
            message: "llama-index-llms-openai-like đã cài đặt".to_string(),
        },
        _ => ComponentStatus {
            installed: false,
            version: None,
            message: "llama-index-llms-openai-like chưa được cài đặt".to_string(),
        },
    };

    Ok(PrerequisiteStatus { python, droidrun, adb, openai_like })
}
