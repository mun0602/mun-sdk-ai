#!/usr/bin/env python3
"""
Test XPath selectors for TikTok Like button using uiautomator2
"""
import uiautomator2 as u2
import time
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DEVICE = "127.0.0.1:5555"

# XPath candidates to test
XPATH_CANDIDATES = [
    # Từ DroidRun glm-4.6v
    "//Button[@resource-id='com.zhiliaoapp.musically:id/co1']",
    
    # Các biến thể resource-id
    "//*[@resource-id='com.zhiliaoapp.musically:id/cl0']",
    "//*[@resource-id='com.zhiliaoapp.musically:id/co1']",
    
    # Theo content-desc
    "//*[@content-desc='Like video']",
    "//*[contains(@content-desc, 'Like')]",
    
    # Theo text
    "//*[contains(@text, 'Like video')]",
    "//*[contains(@text, 'likes')]",
    
    # Theo class + clickable
    "//android.widget.ImageView[@clickable='true' and contains(@content-desc, 'Like')]",
    "//android.widget.Button[contains(@text, 'Like')]",
]

def test_xpath():
    print(f"Connecting to device {DEVICE}...")
    d = u2.connect(DEVICE)
    
    # Ensure TikTok is open
    print("Opening TikTok...")
    d.app_start("com.zhiliaoapp.musically")
    time.sleep(3)
    
    print("\n" + "="*60)
    print("Testing XPath selectors for Like button")
    print("="*60 + "\n")
    
    results = []
    
    for xpath in XPATH_CANDIDATES:
        try:
            el = d.xpath(xpath)
            if el.exists:
                info = el.get()
                bounds = info.bounds
                center = info.center()
                results.append({
                    "xpath": xpath,
                    "found": True,
                    "bounds": bounds,
                    "center": center,
                    "text": getattr(info, 'text', ''),
                    "desc": getattr(info, 'content_desc', getattr(info, 'description', '')),
                })
                print(f"[OK] FOUND: {xpath}")
                print(f"   Bounds: {bounds}")
                print(f"   Center: {center}")
                print()
            else:
                results.append({"xpath": xpath, "found": False})
                print(f"[X] NOT FOUND: {xpath}\n")
        except Exception as e:
            results.append({"xpath": xpath, "found": False, "error": str(e)})
            print(f"[X] ERROR: {xpath}")
            print(f"   {e}\n")
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    found = [r for r in results if r.get("found")]
    print(f"Found: {len(found)}/{len(results)} XPath selectors work\n")
    
    if found:
        print("Working XPath selectors:")
        for r in found:
            print(f"  [OK] {r['xpath']}")
            print(f"     Center: {r['center']}")
        
        # Test click on first working xpath
        print(f"\n\nTesting click with first working XPath...")
        first_xpath = found[0]['xpath']
        print(f"XPath: {first_xpath}")
        
        # Get current state
        el = d.xpath(first_xpath)
        if el.exists:
            el.click()
            print("Clicked! Check if video was liked.")
            time.sleep(1)
            
            # Click again to unlike
            el.click()
            print("Clicked again to unlike.")

if __name__ == "__main__":
    test_xpath()