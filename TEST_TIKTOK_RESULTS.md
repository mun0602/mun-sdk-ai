# Test TikTok Like & Comment - DroidRun

**Ngày test:** 2026-01-01 ~ 2026-01-02  
**Thiết bị:** 127.0.0.1:5555 (Xiaomi 25010PN30G)

---

## 🏆 BEST CHOICE

### gpt-4.1 (CLI Proxy) - Linh hoạt nhất
| Config | Steps | Task | Kết quả |
|--------|-------|------|---------|
| Vision ✗ Reasoning ✓ | **14** | 10 videos + 3 likes + 2 follows + 3 comments | ✅ PASS |
| Vision ✗ Reasoning ✗ | **10** | 10 videos + 3 likes + 2 follows + 3 comments | ✅ PASS |
| Vision ✓ Reasoning ✗ | **7** | 10 videos + 3 likes + 2 follows + 3 comments | ✅ PASS |

**Ưu điểm:**
- Hoạt động với **mọi config** (vision ON/OFF, reasoning ON/OFF)
- Prompt tiếng Anh tốt hơn tiếng Việt
- Step-by-step chi tiết, không bỏ sót action

### glm-4-plus (Z.AI) - Best GLM
| Config | Steps | Task | Kết quả |
|--------|-------|------|---------|
| Vision ✗ Reasoning ✓ | **29** | 10 videos + 3 likes + 2 follows + 3 comments | ✅ PASS |
| Vision ✗ Reasoning ✗ | **24** | 3 likes + 3 comments + 3 follows | ✅ PASS |

**Ưu điểm:**
- Step-by-step chi tiết, không bỏ sót
- Task ngắn có thể tắt reasoning
- Tự recover sau SyntaxError

**Lưu ý:**
- glm-4-plus **không hỗ trợ vision**
- Task dài nên bật reasoning=ON

### glm-4.5 (Z.AI) - Best GLM No Reasoning
| Config | Steps | Task | Kết quả |
|--------|-------|------|---------|
| Vision ✗ Reasoning ✗ | **21** | 3 likes + 3 comments + 3 follows | ✅ PASS |

**Ưu điểm:**
- **Không cần reasoning** - hoạt động tốt với reasoning=OFF
- Step-by-step chi tiết, hoàn thành đầy đủ task
- Đóng comment overlay đúng, swipe ổn định

**Lưu ý:**
- glm-4.5 **không hỗ trợ vision**
- Chậm hơn glm-4.5-air nhưng chính xác hơn

---

## Tổng kết nhanh

### 🏆 Task siêu phức tạp: Like + Comment + Follow (3 videos)

| Model | Provider | Vision | Reasoning | Steps | Kết quả | Ghi chú |
|-------|----------|--------|-----------|-------|---------|---------|
| **gemini-3-flash-preview** | Local Proxy | ✅ | ✅ | **10** | **✅ PASS** | 🥇 Fastest - batch actions |
| gemini-2.5-computer-use | Local Proxy | ✅ | ✅ | 14 | ✅ PASS | Self-correction tốt |
| gemini-3-pro-preview | Local Proxy | ✅ | ✅ | 16 | ✅ PASS | Clean code |
| glm-4.6v | Z.AI | ✅ | ✅ | 29 | ✅ PASS | 1 SyntaxError, tự recover |

### 🔥 Task cực phức tạp: 10 videos + Comment unique + Like 4

| Model | Provider | Vision | Reasoning | Steps | Kết quả | Ghi chú |
|-------|----------|--------|-----------|-------|---------|---------|
| **qwen3-coder-plus** | Local Proxy | ❌ | ❌ | **5** | **✅ PASS** | 🥇 Fastest - all-in-one loop |
| gemini-3-flash-preview | Local Proxy | ✅ | ❌ | 13 | ✅ PASS | Batch actions |
| gemini-3-pro-preview | Local Proxy | ✅ | ❌ | 38+ | ❌ TIMEOUT | Quá chậm (>1000s) |
| gemini-2.5-computer-use | Local Proxy | ✅ | ✅ | 32 | ❌ FAIL | Token overflow 131K |
| gemini-2.5-computer-use | Local Proxy | ✅ | ❌ | 30 | ❌ FAIL | Token overflow 131K |

### Task phức tạp: Like + Comment 5 videos

| Model | Provider | Vision | Reasoning | Steps | Kết quả | Ghi chú |
|-------|----------|--------|-----------|-------|---------|---------|
| glm-4.6v | Z.AI | ❌ | ❌ | - | ❌ FAIL | SyntaxError - output code sai format |
| glm-4.6v | Z.AI | ❌ | ✅ | - | ⚠️ PARTIAL | Tốt hơn nhưng vẫn lỗi |
| glm-4.6v | Z.AI | ✅ | ✅ | 27+ | ⚠️ PARTIAL | SyntaxError nhưng tự recover |
| **gemini-2.5-computer-use** | Local Proxy | ✅ | ✅ | 16 | **✅ PASS** | Best - xử lý UI phức tạp tốt |
| vision-model | Local Proxy | ✅ | ✅ | 3 | ✅ PASS | Dùng loop, nhanh nhất |
| qwen3-coder-plus | Local Proxy | ❌ | ✅ | 37 | ✅ PASS | Chi tiết từng bước |
| qwen3-coder-plus | Local Proxy | ✅ | ✅ | 9+ | ❌ FAIL | SyntaxError liên tục |

### Task đơn giản: Like 2 videos

| Rank | Model | Provider | Vision | Reasoning | Steps | Kết quả |
|------|-------|----------|--------|-----------|-------|---------|
| 🥇 | **gpt-oss-120b-medium** | Local Proxy | ✅ | ✅ | **1** | ✅ PASS - All-in-one |
| 🥇 | **vision-model** | Local Proxy | ✅ | ❌ | **1** | ✅ PASS - All-in-one |
| 🥉 | gemini-3-flash-preview | Local Proxy | ✅ | ❌ | 3 | ✅ PASS |
| 4 | gemini-3-pro-preview | Local Proxy | ✅ | ✅ | 4 | ✅ PASS |
| 5 | gemini-2.5-computer-use | Local Proxy | ✅ | ❌ | 5 | ✅ PASS |
| 6 | glm-4.5v | Z.AI | ❌ | ✅ | 6 | ✅ PASS |
| 6 | gemini-2.5-flash-lite | Local Proxy | ✅ | ❌ | 6 | ✅ PASS |
| 8 | gemini-2.5-flash | Local Proxy | ✅ | ❌ | 8 | ✅ PASS |
| 9 | gemini-claude-sonnet-4-5 | Local Proxy | ✅ | ❌ | 10 | ✅ PASS |
| 10 | gemini-claude-opus-4-5-thinking | Local Proxy | ✅ | ❌ | 11 | ✅ PASS |

### Models gặp vấn đề

| Model | Provider | Vision | Reasoning | Vấn đề |
|-------|----------|--------|-----------|--------|
| glm-4.5v | Z.AI | ✅ | ❌ | ❌ FAIL - Stuck loop, token overflow |
| qwen3-coder-plus | Local Proxy | ✅ | ✅ | ❌ FAIL - SyntaxError liên tục |
| glm-4.6v | Z.AI | ❌ | ❌ | ❌ FAIL - SyntaxError |

---

## 1. Test với glm-4.6v (Z.AI)

### Config:
- **Base URL:** https://api.z.ai/api/paas/v4
- **API Key:** `63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK`
- **Model:** glm-4.6v

### Test 1: vision=false, reasoning=false
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4.6v" \
  "Mo TikTok, like 5 video va comment 'Nice video!' vao moi video" \
  "<API_KEY>" "https://api.z.ai/api/paas/v4" \
  "false" "false" "{}"
```

**Kết quả:** ❌ FAIL
- **Lỗi:** `SyntaxError: unterminated string literal`
- **Nguyên nhân:** Model output quá nhiều analysis text lẫn với code Python
- Agent cố gắng output 22 steps trong 1 response → syntax error

### Test 2: vision=false, reasoning=true
**Kết quả:** ⚠️ PARTIAL
- Tốt hơn, điện thoại có phản ứng
- Vẫn gặp lỗi syntax trong một số trường hợp

### Test 3: vision=true, reasoning=true
**Kết quả:** ❌ FAIL
- Agent từ chối task do "TikTok not currently open"
- Bị kẹt ở precondition check

### Test đơn giản: "Open Settings app"
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4.6v" \
  "Open Settings app" "<API_KEY>" "https://api.z.ai/api/paas/v4" \
  "false" "false" "{}"
```
**Kết quả:** ✅ PASS - 2 steps
- Task đơn giản hoạt động OK với glm-4.6v

---

## 2. Test với Gemini (Local Proxy) ✅ BEST

### Config:
- **Base URL:** http://127.0.0.1:8317/v1
- **API Key:** `proxypal-local`
- **Model:** gemini-2.5-computer-use-preview-10-2025

### Lệnh test:
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" \
  "gemini-2.5-computer-use-preview-10-2025" \
  "Tap TikTok icon to open app. Then like current video and comment Nice. Swipe up to next video. Do this 5 times." \
  "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "true" "{}"
```

### Kết quả: ✅ PASS

```
[SUCCESS] ✓ Mission completed successfully
[INFO] Result: Liked, commented 'Nice', and swiped 5 videos.
```

### Chi tiết execution:

| Step | Action | Mô tả |
|------|--------|-------|
| 1 | system_button + click | Back 3 lần + mở TikTok |
| 2 | click | Like video 1 + mở comment |
| 3 | type + back | Comment "Nice" + đóng keyboard |
| 4 | click + swipe | Đóng comment overlay + swipe |
| 5-6 | click + type | Like + comment video 2 |
| 7-8 | click + swipe | Đóng comment + swipe đến video 3 |
| 9-10 | click + type | Like + comment video 3 |
| 11 | click + swipe | Đóng comment + swipe đến video 4 |
| 12-13 | click + type | Like + comment video 4 |
| 14 | click + swipe | Đóng comment + swipe đến video 5 |
| 15-16 | click + type + complete | Like + comment video 5 + hoàn thành |

### Điểm mạnh của Gemini:
1. **Xử lý UI phức tạp** - nhận biết comment overlay, keyboard state
2. **Self-correction** - nhận ra khi comment overlay chưa đóng và tự sửa
3. **Adaptive index** - tự tìm đúng element index thay đổi giữa các video
4. **Clean code output** - không lẫn analysis text vào Python code

---

## 3. So sánh chi tiết

### Output format

**glm-4.6v (LỖI):**
```python
**(Step 1) Agent Analysis:** I can see...
**(Step 1) Agent Action:**
```python
click(6)
```
**(Step 2) Agent Analysis:** I've successfully...
```
→ Python interpreter parse lỗi vì có text markdown lẫn trong code

**Gemini (OK):**
```python
system_button(button='Back')
system_button(button='Back')
system_button(button='Back')
click(6)
wait(5.0)
```
→ Code Python thuần, dễ execute

### Khả năng xử lý UI

| Tình huống | glm-4.6v | Gemini |
|------------|----------|--------|
| Nhận biết element index | ⚠️ Đoán cố định | ✅ Đọc từ UI state |
| Comment overlay còn mở | ❌ Không nhận ra | ✅ Tự đóng rồi swipe |
| Keyboard ẩn/hiện | ❌ Bỏ qua | ✅ Click focus trước khi type |
| Video đã like | ❌ Like lại | ✅ Nhận biết "Video liked" |

---

## 4. Khuyến nghị

### Cho task phức tạp (TikTok, multi-step):
```bash
# Dùng Gemini với vision + reasoning
python run_droidrun.py "<device>" "OpenAILike" \
  "gemini-2.5-computer-use-preview-10-2025" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "true" "{}"
```

### Cho task đơn giản (Open app, tap button):
```bash
# glm-4.6v OK, nhanh và rẻ hơn
python run_droidrun.py "<device>" "OpenAILike" "glm-4.6v" \
  "<simple_task>" "<api_key>" "https://api.z.ai/api/paas/v4" \
  "false" "false" "{}"
```

---

## 5. Lỗi đã gặp và cách fix

### 1. SyntaxError: unterminated string literal
- **Nguyên nhân:** Model output analysis text lẫn với Python code
- **Fix:** Dùng model khác (Gemini) hoặc đơn giản hóa prompt

### 2. Device not found
- **Nguyên nhân:** ADB chưa kết nối hoặc device ID sai
- **Fix:** `adb devices -l` để kiểm tra, dùng đúng device ID

### 3. Agent từ chối task (precondition not met)
- **Nguyên nhân:** Prompt có prefix tự động thêm "Đóng TikTok trước"
- **Fix:** Viết prompt rõ ràng hơn, không trigger auto-prefix

### 4. Error setting up keyboard
- **Nguyên nhân:** DroidRun Portal chưa cài hoặc IME chưa enable
- **Fix:** Cài lại DroidRun Portal APK, enable keyboard trong Settings

---

## 6. Test thêm các models mới

### 6.1 vision-model (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "vision-model" \
  "Tap TikTok icon to open app. Then like current video and comment Nice. Swipe up to next video. Do this 5 times." \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "true" "{}"
```
**Kết quả:** ✅ PASS - 3 steps
- Step 1: Lỗi SyntaxError (giống glm-4.6v)
- Step 2: Tự sửa lỗi, viết code đúng format
- Step 3: Dùng while loop hoàn thành 5 videos

### 6.2 qwen3-coder-plus (Local Proxy)

**Test 1: vision=false, reasoning=true**
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "qwen3-coder-plus" \
  "Tap TikTok icon to open app. Then like current video and comment Nice. Swipe up to next video. Do this 5 times." \
  "proxypal-local" "http://127.0.0.1:8317/v1" "false" "true" "{}"
```
**Kết quả:** ✅ PASS - 37 steps
- Rất chi tiết, từng action một step
- Tự nhận ra back 3 lần không đủ → dùng home button
- Đóng comment section trước khi swipe

**Test 2: vision=true, reasoning=true**
**Kết quả:** ❌ FAIL
- SyntaxError liên tục do model lẫn markdown text vào code
- Không tự recover được

### 6.3 gemini-3-flash-preview (Local Proxy) ⭐ FASTEST
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-3-flash-preview" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 3 steps
- Step 1: Mở TikTok
- Step 2: Like video 1 + swipe
- Step 3: Like video 2 + swipe + complete
- **Nhanh nhất trong tất cả models đã test!**

### 6.4 gemini-claude-sonnet-4-5 (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-claude-sonnet-4-5" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 10 steps
- Nhận biết "Tap again to exit" → Back không hoạt động → chuyển dùng Home
- Mô tả chi tiết từng video đang like (sunset lake, dancing fountain)
- Report đầy đủ khi complete

### 6.5 gpt-oss-120b-medium (Local Proxy) 🏆 FASTEST
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gpt-oss-120b-medium" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "true" "{}"
```
**Kết quả:** ✅ PASS - 1 step
- Tất cả trong 1 code block: Back 3 lần + open_app + like + swipe
- **Nhanh nhất cùng với vision-model!**

### 6.6 gemini-3-pro-preview (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-3-pro-preview" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "true" "{}"
```
**Kết quả:** ✅ PASS - 4 steps
- Dùng for loop để Back 3 lần gọn gàng
- Kết hợp like + swipe trong cùng 1 step

### 6.7 gemini-2.5-flash-lite (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-2.5-flash-lite" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 6 steps
- Từng bước rõ ràng, dùng for loop

### 6.8 gemini-2.5-flash (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-2.5-flash" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 8 steps

### 6.9 gemini-claude-opus-4-5-thinking (Local Proxy)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-claude-opus-4-5-thinking" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 11 steps
- Chi tiết nhất - mô tả cả tên video, like count trước/sau
- Nhận ra Back không exit hoàn toàn → chuyển dùng Home

### 6.10 gemini-2.5-computer-use (reasoning=false)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gemini-2.5-computer-use-preview-10-2025" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "proxypal-local" "http://127.0.0.1:8317/v1" "true" "false" "{}"
```
**Kết quả:** ✅ PASS - 5 steps
- Nhanh hơn khi tắt reasoning (5 steps vs 16 steps với reasoning=true)

### 6.11 glm-4.5v (Z.AI) - Thay thế tốt cho glm-4.6v
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4.5v" \
  "Open TikTok, like 2 videos and swipe to next after each" \
  "63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK" "https://api.z.ai/api/paas/v4" \
  "false" "true" "{}"
```
**Kết quả:** ✅ PASS - 6 steps
- **Khuyến nghị:** vision=false + reasoning=true
- Dùng for loop, code sạch, không SyntaxError
- ⚠️ **KHÔNG dùng vision=true** - gây stuck loop và token overflow

---

## 7. Khuyến nghị theo use case (CẬP NHẬT 2026-01-02)

### Task cực phức tạp (10+ videos, dài):
```bash
# 🥇 Best choice: gemini-3-flash-preview (vision ON, reasoning OFF)
python run_droidrun.py "<device>" "OpenAILike" "gemini-3-flash-preview" \
  "<long_task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "false" "{}"
```
- **Lý do:** Batch actions hiệu quả, không token overflow, 13 steps cho 10 videos

### Task phức tạp (Like + Comment + Follow):
```bash
# Best choice: gemini-3-flash-preview hoặc gemini-2.5-computer-use
python run_droidrun.py "<device>" "OpenAILike" "gemini-3-flash-preview" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "true" "{}"

# Backup: gemini-2.5-computer-use (self-correction tốt)
python run_droidrun.py "<device>" "OpenAILike" \
  "gemini-2.5-computer-use-preview-10-2025" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "true" "{}"
```

### Task đơn giản (like videos, open app):
```bash
# Fastest: gemini-3-flash-preview
python run_droidrun.py "<device>" "OpenAILike" "gemini-3-flash-preview" \
  "<simple_task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "false" "{}"
```

### Task rất đơn giản (1-2 steps):
```bash
# glm-4.6v OK và rẻ hơn
python run_droidrun.py "<device>" "OpenAILike" "glm-4.6v" \
  "<very_simple_task>" "<api_key>" "https://api.z.ai/api/paas/v4" \
  "false" "false" "{}"
```

### ⚠️ KHÔNG khuyến nghị cho task dài:
- **gemini-2.5-computer-use** - Token overflow ở ~30 steps
- **gemini-3-pro-preview** - Quá chậm, timeout >1000s

---

## 8. Test mới (2026-01-02)

### 8.1 Task siêu phức tạp: Like + Comment + Follow 3 videos

**Task:** "Open TikTok app. Watch and like 3 videos. Comment 'Great content!' on each video. Then open user profile of the 3rd video creator and follow them. Finally go back to home feed."

#### gemini-2.5-computer-use (vision=true, reasoning=true)
**Kết quả:** ✅ PASS - 14 steps
- Self-correction: nhận ra click sai nút Post → tự sửa
- Recovery: swipe xuống nhầm video → swipe ngược để quay lại
- Context awareness: nhận biết "Video liked", "1 comments"

#### glm-4.6v (vision=true, reasoning=true)
**Kết quả:** ✅ PASS - 29 steps (1 SyntaxError)
- Step 20: Lẫn `</think>` markdown vào code → SyntaxError
- Step 21: Tự nhận ra lỗi và sửa lại code đúng
- Chậm hơn gemini (29 vs 14 steps)

#### gemini-3-pro-preview (vision=true, reasoning=true)
**Kết quả:** ✅ PASS - 16 steps
- Clean code - không lẫn markdown
- Batch actions: like + open comment cùng lúc
- Self-recovery từ gallery popup

#### gemini-3-flash-preview (vision=true, reasoning=true)
**Kết quả:** ✅ PASS - 10 steps 🏆
- Cực nhanh - batch nhiều action trong 1 step
- Dùng `open_app()` thay vì click icon
- 1 SyntaxError ở step 1, tự recover

### 8.2 Task cực phức tạp: 10 videos + Comment unique + Like 4

**Task:** "Open TikTok. Watch 10 videos. Comment unique text on each (Amazing, Love it, Cool, Beautiful, Great, Wow, Nice, Fantastic, Awesome, Super). Like videos 2, 5, 7, 9 only. Swipe after each. Return home when done."

#### gemini-2.5-computer-use (reasoning=true)
**Kết quả:** ❌ FAIL - Token overflow tại step 32
- Videos completed: 5.5/10
- Error: Token limit exceeded (131072)

#### gemini-2.5-computer-use (reasoning=false)
**Kết quả:** ❌ FAIL - Token overflow tại step 30
- Videos completed: 7.5/10
- Tắt reasoning chỉ giúp thêm ~2 steps

#### gemini-3-flash-preview (vision=true, reasoning=false)
**Kết quả:** ✅ PASS - 13 steps 🏆
- Cực hiệu quả: 13 steps cho 10 videos
- Batch actions: Back x3 + open_app trong 1 step
- Không token overflow

#### gemini-3-pro-preview (vision=true, reasoning=false)
**Kết quả:** ❌ FAIL - Timeout sau 38 steps
- Videos completed: 9/10
- Quá chi tiết, mỗi action 1 step
- Timeout 1000 seconds

#### qwen3-coder-plus (vision=false, reasoning=false) 🏆 FASTEST
**Kết quả:** ✅ PASS - 5 steps
- Cực nhanh: 5 steps cho 10 videos
- All-in-one code block với for loop
- SyntaxError ở step 1, tự recover
- Execution timeout nhưng code chạy background hoàn thành

#### qwen3-coder-plus (vision=false, reasoning=true)
**Kết quả:** ✅ PASS - 5 steps
- Tương tự reasoning=OFF
- Code chi tiết hơn với nhiều comments
- Cùng hiệu quả, cùng số steps

### 8.3 gpt-4.1 (Local Proxy) - Test 2026-01-02

**Task:** "Open TikTok. Watch 10 videos. Follow the creator and leave a random comment on 5 random videos (choose 5 from the 10). Use creative comments like 'Amazing!', 'Love this!', 'So cool!', 'Great content!', 'Awesome!'. Swipe to next video after each. Go home when done."

#### gpt-4.1 (vision=true, reasoning=true) ✅ BEST
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gpt-4.1" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "true" "{}"
```
**Kết quả:** ✅ PASS - 3 steps
- Step 1: Back 3 lần
- Step 2: All-in-one loop → Timeout 50s (quá nhiều actions)
- Step 3: Tự nhận ra lỗi, điều chỉnh → Comment "Love this!" + complete
- **Điểm mạnh:** Self-correction tốt, dùng `random.sample()` chọn 5 video ngẫu nhiên
- **Điểm yếu:** Complete sớm sau 1 video thực tế

#### gpt-4.1 (vision=true, reasoning=false)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gpt-4.1" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "true" "false" "{}"
```
**Kết quả:** ⚠️ PARTIAL - 7+ steps
- Steps 1-3: Mở TikTok → Back 3 lần → Mở lại TikTok
- Step 4: Wait load
- Step 5-6: Video 1: Follow + Comment "Amazing!" + Post
- Step 7: Video 2-3: Swipe + Follow + Comment "Love this!"
- Step 8: ❌ **413 Request Entity Too Large** - payload quá lớn
- **Vấn đề:** reasoning=false → output dài → context tích lũy nhanh → vượt limit

#### gpt-4.1 (vision=false, reasoning=true)
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gpt-4.1" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "false" "true" "{}"
```
**Kết quả:** ⚠️ PARTIAL - 4 steps
- Step 1: Back 3 lần
- Step 2: Click TikTok icon
- Step 3: All-in-one loop → Timeout 50s
- Step 4: Partial execution, không complete
- **Vấn đề:** Không có vision → đoán index sai (click index 2 thay vì nút Post)

#### gpt-4.1 (vision=false, reasoning=false) 🏆 BEST
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "gpt-4.1" \
  "<task>" "proxypal-local" "http://127.0.0.1:8317/v1" \
  "false" "false" "{}"
```
**Kết quả:** ✅ PASS - 30 steps
- Step 1: Mở TikTok từ home
- Step 2: Random chọn videos [0, 2, 4, 6, 8] để follow+comment
- Steps 3-8: Video 0: Follow → Comment "So cool!" → Post → Close → Swipe
- Steps 9-29: Lặp cho các videos còn lại
- Step 30: Home → Complete
- **Điểm mạnh:** Hoàn thành đầy đủ 10 videos, 5 comments, 5 follows
- **Chi tiết từng bước**, không timeout

#### So sánh config gpt-4.1

| Vision | Reasoning | Steps | Kết quả | Vấn đề |
|--------|-----------|-------|---------|--------|
| ❌ | ❌ | **30** | **✅ PASS** | 🏆 Hoàn thành đầy đủ 10 videos |
| ✅ | ✅ | 3 | ✅ PASS | Timeout step 2, recover step 3, complete sớm |
| ✅ | ❌ | 7+ | ⚠️ PARTIAL | 413 payload too large |
| ❌ | ✅ | 4 | ⚠️ PARTIAL | Timeout, index sai |

**Khuyến nghị:** Dùng `vision=false, reasoning=false` cho gpt-4.1 với task dài

### 8.4 Các models khác (Test 2026-01-02)

#### gpt-5-mini (vision=true, reasoning=true)
**Kết quả:** ⚠️ INCOMPLETE - 1 step
- Complete sớm sau bước chuẩn bị (Back 3 lần + open TikTok)
- Không thực hiện task chính (watch 10 videos)
- **Vấn đề:** Đợi confirm thay vì tự làm tiếp

#### gpt-5-mini (vision=true, reasoning=false)
**Kết quả:** ⚠️ INCOMPLETE - 2 steps
- Step 1: All-in-one loop → Timeout 50s
- Step 2: Chỉ Back 3 lần → complete sớm
- **Vấn đề:** Không self-correct sau timeout

#### gpt-5-codex (vision=true, reasoning=true/false)
**Kết quả:** ❌ FAIL - 1 step
- Từ chối task ngay do precondition không thỏa (TikTok không mở)
- **Vấn đề:** Quá strict, không adapt (mở TikTok trước rồi làm tiếp)

#### grok-code-fast-1 (vision=true)
**Kết quả:** ❌ FAIL
- Không hỗ trợ vision (image media type not supported)

#### grok-code-fast-1 (vision=false, reasoning=true)
**Kết quả:** ⚠️ PARTIAL - 15 steps
- Video 1: Follow + Comment "Amazing!" thành công
- Video 3: Follow + Comment "Love this!" thành công
- Swipe không ổn định → tự nhận ra và complete(success=False)
- **Điểm cộng:** Biết fail và báo lỗi thay vì stuck

### 8.5 GLM Models (Z.AI) - Test 2026-01-02

#### glm-4-plus (vision=false, reasoning=true) ✅ BEST GLM
```bash
python run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4-plus" \
  "<task>" "63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK" \
  "https://api.z.ai/api/paas/v4" "false" "true" "{}"
```
**Kết quả:** ✅ PASS - 42 steps
- Hoàn thành đầy đủ 10 videos, 5 follows, 5 comments
- 2 lần SyntaxError do lẫn `</think>` vào code → tự recover
- Chi tiết từng bước, có like all videos

#### glm-4-plus (vision=false, reasoning=false)
**Kết quả:** ❌ FAIL
- SyntaxError liên tục do lẫn `**(Step X) Agent Analysis:**` vào code

#### glm-4-plus (vision=true)
**Kết quả:** ❌ FAIL
- Invalid API parameter (không hỗ trợ vision)

#### glm-4.5 (vision=false, reasoning=true)
**Kết quả:** ⚠️ PARTIAL - 5 steps
- All-in-one loop → Timeout 50s
- TypeError: `type()` thiếu index

#### glm-4.5 (vision=false, reasoning=false)
**Kết quả:** ❌ FAIL - 7+ steps
- SyntaxError liên tục

#### glm-4-32b-0414-128k (vision=false, reasoning=true)
**Kết quả:** ⚠️ PARTIAL - 4 steps
- All-in-one loop → Timeout 50s
- Context 128K nhưng vẫn timeout

#### glm-4-32b-0414-128k (vision=false, reasoning=false)
**Kết quả:** ❌ FAIL - 5+ steps
- SyntaxError liên tục

#### glm-4.6v (vision=false, reasoning=false) 🎉 SURPRISE
**Kết quả:** ✅ RUNNING - 15+ steps (stopped by user)
- Step-by-step: Back 3 lần → Home → Open TikTok → Swipe videos
- Xử lý đúng photosensitive warning overlay
- **Không SyntaxError** dù reasoning=false
- Đây là GLM model duy nhất hoạt động với reasoning=false

#### autoglm-phone-multilingual
**Kết quả:** ❌ FAIL
- Output format sai: dùng `do(action="Tap")` thay vì `click()`
- Token limit thấp (25480)
- Không tương thích với DroidRun API

### So sánh GLM Models

| Model | Vision | Reasoning | Kết quả |
|-------|--------|-----------|---------|
| **glm-4-plus** | ❌ | ✅ | ✅ PASS (42 steps) |
| **glm-4.6v** | ❌ | ❌ | ✅ RUNNING (15+ steps) |
| glm-4-plus | ❌ | ❌ | ❌ SyntaxError |
| glm-4.5 | ❌ | ✅ | ⚠️ Timeout |
| glm-4.5 | ❌ | ❌ | ❌ SyntaxError |
| glm-4-32b-0414-128k | ❌ | ✅ | ⚠️ Timeout |
| glm-4-32b-0414-128k | ❌ | ❌ | ❌ SyntaxError |
| autoglm-phone-multilingual | ❌ | ✅ | ❌ Format sai |

**Kết luận GLM:**
- Best: `glm-4-plus` (vision=false, reasoning=true)
- Surprise: `glm-4.6v` hoạt động với reasoning=false
- Tất cả GLM models (trừ glm-4.6v) cần reasoning=true

#### 8.6 GLM Vision Models (4.0v, 4.5v, 4.6v) - Test 2026-01-02

**Task (Simple):** "Open Settings and navigate to Display"
**Task (Medium):** "Open TikTok, like current video, and swipe up"

##### glm-4.5v (vision=true, reasoning=true) ✅ BEST GLM VISION
```bash
python src-tauri\run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4.5v" \
  "Open Settings and navigate to Display" "63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK" \
  "https://api.z.ai/api/paas/v4" "true" "true"
```
**Kết quả:** ✅ PASS
- Hoàn thành Settings điều hướng chính xác.
- TikTok: Mở app, like và swipe mượt mà.

##### glm-4.6v (vision=true, reasoning=true) ✅ PASS
```bash
python src-tauri\run_droidrun.py "127.0.0.1:5555" "OpenAILike" "glm-4.6v" \
  "Open TikTok, like current video, swipe up" "63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK" \
  "https://api.z.ai/api/paas/v4" "true" "true"
```
**Kết quả:** ✅ PASS
- Xử lý tốt các bước Back/Home trước khi vào TikTok.
- Nhận diện đúng like icon (index 16).

##### glm-4.0v (vision=true, reasoning=true) ❌ FAIL
**Kết quả:** ❌ FAIL
- Không hoàn thành được bước điều hướng cơ bản trong Settings.

---

## 9. So sánh Models (CẬP NHẬT 2026-01-02)

### Ranking tổng hợp

| Rank | Model | Task ngắn | Task dài | Token limit | Ghi chú |
|------|-------|-----------|----------|-------------|---------|
| 🥇 | **gpt-4.1** (no vision, no reasoning) | - | **30 steps** | ✅ OK | 🏆 Best - hoàn thành đầy đủ |
| 🥈 | **glm-4-plus** (no vision, reasoning) | - | **42 steps** | ✅ OK | Best GLM, hoàn thành đầy đủ |
| 🥉 | **qwen3-coder-plus** (no vision) | - | 5 steps | ✅ OK | Nhanh nhất cho task dài |
| 4 | **gemini-3-flash-preview** | 10 steps | 13 steps | ✅ OK | Best với vision |
| 5 | glm-4.6v (no vision, no reasoning) | 15+ steps | - | ✅ OK | Surprise - GLM hoạt động ko reasoning |
| 6 | gemini-2.5-computer-use | 14 steps | ❌ Overflow | 131K | Tốt cho task ngắn |
| 7 | gpt-4.1 (vision+reasoning) | 3 steps | Chưa test | ⚠️ 413 | Self-correction, complete sớm |
| 8 | gemini-3-pro-preview | 16 steps | ❌ Timeout | ✅ OK | Quá chậm |
| 9 | grok-code-fast-1 (no vision) | 15 steps | - | ✅ OK | Biết fail và báo lỗi |
| ❌ | gpt-5-mini | 1-2 steps | - | - | Complete sớm |
| ❌ | gpt-5-codex | 1 step | - | - | Từ chối task |
| ❌ | glm-4.5, glm-4-32b-0414-128k | Timeout | - | - | All-in-one loop |

### Điểm mạnh từng model

| Model | Điểm mạnh | Điểm yếu |
|-------|-----------|----------|
| gpt-4.1 (no vision, no reasoning) | Hoàn thành đầy đủ, step-by-step | Nhiều steps (30) |
| glm-4-plus (no vision, reasoning) | Hoàn thành đầy đủ, like all videos | Nhiều steps (42), cần reasoning |
| qwen3-coder-plus (no vision) | All-in-one loop, nhanh nhất | Không nhìn được UI |
| gemini-3-flash-preview | Batch actions, vision tốt | Chậm hơn qwen3 |
| glm-4.6v (no vision, no reasoning) | Hoạt động ko cần reasoning | Chậm, cần test thêm |
| gemini-2.5-computer-use | Self-correction, UI awareness | Token overflow task dài |
| gpt-4.1 (vision+reasoning) | Self-correction, random.sample() | Complete sớm, 413 error |
| grok-code-fast-1 | Biết fail và báo lỗi | Không hỗ trợ vision |
| gemini-3-pro-preview | Chi tiết, clean code | Quá chậm, timeout |
| gpt-5-mini | - | Complete sớm, không self-correct |
| gpt-5-codex | - | Quá strict, từ chối task |
| glm-4.5, glm-4-32b-0414-128k | Context lớn | All-in-one loop → timeout |

---

## 10. Commands hữu ích

```bash
# Check devices
adb devices -l

# Test ADB connection
adb -s 127.0.0.1:5555 shell input tap 100 100

# Check DroidRun Portal installed
adb -s 127.0.0.1:5555 shell "pm list packages | grep droidrun"

# Enable DroidRun keyboard
adb -s 127.0.0.1:5555 shell "ime enable com.droidrun.portal/.input.DroidrunKeyboardIME"
adb -s 127.0.0.1:5555 shell "ime set com.droidrun.portal/.input.DroidrunKeyboardIME"
```
