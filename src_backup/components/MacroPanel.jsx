// MacroPanel - Clean Minimal Design
import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Plus,
  Upload,
  Download,
  Trash2,
  Square,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Terminal,
  X,
  Sparkles,
} from 'lucide-react';
import { useDeviceStore, useProfileStore, useTaskTemplateStore, useSettingsStore } from '../store';
import { invoke, listen } from '../tauri-mock';

// Enhance Prompt Button
function EnhanceButton({ prompt, onEnhanced, profile, disabled }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!prompt?.trim() || !profile) return;
    setLoading(true);
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
      console.error('Enhance failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="macro-icon-btn"
      onClick={handle}
      disabled={disabled || loading || !prompt?.trim()}
      title="AI Enhance"
    >
      {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
    </button>
  );
}

export default function MacroPanel() {
  const { devices } = useDeviceStore();
  const { activeProfile, profiles, loadProfiles } = useProfileStore();
  const { templates } = useTaskTemplateStore();
  const { tracing } = useSettingsStore();
  
  const [macros, setMacros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [replaying, setReplaying] = useState(null);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [showRecord, setShowRecord] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Record form
  const [recordPrompt, setRecordPrompt] = useState('');
  const [recordName, setRecordName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [maxSteps, setMaxSteps] = useState(1000);
  
  // Replay options
  const [delay, setDelay] = useState(1.0);
  
  const logsRef = useRef(null);
  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || activeProfile;

  const loadMacros = async () => {
    setLoading(true);
    try {
      const result = await invoke('list_macros');
      setMacros(result || []);
    } catch (e) {
      console.error('Load macros failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMacros();
    loadProfiles();
  }, []);

  useEffect(() => {
    let unlisten = null;
    const setup = async () => {
      unlisten = await listen('macro-output', (event) => {
        const line = event.payload;
        const level = line.includes('ERROR') ? 'error' 
          : line.includes('SUCCESS') || line.includes('✓') ? 'success' : 'info';
        setLogs(prev => [...prev, { level, message: line }]);
      });
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRecord = async () => {
    if (!selectedDevices.length || !recordPrompt.trim() || !selectedProfile) return;
    
    setRecording(true);
    setLogs([{ level: 'info', message: `Recording: ${recordPrompt}` }]);
    
    try {
      const result = await invoke('record_macro', {
        deviceId: selectedDevices[0],
        provider: selectedProfile.provider.name,
        apiKey: selectedProfile.provider.api_key,
        model: selectedProfile.provider.model,
        prompt: recordPrompt.trim(),
        macroName: recordName.trim() || recordPrompt.trim().slice(0, 30),
        baseUrl: selectedProfile.provider.base_url,
        vision: false,
        maxSteps,
        tracingEnabled: tracing.enabled,
        tracingProvider: tracing.provider,
        langfuseSecretKey: tracing.langfuseSecretKey,
        langfusePublicKey: tracing.langfusePublicKey,
        langfuseHost: tracing.langfuseHost,
      });
      
      setLogs(prev => [...prev, { level: 'success', message: `Saved: ${result.macro_path}` }]);
      loadMacros();
      setRecordPrompt('');
      setRecordName('');
      setShowRecord(false);
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: String(e) }]);
    } finally {
      setRecording(false);
    }
  };

  const handleReplay = async (macro) => {
    if (!selectedDevices.length) return;
    
    setReplaying(macro.path);
    setLogs([{ level: 'info', message: `Replaying: ${macro.name}` }]);
    
    try {
      for (const deviceId of selectedDevices) {
        setLogs(prev => [...prev, { level: 'info', message: `[${deviceId}] Starting...` }]);
        await invoke('replay_macro', {
          deviceId,
          macroPath: macro.path,
          delay,
          startFrom: 1,
          maxSteps: null,
          dryRun: false,
        });
        setLogs(prev => [...prev, { level: 'success', message: `[${deviceId}] Done` }]);
      }
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: String(e) }]);
    } finally {
      setReplaying(null);
    }
  };

  const handleDelete = async (path) => {
    if (!confirm('Delete this macro?')) return;
    try {
      await invoke('delete_macro', { macroPath: path });
      loadMacros();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleExport = async (path) => {
    try {
      const result = await invoke('export_macro', { macroPath: path, exportPath: '' });
      setLogs(prev => [...prev, { level: 'success', message: `Exported: ${result}` }]);
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Export failed: ${e}` }]);
    }
  };

  const handleImport = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Macro', extensions: ['zip'] }],
      });
      
      if (selected) {
        const result = await invoke('import_macro', { zipPath: selected.path || selected });
        setLogs(prev => [...prev, { level: 'success', message: `Imported: ${result.name}` }]);
        loadMacros();
      }
    } catch (e) {
      setLogs(prev => [...prev, { level: 'error', message: `Import failed: ${e}` }]);
    }
  };

  const toggleDevice = (id) => {
    setSelectedDevices(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.map(l => l.message).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="macro-panel">
      {/* Header */}
      <div className="macro-header">
        <h1 className="macro-title">Macros</h1>
        <div className="macro-header-actions">
          <button className="macro-btn macro-btn-ghost" onClick={handleImport}>
            <Upload size={15} />
          </button>
          <button 
            className={`macro-btn ${showRecord ? 'macro-btn-active' : 'macro-btn-primary'}`}
            onClick={() => setShowRecord(!showRecord)}
          >
            <Plus size={15} />
            <span>Record</span>
          </button>
        </div>
      </div>

      {/* Device Pills */}
      <div className="macro-devices">
        {devices.length === 0 ? (
          <span className="macro-no-device">No devices connected</span>
        ) : (
          devices.map(d => (
            <button
              key={d.id}
              className={`macro-device-pill ${selectedDevices.includes(d.id) ? 'active' : ''}`}
              onClick={() => toggleDevice(d.id)}
            >
              <span className="macro-device-dot" />
              {d.model || d.id.split(':')[0]}
            </button>
          ))
        )}
        {selectedDevices.length > 0 && (
          <span className="macro-device-count">{selectedDevices.length} selected</span>
        )}
      </div>

      {/* Record Form */}
      {showRecord && (
        <div className="macro-record-form">
          <div className="macro-record-row">
            <select
              className="macro-select"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
            >
              <option value="">Profile...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              className="macro-input macro-input-name"
              placeholder="Macro name"
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
            />
            <input
              type="number"
              className="macro-input macro-input-steps"
              placeholder="Steps"
              value={maxSteps}
              onChange={(e) => setMaxSteps(parseInt(e.target.value) || 1000)}
              min={10}
              max={9999}
            />
          </div>
          <div className="macro-record-row">
            <input
              type="text"
              className="macro-input macro-input-prompt"
              placeholder="What should the AI do? e.g. Open Facebook and scroll feed..."
              value={recordPrompt}
              onChange={(e) => setRecordPrompt(e.target.value)}
              disabled={recording}
            />
            <EnhanceButton
              prompt={recordPrompt}
              onEnhanced={setRecordPrompt}
              profile={selectedProfile}
              disabled={recording}
            />
            {recording ? (
              <button className="macro-btn macro-btn-stop" onClick={() => setRecording(false)}>
                <Square size={14} />
              </button>
            ) : (
              <button
                className="macro-btn macro-btn-record"
                onClick={handleRecord}
                disabled={!selectedDevices.length || !recordPrompt.trim() || !selectedProfile}
              >
                Record
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delay Control */}
      <div className="macro-delay-row">
        <label className="macro-delay-label">Delay</label>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={delay}
          onChange={(e) => setDelay(parseFloat(e.target.value))}
          className="macro-delay-slider"
        />
        <span className="macro-delay-value">{delay.toFixed(1)}s</span>
      </div>

      {/* Macro List */}
      <div className="macro-list">
        {loading ? (
          <div className="macro-empty">
            <Loader2 size={20} className="spin" />
          </div>
        ) : macros.length === 0 ? (
          <div className="macro-empty">
            No macros yet. Record one to get started.
          </div>
        ) : (
          macros.map((macro, idx) => (
            <div key={idx} className="macro-item">
              <div className="macro-item-info">
                <div className="macro-item-name">{macro.name}</div>
                <div className="macro-item-meta">
                  {macro.steps} steps · {macro.created_at?.split(' ')[0] || 'Unknown'}
                </div>
              </div>
              <div className="macro-item-actions">
                <button
                  className="macro-btn macro-btn-play"
                  onClick={() => handleReplay(macro)}
                  disabled={replaying || !selectedDevices.length}
                >
                  {replaying === macro.path ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Play size={14} />
                  )}
                </button>
                <button
                  className="macro-icon-btn"
                  onClick={() => handleExport(macro.path)}
                  title="Export"
                >
                  <Download size={14} />
                </button>
                <button
                  className="macro-icon-btn macro-icon-btn-danger"
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

      {/* Logs */}
      {logs.length > 0 && (
        <div className="macro-logs">
          <div className="macro-logs-header">
            <Terminal size={12} />
            <span>Output</span>
            <div className="macro-logs-actions">
              <button className="macro-icon-btn" onClick={copyLogs}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <button className="macro-icon-btn" onClick={() => setLogs([])}>
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="macro-logs-content" ref={logsRef}>
            {logs.map((log, i) => (
              <div key={i} className={`macro-log-line macro-log-${log.level}`}>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
