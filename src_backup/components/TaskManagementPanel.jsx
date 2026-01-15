// TaskManagementPanel - Quản lý các task templates
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Layers, Sparkles } from 'lucide-react';
import { useTaskTemplateStore, useProfileStore } from '../store';
import { invoke } from '../tauri-mock';

// Enhance Prompt Button Component
function EnhancePromptButton({ prompt, onEnhanced, profile, disabled }) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!prompt?.trim() || !profile) return;
    
    setIsEnhancing(true);
    try {
      const enhanced = await invoke('enhance_prompt', {
        provider: profile.provider?.name || profile.provider,
        apiKey: profile.provider?.api_key || profile.api_key,
        model: profile.provider?.model || profile.model,
        prompt: prompt.trim(),
        baseUrl: profile.provider?.base_url || profile.base_url || null,
      });
      if (enhanced && enhanced.trim()) {
        onEnhanced(enhanced);
      } else {
        alert('Không nhận được phản hồi từ AI');
      }
    } catch (e) {
      console.error('Failed to enhance prompt:', e);
      alert(`Lỗi nâng cao prompt: ${e}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleEnhance}
      disabled={disabled || isEnhancing || !prompt?.trim() || !profile}
      title="Nâng cao lời nhắc - Sử dụng AI để biến prompt đơn giản thành chi tiết, rõ ràng từng bước"
      style={{ minWidth: '36px' }}
    >
      {isEnhancing ? (
        <div className="spinner" style={{ width: '14px', height: '14px' }} />
      ) : (
        <Sparkles size={14} />
      )}
    </button>
  );
}

export default function TaskManagementPanel() {
  const { templates, addTemplate, updateTemplate, removeTemplate } = useTaskTemplateStore();
  const { activeProfile } = useProfileStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
  });

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.prompt.trim()) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (editingId) {
      updateTemplate(editingId, formData);
    } else {
      addTemplate(formData);
    }

    setFormData({ name: '', prompt: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (template) => {
    setFormData({ name: template.name, prompt: template.prompt });
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', prompt: '' });
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Quản lý Task Templates</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} />
          Tạo Task mới
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="card-title mb-3">{editingId ? 'Sửa Task' : 'Tạo Task mới'}</h3>

          <div className="input-group">
            <label className="input-label">Tên Task</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Kiểm tra email, Mở Facebook..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <div className="flex justify-between items-center">
              <label className="input-label">Prompt / Nhiệm vụ</label>
              {activeProfile && (
                <EnhancePromptButton
                  prompt={formData.prompt}
                  onEnhanced={(enhanced) => setFormData({ ...formData, prompt: enhanced })}
                  profile={activeProfile}
                />
              )}
            </div>
            <textarea
              className="task-textarea"
              rows={4}
              placeholder="Mô tả chi tiết nhiệm vụ AI cần thực hiện trên thiết bị Android..."
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            />
            {!activeProfile && (
              <p className="text-warning text-xs mt-1">⚠ Cần tạo Profile AI để sử dụng nâng cao lời nhắc</p>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Hủy
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingId ? 'Cập nhật' : 'Tạo Task'}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm ? (
        <div className="card text-center text-muted">
          <Layers size={48} className="mb-3" style={{ margin: '0 auto' }} />
          <p>Chưa có task template nào</p>
          <p className="text-muted mt-2">Tạo các task để có thể tái sử dụng trong Lịch trình và Thực thi</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {templates.map((template) => (
            <div key={template.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{template.name}</h4>
                <div className="flex gap-1">
                  <button
                    className="btn btn-icon btn-secondary"
                    onClick={() => handleEdit(template)}
                    title="Sửa"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={() => removeTemplate(template.id)}
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-muted text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                {template.prompt.length > 150 ? template.prompt.substring(0, 150) + '...' : template.prompt}
              </p>
              <div className="text-muted text-xs mt-2">
                Tạo lúc: {new Date(template.createdAt).toLocaleString('vi-VN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
