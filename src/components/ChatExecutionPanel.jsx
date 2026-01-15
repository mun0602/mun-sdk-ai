// ChatExecutionPanel - Modern Chat Interface with Session History
// Inspired by Ampcode's clean, minimal design

import React, { useState, useRef, useEffect } from 'react';
import {
  useDeviceStore,
  useProfileStore,
  useTaskStore,
  useSettingsStore,
  useSkillStore,
} from '../store';
import { DEFAULT_VISION_MODELS, DEFAULT_EXECUTOR_MODELS } from '../constants/providers';
import {
  Mic,
  MicOff,
  Send,
  Plus,
  ChevronUp,
  ChevronDown,
  Eye,
  Cpu,
  Square,
  Smartphone,
  Settings,
  RotateCcw,
  Clock,
  MessageSquare,
  Trash2,
  MoreHorizontal,
  X,
  Check,
  Bot,
  User,
  Sparkles,
} from 'lucide-react';

// Generate session ID
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get session title from first message
const getSessionTitle = (messages) => {
  if (!messages || messages.length === 0) return 'Phiên mới';
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'Phiên mới';
  const title = firstUserMsg.content.slice(0, 40);
  return title.length < firstUserMsg.content.length ? title + '...' : title;
};

// Format relative time
const formatRelativeTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return new Date(date).toLocaleDateString('vi-VN');
};

export default function ChatExecutionPanel() {
  const { devices } = useDeviceStore();
  const { activeProfile } = useProfileStore();
  const { runTask, stopTasks, isRunning, logs, clearLogs } = useTaskStore();
  const { tracing } = useSettingsStore();
  const { compileGuidance } = useSkillStore();

  // Sessions state
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('chat_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Chat state
  const [prompt, setPrompt] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [executorModel, setExecutorModel] = useState('');
  const [visionMode, setVisionMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  // Get models from activeProfile or use defaults
  const visionModels = activeProfile?.vision_models || DEFAULT_VISION_MODELS;
  const executorModels = activeProfile?.executor_models || DEFAULT_EXECUTOR_MODELS;
  
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);
  const historyRef = useRef(null);

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Update current session when chat changes
  useEffect(() => {
    if (currentSessionId && chatHistory.length > 0) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: chatHistory, updatedAt: new Date().toISOString() }
          : s
      ));
    }
  }, [chatHistory, currentSessionId]);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-select first device
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id);
    }
  }, [devices, selectedDevice]);

  // Sync default models when activeProfile or model lists change
  useEffect(() => {
    // Set default vision model
    if (visionModels.length > 0 && !visionModel) {
      setVisionModel(visionModels[0].id);
    }
    // Set default executor model
    if (executorModels.length > 0 && !executorModel) {
      setExecutorModel(executorModels[0].id);
    }
  }, [visionModels, executorModels, visionModel, executorModel]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, logs]);

  // Convert logs to chat messages
  useEffect(() => {
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog.message.includes('SUCCESS') || lastLog.message.includes('ERROR')) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: lastLog.message,
          type: lastLog.level,
          timestamp: new Date().toISOString(),
        }]);
      }
    }
  }, [logs]);

  // Create new session
  const createNewSession = () => {
    const newSession = {
      id: generateSessionId(),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setChatHistory([]);
    setShowHistory(false);
    clearLogs();
  };

  // Load session
  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setChatHistory(session.messages || []);
    setShowHistory(false);
    clearLogs();
  };

  // Delete session
  const deleteSession = (sessionId, e) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setChatHistory([]);
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!prompt.trim() || !selectedDevice) return;

    // Create session if none exists
    if (!currentSessionId) {
      const newSession = {
        id: generateSessionId(),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    setChatHistory(prev => [...prev, userMessage]);

    const currentPrompt = prompt;
    setPrompt('');
    clearLogs();

    // Get model config based on current mode
    const modelId = visionMode ? visionModel : executorModel;
    const modelList = visionMode ? visionModels : executorModels;
    const modelConfig = modelList.find(m => m.id === modelId);

    if (!modelConfig) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Lỗi: Không tìm thấy cấu hình model',
        type: 'error',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    // Add thinking message
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      content: `Đang thực thi với ${modelConfig.name}${visionMode ? ' (Vision)' : ''}...`,
      type: 'thinking',
      timestamp: new Date().toISOString(),
    }]);

    try {
      // Get provider config from activeProfile or use model's provider
      const provider = activeProfile?.provider || {};
      // Priority: model's baseUrl > profile's base_url > null
      const baseUrl = modelConfig.baseUrl || provider.base_url || null;
      
      // Add AI guidance from enabled skills
      let finalPrompt = currentPrompt.trim();
      const aiGuidance = compileGuidance();
      if (aiGuidance) {
        finalPrompt = `${aiGuidance}\n\n=== TASK ===\n${finalPrompt}`;
      }
      
      const taskParams = {
        device_id: selectedDevice,
        provider: modelConfig.provider || provider.name || 'OpenAILike',
        api_key: provider.api_key || '',
        model: modelConfig.id,
        prompt: finalPrompt,
        max_steps: activeProfile?.max_steps || 1000,
        base_url: baseUrl,
        vision: visionMode,
        reasoning: visionMode,
        tracing: {
          enabled: false,
          provider: 'none',
          saveTrajectory: tracing.saveTrajectory || 'none',
        },
      };
      await runTask(taskParams);
    } catch (e) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Lỗi: ${e.toString()}`,
        type: 'error',
        timestamp: new Date().toISOString(),
      }]);
    }
  };

  // Handle mic
  const handleMic = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setPrompt(prev => prev + ' ' + transcript);
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } else {
        alert('Trình duyệt không hỗ trợ Speech Recognition');
        setIsListening(false);
      }
    }
  };

  // Handle stop
  const handleStop = () => {
    stopTasks();
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      content: 'Task đã dừng',
      type: 'warning',
      timestamp: new Date().toISOString(),
    }]);
  };

  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentTitle = currentSession ? getSessionTitle(currentSession.messages) : 'Phiên mới';

  return (
    <div className="agent-chat-panel">
      {/* History Bar - Top */}
      <div className="agent-chat-history-bar" ref={historyRef}>
        <button 
          className={`history-selector ${showHistory ? 'active' : ''}`}
          onClick={() => setShowHistory(!showHistory)}
        >
          <Clock size={14} />
          <span className="history-title">{currentTitle}</span>
          <ChevronDown size={14} className={`history-chevron ${showHistory ? 'rotated' : ''}`} />
        </button>

        <div className="history-actions">
          <button 
            className="history-new-btn"
            onClick={createNewSession}
            title="Tạo phiên mới"
          >
            <Plus size={16} />
          </button>
          {selectedDevice && (
            <span className="device-indicator">
              <Smartphone size={12} />
              {selectedDevice}
            </span>
          )}
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="history-dropdown">
            <div className="history-dropdown-header">
              <span>Lịch sử phiên</span>
              <button className="history-close" onClick={() => setShowHistory(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="history-list">
              {sessions.length === 0 ? (
                <div className="history-empty">
                  <MessageSquare size={24} />
                  <p>Chưa có phiên nào</p>
                </div>
              ) : (
                sessions.map(session => (
                  <div 
                    key={session.id}
                    className={`history-item ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => loadSession(session)}
                  >
                    <div className="history-item-content">
                      <span className="history-item-title">
                        {getSessionTitle(session.messages)}
                      </span>
                      <span className="history-item-time">
                        {formatRelativeTime(session.updatedAt)}
                      </span>
                    </div>
                    <button 
                      className="history-item-delete"
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Xóa phiên"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="agent-settings-panel">
          <div className="settings-row">
            <label>Thiết bị</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              <option value="">-- Chọn thiết bị --</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.model || d.id}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <label>Profile</label>
            <span className="settings-value">
              {activeProfile ? activeProfile.name : 'Chưa chọn'}
            </span>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="agent-chat-messages">
        {chatHistory.length === 0 && logs.length === 0 ? (
          <div className="chat-welcome">
            <div className="welcome-icon">
              <Bot size={48} />
            </div>
            <h3>DroidRun Agent</h3>
            <p>Nhập lệnh để bắt đầu điều khiển Android</p>
            <div className="welcome-examples">
              <button onClick={() => setPrompt('Mở TikTok, like 3 video')}>
                <Sparkles size={12} />
                Mở TikTok, like 3 video
              </button>
              <button onClick={() => setPrompt('Mở YouTube, tìm kiếm "music"')}>
                <Sparkles size={12} />
                Mở YouTube, tìm "music"
              </button>
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map((msg, i) => (
              <div key={i} className={`message message-${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`message-content ${msg.type || ''}`}>
                  <p>{msg.content}</p>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Live logs */}
            {isRunning && logs.length > 0 && (
              <div className="message message-assistant">
                <div className="message-avatar">
                  <Bot size={16} />
                </div>
                <div className="message-content logs">
                  <div className="live-logs">
                    {logs.slice(-8).map((l, i) => (
                      <div key={i} className={`log-line log-${l.level}`}>
                        {l.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="agent-chat-input-area">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-textarea"
            placeholder="Nhập lệnh điều khiển Android..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isRunning}
            rows={1}
          />
          <button
            className={`mic-btn ${isListening ? 'active' : ''}`}
            onClick={handleMic}
            disabled={isRunning}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>

        {/* Toolbar */}
        <div className="input-toolbar">
          <div className="toolbar-left">
            <button 
              className={`mode-chip ${visionMode ? 'vision' : 'execute'}`}
              onClick={() => setVisionMode(!visionMode)}
              title={visionMode ? 'Vision Mode' : 'Execute Mode'}
            >
              {visionMode ? <Eye size={12} /> : <Cpu size={12} />}
              <span>{visionMode ? 'Vision' : 'Thực thi'}</span>
            </button>

            <div className="model-chip">
              <select
                value={visionMode ? visionModel : executorModel}
                onChange={(e) => visionMode ? setVisionModel(e.target.value) : setExecutorModel(e.target.value)}
              >
                {(visionMode ? visionModels : executorModels).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <button 
              className={`icon-chip ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={12} />
            </button>
          </div>

          <div className="toolbar-right">
            {isRunning ? (
              <button className="send-btn stop" onClick={handleStop}>
                <Square size={16} />
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!prompt.trim() || !selectedDevice}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
