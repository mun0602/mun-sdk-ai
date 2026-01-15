import React, { useState, useEffect } from 'react';
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
  Copy,
  Upload,
  Download,
} from 'lucide-react';
import { useProfileStore, useUIStore, useTemplateStore } from '../store';
import { invoke } from '../tauri-mock';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { AI_PROVIDERS } from '../constants/providers';
import { DEFAULT_VISION_MODELS, DEFAULT_EXECUTOR_MODELS } from '../constants/providers';
import ModelListEditor from './ModelListEditor';

// Profile Panel Component with Sub-tabs
function ProfilePanel() {
  const [activeSubTab, setActiveSubTab] = useState('profiles');

  return (
    <div className="profile-panel">
      {/* Sub-tabs Navigation */}
      <div className="profile-subtabs">
        <button
          className={`profile-subtab ${activeSubTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('profiles')}
        >
          <User size={16} />
          <span>Profiles</span>
        </button>
        <button
          className={`profile-subtab ${activeSubTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('templates')}
        >
          <FileText size={16} />
          <span>Templates</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeSubTab === 'profiles' ? <ProfilesSection /> : <TemplatesSection />}
    </div>
  );
}

// Profiles Section
function ProfilesSection() {
  const { profiles, activeProfile, loadProfiles, deleteProfile, setActiveProfile } = useProfileStore();
  const { toggleProfileModal, showProfileModal } = useUIStore();
  const [editProfile, setEditProfile] = useState(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <>
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-left">
          <h2 className="profile-title">AI Profiles</h2>
          <span className="profile-count">{profiles.length} profiles</span>
        </div>
        <button className="profile-add-btn" onClick={() => { setEditProfile(null); toggleProfileModal(); }}>
          <Plus size={14} />
          <span>Thêm</span>
        </button>
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
                  <span className="profile-item-model">{profile.provider?.model}</span>
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

      {showProfileModal && (
        <ProfileModal
          profile={editProfile}
          onClose={toggleProfileModal}
        />
      )}
    </>
  );
}

// Templates Section
function TemplatesSection() {
  const { templates, isLoading, loadTemplates, deleteTemplate, duplicateTemplate, createTemplate } = useTemplateStore();
  const [editTemplate, setEditTemplate] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = () => {
    setEditTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setEditTemplate(template);
    setShowModal(true);
  };

  const handleImport = async () => {
    try {
      const file = await open({
        filters: [
          { name: 'JSON/Markdown', extensions: ['json', 'md'] }
        ],
        multiple: false,
      });
      
      if (!file) return;
      
      const content = await readTextFile(file);
      
      // Check if it's markdown or JSON
      if (file.endsWith('.md')) {
        // Parse markdown - extract task name from # heading and content
        const lines = content.split('\n');
        const nameMatch = lines.find(l => l.startsWith('# '));
        const name = nameMatch ? nameMatch.replace('# ', '').trim() : 'Imported from MD';
        
        // Remove the heading, use rest as task
        const task = lines.filter(l => !l.startsWith('# ')).join('\n').trim();
        
        await createTemplate({
          name,
          description: 'Imported from Markdown',
          task,
          max_steps: 50,
        });
      } else {
        // JSON
        const data = JSON.parse(content);
        const templatesToImport = Array.isArray(data) ? data : [data];
        
        for (const template of templatesToImport) {
          await createTemplate({
            name: template.name || 'Imported Template',
            description: template.description || '',
            task: template.task || template.prompt || '',
            max_steps: template.max_steps || 50,
          });
        }
      }
      
      loadTemplates();
    } catch (e) {
      console.error('Import failed:', e);
    }
  };

  const handleExport = async () => {
    if (templates.length === 0) return;
    
    try {
      const file = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'templates.json',
      });
      
      if (!file) return;
      
      const exportData = templates.map(t => ({
        name: t.name,
        description: t.description || '',
        task: t.task,
        max_steps: t.max_steps || 50,
      }));
      
      await writeTextFile(file, JSON.stringify(exportData, null, 2));
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-left">
          <h2 className="profile-title">Task Templates</h2>
          <span className="profile-count">{templates.length} templates</span>
        </div>
        <div className="profile-header-actions">
          <button 
            className="profile-import-btn" 
            onClick={handleExport} 
            title="Export JSON"
            disabled={templates.length === 0}
          >
            <Download size={14} />
          </button>
          <button className="profile-import-btn" onClick={handleImport} title="Import JSON/MD">
            <Upload size={14} />
          </button>
          <button className="profile-add-btn" onClick={handleCreate}>
            <Plus size={14} />
            <span>Thêm</span>
          </button>
        </div>
      </div>

      {/* Template List */}
      <div className="template-list">
        {isLoading ? (
          <div className="template-loading">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="profile-empty-state">
            <div className="empty-icon">
              <FileText size={32} />
            </div>
            <p className="empty-title">Chưa có template</p>
            <p className="empty-desc">Tạo template để tái sử dụng các task thường dùng</p>
            <button className="empty-action" onClick={handleCreate}>
              <Plus size={14} />
              Tạo template đầu tiên
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="template-item">
              <div className="template-item-main">
                <div className="template-item-icon">
                  <FileText size={16} />
                </div>
                <div className="template-item-info">
                  <span className="template-item-name">{template.name}</span>
                  <span className="template-item-desc">{template.description || template.task?.slice(0, 60)}</span>
                </div>
              </div>
              <div className="template-item-actions">
                <button
                  className="profile-action-btn"
                  onClick={() => duplicateTemplate(template.id)}
                  title="Nhân bản"
                >
                  <Copy size={12} />
                </button>
                <button
                  className="profile-action-btn"
                  onClick={() => handleEdit(template)}
                  title="Sửa"
                >
                  <Edit size={12} />
                </button>
                <button
                  className="profile-action-btn delete"
                  onClick={() => deleteTemplate(template.id)}
                  title="Xóa"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <TemplateModal
          template={editTemplate}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// Template Modal
function TemplateModal({ template, onClose }) {
  const { createTemplate, updateTemplate } = useTemplateStore();
  const [formData, setFormData] = useState({
    id: template?.id || crypto.randomUUID(),
    name: template?.name || '',
    description: template?.description || '',
    task: template?.task || '',
    max_steps: template?.max_steps || 50,
    tags: template?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Parse markdown file to extract template data
  const parseMarkdownTemplate = (content, fileName) => {
    const lines = content.split('\n');
    let name = fileName.replace(/\.md$/i, '');
    let description = '';
    let task = content;
    
    // Try to extract title from first H1
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      name = h1Match[1].trim();
    }
    
    // Try to extract description from first paragraph after title
    const descMatch = content.match(/^#\s+.+\n+(.+?)(?:\n\n|\n#)/s);
    if (descMatch) {
      description = descMatch[1].trim().slice(0, 200);
    }
    
    // Extract tags from frontmatter or inline tags
    const tags = [];
    const tagMatches = content.match(/tags?:\s*\[([^\]]+)\]/i);
    if (tagMatches) {
      tagMatches[1].split(',').forEach(t => {
        const tag = t.trim().replace(/['"]/g, '');
        if (tag) tags.push(tag);
      });
    }
    
    return { name, description, task, tags };
  };

  const handleImportMd = async () => {
    try {
      setImporting(true);
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      });
      
      if (selected) {
        const content = await readTextFile(selected);
        const fileName = selected.split(/[/\\]/).pop() || 'template';
        const parsed = parseMarkdownTemplate(content, fileName);
        
        setFormData(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          description: parsed.description || prev.description,
          task: parsed.task,
          tags: parsed.tags.length > 0 ? parsed.tags : prev.tags,
        }));
      }
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (template) {
        await updateTemplate(formData);
      } else {
        await createTemplate(formData);
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{template ? 'Sửa Template' : 'Tạo Template Mới'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Import from MD button */}
          <button
            type="button"
            className="btn btn-outline template-import-btn"
            onClick={handleImportMd}
            disabled={importing}
          >
            {importing ? (
              <><RefreshCw size={16} className="spin" /> Đang import...</>
            ) : (
              <><Upload size={16} /> Import từ file .md</>
            )}
          </button>

          <div className="input-group">
            <label className="input-label">Tên Template</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Mở TikTok và like video"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Mô tả (tùy chọn)</label>
            <input
              type="text"
              className="input"
              placeholder="Mô tả ngắn về template này"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Nội dung Task</label>
            <textarea
              className="input textarea"
              placeholder="Nhập chi tiết task cần thực hiện..."
              rows={6}
              value={formData.task}
              onChange={(e) => setFormData({ ...formData, task: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Max Steps</label>
            <input
              type="number"
              className="input"
              min={1}
              max={9999}
              value={formData.max_steps}
              onChange={(e) => setFormData({ ...formData, max_steps: parseInt(e.target.value) || 50 })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Tags</label>
            <div className="template-tags-input">
              <input
                type="text"
                className="input"
                placeholder="Nhập tag và nhấn Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
            </div>
            {formData.tags.length > 0 && (
              <div className="template-tags">
                {formData.tags.map(tag => (
                  <span key={tag} className="template-tag">
                    {tag}
                    <button onClick={() => removeTag(tag)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!formData.name || !formData.task}>
            {template ? 'Cập nhật' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Profile Modal Component
function ProfileModal({ profile, onClose }) {
  const { createProfile, updateProfile } = useProfileStore();
  const [formData, setFormData] = useState({
    id: profile?.id || crypto.randomUUID(),
    name: profile?.name || '',
    provider: profile?.provider || {
      name: 'GoogleGenAI',
      api_key: '',
      model: 'gemini-2.0-flash',
      base_url: null,
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
      const result = await invoke('ping_provider', {
        provider: formData.provider.name,
        apiKey: formData.provider.api_key,
        model: testModel,
        baseUrl: formData.provider.base_url,
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
      const submitData = {
        ...formData,
        provider: {
          ...formData.provider,
          model: selectedProvider?.allowCustomModel ? customModel : formData.provider.model,
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
          <div className="input-group">
            <label className="input-label">Tên Profile</label>
            <input
              type="text"
              className="input"
              placeholder="My Profile"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">AI Provider</label>
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

          {selectedProvider?.allowCustomModel ? (
            <div className="input-group">
              <label className="input-label">Model (tùy chỉnh hoặc chọn sẵn)</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Chọn model --</option>
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
              </div>
              <input
                type="text"
                className="input mt-2"
                placeholder="Hoặc nhập tên model khác..."
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            </div>
          ) : (
            <div className="input-group">
              <label className="input-label">Model</label>
              <select
                className="input"
                value={formData.provider.model}
                onChange={(e) => setFormData({
                  ...formData,
                  provider: { ...formData.provider, model: e.target.value }
                })}
              >
                {selectedProvider?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group">
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
          </div>

          {/* Ping Test Button */}
          <div className="input-group">
            <button
              type="button"
              className={`btn ${pingTesting ? 'btn-secondary' : 'btn-outline'} w-full`}
              onClick={handlePingTest}
              disabled={pingTesting || !formData.provider.api_key}
            >
              {pingTesting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Test Connection
                </>
              )}
            </button>
            {pingResult && (
              <div className={`mt-2 p-2 rounded text-sm ${pingResult.success ? 'bg-success-soft text-success' : 'bg-error-soft text-error'}`}>
                {pingResult.success ? '✓' : '✗'} {pingResult.message}
              </div>
            )}
          </div>

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
              <small className="text-muted">Mặc định: {selectedProvider.defaultBaseUrl}</small>
            </div>
          )}

          {/* DroidRun Options */}
          <div className="input-group">
            <label className="input-label">Tùy chọn DroidRun</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.checked })}
                />
                <span>Vision</span>
                <small className="text-muted">(Phân tích hình ảnh - bắt buộc cho tác vụ cần nhìn giao diện)</small>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.reasoning}
                  onChange={(e) => setFormData({ ...formData, reasoning: e.target.checked })}
                />
                <span>Reasoning</span>
                <small className="text-muted">(AI suy nghĩ kỹ hơn trước khi thực hiện)</small>
              </label>
            </div>
          </div>

          {/* Vision Models */}
          <ModelListEditor
            title="Vision Models"
            description="Models để phân tích hình ảnh màn hình"
            models={formData.vision_models}
            onChange={(models) => setFormData({ ...formData, vision_models: models })}
            providerName={formData.provider.name}
            baseUrl={formData.provider.base_url}
          />

          {/* Executor Models */}
          <ModelListEditor
            title="Executor Models"
            description="Models để thực thi lệnh điều khiển"
            models={formData.executor_models}
            onChange={(models) => setFormData({ ...formData, executor_models: models })}
            providerName={formData.provider.name}
            baseUrl={formData.provider.base_url}
          />
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
