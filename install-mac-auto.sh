#!/bin/bash

# Script cài đặt DroidRun GUI cho macOS (không tương tác)
# Yêu cầu: Python đã được cài đặt

set -e

echo "🚀 Cài đặt DroidRun GUI cho macOS (Auto)"
echo "========================================"
echo ""

# Kiểm tra Python
echo "1️⃣ Kiểm tra Python..."
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
    PIP_CMD=pip3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
    PIP_CMD=pip
else
    echo "❌ Python chưa được cài đặt"
    echo "Hãy cài Python 3: brew install python3"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo "✅ $PYTHON_VERSION"
echo ""

# Kiểm tra ADB
echo "2️⃣ Kiểm tra ADB..."
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version | head -n 1)
    echo "✅ $ADB_VERSION"
else
    echo "⚠️  ADB chưa được cài đặt"
    if command -v brew &> /dev/null; then
        echo "📦 Đang cài ADB qua Homebrew..."
        brew install android-platform-tools
        echo "✅ ADB đã được cài đặt"
    else
        echo "⚠️  Homebrew chưa có. Bỏ qua ADB"
        echo "   Cài thủ công: brew install android-platform-tools"
    fi
fi
echo ""

# Cài đặt DroidRun (bỏ qua nếu không có trên PyPI)
echo "3️⃣ Kiểm tra DroidRun package..."
if $PYTHON_CMD -c "import droidrun" 2>/dev/null; then
    DROIDRUN_VER=$($PYTHON_CMD -c "import droidrun; print(droidrun.__version__)" 2>/dev/null || echo "unknown")
    echo "✅ DroidRun $DROIDRUN_VER đã có"
else
    echo "⚠️  DroidRun chưa có (không bắt buộc cho GUI)"
    echo "   Package này có thể chưa được publish lên PyPI"
fi
echo ""

# Cài đặt OpenAI-Like provider
echo "4️⃣ Cài đặt OpenAI-Like provider..."
if ! $PYTHON_CMD -c "import llama_index.llms.openai_like" 2>/dev/null; then
    echo "📦 Đang cài đặt llama-index-llms-openai-like..."
    $PIP_CMD install llama-index-llms-openai-like
fi
echo "✅ OpenAI-Like OK"
echo ""

# Tóm tắt
echo "=================================="
echo "✅ Hoàn tất cài đặt!"
echo ""
echo "Thông tin:"
echo "  Python: $($PYTHON_CMD --version)"
if command -v adb &> /dev/null; then
    echo "  ADB: $(adb version | head -n 1)"
else
    echo "  ADB: Chưa cài (không bắt buộc)"
fi
DROIDRUN_VER=$($PYTHON_CMD -c "import droidrun; print(droidrun.__version__)" 2>/dev/null || echo "unknown")
echo "  DroidRun: $DROIDRUN_VER"
echo ""
echo "🎉 Chạy app: npm run tauri:dev"
