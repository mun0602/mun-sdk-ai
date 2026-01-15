# Hướng dẫn Luồng công việc (Workflow) trong DroidRun

> 💡 **TL;DR**: DroidRun sử dụng kiến trúc đa tác nhân (multi-agent). Bạn có thể chọn chạy nhanh trực tiếp (Direct) hoặc chạy có suy luận lập kế hoạch (Reasoning) tùy theo độ phức tạp của nhiệm vụ.

## 📖 Giới thiệu về Kiến trúc
DroidRun không chỉ sử dụng một AI duy nhất. Nó chia nhỏ công việc cho các "Agent" chuyên biệt:
- **DroidAgent**: Người điều phối chính (Orchestrator).
- **ManagerAgent**: Người lập kế hoạch (chỉ có trong chế độ Reasoning).
- **ExecutorAgent**: Người thực hiện các thao tác trên màn hình.
- **CodeActAgent**: Người thực thi mã trực tiếp (chế độ Direct).
- **ScripterAgent**: Người xử lý các tác vụ ngoài thiết bị (gọi API, tính toán).

## 🎯 Mục đích sử dụng từng chế độ

### 1. Chế độ Suy luận (`reasoning=True`)
Dành cho các tác vụ phức tạp, cần nhiều bước và có khả năng thay đổi tùy theo tình huống.
- **Luồng chạy**: Mục tiêu → Manager (Lập kế hoạch) → Executor (Thực hiện bước 1) → Manager (Kiểm tra & Lập kế hoạch tiếp) → ...
- **Phù hợp cho**: Đặt vé máy bay, quản lý nhiều ứng dụng cùng lúc, các quy trình nghiệp vụ dài.

### 2. Chế độ Trực tiếp (`reasoning=False`)
Dành cho các tác vụ đơn giản, rõ ràng, thực hiện nhanh.
- **Luồng chạy**: Mục tiêu → CodeActAgent (Tạo mã & Chạy) → Hoàn thành.
- **Phù hợp cho**: Chụp màn hình, gửi tin nhắn nhanh, mở một ứng dụng cụ thể.

## 🚀 Cách thiết lập luồng công việc

### Bước 1: Cấu hình trong Python
Bạn có thể bật tắt chế độ suy luận ngay khi khởi tạo cấu hình:

```python
from droidrun import DroidrunConfig, DroidAgent

config = DroidrunConfig()
config.agent.reasoning = True  # Bật chế độ lập kế hoạch chuyên sâu

agent = DroidAgent(goal="Tìm và mua một đôi giày size 42 trên Shopee", config=config)
await agent.run()
```

### Bước 2: Cấu hình qua File YAML (`config.yaml`)
Đây là cách khuyên dùng để quản lý luồng công việc dễ dàng hơn:

```yaml
agent:
  reasoning: true    # Chế độ lập kế hoạch
  max_steps: 20      # Số bước tối đa Agent được phép chạy
  manager:
    vision: true     # Cho phép Manager "nhìn" màn hình để lập kế hoạch
  executor:
    vision: true     # Cho phép Executor "nhìn" màn hình để bấm nút chính xác
```

## 📚 Các hành động Agent có thể thực hiện
Trong workflow, Agent sẽ tự động chọn các công cụ sau:
- `click(index)`: Nhấn vào một phần tử.
- `type(text, index)`: Nhập văn bản.
- `swipe(from, to)`: Vuốt màn hình.
- `open_app(name)`: Mở ứng dụng.
- `wait(seconds)`: Chờ đợi màn hình tải.
- `complete(success, reason)`: Kết thúc workflow.

## ⚠️ Lưu ý
1. **Trạng thái dùng chung (Shared State)**: Tất cả các Agent trong workflow đều dùng chung một bộ nhớ. Nếu ScripterAgent lấy được mã OTP từ Email, ExecutorAgent sẽ biết để điền vào ứng dụng điện thoại.
2. **Số bước tối đa (`max_steps`)**: Luôn đặt giới hạn bước để tránh AI bị lặp lại vô tận (mặc định thường là 15 bước).
3. **Vision**: Bật Vision giúp workflow chính xác hơn nhưng sẽ làm chậm tốc độ xử lý do phải gửi ảnh lên AI.

## 🔗 Tham khảo thêm
- [Hướng dẫn SDK chi tiết](DROID_AGENT_GUIDE.md)
- [Cấu hình thiết bị Android/iOS](device-setup.mdx)