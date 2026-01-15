# Chat Execution Panel - VS Code Style Interface

**Ngày tạo:** 2026-01-02  
**Tác giả:** Amp AI Assistant

---

## Tổng quan

Đã thêm giao diện **Chat Agent** mới vào MUN SDK AI, thiết kế theo phong cách VS Code Copilot Chat.

## Files đã tạo/sửa

| File | Thay đổi |
|------|----------|
| `src/components/ChatExecutionPanel.jsx` | **MỚI** - Component chat interface |
| `src/styles.css` | Thêm 400+ dòng CSS cho chat UI |
| `src/App.jsx` | Import component + thêm vào navigation |

---

## Tính năng

### 1. Chat Interface
- Giao diện chat 2 chiều (user ↔ assistant)
- Hiển thị logs realtime khi task đang chạy
- Auto-scroll khi có message mới

### 2. Model Selectors

**Vision Models** (phân tích UI):
- glm-4.5v (Z.AI)
- glm-4.6v (Z.AI)
- gemini-2.5-flash (mun-ai)
- gemini-3-flash-preview (mun-ai)
- gemini-2.5-computer-use (mun-ai)
- vision-model (mun-ai)
- gpt-4.1 (mun-ai)

**Executor Models** (thực thi code):
- glm-4.5 (Z.AI)
- glm-4.5-air (Z.AI)
- glm-4-plus (Z.AI)
- qwen3-coder-plus (mun-ai)
- qwen3-coder-flash (mun-ai)
- gpt-4.1 (mun-ai)

### 3. Fast Mode ⚡
- Toggle reasoning ON/OFF
- Mặc định: ON (reasoning OFF = nhanh hơn)
- Hiển thị màu vàng khi active

### 4. Voice Input 🎤
- Nút mic để nhập bằng giọng nói
- Sử dụng Web Speech Recognition API
- Hỗ trợ tiếng Việt (`vi-VN`)
- Animation pulse khi đang nghe

### 5. Dual Model Mode
- Toggle để bật/tắt chế độ 2 model
- Vision model: phân tích UI, xác định element indices
- Executor model: tạo Python code để thực thi

### 6. Settings Panel
- Collapsible (ẩn/hiện bằng icon ⚙️)
- Chọn thiết bị
- Chọn Vision/Executor model
- Nhập API Key (cho Z.AI)

---

## Cấu trúc Component

```jsx
ChatExecutionPanel
├── chat-header
│   ├── chat-title (🤖 DroidRun Agent)
│   ├── chat-device-badge (127.0.0.1:5555)
│   └── chat-header-right (Clear, Settings buttons)
├── chat-settings (collapsible)
│   ├── Device selector
│   ├── Dual Model toggle
│   ├── Vision Model selector
│   ├── Executor Model selector
│   └── API Key input
├── chat-messages
│   ├── Empty state (khi chưa có message)
│   ├── User messages (bubble xanh, right-aligned)
│   ├── Assistant messages (bubble xám, left-aligned)
│   └── Live logs (khi đang chạy)
└── chat-input-container
    ├── chat-input-wrapper
    │   ├── Input field
    │   └── Mic button 🎤
    └── chat-toolbar
        ├── Plus button (+)
        ├── Fast mode toggle (⚡)
        ├── Model selector dropdown
        └── Send/Stop button
```

---

## CSS Classes

| Class | Mô tả |
|-------|-------|
| `.chat-execution-panel` | Container chính |
| `.chat-header` | Header với title và device badge |
| `.chat-settings` | Panel cài đặt (collapsible) |
| `.chat-messages` | Khu vực hiển thị messages |
| `.chat-message-user` | Message từ user (right-aligned) |
| `.chat-message-assistant` | Message từ AI (left-aligned) |
| `.chat-bubble-*` | Các loại bubble (user, success, error, warning) |
| `.chat-input-container` | Container cho input |
| `.chat-input-wrapper` | Wrapper với border focus effect |
| `.chat-mic-btn` | Nút microphone |
| `.chat-toolbar` | Toolbar dưới input |
| `.chat-tool-btn` | Các button trong toolbar |
| `.chat-model-selector` | Dropdown chọn model |
| `.chat-send-btn` | Nút gửi/dừng |

---

## Provider Configs

```javascript
const PROVIDER_CONFIGS = {
  'Z.AI': {
    baseUrl: 'https://api.z.ai/api/paas/v4',
    provider: 'OpenAILike',
  },
  'mun-ai': {
    baseUrl: 'http://127.0.0.1:8317/v1',
    apiKey: 'mun-ai-local',
    provider: 'OpenAILike',
  },
};
```

---

## Sử dụng

### 1. Mở app
```bash
npm run tauri dev
```

### 2. Chọn tab "⚡ Chat Agent" trong sidebar

### 3. Cấu hình (nếu cần)
- Click icon ⚙️ để mở settings
- Chọn thiết bị
- Chọn model
- Nhập API key (nếu dùng Z.AI)

### 4. Nhập prompt
```
Mở TikTok, like 3 video, comment "Nice!"
```

### 5. Gửi
- Nhấn Enter hoặc click nút Send
- Hoặc dùng mic để nói

---

## Roadmap

- [ ] Implement dual model logic (Vision → Executor)
- [ ] Thêm image preview từ screenshot
- [ ] History persistence (lưu chat history)
- [ ] Export chat log
- [ ] Keyboard shortcuts (Ctrl+L để focus input)
- [ ] Templates dropdown (chọn prompt có sẵn)

---

## Screenshots

*(Sẽ cập nhật sau khi app chạy)*

---

## Liên quan

- [TEST_TIKTOK_RESULTS.md](../TEST_TIKTOK_RESULTS.md) - Kết quả test các models
- [run_droidrun.py](../src-tauri/run_droidrun.py) - Script backend
