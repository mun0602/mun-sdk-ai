#!/usr/bin/env python3
"""
Workflow Calibrator - Sử dụng LLM Vision để tìm chính xác coordinates

Khi user tạo workflow bằng natural language:
1. Chụp screenshot hiện tại
2. Gửi screenshot + prompt cho LLM Vision
3. LLM phân tích UI và trả về coordinates/elements chính xác
4. Tạo workflow với data thực tế

Usage:
    py workflow_calibrator.py <device_id> "Mô tả workflow" --provider openai --api-key sk-xxx
"""

import asyncio
import json
import sys
import base64
import os
from typing import Dict, List, Any, Optional

class WorkflowCalibrator:
    """Calibrate workflow using LLM Vision"""
    
    def __init__(self, device_id: str, provider: str = "openai", api_key: str = None, model: str = None, base_url: str = None):
        self.device_id = device_id
        self.provider = provider
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.model = model or self._get_default_model()
        self.base_url = base_url
        self.tools = None
        self.ui_cache = {}
        
    def _get_default_model(self) -> str:
        """Get default vision model for provider"""
        models = {
            "openai": "gpt-4o",
            "anthropic": "claude-3-5-sonnet-20241022",
            "gemini": "gemini-2.0-flash-exp",
            "google": "gemini-2.0-flash-exp",
            "Z.AI": "glm-4.6v",
            "OpenAILike": "gpt-4o",
        }
        return models.get(self.provider, "gpt-4o")
    
    async def connect(self):
        """Connect to device and initialize tools"""
        from droidrun.tools import AdbTools
        self.tools = AdbTools(serial=self.device_id, use_tcp=True)
        print(f"[Calibrator] Connected to device: {self.device_id}")
        
    async def take_screenshot_base64(self) -> str:
        """Take screenshot and return as base64"""
        fmt, img_bytes = await self.tools.take_screenshot()
        return base64.b64encode(img_bytes).decode('utf-8')
    
    async def get_ui_state(self) -> Dict:
        """Get current UI state with elements"""
        state = await self.tools.get_state()
        
        # Handle different return types from DroidRun
        # Newer versions return tuple (screenshot_bytes, a11y_tree)
        # Older versions return dict
        if isinstance(state, tuple):
            # Tuple: (screenshot, a11y_tree)
            self.ui_cache = {
                'screenshot': state[0] if len(state) > 0 else None,
                'a11y_tree': state[1] if len(state) > 1 else []
            }
        elif isinstance(state, dict):
            self.ui_cache = state
        else:
            self.ui_cache = {'a11y_tree': []}
            
        return self.ui_cache
    
    async def analyze_screen(self, task_description: str) -> Dict:
        """
        Analyze current screen using LLM Vision
        Returns: Dict with elements, coordinates, and suggested actions
        """
        print(f"[Calibrator] Analyzing screen for: {task_description}")
        
        # Get screenshot and UI state
        screenshot_b64 = await self.take_screenshot_base64()
        ui_state = await self.get_ui_state()
        
        # Build prompt for LLM
        prompt = self._build_analysis_prompt(task_description, ui_state)
        
        # Call LLM Vision
        if self.provider in ["openai"]:
            result = await self._call_openai_vision(prompt, screenshot_b64)
        elif self.provider in ["Z.AI", "OpenAILike"]:
            # OpenAI-compatible API with custom base_url
            result = await self._call_openai_like_vision(prompt, screenshot_b64)
        elif self.provider in ["gemini", "google"]:
            result = await self._call_gemini_vision(prompt, screenshot_b64)
        elif self.provider == "anthropic":
            result = await self._call_anthropic_vision(prompt, screenshot_b64)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
        
        return result
    
    def _build_analysis_prompt(self, task: str, ui_state: Dict) -> str:
        """Build prompt for LLM Vision analysis"""
        elements_summary = self._summarize_elements(ui_state.get('a11y_tree', []))
        
        return f"""Bạn là AI assistant phân tích UI Android để tạo workflow tự động.

NHIỆM VỤ: {task}

UI ELEMENTS HIỆN TẠI (accessibility tree):
{elements_summary}

YÊU CẦU:
1. Phân tích screenshot và xác định CHÍNH XÁC các điểm cần tap/swipe
2. Với mỗi action, cung cấp:
   - Loại action: tap, tap_text, swipe_up, swipe_down, input_text, back, etc.
   - Coordinates (x, y) CHÍNH XÁC từ screenshot
   - Hoặc text của element để tap theo text
   - Wait time sau mỗi action (ms)
3. Trả về JSON với format:

```json
{{
    "success": true,
    "screen_description": "Mô tả màn hình hiện tại",
    "steps": [
        {{
            "order": 1,
            "action": "tap",
            "description": "Mô tả action",
            "params": {{
                "x": 540,
                "y": 1200
            }},
            "wait_after": 1000,
            "alternative": {{
                "action": "tap_text",
                "params": {{"text": "Button text"}}
            }}
        }},
        {{
            "order": 2,
            "action": "swipe_up",
            "description": "Scroll xuống",
            "params": {{}},
            "wait_after": 500
        }}
    ],
    "warnings": ["Cảnh báo nếu có"],
    "confidence": 0.95
}}
```

CHÚ Ý:
- Coordinates phải CHÍNH XÁC từ screenshot, không đoán
- Nếu không chắc chắn, đặt confidence thấp
- Dùng tap_text khi có thể (reliable hơn coordinates)
- Thêm wait_after phù hợp cho mỗi action
"""

    def _summarize_elements(self, elements: List, depth: int = 0, max_items: int = 50) -> str:
        """Summarize UI elements for prompt"""
        lines = []
        count = 0
        
        def traverse(elems, d):
            nonlocal count
            for elem in elems:
                if count >= max_items:
                    return
                    
                text = elem.get('text', '') or elem.get('contentDesc', '')
                class_name = elem.get('className', '')
                bounds = elem.get('bounds', '')
                clickable = elem.get('clickable', False)
                index = elem.get('index', -1)
                
                if text or clickable:
                    indent = "  " * d
                    info = f"{indent}[{index}] {class_name}"
                    if text:
                        info += f" text='{text[:30]}'"
                    if bounds:
                        info += f" bounds={bounds}"
                    if clickable:
                        info += " [CLICKABLE]"
                    lines.append(info)
                    count += 1
                
                children = elem.get('children', [])
                if children:
                    traverse(children, d + 1)
        
        traverse(elements, 0)
        return "\n".join(lines) or "No elements found"
    
    async def _call_openai_vision(self, prompt: str, image_b64: str) -> Dict:
        """Call OpenAI GPT-4 Vision"""
        import openai
        
        client = openai.OpenAI(api_key=self.api_key)
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=4096
        )
        
        content = response.choices[0].message.content
        return self._parse_llm_response(content)
    
    async def _call_openai_like_vision(self, prompt: str, image_b64: str) -> Dict:
        """Call OpenAI-compatible API (Z.AI, mun-ai, etc.)"""
        import httpx
        
        base_url = self.base_url or "https://api.openai.com/v1"
        url = f"{base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 4096
        }
        
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        return self._parse_llm_response(content)
    
    async def _call_gemini_vision(self, prompt: str, image_b64: str) -> Dict:
        """Call Google Gemini Vision"""
        import google.generativeai as genai
        
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model)
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_b64)
        
        response = model.generate_content([
            prompt,
            {"mime_type": "image/png", "data": image_bytes}
        ])
        
        return self._parse_llm_response(response.text)
    
    async def _call_anthropic_vision(self, prompt: str, image_b64: str) -> Dict:
        """Call Anthropic Claude Vision"""
        import anthropic
        
        client = anthropic.Anthropic(api_key=self.api_key)
        
        response = client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }
            ]
        )
        
        return self._parse_llm_response(response.content[0].text)
    
    def _parse_llm_response(self, content: str) -> Dict:
        """Parse LLM response to extract JSON"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # Try direct JSON parse
            return json.loads(content)
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Failed to parse LLM response",
                "raw_response": content
            }
    
    async def calibrate_workflow(self, description: str, num_screens: int = 1) -> Dict:
        """
        Calibrate a complete workflow
        
        Args:
            description: Natural language description of workflow
            num_screens: Number of screens to analyze (for multi-step workflows)
            
        Returns:
            Dict with calibrated workflow steps
        """
        print(f"[Calibrator] Starting calibration for: {description}")
        
        all_steps = []
        
        for i in range(num_screens):
            print(f"[Calibrator] Analyzing screen {i+1}/{num_screens}")
            
            # Analyze current screen
            analysis = await self.analyze_screen(description)
            
            if not analysis.get('success', False):
                print(f"[Calibrator] [WARN] Analysis failed: {analysis.get('error', 'Unknown error')}")
                continue
            
            # Add steps with screen index
            for step in analysis.get('steps', []):
                step['screen_index'] = i
                all_steps.append(step)
            
            # If there are more screens, execute first action and wait
            if i < num_screens - 1 and all_steps:
                first_step = all_steps[-len(analysis.get('steps', []))]
                await self._execute_step(first_step)
                await asyncio.sleep(first_step.get('wait_after', 1000) / 1000)
        
        return {
            "success": True,
            "description": description,
            "total_steps": len(all_steps),
            "steps": all_steps
        }
    
    async def _execute_step(self, step: Dict):
        """Execute a single calibration step"""
        action = step.get('action')
        params = step.get('params', {})
        
        print(f"[Calibrator] Executing: {action} with {params}")
        
        if action == "tap":
            await self.tools.tap_by_coordinates(params.get('x', 540), params.get('y', 1200))
        elif action == "tap_text":
            # Use tap_by_index after finding element
            state = await self.get_ui_state()
            # Find element by text... (simplified)
            pass
        elif action == "swipe_up":
            await self.tools.swipe(500, 1500, 500, 500, 300)
        elif action == "swipe_down":
            await self.tools.swipe(500, 500, 500, 1500, 300)
        elif action == "back":
            await self.tools.back()
        elif action == "input_text":
            await self.tools.input_text(params.get('text', ''))
    
    def generate_workflow_json(self, calibration_result: Dict) -> Dict:
        """Generate workflow JSON from calibration result"""
        workflow = {
            "id": f"calibrated-{int(asyncio.get_event_loop().time() * 1000)}",
            "name": calibration_result.get('description', 'Calibrated Workflow')[:50],
            "description": calibration_result.get('description', ''),
            "icon": "🎯",
            "color": "#10B981",
            "category": "calibrated",
            "inputs": [],
            "steps": [],
            "outputs": [],
            "isBuiltin": False,
            "createdAt": None
        }
        
        for step in calibration_result.get('steps', []):
            workflow_step = {
                "id": f"step-{step.get('order', 0)}",
                "type": "action",
                "name": step.get('description', f"Step {step.get('order', 0)}"),
                "action": step.get('action'),
                "params": step.get('params', {})
            }
            workflow["steps"].append(workflow_step)
            
            # Add wait step after action
            wait_ms = step.get('wait_after', 1000)
            if wait_ms > 0:
                workflow["steps"].append({
                    "id": f"wait-{step.get('order', 0)}",
                    "type": "wait",
                    "name": f"Wait {wait_ms}ms",
                    "duration": str(wait_ms)
                })
        
        return workflow


# Global instance for connection pooling
_calibrator_instance: Optional[WorkflowCalibrator] = None

async def get_calibrator(device_id: str, provider: str = "openai", api_key: str = None, base_url: str = None) -> WorkflowCalibrator:
    """Get or create calibrator instance (connection pooling)"""
    global _calibrator_instance
    
    if _calibrator_instance is None or _calibrator_instance.device_id != device_id:
        _calibrator_instance = WorkflowCalibrator(device_id, provider, api_key, base_url=base_url)
        await _calibrator_instance.connect()
    
    return _calibrator_instance


async def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Workflow Calibrator - LLM Vision based")
    parser.add_argument("device_id", help="Device ID (e.g., 127.0.0.1:5555)")
    parser.add_argument("description", help="Workflow description")
    parser.add_argument("--provider", default="openai", help="LLM provider (openai, gemini, anthropic, Z.AI, OpenAILike)")
    parser.add_argument("--api-key", help="API key")
    parser.add_argument("--model", help="Model name")
    parser.add_argument("--base-url", help="Base URL for OpenAI-compatible APIs")
    parser.add_argument("--screens", type=int, default=1, help="Number of screens to analyze")
    parser.add_argument("--output", help="Output file for workflow JSON")
    
    args = parser.parse_args()
    
    # Create calibrator
    calibrator = await get_calibrator(args.device_id, args.provider, args.api_key, args.base_url)
    if args.model:
        calibrator.model = args.model
    
    # Calibrate workflow
    result = await calibrator.calibrate_workflow(args.description, args.screens)
    
    if result.get('success'):
        print(f"\n[OK] Calibration complete! Found {result['total_steps']} steps")
        
        # Generate workflow JSON
        workflow = calibrator.generate_workflow_json(result)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(workflow, f, indent=2, ensure_ascii=False)
            print(f"[SAVED] Saved workflow to: {args.output}")
        else:
            print("\n[WORKFLOW] Generated Workflow:")
            print(json.dumps(workflow, indent=2, ensure_ascii=False))
    else:
        print(f"\n[FAIL] Calibration failed: {result.get('error', 'Unknown error')}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
