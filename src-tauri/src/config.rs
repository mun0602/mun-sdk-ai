// Config Module - Quản lý cấu hình profiles
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::command;

// Hidden credentials for mun-ai provider (not exposed to frontend)
const MUN_AI_BASE_URL: &str = "https://api2.mun-ai.art/v1";
const MUN_AI_API_KEY: &str = "xgMG81v/I1GL8RsVRxBY7Y+qf1ZRRR7AIwwpqmPtcH/JisdcmvS9z5Ro25iW0N+g/UFHiV+9u7IL6VWnzfOAQQ==";

/// Get actual credentials for a provider (injects hidden creds for mun-ai)
pub fn get_provider_credentials(provider_name: &str, base_url: &Option<String>, api_key: &str) -> (String, String) {
    match provider_name {
        "mun-ai" => (MUN_AI_BASE_URL.to_string(), MUN_AI_API_KEY.to_string()),
        _ => (base_url.clone().unwrap_or_else(|| "https://api.openai.com/v1".to_string()), api_key.to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIProvider {
    pub name: String,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub provider: AIProvider,
    pub task: String,
    pub max_steps: i32,
    #[serde(default = "default_vision")]
    pub vision: bool,
    #[serde(default)]
    pub reasoning: bool,
    pub device_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Secure credentials storage (secret_id -> value)
    /// Backend-only: NOT serialized to frontend, only IDs exposed via list_credential_ids
    #[serde(default, skip_serializing)]
    pub credentials: HashMap<String, String>,
    /// App-specific preferences (app_package -> settings)
    /// Stores custom settings for individual apps
    #[serde(default)]
    pub app_preferences: HashMap<String, serde_json::Value>,
    /// Custom workflow variables (variable_name -> value)
    /// User-defined variables available in workflows via {{variable_name}}
    #[serde(default)]
    pub custom_variables: HashMap<String, serde_json::Value>,
}

fn default_vision() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppConfig {
    pub version: String,
    pub active_profile_id: Option<String>,
    pub profiles: Vec<Profile>,
    pub settings: AppSettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub auto_connect: bool,
    pub log_level: String,
    pub max_parallel_devices: i32,
    pub screenshot_quality: i32,
    #[serde(default)]
    pub tracing: TracingConfig,
    #[serde(default)]
    pub emulator_path: Option<String>,
    #[serde(default)]
    pub bluestacks_path: Option<String>,
    #[serde(default)]
    pub scrcpy_path: Option<String>,
    /// Telemetry: Send anonymous usage data to improve the app
    #[serde(default = "default_telemetry_enabled")]
    pub telemetry_enabled: bool,
}

fn default_telemetry_enabled() -> bool {
    true
}

/// Tracing configuration for Phoenix/Langfuse integration
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TracingConfig {
    pub enabled: bool,
    pub provider: String, // "phoenix" | "langfuse" | "none"
    // Phoenix settings
    pub phoenix_url: Option<String>,
    pub phoenix_project_name: Option<String>,
    // Langfuse settings
    pub langfuse_secret_key: Option<String>,
    pub langfuse_public_key: Option<String>,
    pub langfuse_host: Option<String>,
    pub langfuse_user_id: Option<String>,
    // Trajectory recording
    pub save_trajectory: String, // "none" | "step" | "action"
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            language: "vi".to_string(),
            auto_connect: true,
            log_level: "info".to_string(),
            max_parallel_devices: 3,
            screenshot_quality: 80,
            tracing: TracingConfig::default(),
            emulator_path: None,
            bluestacks_path: None,
            scrcpy_path: None,
            telemetry_enabled: true,
        }
    }
}

/// Đường dẫn file config
fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".mun-sdk-ai-v2").join("config.json")
}

/// Load config synchronously (for startup)
pub fn load_config_sync() -> Result<AppConfig, String> {
    let config_path = get_config_path();

    if !config_path.exists() {
        return Ok(AppConfig {
            version: "2.0.0".to_string(),
            active_profile_id: None,
            profiles: vec![],
            settings: AppSettings::default(),
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Không thể đọc config: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Lỗi parse config: {}", e))
}

/// Load cấu hình
#[command]
pub async fn load_config() -> Result<AppConfig, String> {
    let config_path = get_config_path();

    if !config_path.exists() {
        let default_config = AppConfig {
            version: "2.0.0".to_string(),
            active_profile_id: None,
            profiles: vec![],
            settings: AppSettings::default(),
        };
        return Ok(default_config);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Không thể đọc config: {}", e))?;

    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Lỗi parse config: {}", e))?;

    Ok(config)
}

/// Lưu cấu hình
#[command]
pub async fn save_config(config: AppConfig) -> Result<bool, String> {
    let config_path = get_config_path();

    // Tạo thư mục nếu chưa có
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Lỗi serialize: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Không thể lưu config: {}", e))?;

    Ok(true)
}

/// Tạo profile mới
#[command]
pub async fn create_profile(
    id: String,
    name: String,
    provider: AIProvider,
    task: String,
    max_steps: i32,
    vision: bool,
    reasoning: bool,
    device_ids: Vec<String>,
    created_at: String,
    updated_at: String,
) -> Result<Profile, String> {
    let profile = Profile {
        id,
        name: name.clone(),
        provider,
        task,
        max_steps,
        vision,
        reasoning,
        device_ids,
        created_at,
        updated_at,
        credentials: HashMap::new(),
        app_preferences: HashMap::new(),
        custom_variables: HashMap::new(),
    };
    
    let mut config = load_config().await?;

    // Kiểm tra trùng tên
    if config.profiles.iter().any(|p| p.name == profile.name) {
        return Err(format!("Profile '{}' đã tồn tại", profile.name));
    }

    config.profiles.push(profile.clone());
    save_config(config).await?;

    Ok(profile)
}

/// Cập nhật profile
#[command]
pub async fn update_profile(
    id: String,
    name: String,
    provider: AIProvider,
    task: String,
    max_steps: i32,
    vision: bool,
    reasoning: bool,
    device_ids: Vec<String>,
    created_at: String,
    updated_at: String,
) -> Result<Profile, String> {
    let mut config = load_config().await?;

    if let Some(existing) = config.profiles.iter_mut().find(|p| p.id == id) {
        // Preserve credentials and other backend-only fields
        let credentials = existing.credentials.clone();
        let app_preferences = existing.app_preferences.clone();
        let custom_variables = existing.custom_variables.clone();
        
        *existing = Profile {
            id: id.clone(),
            name,
            provider,
            task,
            max_steps,
            vision,
            reasoning,
            device_ids,
            created_at,
            updated_at,
            credentials,
            app_preferences,
            custom_variables,
        };
        
        let result = existing.clone();
        save_config(config).await?;
        Ok(result)
    } else {
        Err(format!("Không tìm thấy profile với ID: {}", id))
    }
}

/// Xóa profile
#[command]
pub async fn delete_profile(profile_id: String) -> Result<bool, String> {
    let mut config = load_config().await?;

    let initial_len = config.profiles.len();
    config.profiles.retain(|p| p.id != profile_id);

    if config.profiles.len() == initial_len {
        return Err(format!("Không tìm thấy profile với ID: {}", profile_id));
    }

    // Reset active profile nếu đang active profile bị xóa
    if config.active_profile_id.as_ref() == Some(&profile_id) {
        config.active_profile_id = None;
    }

    save_config(config).await?;
    Ok(true)
}

/// Set profile active
#[command]
pub async fn set_active_profile(profile_id: String) -> Result<bool, String> {
    let mut config = load_config().await?;

    if !config.profiles.iter().any(|p| p.id == profile_id) {
        return Err(format!("Không tìm thấy profile với ID: {}", profile_id));
    }

    config.active_profile_id = Some(profile_id);
    save_config(config).await?;
    Ok(true)
}

/// Lấy profile active
#[command]
pub async fn get_active_profile() -> Result<Option<Profile>, String> {
    let config = load_config().await?;

    if let Some(active_id) = &config.active_profile_id {
        let profile = config.profiles.iter().find(|p| &p.id == active_id).cloned();
        Ok(profile)
    } else {
        Ok(None)
    }
}

/// Cập nhật settings
#[command]
pub async fn update_settings(settings: AppSettings) -> Result<bool, String> {
    // Update emulator paths in the emulator module
    if let Some(ref path) = settings.emulator_path {
        crate::emulator::set_emulator_path(path.clone());
    }
    if let Some(ref path) = settings.bluestacks_path {
        crate::emulator::set_bluestacks_path(path.clone());
    }
    // Update scrcpy path in the adb module
    if let Some(ref path) = settings.scrcpy_path {
        crate::adb::set_scrcpy_path(path.clone());
    }
    
    let mut config = load_config().await?;
    config.settings = settings;
    save_config(config).await?;
    Ok(true)
}

// ============================================
// Credential Management Functions
// ============================================

/// Get credential value by secret_id from active profile
/// Returns the actual secret value - NEVER log this!
pub async fn get_credential_value(secret_id: &str) -> Result<String, String> {
    let profile = get_active_profile()
        .await?
        .ok_or("No active profile set")?;
    
    profile.credentials
        .get(secret_id)
        .cloned()
        .ok_or_else(|| format!("Credential '{}' not found in profile", secret_id))
}

/// Get all credential IDs (not values) from active profile
/// Safe to expose to frontend
#[command]
pub async fn list_credential_ids() -> Result<Vec<String>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.credentials.keys().cloned().collect()),
        None => Ok(vec![]),
    }
}

/// Add or update a credential in active profile
#[command]
pub async fn set_credential(secret_id: String, secret_value: String) -> Result<bool, String> {
    let mut config = load_config().await?;
    let active_id = config.active_profile_id.clone()
        .ok_or("No active profile set")?;
    
    if let Some(profile) = config.profiles.iter_mut().find(|p| p.id == active_id) {
        profile.credentials.insert(secret_id, secret_value);
        save_config(config).await?;
        Ok(true)
    } else {
        Err("Active profile not found".to_string())
    }
}

/// Delete a credential from active profile
#[command]
pub async fn delete_credential(secret_id: String) -> Result<bool, String> {
    let mut config = load_config().await?;
    let active_id = config.active_profile_id.clone()
        .ok_or("No active profile set")?;
    
    if let Some(profile) = config.profiles.iter_mut().find(|p| p.id == active_id) {
        profile.credentials.remove(&secret_id);
        save_config(config).await?;
        Ok(true)
    } else {
        Err("Active profile not found".to_string())
    }
}

// ============================================
// App Preferences Management
// ============================================

/// Get app preferences for a specific package from active profile
#[command]
pub async fn get_app_preferences(package_name: String) -> Result<Option<serde_json::Value>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.app_preferences.get(&package_name).cloned()),
        None => Ok(None),
    }
}

/// Set app preferences for a specific package in active profile
#[command]
pub async fn set_app_preferences(package_name: String, preferences: serde_json::Value) -> Result<bool, String> {
    let mut config = load_config().await?;
    let active_id = config.active_profile_id.clone()
        .ok_or("No active profile set")?;
    
    if let Some(profile) = config.profiles.iter_mut().find(|p| p.id == active_id) {
        profile.app_preferences.insert(package_name, preferences);
        save_config(config).await?;
        Ok(true)
    } else {
        Err("Active profile not found".to_string())
    }
}

/// List all app preference package names from active profile
#[command]
pub async fn list_app_preference_packages() -> Result<Vec<String>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.app_preferences.keys().cloned().collect()),
        None => Ok(vec![]),
    }
}

// ============================================
// Custom Variables Management
// ============================================

/// Get a custom variable from active profile
#[command]
pub async fn get_custom_variable(variable_name: String) -> Result<Option<serde_json::Value>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.custom_variables.get(&variable_name).cloned()),
        None => Ok(None),
    }
}

/// Get all custom variables from active profile
pub async fn get_all_custom_variables() -> Result<HashMap<String, serde_json::Value>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.custom_variables),
        None => Ok(HashMap::new()),
    }
}

/// Set a custom variable in active profile
#[command]
pub async fn set_custom_variable(variable_name: String, value: serde_json::Value) -> Result<bool, String> {
    let mut config = load_config().await?;
    let active_id = config.active_profile_id.clone()
        .ok_or("No active profile set")?;
    
    if let Some(profile) = config.profiles.iter_mut().find(|p| p.id == active_id) {
        profile.custom_variables.insert(variable_name, value);
        save_config(config).await?;
        Ok(true)
    } else {
        Err("Active profile not found".to_string())
    }
}

/// List all custom variable names from active profile
#[command]
pub async fn list_custom_variables() -> Result<Vec<String>, String> {
    let profile = get_active_profile().await?;
    
    match profile {
        Some(p) => Ok(p.custom_variables.keys().cloned().collect()),
        None => Ok(vec![]),
    }
}
