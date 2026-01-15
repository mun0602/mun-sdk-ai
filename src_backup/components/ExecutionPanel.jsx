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
  FileText,
  X,
  Terminal,
} from 'lucide-react';
import { useDeviceStore, useProfileStore, useTaskStore, useTemplateStore, useSettingsStore } from '../store';
import { invoke } from '../tauri-mock';

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
        <Smartphone size={14} />
        <span>{count === 0 ? 'Thiết bị' : `${count} thiết bị`}</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
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
        <Zap size={14} />
        <span>{activeProfile ? activeProfile.provider.model : 'Chọn model'}</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
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
                  <div className="chat-model-detail">{p.provider.name} · {p.provider.model}</div>
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

// Template selector dropdown (like Claude skills)
function TemplateSelector({ templates, selected, onSelect, onClear }) {
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
    <div className="chat-selector chat-template-selector" ref={ref}>
      <button 
        className={`chat-selector-trigger ${selected ? 'chat-selector-active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <FileText size={14} />
        <span>{selected ? selected.name : 'Template'}</span>
        {selected ? (
          <button 
            className="chat-selector-clear"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        )}
      </button>
      
      {open && (
        <div className="chat-selector-dropdown chat-template-dropdown">
          {templates.length === 0 ? (
            <div className="chat-selector-empty">
              <FileText size={16} />
              <span>Chưa có template</span>
              <small>Tạo template trong Profiles → Templates</small>
            </div>
          ) : (
            <>
              <div className="chat-template-hint">
                Template giúp AI hiểu rõ hơn nhiệm vụ cần làm
              </div>
              {templates.map(t => (
                <button
                  key={t.id}
                  className={`chat-template-item ${selected?.id === t.id ? 'active' : ''}`}
                  onClick={() => { onSelect(t); setOpen(false); }}
                >
                  <div className="chat-template-info">
                    <div className="chat-template-name">{t.name}</div>
                    {t.description && (
                      <div className="chat-template-desc">{t.description}</div>
                    )}
                  </div>
                  {selected?.id === t.id && <Check size={14} className="text-success" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionPanel() {
  const { devices } = useDeviceStore();
  const { templates, loadTemplates } = useTemplateStore();
  const { activeProfile, profiles, loadProfiles, setActiveProfile } = useProfileStore();
  const { runTask, runParallelTasks, stopTasks, isRunning, logs, clearLogs, cleanupOutputListener } = useTaskStore();
  const { maxParallelDevices, tracing } = useSettingsStore();
  
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [enhancing, setEnhancing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (profiles.length === 0) loadProfiles();
    loadTemplates();
  }, [profiles.length, loadProfiles, loadTemplates]);

  useEffect(() => {
    return () => cleanupOutputListener();
  }, [cleanupOutputListener]);

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
      // Only add significant logs as messages
      if (lastLog.message.includes('SUCCESS') || 
          lastLog.message.includes('ERROR') || 
          lastLog.message.includes('completed') ||
          lastLog.message.includes('Starting')) {
        
        const status = lastLog.level === 'error' ? 'error' 
          : lastLog.level === 'success' ? 'success' : 'running';
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          // Update last system message if it's still running
          if (last?.type === 'system' && last?.status === 'running') {
            return [...prev.slice(0, -1), {
              ...last,
              content: formatLogMessage(lastLog.message),
              status,
            }];
          }
          return [...prev, {
            type: 'system',
            content: formatLogMessage(lastLog.message),
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

  const handleSend = async () => {
    if (!prompt.trim() || selectedDevices.length === 0 || !activeProfile) return;
    
    const userMessage = prompt.trim();
    
    // Build final prompt with template context (like Claude skills)
    let finalPrompt = userMessage;
    if (selectedTemplate) {
      const templateContext = `<template name="${selectedTemplate.name}">
${selectedTemplate.task}
</template>

User request: ${userMessage}`;
      finalPrompt = templateContext;
    }
    
    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      content: selectedTemplate 
        ? `[${selectedTemplate.name}] ${userMessage}` 
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
      max_steps: selectedTemplate?.max_steps || activeProfile.max_steps,
      base_url: activeProfile.provider.base_url,
      vision: activeProfile.vision ?? true,
      reasoning: activeProfile.reasoning ?? false,
      tracing: tracingParams,
    };

    try {
      if (selectedDevices.length === 1) {
        await runTask({ device_id: selectedDevices[0], ...taskParams });
      } else {
        await runParallelTasks(selectedDevices, taskParams, maxParallelDevices);
      }
      
      // Add success message
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.status === 'running') {
          return [...prev.slice(0, -1), {
            type: 'ai',
            content: `Task completed successfully on ${selectedDevices.length} device${selectedDevices.length > 1 ? 's' : ''}! 🎉`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }];
        }
        return prev;
      });
    } catch (e) {
      setMessages(prev => [...prev, {
        type: 'ai',
        content: `Something went wrong: ${e}`,
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
        
        {/* Selectors on the right: Model, Template, Device */}
        <div className="chat-header-selectors">
          <ModelSelector
            profiles={profiles}
            activeProfile={activeProfile}
            onSelect={setActiveProfile}
          />
          <TemplateSelector
            templates={templates}
            selected={selectedTemplate}
            onSelect={setSelectedTemplate}
            onClear={() => setSelectedTemplate(null)}
          />
          <DeviceSelector 
            devices={devices}
            selected={selectedDevices}
            onChange={setSelectedDevices}
          />
        </div>
      </div>

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
    </div>
  );
}
