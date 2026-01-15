# Update Log

## 2026-01-10 (v4) - ScripterAgent Integration

### 🤖 ScripterAgent - Off-device Python Automation
ScripterAgent là một chuyên gia lập trình Python phụ trách xử lý logic "off-device" cho hệ thống tự động hóa DroidRun. Agent này có khả năng:
- Gọi API, xử lý tệp tin (JSON/CSV), biến đổi dữ liệu phức tạp
- Tự sinh mã Python từ prompt ngôn ngữ tự nhiên (AI-powered)
- Self-healing: Phân tích lỗi và đề xuất sửa lỗi tự động

### 📁 Files Added/Changed

#### New: `src-tauri/scripter_wrapper.py`
Python wrapper an toàn với đầy đủ helper functions:
- `get_input(name, default)` / `get_context(name, default)` - Lấy dữ liệu đầu vào
- `set_result(key, value)` - **BẮT BUỘC** gọi để trả về kết quả
- `log(message, level)` - Ghi log với timestamp
- `http_get()` / `http_post()` - HTTP requests với error handling
- `read_json_file()` / `write_json_file()` - Đọc/ghi JSON
- `read_csv_file()` / `write_csv_file()` - Đọc/ghi CSV
- `parse_number()` / `format_number()` - Xử lý số
- `random_delay()` / `timestamp_now()` - Utilities

**An toàn:** Block các module nguy hiểm (os, sys, subprocess)

#### Changed: `src-tauri/src/workflow.rs`
- **`run_python_script()`**: Refactored để sử dụng `scripter_wrapper.py`
- **`generate_python_from_prompt()`**: System prompt mới với đầy đủ helper functions
- **`find_scripter_wrapper()`**: Tìm wrapper trong dev/prod paths

#### Changed: `src-tauri/src/task.rs`
- **Self-healing integration**: Thêm `analyze_error_and_suggest_fix()`
- **`SelfHealResult`** struct với:
  - `root_cause`: Nguyên nhân gốc (1 dòng)
  - `analysis`: Phân tích kỹ thuật chi tiết
  - `suggestions`: Danh sách đề xuất sửa lỗi cụ thể
  - `auto_fix_available`: Có thể tự sửa không
  - `retry_params`: Tham số để retry (wait_longer, additional_wait_ms, etc.)
- **Event `scripter-self-heal`**: Emit chi tiết phân tích lỗi ra frontend

#### Changed: `src-tauri/src/lib.rs`
- **`run_scripter_skill()`**: Nâng cấp với:
  - Thêm `context_vars` parameter
  - System prompt tiếng Việt với đầy đủ API reference
  - Events: `scripter-skill-start`, `scripter-skill-code`, `scripter-skill-complete`, `scripter-skill-error`
- **`run_scripter_code()`**: NEW - Chạy Python code trực tiếp (advanced users)

### 🔌 Tauri Commands
```typescript
// Chạy ScripterAgent skill từ prompt
invoke('run_scripter_skill', {
  prompt: "Lấy giá vàng và tính số lượng mua được",
  deviceId: "127.0.0.1:5555",
  inputs: { budget: 10000000 },
  contextVars: { previous_result: "..." }
})

// Chạy Python code trực tiếp
invoke('run_scripter_code', {
  code: "set_result('hello', 'world')",
  deviceId: "127.0.0.1:5555"
})
```

### 📡 Frontend Events
- `scripter-skill-start` - Bắt đầu skill
- `scripter-skill-code` - Code đã được sinh
- `scripter-skill-complete` - Hoàn thành thành công
- `scripter-skill-error` - Lỗi xảy ra
- `scripter-output` - Output stream từ Python
- `scripter-self-heal` - Kết quả phân tích self-healing

### 💡 Example Usage
```python
# Script được sinh tự động từ prompt: "Lấy giá vàng từ API"
budget = get_input('budget', 10000000)
try:
    result = http_get('https://api.example.com/gold-price')
    if result['success']:
        price = result['data']['price']
        amount = budget / price
        log(f"Giá vàng: {format_number(price)} VND/chỉ")
        set_result('gold_amount', amount)
        set_result('current_price', price)
    else:
        log(f"Lỗi API: {result.get('error')}", "error")
        set_result('error', result.get('error'))
except Exception as e:
    log(f"Lỗi: {e}", "error")
    set_result('error', str(e))
```

---

## 2026-01-10 (v3) - Python Backend Executor

### 🐍 Chuyển sang Python Executor
- **100% backend execution** - Workflow giờ chạy hoàn toàn trong Python
- `time.sleep()` đáng tin cậy cho delays giữa các action
- Logs được stream real-time qua Tauri events

### 📁 Files changed
- `src-tauri/droidrun_executor.py`:
  - Thêm `execute_workflow()` function
  - Nhận workflow JSON, thực thi từng step với `time.sleep()` giữa các action
  - Usage: `py droidrun_executor.py --workflow workflow.json 127.0.0.1:5555`

- `src-tauri/src/workflow.rs`:
  - Thêm `run_workflow_python` command
  - Ghi workflow ra temp file, gọi Python executor, parse kết quả

- `src-tauri/src/lib.rs`:
  - Register `workflow::run_workflow_python` command

- `src/store.js`:
  - Thêm `runWorkflowPython()` function
  - Gọi Rust command `run_workflow_python`

- `src/components/WorkflowPanel.jsx` & `ExecutionPanel.jsx`:
  - Sử dụng `runWorkflowPython` thay vì `runWorkflow`

### ⏱️ Delay Logic
- `waitAfter`: Base delay (ms) sau mỗi step
- `waitVariance`: % variance (chỉ tăng, không giảm)
- Default: 500ms + 15% = 500-575ms
- Ví dụ: 1000ms + 30% = 1000-1300ms

---

## 2026-01-10 (v2)

### 🔧 Fix Random Time - Lưu trực tiếp
- Khi bấm "Áp dụng" trong Random Time modal, workflow được **LƯU NGAY** vào store

---

## 2026-01-10 (v1)

### 🎯 Custom Random Time Modal
- Modal cho phép nhập phạm vi % variance tùy chỉnh

### 💾 Cảnh báo chưa lưu khi đóng editor  
- Confirm dialog khi đóng modal mà chưa lưu
