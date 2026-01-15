import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Play,
  Pause,
  X,
  Check,
  ChevronDown,
  Smartphone,
  Repeat,
  Zap,
  FileText,
} from 'lucide-react';
import { useProfileStore, useDeviceStore, useTemplateStore, useSchedulerStore } from '../store';
import { invoke } from '../tauri-mock';

function SchedulerPanel() {
  const { activeProfile, profiles, loadProfiles } = useProfileStore();
  const { devices, refreshDevices } = useDeviceStore();
  const { templates } = useTemplateStore();
  const { scheduledTasks, addSchedule, removeSchedule, toggleSchedule, updateSchedule, runningTaskIds } = useSchedulerStore();
  
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (profiles.length === 0) loadProfiles();
    refreshDevices();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const formatScheduleTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (isToday) return `Hôm nay, ${time}`;
    if (isTomorrow) return `Ngày mai, ${time}`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + `, ${time}`;
  };

  const getRepeatLabel = (repeat) => {
    switch (repeat) {
      case 'daily': return 'Hàng ngày';
      case 'weekly': return 'Hàng tuần';
      default: return null;
    }
  };

  const getNextRun = (task) => {
    const scheduleDate = new Date(task.scheduleTime);
    const now = new Date();
    
    if (scheduleDate > now) return scheduleDate;
    
    if (task.repeat === 'daily') {
      const next = new Date(scheduleDate);
      while (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    
    if (task.repeat === 'weekly') {
      const next = new Date(scheduleDate);
      while (next <= now) {
        next.setDate(next.getDate() + 7);
      }
      return next;
    }
    
    return null;
  };

  return (
    <div className="scheduler-panel">
      {/* Header */}
      <div className="scheduler-header">
        <div className="scheduler-header-info">
          <h2 className="scheduler-title">Lịch trình</h2>
          <div className="scheduler-clock">
            <Clock size={14} />
            <span>{currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
          </div>
        </div>
        <button className="scheduler-add-btn" onClick={handleAdd}>
          <Plus size={16} />
          <span>Thêm mới</span>
        </button>
      </div>

      {/* Schedule List */}
      <div className="scheduler-list">
        {scheduledTasks.length === 0 ? (
          <div className="scheduler-empty">
            <div className="scheduler-empty-icon">
              <Calendar size={40} />
            </div>
            <h3>Chưa có lịch trình</h3>
            <p>Tạo lịch trình để tự động chạy task theo thời gian đã đặt</p>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={16} />
              Tạo lịch trình đầu tiên
            </button>
          </div>
        ) : (
          scheduledTasks.map(task => {
            const isRunning = runningTaskIds.includes(task.id);
            const nextRun = getNextRun(task);
            const isPast = !nextRun && task.repeat === 'none';
            
            return (
              <div 
                key={task.id} 
                className={`schedule-card ${!task.enabled ? 'disabled' : ''} ${isRunning ? 'running' : ''} ${isPast ? 'past' : ''}`}
              >
                <div className="schedule-card-status">
                  {isRunning ? (
                    <div className="schedule-status-dot running" />
                  ) : task.enabled ? (
                    <div className="schedule-status-dot active" />
                  ) : (
                    <div className="schedule-status-dot paused" />
                  )}
                </div>
                
                <div className="schedule-card-content">
                  <div className="schedule-card-header">
                    <h4 className="schedule-name">{task.name}</h4>
                    {task.repeat && task.repeat !== 'none' && (
                      <span className="schedule-repeat-badge">
                        <Repeat size={10} />
                        {getRepeatLabel(task.repeat)}
                      </span>
                    )}
                  </div>
                  
                  <div className="schedule-meta">
                    <span className="schedule-time">
                      <Clock size={12} />
                      {nextRun ? formatScheduleTime(nextRun) : 'Đã hoàn thành'}
                    </span>
                    <span className="schedule-device">
                      <Smartphone size={12} />
                      {task.deviceId?.split(':')[0] || 'Chưa chọn'}
                    </span>
                  </div>
                  
                  {task.prompt && (
                    <p className="schedule-prompt">
                      {task.prompt.length > 80 ? task.prompt.slice(0, 80) + '...' : task.prompt}
                    </p>
                  )}
                </div>
                
                <div className="schedule-card-actions">
                  <button
                    className="schedule-action-btn"
                    onClick={() => handleEdit(task)}
                    title="Sửa"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className={`schedule-action-btn ${task.enabled ? 'pause' : 'play'}`}
                    onClick={() => toggleSchedule(task.id)}
                    title={task.enabled ? 'Tạm dừng' : 'Kích hoạt'}
                  >
                    {task.enabled ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    className="schedule-action-btn delete"
                    onClick={() => removeSchedule(task.id)}
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ScheduleModal
          task={editingTask}
          templates={templates}
          devices={devices}
          activeProfile={activeProfile}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSave={async (data) => {
            if (editingTask) {
              updateSchedule(editingTask.id, data);
            } else {
              await addSchedule({ ...data, profile: activeProfile });
            }
            setShowModal(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

// Schedule Modal Component
function ScheduleModal({ task, templates, devices, activeProfile, onClose, onSave }) {
  const getDefaultTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    name: task?.name || '',
    templateId: task?.templateId || '',
    customPrompt: task?.taskSource === 'custom' ? task?.prompt : '',
    taskSource: task?.taskSource || 'template',
    deviceId: task?.deviceId || '',
    scheduleTime: task?.scheduleTime || getDefaultTime(),
    repeat: task?.repeat || 'none',
  });

  const selectedTemplate = templates.find(t => t.id === form.templateId);

  const handleSubmit = () => {
    let prompt = '';
    let name = form.name;

    if (form.taskSource === 'template' && selectedTemplate) {
      prompt = selectedTemplate.task || selectedTemplate.prompt || '';
      if (!name) name = selectedTemplate.name;
    } else if (form.taskSource === 'custom') {
      prompt = form.customPrompt;
      if (!name) name = 'Task tùy chỉnh';
    }

    if (!prompt.trim()) {
      alert('Vui lòng chọn template hoặc nhập nội dung task');
      return;
    }
    if (!form.deviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }
    if (!form.scheduleTime) {
      alert('Vui lòng chọn thời gian');
      return;
    }

    onSave({
      name,
      prompt,
      deviceId: form.deviceId,
      scheduleTime: form.scheduleTime,
      repeat: form.repeat,
      taskSource: form.taskSource,
      templateId: form.templateId,
      enabled: task?.enabled !== false,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal schedule-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {task ? 'Sửa lịch trình' : 'Tạo lịch trình mới'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Name */}
          <div className="input-group">
            <label className="input-label">Tên (tùy chọn)</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Chạy TikTok buổi sáng"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Task Source Toggle */}
          <div className="input-group">
            <label className="input-label">Nguồn task</label>
            <div className="schedule-source-toggle">
              <button
                type="button"
                className={`schedule-source-btn ${form.taskSource === 'template' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, taskSource: 'template' })}
              >
                <FileText size={14} />
                Template
              </button>
              <button
                type="button"
                className={`schedule-source-btn ${form.taskSource === 'custom' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, taskSource: 'custom' })}
              >
                <Zap size={14} />
                Tùy chỉnh
              </button>
            </div>
          </div>

          {/* Template Select */}
          {form.taskSource === 'template' && (
            <div className="input-group">
              <label className="input-label">Chọn Template</label>
              {templates.length === 0 ? (
                <p className="input-hint">Chưa có template. Tạo trong Profiles → Templates</p>
              ) : (
                <select
                  className="input"
                  value={form.templateId}
                  onChange={e => setForm({ ...form, templateId: e.target.value })}
                >
                  <option value="">-- Chọn template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              {selectedTemplate && (
                <div className="schedule-template-preview">
                  {selectedTemplate.task?.slice(0, 150) || selectedTemplate.description}
                  {selectedTemplate.task?.length > 150 && '...'}
                </div>
              )}
            </div>
          )}

          {/* Custom Prompt */}
          {form.taskSource === 'custom' && (
            <div className="input-group">
              <label className="input-label">Nội dung task</label>
              <textarea
                className="input textarea"
                rows={3}
                placeholder="Mô tả nhiệm vụ AI cần thực hiện..."
                value={form.customPrompt}
                onChange={e => setForm({ ...form, customPrompt: e.target.value })}
              />
            </div>
          )}

          {/* Device */}
          <div className="input-group">
            <label className="input-label">Thiết bị</label>
            <select
              className="input"
              value={form.deviceId}
              onChange={e => setForm({ ...form, deviceId: e.target.value })}
            >
              <option value="">-- Chọn thiết bị --</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.model || d.id.split(':')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Time */}
          <div className="schedule-time-row">
            <div className="input-group" style={{ flex: 2 }}>
              <label className="input-label">Thời gian</label>
              <input
                type="datetime-local"
                className="input"
                value={form.scheduleTime}
                onChange={e => setForm({ ...form, scheduleTime: e.target.value })}
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Lặp lại</label>
              <select
                className="input"
                value={form.repeat}
                onChange={e => setForm({ ...form, repeat: e.target.value })}
              >
                <option value="none">Một lần</option>
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
              </select>
            </div>
          </div>

          {/* Profile Info */}
          {!activeProfile && (
            <div className="schedule-warning">
              ⚠️ Chưa chọn profile. Vui lòng chọn profile trong tab Profiles
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={!activeProfile}
          >
            <Check size={16} />
            {task ? 'Lưu' : 'Tạo lịch trình'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchedulerPanel;
