#!/usr/bin/env python3
"""
DroidRun Action Executor - Helper script cho Workflow Engine

Được gọi bởi Rust workflow.rs để thực hiện actions qua DroidRun API
Thay thế ADB shell commands bằng HTTP API (nhanh hơn)

Usage:
    py droidrun_executor.py <device_id> <action> [params...]
    py droidrun_executor.py --workflow <workflow_json_file> <device_id>

Examples:
    py droidrun_executor.py 127.0.0.1:5555 tap 540 1200
    py droidrun_executor.py 127.0.0.1:5555 swipe 500 1500 500 500 300
    py droidrun_executor.py --workflow workflow.json 127.0.0.1:5555
"""

import asyncio
import sys
import json
import time
import random


async def execute_action(device_id: str, action: str, params: list):
    """Execute action via DroidRun API"""
    from droidrun.tools import AdbTools
    
    # Initialize tools with TCP mode
    tools = AdbTools(serial=device_id, use_tcp=True)
    
    result = {"success": True, "action": action, "message": ""}
    
    try:
        if action == "tap":
            x = int(params[0]) if len(params) > 0 else 540
            y = int(params[1]) if len(params) > 1 else 1200
            res = await tools.tap_by_coordinates(x, y)
            result["message"] = f"Tapped at ({x}, {y}): {res}"
            
        elif action == "tap_index":
            index = int(params[0]) if len(params) > 0 else 0
            res = await tools.tap_by_index(index)
            result["message"] = f"Tapped index {index}: {res}"
            
        elif action == "swipe":
            x1 = int(params[0]) if len(params) > 0 else 500
            y1 = int(params[1]) if len(params) > 1 else 1500
            x2 = int(params[2]) if len(params) > 2 else 500
            y2 = int(params[3]) if len(params) > 3 else 500
            duration = int(params[4]) if len(params) > 4 else 300
            res = await tools.swipe(x1, y1, x2, y2, duration)
            result["message"] = f"Swiped ({x1},{y1}) → ({x2},{y2}): {res}"
            
        elif action == "swipe_up":
            res = await tools.swipe(500, 1500, 500, 500, 300)
            result["message"] = f"Swipe up: {res}"
            
        elif action == "swipe_down":
            res = await tools.swipe(500, 500, 500, 1500, 300)
            result["message"] = f"Swipe down: {res}"
            
        elif action == "swipe_left":
            res = await tools.swipe(800, 960, 200, 960, 300)
            result["message"] = f"Swipe left: {res}"
            
        elif action == "swipe_right":
            res = await tools.swipe(200, 960, 800, 960, 300)
            result["message"] = f"Swipe right: {res}"
            
        elif action == "back":
            res = await tools.back()
            result["message"] = f"Back: {res}"
            
        elif action == "home":
            res = await tools.press_key(3)
            result["message"] = f"Home: {res}"
            
        elif action == "enter":
            res = await tools.press_key(66)
            result["message"] = f"Enter: {res}"
            
        elif action == "press_key" or action == "key_press":
            keycode = int(params[0]) if len(params) > 0 else 4
            res = await tools.press_key(keycode)
            result["message"] = f"Press key {keycode}: {res}"
            
        elif action == "open_app" or action == "start_app":
            package = params[0] if len(params) > 0 else "com.android.settings"
            activity = params[1] if len(params) > 1 else None
            res = await tools.start_app(package, activity)
            result["message"] = f"Open app {package}: {res}"
            
        elif action == "input_text" or action == "type":
            text = params[0] if len(params) > 0 else ""
            clear = params[1].lower() == "true" if len(params) > 1 else False
            res = await tools.input_text(text, clear=clear)
            result["message"] = f"Input text: {res}"
            
        elif action == "screenshot":
            output_path = params[0] if len(params) > 0 else "screenshot.png"
            fmt, img_bytes = await tools.take_screenshot()
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            result["message"] = f"Screenshot saved: {output_path} ({len(img_bytes)} bytes)"
            
        elif action == "get_state":
            state = await tools.get_state()
            result["message"] = "State retrieved"
            result["data"] = state
            
        elif action == "ping":
            res = await tools.ping()
            result["message"] = f"Ping: {res}"
            
        elif action == "tap_text" or action == "tap_element":
            # Find element by text and tap on it
            text = params[0] if len(params) > 0 else ""
            if not text:
                result["success"] = False
                result["message"] = "Missing text parameter"
            else:
                state = await tools.get_state()
                a11y_tree = state.get('a11y_tree', [])
                
                def find_element_by_text(elements, search_text):
                    for elem in elements:
                        elem_text = elem.get('text', '') or ''
                        content_desc = elem.get('contentDesc', '') or ''
                        if search_text.lower() in elem_text.lower() or search_text.lower() in content_desc.lower():
                            return elem
                        children = elem.get('children', [])
                        if children:
                            found = find_element_by_text(children, search_text)
                            if found:
                                return found
                    return None
                
                element = find_element_by_text(a11y_tree, text)
                if element:
                    bounds = element.get('bounds', '')
                    if bounds:
                        parts = bounds.split(',')
                        if len(parts) == 4:
                            left, top, right, bottom = map(int, parts)
                            center_x = (left + right) // 2
                            center_y = (top + bottom) // 2
                            res = await tools.tap_by_coordinates(center_x, center_y)
                            result["message"] = f"Tapped '{text}' at ({center_x}, {center_y}): {res}"
                        else:
                            result["success"] = False
                            result["message"] = f"Invalid bounds format: {bounds}"
                    elif element.get('index') is not None:
                        res = await tools.tap_by_index(element['index'])
                        result["message"] = f"Tapped '{text}' by index: {res}"
                    else:
                        result["success"] = False
                        result["message"] = f"Element '{text}' found but no bounds/index"
                else:
                    result["success"] = False
                    result["message"] = f"Element with text '{text}' not found"
            
        elif action == "long_press":
            x = int(params[0]) if len(params) > 0 else 540
            y = int(params[1]) if len(params) > 1 else 1200
            duration = int(params[2]) if len(params) > 2 else 2000
            # Long press = swipe from same point to same point with long duration
            res = await tools.swipe(x, y, x, y, duration)
            result["message"] = f"Long press at ({x}, {y}) for {duration}ms: {res}"
            
        elif action == "double_tap":
            x = int(params[0]) if len(params) > 0 else 540
            y = int(params[1]) if len(params) > 1 else 1200
            res1 = await tools.tap_by_coordinates(x, y)
            await asyncio.sleep(0.1)  # 100ms delay between taps
            res2 = await tools.tap_by_coordinates(x, y)
            result["message"] = f"Double tap at ({x}, {y}): {res1}, {res2}"
        
        else:
            result["success"] = False
            result["message"] = f"Unknown action: {action}"
            
    except Exception as e:
        result["success"] = False
        result["message"] = str(e)
    
    return result


def calculate_delay(base_wait: int, variance: float) -> int:
    """Calculate delay with variance (only increases, never decreases)"""
    if base_wait <= 0:
        return 0
    # Variance only increases delay: 100% to (100% + variance)
    factor = 1 + random.random() * variance
    return int(base_wait * factor)


async def execute_workflow(workflow: dict, device_id: str) -> dict:
    """Execute entire workflow with proper delays between steps"""
    result = {
        "success": True,
        "steps_executed": 0,
        "total_steps": 0,
        "logs": [],
        "error": None
    }
    
    steps = workflow.get("steps", [])
    result["total_steps"] = len(steps)
    
    print(f"[Workflow] Starting: {workflow.get('name', 'Unnamed')} with {len(steps)} steps", file=sys.stderr)
    
    for idx, step in enumerate(steps):
        step_num = idx + 1
        step_name = step.get("name", step.get("action", step.get("type", "unknown")))
        
        print(f"[Workflow] Step {step_num}/{len(steps)}: {step_name}", file=sys.stderr)
        result["logs"].append(f"Step {step_num}: {step_name}")
        
        try:
            # Execute the action
            action = step.get("action", step.get("type"))
            params = step.get("params", {})
            
            # Convert params dict to list based on action type
            param_list = []
            if action in ["tap", "click"]:
                param_list = [params.get("x", 540), params.get("y", 1200)]
            elif action == "swipe":
                param_list = [
                    params.get("start_x", 500), params.get("start_y", 1500),
                    params.get("end_x", 500), params.get("end_y", 500),
                    params.get("duration", 300)
                ]
            elif action in ["open_app", "start_app"]:
                param_list = [params.get("package", ""), params.get("activity")]
            elif action in ["input_text", "type"]:
                param_list = [params.get("text", ""), str(params.get("clear", False))]
            elif action in ["key_press", "press_key"]:
                param_list = [params.get("keycode", 4)]
            elif action == "long_press":
                param_list = [params.get("x", 540), params.get("y", 1200), params.get("duration", 2000)]
            
            # Execute action
            action_result = await execute_action(device_id, action, param_list)
            
            if not action_result["success"]:
                result["success"] = False
                result["error"] = f"Step {step_num} failed: {action_result['message']}"
                result["logs"].append(f"  ❌ Failed: {action_result['message']}")
                print(f"[Workflow] Step {step_num} failed: {action_result['message']}", file=sys.stderr)
                break
            
            result["logs"].append(f"  ✓ {action_result['message']}")
            result["steps_executed"] = step_num
            
            # Apply wait after step
            base_wait = step.get("waitAfter", 500)  # Default 500ms
            variance = step.get("waitVariance", 0.15)  # Default 15%
            delay = calculate_delay(base_wait, variance)
            
            if delay > 0:
                print(f"[Workflow] Waiting {delay}ms (base={base_wait}ms +{int(variance*100)}%)", file=sys.stderr)
                result["logs"].append(f"  ⏳ Wait {delay}ms")
                time.sleep(delay / 1000.0)  # Python sleep in seconds
            
        except Exception as e:
            result["success"] = False
            result["error"] = f"Step {step_num} error: {str(e)}"
            result["logs"].append(f"  ❌ Error: {str(e)}")
            print(f"[Workflow] Step {step_num} error: {e}", file=sys.stderr)
            break
    
    if result["success"]:
        print(f"[Workflow] Completed successfully: {result['steps_executed']} steps", file=sys.stderr)
    else:
        print(f"[Workflow] Failed at step {result['steps_executed']}", file=sys.stderr)
    
    return result


def main():
    # Check for workflow mode
    if len(sys.argv) >= 3 and sys.argv[1] == "--workflow":
        # Workflow execution mode
        workflow_file = sys.argv[2]
        device_id = sys.argv[3] if len(sys.argv) > 3 else "127.0.0.1:5555"
        
        try:
            with open(workflow_file, 'r', encoding='utf-8') as f:
                workflow = json.load(f)
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": f"Cannot read workflow file: {e}"
            }))
            sys.exit(1)
        
        result = asyncio.run(execute_workflow(workflow, device_id))
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result["success"] else 1)
    
    # Single action mode
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "message": "Usage: py droidrun_executor.py <device_id> <action> [params...]\n       py droidrun_executor.py --workflow <workflow.json> <device_id>"
        }))
        sys.exit(1)
    
    device_id = sys.argv[1]
    action = sys.argv[2]
    params = sys.argv[3:]
    
    result = asyncio.run(execute_action(device_id, action, params))
    print(json.dumps(result, ensure_ascii=False))
    
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
