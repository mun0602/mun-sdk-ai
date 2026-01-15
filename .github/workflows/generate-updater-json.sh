#!/bin/bash
# Script tự động tạo updater.json từ GitHub Release

VERSION="$1"
REPO_OWNER="YOUR_USERNAME"
REPO_NAME="YOUR_REPO"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 3.21.0"
  exit 1
fi

BASE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${VERSION}"

cat > updater.json <<EOF
{
  "version": "${VERSION}",
  "notes": "See release notes at https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${VERSION}",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "",
      "url": "${BASE_URL}/MUN_SDK_AI_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "",
      "url": "${BASE_URL}/MUN_SDK_AI_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "${BASE_URL}/mun-sdk-ai-v2_${VERSION}_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "${BASE_URL}/MUN_SDK_AI_${VERSION}_x64-setup.nsis.zip"
    }
  }
}
EOF

echo "✅ Created updater.json for version ${VERSION}"
echo "📝 Don't forget to fill in the 'signature' fields from .sig files!"
