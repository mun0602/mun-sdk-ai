#!/usr/bin/env python3
"""
Browser Workflow Test Script - Test workflow phức tạp với trình duyệt
Chạy: python test_browser_workflow.py

Kết hợp:
- Browser automation (Selenium/Playwright)
- ADB mobile automation
- Random delays mô phỏng người dùng
"""

import json
import random
import time
import subprocess
import sys
import os

# Kiểm tra và cài đặt dependencies
def install_dependencies():
    """Cài đặt các package cần thiết"""
    packages = ["selenium", "webdriver-manager"]
    for pkg in packages:
        try:
            __import__(pkg.replace("-", "_"))
        except ImportError:
            print(f"📦 Đang cài đặt {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

install_dependencies()

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# ================= WORKFLOW DEFINITIONS =================

BROWSER_WORKFLOW = {
    "id": "browser-workflow-001",
    "name": "Google Search & TikTok Combo",
    "description": "Test workflow kết hợp browser và mobile",
    "color": "#4285f4",
    "timeout": 300,
    "inputs": [
        {"name": "search_query", "label": "Từ khóa tìm kiếm", "type": "text", "default": "TikTok trends 2026"},
        {"name": "result_count", "label": "Số kết quả click", "type": "number", "default": 3},
        {"name": "scroll_count", "label": "Số lần scroll", "type": "number", "default": 5},
        {"name": "use_mobile", "label": "Kết hợp mobile", "type": "boolean", "default": False},
    ],
    "steps": [
        {"id": "step-1", "type": "browser_action", "name": "Mở Google", "action": "open_url", "params": {"url": "https://www.google.com"}},
        {"id": "step-2", "type": "random_wait", "name": "Delay load page", "min": "1000", "max": "2000"},
        {"id": "step-3", "type": "browser_action", "name": "Tìm kiếm", "action": "type", "params": {"selector": "textarea[name='q'], input[name='q']", "text": "{{search_query}}", "submit": True}},
        {"id": "step-4", "type": "random_wait", "name": "Chờ kết quả", "min": "2000", "max": "4000"},
        {"id": "step-5", "type": "browser_action", "name": "Screenshot kết quả", "action": "screenshot", "params": {"filename": "search_results"}},
        {"id": "step-6", "type": "loop", "name": "Click kết quả", "count": "{{result_count}}", "variable": "i", "body": [
            {"id": "step-6-1", "type": "browser_action", "name": "Click link", "action": "click_result", "params": {"index": "{{i}}"}},
            {"id": "step-6-2", "type": "random_wait", "name": "Xem trang", "min": "3000", "max": "6000"},
            {"id": "step-6-3", "type": "browser_action", "name": "Scroll page", "action": "scroll", "params": {"direction": "down", "amount": 500}},
            {"id": "step-6-4", "type": "random_wait", "name": "Đọc content", "min": "2000", "max": "4000"},
            {"id": "step-6-5", "type": "browser_action", "name": "Quay lại", "action": "back", "params": {}},
            {"id": "step-6-6", "type": "random_wait", "name": "Nghỉ", "min": "1000", "max": "2000"},
        ]},
        {"id": "step-7", "type": "browser_action", "name": "Scroll kết quả", "action": "scroll_loop", "params": {"count": "{{scroll_count}}", "delay_min": 500, "delay_max": 1500}},
        {"id": "step-8", "type": "condition", "name": "Check mobile", "condition": "{{use_mobile}}", "then": [
            {"id": "step-8-1", "type": "action", "name": "Mở TikTok", "action": "open_app", "params": {"package": "com.zhiliaoapp.musically"}},
            {"id": "step-8-2", "type": "random_wait", "name": "Chờ app", "min": "3000", "max": "5000"},
        ], "else_branch": []},
        {"id": "step-9", "type": "browser_action", "name": "Mở YouTube", "action": "open_url", "params": {"url": "https://www.youtube.com"}},
        {"id": "step-10", "type": "random_wait", "name": "Final delay", "min": "2000", "max": "4000"},
        {"id": "step-11", "type": "browser_action", "name": "Screenshot cuối", "action": "screenshot", "params": {"filename": "final_state"}},
    ],
}

SOCIAL_MEDIA_WORKFLOW = {
    "id": "social-workflow-001",
    "name": "Social Media Browser Test",
    "description": "Test các trang social media phổ biến",
    "color": "#e1306c",
    "timeout": 600,
    "inputs": [
        {"name": "sites", "label": "Các site cần test", "type": "text", "default": "facebook,instagram,twitter"},
        {"name": "scroll_each", "label": "Scroll mỗi site", "type": "number", "default": 3},
    ],
    "steps": [
        {"id": "step-1", "type": "python", "name": "Parse sites", "script": "return {'site_list': '{{sites}}'.split(',')}", "save_to": "parsed"},
        {"id": "step-2", "type": "foreach", "name": "Duyệt các site", "items": "{{parsed.site_list}}", "variable": "site", "body": [
            {"id": "step-2-1", "type": "browser_action", "name": "Mở site", "action": "open_url", "params": {"url": "https://www.{{site}}.com"}},
            {"id": "step-2-2", "type": "random_wait", "name": "Load", "min": "2000", "max": "4000"},
            {"id": "step-2-3", "type": "browser_action", "name": "Screenshot", "action": "screenshot", "params": {"filename": "{{site}}_page"}},
            {"id": "step-2-4", "type": "loop", "name": "Scroll", "count": "{{scroll_each}}", "variable": "s", "body": [
                {"id": "step-2-4-1", "type": "browser_action", "name": "Scroll down", "action": "scroll", "params": {"direction": "down", "amount": 400}},
                {"id": "step-2-4-2", "type": "random_wait", "name": "Pause", "min": "800", "max": "1500"},
            ]},
        ]},
    ],
}

# ================= BROWSER ENGINE =================

class BrowserEngine:
    """Browser automation engine với Selenium"""
    
    def __init__(self, headless=False):
        self.driver = None
        self.headless = headless
        self.screenshot_dir = os.path.join(os.path.dirname(__file__), "..", "test", "screenshots")
        os.makedirs(self.screenshot_dir, exist_ok=True)
    
    def start(self):
        """Khởi động browser"""
        print("🌐 Đang khởi động browser...")
        
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-infobars")
        options.add_argument("--start-maximized")
        options.add_argument("--disable-extensions")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        # User agent giống người thật
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
        except Exception as e:
            print(f"⚠️ Không thể dùng webdriver-manager: {e}")
            self.driver = webdriver.Chrome(options=options)
        
        # Stealth mode
        self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'languages', {get: () => ['vi-VN', 'vi', 'en-US', 'en']});
            """
        })
        
        print("✅ Browser đã sẵn sàng!")
        return True
    
    def stop(self):
        """Đóng browser"""
        if self.driver:
            self.driver.quit()
            self.driver = None
            print("🔴 Browser đã đóng")
    
    def execute_action(self, action: str, params: dict, context: dict) -> bool:
        """Thực thi browser action"""
        if action == "open_url":
            url = params.get("url", "https://google.com")
            print(f"    🔗 Mở URL: {url}")
            self.driver.get(url)
            return True
            
        elif action == "type":
            selector = params.get("selector", "")
            text = params.get("text", "")
            submit = params.get("submit", False)
            
            print(f"    ⌨️ Gõ vào '{selector}': {text[:30]}...")
            try:
                element = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                # Gõ từng ký tự để giống người
                element.clear()
                for char in text:
                    element.send_keys(char)
                    time.sleep(random.uniform(0.05, 0.15))
                
                if submit:
                    time.sleep(random.uniform(0.3, 0.8))
                    element.send_keys(Keys.RETURN)
                return True
            except TimeoutException:
                print(f"    ⚠️ Không tìm thấy element: {selector}")
                return False
        
        elif action == "click":
            selector = params.get("selector", "")
            print(f"    👆 Click vào: {selector}")
            try:
                element = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                element.click()
                return True
            except TimeoutException:
                print(f"    ⚠️ Không thể click: {selector}")
                return False
        
        elif action == "click_result":
            index = int(params.get("index", 0))
            print(f"    👆 Click kết quả #{index + 1}")
            try:
                # Google search results
                results = self.driver.find_elements(By.CSS_SELECTOR, "div.g a[href^='http']")
                if index < len(results):
                    results[index].click()
                    return True
                else:
                    print(f"    ⚠️ Không đủ kết quả (chỉ có {len(results)})")
                    return True  # Continue anyway
            except Exception as e:
                print(f"    ⚠️ Lỗi click result: {e}")
                return True
        
        elif action == "scroll":
            direction = params.get("direction", "down")
            amount = int(params.get("amount", 300))
            
            if direction == "up":
                amount = -amount
            
            print(f"    📜 Scroll {direction}: {abs(amount)}px")
            self.driver.execute_script(f"window.scrollBy(0, {amount})")
            return True
        
        elif action == "scroll_loop":
            count = int(params.get("count", 3))
            delay_min = int(params.get("delay_min", 500))
            delay_max = int(params.get("delay_max", 1500))
            
            print(f"    📜 Scroll loop: {count} lần")
            for i in range(count):
                scroll_amount = random.randint(200, 500)
                self.driver.execute_script(f"window.scrollBy(0, {scroll_amount})")
                delay = random.randint(delay_min, delay_max) / 1000
                time.sleep(delay)
            return True
        
        elif action == "back":
            print(f"    ◀️ Quay lại trang trước")
            self.driver.back()
            return True
        
        elif action == "screenshot":
            filename = params.get("filename", "screenshot")
            timestamp = int(time.time())
            filepath = os.path.join(self.screenshot_dir, f"{filename}_{timestamp}.png")
            
            print(f"    📸 Chụp screenshot: {filepath}")
            self.driver.save_screenshot(filepath)
            return True
        
        elif action == "wait_element":
            selector = params.get("selector", "")
            timeout = int(params.get("timeout", 10))
            
            print(f"    ⏳ Chờ element: {selector}")
            try:
                WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                return True
            except TimeoutException:
                print(f"    ⚠️ Timeout chờ element")
                return False
        
        else:
            print(f"    ⚠️ Unknown browser action: {action}")
            return True


# ================= WORKFLOW EXECUTOR =================

def random_delay(min_ms: int, max_ms: int) -> float:
    """Tạo random delay mô phỏng hành vi người"""
    delay_ms = random.randint(min_ms, max_ms)
    return delay_ms / 1000.0

def human_like_delay():
    """Delay ngẫu nhiên gaussian"""
    delay = random.gauss(1.5, 0.5)
    delay = max(0.5, min(3.0, delay))
    return delay

def run_adb_command(device_id: str, args: list) -> tuple:
    """Chạy ADB command"""
    cmd = ["adb", "-s", device_id] + args
    print(f"  [ADB] {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout or result.stderr
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except FileNotFoundError:
        return False, "ADB not found"

def get_connected_devices() -> list:
    """Lấy danh sách thiết bị ADB"""
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

def compile_value(value: str, inputs: dict, context: dict) -> str:
    """Thay thế {{variable}} với giá trị thật"""
    result = str(value)
    
    for key, val in inputs.items():
        result = result.replace(f"{{{{{key}}}}}", str(val))
    
    for key, val in context.items():
        if isinstance(val, dict):
            for sub_key, sub_val in val.items():
                result = result.replace(f"{{{{{key}.{sub_key}}}}}", str(sub_val))
        elif isinstance(val, list):
            result = result.replace(f"{{{{{key}}}}}", json.dumps(val))
        else:
            result = result.replace(f"{{{{{key}}}}}", str(val))
    
    return result

def execute_step(step: dict, browser: BrowserEngine, device_id: str, inputs: dict, context: dict) -> bool:
    """Thực thi một step"""
    step_type = step.get("type")
    step_name = step.get("name", step_type)
    
    print(f"\n  ▶️ [{step['id']}] {step_name} ({step_type})")
    
    if step_type == "browser_action":
        action = step.get("action")
        params = step.get("params", {})
        
        # Compile params
        compiled_params = {}
        for k, v in params.items():
            compiled_params[k] = compile_value(str(v), inputs, context)
        
        return browser.execute_action(action, compiled_params, context)
    
    elif step_type == "action":
        action = step.get("action")
        params = step.get("params", {})
        
        compiled_params = {}
        for k, v in params.items():
            compiled_params[k] = compile_value(str(v), inputs, context)
        
        if action == "open_app":
            package = compiled_params.get("package", "")
            if device_id:
                success, _ = run_adb_command(device_id, ["shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"])
                time.sleep(human_like_delay())
                return success
            else:
                print(f"    ⚠️ Không có device để mở app")
                return True
        
        elif action == "tap":
            x = int(compiled_params.get("x", 540))
            y = int(compiled_params.get("y", 1200))
            if device_id:
                success, _ = run_adb_command(device_id, ["shell", "input", "tap", str(x), str(y)])
                time.sleep(human_like_delay())
                return success
            return True
        
        elif action == "swipe_up":
            if device_id:
                start_x = random.randint(400, 600)
                start_y = random.randint(1400, 1600)
                end_y = random.randint(400, 600)
                duration = random.randint(200, 400)
                success, _ = run_adb_command(device_id, ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), str(duration)])
                time.sleep(human_like_delay())
                return success
            return True
        
        return True
    
    elif step_type == "wait":
        duration = int(compile_value(step.get("duration", "1000"), inputs, context))
        print(f"    ⏳ Waiting {duration}ms...")
        time.sleep(duration / 1000)
        return True
    
    elif step_type == "random_wait":
        min_ms = int(compile_value(step.get("min", "1000"), inputs, context))
        max_ms = int(compile_value(step.get("max", "3000"), inputs, context))
        delay = random_delay(min_ms, max_ms)
        print(f"    ⏳ Random wait: {delay:.2f}s (range: {min_ms}-{max_ms}ms)")
        time.sleep(delay)
        return True
    
    elif step_type == "python":
        script = step.get("script", "return {}")
        save_to = step.get("save_to")
        print(f"    🐍 Running Python script...")
        try:
            compiled_script = compile_value(script, inputs, context)
            
            if "return" in compiled_script:
                compiled_script = compiled_script.replace("return ", "__result__ = ")
            
            local_vars = {"random": random, "time": time, "json": json, "inputs": inputs, "context": context}
            exec(compiled_script, local_vars)
            result = local_vars.get("__result__", {})
            
            if save_to:
                context[save_to] = result
                print(f"    📦 Saved to context['{save_to}']: {result}")
            return True
        except Exception as e:
            print(f"    ❌ Python error: {e}")
            if save_to:
                context[save_to] = {"error": str(e)}
            return True
    
    elif step_type == "loop":
        count = int(compile_value(step.get("count", "0"), inputs, context))
        variable = step.get("variable", "i")
        body = step.get("body", [])
        print(f"    🔄 Loop {count} times (var: {variable})")
        
        for i in range(count):
            context[variable] = i
            print(f"\n    === Iteration {i+1}/{count} ===")
            for sub_step in body:
                if not execute_step(sub_step, browser, device_id, inputs, context):
                    print(f"    ❌ Step failed, stopping loop")
                    return False
        return True
    
    elif step_type == "foreach":
        items_str = compile_value(step.get("items", "[]"), inputs, context)
        variable = step.get("variable", "item")
        body = step.get("body", [])
        
        try:
            items = json.loads(items_str) if isinstance(items_str, str) else items_str
        except:
            items = items_str.split(",") if isinstance(items_str, str) else []
        
        print(f"    🔄 Foreach: {len(items)} items (var: {variable})")
        
        for i, item in enumerate(items):
            context[variable] = item.strip() if isinstance(item, str) else item
            print(f"\n    === Item {i+1}/{len(items)}: {item} ===")
            for sub_step in body:
                if not execute_step(sub_step, browser, device_id, inputs, context):
                    return False
        return True
    
    elif step_type == "condition":
        condition = compile_value(step.get("condition", "false"), inputs, context)
        is_true = condition.lower() in ("true", "1", "yes")
        print(f"    🔀 Condition: '{condition}' = {is_true}")
        
        if is_true:
            for sub_step in step.get("then", []):
                if not execute_step(sub_step, browser, device_id, inputs, context):
                    return False
        else:
            for sub_step in step.get("else_branch", []):
                if not execute_step(sub_step, browser, device_id, inputs, context):
                    return False
        return True
    
    else:
        print(f"    ⚠️ Unknown step type: {step_type}")
        return True

def run_workflow(workflow: dict, browser: BrowserEngine, device_id: str = None, inputs: dict = None):
    """Chạy workflow"""
    inputs = inputs or {}
    context = {}
    
    # Merge default inputs
    for input_def in workflow.get("inputs", []):
        if input_def["name"] not in inputs:
            inputs[input_def["name"]] = input_def.get("default", "")
    
    print("=" * 60)
    print(f"🚀 Workflow: {workflow['name']}")
    print(f"🌐 Browser: {'Active' if browser and browser.driver else 'None'}")
    print(f"📱 Device: {device_id or 'None'}")
    print(f"⚙️ Inputs: {json.dumps(inputs, ensure_ascii=False)}")
    print("=" * 60)
    
    start_time = time.time()
    steps_executed = 0
    steps_failed = 0
    
    for step in workflow.get("steps", []):
        success = execute_step(step, browser, device_id, inputs, context)
        steps_executed += 1
        if not success:
            steps_failed += 1
            print(f"\n❌ Step failed: {step.get('name', step.get('id'))}")
            break
    
    duration = time.time() - start_time
    
    print("\n" + "=" * 60)
    print(f"📊 Kết quả:")
    print(f"   - Steps thực thi: {steps_executed}")
    print(f"   - Steps thất bại: {steps_failed}")
    print(f"   - Thời gian: {duration:.2f}s")
    print(f"   - Context keys: {list(context.keys())}")
    print("=" * 60)
    
    return steps_failed == 0

def main():
    print("\n" + "=" * 60)
    print("🔧 BROWSER WORKFLOW ENGINE TEST")
    print("   Kết hợp Browser + Mobile Automation")
    print("=" * 60 + "\n")
    
    # Workflow selection
    print("📋 Chọn workflow:")
    print("   1. Google Search & TikTok Combo")
    print("   2. Social Media Browser Test")
    print("   3. Exit")
    
    choice = input("\n   Chọn [1]: ").strip() or "1"
    
    if choice == "3":
        print("👋 Bye!")
        return
    
    workflow = BROWSER_WORKFLOW if choice == "1" else SOCIAL_MEDIA_WORKFLOW
    
    # Input configuration
    print(f"\n⚙️ Cấu hình cho '{workflow['name']}':")
    inputs = {}
    
    for input_def in workflow.get("inputs", []):
        default = input_def.get("default", "")
        value = input(f"   {input_def['label']} [{default}]: ").strip()
        if value:
            if input_def["type"] == "number":
                inputs[input_def["name"]] = int(value)
            elif input_def["type"] == "boolean":
                inputs[input_def["name"]] = value.lower() in ("true", "1", "yes", "y")
            else:
                inputs[input_def["name"]] = value
    
    # Browser mode
    headless = input("\n   Chạy headless? [n]: ").strip().lower() in ("y", "yes", "1")
    
    # Check devices
    devices = get_connected_devices()
    device_id = devices[0] if devices else None
    if devices:
        print(f"\n✅ Tìm thấy device: {device_id}")
    else:
        print("\n⚠️ Không có device ADB (mobile actions sẽ bị skip)")
    
    # Run
    print("\n" + "-" * 40)
    
    browser = BrowserEngine(headless=headless)
    
    try:
        browser.start()
        time.sleep(1)
        
        success = run_workflow(workflow, browser, device_id, inputs)
        
        if success:
            print("\n✅ Workflow hoàn thành thành công!")
        else:
            print("\n⚠️ Workflow có lỗi!")
        
        # Keep browser open for review
        if not headless:
            input("\n⏸️ Nhấn Enter để đóng browser...")
    
    except KeyboardInterrupt:
        print("\n\n⏹️ Đã dừng bởi người dùng")
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
    finally:
        browser.stop()

if __name__ == "__main__":
    main()
