import React, { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  Check,
  Trash2,
  Edit2,
  Play,
  Pause,
  Monitor,
  Sparkles,
  Clock,
  Repeat,
  Smartphone,
  X,
  ChevronDown,
  Zap,
  Square,
} from 'lucide-react';
import { useProfileStore, useDeviceStore, useSkillStore, useSchedulerStore, useEmulatorStore, useWorkflowStore } from '../store';
import { invoke } from '../tauri-mock';
import { getModelDisplayName } from '../constants/providers';

// Scheduler Panel - Clean Minimalist Design
function SchedulerPanel() {
  const { activeProfile, profiles, loadProfiles } = useProfileStore();
  const { devices } = useDeviceStore();
  const { skills, compilePrompt } = useSkillStore();
  const { scheduledTasks, addSchedule, removeSchedule, toggleSchedule, updateSchedule, runningTaskIds, logs, clearLogs, stopScheduledTask } = useSchedulerStore();
  const { instances, isMumuInstalled, checkMumuInstalled, getInstances } = useEmulatorStore();
  const { workflows } = useWorkflowStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  const formatTime24h = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', { 
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatTimeOnly = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getDefaultScheduleTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [skillVariables, setSkillVariables] = useState({});
  const [showLogs, setShowLogs] = useState(false);
  const [formData, setFormData] = useState({
    taskId: '',
    workflowId: '',
    customPrompt: '',
    taskSource: 'skill',
    deviceIds: [], // Changed to array for multi-select
    scheduleTime: '',
    repeat: 'none',
    emulatorIndex: '',
    autoShutdown: true,
    profileId: '', // Profile/Model to use for this schedule
  });

  const resetForm = () => {
    setFormData({
      taskId: '',
      workflowId: '',
      customPrompt: '',
      taskSource: 'skill',
      deviceIds: [],
      scheduleTime: getDefaultScheduleTime(),
      repeat: 'none',
      emulatorIndex: '',
      autoShutdown: true,
      profileId: activeProfile?.id || '',
    });
    setSkillVariables({});
    setEditingTaskId(null);
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task.id);
    setFormData({
      taskId: task.taskId || '',
      workflowId: task.workflowId || '',
      customPrompt: task.taskSource === 'custom' ? task.prompt : '',
      taskSource: task.taskSource || 'skill',
      deviceIds: task.deviceIds || (task.deviceId ? [task.deviceId] : []),
      scheduleTime: task.scheduleTime || getDefaultScheduleTime(),
      repeat: task.repeat || 'none',
      emulatorIndex: task.emulatorIndex || '',
      autoShutdown: task.autoShutdown !== false,
      profileId: task.profileId || task.profile?.id || '',
    });
    setSkillVariables(task.skillVariables || {});
    setShowForm(true);
  };

  useEffect(() => {
    if (profiles.length === 0) loadProfiles();
  }, [profiles.length]);

  useEffect(() => {
    if (showForm) {
      checkMumuInstalled();
      if (!formData.scheduleTime) {
        setFormData(prev => ({ ...prev, scheduleTime: getDefaultScheduleTime() }));
      }
      if (isMumuInstalled) getInstances();
    }
  }, [showForm, isMumuInstalled]);

  const selectedSkill = skills.find(s => s.id === formData.taskId);
  const selectedWorkflow = workflows.find(m => m.id === formData.workflowId);

  useEffect(() => {
    if (selectedSkill && formData.taskSource === 'skill') {
      const defaultVars = {};
      selectedSkill.variables.forEach(v => {
        defaultVars[v.name] = skillVariables[v.name] ?? v.default;
      });
      setSkillVariables(defaultVars);
    }
  }, [formData.taskId, formData.taskSource]);

  const handleAddSchedule = async () => {
    let promptToUse = '';
    let taskName = '';

    if (formData.taskSource === 'skill') {
      promptToUse = compilePrompt(formData.taskId, skillVariables);
      taskName = selectedSkill?.name || 'Skill';
    } else if (formData.taskSource === 'macro') {
      promptToUse = `[WORKFLOW] ${selectedWorkflow?.name || 'Unknown'}`;
      taskName = `Workflow: ${selectedWorkflow?.name || 'Unknown'}`;
    } else {
      promptToUse = formData.customPrompt;
      taskName = 'Custom Task';
    }

    if (!promptToUse?.trim() && formData.taskSource !== 'macro') {
      alert('Vui lòng chọn task hoặc nhập prompt');
      return;
    }
    if (formData.taskSource === 'macro' && !selectedWorkflow) {
      alert('Vui lòng chọn workflow');
      return;
    }
    if (formData.deviceIds.length === 0 && !formData.emulatorIndex) {
      alert('Vui lòng chọn ít nhất một thiết bị');
      return;
    }
    if (!formData.scheduleTime) {
      alert('Vui lòng chọn thời gian');
      return;
    }
    if (!activeProfile && !editingTaskId && !formData.profileId) {
      alert('Vui lòng chọn profile trước');
      return;
    }

    // Get the selected profile or use active profile
    const selectedProfile = formData.profileId 
      ? profiles.find(p => p.id === formData.profileId) 
      : activeProfile;

    try {
      // Create schedule for each selected device
      const deviceIds = formData.deviceIds.length > 0 
        ? formData.deviceIds 
        : [`emulator-${formData.emulatorIndex}`];
      
      if (editingTaskId) {
        updateSchedule(editingTaskId, {
          name: taskName,
          prompt: promptToUse,
          deviceIds,
          scheduleTime: formData.scheduleTime,
          repeat: formData.repeat,
          emulatorIndex: formData.emulatorIndex,
          workflowId: formData.taskSource === 'macro' ? formData.workflowId : null,
          taskId: formData.taskSource === 'skill' ? formData.taskId : null,
          taskSource: formData.taskSource,
          skillVariables: formData.taskSource === 'skill' ? skillVariables : null,
          autoShutdown: formData.autoShutdown,
          profileId: formData.profileId || null,
          profile: selectedProfile,
        });
      } else {
        await addSchedule({
          name: taskName,
          prompt: promptToUse,
          deviceIds,
          scheduleTime: formData.scheduleTime,
          repeat: formData.repeat,
          profile: selectedProfile,
          profileId: formData.profileId || null,
          emulatorIndex: formData.emulatorIndex,
          workflowId: formData.taskSource === 'macro' ? formData.workflowId : null,
          taskId: formData.taskSource === 'skill' ? formData.taskId : null,
          taskSource: formData.taskSource,
          skillVariables: formData.taskSource === 'skill' ? skillVariables : null,
          autoShutdown: formData.autoShutdown,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (error) {
      alert('Lỗi: ' + (error?.message || error));
    }
  };

  const getRepeatLabel = (repeat) => {
    if (!repeat || repeat === 'none') return null;
    return repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần';
  };

  const activeCount = scheduledTasks.filter(t => t.enabled).length;
  const runningCount = runningTaskIds.length;

  return (
    <div className="scheduler-panel">
      {/* Header */}
      <div className="scheduler-header">
        <div className="scheduler-header-left">
          <h2 className="scheduler-title">Lịch trình</h2>
          <div className="scheduler-stats">
            <span className="scheduler-stat">
              <Clock size={14} />
              {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            {activeCount > 0 && (
              <span className="scheduler-stat scheduler-stat--active">
                <Zap size={14} />
                {activeCount} đang hoạt động
              </span>
            )}
            {runningCount > 0 && (
              <span className="scheduler-stat scheduler-stat--running">
                <Play size={14} />
                {runningCount} đang chạy
              </span>
            )}
          </div>
        </div>
        <div className="scheduler-header-actions">
          <button 
            className="scheduler-btn scheduler-btn--ghost"
            onClick={() => setShowLogs(!showLogs)}
          >
            Log {logs.length > 0 && <span className="scheduler-badge">{logs.length}</span>}
          </button>
          <button 
            className="scheduler-btn scheduler-btn--primary"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            <Plus size={16} />
            Thêm mới
          </button>
        </div>
      </div>

      {/* Logs Panel - Collapsible */}
      {showLogs && (
        <div className="scheduler-logs">
          <div className="scheduler-logs-header">
            <span>Activity Log</span>
            <button className="scheduler-btn scheduler-btn--xs" onClick={clearLogs}>Clear</button>
          </div>
          <div className="scheduler-logs-content">
            {logs.length === 0 ? (
              <div className="scheduler-logs-empty">Chưa có hoạt động</div>
            ) : (
              logs.slice(-8).map((log, i) => (
                <div key={i} className={`scheduler-log scheduler-log--${log.type}`}>
                  <span className="scheduler-log-time">
                    {log.time.toLocaleTimeString('vi-VN', { hour12: false })}
                  </span>
                  <span className="scheduler-log-msg">{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="scheduler-modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="scheduler-modal" onClick={e => e.stopPropagation()}>
            <div className="scheduler-modal-header">
              <h3>{editingTaskId ? 'Chỉnh sửa' : 'Tạo lịch trình'}</h3>
              <button className="scheduler-btn scheduler-btn--icon" onClick={() => { setShowForm(false); resetForm(); }}>
                <X size={18} />
              </button>
            </div>

            <div className="scheduler-modal-body">
              {/* Task Source Tabs */}
              <div className="scheduler-tabs">
                <button 
                  className={`scheduler-tab ${formData.taskSource === 'skill' ? 'scheduler-tab--active' : ''}`}
                  onClick={() => setFormData({ ...formData, taskSource: 'skill' })}
                >
                  <Sparkles size={14} />
                  Skill
                </button>
                <button 
                  className={`scheduler-tab ${formData.taskSource === 'macro' ? 'scheduler-tab--active' : ''}`}
                  onClick={() => setFormData({ ...formData, taskSource: 'macro' })}
                >
                  <Play size={14} />
                  Workflow
                </button>
                <button 
                  className={`scheduler-tab ${formData.taskSource === 'custom' ? 'scheduler-tab--active' : ''}`}
                  onClick={() => setFormData({ ...formData, taskSource: 'custom' })}
                >
                  <Edit2 size={14} />
                  Custom
                </button>
              </div>

              {/* Skill Selection */}
              {formData.taskSource === 'skill' && (
                <div className="scheduler-field">
                  {skills.length === 0 ? (
                    <div className="scheduler-empty-hint">Chưa có skill. Tạo trong tab Skills.</div>
                  ) : (
                    <>
                      <select
                        className="scheduler-select"
                        value={formData.taskId}
                        onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                      >
                        <option value="">Chọn skill...</option>
                        {skills.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      
                      {selectedSkill && selectedSkill.variables.length > 0 && (
                        <div className="scheduler-variables">
                          {selectedSkill.variables.map(v => (
                            <div key={v.id} className="scheduler-var">
                              <label>{v.label}</label>
                              {v.type === 'boolean' ? (
                                <input
                                  type="checkbox"
                                  checked={skillVariables[v.name] ?? v.default}
                                  onChange={(e) => setSkillVariables({...skillVariables, [v.name]: e.target.checked})}
                                />
                              ) : v.type === 'number' ? (
                                <input
                                  type="number"
                                  className="scheduler-input scheduler-input--sm"
                                  value={skillVariables[v.name] ?? v.default}
                                  onChange={(e) => setSkillVariables({...skillVariables, [v.name]: Number(e.target.value)})}
                                  min={v.min}
                                  max={v.max}
                                />
                              ) : v.type === 'select' ? (
                                <select
                                  className="scheduler-select scheduler-select--sm"
                                  value={skillVariables[v.name] ?? v.default}
                                  onChange={(e) => setSkillVariables({...skillVariables, [v.name]: e.target.value})}
                                >
                                  {v.options?.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  className="scheduler-input scheduler-input--sm"
                                  value={skillVariables[v.name] ?? v.default}
                                  onChange={(e) => setSkillVariables({...skillVariables, [v.name]: e.target.value})}
                                  placeholder={v.placeholder}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Workflow Selection */}
              {formData.taskSource === 'macro' && (
                <div className="scheduler-field">
                  {workflows.length === 0 ? (
                    <div className="scheduler-empty-hint">Chưa có workflow. Ghi trong tab Workflow.</div>
                  ) : (
                    <select
                      className="scheduler-select"
                      value={formData.workflowId}
                      onChange={(e) => setFormData({ ...formData, workflowId: e.target.value })}
                    >
                      <option value="">Chọn workflow...</option>
                      {workflows.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.action_count || m.actions?.length || 0} actions)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Custom Prompt */}
              {formData.taskSource === 'custom' && (
                <div className="scheduler-field">
                  <textarea
                    className="scheduler-textarea"
                    rows={3}
                    placeholder="Nhập prompt cho AI..."
                    value={formData.customPrompt}
                    onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                  />
                </div>
              )}

              {/* Device & Time Row */}
              <div className="scheduler-row">
                <div className="scheduler-field scheduler-field--half">
                  <label className="scheduler-label">
                    <Smartphone size={14} />
                    Thiết bị ({formData.deviceIds.length} đã chọn)
                  </label>
                  <div className="scheduler-device-list">
                    {devices.length === 0 ? (
                      <div className="scheduler-empty-hint">Không có thiết bị nào</div>
                    ) : (
                      <>
                        <label className="scheduler-device-item scheduler-device-item--all">
                          <input
                            type="checkbox"
                            checked={formData.deviceIds.length === devices.length && devices.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, deviceIds: devices.map(d => d.id) });
                              } else {
                                setFormData({ ...formData, deviceIds: [] });
                              }
                            }}
                          />
                          <span>Tất cả ({devices.length})</span>
                        </label>
                        {devices.map(d => (
                          <label key={d.id} className="scheduler-device-item">
                            <input
                              type="checkbox"
                              checked={formData.deviceIds.includes(d.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, deviceIds: [...formData.deviceIds, d.id] });
                                } else {
                                  setFormData({ ...formData, deviceIds: formData.deviceIds.filter(id => id !== d.id) });
                                }
                              }}
                            />
                            <span>{d.model || d.id}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="scheduler-field scheduler-field--half">
                  <label className="scheduler-label">
                    <Clock size={14} />
                    Thời gian
                  </label>
                  <input
                    type="datetime-local"
                    className="scheduler-input"
                    value={formData.scheduleTime}
                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                  />
                </div>
              </div>

              {/* Repeat & Emulator Row */}
              <div className="scheduler-row">
                <div className="scheduler-field scheduler-field--half">
                  <label className="scheduler-label">
                    <Repeat size={14} />
                    Lặp lại
                  </label>
                  <select
                    className="scheduler-select"
                    value={formData.repeat}
                    onChange={(e) => setFormData({ ...formData, repeat: e.target.value })}
                  >
                    <option value="none">Không lặp</option>
                    <option value="daily">Hàng ngày</option>
                    <option value="weekly">Hàng tuần</option>
                  </select>
                </div>

                {isMumuInstalled && (
                  <div className="scheduler-field scheduler-field--half">
                    <label className="scheduler-label">
                      <Monitor size={14} />
                      Emulator
                    </label>
                    <select
                      className="scheduler-select"
                      value={formData.emulatorIndex}
                      onChange={(e) => setFormData({ ...formData, emulatorIndex: e.target.value })}
                    >
                      <option value="">Không dùng</option>
                      <option value="all">Tất cả</option>
                      {instances.map(inst => (
                        <option key={inst.index} value={inst.index}>
                          {inst.name} {inst.is_running ? '•' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formData.emulatorIndex && (
                <label className="scheduler-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.autoShutdown}
                    onChange={(e) => setFormData({ ...formData, autoShutdown: e.target.checked })}
                  />
                  <span>Tự động đóng emulator sau khi xong</span>
                </label>
              )}

              {/* Profile/Model Selection */}
              <div className="scheduler-field">
                <label className="scheduler-label">
                  <Sparkles size={14} />
                  Profile (Model)
                </label>
                <select
                  className="scheduler-select"
                  value={formData.profileId}
                  onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                >
                  <option value="">Dùng profile hiện tại ({activeProfile?.name || 'Chưa chọn'})</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {getModelDisplayName(p.provider.name, p.provider.model)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="scheduler-modal-footer">
              <button className="scheduler-btn scheduler-btn--ghost" onClick={() => { setShowForm(false); resetForm(); }}>
                Hủy
              </button>
              <button className="scheduler-btn scheduler-btn--primary" onClick={handleAddSchedule}>
                <Check size={16} />
                {editingTaskId ? 'Lưu' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="scheduler-list">
        {scheduledTasks.length === 0 ? (
          <div className="scheduler-empty">
            <Calendar size={40} strokeWidth={1.5} />
            <p>Chưa có lịch trình</p>
            <span>Tạo lịch để tự động hóa task</span>
          </div>
        ) : (
          scheduledTasks.map(task => {
            const isRunning = runningTaskIds.includes(task.id);
            return (
              <div 
                key={task.id} 
                className={`scheduler-task ${task.enabled ? 'scheduler-task--enabled' : ''} ${isRunning ? 'scheduler-task--running' : ''}`}
              >
                <div className="scheduler-task-indicator" />
                
                <div className="scheduler-task-content">
                  <div className="scheduler-task-header">
                    <span className="scheduler-task-name">
                      {task.name}
                      {isRunning && <span className="scheduler-task-status">Đang chạy</span>}
                    </span>
                    <div className="scheduler-task-meta">
                      <span className="scheduler-task-time">
                        <Clock size={12} />
                        {formatTimeOnly(task.scheduleTime)}
                      </span>
                      {getRepeatLabel(task.repeat) && (
                        <span className="scheduler-task-repeat">
                          <Repeat size={12} />
                          {getRepeatLabel(task.repeat)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="scheduler-task-details">
                    <span className="scheduler-task-device">
                      <Smartphone size={12} />
                      {task.deviceIds?.length > 1 
                        ? `${task.deviceIds.length} thiết bị` 
                        : (task.deviceIds?.[0] || task.deviceId || 'N/A')}
                    </span>
                    {task.emulatorIndex && (
                      <span className="scheduler-task-emu">
                        <Monitor size={12} />
                        EMU {task.emulatorIndex === 'all' ? 'All' : `#${task.emulatorIndex}`}
                      </span>
                    )}
                    {task.taskSource === 'macro' && (
                      <span className="scheduler-task-type">Workflow</span>
                    )}
                  </div>
                </div>

                <div className="scheduler-task-actions">
                  {isRunning ? (
                    <button
                      className="scheduler-btn scheduler-btn--icon scheduler-btn--stop"
                      onClick={() => stopScheduledTask(task.id, task.deviceId)}
                      title="Dừng task"
                    >
                      <Square size={15} />
                    </button>
                  ) : (
                    <>
                      <button
                        className="scheduler-btn scheduler-btn--icon"
                        onClick={() => handleEditTask(task)}
                        title="Sửa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className={`scheduler-btn scheduler-btn--icon ${task.enabled ? 'scheduler-btn--active' : ''}`}
                        onClick={() => toggleSchedule(task.id)}
                        title={task.enabled ? 'Tắt' : 'Bật'}
                      >
                        {task.enabled ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <button
                        className="scheduler-btn scheduler-btn--icon scheduler-btn--danger"
                        onClick={() => removeSchedule(task.id)}
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SchedulerPanel;
