#!/usr/bin/env python3
"""
DroidRun Helper Script for Tauri V2
Ported from Flet Python logic (droidrun_app_flet.py)

Usage:
    python run_droidrun.py <device_id> <provider> <model> <prompt> <max_steps> <api_key> <base_url> <vision> <reasoning>

This script runs the DroidRun agent and streams output to stdout for real-time
capture by the Tauri backend.
"""

import sys
import os
import asyncio
import traceback

# Force UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def print_log(message: str, level: str = "INFO"):
    """Print a log message that will be captured by Tauri"""
    print(f"[{level}] {message}", flush=True)

def emit_event(event_type: str, data: dict):
    """Emit a JSON event that will be parsed by Tauri backend"""
    import json
    event = {"type": event_type, **data}
    print(f"[EVENT] {json.dumps(event)}", flush=True)


async def run_agent(
    device_id: str,
    provider: str,
    model: str,
    prompt: str,
    api_key: str,
    base_url: str,
    vision: bool,
    reasoning: bool,
    max_steps: int = 1000,
    # Tracing params
    tracing_enabled: bool = False,
    tracing_provider: str = "none",
    phoenix_url: str = "",
    phoenix_project_name: str = "",
    langfuse_secret_key: str = "",
    langfuse_public_key: str = "",
    langfuse_host: str = "",
    langfuse_user_id: str = "",
    save_trajectory: str = "none",
):
    """Run the DroidRun agent on the specified device"""
    
    print_log(f"Initializing agent for device: {device_id}")
    print_log(f"Provider: {provider}, Model: {model}")
    print_log(f"Base URL: {base_url}")
    print_log(f"API Key: {'***' + api_key[-4:] if api_key and len(api_key) > 4 else '(empty)'}")
    print_log(f"Vision: {vision}, Reasoning: {reasoning}, Max Steps: {max_steps}")
    if tracing_enabled:
        print_log(f"Tracing: {tracing_provider}, Trajectory: {save_trajectory}")
    
    try:
        # Import droidrun
        from droidrun import DroidAgent, DroidrunConfig, DeviceConfig
        from droidrun.config_manager import LLMProfile
        
        print_log("DroidRun imported successfully")
        
        # Create device config
        device_config = DeviceConfig(serial=device_id)
        config = DroidrunConfig(device=device_config)
        
        # Configure tracing if enabled
        if tracing_enabled and tracing_provider != "none":
            try:
                from droidrun import TracingConfig
                tracing_config = TracingConfig(enabled=True, provider=tracing_provider)
                
                if tracing_provider == "phoenix":
                    if phoenix_url:
                        tracing_config.phoenix_url = phoenix_url
                    if phoenix_project_name:
                        tracing_config.phoenix_project_name = phoenix_project_name
                    print_log(f"Phoenix tracing configured: {phoenix_url or 'default'}")
                    
                elif tracing_provider == "langfuse":
                    if langfuse_secret_key:
                        tracing_config.langfuse_secret_key = langfuse_secret_key
                    if langfuse_public_key:
                        tracing_config.langfuse_public_key = langfuse_public_key
                    if langfuse_host:
                        tracing_config.langfuse_host = langfuse_host
                    if langfuse_user_id:
                        tracing_config.langfuse_user_id = langfuse_user_id
                    print_log(f"Langfuse tracing configured: {langfuse_host or 'cloud.langfuse.com'}")
                
                config.tracing = tracing_config
            except ImportError:
                print_log("TracingConfig not available in this droidrun version", "WARN")
        
        # Configure trajectory recording
        if save_trajectory and save_trajectory != "none":
            if hasattr(config, 'logging'):
                config.logging.save_trajectory = save_trajectory
                print_log(f"Trajectory recording: {save_trajectory}")
                print_log(f"Trajectory path: {config.logging.trajectory_path}")
            else:
                print_log("Trajectory config not available", "WARN")
        
        # Set vision mode in agent config
        if hasattr(config, 'agent'):
            if hasattr(config.agent, 'codeact'):
                config.agent.codeact.vision = vision
            if hasattr(config.agent, 'manager'):
                config.agent.manager.vision = vision
            if hasattr(config.agent, 'executor'):
                config.agent.executor.vision = vision
            print_log(f"Vision mode set to: {vision}")
        
        # Set up API key environment variable based on provider
        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "openailike": "OPENAI_API_KEY",
            "z.ai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "googlegenai": "GOOGLE_API_KEY",
            "google": "GOOGLE_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "ollama": None,
        }
        
        env_var = env_var_map.get(provider.lower(), "OPENAI_API_KEY")
        if env_var and api_key:
            os.environ[env_var] = api_key
            print_log(f"Set {env_var} environment variable")
        
        # Set base URL for OpenAI-like providers
        if base_url:
            os.environ["OPENAI_API_BASE"] = base_url
            os.environ["OPENAI_BASE_URL"] = base_url
            print_log(f"Set base URL: {base_url}")
        
        # Create LLM profile with custom headers for mun-ai compatibility
        llm_kwargs = {"api_key": api_key} if api_key else {}
        
        # Add default headers to bypass User-Agent blocking
        llm_kwargs["default_headers"] = {"User-Agent": "curl/8.0"}
        
        llm = LLMProfile(
            provider=provider,
            model=model,
            temperature=0.2,
            base_url=base_url if base_url else None,
            api_base=base_url if base_url else None,
            kwargs=llm_kwargs
        )
        
        print_log(f"LLM Profile created: provider={provider}, model={model}, base_url={base_url}")
        
        # Apply to all role profiles (Flet logic)
        config.llm_profiles = {
            k: llm for k in ["manager", "executor", "codeact", "text_manipulator", "app_opener", "scripter"]
        }
        
        # Set max_steps in config if supported
        if hasattr(config, 'agent'):
            if hasattr(config.agent, 'max_steps'):
                config.agent.max_steps = max_steps
                print_log(f"Set max_steps in config: {max_steps}")
            elif hasattr(config.agent, 'codeact') and hasattr(config.agent.codeact, 'max_steps'):
                config.agent.codeact.max_steps = max_steps
                print_log(f"Set codeact.max_steps: {max_steps}")
        
        print_log("LLM profile configured")
        
        # Add swipe hint for video apps
        enhanced_prompt = prompt
        prompt_lower = prompt.lower()
        swipe_keywords = ['video', 'tiktok', 'scroll', 'watch', 'swipe', 'next']
        if any(kw in prompt_lower for kw in swipe_keywords):
            if 'swipe(' not in prompt_lower:
                enhanced_prompt = prompt + ". HINT: Swipe to next video: swipe([270, 800], [270, 200], duration=0.8)"
                print_log("Auto-added swipe hint to prompt")
        
        print_log(f"Starting agent with goal: {enhanced_prompt[:100]}...")
        
        # Create agent - try with max_steps first, fallback without it
        try:
            agent = DroidAgent(goal=enhanced_prompt, config=config, max_steps=max_steps)
        except TypeError as e:
            if "max_steps" in str(e):
                print_log(f"max_steps not supported as constructor arg, creating without it", "WARN")
                agent = DroidAgent(goal=enhanced_prompt, config=config)
            else:
                raise
        
        # Run with event streaming
        import json
        import base64
        
        def emit_event(event_type: str, data: dict):
            """Emit event as JSON for Tauri to parse"""
            event_data = {"type": event_type, **data}
            print(f"[EVENT] {json.dumps(event_data, ensure_ascii=False)}", flush=True)
        
        try:
            # Try to import event types
            from droidrun.events import (
                ManagerPlanDetailsEvent, ManagerPlanEvent,
                ExecutorActionEvent, ExecutorInputEvent,
                ScreenshotEvent, TaskThinkingEvent,
                ResultEvent, TaskExecutionResultEvent,
            )
            
            handler = agent.run()
            step_count = 0
            
            async for event in handler.stream_events():
                event_name = event.__class__.__name__
                
                # Manager planning events
                if isinstance(event, ManagerPlanDetailsEvent):
                    emit_event("plan", {
                        "plan": getattr(event, 'plan', ''),
                        "current_subgoal": getattr(event, 'current_subgoal', ''),
                    })
                
                elif isinstance(event, ManagerPlanEvent):
                    emit_event("plan", {
                        "plan": getattr(event, 'plan', ''),
                        "current_subgoal": getattr(event, 'current_subgoal', ''),
                        "thought": getattr(event, 'thought', ''),
                    })
                
                # Executor action events
                elif isinstance(event, ExecutorActionEvent):
                    step_count += 1
                    emit_event("action", {
                        "step": step_count,
                        "description": getattr(event, 'description', ''),
                        "thought": getattr(event, 'thought', ''),
                    })
                
                elif isinstance(event, ExecutorInputEvent):
                    emit_event("executor_input", {
                        "current_subgoal": getattr(event, 'current_subgoal', ''),
                    })
                
                # Screenshot event
                elif isinstance(event, ScreenshotEvent):
                    screenshot_bytes = getattr(event, 'screenshot', None)
                    if screenshot_bytes:
                        screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                        emit_event("screenshot", {
                            "data": screenshot_b64,
                            "step": step_count,
                        })
                
                # Task thinking (code generation)
                elif isinstance(event, TaskThinkingEvent):
                    emit_event("thinking", {
                        "code": getattr(event, 'code', ''),
                        "thoughts": getattr(event, 'thoughts', ''),
                    })
                
                # Task execution result
                elif isinstance(event, TaskExecutionResultEvent):
                    emit_event("execution_result", {
                        "output": getattr(event, 'output', ''),
                    })
                
                # Final result
                elif isinstance(event, ResultEvent):
                    emit_event("result", {
                        "success": getattr(event, 'success', False),
                        "reason": getattr(event, 'reason', ''),
                        "steps": getattr(event, 'steps', step_count),
                    })
            
            # Wait for final result
            result = await handler
            
        except ImportError as ie:
            print_log(f"Event streaming not available: {ie}", "WARN")
            print_log("Falling back to simple run mode", "WARN")
            # Fallback to simple run
            result = await agent.run()
        
        # Report result
        result_success = hasattr(result, "success") and result.success
        result_reason = getattr(result, "reason", "") if hasattr(result, "reason") else ""
        result_steps = getattr(result, "steps", 0) if hasattr(result, "steps") else 0
        
        # Emit result event for Tauri frontend
        emit_event("result", {
            "success": result_success,
            "reason": result_reason,
            "steps": result_steps,
        })
        
        if result_success:
            print_log("✓ Mission completed successfully", "SUCCESS")
            if result_reason:
                print_log(f"Result: {result_reason[:500]}")
        else:
            print_log("✗ Mission failed", "ERROR")
            if result_reason:
                print_log(f"Reason: {result_reason[:500]}")
        
        # Print trajectory folder path for Tauri to capture
        if save_trajectory and save_trajectory != "none":
            import glob
            traj_base = config.logging.trajectory_path if hasattr(config, 'logging') else "trajectories"
            # Find the most recent trajectory folder
            traj_folders = sorted(glob.glob(os.path.join(traj_base, "*")), key=os.path.getmtime, reverse=True)
            if traj_folders:
                latest_traj = traj_folders[0]
                # Check if it has trajectory.json (droidrun creates this) or macro.json
                trajectory_json = os.path.join(latest_traj, "trajectory.json")
                macro_json = os.path.join(latest_traj, "macro.json")
                if os.path.exists(trajectory_json) or os.path.exists(macro_json):
                    print_log(f"Trajectory saved to: {latest_traj}", "SUCCESS")
                    print_log(f"trajectories/{os.path.basename(latest_traj)}")
                    # Count steps in trajectory
                    if os.path.exists(trajectory_json):
                        try:
                            import json
                            with open(trajectory_json, 'r') as f:
                                traj_data = json.load(f)
                            step_count = len([e for e in traj_data if 'Action' in e.get('type', '') or 'Thinking' in e.get('type', '')])
                            print_log(f"Trajectory contains {step_count} action steps")
                        except Exception as e:
                            print_log(f"Could not read trajectory: {e}", "WARN")
                else:
                    print_log(f"Trajectory folder created but no trajectory.json: {latest_traj}", "WARN")
            else:
                print_log("No trajectory folder found", "WARN")
        
        return result
        
    except ImportError as e:
        print_log(f"Failed to import DroidRun: {e}", "ERROR")
        print_log("Make sure DroidRun is installed: pip install droidrun", "ERROR")
        return None
    except Exception as e:
        print_log(f"Agent error: {e}", "ERROR")
        print_log(f"Traceback: {traceback.format_exc()[:500]}", "ERROR")
        return None


def main():
    """Main entry point"""
    if len(sys.argv) < 9:
        print_log("Usage: python run_droidrun.py <device_id> <provider> <model> <prompt> <api_key> <base_url> <vision> <reasoning> [tracing_json]", "ERROR")
        sys.exit(1)
    
    # Parse arguments
    device_id = sys.argv[1]
    provider = sys.argv[2]
    model = sys.argv[3]
    prompt = sys.argv[4]
    api_key = sys.argv[5] if len(sys.argv) > 5 else ""
    base_url = sys.argv[6] if len(sys.argv) > 6 else ""
    vision = sys.argv[7].lower() == "true" if len(sys.argv) > 7 else True
    reasoning = sys.argv[8].lower() == "true" if len(sys.argv) > 8 else False
    
    # Parse tracing config from JSON (arg 9)
    tracing_enabled = False
    tracing_provider = "none"
    phoenix_url = ""
    phoenix_project_name = ""
    langfuse_secret_key = ""
    langfuse_public_key = ""
    langfuse_host = ""
    langfuse_user_id = ""
    save_trajectory = "none"
    max_steps = 1000
    
    if len(sys.argv) > 9 and sys.argv[9]:
        try:
            import json
            tracing_json = json.loads(sys.argv[9])
            tracing_enabled = tracing_json.get("enabled", False)
            tracing_provider = tracing_json.get("provider", "none")
            phoenix_url = tracing_json.get("phoenix_url", "")
            phoenix_project_name = tracing_json.get("phoenix_project_name", "")
            langfuse_secret_key = tracing_json.get("langfuse_secret_key", "")
            langfuse_public_key = tracing_json.get("langfuse_public_key", "")
            langfuse_host = tracing_json.get("langfuse_host", "")
            langfuse_user_id = tracing_json.get("langfuse_user_id", "")
            save_trajectory = tracing_json.get("save_trajectory", "none")
            max_steps = tracing_json.get("max_steps", 1000)
        except (json.JSONDecodeError, Exception) as e:
            print_log(f"Failed to parse tracing config: {e}", "WARN")
    
    print_log("=" * 60)
    print_log("DroidRun Helper Script")
    print_log(f"Device: {device_id}")
    print_log(f"Provider: {provider}")
    print_log(f"Model: {model}")
    if tracing_enabled:
        print_log(f"Tracing: {tracing_provider}")
    if save_trajectory != "none":
        print_log(f"Recording: {save_trajectory}")
    print_log("=" * 60)
    
    # Run the agent
    try:
        result = asyncio.run(run_agent(
            device_id=device_id,
            provider=provider,
            model=model,
            prompt=prompt,
            api_key=api_key,
            base_url=base_url,
            vision=vision,
            reasoning=reasoning,
            max_steps=max_steps,
            tracing_enabled=tracing_enabled,
            tracing_provider=tracing_provider,
            phoenix_url=phoenix_url,
            phoenix_project_name=phoenix_project_name,
            langfuse_secret_key=langfuse_secret_key,
            langfuse_public_key=langfuse_public_key,
            langfuse_host=langfuse_host,
            langfuse_user_id=langfuse_user_id,
            save_trajectory=save_trajectory,
        ))
        
        if result and hasattr(result, "success") and result.success:
            print_log("Agent completed successfully", "SUCCESS")
            sys.exit(0)
        else:
            print_log("Agent did not complete successfully", "WARN")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print_log("Agent interrupted by user", "WARN")
        emit_event("result", {
            "success": False,
            "reason": "Task bị hủy bởi người dùng",
            "steps": 0,
        })
        sys.exit(130)
    except Exception as e:
        error_msg = str(e)
        print_log(f"Fatal error: {error_msg}", "ERROR")
        print_log(traceback.format_exc(), "ERROR")
        # Emit result event even on error so frontend knows task finished
        emit_event("result", {
            "success": False,
            "reason": f"Lỗi: {error_msg[:300]}",
            "steps": 0,
        })
        sys.exit(1)


if __name__ == "__main__":
    main()
