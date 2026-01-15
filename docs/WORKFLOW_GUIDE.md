# Hướng dẫn Workflow Engine - DroidRun GUI Tauri v2

## 📋 Tổng quan

Workflow Engine cho phép bạn tự động hóa các thao tác trên điện thoại Android bằng cách định nghĩa một chuỗi các bước (steps) thực thi tuần tự hoặc có điều kiện.

## 🎯 Workflow hoạt động như thế nào?

### 1. **Luồng hoạt động tổng quát**

```
[Người dùng] → [WorkflowPanel UI] → [Tauri Backend] → [ADB Commands] → [Điện thoại Android]
     ↓                ↓                      ↓                  ↓
  Tạo/Chọn      Nhập inputs         Execute steps      Thực thi thao tác
  Workflow                          (workflow.rs)       (tap, swipe, etc)
```

### 2. **Các thành phần chính**

#### A. Frontend (React)
- **`WorkflowPanel.jsx`**: Giao diện quản lý workflows
  - Hiển thị danh sách workflows
  - Tạo/Sửa/Xóa workflows
  - Chạy workflow với inputs
  - Hiển thị kết quả thực thi

#### B. Backend (Rust)
- **`workflow.rs`**: Workflow execution engine
  - Parse workflow definition
  - Execute các steps theo thứ tự
  - Xử lý điều kiện, vòng lặp, parallel execution
  - Chạy Python scripts
  - Gọi ADB commands

#### C. Testing Script
- **`test_workflow.py`**: Script test workflow qua command line
  - Không cần GUI
  - Test trực tiếp với ADB
  - Mô phỏng hành vi người dùng với random delays

## 📝 Cấu trúc Workflow

### Workflow Definition

```javascript
{
  "id": "unique-workflow-id",
  "name": "Tên workflow",
  "description": "Mô tả workflow",
  "color": "#ff0050",
  "timeout": 600,  // Timeout tính bằng giây
  "inputs": [
    {
      "name": "video_count",
      "label": "Số video",
      "type": "number",
      "default": 5
    }
  ],
  "steps": [
    // Các bước thực thi
  ]
}
```

### Các loại Steps

#### 1. **Action Step** - Thực hiện hành động
```javascript
{
  "id": "step-1",
  "type": "action",
  "name": "Mở TikTok",
  "action": "open_app",
  "params": {
    "package": "com.zhiliaoapp.musically"
  }
}
```

**Các actions hỗ trợ:**
- `open_app`: Mở ứng dụng
- `tap`: Tap vào vị trí
- `swipe_up/down/left/right`: Vuốt màn hình
- `input_text`: Nhập text
- `press_back`: Nhấn nút Back
- `press_home`: Nhấn nút Home

#### 2. **Wait Step** - Chờ cố định
```javascript
{
  "id": "step-2",
  "type": "wait",
  "name": "Chờ app load",
  "duration": "3000"  // milliseconds
}
```

#### 3. **Random Wait Step** - Chờ ngẫu nhiên (mô phỏng người)
```javascript
{
  "id": "step-3",
  "type": "random_wait",
  "name": "Xem video (random)",
  "min": "3000",
  "max": "10000"
}
```

#### 4. **Loop Step** - Vòng lặp
```javascript
{
  "id": "step-4",
  "type": "loop",
  "name": "Xem video loop",
  "count": "{{video_count}}",  // Sử dụng input
  "variable": "i",
  "body": [
    // Các steps bên trong loop
  ]
}
```

#### 5. **Condition Step** - Điều kiện
```javascript
{
  "id": "step-5",
  "type": "condition",
  "name": "Like nếu đạt tỷ lệ",
  "condition": "{{like_decision.should_like}}",
  "then": [
    // Steps nếu điều kiện đúng
  ],
  "else_branch": [
    // Steps nếu điều kiện sai
  ]
}
```

#### 6. **Python Step** - Chạy Python script
```javascript
{
  "id": "step-6",
  "type": "python",
  "name": "Quyết định like",
  "script": "import random; return {'should_like': random.randint(1, 100) <= {{like_rate}}}",
  "save_to": "like_decision"
}
```

#### 7. **While Step** - Vòng lặp có điều kiện
```javascript
{
  "id": "step-7",
  "type": "while",
  "name": "Lặp cho đến khi...",
  "condition": "{{counter}} < 10",
  "body": [
    // Steps bên trong while
  ]
}
```

#### 8. **Parallel Step** - Thực thi song song
```javascript
{
  "id": "step-8",
  "type": "parallel",
  "name": "Chạy đồng thời",
  "branches": [
    [/* Steps branch 1 */],
    [/* Steps branch 2 */]
  ]
}
```

## 🔧 Template Variables

Workflow hỗ trợ template variables với cú pháp `{{variable_name}}`:

### 1. **Input Variables**
```javascript
"count": "{{video_count}}"  // Từ workflow inputs
```

### 2. **Context Variables**
```javascript
"condition": "{{like_decision.should_like}}"  // Từ Python script results
```

### 3. **Loop Variables**
```javascript
"variable": "i"  // Biến đếm trong loop
```

## 🚀 Cách sử dụng

### Cách 1: Sử dụng qua GUI

1. **Mở WorkflowPanel** trong ứng dụng
2. **Tạo workflow mới** hoặc chọn workflow có sẵn
3. **Nhập inputs** (nếu workflow yêu cầu)
4. **Nhấn Run** để thực thi
5. **Xem logs** và kết quả

### Cách 2: Test qua Command Line

```bash
# Di chuyển vào thư mục dự án
cd d:\Code\autojs\droidrun_gui_tauri_v2

# Chạy test script
python scripts/test_workflow.py
```

Script sẽ:
- Kiểm tra ADB devices
- Cho phép nhập custom inputs
- Chạy workflow mẫu (TikTok Auto Engagement)
- Hiển thị logs chi tiết

### Cách 3: Dry Run (không cần device thật)

Nếu không có device kết nối, script sẽ tự động chạy ở chế độ **DRY RUN**:
- Mô phỏng các ADB commands
- Hiển thị logs như thật
- Không thực sự thực thi trên device

## 📊 Ví dụ Workflow hoàn chỉnh

### TikTok Auto Engagement

```javascript
{
  "id": "tiktok-auto-001",
  "name": "TikTok Auto Engagement",
  "description": "Xem video và like tự động với random delay mô phỏng người",
  "color": "#ff0050",
  "timeout": 600,
  "inputs": [
    {"name": "video_count", "label": "Số video", "type": "number", "default": 5},
    {"name": "like_rate", "label": "Tỷ lệ like (%)", "type": "number", "default": 50},
    {"name": "min_watch_time", "label": "Thời gian xem tối thiểu (s)", "type": "number", "default": 3},
    {"name": "max_watch_time", "label": "Thời gian xem tối đa (s)", "type": "number", "default": 10}
  ],
  "steps": [
    {
      "id": "step-1",
      "type": "action",
      "name": "Mở TikTok",
      "action": "open_app",
      "params": {"package": "com.zhiliaoapp.musically"}
    },
    {
      "id": "step-2",
      "type": "wait",
      "name": "Chờ app load",
      "duration": "3000"
    },
    {
      "id": "step-3",
      "type": "loop",
      "name": "Xem video loop",
      "count": "{{video_count}}",
      "variable": "i",
      "body": [
        {
          "id": "step-3-1",
          "type": "random_wait",
          "name": "Xem video (random)",
          "min": "{{min_watch_time}}000",
          "max": "{{max_watch_time}}000"
        },
        {
          "id": "step-3-2",
          "type": "python",
          "name": "Quyết định like",
          "script": "import random; return {'should_like': random.randint(1, 100) <= {{like_rate}}}",
          "save_to": "like_decision"
        },
        {
          "id": "step-3-3",
          "type": "condition",
          "name": "Like nếu đạt tỷ lệ",
          "condition": "{{like_decision.should_like}}",
          "then": [
            {
              "id": "step-3-3-1",
              "type": "action",
              "name": "Double tap để like",
              "action": "tap",
              "params": {"target": "center", "double": true}
            },
            {
              "id": "step-3-3-2",
              "type": "random_wait",
              "name": "Delay sau like",
              "min": "500",
              "max": "1500"
            }
          ],
          "else_branch": []
        },
        {
          "id": "step-3-4",
          "type": "action",
          "name": "Swipe lên video tiếp",
          "action": "swipe_up",
          "params": {}
        },
        {
          "id": "step-3-5",
          "type": "random_wait",
          "name": "Nghỉ giữa video",
          "min": "500",
          "max": "2000"
        }
      ]
    }
  ]
}
```

## 🐛 Debugging

### Xem logs trong GUI
- Logs hiển thị real-time trong ExecutionPanel
- Mỗi step có status: pending, running, success, error

### Xem logs trong CLI
```bash
python scripts/test_workflow.py
```

Logs sẽ hiển thị:
```
🚀 Workflow: TikTok Auto Engagement
📱 Device: emulator-5554
⚙️ Inputs: {"video_count": 5, "like_rate": 50}
============================================================

  ▶️ [step-1] Mở TikTok (action)
  [ADB] adb -s emulator-5554 shell monkey -p com.zhiliaoapp.musically ...
  
  ▶️ [step-2] Chờ app load (wait)
    ⏳ Waiting 3000ms...
    
  ▶️ [step-3] Xem video loop (loop)
    🔄 Loop 5 times (var: i)
    
    === Iteration 1/5 ===
    ...
```

## 🔍 Troubleshooting

### Vấn đề: Điện thoại không có thao tác nào

**Nguyên nhân có thể:**

1. **Device không kết nối ADB**
   ```bash
   adb devices
   ```
   Giải pháp: Kết nối lại USB hoặc wireless debugging

2. **Workflow không được chạy**
   - Kiểm tra logs trong ExecutionPanel
   - Xem có lỗi nào không

3. **ADB commands không thực thi**
   - Kiểm tra USB Debugging đã bật chưa
   - Thử chạy manual: `adb shell input tap 500 500`

4. **Workflow chạy nhưng không có hiệu ứng**
   - Tọa độ tap/swipe có thể sai
   - Thời gian wait quá ngắn
   - App chưa load xong

### Debug với test script

```bash
# Chạy với device thật
python scripts/test_workflow.py

# Xem chi tiết ADB commands
# Script sẽ in ra tất cả ADB commands được thực thi
```

## 💡 Tips & Best Practices

### 1. **Sử dụng Random Delays**
Luôn dùng `random_wait` thay vì `wait` cố định để mô phỏng hành vi người:
```javascript
{"type": "random_wait", "min": "1000", "max": "3000"}
```

### 2. **Xử lý lỗi gracefully**
Sử dụng `error_handling` trong step:
```javascript
{
  "type": "action",
  "error_handling": {
    "on_error": "continue",  // hoặc "stop", "retry"
    "retry_count": 3
  }
}
```

### 3. **Chia nhỏ workflows**
Thay vì một workflow lớn, chia thành nhiều workflows nhỏ có thể tái sử dụng

### 4. **Test từng step**
Sử dụng test script để test từng step riêng lẻ trước khi ghép lại

### 5. **Logging**
Đặt tên step rõ ràng để dễ debug:
```javascript
{"name": "Tap vào nút Like ở giữa màn hình"}
```

## 📚 Tài liệu liên quan

- **Architecture**: `docs/architecture.mdx`
- **ADB Tools**: `docs/adb-tools.mdx`
- **Device Setup**: `docs/device-setup.mdx`
- **CLI Guide**: `docs/cli.mdx`

## 🎓 Học thêm

### Tạo workflow mới từ AI
WorkflowPanel có tính năng **AI Generate Workflow**:
1. Mô tả workflow bằng ngôn ngữ tự nhiên
2. AI sẽ generate workflow definition
3. Review và chỉnh sửa nếu cần
4. Save và chạy

### Ví dụ prompts:
- "Tạo workflow mở Instagram, like 10 posts đầu tiên"
- "Workflow tự động reply tin nhắn Messenger"
- "Scroll TikTok và save video mỗi 5 video"

---

**Cập nhật lần cuối**: 2026-01-09
**Phiên bản**: 2.0
