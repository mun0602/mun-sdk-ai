# Hướng dẫn DroidAgent SDK

> 💡 **TL;DR**: `DroidAgent` là lớp trung tâm trong DroidRun SDK, đóng vai trò điều phối việc lập kế hoạch và thực thi các nhiệm vụ trên thiết bị Android hoặc iOS thông qua AI.

## 📖 Giới thiệu
`DroidAgent` là một "wrapper class" mạnh mẽ giúp kết nối các Agent AI khác nhau để đạt được mục tiêu của người dùng. Nó tự động quản lý luồng công việc, từ việc đọc trạng thái màn hình đến việc ra quyết định và thực hiện các thao tác chạm, vuốt.

## 🎯 Mục đích sử dụng
- Tự động hóa các tác vụ phức tạp trên điện thoại bằng ngôn ngữ tự nhiên.
- Xây dựng các bot hoặc script có khả năng "suy nghĩ" và "nhìn" màn hình.
- Trích xuất dữ liệu có cấu trúc từ ứng dụng di động.

## 🚀 Bắt đầu nhanh

### Bước 1: Khởi tạo cơ bản
Cách đơn giản nhất để bắt đầu là sử dụng cấu hình mặc định.

```python
from droidrun import DroidAgent
from droidrun.config_manager import DroidrunConfig

# 1. Khởi tạo cấu hình (mặc định lấy từ config.yaml)
config = DroidrunConfig()

# 2. Tạo Agent với mục tiêu cụ thể
agent = DroidAgent(
    goal="Mở Chrome và tìm kiếm từ khóa 'DroidRun'",
    config=config
)

# 3. Chạy Agent
result = await agent.run()
print(f"Kết quả: {result.success}, Lý do: {result.reason}")
```

### Bước 2: Chạy với chế độ Suy luận (Reasoning)
Nếu nhiệm vụ phức tạp, hãy bật `reasoning=True` trong cấu hình để Agent lập kế hoạch chi tiết hơn.

## 📚 Chi tiết kỹ thuật

### 🏗️ Kiến trúc hoạt động
- **Khi `reasoning=False` (Mặc định)**: Sử dụng `CodeActAgent` để thực thi ngay lập tức các hành động. Phù hợp cho nhiệm vụ đơn giản.
- **Khi `reasoning=True`**: Sử dụng sự kết hợp của:
    - **ManagerAgent**: Lập kế hoạch (Planning).
    - **ExecutorAgent**: Thực hiện hành động (Actions).
    - **ScripterAgent**: Các thao tác ngoài thiết bị.

### ⚙️ Các tham số quan trọng (`__init__`)
| Tham số | Kiểu dữ liệu | Mô tả |
|---------|--------------|-------|
| `goal` | `str` | Mục tiêu hoặc câu lệnh của người dùng. |
| `config` | `DroidrunConfig` | Đối tượng cấu hình đầy đủ (chứa LLM, thiết bị, v.v.). |
| `output_model` | `BaseModel` | (Tùy chọn) Model Pydantic để trích xuất dữ liệu có cấu trúc. |
| `timeout` | `int` | Thời gian chờ tối đa (mặc định 1000 giây). |

### 📊 Các loại sự kiện (Events)
Trong quá trình chạy, `DroidAgent` phát ra các sự kiện mà bạn có thể theo dõi:
- **Hành động**: `TapActionEvent` (Chạm), `SwipeActionEvent` (Vuốt), `InputTextActionEvent` (Nhập chữ).
- **Trạng thái**: `ScreenshotEvent` (Chụp ảnh màn hình), `RecordUIStateEvent` (Ghi lại cấu trúc UI).
- **Quy trình**: `ManagerPlanEvent` (Khi Agent tạo xong kế hoạch).

## ⚠️ Lưu ý
- **Yêu cầu Config**: Bạn phải cung cấp `config` hoặc `llms`. Nếu không có, Agent sẽ không biết sử dụng AI nào để xử lý.
- **Chế độ Vision**: Khi bật Vision (`vision=True`), hệ thống sẽ gửi ảnh màn hình lên AI. Điều này giúp Agent "thấy" tốt hơn nhưng sẽ tốn nhiều token hơn.
- **An toàn**: Có thể bật `safe_execution` để hạn chế các lệnh nguy hiểm khi Agent thực thi code.

## 🔗 Tham khảo thêm
- [Tài liệu AdbTools](adb-tools.mdx)
- [Cấu hình chi tiết](configuration.mdx)