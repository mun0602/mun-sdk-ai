#!/usr/bin/env python3
"""
Test điều khiển thiết bị qua DroidRun API
"""

import asyncio
import sys

async def test_device_control():
    from droidrun.tools import AdbTools
    
    device_id = "8ea8d074"
    
    print(f"🔌 Connecting to device: {device_id}")
    tools = AdbTools(serial=device_id, use_tcp=True)
    print("✅ Connected!")
    
    # Test 1: Ping
    print("\n📡 Test 1: Ping Portal")
    try:
        result = await tools.ping()
        print(f"   ✅ Ping result: {result}")
    except Exception as e:
        print(f"   ❌ Ping error: {e}")
    
    # Test 2: Get State
    print("\n📱 Test 2: Get Device State")
    try:
        state = await tools.get_state()
        print(f"   ✅ Current activity: {state.get('phone_state', {}).get('current_activity', 'Unknown')}")
        print(f"   ✅ Keyboard shown: {state.get('phone_state', {}).get('keyboard_shown', False)}")
        print(f"   ✅ UI Elements count: {len(state.get('a11y_tree', []))}")
    except Exception as e:
        print(f"   ❌ Get state error: {e}")
    
    # Test 3: Screenshot
    print("\n📸 Test 3: Take Screenshot")
    try:
        fmt, img_bytes = await tools.take_screenshot()
        print(f"   ✅ Screenshot: {fmt}, {len(img_bytes)} bytes")
        # Save to file
        with open("test_screenshot.png", "wb") as f:
            f.write(img_bytes)
        print(f"   ✅ Saved to: test_screenshot.png")
    except Exception as e:
        print(f"   ❌ Screenshot error: {e}")
    
    # Test 4: Tap action
    print("\n👆 Test 4: Tap at center (540, 1200)")
    try:
        result = await tools.tap_by_coordinates(540, 1200)
        print(f"   ✅ Tap result: {result}")
    except Exception as e:
        print(f"   ❌ Tap error: {e}")
    
    await asyncio.sleep(1)
    
    # Test 5: Swipe
    print("\n👆 Test 5: Swipe up")
    try:
        result = await tools.swipe(500, 1500, 500, 500, 300)
        print(f"   ✅ Swipe result: {result}")
    except Exception as e:
        print(f"   ❌ Swipe error: {e}")
    
    await asyncio.sleep(1)
    
    # Test 6: Back
    print("\n⬅️ Test 6: Press Back")
    try:
        result = await tools.back()
        print(f"   ✅ Back result: {result}")
    except Exception as e:
        print(f"   ❌ Back error: {e}")
    
    print("\n" + "="*50)
    print("🎉 All tests completed!")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(test_device_control())
