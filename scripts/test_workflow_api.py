#!/usr/bin/env python3
"""
🎮 Test Workflow với DroidRun API

Mô phỏng workflow tự động:
1. Mở app Settings
2. Scroll xuống
3. Tap vào item
4. Back
5. Screenshot

Usage:
    py scripts/test_workflow_api.py
"""

import asyncio
import time
import random

DEVICE_ID = "127.0.0.1:5555"

async def run_workflow():
    from droidrun.tools import AdbTools
    
    print("=" * 60)
    print("🎮 Test Workflow với DroidRun API")
    print("=" * 60)
    
    print(f"\n🔌 Connecting to device: {DEVICE_ID}")
    tools = AdbTools(serial=DEVICE_ID, use_tcp=True)
    print("✅ Connected!")
    
    total_start = time.time()
    
    # Step 1: Mở Settings
    print("\n▶️ Step 1: Mở Settings")
    start = time.time()
    result = await tools.start_app("com.android.settings")
    print(f"   ✅ {result} ({(time.time()-start)*1000:.0f}ms)")
    
    await asyncio.sleep(1)
    
    # Step 2: Scroll xuống (3 lần)
    print("\n▶️ Step 2: Scroll xuống")
    for i in range(3):
        start = time.time()
        await tools.swipe(500, 1500, 500, 800, 300)
        print(f"   ✅ Swipe {i+1}/3 ({(time.time()-start)*1000:.0f}ms)")
        # Random delay để mô phỏng người dùng
        delay = random.uniform(0.5, 1.5)
        await asyncio.sleep(delay)
    
    # Step 3: Tap vào center
    print("\n▶️ Step 3: Tap center")
    start = time.time()
    await tools.tap_by_coordinates(540, 1200)
    print(f"   ✅ Tap ({(time.time()-start)*1000:.0f}ms)")
    
    await asyncio.sleep(1)
    
    # Step 4: Screenshot
    print("\n▶️ Step 4: Screenshot")
    start = time.time()
    fmt, img_bytes = await tools.take_screenshot()
    print(f"   ✅ Screenshot: {len(img_bytes)} bytes ({(time.time()-start)*1000:.0f}ms)")
    with open("workflow_screenshot.png", "wb") as f:
        f.write(img_bytes)
    print("   ✅ Saved: workflow_screenshot.png")
    
    # Step 5: Back 2 lần
    print("\n▶️ Step 5: Back to home")
    for i in range(2):
        start = time.time()
        await tools.back()
        print(f"   ✅ Back {i+1}/2 ({(time.time()-start)*1000:.0f}ms)")
        await asyncio.sleep(0.5)
    
    # Summary
    total_time = time.time() - total_start
    print("\n" + "=" * 60)
    print(f"✅ Workflow completed in {total_time:.2f}s")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_workflow())
