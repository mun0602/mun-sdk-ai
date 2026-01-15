#!/usr/bin/env python3
"""
Real Workflow Test Script - Test workflow THẬT với ADB trên điện thoại
Chạy: python test_real_workflow.py

Script này gọi trực tiếp ADB commands giống như backend Rust của app
"""

import json
import random
import time
import subprocess
import sys
import os

# ============ ADB HELPERS ============

def run_adb(device_id: str, args: list, timeout: int = 30) -> tuple:
    """Chạy ADB command thật"""
    cmd = ["adb", "-s", device_id] + args
    cmd_str = ' '.join(cmd)
    print(f"  📱 [ADB] {cmd_str}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        success = result.returncode == 0
        output = result.stdout.strip() or result.stderr.strip()
        if success:
            print(f"       ✓ OK")
        else:
            print(f"       ✗ Failed: {output[:100]}")
        return success, output
    except subprocess.TimeoutExpired:
        print(f"       ⏰ Timeout!")
        return False, "Timeout"
    except FileNotFoundError:
        print(f"       ❌ ADB not found!")
        return False, "ADB not found"

def get_devices() -> list:
    """Lấy danh sách thiết bị ADB đã kết nối"""
    try:
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')[1:]
        devices = []
        for line in lines:
            if '\tdevice' in line:
                device_id = line.split('\t')[0]
                devices.append(device_id)
        return devices
    except:
        return []

def human_delay(min_s: float = 0.5, max_s: float = 2.0):
    """Random delay mô phỏng người dùng"""
    delay = random.uniform(min_s, max_s)
    print(f"       ⏳ Delay {delay:.1f}s...")
    time.sleep(delay)

# ============ WORKFLOW ACTIONS ============
# Các action tương tự workflow.rs trong backend Rust

def action_open_app(device_id: str, package: str):
    """Mở app theo package name"""
    print(f"\n  ▶️ Mở app: {package}")
    success, _ = run_adb(device_id, ["shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"])
    human_delay(2, 3)  # Chờ app mở
    return success

def action_tap(device_id: str, x: int, y: int):
    """Tap vào vị trí (x, y)"""
    print(f"\n  ▶️ Tap: ({x}, {y})")
    success, _ = run_adb(device_id, ["shell", "input", "tap", str(x), str(y)])
    human_delay(0.3, 0.8)
    return success

def action_double_tap(device_id: str, x: int, y: int):
    """Double tap (like TikTok)"""
    print(f"\n  ▶️ Double Tap: ({x}, {y})")
    run_adb(device_id, ["shell", "input", "tap", str(x), str(y)])
    time.sleep(0.1)
    run_adb(device_id, ["shell", "input", "tap", str(x), str(y)])
    human_delay(0.5, 1.0)
    return True

def action_swipe(device_id: str, x1: int, y1: int, x2: int, y2: int, duration: int = 300):
    """Swipe từ (x1,y1) đến (x2,y2)"""
    print(f"\n  ▶️ Swipe: ({x1},{y1}) → ({x2},{y2})")
    success, _ = run_adb(device_id, ["shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration)])
    human_delay(0.3, 0.8)
    return success

def action_swipe_up(device_id: str):
    """Swipe lên (scroll/next video)"""
    # Random một chút để realistic
    x = random.randint(450, 550)
    y1 = random.randint(1400, 1600)
    y2 = random.randint(400, 600)
    duration = random.randint(200, 400)
    return action_swipe(device_id, x, y1, x, y2, duration)

def action_swipe_down(device_id: str):
    """Swipe xuống (scroll up/previous)"""
    x = random.randint(450, 550)
    y1 = random.randint(400, 600)
    y2 = random.randint(1400, 1600)
    duration = random.randint(200, 400)
    return action_swipe(device_id, x, y1, x, y2, duration)

def action_type_text(device_id: str, text: str):
    """Nhập text"""
    print(f"\n  ▶️ Type: {text[:30]}...")
    # Escape special characters
    escaped = text.replace(" ", "%s").replace("'", "\\'")
    success, _ = run_adb(device_id, ["shell", "input", "text", escaped])
    human_delay(0.5, 1.0)
    return success

def action_key(device_id: str, keycode: str):
    """Nhấn phím"""
    print(f"\n  ▶️ Key: {keycode}")
    success, _ = run_adb(device_id, ["shell", "input", "keyevent", keycode])
    human_delay(0.3, 0.6)
    return success

def action_back(device_id: str):
    return action_key(device_id, "KEYCODE_BACK")

def action_home(device_id: str):
    return action_key(device_id, "KEYCODE_HOME")

def action_wake(device_id: str):
    return action_key(device_id, "KEYCODE_WAKEUP")

def action_screenshot(device_id: str, local_path: str = None):
    """Chụp screenshot"""
    print(f"\n  ▶️ Screenshot")
    remote_path = "/sdcard/screenshot.png"
    run_adb(device_id, ["shell", "screencap", "-p", remote_path])
    
    if local_path:
        run_adb(device_id, ["pull", remote_path, local_path])
        print(f"       📸 Saved to: {local_path}")
    return True

# ============ SAMPLE WORKFLOWS ============

def workflow_tiktok_scroll(device_id: str, video_count: int = 5, like_rate: int = 50):
    """
    TikTok Auto Scroll Workflow
    - Mở TikTok
    - Scroll qua video_count video
    - Random like với tỷ lệ like_rate%
    """
    print("\n" + "=" * 60)
    print("🎬 TikTok Auto Scroll Workflow")
    print("=" * 60)
    
    # Step 1: Mở TikTok
    action_open_app(device_id, "com.ss.android.ugc.trill")  # TikTok package
    
    # Step 2: Chờ app load
    print("\n  ⏳ Chờ TikTok load...")
    time.sleep(3)
    
    # Step 3: Loop qua các video
    for i in range(video_count):
        print(f"\n  📹 Video {i+1}/{video_count}")
        
        # Xem video random time
        watch_time = random.uniform(3, 8)
        print(f"       👀 Xem {watch_time:.1f}s...")
        time.sleep(watch_time)
        
        # Random like
        if random.randint(1, 100) <= like_rate:
            print("       ❤️ Like video!")
            action_double_tap(device_id, 540, 1000)  # Double tap center
        
        # Swipe to next video
        action_swipe_up(device_id)
        
        # Nghỉ giữa các video
        human_delay(0.5, 2.0)
    
    print("\n✅ TikTok workflow hoàn thành!")
    return True

def workflow_instagram_scroll(device_id: str, post_count: int = 10):
    """
    Instagram Feed Scroll Workflow
    """
    print("\n" + "=" * 60)
    print("📸 Instagram Feed Scroll Workflow")
    print("=" * 60)
    
    # Mở Instagram
    action_open_app(device_id, "com.instagram.android")
    time.sleep(3)
    
    # Scroll feed
    for i in range(post_count):
        print(f"\n  📱 Post {i+1}/{post_count}")
        
        # Xem post
        time.sleep(random.uniform(2, 5))
        
        # Scroll xuống
        action_swipe_up(device_id)
        human_delay(1, 3)
    
    print("\n✅ Instagram workflow hoàn thành!")
    return True

def workflow_basic_test(device_id: str):
    """
    Basic Test Workflow - Test các action cơ bản
    """
    print("\n" + "=" * 60)
    print("🔧 Basic Test Workflow")
    print("=" * 60)
    
    # Wake device
    action_wake(device_id)
    time.sleep(1)
    
    # Go home
    action_home(device_id)
    time.sleep(1)
    
    # Tap center
    action_tap(device_id, 540, 1200)
    
    # Swipe up
    action_swipe_up(device_id)
    
    # Swipe down
    action_swipe_down(device_id)
    
    # Screenshot
    screenshots_dir = os.path.join(os.path.dirname(__file__), "..", "test", "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)
    action_screenshot(device_id, os.path.join(screenshots_dir, f"test_{int(time.time())}.png"))
    
    # Back
    action_back(device_id)
    
    print("\n✅ Basic test workflow hoàn thành!")
    return True

def workflow_open_browser_search(device_id: str, query: str = "hello world"):
    """
    Mở browser và search
    """
    print("\n" + "=" * 60)
    print("🌐 Browser Search Workflow")
    print("=" * 60)
    
    # Mở Chrome
    action_open_app(device_id, "com.android.chrome")
    time.sleep(3)
    
    # Tap search bar (top of screen)
    action_tap(device_id, 540, 150)
    time.sleep(1)
    
    # Type search query
    action_type_text(device_id, query)
    time.sleep(0.5)
    
    # Press Enter
    action_key(device_id, "KEYCODE_ENTER")
    time.sleep(3)
    
    # Screenshot result
    screenshots_dir = os.path.join(os.path.dirname(__file__), "..", "test", "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)
    action_screenshot(device_id, os.path.join(screenshots_dir, f"search_{int(time.time())}.png"))
    
    print("\n✅ Browser search workflow hoàn thành!")
    return True

# ============ MAIN ============

def main():
    print("\n" + "=" * 60)
    print("🔧 REAL WORKFLOW TEST - Thao tác THẬT trên điện thoại")
    print("=" * 60 + "\n")
    
    # Check devices
    devices = get_devices()
    
    if not devices:
        print("❌ Không tìm thấy thiết bị nào!")
        print("   Đảm bảo:")
        print("   1. Điện thoại đã kết nối USB với USB Debugging bật")
        print("   2. Hoặc emulator đang chạy")
        print("   3. Chạy 'adb devices' để kiểm tra")
        return
    
    print(f"✅ Tìm thấy {len(devices)} thiết bị:")
    for i, d in enumerate(devices):
        print(f"   {i+1}. {d}")
    
    device_id = devices[0]
    print(f"\n📱 Sử dụng: {device_id}")
    
    # Chọn workflow
    print("\n📋 Chọn workflow để test:")
    print("   1. Basic Test (test các thao tác cơ bản)")
    print("   2. TikTok Auto Scroll")
    print("   3. Instagram Feed Scroll")
    print("   4. Browser Search")
    print("   5. Exit")
    
    choice = input("\n   Chọn [1]: ").strip() or "1"
    
    if choice == "5":
        print("👋 Bye!")
        return
    
    print("\n" + "-" * 40)
    
    try:
        if choice == "1":
            workflow_basic_test(device_id)
        elif choice == "2":
            video_count = input("   Số video [5]: ").strip()
            video_count = int(video_count) if video_count else 5
            like_rate = input("   Tỷ lệ like % [50]: ").strip()
            like_rate = int(like_rate) if like_rate else 50
            workflow_tiktok_scroll(device_id, video_count, like_rate)
        elif choice == "3":
            post_count = input("   Số post [10]: ").strip()
            post_count = int(post_count) if post_count else 10
            workflow_instagram_scroll(device_id, post_count)
        elif choice == "4":
            query = input("   Từ khóa tìm kiếm [hello world]: ").strip() or "hello world"
            workflow_open_browser_search(device_id, query)
        else:
            workflow_basic_test(device_id)
            
    except KeyboardInterrupt:
        print("\n\n⏹️ Đã dừng bởi người dùng")
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
