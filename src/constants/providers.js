// AI Providers configuration
// Shared between App.jsx and ChatExecutionPanel

export const DEFAULT_BASE_URLS = {
  'Z.AI': 'https://api.z.ai/api/coding/paas/v4',
  'mun-ai': 'http://127.0.0.1:8000/v1',
  'OpenAILike': ''
};

// Default Vision Models (for screenshot analysis)
export const DEFAULT_VISION_MODELS = [
  { id: 'glm-4.6v', name: 'GLM-4.6V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'glm-4.5v', name: 'GLM-4.5V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
];

// Default Executor Models (text-only, code generation)
export const DEFAULT_EXECUTOR_MODELS = [
  { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'glm-4.5', name: 'GLM-4.5', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
];

export const AI_PROVIDERS = [
  {
    id: 'mun-ai',
    name: 'mun-ai ✓',
    models: [
      { id: 'gemini-3-pro-preview', name: 'mun-ai 3 pro' },
      { id: 'gemini-2.5-computer-use-preview-10-2025', name: 'mun-ai 2.5 computer use' },
      { id: 'gpt-oss-120b-medium', name: 'mun-ai oss 120b' },
      { id: 'gemini-3-flash-preview', name: 'mun-ai 3 flash' },
    ],
    hasBaseUrl: false,
    hasApiKey: false,
    actualProvider: 'OpenAILike',
    notes: 'mun-ai API'
  },
  { id: 'Z.AI', name: 'Z.AI (GLM) ✓', models: ['glm-4.7', 'glm-4.6v', 'glm-4.5', 'glm-4-plus', 'glm-4.5-air', 'glm-4.5-flash', 'glm-4.5-airx', 'glm-4.5-x'], hasBaseUrl: true, defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4', actualProvider: 'OpenAILike', notes: 'Tested: works with vision=false' },
  { id: 'GoogleGenAI', name: 'Google GenAI', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], hasBaseUrl: false },
  { id: 'OpenAI', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1-preview'], hasBaseUrl: false },
  { id: 'Anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku'], hasBaseUrl: false },
  { id: 'DeepSeek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], hasBaseUrl: false },
  { id: 'Ollama', name: 'Ollama (Local)', models: ['llama3.2', 'qwen2.5', 'phi3'], hasBaseUrl: true, defaultBaseUrl: 'http://localhost:11434' },
  { id: 'OpenAILike', name: 'OpenAI Compatible', models: [], hasBaseUrl: true, defaultBaseUrl: '', allowCustomModel: true, actualProvider: 'OpenAILike' },
];

// Helper to get provider by ID
export const getProviderById = (providerId) => {
  return AI_PROVIDERS.find(p => p.id === providerId);
};

// Helper to get models for a provider (returns array of ids for backward compatibility)
export const getModelsForProvider = (providerId) => {
  const provider = getProviderById(providerId);
  if (!provider?.models) return [];
  return provider.models.map(m => typeof m === 'string' ? m : m.id);
};

// Helper to get model display name
export const getModelDisplayName = (providerId, modelId) => {
  const provider = getProviderById(providerId);
  if (!provider?.models) return modelId;
  const model = provider.models.find(m => 
    typeof m === 'string' ? m === modelId : m.id === modelId
  );
  if (!model) return modelId;
  return typeof model === 'string' ? model : model.name;
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
    task: '',
    max_steps: 1000,
    vision: true,
    reasoning: false,
    device_ids: [],
    vision_models: [
      { id: 'glm-4.6v', name: 'GLM-4.6V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'glm-4.5v', name: 'GLM-4.5V', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
    ],
    executor_models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'glm-4.5', name: 'GLM-4.5', provider: 'Z.AI', baseUrl: 'https://api.z.ai/api/coding/paas/v4' },
    ],
    isDefault: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
