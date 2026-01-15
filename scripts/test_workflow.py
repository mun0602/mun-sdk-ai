#!/usr/bin/env python3
"""
Workflow Test Script - Kiểm thử workflow engine qua command line
Chạy: python test_workflow.py

Mô phỏng hành vi người với random delays
"""

import json
import random
import time
import subprocess
import sys

# Sample workflow definition
SAMPLE_WORKFLOW = {
    "id": "test-workflow-001",
    "name": "TikTok Auto Engagement",
    "description": "Xem video và like tự động với random delay mô phỏng người",
    "color": "#ff0050",
    "timeout": 600,
    "inputs": [
        {"name": "video_count", "label": "Số video", "type": "number", "default": 5},
        {"name": "like_rate", "label": "Tỷ lệ like (%)", "type": "number", "default": 50},
        {"name": "min_watch_time", "label": "Thời gian xem tối thiểu (s)", "type": "number", "default": 3},
        {"name": "max_watch_time", "label": "Thời gian xem tối đa (s)", "type": "number", "default": 10},
    ],
    "steps": [
        {"id": "step-1", "type": "action", "name": "Mở TikTok", "action": "open_app", "params": {"package": "com.zhiliaoapp.musically"}},
        {"id": "step-2", "type": "wait", "name": "Chờ app load", "duration": "3000"},
        {"id": "step-3", "type": "loop", "name": "Xem video loop", "count": "{{video_count}}", "variable": "i", "body": [
            {"id": "step-3-1", "type": "random_wait", "name": "Xem video (random)", "min": "{{min_watch_time}}000", "max": "{{max_watch_time}}000"},
            {"id": "step-3-2", "type": "python", "name": "Quyết định like", "script": "import random; return {'should_like': random.randint(1, 100) <= {{like_rate}}}", "save_to": "like_decision"},
            {"id": "step-3-3", "type": "condition", "name": "Like nếu đạt tỷ lệ", "condition": "{{like_decision.should_like}}", "then": [
                {"id": "step-3-3-1", "type": "action", "name": "Double tap để like", "action": "tap", "params": {"target": "center", "double": True}},
                {"id": "step-3-3-2", "type": "random_wait", "name": "Delay sau like", "min": "500", "max": "1500"},
            ], "else_branch": []},
            {"id": "step-3-4", "type": "action", "name": "Swipe lên video tiếp", "action": "swipe_up", "params": {}},
            {"id": "step-3-5", "type": "random_wait", "name": "Nghỉ giữa video", "min": "500", "max": "2000"},
        ]},
    ],
}

def random_delay(min_ms: int, max_ms: int) -> float:
    """Tạo random delay mô phỏng hành vi người"""
    delay_ms = random.randint(min_ms, max_ms)
    return delay_ms / 1000.0

def human_like_delay():
    """Delay ngẫu nhiên để mô phỏng người dùng thật"""
    # Gaussian distribution để realistic hơn
    delay = random.gauss(1.5, 0.5)
    delay = max(0.5, min(3.0, delay))  # Clamp between 0.5 and 3 seconds
    return delay

def run_adb_command(device_id: str, args: list) -> tuple[bool, str]:
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
    """Lấy danh sách thiết bị đã kết nối"""
    try:
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
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
    
    # Replace inputs
    for key, val in inputs.items():
        result = result.replace(f"{{{{{key}}}}}", str(val))
    
    # Replace context
    for key, val in context.items():
        if isinstance(val, dict):
            for sub_key, sub_val in val.items():
                result = result.replace(f"{{{{{key}.{sub_key}}}}}", str(sub_val))
        result = result.replace(f"{{{{{key}}}}}", str(val))
    
    return result

def execute_step(step: dict, device_id: str, inputs: dict, context: dict) -> bool:
    """Thực thi một step"""
    step_type = step.get("type")
    step_name = step.get("name", step_type)
    
    print(f"\n  ▶️ [{step['id']}] {step_name} ({step_type})")
    
    if step_type == "action":
        action = step.get("action")
        params = step.get("params", {})
        
        # Compile params
        compiled_params = {}
        for k, v in params.items():
            compiled_params[k] = compile_value(str(v), inputs, context)
        
        if action == "open_app":
            package = compiled_params.get("package", "")
            success, output = run_adb_command(device_id, ["shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"])
            time.sleep(human_like_delay())
            return success
            
        elif action == "tap":
            target = compiled_params.get("target", "center")
            is_double = compiled_params.get("double", False)
            # Mock tap at center (540, 1200)
            x, y = 540, 1200
            success, _ = run_adb_command(device_id, ["shell", "input", "tap", str(x), str(y)])
            if is_double:
                time.sleep(0.1)
                run_adb_command(device_id, ["shell", "input", "tap", str(x), str(y)])
            time.sleep(human_like_delay())
            return success
            
        elif action == "swipe_up":
            # Random swipe để realistic hơn
            start_x = random.randint(400, 600)
            start_y = random.randint(1400, 1600)
            end_y = random.randint(400, 600)
            duration = random.randint(200, 400)
            success, _ = run_adb_command(device_id, ["shell", "input", "swipe", str(start_x), str(start_y), str(start_x), str(end_y), str(duration)])
            time.sleep(human_like_delay())
            return success
            
        else:
            print(f"    ⚠️ Unknown action: {action}")
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
            # Compile và execute script
            compiled_script = compile_value(script, inputs, context)
            
            # Thay thế return bằng biến gán
            if compiled_script.strip().startswith("import"):
                parts = compiled_script.split(";")
                imports = [p.strip() for p in parts if p.strip().startswith("import")]
                rest = [p.strip() for p in parts if not p.strip().startswith("import")]
                exec_script = "; ".join(rest)
            else:
                exec_script = compiled_script
            
            # Execute
            local_vars = {"random": random, "time": time, "inputs": inputs, "context": context}
            
            # Simple evaluation for return statements
            if "return" in exec_script:
                exec_script = exec_script.replace("return ", "__result__ = ")
            
            exec(exec_script, local_vars)
            result = local_vars.get("__result__", {})
            
            if save_to:
                context[save_to] = result
                print(f"    📦 Saved to context['{save_to}']: {result}")
            return True
        except Exception as e:
            print(f"    ❌ Python error: {e}")
            # Continue execution even if Python script fails
            if save_to:
                context[save_to] = {"error": str(e)}
            return True  # Don't stop workflow for Python errors
            
    elif step_type == "loop":
        count = int(compile_value(step.get("count", "0"), inputs, context))
        variable = step.get("variable", "i")
        body = step.get("body", [])
        print(f"    🔄 Loop {count} times (var: {variable})")
        
        for i in range(count):
            context[variable] = i
            print(f"\n    === Iteration {i+1}/{count} ===")
            for sub_step in body:
                if not execute_step(sub_step, device_id, inputs, context):
                    print(f"    ❌ Step failed, stopping loop")
                    return False
        return True
        
    elif step_type == "condition":
        condition = compile_value(step.get("condition", "false"), inputs, context)
        is_true = condition.lower() in ("true", "1", "yes")
        print(f"    🔀 Condition: '{condition}' = {is_true}")
        
        if is_true:
            for sub_step in step.get("then", []):
                if not execute_step(sub_step, device_id, inputs, context):
                    return False
        else:
            for sub_step in step.get("else_branch", []):
                if not execute_step(sub_step, device_id, inputs, context):
                    return False
        return True
        
    else:
        print(f"    ⚠️ Unknown step type: {step_type}")
        return True

def run_workflow(workflow: dict, device_id: str, inputs: dict = None):
    """Chạy workflow trên device"""
    inputs = inputs or {}
    context = {}
    
    # Merge default inputs
    for input_def in workflow.get("inputs", []):
        if input_def["name"] not in inputs:
            inputs[input_def["name"]] = input_def.get("default", "")
    
    print("=" * 60)
    print(f"🚀 Workflow: {workflow['name']}")
    print(f"📱 Device: {device_id}")
    print(f"⚙️ Inputs: {json.dumps(inputs, ensure_ascii=False)}")
    print("=" * 60)
    
    start_time = time.time()
    steps_executed = 0
    steps_failed = 0
    
    for step in workflow.get("steps", []):
        success = execute_step(step, device_id, inputs, context)
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
    print(f"   - Context: {json.dumps(context, ensure_ascii=False, default=str)}")
    print("=" * 60)
    
    return steps_failed == 0

def main():
    print("\n🔧 Workflow Engine Test Script")
    print("================================\n")
    
    # Check devices
    devices = get_connected_devices()
    if not devices:
        print("❌ Không tìm thấy thiết bị ADB nào!")
        print("   Đảm bảo đã kết nối device hoặc chạy emulator.")
        print("\n💡 Tip: Chạy 'adb devices' để kiểm tra")
        
        # Dry run mode
        print("\n🔄 Chạy ở chế độ DRY RUN (không cần device thật)...")
        device_id = "test-device-001"
    else:
        print(f"✅ Tìm thấy {len(devices)} thiết bị:")
        for i, d in enumerate(devices):
            print(f"   {i+1}. {d}")
        device_id = devices[0]
        print(f"\n📱 Sử dụng: {device_id}")
    
    # Custom inputs
    print("\n⚙️ Cấu hình inputs (Enter để dùng default):")
    inputs = {}
    
    video_count = input(f"   Số video [5]: ").strip()
    if video_count:
        inputs["video_count"] = int(video_count)
    
    like_rate = input(f"   Tỷ lệ like % [50]: ").strip()
    if like_rate:
        inputs["like_rate"] = int(like_rate)
    
    print("\n" + "-" * 40)
    
    # Run workflow
    try:
        success = run_workflow(SAMPLE_WORKFLOW, device_id, inputs)
        
        if success:
            print("\n✅ Workflow hoàn thành thành công!")
        else:
            print("\n⚠️ Workflow có lỗi!")
            
    except KeyboardInterrupt:
        print("\n\n⏹️ Đã dừng bởi người dùng")
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")

if __name__ == "__main__":
    main()
