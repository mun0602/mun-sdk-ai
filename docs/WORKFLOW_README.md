# 📚 Tài liệu Workflow Engine

## Tại sao điện thoại không có thao tác?

Nếu bạn thấy điện thoại không có thao tác nào khi chạy workflow, có thể do:

### ✅ Checklist khắc phục

1. **Kiểm tra kết nối ADB**
   ```bash
   adb devices
   ```
   Phải thấy device của bạn trong danh sách

2. **Kiểm tra USB Debugging**
   - Vào Settings → Developer Options → USB Debugging (phải BẬT)

3. **Kiểm tra workflow có chạy không**
   - Mở ExecutionPanel trong GUI
   - Xem logs có hiển thị không
   - Kiểm tra status của workflow

4. **Test ADB thủ công**
   ```bash
   # Test tap
   adb shell input tap 500 1000
   
   # Test swipe
   adb shell input swipe 500 1500 500 500 300
   ```

5. **Chạy test script**
   ```bash
   cd d:\Code\autojs\droidrun_gui_tauri_v2
   python scripts/test_workflow.py
   ```

## 📖 Tài liệu đầy đủ

Dự án có 3 tài liệu chính về Workflow:

### 1. [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)
**Hướng dẫn chi tiết về Workflow Engine**
- Workflow hoạt động như thế nào
- Cấu trúc workflow
- Các loại steps (action, loop, condition, python, ...)
- Cách sử dụng qua GUI và CLI
- Ví dụ workflow hoàn chỉnh
- Troubleshooting

👉 **Đọc file này trước** để hiểu tổng quan

### 2. [WORKFLOW_ARCHITECTURE.md](./WORKFLOW_ARCHITECTURE.md)
**Kiến trúc và luồng hoạt động**
- Sơ đồ kiến trúc hệ thống
- Luồng thực thi chi tiết
- Data flow
- Step executors
- Ví dụ execution trace

👉 **Đọc file này** để hiểu sâu về cách workflow được thực thi

### 3. [WORKFLOW_QUICK_REFERENCE.md](./WORKFLOW_QUICK_REFERENCE.md)
**Quick Reference / Cheat Sheet**
- Tất cả step types
- Template syntax
- Action types
- Common patterns
- Best practices

👉 **Tra cứu file này** khi cần syntax nhanh

## 🚀 Quick Start

### Cách 1: Sử dụng GUI

1. Mở ứng dụng DroidRun GUI
2. Chọn tab **Workflows**
3. Chọn workflow có sẵn hoặc tạo mới
4. Nhập inputs (nếu có)
5. Nhấn **Run**
6. Xem logs trong **Execution Panel**

### Cách 2: Test qua Command Line

```bash
# Di chuyển vào thư mục dự án
cd d:\Code\autojs\droidrun_gui_tauri_v2

# Chạy test script
python scripts/test_workflow.py

# Script sẽ:
# - Kiểm tra ADB devices
# - Cho phép nhập custom inputs
# - Chạy workflow mẫu (TikTok Auto Engagement)
# - Hiển thị logs chi tiết
```

## 📝 Ví dụ Workflow đơn giản

```javascript
{
  "id": "simple-workflow",
  "name": "Simple Workflow",
  "description": "Mở app và tap 5 lần",
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
      "name": "Tap 5 lần",
      "count": "5",
      "variable": "i",
      "body": [
        {
          "id": "step-3-1",
          "type": "action",
          "name": "Tap center",
          "action": "tap",
          "params": {"target": "center"}
        },
        {
          "id": "step-3-2",
          "type": "random_wait",
          "name": "Chờ ngẫu nhiên",
          "min": "1000",
          "max": "3000"
        }
      ]
    }
  ]
}
```

## 🔧 Các thành phần chính

### Frontend (React)
- `src/components/WorkflowPanel.jsx` - Giao diện quản lý workflows
- `src/components/ExecutionPanel.jsx` - Hiển thị logs và kết quả

### Backend (Rust)
- `src-tauri/src/workflow.rs` - Workflow execution engine
- `src-tauri/src/lib.rs` - Tauri commands

### Testing
- `scripts/test_workflow.py` - Test script qua command line

## 🎯 Các loại Steps

| Type | Mô tả |
|------|-------|
| `action` | Thực hiện hành động (tap, swipe, open app) |
| `wait` | Chờ cố định |
| `random_wait` | Chờ ngẫu nhiên (mô phỏng người) |
| `loop` | Lặp lại N lần |
| `while` | Lặp có điều kiện |
| `condition` | Rẽ nhánh if/else |
| `python` | Chạy Python script |
| `parallel` | Chạy đồng thời |

## 💡 Tips

1. **Luôn dùng `random_wait`** thay vì `wait` cố định để mô phỏng hành vi người
2. **Đặt tên step rõ ràng** để dễ debug
3. **Test từng step** trước khi ghép lại workflow lớn
4. **Xử lý lỗi** với `error_handling` config
5. **Sử dụng Python step** cho logic phức tạp

## 🐛 Debug

### Xem logs trong GUI
- Logs hiển thị real-time trong ExecutionPanel
- Mỗi step có status: pending, running, success, error

### Xem logs trong CLI
```bash
python scripts/test_workflow.py
```

### Test ADB commands thủ công
```bash
# Tap
adb shell input tap 500 1000

# Swipe
adb shell input swipe 500 1500 500 500 300

# Open app
adb shell monkey -p com.app.name -c android.intent.category.LAUNCHER 1
```

## 📞 Hỗ trợ

Nếu vẫn gặp vấn đề:
1. Đọc [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) phần Troubleshooting
2. Kiểm tra logs trong ExecutionPanel
3. Chạy test script để xem chi tiết: `python scripts/test_workflow.py`

---

**Tài liệu này giúp bạn nhanh chóng tìm hiểu và khắc phục vấn đề với Workflow Engine**
