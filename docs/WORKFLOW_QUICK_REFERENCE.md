# Workflow Quick Reference - Cheat Sheet

## 🎯 Các loại Steps

| Type | Icon | Mô tả | Ví dụ |
|------|------|-------|-------|
| `action` | 🎬 | Thực hiện hành động trên device | Tap, swipe, open app |
| `wait` | ⏳ | Chờ cố định | Chờ 3 giây |
| `random_wait` | 🎲 | Chờ ngẫu nhiên | Chờ 3-10 giây |
| `loop` | 🔄 | Lặp lại N lần | Lặp 5 lần |
| `while` | ♾️ | Lặp có điều kiện | Lặp cho đến khi... |
| `condition` | 🔀 | Rẽ nhánh if/else | Nếu like_rate > 50 |
| `python` | 🐍 | Chạy Python script | Tính toán, logic |
| `parallel` | ⚡ | Chạy đồng thời | Chạy 2 tasks cùng lúc |
| `prompt` | 💬 | Hỏi người dùng | Nhập text, chọn option |
| `extract` | 📤 | Trích xuất data | Lấy text từ màn hình |
| `skill` | 🎯 | Gọi skill có sẵn | Sử dụng skill đã tạo |

## 📝 Template Syntax

### Basic Variables
```javascript
"{{variable_name}}"           // Từ inputs hoặc context
"{{video_count}}"             // Input: video_count
"{{i}}"                       // Loop variable
```

### Nested Variables
```javascript
"{{object.property}}"         // Nested object
"{{like_decision.should_like}}" // Python result
"{{user.name}}"               // User object
```

### Math Operations (trong Python step)
```python
"{{video_count}} * 2"         // Nhân 2
"{{like_rate}} / 100"         // Chia 100
```

## 🎬 Action Types

### App Control
```javascript
{"action": "open_app", "params": {"package": "com.app.name"}}
{"action": "press_back", "params": {}}
{"action": "press_home", "params": {}}
{"action": "close_app", "params": {"package": "com.app.name"}}
```

### Touch Actions
```javascript
{"action": "tap", "params": {"x": 500, "y": 1000}}
{"action": "tap", "params": {"target": "center"}}
{"action": "tap", "params": {"target": "center", "double": true}}
{"action": "long_press", "params": {"x": 500, "y": 1000, "duration": 2000}}
```

### Swipe Actions
```javascript
{"action": "swipe_up", "params": {}}
{"action": "swipe_down", "params": {}}
{"action": "swipe_left", "params": {}}
{"action": "swipe_right", "params": {}}
{"action": "swipe", "params": {"x1": 500, "y1": 1000, "x2": 500, "y2": 500, "duration": 300}}
```

### Input Actions
```javascript
{"action": "input_text", "params": {"text": "Hello World"}}
{"action": "input_text", "params": {"text": "{{message}}"}}
{"action": "press_key", "params": {"key": "ENTER"}}
```

## ⏱️ Wait Steps

### Fixed Wait
```javascript
{
  "type": "wait",
  "duration": "3000"  // milliseconds
}
```

### Random Wait (Recommended)
```javascript
{
  "type": "random_wait",
  "min": "1000",
  "max": "5000"
}
```

## 🔄 Loop Steps

### Simple Loop
```javascript
{
  "type": "loop",
  "count": "5",
  "variable": "i",
  "body": [
    // Steps to repeat
  ]
}
```

### Loop with Input
```javascript
{
  "type": "loop",
  "count": "{{video_count}}",
  "variable": "i",
  "body": [
    {"type": "action", "action": "tap", "params": {"target": "center"}},
    {"type": "random_wait", "min": "1000", "max": "3000"}
  ]
}
```

### While Loop
```javascript
{
  "type": "while",
  "condition": "{{counter}} < 10",
  "body": [
    // Steps to repeat
  ]
}
```

## 🔀 Condition Steps

### Simple Condition
```javascript
{
  "type": "condition",
  "condition": "{{should_like}}",
  "then": [
    {"type": "action", "action": "tap", "params": {"target": "center"}}
  ],
  "else_branch": []
}
```

### Nested Condition
```javascript
{
  "type": "condition",
  "condition": "{{like_rate}} > 50",
  "then": [
    {"type": "action", "action": "tap", "params": {"target": "center"}},
    {"type": "wait", "duration": "1000"}
  ],
  "else_branch": [
    {"type": "action", "action": "swipe_up", "params": {}}
  ]
}
```

## 🐍 Python Steps

### Simple Python
```javascript
{
  "type": "python",
  "script": "return {'result': 42}",
  "save_to": "my_result"
}
```

### Python with Random
```javascript
{
  "type": "python",
  "script": "import random; return {'should_like': random.randint(1, 100) <= {{like_rate}}}",
  "save_to": "like_decision"
}
```

### Python with Context
```javascript
{
  "type": "python",
  "script": `
import random
import time

# Access inputs
video_count = {{video_count}}
like_rate = {{like_rate}}

# Calculate
should_like = random.randint(1, 100) <= like_rate
wait_time = random.randint(3, 10)

return {
  'should_like': should_like,
  'wait_time': wait_time
}
  `,
  "save_to": "decision"
}
```

## ⚡ Parallel Steps

```javascript
{
  "type": "parallel",
  "branches": [
    [
      // Branch 1
      {"type": "action", "action": "tap", "params": {"x": 100, "y": 100}},
      {"type": "wait", "duration": "1000"}
    ],
    [
      // Branch 2
      {"type": "action", "action": "tap", "params": {"x": 500, "y": 500}},
      {"type": "wait", "duration": "1000"}
    ]
  ]
}
```

## 💬 Prompt Steps

### Text Input
```javascript
{
  "type": "prompt",
  "prompt_type": "text",
  "message": "Nhập tên của bạn:",
  "save_to": "user_name"
}
```

### Select Option
```javascript
{
  "type": "prompt",
  "prompt_type": "select",
  "message": "Chọn hành động:",
  "options": [
    {"label": "Like", "value": "like"},
    {"label": "Comment", "value": "comment"},
    {"label": "Share", "value": "share"}
  ],
  "save_to": "user_action"
}
```

## 📤 Extract Steps

```javascript
{
  "type": "extract",
  "target": "xpath://android.widget.TextView[@text='Username']",
  "attribute": "text",
  "save_to": "username"
}
```

## 🎯 Skill Steps

```javascript
{
  "type": "skill",
  "skill_id": "tiktok-like-video",
  "params": {
    "video_index": "{{i}}"
  }
}
```

## ⚙️ Error Handling

```javascript
{
  "type": "action",
  "action": "tap",
  "params": {"target": "center"},
  "error_handling": {
    "on_error": "continue",  // "continue" | "stop" | "retry"
    "retry_count": 3,
    "retry_delay": 1000
  }
}
```

## 📊 Workflow Inputs

### Number Input
```javascript
{
  "name": "video_count",
  "label": "Số video",
  "type": "number",
  "default": 5,
  "min": 1,
  "max": 100
}
```

### Text Input
```javascript
{
  "name": "message",
  "label": "Tin nhắn",
  "type": "text",
  "default": "Hello",
  "placeholder": "Nhập tin nhắn..."
}
```

### Select Input
```javascript
{
  "name": "action_type",
  "label": "Loại hành động",
  "type": "select",
  "default": "like",
  "options": [
    {"label": "Like", "value": "like"},
    {"label": "Comment", "value": "comment"}
  ]
}
```

### Boolean Input
```javascript
{
  "name": "auto_scroll",
  "label": "Tự động scroll",
  "type": "boolean",
  "default": true
}
```

## 🎨 Workflow Colors

```javascript
"color": "#ff0050"  // TikTok pink
"color": "#4f6ef7"  // Blue
"color": "#f59e0b"  // Orange
"color": "#8b5cf6"  // Purple
"color": "#22c55e"  // Green
"color": "#06b6d4"  // Cyan
```

## 📱 Common Coordinates (1080x2400)

```javascript
// Center
{"x": 540, "y": 1200}

// Top center
{"x": 540, "y": 200}

// Bottom center
{"x": 540, "y": 2200}

// Left center
{"x": 200, "y": 1200}

// Right center
{"x": 880, "y": 1200}
```

## 🔧 Common Patterns

### Like with Random Chance
```javascript
{
  "type": "python",
  "script": "import random; return {'should_like': random.randint(1, 100) <= {{like_rate}}}",
  "save_to": "like_decision"
},
{
  "type": "condition",
  "condition": "{{like_decision.should_like}}",
  "then": [
    {"type": "action", "action": "tap", "params": {"target": "center", "double": true}},
    {"type": "random_wait", "min": "500", "max": "1500"}
  ]
}
```

### Scroll and Process Items
```javascript
{
  "type": "loop",
  "count": "{{item_count}}",
  "variable": "i",
  "body": [
    {"type": "action", "action": "tap", "params": {"target": "center"}},
    {"type": "random_wait", "min": "2000", "max": "5000"},
    {"type": "action", "action": "swipe_up", "params": {}},
    {"type": "random_wait", "min": "500", "max": "1500"}
  ]
}
```

### Retry on Failure
```javascript
{
  "type": "action",
  "action": "tap",
  "params": {"target": "center"},
  "error_handling": {
    "on_error": "retry",
    "retry_count": 3,
    "retry_delay": 2000
  }
}
```

## 🚀 Quick Start Template

```javascript
{
  "id": "my-workflow-001",
  "name": "My Workflow",
  "description": "Description here",
  "color": "#4f6ef7",
  "timeout": 600,
  "inputs": [
    {"name": "count", "label": "Count", "type": "number", "default": 5}
  ],
  "steps": [
    {
      "id": "step-1",
      "type": "action",
      "name": "Open App",
      "action": "open_app",
      "params": {"package": "com.app.name"}
    },
    {
      "id": "step-2",
      "type": "wait",
      "name": "Wait for load",
      "duration": "3000"
    },
    {
      "id": "step-3",
      "type": "loop",
      "name": "Main loop",
      "count": "{{count}}",
      "variable": "i",
      "body": [
        {
          "id": "step-3-1",
          "type": "action",
          "name": "Tap",
          "action": "tap",
          "params": {"target": "center"}
        },
        {
          "id": "step-3-2",
          "type": "random_wait",
          "name": "Wait",
          "min": "1000",
          "max": "3000"
        }
      ]
    }
  ]
}
```

## 💡 Best Practices

1. **Luôn dùng random_wait** thay vì wait cố định
2. **Đặt tên step rõ ràng** để dễ debug
3. **Chia nhỏ workflows** thành các skills tái sử dụng
4. **Xử lý lỗi** với error_handling
5. **Test từng step** trước khi ghép lại
6. **Sử dụng Python** cho logic phức tạp
7. **Log đầy đủ** để dễ troubleshoot

## 🐛 Debug Tips

```bash
# Test workflow qua CLI
python scripts/test_workflow.py

# Xem ADB devices
adb devices

# Test ADB command thủ công
adb shell input tap 500 1000
adb shell input swipe 500 1500 500 500 300

# Xem logs real-time
# Trong GUI: ExecutionPanel → Logs tab
```

---

**Quick Reference v2.0** - Cập nhật: 2026-01-09
