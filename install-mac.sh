#!/bin/bash

# Script cài đặt DroidRun GUI cho macOS
# Yêu cầu: Python đã được cài đặt

set -e

echo "🚀 Cài đặt DroidRun GUI cho macOS"
echo "=================================="
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
    echo "Hãy cài Python 3 trước: brew install python3"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo "✅ Tìm thấy $PYTHON_VERSION"
echo ""

# Kiểm tra ADB
echo "2️⃣ Kiểm tra ADB..."
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version | head -n 1)
    echo "✅ Tìm thấy $ADB_VERSION"
else
    echo "⚠️  ADB chưa được cài đặt"
    echo ""
    echo "Cài đặt ADB qua Homebrew:"
    echo "  brew install android-platform-tools"
    echo ""
    read -p "Bạn có muốn cài ADB ngay không? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v brew &> /dev/null; then
            brew install android-platform-tools
            echo "✅ ADB đã được cài đặt"
        else
            echo "❌ Homebrew chưa được cài đặt"
            echo "Cài Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    else
        echo "⏭️  Bỏ qua cài đặt ADB"
    fi
fi
echo ""

# Cài đặt DroidRun package
echo "3️⃣ Cài đặt DroidRun package..."
if $PYTHON_CMD -c "import droidrun" 2>/dev/null; then
    DROIDRUN_VERSION=$($PYTHON_CMD -c "import droidrun; print(droidrun.__version__)" 2>/dev/null || echo "unknown")
    echo "ℹ️  DroidRun $DROIDRUN_VERSION đã được cài đặt"
    read -p "Bạn có muốn cập nhật không? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Đang cập nhật DroidRun..."
        $PIP_CMD install --upgrade droidrun
        echo "✅ DroidRun đã được cập nhật"
    else
        echo "⏭️  Giữ nguyên phiên bản hiện tại"
    fi
else
    echo "📦 Đang cài đặt DroidRun..."
    $PIP_CMD install droidrun
    echo "✅ DroidRun đã được cài đặt"
fi
echo ""

# Cài đặt llama-index-llms-openai-like
echo "4️⃣ Cài đặt OpenAI-Like provider..."
if $PYTHON_CMD -c "import llama_index.llms.openai_like" 2>/dev/null; then
    echo "✅ llama-index-llms-openai-like đã được cài đặt"
else
    echo "📦 Đang cài đặt llama-index-llms-openai-like..."
    $PIP_CMD install llama-index-llms-openai-like
    echo "✅ llama-index-llms-openai-like đã được cài đặt"
fi
echo ""

# Kiểm tra lại
echo "✅ Hoàn tất cài đặt!"
echo "=================================="
echo "Thông tin phiên bản:"
echo "  Python: $PYTHON_VERSION"
if command -v adb &> /dev/null; then
    echo "  ADB: $(adb version | head -n 1)"
fi
DROIDRUN_VERSION=$($PYTHON_CMD -c "import droidrun; print(droidrun.__version__)" 2>/dev/null || echo "unknown")
echo "  DroidRun: $DROIDRUN_VERSION"
echo ""
echo "🎉 Bạn có thể chạy ứng dụng ngay!"
