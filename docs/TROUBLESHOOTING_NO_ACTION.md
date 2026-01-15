# ❓ Tại sao điện thoại không có thao tác?

## 🔍 Nguyên nhân phổ biến

### 1. ❌ Device không kết nối ADB
**Kiểm tra:**
```bash
adb devices
```

**Kết quả mong đợi:**
```
List of devices attached
emulator-5554   device
# hoặc
192.168.1.100:5555   device
```

**Nếu không thấy device:**
```bash
# Restart ADB server
adb kill-server
adb start-server

# Kiểm tra lại
adb devices
```

### 2. ❌ USB Debugging chưa bật
**Cách bật:**
1. Vào **Settings** → **About Phone**
2. Tap **Build Number** 7 lần để bật Developer Mode
3. Vào **Settings** → **Developer Options**
4. Bật **USB Debugging**
5. Kết nối USB và chấp nhận prompt trên điện thoại

### 3. ❌ Workflow không chạy
**Kiểm tra trong GUI:**
- Mở **ExecutionPanel**
- Xem có logs không
- Kiểm tra status của workflow (running/error/success)

**Kiểm tra qua CLI:**
```bash
cd d:\Code\autojs\droidrun_gui_tauri_v2
python scripts/test_workflow.py
```

### 4. ❌ ADB commands không thực thi
**Test thủ công:**
```bash
# Test tap tại tọa độ (500, 1000)
adb shell input tap 500 1000

# Test swipe từ dưới lên
adb shell input swipe 500 1500 500 500 300

# Test mở app
adb shell monkey -p com.zhiliaoapp.musically -c android.intent.category.LAUNCHER 1
```

**Nếu commands không hoạt động:**
- Kiểm tra USB Debugging đã bật chưa
- Thử kết nối lại USB
- Restart ADB server

### 5. ❌ Workflow chạy nhưng không có hiệu ứng
**Nguyên nhân:**
- Tọa độ tap/swipe sai
- Thời gian wait quá ngắn
- App chưa load xong
- Màn hình bị tắt

**Giải pháp:**
- Tăng thời gian wait
- Kiểm tra lại tọa độ
- Đảm bảo màn hình sáng
- Sử dụng `random_wait` thay vì `wait` cố định

### 6. ❌ Workflow timeout
**Nguyên nhân:**
- Workflow quá dài
- Device phản hồi chậm
- Network lag (nếu dùng wireless ADB)

**Giải pháp:**
- Tăng `timeout` trong workflow definition
- Chia nhỏ workflow
- Sử dụng USB thay vì wireless

## ✅ Checklist khắc phục nhanh

```
☐ 1. Kiểm tra ADB devices: adb devices
☐ 2. Kiểm tra USB Debugging đã bật
☐ 3. Test ADB command thủ công: adb shell input tap 500 1000
☐ 4. Chạy test script: python scripts/test_workflow.py
☐ 5. Xem logs trong ExecutionPanel
☐ 6. Kiểm tra workflow có chạy không
☐ 7. Kiểm tra màn hình điện thoại có sáng không
☐ 8. Restart ADB server: adb kill-server && adb start-server
```

## 🚀 Cách test nhanh

### Test 1: Kiểm tra ADB
```bash
adb devices
```
✅ Phải thấy device trong list

### Test 2: Test tap thủ công
```bash
adb shell input tap 500 1000
```
✅ Điện thoại phải có phản ứng (tap vào màn hình)

### Test 3: Chạy workflow test
```bash
cd d:\Code\autojs\droidrun_gui_tauri_v2
python scripts/test_workflow.py
```
✅ Script sẽ hiển thị logs chi tiết

### Test 4: Chạy workflow trong GUI
1. Mở DroidRun GUI
2. Chọn tab **Workflows**
3. Chọn workflow đơn giản
4. Nhấn **Run**
5. Xem logs trong **ExecutionPanel**

✅ Phải thấy logs và device có phản ứng

## 🔧 Debug chi tiết

### Bật verbose logging
Trong `workflow.rs`, logs sẽ hiển thị:
- Step đang chạy
- ADB command được thực thi
- Kết quả của mỗi step
- Lỗi (nếu có)

### Xem logs trong GUI
- **ExecutionPanel** → Tab **Logs**
- Mỗi step có status:
  - 🟡 Pending
  - 🔵 Running
  - 🟢 Success
  - 🔴 Error

### Xem logs trong CLI
```bash
python scripts/test_workflow.py
```

Output sẽ hiển thị:
```
🚀 Workflow: TikTok Auto Engagement
📱 Device: emulator-5554
⚙️ Inputs: {"video_count": 5}
============================================================

  ▶️ [step-1] Mở TikTok (action)
  [ADB] adb -s emulator-5554 shell monkey -p com.zhiliaoapp.musically ...
  
  ▶️ [step-2] Chờ app load (wait)
    ⏳ Waiting 3000ms...
```

## 📊 Ví dụ workflow test đơn giản

Tạo workflow này để test:

```javascript
{
  "id": "test-tap",
  "name": "Test Tap",
  "steps": [
    {
      "id": "step-1",
      "type": "action",
      "name": "Tap center",
      "action": "tap",
      "params": {"target": "center"}
    },
    {
      "id": "step-2",
      "type": "wait",
      "name": "Wait 2s",
      "duration": "2000"
    },
    {
      "id": "step-3",
      "type": "action",
      "name": "Tap again",
      "action": "tap",
      "params": {"target": "center"}
    }
  ]
}
```

Nếu workflow này chạy được → ADB hoạt động bình thường
Nếu không chạy được → Vấn đề ở ADB connection

## 🎯 Các vấn đề thường gặp

### Vấn đề: "Device not found"
**Giải pháp:**
```bash
adb kill-server
adb start-server
adb devices
```

### Vấn đề: "Unauthorized"
**Giải pháp:**
1. Ngắt kết nối USB
2. Revoke USB debugging authorizations trên điện thoại
3. Kết nối lại và chấp nhận prompt

### Vấn đề: "Workflow timeout"
**Giải pháp:**
- Tăng `timeout` trong workflow definition
- Giảm số lượng steps
- Tăng thời gian wait giữa các steps

### Vấn đề: "Python script error"
**Giải pháp:**
- Kiểm tra syntax Python
- Kiểm tra template variables đúng không
- Xem logs để biết lỗi cụ thể

### Vấn đề: "Tap không chính xác"
**Giải pháp:**
- Sử dụng `adb shell wm size` để xem resolution
- Điều chỉnh tọa độ cho phù hợp
- Sử dụng `target: "center"` thay vì tọa độ cụ thể

## 📚 Tài liệu chi tiết

Để hiểu rõ hơn về workflow, đọc:

1. **[WORKFLOW_README.md](./WORKFLOW_README.md)** - Tổng quan và quick start
2. **[WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)** - Hướng dẫn chi tiết
3. **[WORKFLOW_ARCHITECTURE.md](./WORKFLOW_ARCHITECTURE.md)** - Kiến trúc hệ thống
4. **[WORKFLOW_QUICK_REFERENCE.md](./WORKFLOW_QUICK_REFERENCE.md)** - Cheat sheet

## 💡 Tips quan trọng

1. **Luôn test ADB trước** khi chạy workflow
2. **Sử dụng test script** để debug: `python scripts/test_workflow.py`
3. **Xem logs** để biết step nào bị lỗi
4. **Test từng step** riêng lẻ trước khi ghép lại
5. **Sử dụng random_wait** để mô phỏng hành vi người

---

**Nếu vẫn không giải quyết được, hãy:**
1. Chạy `python scripts/test_workflow.py` và gửi logs
2. Kiểm tra `adb devices` và gửi kết quả
3. Xem logs trong ExecutionPanel và gửi screenshot
