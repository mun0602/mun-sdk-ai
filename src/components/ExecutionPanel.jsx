// ExecutionPanel - ChatGPT-style Interface
import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Square,
  Smartphone,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle,
  Image,
  Zap,
  X,
  Terminal,
  Settings,
  Heart,
  MessageCircle,
  GitBranch,
  Repeat,
  Monitor,
} from 'lucide-react';
import { useDeviceStore, useProfileStore, useTaskStore, useSkillStore, useSettingsStore, useWorkflowStore } from '../store';
import { invoke, listen } from '../tauri-mock';
import MultiDeviceView from './MultiDeviceView';
import { getModelDisplayName } from '../constants/providers';

// Message bubble component
function MessageBubble({ type, content, status, timestamp }) {
  const isUser = type === 'user';
  const isSystem = type === 'system';

  return (
    <div className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-ai'}`}>
      <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="chat-bubble-wrapper">
        <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
          {isSystem ? (
            <div className="chat-system-message">
              {status === 'running' && <Loader2 size={14} className="spin" />}
              {status === 'success' && <Check size={14} className="text-success" />}
              {status === 'error' && <AlertCircle size={14} className="text-error" />}
              <span>{content}</span>
            </div>
          ) : (
            <div className="chat-content">{content}</div>
          )}
        </div>
        {timestamp && (
          <div className="chat-time">{timestamp}</div>
        )}
      </div>
    </div>
  );
}

// Device selector dropdown
function DeviceSelector({ devices, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const count = selected.length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(d => d !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="chat-selector" ref={ref}>
      <button
        className="chat-selector-trigger"
        onClick={() => setOpen(!open)}
      >
        <span>{count === 0 ? 'Thiết bị' : `${count} thiết bị`}</span>
        <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="chat-selector-dropdown">
          {devices.length === 0 ? (
            <div className="chat-selector-empty">Chưa có thiết bị kết nối</div>
          ) : (
            devices.map(d => (
              <label key={d.id} className="chat-selector-item">
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={() => toggle(d.id)}
                />
                <span className="chat-device-dot" />
                <span>{d.model || d.id.split(':')[0]}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Model/Profile selector dropdown
function ModelSelector({ profiles, activeProfile, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="chat-selector" ref={ref}>
      <button
        className="chat-selector-trigger"
        onClick={() => setOpen(!open)}
      >
        <span>{activeProfile ? getModelDisplayName(activeProfile.provider.name, activeProfile.provider.model) : 'Model'}</span>
        <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="chat-selector-dropdown chat-model-dropdown">
          {profiles.length === 0 ? (
            <div className="chat-selector-empty">Chưa có profile nào</div>
          ) : (
            profiles.map(p => (
              <button
                key={p.id}
                className={`chat-model-item ${activeProfile?.id === p.id ? 'active' : ''}`}
                onClick={() => { onSelect(p.id); setOpen(false); }}
              >
                <div className="chat-model-info">
                  <div className="chat-model-name">{p.name}</div>
                  <div className="chat-model-detail">{p.provider.name} · {getModelDisplayName(p.provider.name, p.provider.model)}</div>
                </div>
                {activeProfile?.id === p.id && <Check size={14} className="text-success" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Icon mapping for skills
const SKILL_ICONS = {
  heart: Heart,
  smartphone: Smartphone,
  message: MessageCircle,
  zap: Zap,
  settings: Settings,
  sparkles: Sparkles,
};

// Skill selector dropdown (replaces template selector)
function SkillSelector({ skills, selected, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="chat-selector chat-skill-selector" ref={ref}>
      <button
        className={`chat-selector-trigger ${selected ? 'chat-selector-active' : ''}`}
        onClick={() => setOpen(!open)}
        style={selected ? { borderColor: selected.color, background: `${selected.color}10` } : {}}
      >
        <span>{selected ? selected.name : 'Skill'}</span>
        {selected ? (
          <button
            className="chat-selector-clear"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
        )}
      </button>

      {open && (
        <div className="chat-selector-dropdown chat-skill-dropdown">
          {skills.length === 0 ? (
            <div className="chat-selector-empty">
              <Sparkles size={16} />
              <span>Chưa có skill</span>
              <small>Tạo skill trong menu Skills</small>
            </div>
          ) : (
            <>
              <div className="chat-skill-hint">
                Skills giúp AI thực hiện task phức tạp với tham số tùy chỉnh
              </div>
              {skills.map(skill => {
                const IconComponent = SKILL_ICONS[skill.icon] || Sparkles;
                return (
                  <button
                    key={skill.id}
                    className={`chat-skill-item ${selected?.id === skill.id ? 'active' : ''}`}
                    onClick={() => { onSelect(skill); setOpen(false); }}
                  >
                    <div
                      className="chat-skill-icon"
                      style={{ background: `${skill.color}15`, color: skill.color }}
                    >
                      <IconComponent size={16} />
                    </div>
                    <div className="chat-skill-info">
                      <div className="chat-skill-name">{skill.name}</div>
                      <div className="chat-skill-desc">{skill.description}</div>
                      <div className="chat-skill-vars">
                        {skill.variables.slice(0, 3).map(v => (
                          <span key={v.id} className="chat-skill-var">{v.label}</span>
                        ))}
                        {skill.variables.length > 3 && (
                          <span className="chat-skill-var-more">+{skill.variables.length - 3}</span>
                        )}
                      </div>
                    </div>
                    {selected?.id === skill.id && <Check size={14} className="text-success" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Workflow selector dropdown
function WorkflowSelector({ workflows, selected, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="chat-selector chat-workflow-selector" ref={ref}>
      <button
        className={`chat-selector-trigger ${selected ? 'chat-selector-active' : ''}`}
        onClick={() => setOpen(!open)}
        style={selected ? { borderColor: selected.color, background: `${selected.color}10` } : {}}
      >
        <span>{selected ? selected.name : 'Workflow'}</span>
        {selected ? (
          <button
            className="chat-selector-clear"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
        )}
      </button>

      {open && (
        <div className="chat-selector-dropdown chat-workflow-dropdown">
          {workflows.length === 0 ? (
            <div className="chat-selector-empty">
              <GitBranch size={16} />
              <span>Chưa có workflow</span>
              <small>Tạo workflow trong menu Workflow</small>
            </div>
          ) : (
            <>
              <div className="chat-workflow-hint">
                Workflow là chuỗi nhiều bước tự động hóa
              </div>
              {workflows.map(workflow => (
                <button
                  key={workflow.id}
                  className={`chat-workflow-item ${selected?.id === workflow.id ? 'active' : ''}`}
                  onClick={() => { onSelect(workflow); setOpen(false); }}
                >
                  <div
                    className="chat-workflow-icon"
                    style={{ background: `${workflow.color}15`, color: workflow.color }}
                  >
                    <GitBranch size={16} />
                  </div>
                  <div className="chat-workflow-info">
                    <div className="chat-workflow-name">{workflow.name}</div>
                    <div className="chat-workflow-desc">{workflow.description}</div>
                    <div className="chat-workflow-meta">
                      <span className="chat-workflow-steps">
                        <Repeat size={10} /> {workflow.steps?.length || 0} steps
                      </span>
                      {workflow.inputs?.length > 0 && (
                        <span className="chat-workflow-inputs">
                          {workflow.inputs.length} inputs
                        </span>
                      )}
                    </div>
                  </div>
                  {selected?.id === workflow.id && <Check size={14} className="text-success" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Skill Variables Input Modal
function SkillVariablesModal({ skill, onRun, onClose }) {
  const [variables, setVariables] = useState(() => {
    const initial = {};
    skill.variables.forEach(v => {
      initial[v.name] = v.default;
    });
    return initial;
  });

  const updateVariable = (name, value) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const isVariableVisible = (v) => {
    if (!v.dependsOn) return true;
    return variables[v.dependsOn] === true;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="skill-vars-modal" onClick={e => e.stopPropagation()}>
        <div className="skill-vars-modal__header">
          <h3>Cấu hình: {skill.name}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="skill-vars-modal__body">
          {skill.variables.filter(isVariableVisible).map(v => (
            <div key={v.id} className="skill-vars-modal__field">
              <label>{v.label}</label>
              {v.type === 'boolean' && (
                <label className="skill-vars-modal__toggle">
                  <input
                    type="checkbox"
                    checked={variables[v.name]}
                    onChange={e => updateVariable(v.name, e.target.checked)}
                  />
                  <span>{variables[v.name] ? 'Bật' : 'Tắt'}</span>
                </label>
              )}
              {v.type === 'number' && (
                <input
                  type="number"
                  value={variables[v.name]}
                  onChange={e => updateVariable(v.name, Number(e.target.value))}
                  min={v.min}
                  max={v.max}
                />
              )}
              {v.type === 'string' && (
                <input
                  type="text"
                  value={variables[v.name]}
                  onChange={e => updateVariable(v.name, e.target.value)}
                  placeholder={v.placeholder}
                />
              )}
              {v.type === 'text' && (
                <textarea
                  value={variables[v.name]}
                  onChange={e => updateVariable(v.name, e.target.value)}
                  placeholder={v.placeholder}
                  rows={3}
                />
              )}
              {v.type === 'select' && (
                <select
                  value={variables[v.name]}
                  onChange={e => updateVariable(v.name, e.target.value)}
                >
                  {v.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <div className="skill-vars-modal__footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={() => onRun(variables)}>
            <Zap size={14} />
            Chạy Skill
          </button>
        </div>
      </div>
    </div>
  );
}

// Workflow Inputs Modal
function WorkflowInputsModal({ workflow, onRun, onClose }) {
  const [inputs, setInputs] = useState(() => {
    const initial = {};
    (workflow.inputs || []).forEach(input => {
      initial[input.name] = input.default ?? '';
    });
    return initial;
  });

  const updateInput = (name, value) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="skill-vars-modal" onClick={e => e.stopPropagation()}>
        <div className="skill-vars-modal__header">
          <h3>Cấu hình: {workflow.name}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="skill-vars-modal__body">
          {(workflow.inputs || []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              Workflow này không có inputs cần cấu hình
            </p>
          ) : (
            (workflow.inputs || []).map(input => (
              <div key={input.name} className="skill-vars-modal__field">
                <label>{input.label || input.name}</label>
                {input.type === 'boolean' && (
                  <label className="skill-vars-modal__toggle">
                    <input
                      type="checkbox"
                      checked={inputs[input.name]}
                      onChange={e => updateInput(input.name, e.target.checked)}
                    />
                    <span>{inputs[input.name] ? 'Bật' : 'Tắt'}</span>
                  </label>
                )}
                {input.type === 'number' && (
                  <input
                    type="number"
                    value={inputs[input.name]}
                    onChange={e => updateInput(input.name, Number(e.target.value))}
                    min={input.min}
                    max={input.max}
                  />
                )}
                {(input.type === 'string' || !input.type) && (
                  <input
                    type="text"
                    value={inputs[input.name]}
                    onChange={e => updateInput(input.name, e.target.value)}
                    placeholder={input.placeholder || input.label}
                  />
                )}
              </div>
            ))
          )}
        </div>
        <div className="skill-vars-modal__footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={() => onRun(inputs)}>
            <GitBranch size={14} />
            Chạy Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExecutionPanel() {
  const { devices } = useDeviceStore();
  const { skills, compilePrompt, compileGuidance } = useSkillStore();
  const { workflows, runWorkflowPython } = useWorkflowStore();
  const { activeProfile, profiles, loadProfiles, setActiveProfile } = useProfileStore();
  const { runTask, runParallelTasks, stopTasks, isRunning, logs, clearLogs, cleanupOutputListener } = useTaskStore();
  const { maxParallelDevices, tracing } = useSettingsStore();

  const [selectedDevices, setSelectedDevices] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showWorkflowInputs, setShowWorkflowInputs] = useState(false);
  const [showSkillVars, setShowSkillVars] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [enhancing, setEnhancing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showMultiDeviceView, setShowMultiDeviceView] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (profiles.length === 0) loadProfiles();
  }, [profiles.length, loadProfiles]);

  useEffect(() => {
    return () => cleanupOutputListener();
  }, [cleanupOutputListener]);

  // Listen for agent-result event to show final answer
  useEffect(() => {
    let unlisten = null;

    const setupListener = async () => {
      unlisten = await listen('agent-result', (event) => {
        const { success, reason, steps } = event.payload;

        // Build result message with steps info
        let content = reason || (success ? 'Task hoàn thành!' : 'Task thất bại');
        if (steps && steps > 0) {
          content = `${content}\n\n📊 Đã thực hiện ${steps} bước`;
        }

        setMessages(prev => {
          // Remove the "running" message and add the actual result
          const filtered = prev.filter(m => m.status !== 'running');
          return [...filtered, {
            type: 'ai',
            content,
            status: success ? 'success' : 'error',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }];
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll logs to bottom
  useEffect(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // Convert logs to AI messages
  useEffect(() => {
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      const message = typeof lastLog.message === 'string' ? lastLog.message : String(lastLog.message || '');
      // Only add significant logs as messages
      if (message.includes('SUCCESS') ||
        message.includes('ERROR') ||
        message.includes('completed') ||
        message.includes('Starting')) {

        const status = lastLog.level === 'error' ? 'error'
          : lastLog.level === 'success' ? 'success' : 'running';

        setMessages(prev => {
          const last = prev[prev.length - 1];
          // Update last system message if it's still running
          if (last?.type === 'system' && last?.status === 'running') {
            return [...prev.slice(0, -1), {
              ...last,
              content: formatLogMessage(message),
              status,
            }];
          }
          return [...prev, {
            type: 'system',
            content: formatLogMessage(message),
            status,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }];
        });
      }
    }
  }, [logs]);

  const formatLogMessage = (msg) => {
    // Clean up log messages to be more friendly
    return msg
      .replace(/\[DroidRun\]\s*/g, '')
      .replace(/\[127\.0\.0\.1:\d+\]\s*/g, '')
      .replace(/\[WARN\]\s*/g, '⚠️ ')
      .replace(/\[ERROR\]\s*/g, '❌ ')
      .replace(/\[SUCCESS\]\s*/g, '✅ ')
      .trim();
  };

  const handleEnhance = async () => {
    if (!prompt.trim() || !activeProfile) return;

    setEnhancing(true);
    try {
      const enhanced = await invoke('enhance_prompt', {
        provider: activeProfile.provider.name,
        apiKey: activeProfile.provider.api_key,
        model: activeProfile.provider.model,
        prompt: prompt.trim(),
        baseUrl: activeProfile.provider.base_url || null,
      });
      if (enhanced?.trim()) setPrompt(enhanced);
    } catch (e) {
      console.error('Enhance failed:', e);
    } finally {
      setEnhancing(false);
    }
  };

  const handleSend = async (skillVariables = null, workflowInputs = null) => {
    // Validate - need either prompt, skill, or workflow
    if (!prompt.trim() && !selectedSkill && !selectedWorkflow) return;
    if (selectedDevices.length === 0 || !activeProfile) return;

    let userMessage = prompt.trim();
    let finalPrompt = userMessage;

    // Handle Workflow execution
    if (selectedWorkflow) {
      const { runWorkflow } = useWorkflowStore.getState();

      // Add user message
      setMessages(prev => [...prev, {
        type: 'user',
        content: `[Workflow] ${selectedWorkflow.name}${userMessage ? `: ${userMessage}` : ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);

      // Add running message
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Running workflow on ${selectedDevices.length} device(s)...`,
        status: 'running',
      }]);

      setPrompt('');
      setShowWorkflowInputs(false);
      clearLogs();

      try {
        // Run workflow on each device using Python executor
        for (const deviceId of selectedDevices) {
          const result = await runWorkflowPython(selectedWorkflow.id, workflowInputs || {}, deviceId);

          setMessages(prev => {
            const filtered = prev.filter(m => m.status !== 'running');
            return [...filtered, {
              type: 'ai',
              content: result.success
                ? `✅ Workflow hoàn thành! (${result.stepsExecuted || 0} steps)`
                : `❌ Workflow thất bại: ${result.error || 'Unknown error'}`,
              status: result.success ? 'success' : 'error',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }];
          });
        }
      } catch (e) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.status !== 'running');
          return [...filtered, {
            type: 'ai',
            content: `❌ Lỗi chạy workflow: ${e}`,
            status: 'error',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }];
        });
      }
      return;
    }

    // Build final prompt with skill (replaces template logic)
    if (selectedSkill) {
      finalPrompt = compilePrompt(selectedSkill.id, skillVariables || {});
      if (userMessage) {
        finalPrompt = `${finalPrompt}\n\nAdditional instructions: ${userMessage}`;
      }
      userMessage = userMessage || `Chạy skill: ${selectedSkill.name}`;
    }

    if (!finalPrompt) return;

    // Add AI guidance from enabled skills
    const aiGuidance = compileGuidance();
    if (aiGuidance) {
      finalPrompt = `${aiGuidance}\n\n=== TASK ===\n${finalPrompt}`;
    }

    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      content: selectedSkill
        ? `[${selectedSkill.name}] ${userMessage}`
        : userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);

    // Add AI thinking message
    setMessages(prev => [...prev, {
      type: 'system',
      content: `Running on ${selectedDevices.length} device${selectedDevices.length > 1 ? 's' : ''}...`,
      status: 'running',
    }]);

    setPrompt('');
    setShowSkillVars(false);
    clearLogs();

    const tracingParams = tracing.enabled ? {
      enabled: true,
      provider: tracing.provider,
      phoenixUrl: tracing.phoenixUrl,
      phoenixProjectName: tracing.phoenixProjectName,
      langfuseSecretKey: tracing.langfuseSecretKey,
      langfusePublicKey: tracing.langfusePublicKey,
      langfuseHost: tracing.langfuseHost,
      langfuseUserId: tracing.langfuseUserId,
      saveTrajectory: tracing.saveTrajectory,
    } : { enabled: false, provider: 'none', saveTrajectory: tracing.saveTrajectory };

    const taskParams = {
      provider: activeProfile.provider.name,
      api_key: activeProfile.provider.api_key,
      model: activeProfile.provider.model,
      prompt: finalPrompt,
      max_steps: selectedSkill?.timeout ? Math.floor(selectedSkill.timeout / 10) : activeProfile.max_steps,
      base_url: activeProfile.provider.base_url,
      vision: activeProfile.vision ?? true,
      reasoning: activeProfile.reasoning ?? false,
      tracing: tracingParams,
    };

    // Show multi-device view when running on multiple devices
    if (selectedDevices.length > 1) {
      setShowMultiDeviceView(true);
    }

    try {
      if (selectedDevices.length === 1) {
        await runTask({ device_id: selectedDevices[0], ...taskParams });
      } else {
        await runParallelTasks(selectedDevices, taskParams, maxParallelDevices);
      }

      // Note: The actual result/answer will be shown via agent-result event listener
      // Only add fallback message if no result event was received after a short delay
      setTimeout(() => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          // Only add generic success if still showing "running" (no result event received)
          if (last?.status === 'running') {
            return [...prev.slice(0, -1), {
              type: 'ai',
              content: `Task hoàn thành! Kiểm tra log để xem chi tiết.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }];
          }
          return prev;
        });
      }, 500);
    } catch (e) {
      setMessages(prev => [...prev, {
        type: 'ai',
        content: `Có lỗi xảy ra: ${e}`,
        status: 'error',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = prompt.trim() && selectedDevices.length > 0 && activeProfile && !isRunning;

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        {/* Logo on the left */}
        <div className="chat-header-left">
          <div className="chat-header-avatar">
            <Bot size={20} />
          </div>
          <div>
            <div className="chat-header-title">DroidRun AI</div>
            <div className="chat-header-subtitle">
              {activeProfile ? `${activeProfile.provider.name}` : 'No profile selected'}
            </div>
          </div>
        </div>

        {/* Selectors on the right: Model, Skill, Device */}
        <div className="chat-header-selectors">
          <ModelSelector
            profiles={profiles}
            activeProfile={activeProfile}
            onSelect={setActiveProfile}
          />
          <SkillSelector
            skills={skills}
            selected={selectedSkill}
            onSelect={(skill) => {
              setSelectedSkill(skill);
              setSelectedWorkflow(null); // Clear workflow when selecting skill
              // If skill has variables, show modal
              if (skill.variables.length > 0) {
                setShowSkillVars(true);
              }
            }}
            onClear={() => setSelectedSkill(null)}
          />
          <WorkflowSelector
            workflows={workflows}
            selected={selectedWorkflow}
            onSelect={(workflow) => {
              setSelectedWorkflow(workflow);
              setSelectedSkill(null); // Clear skill when selecting workflow
              if (workflow.inputs?.length > 0) {
                setShowWorkflowInputs(true);
              }
            }}
            onClear={() => setSelectedWorkflow(null)}
          />
          <DeviceSelector
            devices={devices}
            selected={selectedDevices}
            onChange={setSelectedDevices}
          />
        </div>
      </div>

      {/* Skill Variables Modal */}
      {showSkillVars && selectedSkill && (
        <SkillVariablesModal
          skill={selectedSkill}
          onRun={(vars) => handleSend(vars)}
          onClose={() => setShowSkillVars(false)}
        />
      )}

      {/* Workflow Inputs Modal */}
      {showWorkflowInputs && selectedWorkflow && (
        <WorkflowInputsModal
          workflow={selectedWorkflow}
          onRun={(inputs) => handleSend(null, inputs)}
          onClose={() => setShowWorkflowInputs(false)}
        />
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Bot size={48} />
            </div>
            <h3>Bạn muốn làm gì?</h3>
            <p>Nhập lệnh để điều khiển thiết bị Android của bạn.</p>
            <div className="chat-suggestions">
              {[
                'Mở Facebook và lướt bảng tin',
                'Chụp ảnh màn hình',
                'Mở Cài đặt và kiểm tra pin',
              ].map((s, i) => (
                <button
                  key={i}
                  className="chat-suggestion"
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} {...msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        {/* Logs Panel - Show when tracing enabled */}
        {tracing.enabled && (
          <div className="chat-logs-section">
            <button
              className="chat-logs-toggle"
              onClick={() => setShowLogs(!showLogs)}
            >
              <Terminal size={14} />
              <span>Logs {logs.length > 0 && `(${logs.length})`}</span>
              {showLogs ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {showLogs && (
              <div className="chat-logs-container">
                {logs.length === 0 ? (
                  <div className="chat-logs-empty">Chưa có log nào</div>
                ) : (
                  <>
                    {logs.map((log, i) => (
                      <div key={i} className={`chat-log-item chat-log-${log.level}`}>
                        <span className="chat-log-time">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="chat-log-message">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="chat-input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={selectedDevices.length === 0
              ? "Bạn cần chọn thiết bị trước..."
              : "Nhập lệnh cho thiết bị..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            rows={3}
          />
          <div className="chat-input-actions">
            <button
              className="chat-action-btn"
              onClick={handleEnhance}
              disabled={!prompt.trim() || enhancing || !activeProfile}
              title="Enhance with AI"
            >
              {enhancing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            </button>
            {/* Multi-device view toggle */}
            {selectedDevices.length > 1 && (
              <button
                className={`chat-action-btn ${showMultiDeviceView ? 'chat-action-btn--active' : ''}`}
                onClick={() => setShowMultiDeviceView(!showMultiDeviceView)}
                title="Xem theo thiết bị"
              >
                <Monitor size={16} />
              </button>
            )}
            {isRunning ? (
              <button className="chat-send-btn chat-stop-btn" onClick={stopTasks}>
                <Square size={16} />
              </button>
            ) : (
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!canSend}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="chat-input-hint">
          {!activeProfile && <span className="text-warning">⚠ Vui lòng chọn profile trước</span>}
          {activeProfile && selectedDevices.length === 0 && <span>Chọn thiết bị để bắt đầu</span>}
          {activeProfile && selectedDevices.length > 0 && <span>Nhấn Enter để gửi</span>}
        </div>
      </div>

      {/* Multi-device floating windows */}
      {showMultiDeviceView && selectedDevices.length > 1 && (
        <MultiDeviceView
          activeDevices={selectedDevices.map(id => {
            const device = devices.find(d => d.id === id);
            return {
              deviceId: id,
              deviceName: device?.model || device?.name || id,
            };
          })}
          onClose={() => setShowMultiDeviceView(false)}
        />
      )}
    </div>
  );
}
