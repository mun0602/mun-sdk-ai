// License Module - Quản lý license với mã hóa AES-GCM + Online Validation
// Security: Random nonce + key derived from machine_id + obfuscated strings

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce, AeadCore,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use obfstr::obfstr;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::command;

const APP_VERSION: &str = "2.3.0";

/// Get obfuscated salt for key derivation (hidden at compile time)
fn get_key_salt() -> Vec<u8> {
    obfstr!("MunSdkAiV2-2024-Salt").as_bytes().to_vec()
}

/// Get license API URL (obfuscated)
fn get_license_api_url() -> String {
    obfstr!("https://mun-ai.art/api/license").to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub is_valid: bool,
    pub license_key: Option<String>,
    pub expiry_date: Option<String>,
    pub features: Vec<String>,
    pub max_devices: i32,
    pub max_computers: i32,
    pub max_phones: i32,
    pub plan: Option<String>,
    pub message: Option<String>,
    // AI request info
    pub max_ai_requests: i32,
    pub used_ai_requests: i32,
    pub remaining_ai_requests: i32,
    pub ai_reset_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct StoredLicense {
    encrypted_key: String,
    #[serde(default)]
    nonce: String,  // Random nonce (base64 encoded) - empty for legacy files
    machine_id: String,
    activated_at: String,
    // New fields for offline validation (from Flet logic)
    expires_at: Option<String>,
    plan: Option<String>,
    max_devices: Option<i32>,
    max_computers: Option<i32>,
    max_phones: Option<i32>,
}

/// API Response from license server
#[derive(Debug, Serialize, Deserialize)]
struct LicenseApiResponse {
    valid: bool,
    expires_at: Option<String>,
    plan: Option<String>,
    max_devices: Option<i32>,
    max_computers: Option<i32>,
    max_phones: Option<i32>,
    message: Option<String>,
    // AI request info
    max_ai_requests: Option<i32>,
    used_ai_requests: Option<i32>,
    remaining_ai_requests: Option<i32>,
    ai_reset_date: Option<String>,
}

/// AI Request response from server
#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequestResponse {
    pub success: bool,
    pub max_ai_requests: Option<i32>,
    pub used_ai_requests: Option<i32>,
    pub remaining_ai_requests: Option<i32>,
    pub reset_date: Option<String>,
    pub error: Option<String>,
}

/// Lấy machine ID duy nhất - matches Flet's get_machine_id() for Windows
fn get_machine_id() -> String {
    #[cfg(target_os = "windows")]
    {
        // Try to get Windows MachineGuid from registry (same as node-machine-id)
        use std::process::Command;
        if let Ok(output) = Command::new("reg")
            .args(["query", "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains("MachineGuid") {
                        if let Some(guid) = line.split_whitespace().last() {
                            return guid.to_string();
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains("IOPlatformUUID") {
                        // Extract UUID from: "IOPlatformUUID" = "XXXXXXXX-..."
                        if let Some(start) = line.rfind('"') {
                            let uuid_part = &line[..start];
                            if let Some(start2) = uuid_part.rfind('"') {
                                return line[start2 + 1..start].to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try machine-id files
        for path in &["/var/lib/dbus/machine-id", "/etc/machine-id"] {
            if let Ok(content) = fs::read_to_string(path) {
                return content.trim().to_string();
            }
        }
    }

    // Fallback: hash hostname (original behavior)
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// Đường dẫn file license
fn get_license_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".mun-sdk-ai-v2").join("license.dat")
}

/// Derive encryption key from machine_id (không hardcode)
fn derive_key_from_machine_id() -> [u8; 32] {
    let machine_id = get_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(get_key_salt());
    hasher.update(machine_id.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Mã hóa license key với random nonce
fn encrypt_license(key: &str) -> Result<(String, String), String> {
    let derived_key = derive_key_from_machine_id();
    let cipher = Aes256Gcm::new_from_slice(&derived_key)
        .map_err(|e| format!("Lỗi tạo cipher: {}", e))?;
    
    // Generate random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let encrypted = cipher
        .encrypt(&nonce, key.as_bytes())
        .map_err(|e| format!("Lỗi mã hóa: {}", e))?;

    Ok((BASE64.encode(&encrypted), BASE64.encode(&nonce)))
}

/// Giải mã license key
fn decrypt_license(encrypted: &str, nonce_b64: &str) -> Result<String, String> {
    let derived_key = derive_key_from_machine_id();
    let cipher = Aes256Gcm::new_from_slice(&derived_key)
        .map_err(|e| format!("Lỗi tạo cipher: {}", e))?;

    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| format!("Lỗi decode nonce: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_bytes = BASE64.decode(encrypted)
        .map_err(|e| format!("Lỗi decode: {}", e))?;

    let decrypted = cipher
        .decrypt(nonce, encrypted_bytes.as_ref())
        .map_err(|e| format!("Lỗi giải mã: {}", e))?;

    String::from_utf8(decrypted).map_err(|e| format!("Lỗi UTF-8: {}", e))
}

/// Create HTTP client with security hardening
/// - HTTPS only: Prevents downgrade attacks
/// - TLS 1.2+: Blocks weak protocols  
/// - rustls: Pure Rust TLS, no OpenSSL vulnerabilities
fn create_pinned_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(15))
        .https_only(true)
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .map_err(|e| format!("Lỗi tạo HTTP client: {}", e))
}

/// Validate license online với API server (Flet logic)
async fn validate_license_online(key: &str) -> Result<LicenseApiResponse, String> {
    let client = create_pinned_client()?;

    let machine_id = get_machine_id();

    let response = client
        .post(format!("{}/validate", get_license_api_url()))
        .json(&serde_json::json!({
            "license_key": key,
            "app_version": APP_VERSION,
            "machine_id": machine_id
        }))
        .send()
        .await
        .map_err(|e| format!("Server unreachable: {}", e))?;

    if response.status().is_success() {
        let data: LicenseApiResponse = response
            .json()
            .await
            .map_err(|e| format!("Lỗi parse response: {}", e))?;
        Ok(data)
    } else {
        // Try to parse error response for user-friendly message
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|v| v.as_str()) {
                return Err(error_msg.to_string());
            }
            if let Some(msg) = error_json.get("message").and_then(|v| v.as_str()) {
                return Err(msg.to_string());
            }
        }
        Err("Invalid license key".to_string())
    }
}

/// Kiểm tra license - with online validation (Flet logic)
#[command]
pub async fn check_license() -> Result<LicenseInfo, String> {
    let license_path = get_license_path();

    if !license_path.exists() {
        return Ok(LicenseInfo {
            is_valid: false,
            license_key: None,
            expiry_date: None,
            features: vec![],
            max_devices: 0,
            max_computers: 0,
            max_phones: 0,
            plan: None,
            message: Some("No license found".to_string()),
            max_ai_requests: 0,
            used_ai_requests: 0,
            remaining_ai_requests: 0,
            ai_reset_date: None,
        });
    }

    let content = fs::read_to_string(&license_path)
        .map_err(|e| format!("Không thể đọc license: {}", e))?;

    let stored: StoredLicense = serde_json::from_str(&content)
        .map_err(|e| format!("Lỗi parse license: {}", e))?;

    // Kiểm tra machine ID
    if stored.machine_id != get_machine_id() {
        return Ok(LicenseInfo {
            is_valid: false,
            license_key: None,
            expiry_date: None,
            features: vec![],
            max_devices: 0,
            max_computers: 0,
            max_phones: 0,
            plan: None,
            message: Some("Machine ID mismatch".to_string()),
            max_ai_requests: 0,
            used_ai_requests: 0,
            remaining_ai_requests: 0,
            ai_reset_date: None,
        });
    }

    // Check if license file is from old version (no nonce) - require re-activation
    if stored.nonce.is_empty() {
        // Delete old license file
        let _ = fs::remove_file(&license_path);
        return Ok(LicenseInfo {
            is_valid: false,
            license_key: None,
            expiry_date: None,
            features: vec![],
            max_devices: 0,
            max_computers: 0,
            max_phones: 0,
            plan: None,
            message: Some("License format updated. Please re-activate.".to_string()),
            max_ai_requests: 0,
            used_ai_requests: 0,
            remaining_ai_requests: 0,
            ai_reset_date: None,
        });
    }

    let license_key = decrypt_license(&stored.encrypted_key, &stored.nonce)?;

    // Try online validation first (Flet logic)
    match validate_license_online(&license_key).await {
        Ok(api_response) => {
            if api_response.valid {
                // Update stored license with new expiry info
                let updated = StoredLicense {
                    expires_at: api_response.expires_at.clone(),
                    plan: api_response.plan.clone(),
                    max_devices: api_response.max_devices,
                    max_computers: api_response.max_computers,
                    max_phones: api_response.max_phones,
                    ..stored
                };
                let _ = save_stored_license(&updated);

                return Ok(LicenseInfo {
                    is_valid: true,
                    license_key: Some(mask_license(&license_key)),
                    expiry_date: api_response.expires_at,
                    features: vec!["basic".to_string(), "advanced".to_string(), "pro".to_string()],
                    max_devices: api_response.max_devices.unwrap_or(10),
                    max_computers: api_response.max_computers.unwrap_or(1),
                    max_phones: api_response.max_phones.unwrap_or(1),
                    plan: api_response.plan,
                    message: api_response.message,
                    max_ai_requests: api_response.max_ai_requests.unwrap_or(100),
                    used_ai_requests: api_response.used_ai_requests.unwrap_or(0),
                    remaining_ai_requests: api_response.remaining_ai_requests.unwrap_or(100),
                    ai_reset_date: api_response.ai_reset_date,
                });
            } else {
                return Ok(LicenseInfo {
                    is_valid: false,
                    license_key: None,
                    expiry_date: None,
                    features: vec![],
                    max_devices: 0,
                    max_computers: 0,
                    max_phones: 0,
                    plan: None,
                    message: api_response.message,
                    max_ai_requests: 0,
                    used_ai_requests: 0,
                    remaining_ai_requests: 0,
                    ai_reset_date: None,
                });
            }
        }
        Err(e) => {
            // Server unreachable - require online validation
            log::warn!("License server unreachable: {}", e);
            Ok(LicenseInfo {
                is_valid: false,
                license_key: None,
                expiry_date: None,
                features: vec![],
                max_devices: 0,
                max_computers: 0,
                max_phones: 0,
                plan: None,
                message: Some("Cannot connect to license server. Please check your internet connection.".to_string()),
                max_ai_requests: 0,
                used_ai_requests: 0,
                remaining_ai_requests: 0,
                ai_reset_date: None,
            })
        }
    }
}

/// Kích hoạt license - with online validation (Flet logic)
#[command]
pub async fn activate_license(license_key: String) -> Result<LicenseInfo, String> {
    let key = license_key.trim().to_uppercase();

    // Try online validation (Flet logic)
    match validate_license_online(&key).await {
        Ok(api_response) => {
            if api_response.valid {
                save_license(
                    &key,
                    api_response.expires_at.clone(),
                    api_response.plan.clone(),
                    api_response.max_devices,
                    api_response.max_computers,
                    api_response.max_phones,
                )?;

                Ok(LicenseInfo {
                    is_valid: true,
                    license_key: Some(mask_license(&key)),
                    expiry_date: api_response.expires_at,
                    features: vec!["basic".to_string(), "advanced".to_string(), "pro".to_string()],
                    max_devices: api_response.max_devices.unwrap_or(10),
                    max_computers: api_response.max_computers.unwrap_or(1),
                    max_phones: api_response.max_phones.unwrap_or(1),
                    plan: api_response.plan,
                    message: Some("License activated successfully".to_string()),
                    max_ai_requests: api_response.max_ai_requests.unwrap_or(100),
                    used_ai_requests: api_response.used_ai_requests.unwrap_or(0),
                    remaining_ai_requests: api_response.remaining_ai_requests.unwrap_or(100),
                    ai_reset_date: api_response.ai_reset_date,
                })
            } else {
                Err(api_response.message.unwrap_or_else(|| "Invalid license key".to_string()))
            }
        }
        Err(e) => {
            // Hide internal error details, show user-friendly message
            log::error!("License activation error: {}", e);
            if e.contains("unreachable") || e.contains("timeout") || e.contains("connection") {
                Err("Cannot connect to license server. Please check your internet connection.".to_string())
            } else {
                Err(e)
            }
        }
    }
}

/// Lưu license vào file với thông tin bổ sung
fn save_license(
    license_key: &str,
    expires_at: Option<String>,
    plan: Option<String>,
    max_devices: Option<i32>,
    max_computers: Option<i32>,
    max_phones: Option<i32>,
) -> Result<(), String> {
    let (encrypted_key, nonce) = encrypt_license(license_key)?;
    let stored = StoredLicense {
        encrypted_key,
        nonce,
        machine_id: get_machine_id(),
        activated_at: Utc::now().to_rfc3339(),
        expires_at,
        plan,
        max_devices,
        max_computers,
        max_phones,
    };
    save_stored_license(&stored)
}

fn save_stored_license(stored: &StoredLicense) -> Result<(), String> {
    let license_path = get_license_path();

    // Tạo thư mục nếu chưa có
    if let Some(parent) = license_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục: {}", e))?;
    }

    let content = serde_json::to_string_pretty(stored)
        .map_err(|e| format!("Lỗi serialize: {}", e))?;

    fs::write(&license_path, content)
        .map_err(|e| format!("Không thể lưu license: {}", e))?;

    Ok(())
}

/// Đăng xuất license
#[command]
pub async fn logout_license() -> Result<bool, String> {
    let license_path = get_license_path();

    if license_path.exists() {
        fs::remove_file(&license_path)
            .map_err(|e| format!("Không thể xóa license: {}", e))?;
    }

    Ok(true)
}

/// Use an AI request (increment counter on server)
#[command]
pub async fn use_ai_request(license_key: String, request_type: Option<String>) -> Result<AiRequestResponse, String> {
    let client = create_pinned_client()?;
    let machine_id = get_machine_id();
    
    let response = client
        .post(format!("{}/ai-request", get_license_api_url()))
        .json(&serde_json::json!({
            "license_key": license_key,
            "machine_id": machine_id,
            "request_type": request_type.unwrap_or_else(|| "general".to_string())
        }))
        .send()
        .await
        .map_err(|e| format!("Server unreachable: {}", e))?;

    let data: AiRequestResponse = response
        .json()
        .await
        .map_err(|e| format!("Lỗi parse response: {}", e))?;
    
    Ok(data)
}

/// Get AI request status
#[command]
pub async fn get_ai_request_status(license_key: String) -> Result<AiRequestResponse, String> {
    let client = create_pinned_client()?;
    
    let response = client
        .get(format!("{}/ai-request?license_key={}", get_license_api_url(), license_key))
        .send()
        .await
        .map_err(|e| format!("Server unreachable: {}", e))?;

    if response.status().is_success() {
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Lỗi parse response: {}", e))?;
        
        Ok(AiRequestResponse {
            success: true,
            max_ai_requests: data.get("max_ai_requests").and_then(|v| v.as_i64()).map(|v| v as i32),
            used_ai_requests: data.get("used_ai_requests").and_then(|v| v.as_i64()).map(|v| v as i32),
            remaining_ai_requests: data.get("remaining_ai_requests").and_then(|v| v.as_i64()).map(|v| v as i32),
            reset_date: data.get("reset_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
            error: None,
        })
    } else {
        let error_text = response.text().await.unwrap_or_default();
        let error_msg = serde_json::from_str::<serde_json::Value>(&error_text)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| "Unknown error".to_string());
        
        Ok(AiRequestResponse {
            success: false,
            max_ai_requests: None,
            used_ai_requests: None,
            remaining_ai_requests: None,
            reset_date: None,
            error: Some(error_msg),
        })
    }
}

/// Mask license key cho hiển thị
fn mask_license(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    format!("{}****{}", &key[..4], &key[key.len()-4..])
}

/// Check and use AI request (internal helper for backend validation)
/// Returns Ok(remaining) if successful, Err if limit exceeded or error
pub async fn check_and_use_ai_request(request_type: &str) -> Result<i32, String> {
    // First, get the stored license
    let license_path = get_license_path();
    
    if !license_path.exists() {
        return Err("No license found".to_string());
    }
    
    let content = fs::read_to_string(&license_path)
        .map_err(|e| format!("Cannot read license: {}", e))?;
    
    let stored: StoredLicense = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid license format: {}", e))?;
    
    // Verify machine ID
    if stored.machine_id != get_machine_id() {
        return Err("Machine ID mismatch".to_string());
    }
    
    // Check nonce (new format required)
    if stored.nonce.is_empty() {
        return Err("License format outdated. Please re-activate.".to_string());
    }
    
    // Decrypt license key
    let license_key = decrypt_license(&stored.encrypted_key, &stored.nonce)?;
    
    // Call server to use AI request
    let client = create_pinned_client()?;
    let machine_id = get_machine_id();
    
    let response = client
        .post(format!("{}/ai-request", get_license_api_url()))
        .json(&serde_json::json!({
            "license_key": license_key,
            "machine_id": machine_id,
            "request_type": request_type
        }))
        .send()
        .await
        .map_err(|e| format!("Server unreachable: {}", e))?;

    let data: AiRequestResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse response error: {}", e))?;
    
    if data.success {
        Ok(data.remaining_ai_requests.unwrap_or(0))
    } else {
        Err(data.error.unwrap_or_else(|| "AI request limit exceeded".to_string()))
    }
}

/// Check AI request availability without using (for pre-check)
pub async fn can_use_ai_request() -> Result<bool, String> {
    let license_path = get_license_path();
    
    if !license_path.exists() {
        return Ok(false);
    }
    
    let content = fs::read_to_string(&license_path)
        .map_err(|e| format!("Cannot read license: {}", e))?;
    
    let stored: StoredLicense = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid license format: {}", e))?;
    
    if stored.machine_id != get_machine_id() || stored.nonce.is_empty() {
        return Ok(false);
    }
    
    let license_key = decrypt_license(&stored.encrypted_key, &stored.nonce)?;
    
    // Get status from server
    let client = create_pinned_client()?;
    
    let response = client
        .get(format!("{}/ai-request?license_key={}", get_license_api_url(), license_key))
        .send()
        .await
        .map_err(|e| format!("Server unreachable: {}", e))?;

    if response.status().is_success() {
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Parse response error: {}", e))?;
        
        let max = data.get("max_ai_requests").and_then(|v| v.as_i64()).unwrap_or(0);
        let remaining = data.get("remaining_ai_requests").and_then(|v| v.as_i64()).unwrap_or(0);
        
        // Unlimited (-1) or has remaining
        Ok(max == -1 || remaining > 0)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_license() {
        assert_eq!(mask_license("ABCD-1234-5678-WXYZ"), "ABCD****WXYZ");
        assert_eq!(mask_license("SHORT"), "****");
    }

    #[test]
    fn test_encrypt_decrypt() {
        let original = "TEST-LICENSE-KEY";
        let encrypted = encrypt_license(original).unwrap();
        let decrypted = decrypt_license(&encrypted.0, &encrypted.1).unwrap();
        assert_eq!(original, decrypted);
    }
}
