#!/usr/bin/env python3
"""Test Z.AI API connection"""

import requests
import json

API_KEY = "4de312f8acfb4f2784be300d02b5149b.mFMBwPBxPcY0EJev"
BASE_URL = "https://api.z.ai/api/coding/paas/v4"
MODEL = "glm-4.6v"

def test_api():
    """Test API connection"""
    url = f"{BASE_URL}/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": "Hello, say hi"}
        ],
        "max_tokens": 50
    }
    
    print(f"Testing API: {url}")
    print(f"Model: {MODEL}")
    print(f"API Key: {API_KEY[:20]}...")
    print()
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✓ API working!")
            print(f"Response: {data.get('choices', [{}])[0].get('message', {}).get('content', 'N/A')}")
        else:
            print(f"\n✗ API Error: {response.status_code}")
            
    except Exception as e:
        print(f"\n✗ Connection Error: {e}")

if __name__ == "__main__":
    test_api()
