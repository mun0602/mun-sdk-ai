import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Edit3,
  Copy,
  Trash2,
  X,
  Check,
  Download,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Hand,
  Compass,
  Keyboard,
  Clock,
  Smartphone,
  Key,
  ArrowLeft,
  List,
  XCircle,
  Timer,
  MousePointer,
  Power,
  ToggleLeft,
  ToggleRight,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSkillStore, SKILL_CATEGORIES } from '../store';

// Icon mapping for skills
const ICON_MAP = {
  hand: Hand,
  pointer: MousePointer,
  timer: Timer,
  compass: Compass,
  search: Search,
  'arrow-left': ArrowLeft,
  keyboard: Keyboard,
  list: List,
  clock: Clock,
  smartphone: Smartphone,
  'x-circle': XCircle,
  key: Key,
  sparkles: Sparkles,
};

// Skill Guidance Card Component
function SkillCard({ skill, onEdit, onDuplicate, onDelete, onToggle }) {
  const IconComponent = ICON_MAP[skill.icon] || Sparkles;
  const category = SKILL_CATEGORIES[skill.category] || SKILL_CATEGORIES.custom;

  return (
    <div className={`skill-card ${skill.isEnabled ? '' : 'skill-card--disabled'}`}>
      <div className="skill-card__header">
        {/* Toggle Switch */}
        <button
          className={`skill-card__toggle ${skill.isEnabled ? 'skill-card__toggle--on' : ''}`}
          onClick={() => onToggle(skill.id)}
          title={skill.isEnabled ? 'Tắt' : 'Bật'}
        >
          {skill.isEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>

        <div className="skill-card__info">
          <div className="skill-card__title-row">
            <h3 className="skill-card__name">{skill.name}</h3>
            {skill.isBuiltin && (
              <span className="skill-card__builtin" title="Mặc định">
                <Sparkles size={10} />
              </span>
            )}
          </div>
          <span
            className="skill-card__category"
            style={{ background: `${category.color}15`, color: category.color }}
          >
            {category.label}
          </span>
        </div>

        {/* Actions */}
        <div className="skill-card__actions">
          <button
            className="skill-card__action"
            onClick={() => onEdit(skill)}
            title="Sửa"
          >
            <Edit3 size={14} />
          </button>
          <button
            className="skill-card__action"
            onClick={() => onDuplicate(skill.id)}
            title="Nhân bản"
          >
            <Copy size={14} />
          </button>
          <button
            className="skill-card__action skill-card__action--danger"
            onClick={() => {
              if (window.confirm(`Xóa skill "${skill.name}"?`)) {
                onDelete(skill.id);
              }
            }}
            title="Xóa"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <p className="skill-card__desc">{skill.description}</p>
    </div>
  );
}

// Skill Editor Modal
function SkillEditorModal({ skill, onClose, onSave }) {
  const isEditing = !!skill;
  const [formData, setFormData] = useState({
    name: skill?.name || '',
    description: skill?.description || '',
    icon: skill?.icon || 'sparkles',
    color: skill?.color || '#4f6ef7',
    category: skill?.category || 'custom',
    guidance: skill?.guidance || '',
    examples: skill?.examples || [''],
    priority: skill?.priority || 5,
    isEnabled: skill?.isEnabled !== false,
  });

  const handleSave = () => {
    if (!formData.name || !formData.guidance) {
      alert('Vui lòng điền tên và hướng dẫn');
      return;
    }
    // Filter empty examples
    const cleanedExamples = formData.examples.filter(e => e.trim());
    onSave({ ...formData, examples: cleanedExamples }, skill?.id);
    onClose();
  };

  const updateExample = (index, value) => {
    const newExamples = [...formData.examples];
    newExamples[index] = value;
    setFormData({ ...formData, examples: newExamples });
  };

  const addExample = () => {
    setFormData({ ...formData, examples: [...formData.examples, ''] });
  };

  const removeExample = (index) => {
    setFormData({
      ...formData,
      examples: formData.examples.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="skill-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="skill-editor__header">
          <h2>{isEditing ? 'Chỉnh sửa Hướng dẫn AI' : 'Tạo Hướng dẫn AI mới'}</h2>
          <button className="skill-editor__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="skill-editor__body">
          {/* Basic Info */}
          <div className="skill-editor__section">
            <h3 className="skill-editor__section-title">Thông tin cơ bản</h3>

            <div className="skill-editor__row">
              <div className="skill-editor__field" style={{ flex: 2 }}>
                <label>Tên hướng dẫn</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Vuốt màn hình"
                />
              </div>
              <div className="skill-editor__field">
                <label>Phân loại</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {Object.entries(SKILL_CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="skill-editor__field">
              <label>Mô tả ngắn</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn gọn hướng dẫn này làm gì..."
              />
            </div>

            <div className="skill-editor__row">
              <div className="skill-editor__field">
                <label>Icon</label>
                <select
                  value={formData.icon}
                  onChange={e => setFormData({ ...formData, icon: e.target.value })}
                >
                  <option value="sparkles">✨ Sparkles</option>
                  <option value="hand">✋ Hand</option>
                  <option value="pointer">👆 Pointer</option>
                  <option value="timer">⏱️ Timer</option>
                  <option value="compass">🧭 Compass</option>
                  <option value="search">🔍 Search</option>
                  <option value="keyboard">⌨️ Keyboard</option>
                  <option value="clock">🕐 Clock</option>
                  <option value="smartphone">📱 Smartphone</option>
                  <option value="key">🔑 Key</option>
                </select>
              </div>
              <div className="skill-editor__field">
                <label>Màu sắc</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
              <div className="skill-editor__field">
                <label>Độ ưu tiên (1-10)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                  min={1}
                  max={10}
                />
              </div>
            </div>
          </div>

          {/* Guidance Content */}
          <div className="skill-editor__section">
            <h3 className="skill-editor__section-title">
              Nội dung hướng dẫn
              <span className="skill-editor__hint">
                Viết các tips/hướng dẫn để AI thực hiện tốt hơn
              </span>
            </h3>
            <textarea
              className="skill-editor__guidance"
              value={formData.guidance}
              onChange={e => setFormData({ ...formData, guidance: e.target.value })}
              placeholder={`Khi cần thực hiện thao tác này:
- Bước 1: ...
- Bước 2: ...
- Lưu ý: ...
- Nếu gặp lỗi: ...`}
              rows={10}
            />
          </div>

          {/* Examples */}
          <div className="skill-editor__section">
            <h3 className="skill-editor__section-title">
              Ví dụ áp dụng
              <span className="skill-editor__hint">Các trường hợp sử dụng hướng dẫn này</span>
            </h3>
            <div className="skill-editor__examples">
              {formData.examples.map((example, index) => (
                <div key={index} className="skill-editor__example-row">
                  <input
                    type="text"
                    value={example}
                    onChange={e => updateExample(index, e.target.value)}
                    placeholder={`Ví dụ ${index + 1}...`}
                  />
                  <button
                    className="skill-editor__example-remove"
                    onClick={() => removeExample(index)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addExample}>
                <Plus size={14} /> Thêm ví dụ
              </button>
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="skill-editor__section">
            <label className="skill-editor__toggle-row">
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
              />
              <span>Bật hướng dẫn này (sẽ được thêm vào prompt khi chạy task)</span>
            </label>
          </div>
        </div>

        <div className="skill-editor__footer">
          <button className="skills-btn skills-btn--secondary" onClick={onClose}>Hủy</button>
          <button className="skills-btn skills-btn--primary" onClick={handleSave}>
            {isEditing ? 'Cập nhật' : 'Tạo mới'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Guidance Preview Modal
function GuidancePreviewModal({ onClose }) {
  const { compileGuidance, getGuidanceSummary, getEnabledSkills } = useSkillStore();
  const guidance = compileGuidance();
  const enabledCount = getEnabledSkills().length;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(guidance);
    alert('Đã copy hướng dẫn!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="guidance-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="guidance-preview__header">
          <h2>
            <FileText size={20} />
            Preview Guidance ({enabledCount} skills đang bật)
          </h2>
          <button className="guidance-preview__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="guidance-preview__body">
          {guidance ? (
            <pre className="guidance-preview__content">{guidance}</pre>
          ) : (
            <div className="guidance-preview__empty">
              <Power size={40} />
              <p>Không có hướng dẫn nào được bật</p>
              <span>Bật các skill để xem preview</span>
            </div>
          )}
        </div>
        <div className="guidance-preview__footer">
          <button className="skills-btn skills-btn--secondary" onClick={onClose}>
            Đóng
          </button>
          <button
            className="skills-btn skills-btn--primary"
            onClick={copyToClipboard}
            disabled={!guidance}
          >
            <Copy size={16} />
            Copy Guidance
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Skills Panel
export default function SkillsPanel() {
  const {
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    duplicateSkill,
    toggleSkill,
    toggleAllSkills,
    getEnabledSkills,
    exportSkills,
    exportSelectedSkills,
    importSkills,
    resetToDefaults,
  } = useSkillStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingSkill, setEditingSkill] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);

  const fileInputRef = useRef(null);

  const enabledSkills = getEnabledSkills();

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSaveSkill = (data, existingId) => {
    if (existingId) {
      updateSkill(existingId, data);
    } else {
      addSkill(data);
    }
  };

  const handleExport = () => {
    const json = exportSkills();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_guidance_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const count = importSkills(event.target.result);
      if (count > 0) {
        alert(`Đã import ${count} hướng dẫn!`);
      } else {
        alert('Không thể import. Kiểm tra định dạng file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="skills-panel">
      {/* Header */}
      <div className="skills-header">
        <div className="skills-header__left">
          <div className="skills-header__title">
            <Sparkles size={22} />
            AI Guidance
            <span className="skills-header__count">{skills.length}</span>
            <span className="skills-header__enabled">
              ({enabledSkills.length} đang bật)
            </span>
          </div>

          <div className="skills-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm hướng dẫn..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="skills-header__actions">
          <button
            className="skills-btn skills-btn--secondary"
            onClick={() => setShowPreview(true)}
            title="Xem preview tất cả guidance"
          >
            <Eye size={16} />
            Preview
          </button>
          <button
            className="skills-btn skills-btn--ghost"
            onClick={() => toggleAllSkills(true)}
            title="Bật tất cả"
          >
            <ToggleRight size={16} />
          </button>
          <button
            className="skills-btn skills-btn--ghost"
            onClick={() => toggleAllSkills(false)}
            title="Tắt tất cả"
          >
            <ToggleLeft size={16} />
          </button>
          <button
            className="skills-btn skills-btn--ghost"
            onClick={handleExport}
            title="Export"
          >
            <Upload size={16} />
          </button>
          <button
            className="skills-btn skills-btn--ghost"
            onClick={() => fileInputRef.current?.click()}
            title="Import"
          >
            <Download size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className="skills-btn skills-btn--primary"
            onClick={() => { setEditingSkill(null); setShowEditor(true); }}
          >
            <Plus size={16} />
            Thêm Hướng dẫn
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="skills-content">
        <div className="skills-filters">
          <button
            className={`skills-filter ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Tất cả
            <span className="skills-filter__count">{skills.length}</span>
          </button>
          {Object.entries(SKILL_CATEGORIES).map(([key, cat]) => {
            const count = skills.filter(s => s.category === key).length;
            return (
              <button
                key={key}
                className={`skills-filter ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(key)}
              >
                {cat.label}
                {count > 0 && <span className="skills-filter__count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Info Banner */}
        <div className="skills-info-banner">
          <Sparkles size={16} />
          <span>
            Các hướng dẫn được bật sẽ tự động thêm vào prompt khi AI thực hiện task,
            giúp AI hiểu cách thao tác tốt hơn.
          </span>
        </div>

        {/* Skills Grid */}
        <div className="skills-grid">
          {filteredSkills.length === 0 ? (
            <div className="skills-empty">
              <div className="skills-empty__icon">
                <Sparkles size={40} />
              </div>
              <h3>Chưa có hướng dẫn nào</h3>
              <p>Tạo hướng dẫn để giúp AI thực hiện tốt hơn các thao tác trên Android</p>
              <button
                className="skills-btn skills-btn--primary"
                onClick={() => { setEditingSkill(null); setShowEditor(true); }}
              >
                <Plus size={16} />
                Thêm Hướng dẫn mới
              </button>
            </div>
          ) : (
            filteredSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={(s) => { setEditingSkill(s); setShowEditor(true); }}
                onDuplicate={duplicateSkill}
                onDelete={deleteSkill}
                onToggle={toggleSkill}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showEditor && (
        <SkillEditorModal
          skill={editingSkill}
          onClose={() => { setShowEditor(false); setEditingSkill(null); }}
          onSave={handleSaveSkill}
        />
      )}

      {showPreview && (
        <GuidancePreviewModal onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
