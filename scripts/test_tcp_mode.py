#!/usr/bin/env python3
"""
Test DroidRun Portal API với TCP mode (nhanh hơn)

Usage:
    py scripts/test_tcp_mode.py

Yêu cầu:
1. Thiết bị đã kết nối: adb devices
2. DroidRun Portal đã cài: py -m droidrun setup -d <device>
3. Portal server chạy trên port 8080
"""

import asyncio
import subprocess
import sys
import time

def run_cmd(cmd: str) -> str:
    """Run shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout.strip() or result.stderr.strip()
    except Exception as e:
        return str(e)

def get_device_id() -> str:
    """Get first connected device"""
    output = run_cmd("adb devices")
    lines = output.strip().split('\n')[1:]
    for line in lines:
        if '\tdevice' in line:
            return line.split('\t')[0]
    return None

async def test_tcp_mode():
    print("=" * 60)
    print("🔧 DroidRun Portal TCP Mode Test")
    print("=" * 60)
    
    # Step 1: Check device
    print("\n📱 Step 1: Check connected devices")
    device_id = get_device_id()
    if not device_id:
        print("   ❌ No device connected!")
        print("   → Connect device via USB or: adb connect <ip:port>")
        return
    print(f"   ✅ Device: {device_id}")
    
    # Step 2: Check Portal installed
    print("\n📦 Step 2: Check DroidRun Portal")
    portal_check = run_cmd(f"adb -s {device_id} shell pm list packages | findstr droidrun")
    if "droidrun" not in portal_check.lower():
        print("   ⚠️ DroidRun Portal may not be installed")
        print("   → Install: py -m droidrun setup -d " + device_id)
    else:
        print("   ✅ Portal package found")
    
    # Step 3: Check Portal server on port 8080
    print("\n🌐 Step 3: Check Portal HTTP server (port 8080)")
    netstat = run_cmd(f'adb -s {device_id} shell "netstat -tlnp 2>/dev/null | grep 8080"')
    if "8080" in netstat:
        print(f"   ✅ Portal server running on port 8080")
        print(f"   → {netstat}")
    else:
        print("   ⚠️ Portal HTTP server not detected on port 8080")
        print("   → TCP mode may not work, will use content provider fallback")
    
    # Step 4: Setup port forwarding
    print("\n🔗 Step 4: Setup port forwarding")
    # Remove old forwards
    run_cmd("adb forward --remove-all")
    # Add new forward
    forward_result = run_cmd(f"adb -s {device_id} forward tcp:8080 tcp:8080")
    print(f"   ✅ Port forward: localhost:8080 → device:8080")
    
    # Check forwards
    forwards = run_cmd("adb forward --list")
    if forwards:
        print(f"   → Active forwards: {forwards}")
    
    # Step 5: Test TCP connection
    print("\n🧪 Step 5: Test Portal connection")
    try:
        import requests
        try:
            r = requests.get("http://localhost:8080/ping", timeout=3)
            print(f"   ✅ TCP Mode: Portal responded! Status: {r.status_code}")
            print(f"   → Response: {r.text[:100]}")
            tcp_available = True
        except requests.exceptions.ConnectionError:
            print("   ⚠️ TCP Mode: Cannot connect to localhost:8080")
            print("   → Will use content provider mode (slower but works)")
            tcp_available = False
    except ImportError:
        print("   ⚠️ requests library not installed, skipping HTTP test")
        tcp_available = False
    
    # Step 6: Test with DroidRun AdbTools
    print("\n🎮 Step 6: Test device control with AdbTools")
    try:
        from droidrun.tools import AdbTools
        
        # Try TCP mode first
        print(f"   → Connecting with use_tcp=True...")
        tools = AdbTools(serial=device_id, use_tcp=True)
        print("   ✅ Connected!")
        
        # Test tap
        print("\n   👆 Test: Tap at center (540, 1200)")
        start = time.time()
        result = await tools.tap_by_coordinates(540, 1200)
        elapsed = (time.time() - start) * 1000
        print(f"   ✅ Tap result: {result} ({elapsed:.0f}ms)")
        
        await asyncio.sleep(0.5)
        
        # Test swipe
        print("\n   👆 Test: Swipe up")
        start = time.time()
        result = await tools.swipe(500, 1500, 500, 500, 300)
        elapsed = (time.time() - start) * 1000
        print(f"   ✅ Swipe result: {result} ({elapsed:.0f}ms)")
        
        await asyncio.sleep(0.5)
        
        # Test back
        print("\n   ⬅️ Test: Press back")
        start = time.time()
        result = await tools.back()
        elapsed = (time.time() - start) * 1000
        print(f"   ✅ Back result: {result} ({elapsed:.0f}ms)")
        
        # Test screenshot
        print("\n   📸 Test: Screenshot")
        start = time.time()
        fmt, img_bytes = await tools.take_screenshot()
        elapsed = (time.time() - start) * 1000
        print(f"   ✅ Screenshot: {len(img_bytes)} bytes ({elapsed:.0f}ms)")
        
        with open("test_screenshot.png", "wb") as f:
            f.write(img_bytes)
        print("   ✅ Saved: test_screenshot.png")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    print(f"   Device: {device_id}")
    print(f"   TCP Mode: {'✅ Available' if tcp_available else '⚠️ Fallback to Content Provider'}")
    print("\n💡 Tips:")
    if not tcp_available:
        print("   - TCP mode không hoạt động, đang dùng Content Provider (chậm hơn)")
        print("   - Để bật TCP: Portal app phải chạy HTTP server trên port 8080")
        print("   - Kiểm tra: adb shell netstat -tlnp | grep 8080")
    else:
        print("   - TCP mode hoạt động! Thao tác sẽ nhanh hơn 5-10x")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_tcp_mode())
