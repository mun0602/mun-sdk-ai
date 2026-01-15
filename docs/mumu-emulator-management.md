# Quản lý giả lập Android (MuMu & BlueStacks)

## So sánh MuMu vs BlueStacks

| Tính năng | MuMu | BlueStacks |
|-----------|------|------------|
| Tạo mới CLI | ✅ `create -n 1` | ❌ Chỉ GUI |
| Clone CLI | ✅ `clone -v 0` | ❌ Bị lock |
| Xóa CLI | ✅ `delete -v 1` | ⚠️ Có (nhưng phá config) |
| Khởi động CLI | ✅ | ✅ |
| Tắt CLI | ✅ | ✅ |
| ADB port | 16384+ (cách 32) | 5555+ |

---

# MuMu Player

## Đường dẫn cài đặt

```
C:\NetEase\MuMu\nx_main\               # Quản lý chính
C:\NetEase\MuMu\nx_device\12.0\shell\  # Điều khiển thiết bị
```

## Cách tìm đường dẫn MuMu

1. Mở MuMu Player
2. Click chuột phải vào icon MuMu trên taskbar
3. Chọn **"Open file location"** hoặc **"Mở vị trí tệp"**
4. Copy đường dẫn từ thanh địa chỉ

## Công cụ chính

| File | Mô tả |
|------|-------|
| `MuMuManager.exe` | CLI quản lý đa giả lập |
| `MuMuNxMain.exe` | Ứng dụng chính |
| `adb.exe` | Kết nối ADB |
| `NemuShell.exe` | Shell command |

## Các lệnh MuMuManager

### Xem help
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" -h
```

### Xem thông tin tất cả giả lập
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" info -v all
```

### Tạo giả lập mới
```cmd
# Tạo 1 giả lập
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" create -n 1

# Tạo 3 giả lập
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" create -n 3
```

### Khởi động giả lập
```cmd
# Khởi động giả lập index 0
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" control -v 0 launch

# Khởi động nhiều giả lập
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" control -v 0,1,2 launch
```

### Tắt giả lập
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" control -v 0 shutdown
```

### Xóa giả lập
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" delete -v 1
```

### Đổi tên giả lập
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" rename -v 0 -n "MyEmulator"
```

### Clone giả lập
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" clone -v 0
```

## Kết nối ADB

### Kết nối đến giả lập
```cmd
# Port mặc định: 16384, 16416, 16448... (cách nhau 32)
"C:\NetEase\MuMu\nx_main\adb.exe" connect 127.0.0.1:16384
```

### Chạy lệnh ADB qua MuMuManager
```cmd
"C:\NetEase\MuMu\nx_main\MuMuManager.exe" adb -v 0 -c "shell input tap 500 500"
```

### Kiểm tra thiết bị đã kết nối
```cmd
"C:\NetEase\MuMu\nx_main\adb.exe" devices
```

## Ví dụ output info

```json
{
  "0": {
    "adb_host_ip": "127.0.0.1",
    "adb_port": 16384,
    "name": "NEmu NoADs",
    "is_android_started": true,
    "is_process_started": true,
    "player_state": "start_finished",
    "pid": 12492
  },
  "1": {
    "name": "MuMu安卓设备-1",
    "is_android_started": false,
    "is_process_started": false
  }
}
```

## Tích hợp với Tauri

```javascript
import { Command } from '@tauri-apps/plugin-shell';

const MUMU_PATH = 'C:\\NetEase\\MuMu\\nx_main\\MuMuManager.exe';

// Lấy danh sách giả lập
async function getEmulators() {
  const cmd = Command.create('cmd', ['/C', MUMU_PATH, 'info', '-v', 'all']);
  const output = await cmd.execute();
  return JSON.parse(output.stdout);
}

// Tạo giả lập mới
async function createEmulator() {
  const cmd = Command.create('cmd', ['/C', MUMU_PATH, 'create', '-n', '1']);
  return await cmd.execute();
}

// Khởi động giả lập
async function launchEmulator(index) {
  const cmd = Command.create('cmd', ['/C', MUMU_PATH, 'control', '-v', index.toString(), 'launch']);
  return await cmd.execute();
}

// Tắt giả lập
async function shutdownEmulator(index) {
  const cmd = Command.create('cmd', ['/C', MUMU_PATH, 'control', '-v', index.toString(), 'shutdown']);
  return await cmd.execute();
}
```

## Subcommands đầy đủ

| Subcommand | Mô tả |
|------------|-------|
| `version` | Xem phiên bản |
| `info` | Thông tin giả lập |
| `create` | Tạo giả lập |
| `clone` | Clone giả lập |
| `delete` | Xóa giả lập |
| `rename` | Đổi tên |
| `import` | Import .mumudata |
| `export` | Export .mumudata |
| `control` | Điều khiển (launch/shutdown) |
| `setting` | Cấu hình |
| `adb` | Chạy lệnh ADB |
| `simulation` | Thay đổi thuộc tính giả lập |
| `sort` | Sắp xếp cửa sổ |
| `driver` | Quản lý driver |
| `sh` | Chạy shell |

---

# BlueStacks

## Đường dẫn cài đặt

```
C:\Program Files\BlueStacks_nxt\
```

## Cách tìm đường dẫn BlueStacks

1. Mở BlueStacks
2. Click chuột phải vào icon BlueStacks trên taskbar
3. Chọn **"Open file location"** hoặc **"Mở vị trí tệp"**
4. Copy đường dẫn từ thanh địa chỉ

## Công cụ chính

| File | Mô tả |
|------|-------|
| `HD-Player.exe` | Chạy giả lập |
| `HD-MultiInstanceManager.exe` | Quản lý đa instance (GUI) |
| `HD-Adb.exe` | ADB |
| `BstkVMMgr.exe` | VM Manager (VBoxManage) |

## Các lệnh BlueStacks CLI

### Liệt kê tất cả instances
```cmd
"C:\Program Files\BlueStacks_nxt\BstkVMMgr.exe" list vms
```

### Liệt kê instances đang chạy
```cmd
"C:\Program Files\BlueStacks_nxt\BstkVMMgr.exe" list runningvms
```

### Khởi động instance
```cmd
"C:\Program Files\BlueStacks_nxt\HD-Player.exe" --instance Pie64
```

### Tắt instance
```cmd
# Tắt cứng
"C:\Program Files\BlueStacks_nxt\BstkVMMgr.exe" controlvm Pie64 poweroff

# Tắt mềm (ACPI)
"C:\Program Files\BlueStacks_nxt\BstkVMMgr.exe" controlvm Pie64 acpipowerbutton
```

### Xem thông tin instance
```cmd
"C:\Program Files\BlueStacks_nxt\BstkVMMgr.exe" showvminfo Pie64
```

## Kết nối ADB

```cmd
# Kết nối (port mặc định 5555)
"C:\Program Files\BlueStacks_nxt\HD-Adb.exe" connect 127.0.0.1:5555

# Kiểm tra thiết bị
"C:\Program Files\BlueStacks_nxt\HD-Adb.exe" devices
```

## Ví dụ output list vms

```
"Pie64" {4e276be3-7cd1-41c4-9ae6-979f164c42ba}
```

## Tích hợp với Tauri

```javascript
import { Command } from '@tauri-apps/plugin-shell';

const BLUESTACKS_PATH = 'C:\\Program Files\\BlueStacks_nxt';

// Lấy danh sách instances
async function getInstances() {
  const cmd = Command.create('cmd', ['/C', `"${BLUESTACKS_PATH}\\BstkVMMgr.exe"`, 'list', 'vms']);
  const output = await cmd.execute();
  // Parse output: "Name" {uuid}
  const lines = output.stdout.trim().split('\n');
  return lines.map(line => {
    const match = line.match(/"(.+)" \{(.+)\}/);
    return match ? { name: match[1], uuid: match[2] } : null;
  }).filter(Boolean);
}

// Khởi động instance
async function launchInstance(name) {
  const cmd = Command.create('cmd', ['/C', `"${BLUESTACKS_PATH}\\HD-Player.exe"`, '--instance', name]);
  return await cmd.execute();
}

// Tắt instance
async function shutdownInstance(name) {
  const cmd = Command.create('cmd', ['/C', `"${BLUESTACKS_PATH}\\BstkVMMgr.exe"`, 'controlvm', name, 'poweroff']);
  return await cmd.execute();
}

// Kiểm tra instance đang chạy
async function isRunning(name) {
  const cmd = Command.create('cmd', ['/C', `"${BLUESTACKS_PATH}\\BstkVMMgr.exe"`, 'list', 'runningvms']);
  const output = await cmd.execute();
  return output.stdout.includes(name);
}
```

## Hạn chế của BlueStacks CLI

- ❌ Không thể tạo instance mới bằng CLI (phải dùng `HD-MultiInstanceManager.exe` GUI)
- ❌ Không thể clone instance bằng CLI
- ⚠️ Xóa instance bằng CLI có thể phá vỡ cấu hình BlueStacks
