import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  Settings,
  Trash2,
  Copy,
  Edit,
  Edit2,
  FolderOpen,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Square,
  CheckCircle,
  AlertCircle,
  Loader2,
  Code,
  GitBranch,
  Repeat,
  MessageSquare,
  Timer,
  Terminal,
  Sparkles,
  Download,
  Upload,
  X,
  Save,
  RefreshCw,
  Smartphone,
  Eye,
  Target,
  Camera,
  Crosshair,
  Film,
  Bot,
} from 'lucide-react';
import { useWorkflowStore, useDeviceStore, useProfileStore, useEmulatorStore, STEP_TYPES, ACTION_TYPES } from '../store';
import { invoke, listen } from '../tauri-mock';
import { getModelDisplayName } from '../constants/providers';

// Step type icons
const STEP_ICONS = {
  action: Zap,
  condition: GitBranch,
  loop: Repeat,
  while: Repeat,
  parallel: Code,
  python: Terminal,
  prompt: MessageSquare,
  wait: Timer,
  random_wait: Timer,
  ai_wait: Bot,
  extract: Eye,
  skill: Sparkles,
};

// Step type colors
const STEP_COLORS = {
  action: '#4f6ef7',
  condition: '#f59e0b',
  loop: '#8b5cf6',
  while: '#8b5cf6',
  parallel: '#06b6d4',
  python: '#22c55e',
  prompt: '#ec4899',
  wait: '#6b7280',
  random_wait: '#a855f7',
  ai_wait: '#10b981',
  extract: '#14b8a6',
  skill: '#f97316',
};

// Step Card Component
function StepCard({ step, index, isActive, onEdit, onDelete, level = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = STEP_ICONS[step.type] || Zap;
  const color = STEP_COLORS[step.type] || '#4f6ef7';

  const hasChildren = step.body || step.then || step.else_branch || step.branches;

  return (
    <div
      className={`workflow-step ${isActive ? 'workflow-step--active' : ''}`}
      style={{ marginLeft: level * 20 }}
    >
      <div className="workflow-step__header" onClick={() => hasChildren && setExpanded(!expanded)}>
        <div className="workflow-step__icon" style={{ backgroundColor: `${color}20`, color }}>
          <Icon size={16} />
        </div>
        <div className="workflow-step__info">
          <span className="workflow-step__name">{step.name || step.type}</span>
          <span className="workflow-step__type">{step.type}</span>
        </div>
        {hasChildren && (
          <button className="workflow-step__expand">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <div className="workflow-step__actions">
          <button className="btn btn-xs btn-ghost" onClick={(e) => { e.stopPropagation(); onEdit(step); }}>
            <Edit size={14} />
          </button>
          <button className="btn btn-xs btn-ghost btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Step preview */}
      <div className="workflow-step__preview">
        {step.type === 'action' && step.action && (
          <span className="workflow-step__detail">Action: {step.action}</span>
        )}
        {step.type === 'condition' && step.condition && (
          <span className="workflow-step__detail">If: {step.condition}</span>
        )}
        {step.type === 'loop' && (
          <span className="workflow-step__detail">Loop: {step.count} times</span>
        )}
        {step.type === 'python' && (
          <span className="workflow-step__detail">Python script</span>
        )}
        {step.type === 'wait' && step.duration && (
          <span className="workflow-step__detail">Wait: {step.duration}ms</span>
        )}
      </div>

      {/* Children steps */}
      {expanded && hasChildren && (
        <div className="workflow-step__children">
          {step.body && step.body.map((child, i) => (
            <StepCard
              key={child.id}
              step={child}
              index={i}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {step.then && step.then.length > 0 && (
            <div className="workflow-step__branch">
              <span className="workflow-step__branch-label">Then:</span>
              {step.then.map((child, i) => (
                <StepCard
                  key={child.id}
                  step={child}
                  index={i}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
          {step.else_branch && step.else_branch.length > 0 && (
            <div className="workflow-step__branch">
              <span className="workflow-step__branch-label">Else:</span>
              {step.else_branch.map((child, i) => (
                <StepCard
                  key={child.id}
                  step={child}
                  index={i}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Workflow Card Component
function WorkflowCard({ workflow, isSelected, onSelect, onRun, onStop, isRunning, onEdit, onDelete, onDuplicate }) {
  const stepCount = workflow.steps?.length || 0;

  return (
    <div
      className={`workflow-card ${isSelected ? 'workflow-card--selected' : ''} ${isRunning ? 'workflow-card--running' : ''}`}
      onClick={() => onSelect(workflow.id)}
    >
      <div className="workflow-card__header">
        <div
          className="workflow-card__icon"
          style={{ backgroundColor: workflow.color || '#4f6ef7' }}
        >
          <Zap size={20} />
        </div>
        <div className="workflow-card__info">
          <h4 className="workflow-card__name">{workflow.name}</h4>
          <p className="workflow-card__desc">{workflow.description || 'Không có mô tả'}</p>
        </div>
      </div>

      <div className="workflow-card__stats">
        <span className="workflow-card__stat">
          <Code size={14} />
          {stepCount} steps
        </span>
        <span className="workflow-card__stat">
          <Clock size={14} />
          {workflow.timeout || 300}s timeout
        </span>
      </div>

      <div className="workflow-card__actions">
        {isRunning ? (
          <button
            className="btn btn-sm btn-danger btn-stop-workflow"
            onClick={(e) => { e.stopPropagation(); onStop(); }}
          >
            <Square size={14} />
            Dừng
          </button>
        ) : (
          <button
            className="btn btn-sm btn-primary btn-run-workflow"
            onClick={(e) => { e.stopPropagation(); onRun(workflow); }}
          >
            <Play size={14} />
            Chạy
          </button>
        )}
        <button
          className="btn btn-sm btn-ghost"
          onClick={(e) => { e.stopPropagation(); onEdit(workflow); }}
        >
          <Edit size={14} />
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={(e) => { e.stopPropagation(); onDuplicate(workflow.id); }}
        >
          <Copy size={14} />
        </button>
        {!workflow.isBuiltin && (
          <button
            className="btn btn-sm btn-ghost btn-danger"
            onClick={(e) => { e.stopPropagation(); onDelete(workflow.id); }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// Input form for workflow inputs
function InputForm({ inputs, values, onChange }) {
  if (!inputs || inputs.length === 0) return null;

  return (
    <div className="workflow-inputs">
      <h4>Cấu hình đầu vào</h4>
      {inputs.map(input => (
        <div key={input.name} className="workflow-input-field">
          <label>{input.label || input.name}</label>
          {input.input_type === 'boolean' ? (
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={values[input.name] ?? input.default ?? false}
                onChange={(e) => onChange(input.name, e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          ) : input.input_type === 'select' && input.options ? (
            <select
              value={values[input.name] ?? input.default ?? ''}
              onChange={(e) => onChange(input.name, e.target.value)}
            >
              {input.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : input.input_type === 'number' ? (
            <input
              type="number"
              value={values[input.name] ?? input.default ?? 0}
              min={input.min}
              max={input.max}
              onChange={(e) => onChange(input.name, parseFloat(e.target.value))}
            />
          ) : input.input_type === 'text' ? (
            <textarea
              value={values[input.name] ?? input.default ?? ''}
              onChange={(e) => onChange(input.name, e.target.value)}
              rows={3}
            />
          ) : (
            <input
              type="text"
              value={values[input.name] ?? input.default ?? ''}
              placeholder={input.placeholder}
              onChange={(e) => onChange(input.name, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Main Workflow Panel
export default function WorkflowPanel() {
  const {
    workflows,
    isRunning,
    currentStepId,
    logs,
    runWorkflow,
    runWorkflowPython,
    stopWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
    addWorkflow,
    updateWorkflow,
    clearLogs,
    exportWorkflows,
    importWorkflows,
  } = useWorkflowStore();

  const { devices } = useDeviceStore();
  const { activeProfile } = useProfileStore();
  const { instances, isMumuInstalled, checkMumuInstalled, getInstances, launchEmulatorsSequentially, launchProgress } = useEmulatorStore();

  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]); // Multi-device selection
  const [showEditor, setShowEditor] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  
  // Multi-device execution states
  const [isMultiDeviceMode, setIsMultiDeviceMode] = useState(false);
  const [multiDeviceProgress, setMultiDeviceProgress] = useState({}); // { deviceId: { status, progress } }
  
  // Emulator auto-launch states
  const [selectedEmulatorIndexes, setSelectedEmulatorIndexes] = useState([]);
  const [emulatorLaunchProgress, setEmulatorLaunchProgress] = useState(null);
  
  // Panel tab: 'workflow' or 'macro'
  const [panelTab, setPanelTab] = useState('workflow');
  
  // Macro states
  const [macros, setMacros] = useState([]);
  const [isLoadingMacros, setIsLoadingMacros] = useState(false);
  const [isReplayingMacro, setIsReplayingMacro] = useState(false);
  const [macroLogs, setMacroLogs] = useState([]);
  const [showMacroLogs, setShowMacroLogs] = useState(false);
  const [replayOptions, setReplayOptions] = useState({
    delay: 1.0,
    startFrom: 1,
    maxSteps: 0,
  });

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
  
  // Load macros
  const loadMacros = async () => {
    setIsLoadingMacros(true);
    try {
      const result = await invoke('list_macros');
      setMacros(result || []);
    } catch (e) {
      console.error('Failed to load macros:', e);
    } finally {
      setIsLoadingMacros(false);
    }
  };
  
  // Replay macro
  const handleReplayMacro = async (macroPath) => {
    if (!selectedDeviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }
    
    setIsReplayingMacro(true);
    setShowMacroLogs(true);
    setMacroLogs([{ level: 'info', message: `Replaying macro...`, time: new Date() }]);
    
    try {
      await invoke('replay_macro', {
        deviceId: selectedDeviceId,
        macroPath,
        delay: replayOptions.delay,
        startFrom: replayOptions.startFrom,
        maxSteps: replayOptions.maxSteps || null,
        dryRun: false,
      });
      setMacroLogs(prev => [...prev, { level: 'success', message: 'Macro completed', time: new Date() }]);
    } catch (e) {
      setMacroLogs(prev => [...prev, { level: 'error', message: `Error: ${e}`, time: new Date() }]);
    } finally {
      setIsReplayingMacro(false);
    }
  };
  
  // Delete macro
  const handleDeleteMacro = async (macroPath) => {
    if (!confirm('Xóa macro này?')) return;
    try {
      await invoke('delete_macro', { macroPath });
      loadMacros();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };
  
  // Load macros when switching to macro tab
  useEffect(() => {
    if (panelTab === 'macro') {
      loadMacros();
    }
  }, [panelTab]);

  // Auto-select first device
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices]);

  // Listen for workflow events
  useEffect(() => {
    let unlistens = [];

    const setupListeners = async () => {
      unlistens.push(await listen('workflow-output', (event) => {
        console.log('[Workflow]', event.payload);
      }));

      unlistens.push(await listen('workflow-step', (event) => {
        console.log('[Workflow Step]', event.payload);
      }));
    };

    setupListeners();

    return () => {
      unlistens.forEach(unlisten => unlisten && unlisten());
    };
  }, []);

  const handleRun = async (workflow) => {
    console.log('[handleRun] workflow:', workflow?.id, workflow?.name);
    console.log('[handleRun] selectedDeviceId:', selectedDeviceId);
    console.log('[handleRun] devices:', devices);
    
    if (!selectedDeviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }

    setShowLogs(true);
    clearLogs();

    // Build inputs with defaults
    const inputs = {};
    workflow.inputs?.forEach(input => {
      inputs[input.name] = inputValues[input.name] ?? input.default;
    });

    console.log('[handleRun] Running workflow with inputs:', inputs);

    try {
      // Use Python executor for reliable timing
      const result = await runWorkflowPython(workflow.id, inputs, selectedDeviceId);
      console.log('[handleRun] Workflow result:', result);
    } catch (e) {
      console.error('Workflow error:', e);
    }
  };

  // Run workflow on multiple devices with optional emulator auto-launch
  const handleRunMultiDevice = async (workflow, options = {}) => {
    const { autoLaunchEmulators = false, emulatorIndexes = [] } = options;
    
    let targetDeviceIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : [selectedDeviceId];
    
    if (targetDeviceIds.length === 0 || (targetDeviceIds.length === 1 && !targetDeviceIds[0])) {
      alert('Vui lòng chọn ít nhất một thiết bị');
      return;
    }

    setShowLogs(true);
    clearLogs();

    // Step 1: Auto-launch emulators if needed (SEQUENTIAL)
    if (autoLaunchEmulators && emulatorIndexes.length > 0) {
      setEmulatorLaunchProgress({ 
        status: 'launching', 
        message: `Đang khởi động ${emulatorIndexes.length} emulator(s) tuần tự...`,
        current: 0,
        total: emulatorIndexes.length,
      });

      try {
        const launchResult = await launchEmulatorsSequentially(emulatorIndexes, {
          onProgress: (progress) => {
            setEmulatorLaunchProgress({
              status: progress.status,
              message: progress.message,
              current: progress.current,
              total: progress.total,
              vmindex: progress.vmindex,
            });
          },
          onEmulatorReady: (result) => {
            console.log('[handleRunMultiDevice] Emulator ready:', result.deviceId);
            // Add the newly connected device to target list
            if (result.deviceId && !targetDeviceIds.includes(result.deviceId)) {
              targetDeviceIds = [...targetDeviceIds, result.deviceId];
              setSelectedDeviceIds(targetDeviceIds);
            }
          },
        });

        if (!launchResult.success) {
          setEmulatorLaunchProgress({ 
            status: 'error', 
            message: `Lỗi: Chỉ ${launchResult.successCount}/${launchResult.results.length} emulator(s) sẵn sàng`,
          });
          // Continue with available emulators
        }

        // Update target device IDs with launched emulators
        if (launchResult.deviceIds && launchResult.deviceIds.length > 0) {
          targetDeviceIds = launchResult.deviceIds;
        }

        setEmulatorLaunchProgress(null);
      } catch (e) {
        console.error('[handleRunMultiDevice] Emulator launch error:', e);
        setEmulatorLaunchProgress({ status: 'error', message: `Lỗi: ${e.message || e}` });
        return;
      }
    }

    // Step 2: Build inputs with defaults
    const inputs = {};
    workflow.inputs?.forEach(input => {
      inputs[input.name] = inputValues[input.name] ?? input.default;
    });

    console.log(`[handleRunMultiDevice] Running workflow on ${targetDeviceIds.length} devices:`, targetDeviceIds);

    // Step 3: Run workflow on multiple devices
    try {
      const { runWorkflowMultiDevice } = useWorkflowStore.getState();
      const result = await runWorkflowMultiDevice(workflow.id, inputs, targetDeviceIds, {
        parallel: true,
        staggerDelay: 2000,
        onDeviceProgress: (deviceId, updates) => {
          setMultiDeviceProgress(prev => ({
            ...prev,
            [deviceId]: { ...prev[deviceId], ...updates },
          }));
        },
      });
      console.log('[handleRunMultiDevice] Multi-device result:', result);
    } catch (e) {
      console.error('[handleRunMultiDevice] Error:', e);
    }
  };

  const handleInputChange = (name, value) => {
    setInputValues(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (workflow) => {
    setEditingWorkflow(workflow);
    setShowEditor(true);
  };

  const handleExport = () => {
    try {
      const json = exportWorkflows();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workflows.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Lỗi export: ' + e.message);
    }
  };

  const handleImport = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const count = importWorkflows(text);
            alert(`Đã import ${count} workflow`);
          } catch (err) {
            alert('Lỗi đọc file: ' + err.message);
          }
        }
        document.body.removeChild(input);
      };
      
      input.click();
    } catch (e) {
      console.error('Import error:', e);
      alert('Lỗi import: ' + e.message);
    }
  };

  return (
    <div className="workflow-panel">
      {/* Header */}
      <div className="workflow-header">
        <div className="workflow-header__left">
          <h2 className="workflow-header__title">
            <Zap className="workflow-header__icon" />
            Workflow & Macro
          </h2>
          {/* Panel Tabs */}
          <div className="workflow-panel-tabs">
            <button
              className={`workflow-panel-tab ${panelTab === 'workflow' ? 'active' : ''}`}
              onClick={() => setPanelTab('workflow')}
            >
              <Zap size={14} />
              Workflows ({workflows.length})
            </button>
            <button
              className={`workflow-panel-tab ${panelTab === 'macro' ? 'active' : ''}`}
              onClick={() => setPanelTab('macro')}
            >
              <Film size={14} />
              Macros ({macros.length})
            </button>
          </div>
        </div>
        <div className="workflow-header__actions">
          {panelTab === 'workflow' ? (
            <>
              <button className="btn btn-sm btn-ghost" onClick={handleImport}>
                <Upload size={16} />
                Import
              </button>
              <button className="btn btn-sm btn-ghost" onClick={handleExport}>
                <Download size={16} />
                Export
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditingWorkflow(null);
                  setShowEditor(true);
                }}
              >
                <Plus size={16} />
                Tạo mới
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={loadMacros} disabled={isLoadingMacros}>
              <RefreshCw size={16} className={isLoadingMacros ? 'spin' : ''} />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Device Selection */}
      <div className="workflow-device-select">
        <Smartphone size={16} />
        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
        >
          <option value="">Chọn thiết bị...</option>
          {devices.map(device => (
            <option key={device.id} value={device.id}>
              {device.model || device.id}
            </option>
          ))}
        </select>
      </div>

      {panelTab === 'workflow' ? (
      <div className="workflow-content">
        {/* Workflow List */}
        <div className="workflow-list">
          {workflows.length === 0 ? (
            <div className="workflow-empty">
              <FolderOpen size={48} strokeWidth={1} />
              <p>Chưa có workflow nào</p>
              <span>Tạo workflow mới để bắt đầu tự động hóa</span>
            </div>
          ) : (
            workflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                isSelected={selectedWorkflowId === workflow.id}
                isRunning={isRunning && useWorkflowStore.getState().activeWorkflow?.id === workflow.id}
                onSelect={setSelectedWorkflowId}
                onRun={handleRun}
                onStop={stopWorkflow}
                onEdit={handleEdit}
                onDelete={deleteWorkflow}
                onDuplicate={duplicateWorkflow}
              />
            ))
          )}
        </div>

        {/* Workflow Detail */}
        {selectedWorkflow && (
          <div className="workflow-detail">
            <div className="workflow-detail__header">
              <h3>{selectedWorkflow.name}</h3>
              {isRunning ? (
                <button className="btn btn-sm btn-danger" onClick={stopWorkflow}>
                  <Square size={14} />
                  Dừng
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleRun(selectedWorkflow)}
                  disabled={!selectedDeviceId}
                >
                  <Play size={14} />
                  Chạy
                </button>
              )}
            </div>

            {/* Input Form */}
            <InputForm
              inputs={selectedWorkflow.inputs}
              values={inputValues}
              onChange={handleInputChange}
            />

            {/* Steps */}
            <div className="workflow-detail__steps">
              <h4>Steps ({selectedWorkflow.steps?.length || 0})</h4>
              <div className="workflow-steps-list">
                {selectedWorkflow.steps?.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    isActive={currentStepId === step.id}
                    onEdit={handleEdit}
                    onDelete={() => { }}
                  />
                ))}
              </div>
            </div>

            {/* Logs */}
            {showLogs && logs.length > 0 && (
              <div className="workflow-logs">
                <div className="workflow-logs__header">
                  <h4>Logs</h4>
                  <button className="btn btn-xs btn-ghost" onClick={() => setShowLogs(false)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="workflow-logs__content">
                  {logs.map((log, i) => (
                    <div key={i} className={`workflow-log workflow-log--${log.level}`}>
                      <span className="workflow-log__time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="workflow-log__msg">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      ) : (
        /* Macro Tab Content */
        <div className="workflow-content">
          <div className="macro-list-container">
            {isLoadingMacros ? (
              <div className="workflow-empty">
                <RefreshCw size={48} strokeWidth={1} className="spin" />
                <p>Đang tải macros...</p>
              </div>
            ) : macros.length === 0 ? (
              <div className="workflow-empty">
                <Film size={48} strokeWidth={1} />
                <p>Chưa có macro nào</p>
                <span>Macro được tạo từ Execution hoặc Chat</span>
              </div>
            ) : (
              <div className="macro-grid">
                {macros.map((macro, idx) => (
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
                        className="btn btn-sm btn-primary btn-run-workflow"
                        onClick={() => handleReplayMacro(macro.path)}
                        disabled={isReplayingMacro || !selectedDeviceId}
                      >
                        {isReplayingMacro ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                        Run
                      </button>
                      <button
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={() => handleDeleteMacro(macro.path)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Macro Logs */}
          {showMacroLogs && (
            <div className="workflow-logs">
              <div className="workflow-logs__header">
                <span>Logs</span>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowMacroLogs(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="workflow-logs__content">
                {macroLogs.map((log, idx) => (
                  <div key={idx} className={`workflow-log workflow-log--${log.level}`}>
                    <span className="workflow-log__time">{log.time.toLocaleTimeString()}</span>
                    <span className="workflow-log__message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <WorkflowEditorModal
          workflow={editingWorkflow}
          onClose={() => setShowEditor(false)}
          onSave={(workflow) => {
            if (editingWorkflow) {
              updateWorkflow(editingWorkflow.id, workflow);
            } else {
              addWorkflow(workflow);
            }
            setShowEditor(false);
          }}
          onSaveOnly={(workflow) => {
            if (editingWorkflow) {
              updateWorkflow(editingWorkflow.id, workflow);
            } else {
              addWorkflow(workflow);
            }
            // Don't close editor - just save
          }}
        />
      )}
    </div>
  );
}

// Workflow Editor Modal
function WorkflowEditorModal({ workflow, onClose, onSave, onSaveOnly }) {
  const { activeProfile, profiles, loadProfiles } = useProfileStore();
  const isEditing = !!workflow;

  // Load profiles if not loaded yet
  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      console.log('[WorkflowEditor] Loading profiles...');
      loadProfiles();
    }
  }, []);

  const [formData, setFormData] = useState({
    name: workflow?.name || '',
    description: workflow?.description || '',
    color: workflow?.color || '#4f6ef7',
    timeout: workflow?.timeout || 300,
    inputs: workflow?.inputs || [],
    steps: workflow?.steps || [],
    outputs: workflow?.outputs || [],
  });

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Store initial data for comparison
  const initialDataRef = React.useRef(JSON.stringify({
    name: workflow?.name || '',
    description: workflow?.description || '',
    color: workflow?.color || '#4f6ef7',
    timeout: workflow?.timeout || 300,
    inputs: workflow?.inputs || [],
    steps: workflow?.steps || [],
  }));

  // Check for changes when formData updates
  React.useEffect(() => {
    const currentData = JSON.stringify({
      name: formData.name,
      description: formData.description,
      color: formData.color,
      timeout: formData.timeout,
      inputs: formData.inputs,
      steps: formData.steps,
    });
    setHasUnsavedChanges(currentData !== initialDataRef.current);
  }, [formData]);

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges) {
      const shouldClose = window.confirm('Bạn có thay đổi chưa lưu. Bạn có muốn thoát không?\n\nNhấn OK để thoát (mất thay đổi)\nNhấn Cancel để quay lại và lưu');
      if (shouldClose) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const [activeTab, setActiveTab] = useState(isEditing ? 'basic' : 'ai');
  const [pythonCode, setPythonCode] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);
  const [showRandomTimeModal, setShowRandomTimeModal] = useState(false);
  const [randomTimeConfig, setRandomTimeConfig] = useState({ minPercent: 10, maxPercent: 30 });

  // Wizard state for AI workflow creation
  // Steps: 1=AI Tạo Plan (trả coords/actions), 2=Thực thi Actions, 3=Xác nhận & Lưu
  const [wizardStep, setWizardStep] = useState(1);
  const WIZARD_STEPS = [
    { id: 1, name: 'AI Tạo Plan', icon: 'Sparkles' },
    { id: 2, name: 'Thực thi', icon: 'Play' },
    { id: 3, name: 'Xác nhận & Lưu', icon: 'Check' },
  ];

  // AI Generation state
  const [aiDescription, setAiDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState(null);

  // Clarifying questions state (Step 1 sub-flow)
  const [clarifyingQuestions, setClarifyingQuestions] = useState(null);
  const [clarifyingAnswers, setClarifyingAnswers] = useState({});
  const [showQuestions, setShowQuestions] = useState(false);

  // Vision-based execution state (Step 2)
  const [visionActions, setVisionActions] = useState([]); // History of actions
  const [currentAction, setCurrentAction] = useState(null); // Current suggested action
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Calibration state
  const [calibrationDescription, setCalibrationDescription] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState(null);
  const [calibrationScreenshot, setCalibrationScreenshot] = useState(null);

  // Test run state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLogs, setTestLogs] = useState([]);

  // Step editor state
  const [editStepIndex, setEditStepIndex] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  // AI Refine state
  const [showAIRefine, setShowAIRefine] = useState(false);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [isAIRefining, setIsAIRefining] = useState(false);
  const [aiRefineError, setAiRefineError] = useState('');

  const { devices } = useDeviceStore();
  const [calibrationDeviceId, setCalibrationDeviceId] = useState(devices[0]?.id || '');

  // Model selector for Vision - use profiles from above

  // Build available models list from profiles (fallback to activeProfile)
  const availableModels = React.useMemo(() => {
    const models = [];
    const seen = new Set();

    // If profiles loaded, use them
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        if (profile.provider?.model && !seen.has(profile.provider.model)) {
          seen.add(profile.provider.model);
          models.push({
            profileId: profile.id,
            provider: profile.provider.name,
            model: profile.provider.model,
            apiKey: profile.provider.api_key,
            baseUrl: profile.provider.base_url,
            label: `${getModelDisplayName(profile.provider.name, profile.provider.model)} (${profile.name})`,
          });
        }
      });
    }

    // Fallback: use activeProfile if no models from profiles
    if (models.length === 0 && activeProfile?.provider?.model) {
      models.push({
        profileId: activeProfile.id,
        provider: activeProfile.provider.name,
        model: activeProfile.provider.model,
        apiKey: activeProfile.provider.api_key,
        baseUrl: activeProfile.provider.base_url,
        label: `${getModelDisplayName(activeProfile.provider.name, activeProfile.provider.model)} (${activeProfile.name})`,
      });
    }

    return models;
  }, [profiles, activeProfile]);

  const [selectedVisionModel, setSelectedVisionModel] = useState(
    activeProfile?.id || ''
  );

  // Get the selected model config (fallback to activeProfile config)
  const selectedModelConfig = React.useMemo(() => {
    if (availableModels.length > 0) {
      return availableModels.find(m => m.profileId === selectedVisionModel) ||
        availableModels.find(m => m.profileId === activeProfile?.id) ||
        availableModels[0];
    }
    // Ultimate fallback to activeProfile
    if (activeProfile?.provider) {
      return {
        provider: activeProfile.provider.name,
        model: activeProfile.provider.model,
        apiKey: activeProfile.provider.api_key,
        baseUrl: activeProfile.provider.base_url,
      };
    }
    return null;
  }, [selectedVisionModel, availableModels, activeProfile]);

  // Handle calibration - use LLM Vision to analyze screen and create accurate workflow
  const handleCalibrate = async () => {
    if (!calibrationDescription.trim()) {
      alert('Vui lòng mô tả workflow bạn muốn tạo');
      return;
    }
    if (!calibrationDeviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }
    if (!selectedModelConfig?.apiKey && !activeProfile?.provider?.api_key) {
      alert('Vui lòng chọn Profile AI có API key trước');
      return;
    }

    setIsCalibrating(true);
    setCalibrationResult(null);

    try {
      const result = await invoke('calibrate_workflow', {
        deviceId: calibrationDeviceId,
        description: calibrationDescription.trim(),
        provider: selectedModelConfig?.provider || activeProfile.provider.name,
        apiKey: selectedModelConfig?.apiKey || activeProfile.provider.api_key,
        model: selectedModelConfig?.model || activeProfile.provider.model || null,
        numScreens: 1,
      });

      if (result && result.workflow) {
        setCalibrationResult(result);
        // Auto fill form data
        setFormData(prev => ({
          ...prev,
          name: result.workflow.name || prev.name,
          description: result.workflow.description || prev.description,
          color: result.workflow.color || prev.color,
          timeout: result.workflow.timeout || prev.timeout,
          inputs: result.workflow.inputs || [],
          steps: result.workflow.steps || [],
        }));
      }
    } catch (e) {
      console.error('Calibration failed:', e);
      alert(`Lỗi calibration: ${e}`);
    } finally {
      setIsCalibrating(false);
    }
  };


  // Main flow: Generate Workflow → Vision Calibrate
  const handleGenerateWorkflow = async () => {
    if (!aiDescription.trim()) {
      alert('Vui lòng mô tả workflow bạn muốn tạo');
      return;
    }
    if (!activeProfile?.provider?.api_key) {
      alert('Vui lòng chọn Profile AI có API key trước');
      return;
    }

    setIsGenerating(true);
    setGeneratedWorkflow(null);

    try {
      // Step 1: Generate workflow structure from description
      console.log('[Workflow] Step 1: Generating workflow structure...');

      const result = await invoke('generate_workflow', {
        provider: selectedModelConfig?.provider || activeProfile.provider.name,
        apiKey: selectedModelConfig?.apiKey || activeProfile.provider.api_key,
        model: selectedModelConfig?.model || activeProfile.provider.model,
        description: aiDescription.trim(),
        baseUrl: selectedModelConfig?.baseUrl || activeProfile.provider.base_url || null,
      });

      if (result) {
        const autoName = result.name ||
          aiDescription.trim().slice(0, 50).replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, '').trim() ||
          `Workflow ${Date.now()}`;

        // Step 2: Vision Calibrate - find exact coordinates
        // Only if device is connected
        if (calibrationDeviceId) {
          console.log('[Workflow] Step 2: Vision calibrating...');

          try {
            const calibrationResult = await invoke('calibrate_workflow', {
              deviceId: calibrationDeviceId,
              description: aiDescription.trim(),
              provider: selectedModelConfig?.provider || activeProfile.provider.name,
              apiKey: selectedModelConfig?.apiKey || activeProfile.provider.api_key,
              model: selectedModelConfig?.model || null,
              numScreens: 1,
            });

            if (calibrationResult && calibrationResult.workflow) {
              // Merge calibrated steps with generated workflow
              const calibratedWorkflow = {
                ...result,
                name: autoName,
                steps: calibrationResult.workflow.steps || result.steps,
              };

              setGeneratedWorkflow(calibratedWorkflow);
              setFormData(prev => ({
                ...prev,
                name: autoName,
                description: result.description || aiDescription.trim(),
                color: result.color || prev.color,
                timeout: result.timeout || prev.timeout,
                inputs: result.inputs || [],
                steps: calibratedWorkflow.steps,
              }));

              setCalibrationResult(calibrationResult);
              console.log('[Workflow] ✓ Generated + Calibrated successfully!');
              return;
            }
          } catch (calibErr) {
            console.warn('[Workflow] Calibration failed, using generated workflow:', calibErr);
            // Continue without calibration
          }
        }

        // Fallback: use generated workflow without calibration
        setGeneratedWorkflow(result);
        setFormData(prev => ({
          ...prev,
          name: autoName,
          description: result.description || aiDescription.trim(),
          color: result.color || prev.color,
          timeout: result.timeout || prev.timeout,
          inputs: result.inputs || [],
          steps: result.steps || [],
        }));

        console.log('[Workflow] Generated successfully (no calibration):', autoName);
      }
    } catch (e) {
      console.error('Generate workflow failed:', e);
      alert(`Lỗi tạo workflow: ${e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseGeneratedWorkflow = () => {
    if (generatedWorkflow) {
      setActiveTab('basic');
    }
  };

  // ===== WIZARD STEP HANDLERS =====

  // Step 1: User enters task description and moves to Step 2
  const handleWizardStep1 = async () => {
    if (!aiDescription.trim()) {
      alert('Vui lòng mô tả workflow bạn muốn tạo');
      return;
    }
    if (!calibrationDeviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }
    // Allow mun-ai provider without apiKey (backend will inject)
    const isMunAi = selectedModelConfig?.provider === 'mun-ai';
    if (!isMunAi && !selectedModelConfig?.apiKey) {
      alert('Vui lòng chọn Model AI có API key');
      return;
    }

    // Just move to Step 2 - DroidRun will execute there
    console.log('[Wizard Step 1] Task ready:', aiDescription.trim());
    setFormData(prev => ({
      ...prev,
      name: aiDescription.trim().slice(0, 50) || `Workflow ${Date.now()}`,
      description: aiDescription.trim(),
    }));
    setWizardStep(2);
  };

  // Reset questions when going back
  const resetClarifyingQuestions = () => {
    setClarifyingQuestions(null);
    setClarifyingAnswers({});
    setShowQuestions(false);
  };

  // Step 2: Run DroidRun to execute task and record macro
  const handleWizardStep2 = async () => {
    if (!calibrationDeviceId) {
      alert('Vui lòng chọn thiết bị để thực thi');
      return;
    }
    if (!aiDescription.trim()) {
      alert('Vui lòng nhập mô tả task');
      return;
    }

    setIsCalibrating(true);
    setTestLogs(['🚀 Bắt đầu DroidRun...']);

    try {
      console.log('[Wizard Step 2] Running DroidRun task...');

      // Use selectedModelConfig first (user's dropdown selection), fallback to activeProfile
      const configToUse = selectedModelConfig ? {
        provider: selectedModelConfig.provider,
        model: selectedModelConfig.model,
        apiKey: selectedModelConfig.apiKey,
        baseUrl: selectedModelConfig.baseUrl,
      } : activeProfile?.provider ? {
        provider: activeProfile.provider.name,
        model: activeProfile.provider.model,
        apiKey: activeProfile.provider.api_key,
        baseUrl: activeProfile.provider.base_url,
      } : null;

      setTestLogs(prev => [...prev, '⏳ DroidRun đang thực thi task...']);
      setTestLogs(prev => [...prev, `📱 Device: ${calibrationDeviceId}`]);
      setTestLogs(prev => [...prev, `🤖 Model: ${getModelDisplayName(configToUse?.provider, configToUse?.model)} (${configToUse?.provider})`]);

      const result = await invoke('run_droidrun_task', {
        deviceId: calibrationDeviceId,
        task: aiDescription.trim(),
        provider: configToUse?.provider,
        apiKey: configToUse?.apiKey,
        model: configToUse?.model,
        baseUrl: configToUse?.baseUrl || null,
        maxSteps: 50,
      });

      console.log('[Wizard Step 2] DroidRun result:', result);

      if (result && result.success) {
        setTestLogs(prev => [
          ...prev,
          `✅ DroidRun hoàn thành!`,
          `📋 Ghi lại ${result.total_actions} actions`,
          `📁 Trajectory: ${result.trajectory_path}`,
        ]);

        // Convert macro to workflow steps with RECORDED wait times from AI
        const macroActions = result.macro?.actions || [];
        
        // Default wait times by action type (ms) - fallback only
        const getDefaultWait = (actionType) => {
          switch (actionType) {
            case 'start_app': return 2500;
            case 'tap': return 800;
            case 'input_text': return 1000;
            case 'key_press': return 500;
            case 'swipe': return 1000;
            case 'long_press': return 1200;
            default: return 800;
          }
        };
        
        // Calculate total wait time after an action (sum of consecutive WaitEvents)
        const getTotalWaitAfter = (idx) => {
          let totalWait = 0;
          let i = idx + 1;
          
          // Sum all consecutive WaitEvents
          while (i < macroActions.length && macroActions[i].action_type === 'wait') {
            const duration = macroActions[i].duration;
            // Convert seconds to ms if needed (duration > 100 likely already in ms)
            totalWait += duration > 100 ? duration : Math.round(duration * 1000);
            i++;
          }
          
          return totalWait > 0 ? totalWait : null;
        };
        
        // Filter out WaitEvents (they'll be merged into waitAfter of previous action)
        const actionSteps = macroActions.filter(a => a.action_type !== 'wait');
        
        const workflowSteps = actionSteps.map((action, idx) => {
          // Find original index in macroActions
          const originalIdx = macroActions.indexOf(action);
          
          // Get total recorded wait time after this action
          const recordedWait = getTotalWaitAfter(originalIdx);
          const waitAfter = recordedWait || getDefaultWait(action.action_type);
          
          console.log(`[Macro→Workflow] Step ${idx + 1}: ${action.action_type}, waitAfter=${waitAfter}ms (recorded=${recordedWait})`);
          
          return {
            id: `step-${idx + 1}`,
            type: 'action',
            name: action.description || `Action ${idx + 1}`,
            action: action.action_type,
            waitAfter: waitAfter, // Use AI's recorded wait time
            waitVariance: recordedWait ? 0.05 : 0.15, // Less variance if using recorded time
            params: {
              x: action.x,
              y: action.y,
              start_x: action.start_x,
              start_y: action.start_y,
              end_x: action.end_x,
              end_y: action.end_y,
              duration: action.duration || action.duration_ms,
              text: action.text,
              keycode: action.keycode,
              package: action.package,
              activity: action.activity,
            },
          };
        });

        console.log('[Wizard Step 2] Created workflow steps:', workflowSteps);

        setFormData(prev => ({
          ...prev,
          steps: workflowSteps,
        }));

        setCalibrationResult(result);
        setWizardStep(3);
      } else {
        setTestLogs(prev => [...prev, `❌ DroidRun thất bại`]);
      }
    } catch (e) {
      console.error('DroidRun failed:', e);
      setTestLogs(prev => [...prev, `❌ Lỗi: ${e}`]);
    } finally {
      setIsCalibrating(false);
    }
  };

  // Vision-based: Analyze screen and suggest next action
  const analyzeAndSuggestAction = async () => {
    if (!calibrationDeviceId) {
      alert('Vui lòng chọn thiết bị');
      return;
    }

    setIsAnalyzing(true);
    setTestLogs(prev => [...prev, '🔍 Đang phân tích màn hình...']);

    try {
      // Build step context from previous actions
      const stepContext = visionActions.length > 0
        ? visionActions.map((a, i) => `${i + 1}. ${a.description}`).join('\n')
        : null;

      const result = await invoke('analyze_screen_for_action', {
        deviceId: calibrationDeviceId,
        task: aiDescription.trim(),
        provider: selectedModelConfig?.provider,
        apiKey: selectedModelConfig?.apiKey,
        model: selectedModelConfig?.model,
        baseUrl: selectedModelConfig?.baseUrl || null,
        stepContext: stepContext,
      });

      console.log('[Vision] Action suggested:', result);
      setCurrentAction(result);
      setTestLogs(prev => [
        ...prev,
        `✨ AI đề xuất: ${result.action} - ${result.description}`,
        `   📍 ${result.reasoning}`,
      ]);

      // Check if task is complete
      if (result.is_complete) {
        setTestLogs(prev => [...prev, '🎉 Task hoàn thành!']);
        setWizardStep(3);
      }
    } catch (e) {
      console.error('Vision analysis failed:', e);
      setTestLogs(prev => [...prev, `❌ Lỗi phân tích: ${e}`]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute the current suggested action
  const executeCurrentAction = async () => {
    if (!currentAction) return;

    setTestLogs(prev => [...prev, `▶️ Thực thi: ${currentAction.action}...`]);

    try {
      const actions = [{
        action: currentAction.action,
        params: currentAction.params || {},
        description: currentAction.description,
      }];

      const result = await invoke('execute_actions', {
        deviceId: calibrationDeviceId,
        actions: actions,
      });

      if (result.success) {
        setTestLogs(prev => [...prev, `✅ Thành công!`]);

        // Add to history
        setVisionActions(prev => [...prev, currentAction]);

        // Also add to workflow steps
        const newStep = {
          id: `step-${formData.steps.length + 1}`,
          type: 'action',
          name: currentAction.description,
          action: currentAction.action,
          params: currentAction.params || {},
        };
        setFormData(prev => ({
          ...prev,
          steps: [...prev.steps, newStep],
        }));

        setCurrentAction(null);

        // Auto-analyze next step after short delay
        setTimeout(() => analyzeAndSuggestAction(), 1000);
      } else {
        setTestLogs(prev => [...prev, `⚠️ Thất bại: ${result.results?.[0]?.error || 'Unknown error'}`]);
      }
    } catch (e) {
      console.error('Execute failed:', e);
      setTestLogs(prev => [...prev, `❌ Lỗi: ${e}`]);
    }
  };

  // Skip current action and re-analyze
  const skipAndReanalyze = async () => {
    setCurrentAction(null);
    setTestLogs(prev => [...prev, '⏭️ Bỏ qua, phân tích lại...']);
    await analyzeAndSuggestAction();
  };

  // Step Editor functions
  const openStepEditor = (index) => {
    setEditStepIndex(index);
    setShowStepEditor(true);
  };

  const updateStep = (index, updates) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, ...updates } : step
      ),
    }));
  };

  const updateStepParam = (stepIndex, paramKey, value) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === stepIndex ? {
          ...step,
          params: { ...step.params, [paramKey]: value }
        } : step
      ),
    }));
  };

  const deleteStep = (index) => {
    if (confirm('Xóa step này?')) {
      setFormData(prev => ({
        ...prev,
        steps: prev.steps.filter((_, i) => i !== index),
      }));
      setShowStepEditor(false);
      setEditStepIndex(null);
    }
  };

  const moveStep = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.steps.length) return;

    const newSteps = [...formData.steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  // AI Refine handler - use AI to modify steps based on user prompt
  const handleAIRefine = async () => {
    if (!aiRefinePrompt.trim()) return;
    if (formData.steps.length === 0) {
      setAiRefineError('Chưa có steps để refine');
      return;
    }
    // Allow mun-ai provider without apiKey (backend will inject)
    const isMunAi = selectedModelConfig?.provider === 'mun-ai';
    if (!isMunAi && !selectedModelConfig?.apiKey) {
      setAiRefineError('Vui lòng chọn Model AI có API key trong tab AI');
      return;
    }

    setIsAIRefining(true);
    setAiRefineError('');

    try {
      const currentStepsJson = JSON.stringify(formData.steps, null, 2);
      const prompt = `You are a workflow step editor. The user wants to modify the following workflow steps.

Current steps:
${currentStepsJson}

User request: "${aiRefinePrompt}"

Respond with ONLY a valid JSON array of the modified steps. Keep the same structure (id, type, action, name, params, etc).
Do not include any explanation, markdown, or code blocks - just the raw JSON array.`;

      const result = await invoke('call_llm_api', {
        provider: selectedModelConfig.provider,
        apiKey: selectedModelConfig.apiKey,
        model: selectedModelConfig.model,
        prompt: prompt,
        systemPrompt: 'You are a JSON-only response bot. Output only valid JSON arrays.',
        baseUrl: selectedModelConfig.baseUrl || null,
      });

      // Parse the response
      let newSteps;
      try {
        // Try to extract JSON from response (in case there's extra text)
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          newSteps = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseErr) {
        console.error('Failed to parse AI response:', result);
        setAiRefineError('AI trả về định dạng không hợp lệ. Vui lòng thử lại.');
        return;
      }

      // Validate and apply
      if (Array.isArray(newSteps)) {
        // Ensure each step has an id
        const stepsWithIds = newSteps.map((step, idx) => ({
          ...step,
          id: step.id || `step-${Date.now()}-${idx}`,
        }));
        setFormData(prev => ({ ...prev, steps: stepsWithIds }));
        setShowAIRefine(false);
        setAiRefinePrompt('');
      } else {
        setAiRefineError('AI trả về không phải array. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('AI Refine error:', e);
      setAiRefineError(`Lỗi: ${e.message || e}`);
    } finally {
      setIsAIRefining(false);
    }
  };

  // Step 3: Test Run - Run workflow on real device
  const handleWizardStep3 = async () => {
    if (!calibrationDeviceId) {
      alert('Vui lòng chọn thiết bị để test');
      return;
    }
    if (formData.steps.length === 0) {
      alert('Workflow chưa có steps');
      return;
    }

    setIsTesting(true);
    setTestLogs([]);
    setTestResult(null);

    try {
      console.log('[Wizard Step 3] Testing workflow...');
      setTestLogs(prev => [...prev, '▶️ Bắt đầu test workflow...']);

      const result = await invoke('run_workflow', {
        deviceId: calibrationDeviceId,
        workflow: {
          id: `test-${Date.now()}`,
          name: formData.name || 'Test Workflow',
          description: formData.description,
          steps: formData.steps,
          inputs: formData.inputs || [],
          outputs: formData.outputs || [],
        },
        inputs: {},
      });

      setTestResult(result);
      setTestLogs(prev => [...prev, `✅ Test hoàn thành: ${result.status}`]);

      if (result.status === 'completed') {
        console.log('[Wizard Step 3] ✓ Test passed');
        setWizardStep(4); // Move to Step 4 (Save)
      }
    } catch (e) {
      console.error('Test failed:', e);
      setTestResult({ status: 'error', error: e.toString() });
      setTestLogs(prev => [...prev, `❌ Test thất bại: ${e}`]);
    } finally {
      setIsTesting(false);
    }
  };

  // Navigate wizard
  const handleWizardNext = () => {
    if (wizardStep === 1) handleWizardStep1();
    else if (wizardStep === 2) handleWizardStep2();
    else if (wizardStep === 3) handleSave(); // Step 3 is now Save
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      // Reset state for the step we're going back to
      if (wizardStep === 2) {
        // Going back to Step 1 - can regenerate plan
        setTestLogs([]);
      } else if (wizardStep === 3) {
        // Going back to Step 2 - can re-execute
        setCalibrationResult(null);
        setTestLogs([]);
      }
      setWizardStep(wizardStep - 1);
    }
  };

  const canProceedWizard = () => {
    if (wizardStep === 1) {
      const isMunAi = selectedModelConfig?.provider === 'mun-ai';
      const hasApiKey = isMunAi || selectedModelConfig?.apiKey;
      return aiDescription.trim() && selectedModelConfig && hasApiKey && calibrationDeviceId;
    }
    if (wizardStep === 2) return formData.steps.length > 0;
    if (wizardStep === 3) return formData.steps.length > 0; // Ready to save
    return false;
  };
  // ===== END WIZARD HANDLERS =====

  const handleSave = () => {
    // Auto-generate name if empty but has description or steps
    let dataToSave = { ...formData };

    if (!dataToSave.name.trim()) {
      // Check formData.description first
      if (dataToSave.description && dataToSave.description.trim()) {
        // Generate name from description
        dataToSave.name = dataToSave.description.slice(0, 40).trim();
      }
      // If on AI tab, use aiDescription
      else if (aiDescription && aiDescription.trim()) {
        dataToSave.name = aiDescription.slice(0, 40).trim();
        dataToSave.description = aiDescription.trim();
      }
      // Check steps
      else if (dataToSave.steps.length > 0) {
        // Generate name from first step
        dataToSave.name = `Workflow - ${dataToSave.steps.length} steps`;
      }
      // Calibration description
      else if (calibrationDescription && calibrationDescription.trim()) {
        dataToSave.name = calibrationDescription.slice(0, 40).trim();
        dataToSave.description = calibrationDescription.trim();
      }
      else {
        alert('Vui lòng nhập tên workflow hoặc thêm mô tả');
        return;
      }
    }

    // Ensure name is not empty
    if (!dataToSave.name.trim()) {
      dataToSave.name = `Workflow ${Date.now()}`;
    }

    onSave(dataToSave);
  };

  const addStep = (type) => {
    const newStep = {
      id: `step-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
    };

    // Add default fields based on type
    switch (type) {
      case 'action':
        newStep.action = 'open_app';
        newStep.params = {};
        break;
      case 'condition':
        newStep.condition = '';
        newStep.then = [];
        newStep.else_branch = [];
        break;
      case 'loop':
        newStep.count = '5';
        newStep.variable = 'i';
        newStep.body = [];
        break;
      case 'python':
        newStep.script = '# Python code here\nreturn {"result": "ok"}';
        newStep.save_to = 'python_result';
        break;
      case 'wait':
        newStep.duration = '1000';
        break;
      case 'prompt':
        newStep.prompt = '';
        break;
    }

    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
    setShowAddStep(false);
  };

  const addInput = () => {
    const newInput = {
      name: `input_${formData.inputs.length + 1}`,
      label: `Input ${formData.inputs.length + 1}`,
      input_type: 'string',
      default: '',
    };
    setFormData(prev => ({
      ...prev,
      inputs: [...prev.inputs, newInput],
    }));
  };

  const updateInput = (index, field, value) => {
    const newInputs = [...formData.inputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setFormData(prev => ({ ...prev, inputs: newInputs }));
  };

  const removeInput = (index) => {
    setFormData(prev => ({
      ...prev,
      inputs: prev.inputs.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal--lg workflow-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{workflow ? 'Chỉnh sửa Workflow' : 'Tạo Workflow mới'}</h3>
          <button className="btn btn-icon btn-ghost" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="workflow-editor__tabs">
          {!isEditing && (
            <button
              className={`workflow-editor__tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Sparkles size={14} />
              Tạo bằng AI
            </button>
          )}
          {!isEditing && (
            <button
              className={`workflow-editor__tab ${activeTab === 'calibrate' ? 'active' : ''}`}
              onClick={() => setActiveTab('calibrate')}
            >
              <Target size={14} />
              Calibration
            </button>
          )}
          <button
            className={`workflow-editor__tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Cơ bản
          </button>
          <button
            className={`workflow-editor__tab ${activeTab === 'inputs' ? 'active' : ''}`}
            onClick={() => setActiveTab('inputs')}
          >
            Inputs ({formData.inputs.length})
          </button>
          <button
            className={`workflow-editor__tab ${activeTab === 'steps' ? 'active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            Steps ({formData.steps.length})
          </button>
          <button
            className={`workflow-editor__tab ${activeTab === 'python' ? 'active' : ''}`}
            onClick={() => setActiveTab('python')}
          >
            <Terminal size={14} />
            Python
          </button>
        </div>

        <div className="modal__body workflow-editor__body">
          {/* AI Tab - Wizard Mode */}
          {activeTab === 'ai' && !isEditing && (
            <div className="workflow-editor__ai-tab">
              {/* Wizard Step Indicator */}
              <div className="workflow-editor__wizard-steps">
                {WIZARD_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`workflow-editor__wizard-step ${wizardStep === step.id ? 'active' : ''} ${wizardStep > step.id ? 'completed' : ''}`}
                  >
                    <div className="workflow-editor__wizard-step-num">
                      {wizardStep > step.id ? '✓' : step.id}
                    </div>
                    <span>{step.name}</span>
                    {idx < WIZARD_STEPS.length - 1 && <div className="workflow-editor__wizard-step-line" />}
                  </div>
                ))}
              </div>

              {/* Step 1: AI Generate */}
              {wizardStep === 1 && (
                <div className="workflow-editor__wizard-content">
                  <h4>Bước 1: AI Phân giải workflow</h4>

                  {!showQuestions ? (
                    <>
                      <p>Mô tả workflow bạn muốn tạo, AI sẽ hỏi thêm thông tin cần thiết.</p>

                      <div className="workflow-editor__ai-selectors">
                        <div className="workflow-editor__ai-device">
                          <label><Smartphone size={14} /> Thiết bị</label>
                          <select value={calibrationDeviceId} onChange={e => setCalibrationDeviceId(e.target.value)}>
                            <option value="">Chọn thiết bị</option>
                            {devices.map(device => (
                              <option key={device.id} value={device.id}>{device.model || device.id}</option>
                            ))}
                          </select>
                        </div>
                        <div className="workflow-editor__ai-device">
                          <label><Sparkles size={14} /> AI Model</label>
                          <select value={selectedVisionModel} onChange={e => setSelectedVisionModel(e.target.value)}>
                            {availableModels.length === 0 ? (
                              <option value="">Chưa có profile AI</option>
                            ) : (
                              availableModels.map(m => (
                                <option key={m.profileId} value={m.profileId}>{m.label}</option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="workflow-editor__ai-input">
                        <label>Mô tả workflow</label>
                        <textarea
                          value={aiDescription}
                          onChange={e => setAiDescription(e.target.value)}
                          placeholder="Ví dụ: Mở app Kuaishou, xem video tự động..."
                          rows={4}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>AI đã phân tích task: <strong>{clarifyingQuestions?.task_summary}</strong></p>
                      {clarifyingQuestions?.app_detected && (
                        <p style={{ color: 'var(--accent-color)', marginBottom: '12px' }}>
                          📱 App phát hiện: {clarifyingQuestions.app_detected}
                        </p>
                      )}

                      <div className="workflow-editor__clarifying-questions">
                        {clarifyingQuestions?.questions?.map(q => (
                          <div key={q.id} className="workflow-editor__question-item">
                            <label>
                              {q.question}
                              {q.required && <span style={{ color: 'red' }}> *</span>}
                            </label>

                            {q.type === 'number' && (
                              <input
                                type="number"
                                value={clarifyingAnswers[q.id] || ''}
                                onChange={e => setClarifyingAnswers(prev => ({
                                  ...prev,
                                  [q.id]: parseInt(e.target.value) || 0
                                }))}
                                placeholder={`Mặc định: ${q.default}`}
                                min={q.min}
                                max={q.max}
                              />
                            )}

                            {q.type === 'text' && (
                              <input
                                type="text"
                                value={clarifyingAnswers[q.id] || ''}
                                onChange={e => setClarifyingAnswers(prev => ({
                                  ...prev,
                                  [q.id]: e.target.value
                                }))}
                                placeholder={q.default || ''}
                              />
                            )}

                            {q.type === 'boolean' && (
                              <label className="workflow-editor__checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={clarifyingAnswers[q.id] || false}
                                  onChange={e => setClarifyingAnswers(prev => ({
                                    ...prev,
                                    [q.id]: e.target.checked
                                  }))}
                                />
                                {q.default ? 'Có' : 'Không'}
                              </label>
                            )}

                            {q.type === 'range' && (
                              <div className="workflow-editor__range-inputs">
                                <input
                                  type="number"
                                  value={Array.isArray(clarifyingAnswers[q.id]) ? clarifyingAnswers[q.id][0] : q.default?.[0] || q.min}
                                  onChange={e => setClarifyingAnswers(prev => ({
                                    ...prev,
                                    [q.id]: [parseInt(e.target.value), Array.isArray(prev[q.id]) ? prev[q.id][1] : q.default?.[1] || q.max]
                                  }))}
                                  placeholder="Từ"
                                  min={q.min}
                                  max={q.max}
                                />
                                <span>-</span>
                                <input
                                  type="number"
                                  value={Array.isArray(clarifyingAnswers[q.id]) ? clarifyingAnswers[q.id][1] : q.default?.[1] || q.max}
                                  onChange={e => setClarifyingAnswers(prev => ({
                                    ...prev,
                                    [q.id]: [Array.isArray(prev[q.id]) ? prev[q.id][0] : q.default?.[0] || q.min, parseInt(e.target.value)]
                                  }))}
                                  placeholder="Đến"
                                  min={q.min}
                                  max={q.max}
                                />
                                <span style={{ color: 'var(--text-color-muted)', fontSize: '12px' }}>
                                  ({q.min} - {q.max})
                                </span>
                              </div>
                            )}

                            {q.type === 'select' && (
                              <select
                                value={clarifyingAnswers[q.id] || q.default || ''}
                                onChange={e => setClarifyingAnswers(prev => ({
                                  ...prev,
                                  [q.id]: e.target.value
                                }))}
                              >
                                {q.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        className="btn btn--secondary"
                        style={{ marginTop: '12px' }}
                        onClick={resetClarifyingQuestions}
                      >
                        ← Quay lại sửa mô tả
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: DroidRun Execution */}
              {wizardStep === 2 && (
                <div className="workflow-editor__wizard-content">
                  <h4>Bước 2: DroidRun thực thi</h4>
                  <p>DroidRun AI sẽ phân tích màn hình và tự động thực thi task.</p>

                  <div className="workflow-editor__wizard-preview">
                    <strong>Task: {aiDescription}</strong>
                    <p>Device: {calibrationDeviceId} | Model: {getModelDisplayName(selectedModelConfig?.provider, selectedModelConfig?.model)}</p>
                  </div>

                  {/* Start Button */}
                  {!isCalibrating && testLogs.length === 0 && (
                    <button
                      className="btn btn--primary"
                      onClick={handleWizardStep2}
                      style={{ marginTop: 'var(--space-3)' }}
                    >
                      🚀 Bắt đầu DroidRun
                    </button>
                  )}

                  {/* Running indicator */}
                  {isCalibrating && (
                    <div style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center'
                    }}>
                      <div className="spinner" style={{ margin: '0 auto var(--space-2)' }}></div>
                      <p>⏳ DroidRun đang thực thi... (có thể mất vài phút)</p>
                    </div>
                  )}

                  {/* Logs */}
                  {testLogs.length > 0 && (
                    <div className="workflow-editor__test-logs" style={{ marginTop: 'var(--space-3)' }}>
                      {testLogs.map((log, idx) => (
                        <div key={idx} className="workflow-editor__test-log">{log}</div>
                      ))}
                    </div>
                  )}

                  {/* Retry button if failed */}
                  {!isCalibrating && testLogs.length > 0 && !calibrationResult?.success && (
                    <button
                      className="btn btn--secondary"
                      onClick={() => { setTestLogs([]); handleWizardStep2(); }}
                      style={{ marginTop: 'var(--space-3)' }}
                    >
                      🔄 Thử lại
                    </button>
                  )}
                </div>
              )}

              {/* Step 3: Xác nhận & Lưu */}
              {wizardStep === 3 && (
                <div className="workflow-editor__wizard-content">
                  <h4>Bước 3: Xác nhận & Lưu</h4>
                  <p>Xem lại và chỉnh sửa các bước nếu cần, sau đó lưu workflow.</p>

                  <div className="workflow-editor__wizard-summary">
                    <div className="workflow-editor__wizard-summary-item">
                      <strong>Tên:</strong>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        style={{ marginLeft: 'var(--space-2)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-default)' }}
                      />
                    </div>
                    <div className="workflow-editor__wizard-summary-item">
                      <strong>Steps:</strong> {formData.steps.length} bước (click để chỉnh sửa)
                    </div>
                  </div>

                  {/* Step List with Edit */}
                  <div style={{ marginTop: 'var(--space-3)', maxHeight: '300px', overflowY: 'auto' }}>
                    {formData.steps.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className="workflow-editor__step-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)',
                          marginBottom: 'var(--space-1)',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                        onClick={() => openStepEditor(idx)}
                      >
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', minWidth: '24px' }}>{idx + 1}</span>
                        <span style={{
                          padding: '2px 8px',
                          background: step.type === 'wait' ? 'var(--warning-soft)' : 'var(--accent-soft)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                        }}>
                          {step.action || step.type}
                        </span>
                        <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {step.name || step.description || '-'}
                        </span>
                        {step.params?.x && step.params?.y && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            ({step.params.x}, {step.params.y})
                          </span>
                        )}
                        <Edit2 size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    ))}
                  </div>

                  {testLogs.length > 0 && (
                    <div className="workflow-editor__test-logs">
                      {testLogs.map((log, idx) => (
                        <div key={idx} className="workflow-editor__test-log">{log}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                    <button className="btn btn--secondary" onClick={() => setWizardStep(1)}>
                      ← Tạo lại
                    </button>
                  </div>
                </div>
              )}

              {/* Step Editor Modal */}
              {showStepEditor && editStepIndex !== null && formData.steps[editStepIndex] && (
                <div className="modal-overlay" onClick={() => setShowStepEditor(false)}>
                  <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3 className="modal-title">Chỉnh sửa Step {editStepIndex + 1}</h3>
                      <button className="modal-close" onClick={() => setShowStepEditor(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Step Name */}
                      <label className="form-field">
                        <span className="form-label">Tên</span>
                        <input
                          type="text"
                          className="input"
                          value={formData.steps[editStepIndex].name || ''}
                          onChange={(e) => updateStep(editStepIndex, { name: e.target.value })}
                          placeholder="Nhập tên step..."
                        />
                      </label>

                      {/* Action Type */}
                      <label className="form-field">
                        <span className="form-label">Action</span>
                        <select
                          className="input"
                          value={formData.steps[editStepIndex].action || formData.steps[editStepIndex].type}
                          onChange={(e) => updateStep(editStepIndex, { action: e.target.value, type: e.target.value === 'wait' ? 'wait' : 'action' })}
                        >
                          <option value="tap">tap</option>
                          <option value="swipe">swipe</option>
                          <option value="swipe_up">swipe_up</option>
                          <option value="swipe_down">swipe_down</option>
                          <option value="type">type</option>
                          <option value="wait">wait</option>
                          <option value="back">back</option>
                          <option value="home">home</option>
                        </select>
                      </label>

                      {/* Params based on action type */}
                      {(formData.steps[editStepIndex].action === 'tap' || formData.steps[editStepIndex].type === 'action') && (
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                          <label className="form-field" style={{ flex: 1 }}>
                            <span className="form-label">X</span>
                            <input
                              type="number"
                              className="input"
                              value={formData.steps[editStepIndex].params?.x || ''}
                              onChange={(e) => updateStepParam(editStepIndex, 'x', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </label>
                          <label className="form-field" style={{ flex: 1 }}>
                            <span className="form-label">Y</span>
                            <input
                              type="number"
                              className="input"
                              value={formData.steps[editStepIndex].params?.y || ''}
                              onChange={(e) => updateStepParam(editStepIndex, 'y', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </label>
                        </div>
                      )}

                      {formData.steps[editStepIndex].action === 'wait' || formData.steps[editStepIndex].type === 'wait' ? (
                        <label className="form-field">
                          <span className="form-label">Duration (giây)</span>
                          <input
                            type="number"
                            step="0.1"
                            className="input"
                            value={formData.steps[editStepIndex].params?.duration || formData.steps[editStepIndex].duration || 1}
                            onChange={(e) => updateStepParam(editStepIndex, 'duration', parseFloat(e.target.value) || 1)}
                          />
                        </label>
                      ) : null}

                      {formData.steps[editStepIndex].action === 'type' && (
                        <label className="form-field">
                          <span className="form-label">Text</span>
                          <input
                            type="text"
                            className="input"
                            value={formData.steps[editStepIndex].params?.text || ''}
                            onChange={(e) => updateStepParam(editStepIndex, 'text', e.target.value)}
                            placeholder="Nhập text..."
                          />
                        </label>
                      )}

                      {/* Wait After Section - Enhanced */}
                      <div className="step-timing-section">
                        <div className="step-timing-header">
                          <span className="form-label">⏱️ Thời gian chờ sau action</span>
                        </div>
                        
                        <div className="step-timing-grid">
                          <label className="form-field">
                            <span className="form-label-sm">Thời gian cơ bản</span>
                            <div className="input-with-unit">
                              <input
                                type="number"
                                className="input"
                                value={Math.round((formData.steps[editStepIndex].waitAfter || 800) / 1000 * 10) / 10}
                                onChange={(e) => updateStep(editStepIndex, { waitAfter: Math.round(parseFloat(e.target.value) * 1000) || 800 })}
                                step="0.1"
                                min="0"
                              />
                              <span className="input-unit">giây</span>
                            </div>
                          </label>
                          
                          <label className="form-field">
                            <span className="form-label-sm">Random ±</span>
                            <div className="input-with-unit">
                              <input
                                type="number"
                                className="input"
                                value={Math.round((formData.steps[editStepIndex].waitVariance || 0.15) * 100)}
                                onChange={(e) => updateStep(editStepIndex, { waitVariance: (parseInt(e.target.value) || 15) / 100 })}
                                min="0"
                                max="100"
                              />
                              <span className="input-unit">%</span>
                            </div>
                          </label>
                        </div>
                        
                        {/* Random Range Presets */}
                        <div className="step-timing-presets">
                          <button
                            type="button"
                            className={`timing-preset ${formData.steps[editStepIndex].waitVariance === 0 ? 'active' : ''}`}
                            onClick={() => updateStep(editStepIndex, { waitVariance: 0 })}
                          >
                            Chính xác
                          </button>
                          <button
                            type="button"
                            className={`timing-preset ${formData.steps[editStepIndex].waitVariance === 0.15 ? 'active' : ''}`}
                            onClick={() => updateStep(editStepIndex, { waitVariance: 0.15 })}
                          >
                            ±15%
                          </button>
                          <button
                            type="button"
                            className={`timing-preset ${formData.steps[editStepIndex].waitVariance === 0.30 ? 'active' : ''}`}
                            onClick={() => updateStep(editStepIndex, { waitVariance: 0.30 })}
                          >
                            ±30%
                          </button>
                          <button
                            type="button"
                            className={`timing-preset ${formData.steps[editStepIndex].waitVariance === 0.50 ? 'active' : ''}`}
                            onClick={() => updateStep(editStepIndex, { waitVariance: 0.50 })}
                          >
                            ±50%
                          </button>
                        </div>
                        
                        {/* Preview */}
                        <div className="step-timing-preview">
                          {(() => {
                            const base = formData.steps[editStepIndex].waitAfter || 800;
                            const variance = formData.steps[editStepIndex].waitVariance || 0.15;
                            const min = Math.round(base * (1 - variance));
                            const max = Math.round(base * (1 + variance));
                            return (
                              <span>
                                Thời gian thực tế: <strong>{(min/1000).toFixed(1)}s</strong> → <strong>{(max/1000).toFixed(1)}s</strong>
                                {variance > 0 && <span className="timing-human"> 🧑 Giống người thật</span>}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginRight: 'auto' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => moveStep(editStepIndex, 'up')} disabled={editStepIndex === 0}>
                          ↑ Lên
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => moveStep(editStepIndex, 'down')} disabled={editStepIndex === formData.steps.length - 1}>
                          ↓ Xuống
                        </button>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteStep(editStepIndex)}>
                        <Trash2 size={14} /> Xóa
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowStepEditor(false)}>
                        ✓ Xong
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Navigation */}
              <div className="workflow-editor__wizard-nav">
                {wizardStep > 1 && (
                  <button className="btn btn-secondary" onClick={handleWizardBack} disabled={isGenerating || isCalibrating || isTesting}>
                    ← Quay lại
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleWizardNext}
                  disabled={!canProceedWizard() || isGenerating || isCalibrating || isTesting}
                >
                  {isGenerating || isCalibrating || isTesting ? (
                    <><RefreshCw size={16} className="spin" /> Đang xử lý...</>
                  ) : wizardStep >= 3 ? (
                    <><Save size={16} /> Lưu Workflow</>
                  ) : (
                    <>Tiếp theo →</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Generated Workflow Preview */}
          {generatedWorkflow && (
            <div className="workflow-editor__ai-result">
              <div className="workflow-editor__ai-result-header">
                <h4>✨ Workflow đã tạo</h4>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleUseGeneratedWorkflow}
                >
                  <CheckCircle size={14} />
                  Sử dụng & Chỉnh sửa
                </button>
              </div>
              <div className="workflow-editor__ai-preview">
                <div className="workflow-editor__ai-preview-item">
                  <strong>Tên:</strong> {generatedWorkflow.name}
                </div>
                <div className="workflow-editor__ai-preview-item">
                  <strong>Mô tả:</strong> {generatedWorkflow.description}
                </div>
                <div className="workflow-editor__ai-preview-item">
                  <strong>Inputs ({generatedWorkflow.inputs?.length || 0}):</strong>
                  <div className="workflow-editor__ai-variables">
                    {generatedWorkflow.inputs?.map((input, i) => (
                      <span key={i} className="workflow-editor__ai-var">
                        {input.label} ({input.type})
                      </span>
                    ))}
                  </div>
                </div>
                <div className="workflow-editor__ai-preview-item">
                  <strong>Steps ({generatedWorkflow.steps?.length || 0}):</strong>
                  <div className="workflow-editor__ai-steps">
                    {generatedWorkflow.steps?.map((step, i) => (
                      <div key={i} className="workflow-editor__ai-step">
                        <span className="workflow-editor__ai-step-num">{i + 1}</span>
                        <span className="workflow-editor__ai-step-type">{step.type}</span>
                        <span className="workflow-editor__ai-step-name">{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calibration Tab - LLM Vision */}
          {activeTab === 'calibrate' && !isEditing && (
            <div className="workflow-editor__calibrate-tab">
              <div className="workflow-editor__calibrate-intro">
                <Target size={32} className="workflow-editor__calibrate-icon" />
                <h3>Calibration Mode</h3>
                <p>
                  Sử dụng <strong>LLM Vision</strong> để phân tích màn hình thiết bị và tạo workflow với
                  <strong> coordinates chính xác</strong>. AI sẽ chụp screenshot, nhận diện các elements và
                  xác định điểm tap/swipe thực tế.
                </p>
              </div>

              <div className="workflow-editor__calibrate-device">
                <label>Thiết bị để calibration</label>
                <select
                  value={calibrationDeviceId}
                  onChange={e => setCalibrationDeviceId(e.target.value)}
                >
                  <option value="">Chọn thiết bị...</option>
                  {devices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.model || device.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="workflow-editor__calibrate-input">
                <label>Mô tả workflow</label>
                <textarea
                  value={calibrationDescription}
                  onChange={e => setCalibrationDescription(e.target.value)}
                  placeholder="Ví dụ: Tap vào nút Settings ở góc trên bên phải, sau đó scroll xuống và tap vào Privacy..."
                  rows={4}
                />
                <p className="workflow-editor__calibrate-hint">
                  💡 Mô tả chi tiết từng bước bạn muốn thực hiện. AI sẽ chụp màn hình hiện tại và xác định
                  chính xác vị trí của các elements.
                </p>
              </div>

              <div className="workflow-editor__calibrate-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleCalibrate}
                  disabled={isCalibrating || !calibrationDescription.trim() || !calibrationDeviceId || !activeProfile}
                >
                  {isCalibrating ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      Đang phân tích màn hình...
                    </>
                  ) : (
                    <>
                      <Camera size={16} />
                      Chụp & Phân tích
                    </>
                  )}
                </button>
              </div>

              {!activeProfile && (
                <p className="workflow-editor__calibrate-warning">
                  ⚠️ Vui lòng chọn Profile AI (hỗ trợ Vision: GPT-4o, Gemini, Claude) trước khi calibrate
                </p>
              )}

              {/* Calibration Result */}
              {calibrationResult && (
                <div className="workflow-editor__calibrate-result">
                  <div className="workflow-editor__calibrate-result-header">
                    <h4>
                      <Crosshair size={18} />
                      Kết quả Calibration
                    </h4>
                    <span className="workflow-editor__calibrate-confidence">
                      Độ tin cậy: {Math.round((calibrationResult.steps?.[0]?.confidence || 0.9) * 100)}%
                    </span>
                  </div>

                  <div className="workflow-editor__calibrate-steps">
                    <strong>Các bước đã phát hiện ({calibrationResult.totalSteps}):</strong>
                    {calibrationResult.steps?.map((step, i) => (
                      <div key={i} className="workflow-editor__calibrate-step">
                        <span className="step-num">{step.order + 1}</span>
                        <span className="step-action">{step.action}</span>
                        <span className="step-desc">{step.description}</span>
                        {step.params?.x && step.params?.y && (
                          <span className="step-coords">
                            ({step.params.x}, {step.params.y})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('steps')}
                  >
                    <CheckCircle size={14} />
                    Xem & Chỉnh sửa Steps
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="workflow-editor__section">
              <div className="form-group">
                <label>Tên workflow</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: TikTok Auto Engage"
                />
              </div>

              <div className="form-group">
                <label>Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả workflow..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Màu</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Timeout (s)</label>
                  <input
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                    min={60}
                    max={3600}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Inputs Tab */}
          {activeTab === 'inputs' && (
            <div className="workflow-editor__section">
              <div className="workflow-editor__section-header">
                <span>Input Variables</span>
                <button className="btn btn-sm btn-primary" onClick={addInput}>
                  <Plus size={14} />
                  Thêm Input
                </button>
              </div>

              {formData.inputs.length === 0 ? (
                <div className="workflow-editor__empty">
                  <p>Chưa có input nào</p>
                  <span>Thêm input để cho phép người dùng tùy chỉnh workflow</span>
                </div>
              ) : (
                <div className="workflow-editor__inputs-list">
                  {formData.inputs.map((input, index) => (
                    <div key={index} className="workflow-editor__input-item">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Tên biến</label>
                          <input
                            type="text"
                            value={input.name}
                            onChange={(e) => updateInput(index, 'name', e.target.value)}
                            placeholder="video_count"
                          />
                        </div>
                        <div className="form-group">
                          <label>Label</label>
                          <input
                            type="text"
                            value={input.label || ''}
                            onChange={(e) => updateInput(index, 'label', e.target.value)}
                            placeholder="Số video"
                          />
                        </div>
                        <div className="form-group">
                          <label>Kiểu</label>
                          <select
                            value={input.input_type}
                            onChange={(e) => updateInput(index, 'input_type', e.target.value)}
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="text">Text (multiline)</option>
                            <option value="select">Select</option>
                          </select>
                        </div>
                        <button
                          className="btn btn-icon btn-ghost btn-danger"
                          onClick={() => removeInput(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Steps Tab */}
          {activeTab === 'steps' && (
            <div className="workflow-editor__section">
              <div className="workflow-editor__section-header">
                <span>Workflow Steps</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowAIRefine(true)}
                    title="Dùng AI để chỉnh sửa steps"
                  >
                    <Sparkles size={14} />
                    AI Refine
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowRandomTimeModal(true)}
                    title="Auto random thời gian chờ giữa các action"
                  >
                    <Timer size={14} />
                    Random Time
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowAddStep(true)}
                  >
                    <Plus size={14} />
                    Thêm Step
                  </button>
                </div>
              </div>

              {formData.steps.length === 0 ? (
                <div className="workflow-editor__empty">
                  <p>Chưa có step nào</p>
                  <span>Thêm step để định nghĩa các bước thực thi</span>
                </div>
              ) : (
                <div className="workflow-editor__steps-list">
                  {formData.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="workflow-editor__step-item workflow-editor__step-item--editable"
                      onClick={() => openStepEditor(index)}
                    >
                      <span className="workflow-editor__step-num">{index + 1}</span>
                      <div className="workflow-editor__step-icon" style={{
                        backgroundColor: `${STEP_COLORS[step.type]}20`,
                        color: STEP_COLORS[step.type]
                      }}>
                        {React.createElement(STEP_ICONS[step.type] || Zap, { size: 16 })}
                      </div>
                      <div className="workflow-editor__step-info">
                        <span className="workflow-editor__step-name">{step.name || step.action || step.type}</span>
                        <span className="workflow-editor__step-type">{step.type}</span>
                      </div>
                      {/* Show params preview */}
                      {step.params?.x && step.params?.y && (
                        <span className="workflow-editor__step-coords">
                          ({step.params.x}, {step.params.y})
                        </span>
                      )}
                      {(step.params?.duration || step.duration) && (
                        <span className="workflow-editor__step-duration">
                          {step.params?.duration || step.duration}s
                        </span>
                      )}
                      {/* Show wait after - clickable to edit */}
                      {step.waitAfter && (
                        <button
                          className="workflow-editor__step-wait workflow-editor__step-wait--editable"
                          title="Click để chỉnh thời gian chờ"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStepEditor(index);
                          }}
                        >
                          ⏳{step.waitAfter >= 1000 ? `${(step.waitAfter/1000).toFixed(1)}s` : `${step.waitAfter}ms`}
                          {step.waitVariance > 0 && <span className="variance-indicator">±{Math.round(step.waitVariance * 100)}%</span>}
                        </button>
                      )}
                      <div className="workflow-editor__step-actions">
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={(e) => { e.stopPropagation(); openStepEditor(index); }}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={(e) => { e.stopPropagation(); moveStep(index, 'up'); }}
                          disabled={index === 0}
                          title="Di chuyển lên"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={(e) => { e.stopPropagation(); moveStep(index, 'down'); }}
                          disabled={index === formData.steps.length - 1}
                          title="Di chuyển xuống"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Xóa step này?')) {
                              setFormData(prev => ({
                                ...prev,
                                steps: prev.steps.filter(s => s.id !== step.id)
                              }));
                            }
                          }}
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Step Modal */}
              {showAddStep && (
                <div className="workflow-editor__add-step">
                  <h4>Chọn loại Step</h4>
                  <div className="workflow-editor__step-types">
                    {Object.keys(STEP_TYPES).map(type => {
                      const Icon = STEP_ICONS[type.toLowerCase()] || Zap;
                      return (
                        <button
                          key={type}
                          className="workflow-editor__step-type-btn"
                          onClick={() => addStep(type.toLowerCase())}
                        >
                          <Icon size={20} />
                          <span>{type}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setShowAddStep(false)}
                  >
                    Hủy
                  </button>
                </div>
              )}

              {/* Random Time Modal */}
              {showRandomTimeModal && (
                <div className="modal-overlay" onClick={() => setShowRandomTimeModal(false)}>
                  <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal__header">
                      <h3><Timer size={18} /> Random Time Settings</h3>
                      <button className="btn btn--icon" onClick={() => setShowRandomTimeModal(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="modal__body">
                      <p style={{ marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                        Nhập phạm vi phần trăm dao động cho thời gian chờ:
                      </p>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <label style={{ flex: 1 }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Từ (%)</span>
                          <input
                            type="number"
                            className="input"
                            min={0}
                            max={100}
                            value={randomTimeConfig.minPercent}
                            onChange={(e) => setRandomTimeConfig(prev => ({ ...prev, minPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                          />
                        </label>
                        <span style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>đến</span>
                        <label style={{ flex: 1 }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Đến (%)</span>
                          <input
                            type="number"
                            className="input"
                            min={0}
                            max={100}
                            value={randomTimeConfig.maxPercent}
                            onChange={(e) => setRandomTimeConfig(prev => ({ ...prev, maxPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                          />
                        </label>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                        Mỗi step sẽ có variance ngẫu nhiên trong khoảng {randomTimeConfig.minPercent}% - {randomTimeConfig.maxPercent}%
                      </p>
                    </div>
                    <div className="modal__footer">
                      <button className="btn btn-ghost" onClick={() => setShowRandomTimeModal(false)}>
                        Hủy
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const minVar = randomTimeConfig.minPercent / 100;
                          const maxVar = randomTimeConfig.maxPercent / 100;
                          
                          const getSmartTiming = (action) => {
                            const timings = {
                              'start_app': { base: 2500 },
                              'tap': { base: 600 + Math.random() * 400 },
                              'input_text': { base: 800 + Math.random() * 400 },
                              'key_press': { base: 400 + Math.random() * 200 },
                              'swipe': { base: 800 + Math.random() * 400 },
                              'swipe_up': { base: 1000 + Math.random() * 500 },
                              'swipe_down': { base: 1000 + Math.random() * 500 },
                              'long_press': { base: 1000 + Math.random() * 300 },
                              'back': { base: 500 + Math.random() * 200 },
                              'home': { base: 800 + Math.random() * 300 },
                              'wait': { base: 1000 },
                            };
                            return timings[action] || { base: 800 + Math.random() * 400 };
                          };

                          const updatedSteps = formData.steps.map((step, idx) => {
                            const timing = getSmartTiming(step.action || step.type);
                            const extraDelay = idx === 0 ? 500 : 0;
                            const randomVariance = minVar + Math.random() * (maxVar - minVar);
                            return {
                              ...step,
                              waitAfter: Math.round(timing.base + extraDelay),
                              waitVariance: randomVariance,
                            };
                          });

                          // Update form data
                          const updatedFormData = { ...formData, steps: updatedSteps };
                          setFormData(updatedFormData);
                          
                          // Save to store immediately
                          if (onSaveOnly) {
                            onSaveOnly(updatedFormData);
                            // Update initial ref so it's not considered "unsaved"
                            initialDataRef.current = JSON.stringify({
                              name: updatedFormData.name,
                              description: updatedFormData.description,
                              color: updatedFormData.color,
                              timeout: updatedFormData.timeout,
                              inputs: updatedFormData.inputs,
                              steps: updatedFormData.steps,
                            });
                            setHasUnsavedChanges(false);
                          }
                          
                          setShowRandomTimeModal(false);
                          alert(`✅ Đã random và LƯU thời gian cho ${updatedSteps.length} steps!\n\nMỗi action có variance từ ${randomTimeConfig.minPercent}% đến ${randomTimeConfig.maxPercent}%.`);
                        }}
                        disabled={randomTimeConfig.minPercent > randomTimeConfig.maxPercent}
                      >
                        <Timer size={14} /> Áp dụng
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Refine Modal */}
              {showAIRefine && (
                <div className="modal-overlay" onClick={() => setShowAIRefine(false)}>
                  <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal__header">
                      <h3><Sparkles size={18} /> AI Refine Steps</h3>
                      <button className="btn btn--icon" onClick={() => setShowAIRefine(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="modal__body">
                      <p style={{ marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                        Mô tả những thay đổi bạn muốn AI thực hiện với workflow steps:
                      </p>
                      <textarea
                        className="input"
                        rows={4}
                        placeholder="Ví dụ: Thêm wait 2 giây sau mỗi tap, hoặc thay đổi tọa độ tap đầu tiên..."
                        value={aiRefinePrompt}
                        onChange={(e) => setAiRefinePrompt(e.target.value)}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                      {aiRefineError && (
                        <div style={{ color: 'var(--error)', fontSize: '13px', marginTop: 'var(--space-2)' }}>
                          {aiRefineError}
                        </div>
                      )}
                    </div>
                    <div className="modal__footer">
                      <button className="btn btn-ghost" onClick={() => setShowAIRefine(false)}>
                        Hủy
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleAIRefine}
                        disabled={isAIRefining || !aiRefinePrompt.trim()}
                      >
                        {isAIRefining ? (
                          <><RefreshCw size={14} className="spin" /> Đang xử lý...</>
                        ) : (
                          <><Sparkles size={14} /> Refine với AI</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Editor Modal - reuse from AI wizard */}
              {showStepEditor && editStepIndex !== null && formData.steps[editStepIndex] && (
                <div className="modal-overlay" onClick={() => setShowStepEditor(false)}>
                  <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal__header">
                      <h3>Chỉnh sửa Step {editStepIndex + 1}</h3>
                      <button className="btn btn--icon" onClick={() => setShowStepEditor(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {/* Step Name */}
                      <label>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên</span>
                        <input
                          type="text"
                          className="input"
                          value={formData.steps[editStepIndex].name || ''}
                          onChange={(e) => updateStep(editStepIndex, { name: e.target.value })}
                        />
                      </label>

                      {/* Action Type */}
                      <label>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Action</span>
                        <select
                          className="input"
                          value={formData.steps[editStepIndex].action || formData.steps[editStepIndex].type}
                          onChange={(e) => updateStep(editStepIndex, { action: e.target.value, type: e.target.value === 'wait' ? 'wait' : 'action' })}
                        >
                          <option value="tap">tap</option>
                          <option value="swipe">swipe</option>
                          <option value="swipe_up">swipe_up</option>
                          <option value="swipe_down">swipe_down</option>
                          <option value="type">type</option>
                          <option value="wait">wait</option>
                          <option value="back">back</option>
                          <option value="home">home</option>
                        </select>
                      </label>

                      {/* Params based on action type */}
                      {(formData.steps[editStepIndex].action === 'tap' || formData.steps[editStepIndex].type === 'action') && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <label style={{ flex: 1 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>X</span>
                            <input
                              type="number"
                              className="input"
                              value={formData.steps[editStepIndex].params?.x || ''}
                              onChange={(e) => updateStepParam(editStepIndex, 'x', parseInt(e.target.value) || 0)}
                            />
                          </label>
                          <label style={{ flex: 1 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Y</span>
                            <input
                              type="number"
                              className="input"
                              value={formData.steps[editStepIndex].params?.y || ''}
                              onChange={(e) => updateStepParam(editStepIndex, 'y', parseInt(e.target.value) || 0)}
                            />
                          </label>
                        </div>
                      )}

                      {formData.steps[editStepIndex].action === 'wait' || formData.steps[editStepIndex].type === 'wait' ? (
                        <label>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Duration (giây)</span>
                          <input
                            type="number"
                            step="0.1"
                            className="input"
                            value={formData.steps[editStepIndex].params?.duration || formData.steps[editStepIndex].duration || 1}
                            onChange={(e) => updateStepParam(editStepIndex, 'duration', parseFloat(e.target.value) || 1)}
                          />
                        </label>
                      ) : null}

                      {formData.steps[editStepIndex].action === 'type' && (
                        <label>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Text</span>
                          <input
                            type="text"
                            className="input"
                            value={formData.steps[editStepIndex].params?.text || ''}
                            onChange={(e) => updateStepParam(editStepIndex, 'text', e.target.value)}
                          />
                        </label>
                      )}

                      {formData.steps[editStepIndex].action === 'swipe' && (
                        <>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <label style={{ flex: 1 }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start X</span>
                              <input
                                type="number"
                                className="input"
                                value={formData.steps[editStepIndex].params?.x1 || formData.steps[editStepIndex].params?.x || ''}
                                onChange={(e) => updateStepParam(editStepIndex, 'x1', parseInt(e.target.value) || 0)}
                              />
                            </label>
                            <label style={{ flex: 1 }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start Y</span>
                              <input
                                type="number"
                                className="input"
                                value={formData.steps[editStepIndex].params?.y1 || formData.steps[editStepIndex].params?.y || ''}
                                onChange={(e) => updateStepParam(editStepIndex, 'y1', parseInt(e.target.value) || 0)}
                              />
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <label style={{ flex: 1 }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End X</span>
                              <input
                                type="number"
                                className="input"
                                value={formData.steps[editStepIndex].params?.x2 || ''}
                                onChange={(e) => updateStepParam(editStepIndex, 'x2', parseInt(e.target.value) || 0)}
                              />
                            </label>
                            <label style={{ flex: 1 }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End Y</span>
                              <input
                                type="number"
                                className="input"
                                value={formData.steps[editStepIndex].params?.y2 || ''}
                                onChange={(e) => updateStepParam(editStepIndex, 'y2', parseInt(e.target.value) || 0)}
                              />
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="modal__footer" style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn--secondary" onClick={() => moveStep(editStepIndex, 'up')} disabled={editStepIndex === 0}>
                          ↑ Lên
                        </button>
                        <button className="btn btn--secondary" onClick={() => moveStep(editStepIndex, 'down')} disabled={editStepIndex === formData.steps.length - 1}>
                          ↓ Xuống
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn--danger" onClick={() => deleteStep(editStepIndex)}>
                          <Trash2 size={14} /> Xóa
                        </button>
                        <button className="btn btn--primary" onClick={() => setShowStepEditor(false)}>
                          ✓ Xong
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Python Tab */}
          {activeTab === 'python' && (
            <div className="workflow-editor__section workflow-editor__python">
              <div className="workflow-editor__section-header">
                <span>Python Script Template</span>
              </div>
              <div className="workflow-editor__python-help">
                <p>Các biến có sẵn trong Python script:</p>
                <ul>
                  <li><code>inputs</code> - Dictionary chứa input values</li>
                  <li><code>context</code> - Dictionary chứa context/variables</li>
                  <li><code>device_id</code> - ID thiết bị đang chạy</li>
                  <li><code>device</code> - DroidRun DeviceHelper (nếu có)</li>
                </ul>
                <p>Sử dụng <code>return {"{...}"}</code> để trả về kết quả</p>
              </div>
              <div className="workflow-editor__python-example">
                <h5>Ví dụ:</h5>
                <pre>{`# Get input values
video_count = inputs.get('video_count', 10)

# Random wait time
import random
wait_time = random.uniform(3, 8)

# Return result
return {
    "videos_processed": video_count,
    "wait_time": wait_time
}`}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}