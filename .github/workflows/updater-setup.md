# Auto Update Setup Guide

## 1. Generate Signing Keys

Chạy lệnh sau để tạo cặp key:

```bash
# Tạo private key (GIỮ BÍ MẬT!)
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048

# Tạo public key từ private key
openssl rsa -pubout -in private.key -out public.key
```

## 2. Cấu hình GitHub Secrets

Vào `Settings > Secrets and variables > Actions` của repo và thêm:

- `TAURI_SIGNING_PRIVATE_KEY`: Nội dung file `private.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: (để trống nếu không set password)

## 3. Cập nhật tauri.conf.json

Thay `YOUR_PUBLIC_KEY_HERE` bằng nội dung public key (1 dòng, bỏ header/footer):

```bash
# Lấy public key dạng 1 dòng
cat public.key | grep -v "PUBLIC KEY" | tr -d '\n'
```

Thay `YOUR_USERNAME/YOUR_REPO` bằng GitHub repo của bạn.

## 4. Workflow sẽ tự động

Khi push tag `v*`, GitHub Actions sẽ:
1. Build app cho Windows, macOS, Linux
2. Tạo GitHub Release (draft)
3. Upload installers + updater artifacts (.sig files)
4. Tự động publish release

## 5. App tự động check updates

Frontend đã có sẵn code check update trong `SettingsPanel.jsx`.
