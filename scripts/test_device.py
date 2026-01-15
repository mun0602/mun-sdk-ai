#!/usr/bin/env python3
"""
Test điều khiển thiết bị Android qua DroidRun API - Simple Version

Usage:
    py scripts/test_device.py tap 540 1200
    py scripts/test_device.py swipe_up
    py scripts/test_device.py back
    py scripts/test_device.py home
    py scripts/test_device.py screenshot
    py scripts/test_device.py open com.android.settings
"""

import asyncio
import sys

DEVICE_ID = "127.0.0.1:5555"

async def main():
    from droidrun.tools import AdbTools
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  py scripts/test_device.py tap <x> <y>")
        print("  py scripts/test_device.py swipe_up")
        print("  py scripts/test_device.py swipe_down")
        print("  py scripts/test_device.py back")
        print("  py scripts/test_device.py home")
        print("  py scripts/test_device.py screenshot")
        print("  py scripts/test_device.py open <package>")
        print("  py scripts/test_device.py text <message>")
        return
    
    action = sys.argv[1].lower()
    
    print(f"🔌 Connecting to device: {DEVICE_ID}")
    tools = AdbTools(serial=DEVICE_ID, use_tcp=True)
    print("✅ Connected!")
    
    if action == "tap":
        x = int(sys.argv[2]) if len(sys.argv) > 2 else 540
        y = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
        print(f"👆 Tap at ({x}, {y})")
        result = await tools.tap_by_coordinates(x, y)
        print(f"   Result: {result}")
        
    elif action == "swipe_up":
        print("👆 Swipe up")
        result = await tools.swipe(500, 1500, 500, 500, 300)
        print(f"   Result: {result}")
        
    elif action == "swipe_down":
        print("👇 Swipe down")
        result = await tools.swipe(500, 500, 500, 1500, 300)
        print(f"   Result: {result}")
        
    elif action == "swipe_left":
        print("👈 Swipe left")
        result = await tools.swipe(800, 960, 200, 960, 300)
        print(f"   Result: {result}")
        
    elif action == "swipe_right":
        print("👉 Swipe right")
        result = await tools.swipe(200, 960, 800, 960, 300)
        print(f"   Result: {result}")
        
    elif action == "back":
        print("⬅️ Press Back")
        result = await tools.back()
        print(f"   Result: {result}")
        
    elif action == "home":
        print("🏠 Press Home")
        result = await tools.press_key(3)
        print(f"   Result: {result}")
        
    elif action == "enter":
        print("↵ Press Enter")
        result = await tools.press_key(66)
        print(f"   Result: {result}")
        
    elif action == "screenshot":
        print("📸 Taking screenshot...")
        fmt, img_bytes = await tools.take_screenshot()
        filename = "screenshot.png"
        with open(filename, "wb") as f:
            f.write(img_bytes)
        print(f"   ✅ Saved: {filename} ({len(img_bytes)} bytes)")
        
    elif action == "open":
        package = sys.argv[2] if len(sys.argv) > 2 else "com.android.settings"
        print(f"📱 Opening app: {package}")
        result = await tools.start_app(package)
        print(f"   Result: {result}")
        
    elif action == "text":
        text = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "Hello"
        print(f"⌨️ Input text: {text}")
        result = await tools.input_text(text)
        print(f"   Result: {result}")
        
    elif action == "state":
        print("📊 Getting UI state...")
        try:
            state = await tools.get_state()
            if isinstance(state, dict):
                phone_state = state.get('phone_state', {})
                print(f"   Activity: {phone_state.get('current_activity', 'Unknown')}")
                print(f"   Keyboard: {phone_state.get('keyboard_shown', False)}")
                a11y_tree = state.get('a11y_tree', [])
                print(f"   Elements: {len(a11y_tree)}")
        except Exception as e:
            print(f"   Error: {e}")
            
    else:
        print(f"❌ Unknown action: {action}")
        print("   Valid actions: tap, swipe_up, swipe_down, back, home, screenshot, open, text, state")

if __name__ == "__main__":
    asyncio.run(main())
