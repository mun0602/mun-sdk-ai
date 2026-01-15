import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Plus,
  RefreshCw,
  X,
  Check,
  Trash2,
  Edit,
  Zap,
  FileText,
  Download,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { useProfileStore, useUIStore, useTaskTemplateStore } from '../store';
import { invoke } from '../tauri-mock';
import { AI_PROVIDERS, getModelDisplayName } from '../constants/providers';
import { DEFAULT_VISION_MODELS, DEFAULT_EXECUTOR_MODELS } from '../constants/providers';
import ModelListEditor from './ModelListEditor';

// Helper: Check if model supports vision (has 'v' suffix for GLM models)
const isVisionModel = (modelId) => {
  if (!modelId) return false;
  const id = typeof modelId === 'string' ? modelId : modelId.id;
  if (!id) return false;
  const lower = id.toLowerCase();
  // GLM models need 'v' suffix for vision
  if (lower.startsWith('glm-')) {
    return lower.includes('v');
  }
  // Other known vision models
  if (lower.includes('vision') || lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('gpt-4-turbo')) {
    return true;
  }
  return false;
};

// Get suggested vision model for non-vision model
const getSuggestedVisionModel = (modelId) => {
  if (!modelId) return null;
  const id = typeof modelId === 'string' ? modelId : modelId.id;
  if (!id) return null;
  const lower = id.toLowerCase();
  // GLM models: add 'v' suffix
  if (lower.startsWith('glm-') && !lower.includes('v')) {
    // glm-4.7 -> glm-4.7v, glm-4-plus -> glm-4v-plus
    if (lower.includes('-plus')) {
      return id.replace(/-plus/i, 'v-plus');
    }
    return id + 'v';
  }
  return null;
};

// Profile Panel Component with Tabs
function ProfilePanel() {
  const { profiles, activeProfile, loadProfiles, createProfile, deleteProfile, setActiveProfile } = useProfileStore();
  const { toggleProfileModal, showProfileModal } = useUIStore();
  const [editProfile, setEditProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('profiles'); // 'profiles' or 'templates'
  const profileFileInputRef = useRef(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Export profiles to JSON
  const handleExportProfiles = () => {
    if (profiles.length === 0) {
      alert('Không có profile để export');
      return;
    }
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profiles: profiles,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profiles_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import profiles from JSON
  const handleImportProfiles = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const importedProfiles = data.profiles || data;
        
        if (Array.isArray(importedProfiles)) {
          let importCount = 0;
          for (const p of importedProfiles) {
            if (p.name && p.provider) {
              // Check if profile with same name exists
              const exists = profiles.find(existing => existing.name === p.name);
              if (!exists) {
                try {
                  await createProfile({
                    name: p.name,
                    provider: p.provider,
                    vision: p.vision ?? true,
                    reasoning: p.reasoning ?? false,
                    vision_models: p.vision_models || [],
                    executor_models: p.executor_models || [],
                  });
                  importCount++;
                } catch (err) {
                  console.warn('Could not import profile:', p.name, err);
                }
              }
            }
          }
          alert(`Đã import ${importCount} profiles!`);
          loadProfiles(); // Reload to show new profiles
        } else {
          alert('File JSON không hợp lệ');
        }
      } catch (err) {
        alert('Lỗi đọc file: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="profile-panel">
      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={`profile-tab ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          <User size={14} />
          <span>Profiles</span>
        </button>
        <button 
          className={`profile-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={14} />
          <span>Templates</span>
        </button>
      </div>

      {activeTab === 'profiles' ? (
        <>
          {/* Header */}
          <div className="profile-header">
            <div className="profile-header-left">
              <h2 className="profile-title">AI Profiles</h2>
              <span className="profile-count">{profiles.length} profiles</span>
            </div>
            <div className="flex gap-2">
              <button 
                className="profile-action-btn" 
                onClick={() => profileFileInputRef.current?.click()}
                title="Import JSON"
              >
                <Download size={14} />
              </button>
              <input
                ref={profileFileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportProfiles}
                style={{ display: 'none' }}
              />
              <button 
                className="profile-action-btn" 
                onClick={handleExportProfiles}
                title="Export JSON"
              >
                <Upload size={14} />
              </button>
              <button className="profile-add-btn" onClick={() => { setEditProfile(null); toggleProfileModal(); }}>
                <Plus size={14} />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          {/* Profile List */}
          <div className="profile-list">
            {profiles.length === 0 ? (
              <div className="profile-empty-state">
                <div className="empty-icon">
                  <User size={32} />
                </div>
                <p className="empty-title">Chưa có profile</p>
                <p className="empty-desc">Tạo profile để lưu cấu hình AI</p>
                <button className="empty-action" onClick={() => { setEditProfile(null); toggleProfileModal(); }}>
                  <Plus size={14} />
                  Tạo profile đầu tiên
                </button>
              </div>
            ) : (
              profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`profile-item ${activeProfile?.id === profile.id ? 'active' : ''}`}
                  onClick={() => setActiveProfile(profile.id)}
                >
                  <div className="profile-item-main">
                    <div className="profile-item-icon">
                      {activeProfile?.id === profile.id ? <Check size={14} /> : <User size={14} />}
                    </div>
                    <div className="profile-item-info">
                      <span className="profile-item-name">{profile.name}</span>
                      <span className="profile-item-model">{getModelDisplayName(profile.provider?.name, profile.provider?.model)}</span>
                    </div>
                    <span className="profile-item-provider">{profile.provider?.name}</span>
                  </div>
                  <div className="profile-item-actions">
                    <button
                      className="profile-action-btn"
                      onClick={(e) => { e.stopPropagation(); setEditProfile(profile); toggleProfileModal(); }}
                      title="Sửa"
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      className="profile-action-btn delete"
                      onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}
                      title="Xóa"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <TemplateTab />
      )}

      {showProfileModal && (
        <ProfileModal
          profile={editProfile}
          onClose={toggleProfileModal}
        />
      )}
    </div>
  );
}

// Template Tab Component (Skills - hướng dẫn AI)
function TemplateTab() {
  const { templates, addTemplate, updateTemplate, removeTemplate } = useTaskTemplateStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({ name: '', instructions: '', description: '', max_steps: 1000 });
  const fileInputRef = useRef(null);

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.instructions.trim()) return;
    
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, formData);
    } else {
      addTemplate(formData);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', instructions: '', description: '', max_steps: 1000 });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      instructions: template.instructions || template.prompt || template.task || '',
      description: template.description || '',
      max_steps: template.max_steps || 1000,
    });
    setEditingTemplate(template);
    setShowForm(true);
  };

  // Export templates to JSON
  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates: templates,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import templates from JSON
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const importedTemplates = data.templates || data;
        
        if (Array.isArray(importedTemplates)) {
          let importCount = 0;
          importedTemplates.forEach((t) => {
            if (t.name && (t.instructions || t.prompt || t.task)) {
              addTemplate({
                name: t.name,
                instructions: t.instructions || t.prompt || t.task || '',
                description: t.description || '',
                max_steps: t.max_steps || 1000,
              });
              importCount++;
            }
          });
          alert(`Đã import ${importCount} templates!`);
        } else {
          alert('File JSON không hợp lệ');
        }
      } catch (err) {
        alert('Lỗi đọc file: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <>
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-left">
          <h2 className="profile-title">Templates</h2>
          <span className="profile-count">{templates.length} templates</span>
        </div>
        <div className="flex gap-2">
          <button 
            className="profile-action-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Import JSON"
          >
            <Download size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button 
            className="profile-action-btn" 
            onClick={handleExport}
            disabled={templates.length === 0}
            title="Export JSON"
          >
            <Upload size={14} />
          </button>
          <button className="profile-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={14} />
            <span>Thêm</span>
          </button>
        </div>
      </div>

      {/* Template Form */}
      {showForm && (
        <div className="template-form card">
          <div className="input-group">
            <label className="input-label">Tên Template</label>
            <input
              type="text"
              className="input"
              placeholder="Ví dụ: Like TikTok Videos"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Mô tả (tùy chọn)</label>
            <input
              type="text"
              className="input"
              placeholder="Mô tả ngắn về template"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Hướng dẫn AI (Instructions)</label>
            <textarea
              className="input"
              rows={6}
              placeholder="Hướng dẫn cách AI thực hiện task. Ví dụ:&#10;- Mở TikTok từ màn hình chính&#10;- Tìm video và like&#10;- Comment 'Nice video!'&#10;- Swipe để xem video tiếp theo"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
            <small className="text-muted">Đây là skill hướng dẫn AI, không phải prompt trực tiếp</small>
          </div>
          <div className="input-group">
            <label className="input-label">Max Steps</label>
            <input
              type="number"
              className="input"
              value={formData.max_steps}
              onChange={(e) => setFormData({ ...formData, max_steps: parseInt(e.target.value) || 1000 })}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={resetForm}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingTemplate ? 'Cập nhật' : 'Tạo'}
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="profile-list">
        {templates.length === 0 && !showForm ? (
          <div className="profile-empty-state">
            <div className="empty-icon">
              <FileText size={32} />
            </div>
            <p className="empty-title">Chưa có skill/template</p>
            <p className="empty-desc">Skills giúp hướng dẫn AI thực hiện các tác vụ phức tạp</p>
            <button className="empty-action" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Tạo skill đầu tiên
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="profile-item">
              <div className="profile-item-main">
                <div className="profile-item-icon">
                  <FileText size={14} />
                </div>
                <div className="profile-item-info">
                  <span className="profile-item-name">{template.name}</span>
                  <span className="profile-item-model">{(template.instructions || template.prompt || '')?.substring(0, 50)}...</span>
                </div>
              </div>
              <div className="profile-item-actions">
                <button
                  className="profile-action-btn"
                  onClick={() => handleEdit(template)}
                  title="Sửa"
                >
                  <Edit size={12} />
                </button>
                <button
                  className="profile-action-btn delete"
                  onClick={() => removeTemplate(template.id)}
                  title="Xóa"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// Profile Modal Component
function ProfileModal({ profile, onClose }) {
  const { createProfile, updateProfile } = useProfileStore();
  const defaultProvider = AI_PROVIDERS[0]; // mun-ai is first
  const [formData, setFormData] = useState({
    id: profile?.id || crypto.randomUUID(),
    name: profile?.name || '',
    provider: profile?.provider || {
      name: defaultProvider.id,
      api_key: defaultProvider.hasApiKey === false ? '' : '',
      model: defaultProvider.models[0] || '',
      base_url: defaultProvider.defaultBaseUrl || null,
    },
    task: profile?.task || '',
    max_steps: profile?.max_steps || 9999,
    vision: profile?.vision ?? true,
    reasoning: profile?.reasoning ?? false,
    device_ids: profile?.device_ids || [],
    vision_models: profile?.vision_models || DEFAULT_VISION_MODELS,
    executor_models: profile?.executor_models || DEFAULT_EXECUTOR_MODELS,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const [customModel, setCustomModel] = useState(profile?.provider?.model || '');
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const selectedProvider = AI_PROVIDERS.find(p => p.id === formData.provider.name);
  
  // Get current model and check vision support
  const currentModel = selectedProvider?.allowCustomModel ? customModel : formData.provider.model;
  const modelSupportsVision = isVisionModel(currentModel);
  const suggestedVisionModel = getSuggestedVisionModel(currentModel);
  const showVisionWarning = formData.vision && !modelSupportsVision && currentModel;

  const handleProviderChange = (providerId) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    setPingResult(null); // Reset ping result when changing provider
    setFormData({
      ...formData,
      provider: {
        ...formData.provider,
        name: providerId,
        model: provider?.models?.[0] || '', // Empty for OpenAILike (custom model)
        base_url: provider?.defaultBaseUrl || null,
        api_key: provider?.hasApiKey === false ? 'backend-managed' : formData.provider.api_key,
      }
    });
    if (provider?.allowCustomModel) {
      setCustomModel('');
    }
  };

  const handlePingTest = async () => {
    setPingTesting(true);
    setPingResult(null);

    try {
      const testModel = selectedProvider?.allowCustomModel ? customModel : formData.provider.model;
      // For mun-ai, backend will inject credentials
      const testApiKey = selectedProvider?.hasApiKey === false ? '' : formData.provider.api_key;
      const testBaseUrl = formData.provider.base_url;
      
      const result = await invoke('ping_provider', {
        provider: formData.provider.name,
        apiKey: testApiKey,
        model: testModel,
        baseUrl: testBaseUrl,
      });

      setPingResult({ success: true, message: result });
    } catch (error) {
      setPingResult({ success: false, message: error.toString() });
    } finally {
      setPingTesting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // For mun-ai, backend will inject credentials
      const finalBaseUrl = formData.provider.base_url;
      const finalApiKey = selectedProvider?.hasApiKey === false ? '' : formData.provider.api_key;
      
      const submitData = {
        ...formData,
        provider: {
          ...formData.provider,
          model: selectedProvider?.allowCustomModel ? customModel : formData.provider.model,
          base_url: finalBaseUrl,
          api_key: finalApiKey,
        }
      };
      if (profile) {
        await updateProfile(submitData);
      } else {
        // createProfile now auto-sets as active
        await createProfile(submitData);
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{profile ? 'Sửa Profile' : 'Tạo Profile Mới'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Row 1: Name + Provider */}
          <div className="form-row">
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Tên Profile</label>
              <input
                type="text"
                className="input"
                placeholder="My Profile"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Provider</label>
              <select
                className="input"
                value={formData.provider.name}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Model + API Key */}
          <div className="form-row">
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Model</label>
              {selectedProvider?.allowCustomModel ? (
                <>
                  <select
                    className="input"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                  >
                    <option value="">-- Chọn hoặc nhập --</option>
                    {selectedProvider?.modelGroups ? (
                      Object.entries(selectedProvider.modelGroups).map(([groupName, models]) => (
                        <optgroup key={groupName} label={groupName}>
                          {models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      selectedProvider?.models?.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    )}
                  </select>
                  <input
                    type="text"
                    className="input mt-1"
                    placeholder="Hoặc nhập model..."
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    style={{ fontSize: '0.8rem' }}
                  />
                </>
              ) : (
                <select
                  className="input"
                  value={formData.provider.model}
                  onChange={(e) => setFormData({
                    ...formData,
                    provider: { ...formData.provider, model: e.target.value }
                  })}
                >
                  {selectedProvider?.models.map((m) => {
                    const modelId = typeof m === 'string' ? m : m.id;
                    const modelName = typeof m === 'string' ? m : m.name;
                    return <option key={modelId} value={modelId}>{modelName}</option>;
                  })}
                </select>
              )}
            </div>
            {/* API Key - hide if provider has hasApiKey: false */}
            {selectedProvider?.hasApiKey !== false && (
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">API Key</label>
              <input
                type="password"
                className="input"
                placeholder="sk-..."
                value={formData.provider.api_key}
                onChange={(e) => setFormData({
                  ...formData,
                  provider: { ...formData.provider, api_key: e.target.value }
                })}
              />
              <button
                type="button"
                className={`btn btn-sm mt-1 ${pingResult?.success ? 'btn-success' : 'btn-outline'}`}
                onClick={handlePingTest}
                disabled={pingTesting || !formData.provider.api_key}
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                {pingTesting ? 'Testing...' : pingResult?.success ? '✓ OK' : '⚡ Test'}
              </button>
            </div>
            )}
          </div>

          {/* Base URL (if provider supports) */}
          {selectedProvider?.hasBaseUrl && (
            <div className="input-group">
              <label className="input-label">Base URL</label>
              <input
                type="text"
                className="input"
                placeholder={selectedProvider.defaultBaseUrl}
                value={formData.provider.base_url || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  provider: { ...formData.provider, base_url: e.target.value }
                })}
              />
            </div>
          )}

          {/* Options: Vision + Reasoning inline */}
          <div className="form-row" style={{ gap: '24px' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.vision}
                onChange={(e) => setFormData({ ...formData, vision: e.target.checked })}
              />
              <span>Vision</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.reasoning}
                onChange={(e) => setFormData({ ...formData, reasoning: e.target.checked })}
              />
              <span>Reasoning</span>
            </label>
          </div>

          {/* Vision Warning - compact */}
          {showVisionWarning && (
            <div className="vision-warning" style={{ padding: '8px', fontSize: '0.8rem' }}>
              <AlertTriangle size={12} />
              <span>Model không hỗ trợ vision! {suggestedVisionModel && (
                <button 
                  type="button"
                  className="vision-warning-btn"
                  onClick={() => {
                    if (selectedProvider?.allowCustomModel) {
                      setCustomModel(suggestedVisionModel);
                    } else {
                      setFormData({
                        ...formData,
                        provider: { ...formData.provider, model: suggestedVisionModel }
                      });
                    }
                  }}
                >Đổi sang {suggestedVisionModel}</button>
              )}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {profile ? 'Cập nhật' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePanel;
export { ProfileModal };
