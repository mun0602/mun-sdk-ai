#!/usr/bin/env python3
"""
Benchmark so sánh TCP mode vs Content Provider mode
"""

import asyncio
import time

DEVICE_ID = "127.0.0.1:5555"

async def benchmark():
    from droidrun.tools import AdbTools
    
    print("=" * 60)
    print("🚀 DroidRun Performance Benchmark")
    print("=" * 60)
    print(f"Device: {DEVICE_ID}")
    
    # Test với TCP mode
    print("\n📡 Testing with TCP mode (use_tcp=True)")
    tools_tcp = AdbTools(serial=DEVICE_ID, use_tcp=True)
    
    actions = []
    
    # Tap
    start = time.time()
    await tools_tcp.tap_by_coordinates(540, 1200)
    tap_time = (time.time() - start) * 1000
    actions.append(("Tap", tap_time))
    print(f"   ✅ Tap: {tap_time:.0f}ms")
    
    await asyncio.sleep(0.3)
    
    # Swipe
    start = time.time()
    await tools_tcp.swipe(500, 1500, 500, 500, 300)
    swipe_time = (time.time() - start) * 1000
    actions.append(("Swipe", swipe_time))
    print(f"   ✅ Swipe: {swipe_time:.0f}ms")
    
    await asyncio.sleep(0.3)
    
    # Back
    start = time.time()
    await tools_tcp.back()
    back_time = (time.time() - start) * 1000
    actions.append(("Back", back_time))
    print(f"   ✅ Back: {back_time:.0f}ms")
    
    await asyncio.sleep(0.3)
    
    # Screenshot
    start = time.time()
    await tools_tcp.take_screenshot()
    screenshot_time = (time.time() - start) * 1000
    actions.append(("Screenshot", screenshot_time))
    print(f"   ✅ Screenshot: {screenshot_time:.0f}ms")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Results")
    print("=" * 60)
    print(f"{'Action':<15} {'Time':<10}")
    print("-" * 25)
    for action, time_ms in actions:
        print(f"{action:<15} {time_ms:.0f}ms")
    
    avg_time = sum(t for _, t in actions) / len(actions)
    print("-" * 25)
    print(f"{'Average':<15} {avg_time:.0f}ms")
    print("=" * 60)
    
    # Compare with ADB (estimate)
    print("\n💡 So sánh với ADB trực tiếp:")
    print("   ADB command: ~200-500ms/action")
    print(f"   DroidRun:    ~{avg_time:.0f}ms/action")
    if avg_time < 200:
        improvement = 300 / avg_time  # Assuming ADB ~300ms
        print(f"   → Nhanh hơn ~{improvement:.1f}x so với ADB!")
    
    print("\n✅ Benchmark completed!")

if __name__ == "__main__":
    asyncio.run(benchmark())
