// ModelListEditor - Cho phép thêm/xóa models trong profile
import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function ModelListEditor({ title, description, models, onChange, providerName, baseUrl }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newModel, setNewModel] = useState({ id: '', name: '' });

  const handleAdd = () => {
    if (!newModel.id.trim()) return;
    const model = {
      id: newModel.id.trim(),
      name: newModel.name.trim() || newModel.id.trim(),
      provider: providerName,
      baseUrl: baseUrl || null,
    };
    onChange([...models, model]);
    setNewModel({ id: '', name: '' });
    setShowAdd(false);
  };

  const handleRemove = (modelId) => {
    onChange(models.filter(m => m.id !== modelId));
  };

  return (
    <div className="input-group">
      <div className="model-list-header">
        <div>
          <label className="input-label">{title}</label>
          <small className="text-muted">{description}</small>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus size={14} />
          Thêm
        </button>
      </div>

      {showAdd && (
        <div className="model-add-form">
          <input
            type="text"
            className="input input-sm"
            placeholder="Model ID (bắt buộc)"
            value={newModel.id}
            onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
          />
          <input
            type="text"
            className="input input-sm"
            placeholder="Tên hiển thị (tùy chọn)"
            value={newModel.name}
            onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
          />
          <div className="model-add-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAdd(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleAdd} disabled={!newModel.id.trim()}>
              Thêm
            </button>
          </div>
        </div>
      )}

      <div className="model-list">
        {models.length === 0 ? (
          <div className="model-empty">Chưa có model nào</div>
        ) : (
          models.map((model) => (
            <div key={model.id} className="model-item">
              <div className="model-item-info">
                <span className="model-item-name">{model.name}</span>
                <span className="model-item-id">{model.id}</span>
              </div>
              <button
                type="button"
                className="model-item-remove"
                onClick={() => handleRemove(model.id)}
                title="Xóa model"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
