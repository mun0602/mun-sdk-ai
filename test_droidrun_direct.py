import asyncio
import os
import sys

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

os.environ['OPENAI_API_KEY'] = '63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK'
os.environ['OPENAI_BASE_URL'] = 'https://api.z.ai/api/paas/v4'

from droidrun import DroidAgent, LLMProfile, AdbTools

async def main():
    print('Creating tools...', flush=True)
    tools = AdbTools()
    await tools.connect('127.0.0.1:5555')
    print('Tools created', flush=True)
    
    llm = LLMProfile(
        provider='OpenAILike', 
        model='glm-4.6v', 
        base_url='https://api.z.ai/api/paas/v4', 
        api_key='63b28195cc1246448e23eed2e6543e08.wRiR2SdZrEwHTQKK'
    )
    print('LLM profile created', flush=True)
    
    agent = DroidAgent(tools=tools, llm=llm, task='xem 5 video tiktok')
    print('Agent created, running...', flush=True)
    
    result = await agent.run()
    print(f'Result: {result}', flush=True)

if __name__ == '__main__':
    asyncio.run(main())
