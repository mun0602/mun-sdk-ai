# 🍎 Hướng dẫn cài đặt trên macOS

## Yêu cầu hệ thống
- macOS 10.15+
- Python 3.8+ (đã cài sẵn)

## Cài đặt tự động

### Cách 1: Script tự động (Khuyến nghị)
```bash
cd droidrun_gui_tauri_v2
./install-mac.sh
```

Script sẽ tự động:
- ✅ Kiểm tra Python
- ✅ Kiểm tra và cài ADB (nếu chưa có)
- ✅ Cài đặt DroidRun package
- ✅ Cài đặt OpenAI-Like provider

### Cách 2: Cài đặt thủ công

**Bước 1: Cài ADB** (nếu chưa có)
```bash
# Qua Homebrew
brew install android-platform-tools

# Hoặc tải Android SDK Platform Tools
# https://developer.android.com/tools/releases/platform-tools
```

**Bước 2: Cài Python packages**
```bash
pip3 install droidrun
pip3 install llama-index-llms-openai-like
```

**Bước 3: Kiểm tra**
```bash
python3 -c "import droidrun; print(droidrun.__version__)"
adb version
```

## Chạy ứng dụng

### Development mode
```bash
npm run tauri:dev
```

### Production mode
Mở file `.dmg` hoặc `.app` trong thư mục:
```
src-tauri/target/release/bundle/macos/
```

## Xử lý lỗi

### "adb: command not found"
**Nguyên nhân:** ADB chưa được cài hoặc chưa có trong PATH

**Giải pháp:**
```bash
# Cài ADB
brew install android-platform-tools

# Hoặc thêm vào PATH
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
echo 'export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"' >> ~/.zshrc
```

### "No module named 'droidrun'"
**Nguyên nhân:** DroidRun package chưa được cài

**Giải pháp:**
```bash
pip3 install droidrun
# hoặc
python3 -m pip install droidrun
```

### "xcrun: error: invalid active developer path"
**Nguyên nhân:** Xcode Command Line Tools chưa được cài

**Giải pháp:**
```bash
xcode-select --install
```

## Tips

### Kiểm tra Python
```bash
which python3
python3 --version
```

### Kiểm tra ADB
```bash
which adb
adb devices
```

### Cập nhật packages
```bash
pip3 install --upgrade droidrun
pip3 install --upgrade llama-index-llms-openai-like
```

### Kết nối thiết bị Android
```bash
# USB: Bật USB Debugging trên thiết bị
adb devices

# WiFi: Kết nối qua mạng
adb connect <IP>:5555
```

## Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Python đã được cài đúng chưa
2. ADB có trong PATH không
3. Thiết bị Android đã bật USB Debugging chưa
4. Đã cho phép kết nối ADB trên thiết bị chưa
