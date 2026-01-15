# Test Macro Recording & Replay - DroidRun

**Ngày test:** 2024-12-31  
**Thiết bị:** emulator-5554 (MuMu Player)

## ⚠️ QUAN TRỌNG: Tắt Vision khi ghi Macro

> **Khi ghi macro, LUÔN đặt `vision=false` để đảm bảo ổn định!**
> 
> Vision mode gửi screenshot đến API, dễ gây lỗi:
> - API timeout khi xử lý ảnh lớn
> - Empty response khi màn hình có keyboard/browser
> - Tốn nhiều token và chậm hơn
>
> **Text-only mode (vision=false)** chỉ gửi UI hierarchy → nhanh và ổn định hơn.

### 🔥 Lệnh ghi macro ỔN ĐỊNH (copy & paste):

```bash
# Windows CMD
set PYTHONIOENCODING=utf-8 && python run_droidrun.py ^
  "emulator-5554" ^
  "OpenAILike" ^
  "glm-4.6v" ^
  "YOUR_TASK_HERE" ^
  "YOUR_API_KEY" ^
  "https://api.z.ai/api/paas/v4" ^
  "false" ^
  "false" ^
  "{\"save_trajectory\": \"action\"}"
```

```bash
# Linux/Mac
PYTHONIOENCODING=utf-8 python run_droidrun.py \
  "emulator-5554" \
  "OpenAILike" \
  "glm-4.6v" \
  "YOUR_TASK_HERE" \
  "YOUR_API_KEY" \
  "https://api.z.ai/api/paas/v4" \
  "false" \
  "false" \
  '{"save_trajectory": "action"}'
```

**Tham số quan trọng:**
| # | Tham số | Giá trị | Ghi chú |
|---|---------|---------|---------|
| 7 | **vision** | **false** | ⚠️ BẮT BUỘC tắt để ổn định |
| 8 | reasoning | false | Tùy chọn |
| 9 | save_trajectory | action | Lưu macro |

---

## Providers đã test:

| Provider | Model | Base URL | Vision |
|----------|-------|----------|--------|
| Z.AI (OpenAILike) | glm-4.6v | https://api.z.ai/api/paas/v4 | ✅ Có |
| Local Proxy (OpenAILike) | gemini-2.5-computer-use-preview-10-2025 | http://127.0.0.1:8317/v1 | ❌ Không |

---

## 1. Test API Connection

### Lệnh test:
```bash
curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{"model": "glm-4.6v", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Kết quả: ✅ PASS
- API Z.AI hoạt động bình thường
- Response trả về đúng format OpenAI-compatible

---

## 2. Test Ghi Macro (Record)

### Lệnh ghi macro:
```bash
python run_droidrun.py "emulator-5554" "OpenAILike" "glm-4.6v" \
  "Open Chrome browser, go to dtdp.bio" \
  "<API_KEY>" \
  "https://api.z.ai/api/paas/v4" \
  "true" "false" \
  '{"save_trajectory": "action"}'
```

### Thứ tự tham số:
1. `device_id` - ID thiết bị ADB
2. `provider` - OpenAILike, OpenAI, Anthropic, etc.
3. `model` - Tên model
4. `prompt` - Task cần thực hiện
5. `api_key` - API key
6. `base_url` - Base URL của API
7. `vision` - true/false
8. `reasoning` - true/false  
9. `tracing_json` - JSON config cho tracing/trajectory

### Kết quả: ⚠️ PARTIAL PASS
- **Ghi được 6 bước** trước khi lỗi
- **Lỗi:** `Empty response content` - API trả về rỗng khi màn hình có bàn phím
- **Nguyên nhân:** Model glm-4.6v không xử lý được một số trạng thái màn hình

### Macro đã ghi (6 actions):
| Step | Action | Element | Coordinates |
|------|--------|---------|-------------|
| 1 | tap | Folder: 小工具 | (470, 907) |
| 2 | tap | 谷歌安装器 | (351, 691) |
| 3 | tap | FrameLayout (đóng folder) | (270, 480) |
| 4 | tap | Enter game or app name | (270, 57) |
| 5 | tap | Browser | (310, 907) |
| 6 | tap | URL bar | (267, 75) |

### File output:
- `trajectories/20251231_195531_03425014/macro.json`
- `trajectories/20251231_195531_03425014/trajectory.json`
- `trajectories/20251231_195531_03425014/screenshots/`
- `trajectories/20251231_195531_03425014/ui_states/`

---

## 3. Test Replay Macro

### Lệnh replay:
```bash
python -m droidrun macro replay \
  "d:\Code\autojs\droidrun_gui_tauri_v2\src-tauri\trajectories\20251231_195531_03425014" \
  --device emulator-5554 \
  --delay 1.5
```

### Các options replay:
- `--delay <seconds>` - Thời gian chờ giữa các bước (default: 1.0s)
- `--start-from <step>` - Bắt đầu từ step nào
- `--max-steps <n>` - Số bước tối đa
- `--dry-run` - Chỉ preview, không thực thi

### Kết quả: ✅ PASS
```
📊 Success: 6/6 (100.0%)
🎉 Macro replay completed successfully!
```
- Tất cả 6 actions thực thi thành công
- Emulator thực hiện đúng các thao tác đã ghi
- **Không cần LLM** để replay

---

## 4. Test Macro đơn giản (Mo Settings)

### Lệnh ghi:
```bash
python run_droidrun.py "emulator-5554" "OpenAILike" "glm-4.6v" \
  "Mo Settings" "<API_KEY>" "https://api.z.ai/api/paas/v4" \
  "true" "false" '{"save_trajectory": "action"}'
```

### Kết quả ghi: ✅ PASS
- Hoàn thành task trong 2 bước
- Macro lưu thành công

### Kết quả replay: ✅ PASS
```
📊 Success: 2/2 (100.0%)
```

---

## 5. Test với Local Proxy (Gemini)

### Config:
- **Base URL:** http://127.0.0.1:8317/v1
- **API Key:** proxypal-local
- **Model:** gemini-2.5-computer-use-preview-10-2025

### Test API:
```bash
curl -X POST "http://127.0.0.1:8317/v1/chat/completions" \
  -H "Authorization: Bearer proxypal-local" \
  -d '{"model": "gemini-2.5-computer-use-preview-10-2025", "messages": [{"role": "user", "content": "Hello"}]}'
```
**Kết quả:** ✅ PASS

### Test Record với vision=true:
```bash
python run_droidrun.py "emulator-5554" "OpenAILike" "gemini-2.5-computer-use-preview-10-2025" \
  "Open Settings app" "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" \
  '{"save_trajectory": "action"}'
```
**Kết quả:** ❌ FAIL - `Empty response content`
- Proxy không hỗ trợ multimodal (gửi ảnh screenshot)

### Test Record với vision=false:
```bash
python run_droidrun.py "emulator-5554" "OpenAILike" "gemini-2.5-computer-use-preview-10-2025" \
  "Open Settings app" "proxypal-local" "http://127.0.0.1:8317/v1" "false" "false" \
  '{"save_trajectory": "action"}'
```
**Kết quả:** ✅ PASS
- Ghi 1 bước thành công
- Macro lưu tại: `trajectories/20251231_200435_1021a087/`

### Test Replay:
```bash
python -m droidrun macro replay "trajectories/20251231_200435_1021a087" --device emulator-5554
```
**Kết quả:** ✅ PASS - 1/1 (100%)

---

## 7. Test "Open browser, go to dtdp.bio" (Z.AI, vision=false)

### Lệnh:
```bash
python run_droidrun.py "emulator-5554" "OpenAILike" "glm-4.6v" \
  "Open browser, go to dtdp.bio" \
  "<API_KEY>" "https://api.z.ai/api/paas/v4" \
  "false" "false" '{"save_trajectory": "action"}'
```

### Kết quả Record: ✅ PASS
- **4 bước hoàn thành** trong ~1 phút
- Actions: tap Browser → tap URL bar → type "dtdp.bio" → press Enter

### Macro đã ghi (5 actions):
| Step | Action | Mô tả |
|------|--------|-------|
| 1 | tap | Click "Browser" (310, 907) |
| 2 | tap | Click URL bar (266, 75) |
| 3 | tap | Click URL bar lần nữa (302, 75) |
| 4 | input_text | Nhập "dtdp.bio" |
| 5 | key_press | Press ENTER |

### Kết quả Replay: ✅ PASS
```
📊 Success: 5/5 (100.0%)
🎉 Macro replay completed successfully!
```

### So sánh Vision ON vs OFF:

| Vision | Kết quả | Số bước | Lỗi |
|--------|---------|---------|-----|
| `true` | ❌ FAIL | 1 bước | Empty response sau khi mở browser |
| `false` | ✅ PASS | 5 bước | Không lỗi |

**Kết luận:** `vision=false` ổn định hơn nhiều cho việc ghi macro.

---

## 8. Tổng kết

| Test Case | Kết quả | Ghi chú |
|-----------|---------|---------|
| API Connection (Z.AI) | ✅ PASS | glm-4.6v hoạt động |
| API Connection (Local Proxy) | ✅ PASS | Gemini qua proxy |
| Record với vision=true | ⚠️ UNSTABLE | Hay lỗi "Empty response" |
| Record với vision=false | ✅ PASS | Ổn định, khuyến nghị dùng |
| Record "Open Settings" | ✅ PASS | 1-2 steps |
| Record "Open browser, go to dtdp.bio" | ✅ PASS | 5 steps (vision=false) |
| Replay macro | ✅ PASS | 100% success rate |
| ADB commands | ✅ PASS | tap, swipe, keyevent, input text |

### Lỗi đã gặp:

1. **Empty response content** ⚠️ THƯỜNG GẶP
   - **Nguyên nhân chính:** Vision mode gửi screenshot, API không xử lý được
   - **Giải pháp:** Dùng `vision=false`
   - Xảy ra khi màn hình có bàn phím, browser, hoặc nội dung phức tạp

2. **Connection error (ban đầu)**
   - Do thứ tự tham số sai (api_key và base_url bị hoán đổi)
   - Đã fix bằng cách đúng thứ tự tham số

3. **Unicode encoding**
   - Windows console không hiển thị emoji
   - Fix: `set PYTHONIOENCODING=utf-8`

---

## 6. Lệnh hữu ích

```bash
# List macros
python -m droidrun macro list

# Replay với delay
python -m droidrun macro replay <path> --device <device> --delay 1.5

# Dry run (preview)
python -m droidrun macro replay <path> --device <device> --dry-run

# Check devices
adb devices -l

# Reconnect device
adb disconnect <device> && adb connect <device>
```

---

## 7. Cấu trúc Macro JSON

```json
{
  "version": "1.0",
  "description": "Task description",
  "timestamp": "20251231_195712",
  "total_actions": 6,
  "actions": [
    {
      "type": "TapActionEvent",
      "action_type": "tap",
      "description": "Tap element...",
      "x": 310,
      "y": 907,
      "element_index": 16,
      "element_text": "Browser",
      "element_bounds": "270,869,350,945"
    }
  ]
}
```
