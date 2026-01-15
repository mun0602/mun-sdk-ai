#!/usr/bin/env python3
"""
ScripterAgent Python Wrapper - Off-device automation helper

This wrapper provides a safe execution environment for AI-generated Python code.
It's called by the Rust workflow engine to execute "off-device" logic tasks.

Usage (called from Rust):
    python scripter_wrapper.py <script_path> <context_path> <result_path>

Context JSON structure:
    {
        "inputs": {...},        # User-provided workflow inputs
        "context": {...},       # Variables from previous workflow steps  
        "device_id": "...",     # Android device ID (for reference only)
    }

Result JSON structure:
    {
        "success": true/false,
        "result": {...},        # Values set via set_result()
        "output": "...",        # Captured stdout
        "error": null/"..."     # Error message if any
    }
"""

import json
import sys
import io
import traceback
from pathlib import Path
from datetime import datetime
from typing import Any, Optional

# ============================================
# Safety: Disable dangerous modules
# ============================================

BLOCKED_MODULES = ['os', 'sys', 'subprocess', 'shutil', 'socket', 'pickle', 'marshal']

class SafeImportHook:
    """Block dangerous module imports"""
    def find_module(self, name, path=None):
        if name.split('.')[0] in BLOCKED_MODULES:
            raise ImportError(f"Module '{name}' is not allowed for security reasons")
        return None

# Install import hook (can be disabled for testing)
SAFE_MODE = True
if SAFE_MODE:
    sys.meta_path.insert(0, SafeImportHook())

# ============================================
# Allowed modules (pre-import for user code)
# ============================================

import requests
import re
import csv
import math
import random
import base64

# Make datetime available
from datetime import datetime, timedelta, date, time

# ============================================
# Global context (populated before user code runs)
# ============================================

inputs: dict = {}
context: dict = {}
device_id: str = "none"
_results: dict = {}
_output_buffer: io.StringIO = io.StringIO()

# ============================================
# Helper functions (available to user code)
# ============================================

def get_input(name: str, default: Any = None) -> Any:
    """Get a workflow input value by name.
    
    Args:
        name: Input variable name
        default: Default value if not found
        
    Returns:
        The input value or default
        
    Example:
        budget = get_input('budget', 10000000)
        username = get_input('username')
    """
    return inputs.get(name, default)


def get_context(name: str, default: Any = None) -> Any:
    """Get a context variable from previous workflow steps.
    
    Args:
        name: Variable name
        default: Default value if not found
        
    Returns:
        The context value or default
        
    Example:
        previous_result = get_context('api_response')
        counter = get_context('iteration', 0)
    """
    return context.get(name, default)


def set_result(key: str, value: Any) -> None:
    """Set a result value to be passed to subsequent workflow steps.
    
    IMPORTANT: Always call this to return data from your script!
    
    Args:
        key: Result key name
        value: Any JSON-serializable value
        
    Example:
        set_result('gold_amount', 15.5)
        set_result('api_data', {'status': 'ok', 'items': [1,2,3]})
    """
    global _results
    _results[key] = value


def log(message: str, level: str = "info") -> None:
    """Log a message with timestamp.
    
    Args:
        message: Log message
        level: Log level (info, warning, error)
        
    Example:
        log("Processing started")
        log("API returned 404", "warning")
    """
    timestamp = datetime.now().strftime("%H:%M:%S")
    prefix = {"info": "ℹ️", "warning": "⚠️", "error": "❌"}.get(level, "•")
    print(f"[{timestamp}] {prefix} {message}")


def http_get(url: str, headers: Optional[dict] = None, timeout: int = 30) -> dict:
    """Make HTTP GET request with error handling.
    
    Args:
        url: Target URL
        headers: Optional headers dict
        timeout: Request timeout in seconds
        
    Returns:
        dict with 'success', 'status_code', 'data' or 'error'
        
    Example:
        result = http_get('https://api.example.com/data')
        if result['success']:
            data = result['data']
    """
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        return {
            'success': response.ok,
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
        }
    except requests.RequestException as e:
        return {'success': False, 'error': str(e)}


def http_post(url: str, data: Optional[dict] = None, json_data: Optional[dict] = None, 
              headers: Optional[dict] = None, timeout: int = 30) -> dict:
    """Make HTTP POST request with error handling.
    
    Args:
        url: Target URL
        data: Form data (optional)
        json_data: JSON body (optional)
        headers: Optional headers dict
        timeout: Request timeout in seconds
        
    Returns:
        dict with 'success', 'status_code', 'data' or 'error'
        
    Example:
        result = http_post('https://api.example.com/submit', json_data={'name': 'test'})
    """
    try:
        response = requests.post(url, data=data, json=json_data, headers=headers, timeout=timeout)
        return {
            'success': response.ok,
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
        }
    except requests.RequestException as e:
        return {'success': False, 'error': str(e)}


def read_json_file(filepath: str) -> Optional[dict]:
    """Read and parse a JSON file.
    
    Args:
        filepath: Path to JSON file
        
    Returns:
        Parsed JSON data or None if error
        
    Example:
        config = read_json_file('config.json')
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log(f"Failed to read JSON file: {e}", "error")
        return None


def write_json_file(filepath: str, data: Any) -> bool:
    """Write data to a JSON file.
    
    Args:
        filepath: Path to JSON file
        data: JSON-serializable data
        
    Returns:
        True if successful, False otherwise
        
    Example:
        write_json_file('output.json', {'result': 123})
    """
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        log(f"Failed to write JSON file: {e}", "error")
        return False


def read_csv_file(filepath: str, has_header: bool = True) -> list:
    """Read a CSV file.
    
    Args:
        filepath: Path to CSV file
        has_header: Whether first row is header
        
    Returns:
        List of dicts (if has_header) or list of lists
        
    Example:
        rows = read_csv_file('data.csv')
        for row in rows:
            print(row['name'])
    """
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            if has_header:
                return list(csv.DictReader(f))
            else:
                return list(csv.reader(f))
    except Exception as e:
        log(f"Failed to read CSV file: {e}", "error")
        return []


def write_csv_file(filepath: str, data: list, headers: Optional[list] = None) -> bool:
    """Write data to a CSV file.
    
    Args:
        filepath: Path to CSV file
        data: List of dicts or list of lists
        headers: Optional column headers
        
    Returns:
        True if successful, False otherwise
        
    Example:
        write_csv_file('output.csv', [{'name': 'Alice', 'age': 30}])
    """
    try:
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            if data and isinstance(data[0], dict):
                headers = headers or list(data[0].keys())
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(data)
            else:
                writer = csv.writer(f)
                if headers:
                    writer.writerow(headers)
                writer.writerows(data)
        return True
    except Exception as e:
        log(f"Failed to write CSV file: {e}", "error")
        return False


def parse_number(text: str, default: float = 0.0) -> float:
    """Parse number from text, handling various formats.
    
    Args:
        text: Text containing a number
        default: Default value if parsing fails
        
    Returns:
        Parsed number or default
        
    Example:
        price = parse_number("$1,234.56")  # Returns 1234.56
    """
    try:
        # Remove currency symbols, commas, spaces
        cleaned = re.sub(r'[^\d.-]', '', str(text))
        return float(cleaned) if cleaned else default
    except:
        return default


def format_number(num: float, decimals: int = 2, thousands_sep: str = ",") -> str:
    """Format number with thousands separator.
    
    Args:
        num: Number to format
        decimals: Decimal places
        thousands_sep: Thousands separator
        
    Returns:
        Formatted string
        
    Example:
        format_number(1234567.89)  # Returns "1,234,567.89"
    """
    formatted = f"{num:,.{decimals}f}"
    if thousands_sep != ",":
        formatted = formatted.replace(",", thousands_sep)
    return formatted


def random_delay(min_ms: int = 100, max_ms: int = 500) -> int:
    """Generate random delay value (for use in workflow waits).
    
    Args:
        min_ms: Minimum delay in milliseconds
        max_ms: Maximum delay in milliseconds
        
    Returns:
        Random delay value
        
    Example:
        delay = random_delay(500, 1500)
        set_result('wait_time', delay)
    """
    return random.randint(min_ms, max_ms)


def timestamp_now() -> str:
    """Get current timestamp as ISO string.
    
    Returns:
        Current timestamp in ISO format
        
    Example:
        set_result('started_at', timestamp_now())
    """
    return datetime.now().isoformat()


# ============================================
# Script execution engine
# ============================================

def execute_script(script_code: str, script_context: dict) -> dict:
    """Execute user script in controlled environment.
    
    Args:
        script_code: Python code to execute
        script_context: Dict with 'inputs', 'context', 'device_id'
        
    Returns:
        Result dict with success, result, output, error
    """
    global inputs, context, device_id, _results, _output_buffer
    
    # Setup context
    inputs = script_context.get('inputs', {})
    context = script_context.get('context', {})
    device_id = script_context.get('device_id', 'none')
    _results = {}
    _output_buffer = io.StringIO()
    
    # Capture stdout
    old_stdout = sys.stdout
    sys.stdout = _output_buffer
    
    result = {
        'success': True,
        'result': None,
        'output': '',
        'error': None
    }
    
    try:
        # Create execution namespace with helpers
        exec_globals = {
            '__builtins__': __builtins__,
            # Context
            'inputs': inputs,
            'context': context,
            'device_id': device_id,
            # Helper functions
            'get_input': get_input,
            'get_context': get_context,
            'set_result': set_result,
            'log': log,
            'http_get': http_get,
            'http_post': http_post,
            'read_json_file': read_json_file,
            'write_json_file': write_json_file,
            'read_csv_file': read_csv_file,
            'write_csv_file': write_csv_file,
            'parse_number': parse_number,
            'format_number': format_number,
            'random_delay': random_delay,
            'timestamp_now': timestamp_now,
            # Allowed modules
            'requests': requests,
            'json': json,
            'csv': csv,
            're': re,
            'math': math,
            'random': random,
            'base64': base64,
            'datetime': datetime,
            'timedelta': timedelta,
            'date': date,
            'time': time,
            'Path': Path,
        }
        
        # Execute user code
        exec(script_code, exec_globals)
        
        # Collect results
        result['result'] = _results if _results else exec_globals.get('result')
        
    except Exception as e:
        result['success'] = False
        result['error'] = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        log(f"Script error: {e}", "error")
        
    finally:
        # Restore stdout
        sys.stdout = old_stdout
        result['output'] = _output_buffer.getvalue()
    
    return result


def main():
    """Main entry point - called by Rust workflow engine."""
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python scripter_wrapper.py <script_path> <context_path> <result_path>'
        }))
        sys.exit(1)
    
    script_path = sys.argv[1]
    context_path = sys.argv[2]
    result_path = sys.argv[3]
    
    # Read script
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            script_code = f.read()
    except Exception as e:
        result = {'success': False, 'error': f'Cannot read script: {e}'}
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
        sys.exit(1)
    
    # Read context
    try:
        with open(context_path, 'r', encoding='utf-8') as f:
            script_context = json.load(f)
    except Exception as e:
        result = {'success': False, 'error': f'Cannot read context: {e}'}
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
        sys.exit(1)
    
    # Execute script
    result = execute_script(script_code, script_context)
    
    # Write result
    try:
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Cannot write result: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
