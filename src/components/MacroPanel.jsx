import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  RefreshCw,
  Save,
  FolderOpen,
  Plus,
  Upload,
  Download,
  Settings,
  X,
  Check,
  Copy,
  Trash2,
  Play,
  Square,
  Sparkles,
  Clock,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  RotateCcw,
  Edit2,
} from 'lucide-react';
import { useDeviceStore, useProfileStore, useSkillStore, useSettingsStore, useLicenseStore } from '../store';
import { invoke, listen } from '../tauri-mock';

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
      if (enhanced?.trim()) onEnhanced(enhanced);
    } catch (e) {
      console.error('Failed to enhance:', e);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <button
      className="macro-btn macro-btn--icon"
      onClick={handleEnhance}
      disabled={disabled || isEnhancing || !prompt?.trim() || !profile}
      title="Nâng cao prompt"
    >
      {isEnhancing ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
    </button>
  );
}

export default function MacroPanel() {
  const { devices } = useDeviceStore();
  const { activeProfile, profiles, loadProfiles } = useProfileStore();
  const { skills } = useSkillStore();
  const { tracing } = useSettingsStore();

  const [macros, setMacros] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [recordPrompt, setRecordPrompt] = useState('');
  const [recordName, setRecordName] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [recordMaxSteps, setRecordMaxSteps] = useState(1000);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [recordVision, setRecordVision] = useState(false);
  const [replayOptions, setReplayOptions] = useState({
    delay: 1.0,
    startFrom: 1,
    maxSteps: 0,
    dryRun: false,
  });
  // Edit macro state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMacro, setEditingMacro] = useState(null);
  const [editMacroJson, setEditMacroJson] = useState('');
  const [isSavingMacro, setIsSavingMacro] = useState(false);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || activeProfile;

  const loadMacros = async () => {
    setIsLoading(true);
    try {
      const result = await invoke('list_macros');
      setMacros(result || []);
    } catch (e) {
      console.error('Failed to load macros:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMacros();
    loadProfiles();
  }, []);

  useEffect(() => {
    let unlisten = null;
    let unlistenAi = null;
    const setupListener = async () => {
      unlisten = await listen('macro-output', (event) => {
        const line = event.payload;
        const level = line.includes('ERROR') || line.includes('error') ? 'error'
          : line.includes('SUCCESS') || line.includes('✓') ? 'success' : 'info';
        setLogs(prev => [...prev, { level, message: line, time: new Date() }]);
      });
      
      // Listen for AI usage updates from backend
      unlistenAi = await listen('ai-usage-updated', (event) => {
        console.log('[MacroPanel] AI usage updated:', event.payload);
        // Refresh license status to get new remaining count
        useLicenseStore.getState().refreshAiRequestStatus?.();
      });
    };
    setupListener();
    return () => { 
      if (unlisten) unlisten(); 
      if (unlistenAi) unlistenAi();
    };
  }, []);

  const handleRecord = async () => {
    console.log('[MacroPanel] handleRecord called');

    if (selectedDevices.length === 0) {
      alert('Vui lòng chọn thiết bị');
      return;
    }
    if (!recordPrompt.trim()) {
      alert('Vui lòng nhập prompt');
      return;
    }
    if (!selectedProfile) {
      alert('Vui lòng chọn Profile AI');
      return;
    }

    setIsRecording(true);
    setShowLogs(true);
    setLogs([{ level: 'info', message: `Recording: ${recordPrompt}`, time: new Date() }]);

    try {
      console.log('[MacroPanel] Calling record_macro with:', {
        deviceId: selectedDevices[0],
        provider: selectedProfile.provider?.name || selectedProfile.provider,
        model: selectedProfile.provider?.model || selectedProfile.model,
        prompt: recordPrompt.trim(),
      });

      const result = await invoke('record_macro', {
        deviceId: selectedDevices[0],
        provider: selectedProfile.provider?.name || selectedProfile.provider,
        apiKey: selectedProfile.provider?.api_key || selectedProfile.api_key,
        model: selectedProfile.provider?.model || selectedProfile.model,
        prompt: recordPrompt.trim(),
        macroName: recordName.trim() || recordPrompt.trim().slice(0, 30),
        baseUrl: selectedProfile.provider?.base_url || selectedProfile.base_url,
        vision: recordVision,
        maxSteps: recordMaxSteps,
        tracingEnabled: tracing.enabled,
        tracingProvider: tracing.provider,
        langfuseSecretKey: tracing.langfuseSecretKey,
        langfusePublicKey: tracing.langfusePublicKey,
        langfuseHost: tracing.langfuseHost,
      });

      setLogs(prev => [...prev, { level: 'success', message: `Recorded: ${result.macro_path}`, time: new Date() }]);
      loadMacros();
      setRecordPrompt('');
      setRecordName('');
      setShowRecordModal(false);
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Error: ${e}`, time: new Date() }]);
    } finally {
      setIsRecording(false);
    }
  };

  const handleReplay = async (macroPath) => {
    if (selectedDevices.length === 0) return;

    setIsReplaying(true);
    setShowLogs(true);
    setLogs([{ level: 'info', message: `Replaying on ${selectedDevices.length} device(s)`, time: new Date() }]);

    try {
      for (const deviceId of selectedDevices) {
        setLogs(prev => [...prev, { level: 'info', message: `[${deviceId}] Starting...`, time: new Date() }]);
        await invoke('replay_macro', {
          deviceId,
          macroPath,
          delay: replayOptions.delay,
          startFrom: replayOptions.startFrom,
          maxSteps: replayOptions.maxSteps || null,
          dryRun: replayOptions.dryRun,
        });
        setLogs(prev => [...prev, { level: 'success', message: `[${deviceId}] Completed`, time: new Date() }]);
      }
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Error: ${e}`, time: new Date() }]);
    } finally {
      setIsReplaying(false);
    }
  };

  const handleDelete = async (macroPath) => {
    try {
      await invoke('delete_macro', { macroPath });
      loadMacros();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const handleExport = async (macroPath) => {
    try {
      const result = await invoke('export_macro', { macroPath, exportPath: '' });
      setLogs(prev => [...prev, { level: 'success', message: `Exported: ${result}`, time: new Date() }]);
      setShowLogs(true);
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Export failed: ${e}`, time: new Date() }]);
    }
  };

  const handleImport = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Macro files', extensions: ['zip'] }],
      });

      if (selected) {
        setIsLoading(true);
        const result = await invoke('import_macro', { zipPath: selected.path || selected });
        setLogs(prev => [...prev, { level: 'success', message: `Imported: ${result.name}`, time: new Date() }]);
        setShowLogs(true);
        loadMacros();
      }
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Import failed: ${e}`, time: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Open macro for editing
  const handleEditMacro = async (macroPath) => {
    try {
      const macroJsonPath = `${macroPath}/macro.json`;
      const content = await invoke('read_file', { path: macroJsonPath });
      setEditingMacro({ path: macroPath, jsonPath: macroJsonPath });
      setEditMacroJson(JSON.stringify(JSON.parse(content), null, 2));
      setShowEditModal(true);
    } catch (e) {
      console.error('Failed to load macro:', e);
      setLogs(prev => [...prev, { level: 'error', message: `Cannot open macro: ${e}`, time: new Date() }]);
      setShowLogs(true);
    }
  };

  // Save edited macro
  const handleSaveMacro = async () => {
    if (!editingMacro) return;

    setIsSavingMacro(true);
    try {
      // Validate JSON
      const parsed = JSON.parse(editMacroJson);

      await invoke('write_file', {
        path: editingMacro.jsonPath,
        content: JSON.stringify(parsed, null, 2)
      });

      setLogs(prev => [...prev, { level: 'success', message: 'Macro saved!', time: new Date() }]);
      setShowLogs(true);
      setShowEditModal(false);
      setEditingMacro(null);
      loadMacros();
    } catch (e) {
      console.error('Failed to save macro:', e);
      setLogs(prev => [...prev, { level: 'error', message: `Save failed: ${e}`, time: new Date() }]);
      setShowLogs(true);
    } finally {
      setIsSavingMacro(false);
    }
  };

  const toggleDevice = (deviceId) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.map(l => l.message).join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="macro-panel">
      {/* Header */}
      <div className="macro-header">
        <div className="macro-header-left">
          <h2 className="macro-title">Macro</h2>
          <div className="macro-stats">
            <span className="macro-stat">
              <FolderOpen size={14} />
              {macros.length} macro
            </span>
            <span className="macro-stat">
              <Smartphone size={14} />
              {selectedDevices.length} thiết bị
            </span>
            {isRecording && (
              <span className="macro-stat macro-stat--recording">
                <span className="macro-pulse" />
                Đang ghi
              </span>
            )}
          </div>
        </div>
        <div className="macro-header-actions">
          <button
            className="macro-btn macro-btn--ghost"
            onClick={() => setShowLogs(!showLogs)}
          >
            Log {logs.length > 0 && <span className="macro-badge">{logs.length}</span>}
          </button>
          <button
            className="macro-btn macro-btn--ghost"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={16} />
          </button>
          <button
            className="macro-btn macro-btn--ghost"
            onClick={handleImport}
            disabled={isLoading}
          >
            <Upload size={16} />
          </button>
          <button
            className="macro-btn macro-btn--primary"
            onClick={() => setShowRecordModal(true)}
          >
            <Plus size={16} />
            Ghi mới
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="macro-settings">
          <div className="macro-settings-title">Replay Options</div>
          <div className="macro-settings-grid">
            <div className="macro-field">
              <label>Delay (s)</label>
              <input
                type="number"
                className="macro-input macro-input--sm"
                min={0}
                step={0.1}
                value={replayOptions.delay}
                onChange={(e) => setReplayOptions(prev => ({ ...prev, delay: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="macro-field">
              <label>Start from</label>
              <input
                type="number"
                className="macro-input macro-input--sm"
                min={1}
                value={replayOptions.startFrom}
                onChange={(e) => setReplayOptions(prev => ({ ...prev, startFrom: parseInt(e.target.value) }))}
              />
            </div>
            <div className="macro-field">
              <label>Max steps</label>
              <input
                type="number"
                className="macro-input macro-input--sm"
                min={0}
                value={replayOptions.maxSteps}
                onChange={(e) => setReplayOptions(prev => ({ ...prev, maxSteps: parseInt(e.target.value) }))}
              />
            </div>
            <label className="macro-checkbox">
              <input
                type="checkbox"
                checked={replayOptions.dryRun}
                onChange={(e) => setReplayOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
              />
              <span>Dry Run</span>
            </label>
          </div>
        </div>
      )}

      {/* Logs Panel */}
      {showLogs && logs.length > 0 && (
        <div className="macro-logs">
          <div className="macro-logs-header">
            <span>Activity Log</span>
            <div className="macro-logs-actions">
              <button className="macro-btn macro-btn--xs" onClick={copyLogs}>
                {copiedLogs ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button className="macro-btn macro-btn--xs" onClick={() => { setShowLogs(false); setLogs([]); }}>
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="macro-logs-content">
            {logs.slice(-10).map((log, i) => (
              <div key={i} className={`macro-log macro-log--${log.level}`}>
                <span className="macro-log-time">
                  {log.time.toLocaleTimeString('vi-VN', { hour12: false })}
                </span>
                <span className="macro-log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Device Selection */}
      <div className="macro-devices">
        <div className="macro-devices-header">
          <span className="macro-devices-title">Thiết bị</span>
          <div className="macro-devices-actions">
            <button
              className="macro-btn macro-btn--xs"
              onClick={() => setSelectedDevices(devices.map(d => d.id))}
            >
              Chọn tất cả
            </button>
            <button
              className="macro-btn macro-btn--xs"
              onClick={() => setSelectedDevices([])}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
        {devices.length === 0 ? (
          <div className="macro-devices-empty">Không có thiết bị</div>
        ) : (
          <div className="macro-devices-list">
            {devices.map(device => (
              <button
                key={device.id}
                className={`macro-device ${selectedDevices.includes(device.id) ? 'macro-device--selected' : ''}`}
                onClick={() => toggleDevice(device.id)}
              >
                <Smartphone size={14} />
                <span>{device.model || device.id}</span>
                {selectedDevices.includes(device.id) && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Macro List */}
      <div className="macro-list">
        {macros.length === 0 ? (
          <div className="macro-empty">
            <FolderOpen size={40} strokeWidth={1.5} />
            <p>Chưa có macro</p>
            <span>Ghi macro mới để bắt đầu tự động hóa</span>
          </div>
        ) : (
          macros.map((macro, idx) => (
            <div key={idx} className="macro-card">
              <div className="macro-card-content">
                <div className="macro-card-header">
                  <span className="macro-card-name">{macro.name}</span>
                  <span className="macro-card-steps">{macro.steps} steps</span>
                </div>
                <div className="macro-card-meta">
                  <span className="macro-card-date">
                    <Clock size={12} />
                    {macro.created_at}
                  </span>
                  {macro.prompt && (
                    <span className="macro-card-prompt" title={macro.prompt}>
                      {macro.prompt.slice(0, 50)}...
                    </span>
                  )}
                </div>
              </div>
              <div className="macro-card-actions">
                <button
                  className="macro-btn macro-btn--primary"
                  onClick={() => handleReplay(macro.path)}
                  disabled={isReplaying || selectedDevices.length === 0}
                >
                  <Play size={14} />
                  Run
                </button>
                <button
                  className="macro-btn macro-btn--icon"
                  onClick={() => handleEditMacro(macro.path)}
                  title="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="macro-btn macro-btn--icon"
                  onClick={() => handleExport(macro.path)}
                  title="Export"
                >
                  <Download size={14} />
                </button>
                <button
                  className="macro-btn macro-btn--icon macro-btn--danger"
                  onClick={() => handleDelete(macro.path)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Modal */}
      {showRecordModal && (
        <div className="macro-modal-overlay" onClick={() => !isRecording && setShowRecordModal(false)}>
          <div className="macro-modal" onClick={e => e.stopPropagation()}>
            <div className="macro-modal-header">
              <h3>Ghi Macro mới</h3>
              {!isRecording && (
                <button className="macro-btn macro-btn--icon" onClick={() => setShowRecordModal(false)}>
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="macro-modal-body">
              {/* Profile Selection */}
              <div className="macro-field">
                <label className="macro-label">Profile AI</label>
                <select
                  className="macro-select"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  disabled={isRecording}
                >
                  <option value="">Chọn profile...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Macro Name */}
              <div className="macro-field">
                <label className="macro-label">Tên macro</label>
                <input
                  type="text"
                  className="macro-input"
                  placeholder="VD: Login Facebook"
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                  disabled={isRecording}
                />
              </div>

              {/* Prompt */}
              <div className="macro-field">
                <label className="macro-label">Prompt</label>
                <div className="macro-prompt-row">
                  <input
                    type="text"
                    className="macro-input"
                    placeholder="Mô tả nhiệm vụ AI cần thực hiện..."
                    value={recordPrompt}
                    onChange={(e) => setRecordPrompt(e.target.value)}
                    disabled={isRecording}
                  />
                  <EnhancePromptButton
                    prompt={recordPrompt}
                    onEnhanced={setRecordPrompt}
                    profile={selectedProfile}
                    disabled={isRecording}
                  />
                </div>
              </div>

              {/* Options Row */}
              <div className="macro-row">
                <div className="macro-field macro-field--half">
                  <label className="macro-label">Max Steps</label>
                  <input
                    type="number"
                    className="macro-input"
                    min={10}
                    max={9999}
                    value={recordMaxSteps}
                    onChange={(e) => setRecordMaxSteps(parseInt(e.target.value) || 1000)}
                    disabled={isRecording}
                  />
                </div>
                <div className="macro-field macro-field--half">
                  <label className="macro-label">Vision Mode</label>
                  <button
                    className={`macro-toggle ${recordVision ? 'macro-toggle--active' : ''}`}
                    onClick={() => setRecordVision(!recordVision)}
                    disabled={isRecording}
                  >
                    {recordVision ? <Eye size={14} /> : <EyeOff size={14} />}
                    {recordVision ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {recordVision && (
                <div className="macro-warning">
                  Vision mode có thể gây lỗi "Empty response" với một số API
                </div>
              )}

              {selectedDevices.length === 0 && (
                <div className="macro-warning">
                  Chọn ít nhất 1 thiết bị để ghi macro
                </div>
              )}
            </div>

            <div className="macro-modal-footer">
              {isRecording ? (
                <button
                  className="macro-btn macro-btn--danger"
                  onClick={() => setIsRecording(false)}
                >
                  <Square size={16} />
                  Dừng ghi
                </button>
              ) : (
                <>
                  <button
                    className="macro-btn macro-btn--ghost"
                    onClick={() => setShowRecordModal(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="macro-btn macro-btn--primary"
                    onClick={handleRecord}
                    disabled={!recordPrompt.trim() || !selectedProfile || selectedDevices.length === 0}
                  >
                    <Save size={16} />
                    Bắt đầu ghi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Macro Modal */}
      {showEditModal && editingMacro && (
        <div className="macro-modal-overlay" onClick={() => !isSavingMacro && setShowEditModal(false)}>
          <div className="macro-modal macro-modal--large" onClick={e => e.stopPropagation()}>
            <div className="macro-modal-header">
              <h3>Chỉnh sửa Macro</h3>
              {!isSavingMacro && (
                <button className="macro-btn macro-btn--icon" onClick={() => setShowEditModal(false)}>
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="macro-modal-body">
              <p style={{ marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                📁 {editingMacro.jsonPath}
              </p>
              <textarea
                className="macro-textarea"
                value={editMacroJson}
                onChange={(e) => setEditMacroJson(e.target.value)}
                disabled={isSavingMacro}
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div className="macro-modal-footer">
              <button
                className="macro-btn macro-btn--ghost"
                onClick={() => setShowEditModal(false)}
                disabled={isSavingMacro}
              >
                Hủy
              </button>
              <button
                className="macro-btn macro-btn--primary"
                onClick={handleSaveMacro}
                disabled={isSavingMacro}
              >
                {isSavingMacro ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
