# Hướng dẫn Thiết lập Thiết bị (Android/iOS)

> 💡 **TL;DR**: Để DroidRun điều khiển được điện thoại, bạn cần bật chế độ Gỡ lỗi (Debugging) và cài đặt ứng dụng **Portal** (cầu nối giữa máy tính và điện thoại).

## 📖 Tổng quan
DroidRun hoạt động thông qua một ứng dụng chuyên dụng tên là **Portal**. Ứng dụng này giúp AI "đọc" được các nút bấm trên màn hình và thực hiện hành động chạm/vuốt.

---

## 🤖 Thiết lập Android (Khuyên dùng)

### Bước 1: Chuẩn bị ADB
Đảm bảo máy tính của bạn đã có ADB (Android Debug Bridge).
- **Windows**: Tài liệu hướng dẫn thêm ADB vào PATH đã có tại [đây](DROID_AGENT_GUIDE.md).
- **Kiểm tra**: Gõ `adb version` trong terminal.

### Bước 2: Bật Gỡ lỗi USB (USB Debugging)
1. Vào **Cài đặt** > **Thông tin điện thoại**.
2. Nhấn vào **Số hiệu bản dựng (Build Number)** 7 lần để bật "Tùy chọn cho nhà phát triển".
3. Vào **Cài đặt** > **Hệ thống** > **Tùy chọn nhà phát triển**.
4. Bật **Gỡ lỗi USB (USB Debugging)**.
5. Kết nối điện thoại với máy tính và chọn "Luôn cho phép" trên màn hình điện thoại.

### Bước 3: Cài đặt ứng dụng Portal tự động
DroidRun giúp bạn cài đặt mọi thứ chỉ bằng một lệnh duy nhất:
```bash
droidrun setup
```
**Lệnh này sẽ tự động:**
- Tải file Portal APK mới nhất.
- Cài đặt và cấp mọi quyền cần thiết.
- Kích hoạt dịch vụ Hỗ trợ (Accessibility Service).

### Bước 4: Kiểm tra kết nối
```bash
droidrun ping
```
Nếu hiện thông báo: *"Portal is installed and accessible. You're good to go!"* là thành công.

---

## 🍎 Thiết lập iOS (Thực nghiệm)
*Hiện tại tính năng này vẫn đang trong giai đoạn thử nghiệm.*

---

## 📚 Thông tin về ứng dụng Portal
Ứng dụng Portal (`com.droidrun.portal`) cung cấp các khả năng:
- **Accessibility Tree**: Trích xuất các phần tử UI (nút bấm, ô nhập liệu).
- **Device State**: Theo dõi trạng thái máy, bàn phím.
- **Action Execution**: Thực hiện Chạm, Vuốt, Nhập liệu.

⚠️ **Lưu ý bảo mật**: Portal chỉ giao tiếp nội bộ qua ADB với máy tính của bạn. **Không có dữ liệu nào được gửi ra máy chủ bên ngoài.**

---

## 🛠️ Xử lý lỗi thường gặp
- **Không tìm thấy thiết bị**: Kiểm tra cáp USB và gõ `adb devices`.
- **Portal chưa cài đặt**: Chạy lại lệnh `droidrun setup`.
- **Lỗi nhập văn bản**: Đảm bảo bàn phím không bị che khuất hoặc thử chuyển sang chế độ TCP.

## 🔗 Tham khảo thêm
- [Hướng dẫn CLI Reference](DROIDRUN_CLI_REFERENCE.md)
- [Cấu hình hệ thống](configuration.mdx)