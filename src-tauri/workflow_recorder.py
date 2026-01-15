#!/usr/bin/env python3
"""
Workflow Recorder - Use DroidRun to execute task and record actions

This script calls run_droidrun.py with save_trajectory enabled,
then extracts actions from the trajectory to create a workflow.

Usage:
    py workflow_recorder.py <device_id> "<task>" --provider OpenAILike --api-key xxx --base-url http://... --model gpt-4.1
"""

import asyncio
import json
import sys
import os
import subprocess
import glob
from typing import Dict, List, Any, Optional
from datetime import datetime

# Force UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def print_log(message: str, level: str = "INFO"):
    """Print a log message"""
    print(f"[{level}] {message}", flush=True)


class WorkflowRecorder:
    """Record DroidRun actions and convert to workflow"""
    
    def __init__(self, device_id: str, provider: str, api_key: str, 
                 model: str = None, base_url: str = None):
        self.device_id = device_id
        self.provider = provider
        self.api_key = api_key
        self.model = model or "gpt-4o"
        self.base_url = base_url
        
    def run_and_record(self, task: str, max_steps: int = 30, vision: bool = True, reasoning: bool = True) -> Dict:
        """
        Run DroidRun via subprocess and record actions
        
        Returns:
            Dict with recorded workflow
        """
        print_log(f"Starting task: {task}")
        print_log(f"Device: {self.device_id}")
        print_log(f"Provider: {self.provider}, Model: {self.model}")
        
        # Get path to run_droidrun.py
        script_dir = os.path.dirname(os.path.abspath(__file__))
        droidrun_script = os.path.join(script_dir, "run_droidrun.py")
        
        if not os.path.exists(droidrun_script):
            return {"success": False, "error": f"run_droidrun.py not found at {droidrun_script}"}
        
        # Build tracing config JSON to enable trajectory saving
        tracing_config = {
            "enabled": True,
            "provider": "none",  # We don't need phoenix/langfuse, just trajectory
            "save_trajectory": "full",  # Save full trajectory
            "max_steps": max_steps,
        }
        
        # Build command
        cmd = [
            sys.executable or "python",  # Use same Python interpreter
            droidrun_script,
            self.device_id,
            self.provider,
            self.model,
            task,
            self.api_key or "",
            self.base_url or "",
            str(vision).lower(),
            str(reasoning).lower(),
            json.dumps(tracing_config),
        ]
        
        print_log(f"Running: python run_droidrun.py {self.device_id} {self.provider} {self.model} ...")
        
        # Run subprocess and capture output
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=script_dir,
                timeout=300,  # 5 minute timeout
            )
            
            stdout = result.stdout
            stderr = result.stderr
            
            # Print logs for debugging
            for line in stdout.split('\n'):
                if line.strip():
                    print_log(line)
            
            if stderr:
                for line in stderr.split('\n'):
                    if line.strip():
                        print_log(line, "STDERR")
            
            # Parse events from stdout
            actions = self._parse_events(stdout)
            
            # If trajectory saving was enabled, find and parse trajectory folder
            trajectory_actions = []
            trajectory_folder = self._find_latest_trajectory()
            if trajectory_folder:
                print_log(f"Found trajectory: {trajectory_folder}")
                trajectory_actions = self._parse_trajectory(trajectory_folder)
            
            # Combine parsed actions
            all_actions = trajectory_actions if trajectory_actions else actions
            
            if not all_actions:
                # Try to extract from events
                all_actions = actions
            
            success = result.returncode == 0
            
            return {
                "success": success or len(all_actions) > 0,
                "message": "Recording complete" if all_actions else "No actions recorded",
                "total_actions": len(all_actions),
                "actions": all_actions,
                "trajectory_folder": trajectory_folder,
            }
            
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Recording timeout after 5 minutes"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _parse_events(self, stdout: str) -> List[Dict]:
        """Parse action events from stdout"""
        actions = []
        
        for line in stdout.split('\n'):
            if '[EVENT]' in line:
                try:
                    json_str = line.split('[EVENT]')[1].strip()
                    event = json.loads(json_str)
                    
                    if event.get('type') == 'action':
                        actions.append({
                            "order": event.get('step', len(actions) + 1),
                            "action": "prompt",  # DroidRun actions are AI-driven
                            "description": event.get('description', ''),
                            "params": {"thought": event.get('thought', '')},
                            "timestamp": datetime.now().isoformat(),
                        })
                except:
                    pass
        
        return actions
    
    def _find_latest_trajectory(self) -> Optional[str]:
        """Find the most recent trajectory folder"""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        traj_base = os.path.join(script_dir, "trajectories")
        
        if not os.path.exists(traj_base):
            return None
        
        folders = sorted(
            glob.glob(os.path.join(traj_base, "*")),
            key=os.path.getmtime,
            reverse=True
        )
        
        if folders:
            return folders[0]
        return None
    
    def _parse_trajectory(self, folder: str) -> List[Dict]:
        """Parse actions from trajectory folder - prefer macro.json for accurate coords"""
        actions = []
        
        # Try macro.json first - has precise coordinates!
        macro_file = os.path.join(folder, "macro.json")
        if os.path.exists(macro_file):
            try:
                with open(macro_file, 'r', encoding='utf-8') as f:
                    macro = json.load(f)
                
                for i, action in enumerate(macro.get('actions', [])):
                    action_type = action.get('action_type', action.get('type', 'tap'))
                    
                    # Build params based on action type
                    params = {}
                    if action_type in ['tap', 'TapActionEvent']:
                        params = {
                            "x": action.get('x'),
                            "y": action.get('y'),
                            "element_index": action.get('element_index'),
                            "element_text": action.get('element_text'),
                        }
                        action_type = 'tap'
                    elif action_type in ['swipe', 'SwipeActionEvent']:
                        params = {
                            "start_x": action.get('start_x'),
                            "start_y": action.get('start_y'),
                            "end_x": action.get('end_x'),
                            "end_y": action.get('end_y'),
                        }
                        action_type = 'swipe'
                    elif action_type in ['type', 'TypeActionEvent', 'InputTextActionEvent']:
                        params = {"text": action.get('text', '')}
                        action_type = 'input_text'
                    elif action_type in ['back', 'BackActionEvent']:
                        action_type = 'back'
                    elif action_type in ['home', 'HomeActionEvent']:
                        action_type = 'home'
                    
                    actions.append({
                        "order": i + 1,
                        "action": action_type,
                        "description": action.get('description', f"Step {i+1}"),
                        "params": {k: v for k, v in params.items() if v is not None},
                        "timestamp": macro.get('timestamp', datetime.now().isoformat()),
                    })
                    
                print_log(f"Parsed {len(actions)} actions from macro.json")
                return actions
                
            except Exception as e:
                print_log(f"Error parsing macro.json: {e}", "WARN")
        
        # Fallback to trajectory.json
        traj_file = os.path.join(folder, "trajectory.json")
        if os.path.exists(traj_file):
            try:
                with open(traj_file, 'r', encoding='utf-8') as f:
                    trajectory = json.load(f)
                
                order = 0
                for event in trajectory:
                    event_type = event.get('type', '')
                    
                    # Look for action events
                    if 'Action' in event_type or 'Thinking' in event_type:
                        order += 1
                        
                        # Try to extract action details
                        code = event.get('code', '') or event.get('data', {}).get('code', '')
                        thought = event.get('thought', '') or event.get('data', {}).get('thought', '')
                        description = event.get('description', '') or thought[:100] if thought else ''
                        
                        action_info = self._parse_code_to_action(code)
                        
                        actions.append({
                            "order": order,
                            "action": action_info.get('action', 'prompt'),
                            "description": description or action_info.get('description', f'Step {order}'),
                            "params": action_info.get('params', {}),
                            "timestamp": event.get('timestamp', datetime.now().isoformat()),
                        })
                        
            except Exception as e:
                print_log(f"Error parsing trajectory: {e}", "WARN")
        
        return actions
    
    def _parse_code_to_action(self, code: str) -> Dict:
        """Parse Python code to extract action type and params"""
        if not code:
            return {"action": "prompt", "params": {}}
        
        code = code.strip()
        
        # Try to detect action type from code
        if 'click(' in code or 'tap(' in code:
            # Extract index or coordinates
            import re
            match = re.search(r'(?:click|tap)\((\d+)\)', code)
            if match:
                return {"action": "tap", "params": {"index": int(match.group(1))}, "description": f"Tap element {match.group(1)}"}
            
            match = re.search(r'(?:click|tap)\((\d+),\s*(\d+)\)', code)
            if match:
                return {"action": "tap", "params": {"x": int(match.group(1)), "y": int(match.group(2))}, "description": f"Tap ({match.group(1)}, {match.group(2)})"}
        
        elif 'swipe(' in code:
            return {"action": "swipe", "params": {}, "description": "Swipe gesture"}
        
        elif 'type(' in code or 'input(' in code:
            import re
            match = re.search(r'(?:type|input)\([\'"](.+?)[\'"]\)', code)
            if match:
                return {"action": "input_text", "params": {"text": match.group(1)}, "description": f"Type: {match.group(1)[:30]}"}
        
        elif 'back(' in code:
            return {"action": "back", "params": {}, "description": "Press back"}
        
        elif 'home(' in code:
            return {"action": "home", "params": {}, "description": "Press home"}
        
        elif 'open_app(' in code:
            import re
            match = re.search(r'open_app\([\'"](.+?)[\'"]\)', code)
            if match:
                return {"action": "open_app", "params": {"package": match.group(1)}, "description": f"Open {match.group(1)}"}
        
        # Default: keep as prompt step
        return {"action": "prompt", "params": {"code": code}, "description": code[:50]}
    
    def generate_workflow_json(self, task: str, recorded: Dict) -> Dict:
        """Convert recorded actions to workflow JSON"""
        workflow = {
            "id": f"recorded-{int(datetime.now().timestamp() * 1000)}",
            "name": task[:50] if task else "Recorded Workflow",
            "description": task,
            "color": "#10B981",
            "timeout": 300,
            "inputs": [],
            "steps": [],
        }
        
        for action in recorded.get('actions', []):
            step = {
                "id": f"step-{action['order']}",
                "type": "action",
                "name": action.get('description', f"Step {action['order']}")[:50],
                "action": action['action'],
                "params": action['params']
            }
            workflow["steps"].append(step)
            
            # Add small wait after each action
            workflow["steps"].append({
                "id": f"wait-{action['order']}",
                "type": "wait",
                "name": "Wait",
                "duration": "500"
            })
        
        return workflow


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Workflow Recorder - Record DroidRun actions")
    parser.add_argument("device_id", help="Device ID (e.g., 127.0.0.1:5555)")
    parser.add_argument("task", help="Task description")
    parser.add_argument("--provider", default="OpenAILike", help="AI provider")
    parser.add_argument("--api-key", required=True, help="API key")
    parser.add_argument("--model", help="Model name")
    parser.add_argument("--base-url", help="Base URL for API")
    parser.add_argument("--max-steps", type=int, default=30, help="Max steps for agent")
    parser.add_argument("--output", help="Output file for workflow JSON")
    
    args = parser.parse_args()
    
    recorder = WorkflowRecorder(
        device_id=args.device_id,
        provider=args.provider,
        api_key=args.api_key,
        model=args.model,
        base_url=args.base_url
    )
    
    # Run and record
    result = recorder.run_and_record(args.task, args.max_steps)
    
    if result.get('success') or result.get('total_actions', 0) > 0:
        print_log(f"Recording complete! Captured {result.get('total_actions', 0)} actions")
        
        # Generate workflow
        workflow = recorder.generate_workflow_json(args.task, result)
        
        output_data = {
            "workflow": workflow,
            "recording": result
        }
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print_log(f"Saved to: {args.output}")
        else:
            print("[RESULT]")
            print(json.dumps(output_data, indent=2, ensure_ascii=False))
    else:
        print_log(f"Recording failed: {result.get('error', 'Unknown error')}", "FAIL")
        sys.exit(1)


if __name__ == "__main__":
    main()
