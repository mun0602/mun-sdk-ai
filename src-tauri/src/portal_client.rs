// Portal Client - HTTP REST API client for DroidRun Portal
// Điều khiển Android device qua HTTP thay vì ADB commands

#![allow(dead_code)]

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// DroidRun Portal Client - Kết nối qua HTTP REST API
#[derive(Clone)]
pub struct PortalClient {
    client: Client,
    device_id: String,
    base_url: String,
    port: u16,
}

// ============================================
// Response Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct PingResponse {
    pub status: String,
    pub version: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StateResponse {
    pub a11y_tree: Vec<UIElement>,
    pub phone_state: PhoneState,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UIElement {
    pub index: Option<i32>,
    #[serde(rename = "className")]
    pub class_name: Option<String>,
    pub text: Option<String>,
    pub bounds: Option<String>,
    pub clickable: Option<bool>,
    pub children: Option<Vec<UIElement>>,
    #[serde(rename = "contentDesc")]
    pub content_desc: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhoneState {
    pub current_activity: Option<String>,
    pub keyboard_shown: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ActionResponse {
    pub success: bool,
    pub message: Option<String>,
}

impl PortalClient {
    /// Tạo client mới cho device
    /// 
    /// # Arguments
    /// * `device_id` - Device serial (e.g. "emulator-5554", "192.168.1.100:5555")
    /// * `port` - Portal port (default: 8080)
    /// 
    /// # Example
    /// ```
    /// let client = PortalClient::new("emulator-5554", 8080);
    /// ```
    pub fn new(device_id: &str, port: u16) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(5)
            .build()
            .expect("Failed to create HTTP client");
        
        // Cần port forwarding để truy cập Portal từ localhost
        let base_url = format!("http://localhost:{}", port);
        
        Self {
            client,
            device_id: device_id.to_string(),
            base_url,
            port,
        }
    }
    
    /// Setup port forwarding từ localhost tới device Portal
    /// Cần gọi trước khi sử dụng client
    pub async fn setup_port_forward(&self) -> Result<(), String> {
        use tokio::process::Command;
        
        // Forward local port → device port 8080
        let output = Command::new("adb")
            .args(["-s", &self.device_id, "forward", &format!("tcp:{}", self.port), "tcp:8080"])
            .output()
            .await
            .map_err(|e| format!("Port forward error: {}", e))?;
        
        if output.status.success() {
            println!("[PortalClient] Port forward established: localhost:{} → device:8080", self.port);
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Port forward failed: {}", stderr))
        }
    }
    
    /// Ping Portal để kiểm tra kết nối
    pub async fn ping(&self) -> Result<PingResponse, String> {
        let url = format!("{}/ping", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Ping error: {}", e))?;
        
        if response.status().is_success() {
            response.json::<PingResponse>()
                .await
                .map_err(|e| format!("Parse ping response error: {}", e))
        } else {
            Err(format!("Ping failed: {}", response.status()))
        }
    }
    
    // ============================================
    // UI Actions
    // ============================================
    
    /// Tap tại tọa độ
    pub async fn tap(&self, x: i32, y: i32) -> Result<(), String> {
        let url = format!("{}/action/tap", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({
                "x": x,
                "y": y
            }))
            .send()
            .await
            .map_err(|e| format!("Tap error: {}", e))?;
        
        if response.status().is_success() {
            println!("[PortalClient] Tap at ({}, {})", x, y);
            Ok(())
        } else {
            Err(format!("Tap failed: {}", response.status()))
        }
    }
    
    /// Tap element theo index (từ accessibility tree)
    pub async fn tap_by_index(&self, index: i32) -> Result<String, String> {
        let url = format!("{}/action/tap_index", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({
                "index": index
            }))
            .send()
            .await
            .map_err(|e| format!("Tap by index error: {}", e))?;
        
        if response.status().is_success() {
            let result: ActionResponse = response.json().await
                .map_err(|e| format!("Parse response error: {}", e))?;
            Ok(result.message.unwrap_or_else(|| format!("Tapped element {}", index)))
        } else {
            Err(format!("Tap by index failed: {}", response.status()))
        }
    }
    
    /// Swipe gesture
    pub async fn swipe(&self, x1: i32, y1: i32, x2: i32, y2: i32, duration_ms: i32) -> Result<(), String> {
        let url = format!("{}/action/swipe", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({
                "start_x": x1,
                "start_y": y1,
                "end_x": x2,
                "end_y": y2,
                "duration_ms": duration_ms
            }))
            .send()
            .await
            .map_err(|e| format!("Swipe error: {}", e))?;
        
        if response.status().is_success() {
            println!("[PortalClient] Swipe ({},{}) → ({},{}) in {}ms", x1, y1, x2, y2, duration_ms);
            Ok(())
        } else {
            Err(format!("Swipe failed: {}", response.status()))
        }
    }
    
    /// Swipe lên (scroll xuống)
    pub async fn swipe_up(&self) -> Result<(), String> {
        self.swipe(500, 1500, 500, 500, 300).await
    }
    
    /// Swipe xuống (scroll lên)
    pub async fn swipe_down(&self) -> Result<(), String> {
        self.swipe(500, 500, 500, 1500, 300).await
    }
    
    /// Swipe trái
    pub async fn swipe_left(&self) -> Result<(), String> {
        self.swipe(800, 960, 200, 960, 300).await
    }
    
    /// Swipe phải
    pub async fn swipe_right(&self) -> Result<(), String> {
        self.swipe(200, 960, 800, 960, 300).await
    }
    
    /// Nhập text
    pub async fn input_text(&self, text: &str, index: Option<i32>, clear: bool) -> Result<(), String> {
        let url = format!("{}/action/input", self.base_url);
        
        let mut body = serde_json::json!({
            "text": text,
            "clear": clear
        });
        
        if let Some(idx) = index {
            body["index"] = serde_json::json!(idx);
        }
        
        let response = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Input text error: {}", e))?;
        
        if response.status().is_success() {
            println!("[PortalClient] Input text: '{}'", text);
            Ok(())
        } else {
            Err(format!("Input text failed: {}", response.status()))
        }
    }
    
    /// Press key (BACK, HOME, ENTER, DELETE, ...)
    pub async fn press_key(&self, keycode: i32) -> Result<(), String> {
        let url = format!("{}/action/key", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({
                "keycode": keycode
            }))
            .send()
            .await
            .map_err(|e| format!("Press key error: {}", e))?;
        
        if response.status().is_success() {
            println!("[PortalClient] Press key: {}", keycode);
            Ok(())
        } else {
            Err(format!("Press key failed: {}", response.status()))
        }
    }
    
    /// Press BACK
    pub async fn back(&self) -> Result<(), String> {
        self.press_key(4).await
    }
    
    /// Press HOME
    pub async fn home(&self) -> Result<(), String> {
        self.press_key(3).await
    }
    
    /// Press ENTER
    pub async fn enter(&self) -> Result<(), String> {
        self.press_key(66).await
    }
    
    // ============================================
    // App Management
    // ============================================
    
    /// Mở app theo package name
    pub async fn start_app(&self, package: &str, activity: Option<&str>) -> Result<(), String> {
        let url = format!("{}/action/start_app", self.base_url);
        
        let mut body = serde_json::json!({
            "package": package
        });
        
        if let Some(act) = activity {
            body["activity"] = serde_json::json!(act);
        }
        
        let response = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Start app error: {}", e))?;
        
        if response.status().is_success() {
            println!("[PortalClient] Started app: {}", package);
            Ok(())
        } else {
            Err(format!("Start app failed: {}", response.status()))
        }
    }
    
    // ============================================
    // State & Screenshot
    // ============================================
    
    /// Lấy UI state (accessibility tree + phone state)
    pub async fn get_state(&self) -> Result<StateResponse, String> {
        let url = format!("{}/state", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Get state error: {}", e))?;
        
        if response.status().is_success() {
            response.json::<StateResponse>()
                .await
                .map_err(|e| format!("Parse state error: {}", e))
        } else {
            Err(format!("Get state failed: {}", response.status()))
        }
    }
    
    /// Chụp screenshot
    pub async fn screenshot(&self) -> Result<Vec<u8>, String> {
        let url = format!("{}/screenshot", self.base_url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Screenshot error: {}", e))?;
        
        if response.status().is_success() {
            let bytes = response.bytes()
                .await
                .map_err(|e| format!("Screenshot bytes error: {}", e))?;
            Ok(bytes.to_vec())
        } else {
            Err(format!("Screenshot failed: {}", response.status()))
        }
    }
    
    // ============================================
    // Element Finding
    // ============================================
    
    /// Tìm element theo text
    pub async fn find_element_by_text(&self, text: &str) -> Result<Option<UIElement>, String> {
        let state = self.get_state().await?;
        
        fn find_in_tree(elements: &[UIElement], text: &str) -> Option<UIElement> {
            for elem in elements {
                if let Some(elem_text) = &elem.text {
                    if elem_text.contains(text) {
                        return Some(elem.clone());
                    }
                }
                if let Some(children) = &elem.children {
                    if let Some(found) = find_in_tree(children, text) {
                        return Some(found);
                    }
                }
            }
            None
        }
        
        Ok(find_in_tree(&state.a11y_tree, text))
    }
    
    /// Tap element theo text
    pub async fn tap_element_by_text(&self, text: &str) -> Result<(), String> {
        if let Some(element) = self.find_element_by_text(text).await? {
            if let Some(bounds) = &element.bounds {
                // Parse bounds "left,top,right,bottom"
                let parts: Vec<i32> = bounds.split(',')
                    .filter_map(|s| s.parse().ok())
                    .collect();
                
                if parts.len() == 4 {
                    let center_x = (parts[0] + parts[2]) / 2;
                    let center_y = (parts[1] + parts[3]) / 2;
                    return self.tap(center_x, center_y).await;
                }
            }
            if let Some(index) = element.index {
                return self.tap_by_index(index).await.map(|_| ());
            }
            Err(format!("Element '{}' found but cannot determine coordinates", text))
        } else {
            Err(format!("Element with text '{}' not found", text))
        }
    }
}

// ============================================
// Helper functions
// ============================================

/// Tìm port trống để forward
pub fn find_available_port(start: u16) -> u16 {
    use std::net::TcpListener;
    
    for port in start..start + 100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    start
}

/// Tạo PortalClient với auto port forward
pub async fn create_portal_client(device_id: &str) -> Result<PortalClient, String> {
    let port = find_available_port(18080);
    let client = PortalClient::new(device_id, port);
    
    // Setup port forward
    client.setup_port_forward().await?;
    
    // Verify connection
    match client.ping().await {
        Ok(response) => {
            println!("[PortalClient] Connected to Portal v{}", response.version.unwrap_or_default());
            Ok(client)
        }
        Err(e) => {
            Err(format!("Cannot connect to Portal: {}. Make sure DroidRun Portal is installed and running.", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_find_available_port() {
        let port = find_available_port(18080);
        assert!(port >= 18080);
    }
}
