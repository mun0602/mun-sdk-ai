// AI Providers configuration
// Shared between App.jsx and ChatExecutionPanel

export const DEFAULT_BASE_URLS = {
  'Z.AI': 'https://api.z.ai/api/coding/paas/v4',
  'OpenAILike': ''
};

// Default Vision Models (for screenshot analysis)
export const DEFAULT_VISION_MODELS = [
  { id: 'glm-4.6v', name: 'GLM-4.6V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
];

// Default Executor Models (text-only, code generation)
export const DEFAULT_EXECUTOR_MODELS = [
  { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'glm-4.5', name: 'GLM-4.5', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
];

export const AI_PROVIDERS = [
  { id: 'GoogleGenAI', name: 'Google GenAI', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], hasBaseUrl: false },
  { id: 'OpenAI', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1-preview'], hasBaseUrl: false },
  { id: 'Anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku'], hasBaseUrl: false },
  { id: 'DeepSeek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], hasBaseUrl: false },
  { id: 'Ollama', name: 'Ollama (Local)', models: ['llama3.2', 'qwen2.5', 'phi3'], hasBaseUrl: true, defaultBaseUrl: 'http://localhost:11434' },
  { id: 'Z.AI', name: 'Z.AI (GLM) ✓', models: ['glm-4.7', 'glm-4.6v', 'glm-4.5', 'glm-4-plus', 'glm-4.5-air', 'glm-4.5-flash', 'glm-4.5-airx', 'glm-4.5-x'], hasBaseUrl: true, defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4', actualProvider: 'OpenAILike', notes: 'Tested: works with vision=false' },
  { id: 'OpenAILike', name: 'OpenAI Compatible', models: [], hasBaseUrl: true, defaultBaseUrl: '', allowCustomModel: true, actualProvider: 'OpenAILike' },
];

// Helper to get provider by ID
export const getProviderById = (providerId) => {
  return AI_PROVIDERS.find(p => p.id === providerId);
};

// Helper to get models for a provider
export const getModelsForProvider = (providerId) => {
  const provider = getProviderById(providerId);
  return provider?.models || [];
};

// Default Profiles - Pre-configured, user only needs to add API key
export const DEFAULT_PROFILES = [
  {
    id: 'profile-zai',
    name: 'Z.AI (GLM)',
    provider: {
      name: 'Z.AI',
      api_key: '', // User fills this
      base_url: 'https://api.z.ai/api/coding/paas/v4',
      model: 'glm-4-plus',
    },
    max_steps: 1000,
    vision_models: [
      { id: 'glm-4.6v', name: 'GLM-4.6V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
    ],
    executor_models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'glm-4.5', name: 'GLM-4.5', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'glm-4.7', name: 'GLM-4.7', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
    ],
    isDefault: true,
  },
];
