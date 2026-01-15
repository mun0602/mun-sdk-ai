# Hướng dẫn sử dụng DroidRun CLI (Dòng lệnh)

> 💡 **TL;DR**: Giao diện dòng lệnh (CLI) của DroidRun cho phép bạn điều khiển điện thoại bằng ngôn ngữ tự nhiên ngay từ terminal.

## 📖 Giới thiệu
DroidRun CLI là cách nhanh nhất để tương tác với thiết bị Android hoặc iOS mà không cần viết mã Python. Bạn chỉ cần gõ yêu cầu, và AI sẽ tự động thực hiện.

## 🚀 Các lệnh cơ bản

### 1. Thiết lập thiết bị (`setup`)
Sử dụng lệnh này khi lần đầu kết nối hoặc khi muốn cấu hình lại thiết bị.
```bash
droidrun setup
```

### 2. Chạy lệnh trực tiếp (`run`)
Bạn có thể ra lệnh cho điện thoại bằng tiếng Anh. 
*Lưu ý: Bạn có thể bỏ chữ `run` để gõ nhanh hơn.*

```bash
# Cách đầy đủ
droidrun run "Open Spotify and play some music"

# Cách rút gọn (Khuyên dùng)
droidrun "Turn on Do Not Disturb"
```

### 3. Quản lý thiết bị (`devices`)
Liệt kê các thiết bị đang kết nối và trạng thái của chúng.
```bash
droidrun devices
```

## ⚙️ Các tham số quan trọng (Flags)
Bạn có thể thêm các tùy chọn sau vào sau câu lệnh để điều chỉnh hành vi của Agent:

| Flag | Mô tả | Mặc định |
|------|-------|----------|
| `--provider`, `-p` | Chọn nhà cung cấp AI (GoogleGenAI, OpenAI, Anthropic...) | Từ config |
| `--model`, `-m` | Chọn model cụ thể (gemini-2.0-flash, gpt-4o...) | Từ config |
| `--device`, `-d` | ID hoặc IP của thiết bị muốn điều khiển | Tự nhận diện |
| `--steps` | Số bước tối đa Agent được thực hiện | 15 |
| `--reasoning` | Bật chế độ lập kế hoạch chuyên sâu | false |
| `--vision` | Cho phép Agent xem ảnh màn hình | Từ config |
| `--debug` | Hiện nhật ký chi tiết để sửa lỗi | false |

## 💡 Ví dụ nâng cao

### Kiểm tra pin trên một thiết bị cụ thể
```bash
droidrun "Check battery level" --device emulator-5554
```

### Chạy thử nghiệm nhanh với Gemini 2.0
```bash
droidrun "Open Chrome and search for DroidRun" --provider GoogleGenAI --model models/gemini-2.0-flash
```

### Lưu quá trình thực hiện (Trajectory) chuyên sâu
```bash
droidrun "Book a flight on Traveloka" --save-trajectory action
```

## ⚠️ Lưu ý về cấu hình
- DroidRun sẽ ưu tiên lệnh từ CLI (Flags) cao nhất, sau đó mới đến file `config.yaml`.
- Nếu chưa có file `config.yaml`, DroidRun sẽ tự tạo một file từ bản mẫu `config_example.yaml`.

## 🔗 Tham khảo thêm
- [Hướng dẫn cấu hình biến môi trường](configuration.mdx)
- [Cài đặt ADB và PATH Windows](DROID_AGENT_GUIDE.md)