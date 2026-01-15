# DroidRun Documentation Index

> **Mục đích**: File này giúp AI nhanh chóng tìm được tài liệu phù hợp khi làm việc với DroidRun GUI Tauri v2.

## Tổng quan

DroidRun là framework điều khiển Android/iOS devices thông qua LLM agents, cho phép tự động hóa thao tác trên thiết bị bằng ngôn ngữ tự nhiên.

**Website chính**: https://docs.droidrun.ai/
**GitHub**: https://github.com/droidrun/droidrun

## Tính năng chính

- Điều khiển Android/iOS bằng natural language commands
- Hỗ trợ nhiều LLM providers (OpenAI, Anthropic, Gemini, Ollama, DeepSeek)
- Planning capabilities cho multi-step tasks
- CLI tool với debugging features
- Python API mở rộng
- Screenshot analysis

## Tài liệu trong thư mục này

| File | Nội dung | Khi nào tra cứu |
|------|----------|-----------------|
| [README-upstream.md](./README-upstream.md) | Overview project | Hiểu tổng quan |
| [quickstart.mdx](./quickstart.mdx) | Quickstart guide | Bắt đầu nhanh |
| [device-setup.mdx](./device-setup.mdx) | **Device Setup** - USB, Wireless, Multiple devices | Setup Android/iOS devices |
| [cli.mdx](./cli.mdx) | CLI usage | Sử dụng command line |
| [docker.mdx](./docker.mdx) | Docker setup | Chạy trong container |
| [architecture.mdx](./architecture.mdx) | System architecture | Hiểu kiến trúc hệ thống |
| [droid-agent.mdx](./droid-agent.mdx) | DroidAgent SDK | Python API cho agent |
| [adb-tools.mdx](./adb-tools.mdx) | ADB Tools reference | Các tools tương tác ADB |
| [configuration.mdx](./configuration.mdx) | Configuration options | Cấu hình DroidRun |
| [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) | **Workflow Engine Guide** - Hướng dẫn chi tiết | Tìm hiểu về workflows |
| [WORKFLOW_ARCHITECTURE.md](./WORKFLOW_ARCHITECTURE.md) | **Workflow Architecture** - Kiến trúc & luồng hoạt động | Hiểu cách workflow hoạt động |
| [WORKFLOW_QUICK_REFERENCE.md](./WORKFLOW_QUICK_REFERENCE.md) | **Workflow Cheat Sheet** - Quick reference | Tra cứu nhanh syntax |
| [WORKFLOW_VS_DROIDRUN.md](./WORKFLOW_VS_DROIDRUN.md) | **Workflow vs DroidRun** - So sánh 2 cơ chế | Chọn đúng tool |
| [HTTP_REST_API_GUIDE.md](./HTTP_REST_API_GUIDE.md) | **HTTP REST API** - Điều khiển qua API | Dùng REST API thay ADB |
| [WORKFLOW_IMPROVEMENT_PROPOSAL.md](./WORKFLOW_IMPROVEMENT_PROPOSAL.md) | **Cải thiện Workflow** - Đề xuất tối ưu | Nâng cấp performance |

## Quick Reference

### Installation
```bash
pip install 'droidrun[google,anthropic,openai,deepseek,ollama,dev]'
```

### Device Setup (Android)
```bash
# 1. Enable USB Debugging trên điện thoại
# 2. Kết nối USB và chạy:
droidrun setup
droidrun ping  # Kiểm tra kết nối
```

### Wireless Debugging (Android 11+)
```bash
# Pair device lần đầu
adb pair IP:PORT

# Connect
adb connect IP:PORT
droidrun ping --device IP:PORT
```

### Multiple Devices
```bash
# Liệt kê devices
droidrun devices

# Chọn device cụ thể
droidrun run "your command" --device emulator-5554
```

### Python API
```python
from droidrun import DeviceConfig, DroidrunConfig, DroidAgent

device_config = DeviceConfig(serial="DEVICE_SERIAL", use_tcp=True)
config = DroidrunConfig(device=device_config)
agent = DroidAgent(goal="Open settings", config=config)
result = await agent.run()
```

### CLI Commands
```bash
droidrun setup                    # Setup Portal app
droidrun ping                     # Test connection
droidrun devices                  # List connected devices
droidrun run "command"            # Run command
droidrun run "cmd" --tcp          # Use TCP mode (faster)
droidrun run "cmd" --device SERIAL
```

## Portal App

DroidRun Portal (`com.droidrun.portal`) cung cấp:
- **Accessibility Tree** - Trích xuất UI elements
- **Device State** - Track activity, keyboard
- **Action Execution** - Tap, swipe, text input
- **Dual Communication** - TCP (nhanh) hoặc Content Provider (fallback)

## Communication Modes

| Mode | Mô tả | Usage |
|------|-------|-------|
| **TCP** (recommended) | HTTP server port 8080 | `--tcp` flag |
| **Content Provider** | Fallback, chậm hơn | Default mode |

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Device not found | `adb kill-server && adb start-server` |
| Portal not installed | `droidrun setup` |
| Accessibility not enabled | Check Settings > Accessibility |
| Text input not working | Verify DroidRun Keyboard is default |
| Empty UI state | Wait after actions, check accessibility |

## Links tài liệu online

- **Quickstart**: https://docs.droidrun.ai/quickstart
- **Device Setup**: https://docs.droidrun.ai/guides/device-setup
- **CLI Guide**: https://docs.droidrun.ai/guides/cli
- **SDK Reference**: https://docs.droidrun.ai/sdk/droid-agent
- **Architecture**: https://docs.droidrun.ai/concepts/architecture
