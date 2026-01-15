# Điều khiển Android qua HTTP REST API

## 🎯 Tổng quan

Thay vì gọi ADB commands trực tiếp (chậm), bạn có thể điều khiển Android device qua **HTTP REST API** sử dụng **DroidRun Portal**.

## 🔧 Cách hoạt động

```
[Workflow Engine] → [HTTP Request] → [DroidRun Portal :8080] → [Android Device]
                          ↓
                    localhost:18080  (port forward)
                          ↓
                    device:8080 (Portal)
```

### So sánh tốc độ

| Method | Tap | Swipe | Input Text | Open App |
|--------|-----|-------|------------|----------|
| **ADB (cũ)** | 200-300ms | 250-350ms | 300-500ms | 500-800ms |
| **Portal API (mới)** | 20-50ms | 30-60ms | 50-100ms | 100-200ms |
| **Cải thiện** | **5-6x** | **5-6x** | **5-6x** | **4-5x** |

## 📚 API Reference

### Base URL
```
http://localhost:{port}
```
Port mặc định: `18080` (sau khi forward)

### Endpoints

#### 1. Ping - Kiểm tra kết nối
```http
GET /ping
```
Response:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

#### 2. Get State - Lấy UI state
```http
GET /state
```
Response:
```json
{
  "a11y_tree": [
    {
      "index": 0,
      "className": "android.widget.Button",
      "text": "Login",
      "bounds": "100,200,300,400",
      "clickable": true
    }
  ],
  "phone_state": {
    "current_activity": "com.example.app/.MainActivity",
    "keyboard_shown": false
  }
}
```

#### 3. Tap - Tap tại tọa độ
```http
POST /action/tap
Content-Type: application/json

{
  "x": 540,
  "y": 1200
}
```

#### 4. Tap by Index - Tap element theo index
```http
POST /action/tap_index
Content-Type: application/json

{
  "index": 5
}
```

#### 5. Swipe - Vuốt màn hình
```http
POST /action/swipe
Content-Type: application/json

{
  "start_x": 500,
  "start_y": 1500,
  "end_x": 500,
  "end_y": 500,
  "duration_ms": 300
}
```

#### 6. Input Text - Nhập text
```http
POST /action/input
Content-Type: application/json

{
  "text": "Hello World",
  "index": 5,    // Optional: element index
  "clear": true  // Optional: clear existing text
}
```

#### 7. Press Key - Nhấn phím
```http
POST /action/key
Content-Type: application/json

{
  "keycode": 4
}
```

**Keycodes phổ biến:**
- `3`: HOME
- `4`: BACK
- `66`: ENTER
- `67`: DELETE

#### 8. Start App - Mở ứng dụng
```http
POST /action/start_app
Content-Type: application/json

{
  "package": "com.android.settings",
  "activity": ".Settings"  // Optional
}
```

#### 9. Screenshot - Chụp màn hình
```http
GET /screenshot
```
Response: PNG image bytes

## 🛠️ Setup

### Bước 1: Cài DroidRun Portal

```bash
# Cài droidrun
pip install droidrun

# Setup Portal trên device
droidrun setup -d <device_id>
```

### Bước 2: Forward Port

```bash
# Forward local port → device port 8080
adb -s <device_id> forward tcp:18080 tcp:8080
```

### Bước 3: Test Connection

```bash
curl http://localhost:18080/ping
```

Expected response:
```json
{"status": "ok", "version": "1.0.0"}
```

## 📝 Code Examples

### Rust (sử dụng reqwest)

```rust
use reqwest::Client;

async fn tap(x: i32, y: i32) -> Result<(), String> {
    let client = Client::new();
    
    let response = client
        .post("http://localhost:18080/action/tap")
        .json(&serde_json::json!({
            "x": x,
            "y": y
        }))
        .send()
        .await
        .map_err(|e| format!("Tap error: {}", e))?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Tap failed: {}", response.status()))
    }
}
```

### Python

```python
import requests

def tap(x: int, y: int):
    response = requests.post(
        "http://localhost:18080/action/tap",
        json={"x": x, "y": y}
    )
    return response.ok

def swipe_up():
    response = requests.post(
        "http://localhost:18080/action/swipe",
        json={
            "start_x": 500,
            "start_y": 1500,
            "end_x": 500,
            "end_y": 500,
            "duration_ms": 300
        }
    )
    return response.ok

def input_text(text: str, clear: bool = False):
    response = requests.post(
        "http://localhost:18080/action/input",
        json={"text": text, "clear": clear}
    )
    return response.ok

def open_app(package: str):
    response = requests.post(
        "http://localhost:18080/action/start_app",
        json={"package": package}
    )
    return response.ok

def back():
    response = requests.post(
        "http://localhost:18080/action/key",
        json={"keycode": 4}
    )
    return response.ok
```

### JavaScript/TypeScript

```typescript
const BASE_URL = "http://localhost:18080";

async function tap(x: number, y: number): Promise<void> {
    await fetch(`${BASE_URL}/action/tap`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ x, y })
    });
}

async function swipeUp(): Promise<void> {
    await fetch(`${BASE_URL}/action/swipe`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            start_x: 500,
            start_y: 1500,
            end_x: 500,
            end_y: 500,
            duration_ms: 300
        })
    });
}

async function getState(): Promise<any> {
    const response = await fetch(`${BASE_URL}/state`);
    return response.json();
}

async function tapElementByText(text: string): Promise<void> {
    const state = await getState();
    const element = findElementByText(state.a11y_tree, text);
    
    if (element) {
        const bounds = element.bounds.split(",").map(Number);
        const centerX = (bounds[0] + bounds[2]) / 2;
        const centerY = (bounds[1] + bounds[3]) / 2;
        await tap(centerX, centerY);
    } else {
        throw new Error(`Element "${text}" not found`);
    }
}

function findElementByText(elements: any[], text: string): any {
    for (const elem of elements) {
        if (elem.text?.includes(text)) {
            return elem;
        }
        if (elem.children) {
            const found = findElementByText(elem.children, text);
            if (found) return found;
        }
    }
    return null;
}
```

### cURL

```bash
# Ping
curl http://localhost:18080/ping

# Tap
curl -X POST http://localhost:18080/action/tap \
  -H "Content-Type: application/json" \
  -d '{"x": 540, "y": 1200}'

# Swipe up
curl -X POST http://localhost:18080/action/swipe \
  -H "Content-Type: application/json" \
  -d '{"start_x": 500, "start_y": 1500, "end_x": 500, "end_y": 500, "duration_ms": 300}'

# Input text
curl -X POST http://localhost:18080/action/input \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World"}'

# Press back
curl -X POST http://localhost:18080/action/key \
  -H "Content-Type: application/json" \
  -d '{"keycode": 4}'

# Open app
curl -X POST http://localhost:18080/action/start_app \
  -H "Content-Type: application/json" \
  -d '{"package": "com.android.settings"}'

# Get UI state
curl http://localhost:18080/state

# Screenshot (save to file)
curl http://localhost:18080/screenshot -o screenshot.png
```

## 🔧 Workflow Engine V2

Dự án đã có sẵn implementation trong:

- **Portal Client**: `src-tauri/src/portal_client.rs`
- **Workflow V2**: `src-tauri/src/workflow_v2.rs`

### Sử dụng trong Workflow:

```javascript
// workflow.json
{
  "id": "example-workflow",
  "name": "Example",
  "steps": [
    {
      "id": "step-1",
      "type": "action",
      "name": "Tap center",
      "action": "tap",
      "params": {
        "x": 540,
        "y": 1200
      }
    },
    {
      "id": "step-2",
      "type": "action",
      "name": "Tap element theo text",
      "action": "tap",
      "params": {
        "text": "Login"  // Tìm và tap element có text "Login"
      }
    },
    {
      "id": "step-3",
      "type": "action",
      "name": "Swipe up",
      "action": "swipe_up",
      "params": {}
    }
  ]
}
```

## 🐛 Troubleshooting

### Lỗi: "Cannot connect to Portal"

**Kiểm tra:**
1. DroidRun Portal đã cài chưa?
   ```bash
   adb shell pm list packages | grep droidrun
   ```
2. Portal có chạy không?
   ```bash
   adb shell dumpsys activity | grep droidrun
   ```
3. Port forward đúng chưa?
   ```bash
   adb forward --list
   ```

**Giải pháp:**
```bash
# Cài lại Portal
droidrun setup -d <device_id>

# Forward lại port
adb -s <device_id> forward tcp:18080 tcp:8080

# Test
curl http://localhost:18080/ping
```

### Lỗi: "Element not found"

**Kiểm tra:**
1. Lấy UI state để xem elements có sẵn:
   ```bash
   curl http://localhost:18080/state
   ```
2. Kiểm tra element có visible không
3. Đợi UI load xong trước khi tap

### Lỗi: "Timeout"

**Giải pháp:**
- Tăng timeout trong client
- Kiểm tra network/USB connection
- Restart Portal:
  ```bash
  adb shell am force-stop com.droidrun.portal
  adb shell am start com.droidrun.portal/.MainActivity
  ```

## 📚 Tài liệu thêm

- **Portal Client Code**: `src-tauri/src/portal_client.rs`
- **Workflow V2 Code**: `src-tauri/src/workflow_v2.rs`
- **DroidRun Docs**: [docs.droidrun.ai](https://docs.droidrun.ai)
- **ADB Tools Reference**: `docs/adb-tools.mdx`

---

**Cập nhật**: 2026-01-09
