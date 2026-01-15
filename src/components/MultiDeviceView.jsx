// MultiDeviceView - Floating windows for multi-device execution
import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Terminal,
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Move,
} from 'lucide-react';
import { useDeviceStore, useTaskStore } from '../store';
import { listen } from '../tauri-mock';

// Single device window component
function DeviceWindow({ 
  deviceId, 
  deviceName, 
  logs = [], 
  status = 'idle', // idle, running, success, error
  progress = 0,
  onClose, 
  onMinimize,
  isMinimized = false,
  position = { x: 0, y: 0 },
  onPositionChange,
  zIndex = 1,
  onFocus,
}) {
  const windowRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const logsEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.device-window__header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      onFocus?.();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        onPositionChange?.({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange]);

  const statusIcon = {
    idle: <Smartphone size={14} />,
    running: <Loader2 size={14} className="spin" />,
    success: <CheckCircle size={14} />,
    error: <AlertCircle size={14} />,
  }[status];

  const statusColor = {
    idle: 'var(--text-muted)',
    running: 'var(--accent)',
    success: 'var(--success)',
    error: 'var(--error)',
  }[status];

  if (isMinimized) {
    return (
      <div 
        className="device-window device-window--minimized"
        style={{ 
          left: position.x, 
          top: position.y,
          zIndex,
        }}
        onClick={onMinimize}
      >
        <div className="device-window__mini-header" style={{ color: statusColor }}>
          {statusIcon}
          <span>{deviceName || deviceId}</span>
          {status === 'running' && (
            <span className="device-window__mini-progress">{progress}%</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={windowRef}
      className={`device-window device-window--${status}`}
      style={{ 
        left: position.x, 
        top: position.y,
        zIndex,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={() => onFocus?.()}
    >
      <div 
        className="device-window__header"
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab' }}
      >
        <div className="device-window__title">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          <span className="device-window__name">{deviceName || deviceId}</span>
          {status === 'running' && (
            <span className="device-window__status-badge">
              {progress}%
            </span>
          )}
        </div>
        <div className="device-window__controls">
          <button 
            className="device-window__btn"
            onClick={onMinimize}
            title="Thu nhỏ"
          >
            <Minus size={12} />
          </button>
          <button 
            className="device-window__btn device-window__btn--close"
            onClick={onClose}
            title="Đóng"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <div className="device-window__progress">
          <div 
            className="device-window__progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Logs area */}
      <div className="device-window__logs">
        {logs.length === 0 ? (
          <div className="device-window__empty">
            <Terminal size={20} />
            <span>Chờ thực thi...</span>
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <div 
                key={i} 
                className={`device-window__log device-window__log--${log.level || 'info'}`}
              >
                <span className="device-window__log-time">
                  {log.time || new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}
                </span>
                <span className="device-window__log-msg">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {/* Status footer */}
      <div className="device-window__footer">
        {status === 'idle' && <span>Sẵn sàng</span>}
        {status === 'running' && <span>Đang chạy...</span>}
        {status === 'success' && <span className="text-success">Hoàn thành!</span>}
        {status === 'error' && <span className="text-error">Lỗi</span>}
      </div>
    </div>
  );
}

// Container for all device windows
export default function MultiDeviceView({ 
  activeDevices = [], // Array of { deviceId, deviceName }
  onClose,
}) {
  const [deviceWindows, setDeviceWindows] = useState({});
  const [focusedDevice, setFocusedDevice] = useState(null);
  const containerRef = useRef(null);

  // Initialize windows for each device
  useEffect(() => {
    const newWindows = {};
    activeDevices.forEach((device, index) => {
      if (!deviceWindows[device.deviceId]) {
        // Stagger positions
        const row = Math.floor(index / 3);
        const col = index % 3;
        newWindows[device.deviceId] = {
          position: { x: 50 + col * 340, y: 50 + row * 300 },
          isMinimized: false,
          logs: [],
          status: 'idle',
          progress: 0,
          zIndex: index + 1,
        };
      } else {
        newWindows[device.deviceId] = deviceWindows[device.deviceId];
      }
    });
    setDeviceWindows(newWindows);
  }, [activeDevices]);

  // Listen for device-specific logs
  useEffect(() => {
    let unlisten = null;

    const setupListener = async () => {
      unlisten = await listen('device-log', (event) => {
        const { device_id, message, level } = event.payload;
        setDeviceWindows(prev => {
          if (!prev[device_id]) return prev;
          return {
            ...prev,
            [device_id]: {
              ...prev[device_id],
              logs: [...prev[device_id].logs, {
                message,
                level: level || 'info',
                time: new Date().toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                }),
              }],
            },
          };
        });
      });
    };

    setupListener();
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Listen for device status updates
  useEffect(() => {
    let unlisten = null;

    const setupListener = async () => {
      unlisten = await listen('device-status', (event) => {
        const { device_id, status, progress } = event.payload;
        setDeviceWindows(prev => {
          if (!prev[device_id]) return prev;
          return {
            ...prev,
            [device_id]: {
              ...prev[device_id],
              status: status || prev[device_id].status,
              progress: progress ?? prev[device_id].progress,
            },
          };
        });
      });
    };

    setupListener();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handlePositionChange = (deviceId, newPos) => {
    setDeviceWindows(prev => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        position: newPos,
      },
    }));
  };

  const handleMinimize = (deviceId) => {
    setDeviceWindows(prev => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        isMinimized: !prev[deviceId].isMinimized,
      },
    }));
  };

  const handleCloseWindow = (deviceId) => {
    setDeviceWindows(prev => {
      const newWindows = { ...prev };
      delete newWindows[deviceId];
      return newWindows;
    });
  };

  const handleFocus = (deviceId) => {
    setFocusedDevice(deviceId);
    // Bring to front
    const maxZ = Math.max(...Object.values(deviceWindows).map(w => w.zIndex || 1));
    setDeviceWindows(prev => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        zIndex: maxZ + 1,
      },
    }));
  };

  // Minimize all
  const minimizeAll = () => {
    setDeviceWindows(prev => {
      const updated = {};
      Object.keys(prev).forEach(id => {
        updated[id] = { ...prev[id], isMinimized: true };
      });
      return updated;
    });
  };

  // Restore all
  const restoreAll = () => {
    setDeviceWindows(prev => {
      const updated = {};
      Object.keys(prev).forEach(id => {
        updated[id] = { ...prev[id], isMinimized: false };
      });
      return updated;
    });
  };

  // Arrange windows in grid
  const arrangeWindows = () => {
    const deviceIds = Object.keys(deviceWindows);
    setDeviceWindows(prev => {
      const updated = {};
      deviceIds.forEach((id, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        updated[id] = {
          ...prev[id],
          position: { x: 50 + col * 340, y: 50 + row * 300 },
          isMinimized: false,
        };
      });
      return updated;
    });
  };

  if (activeDevices.length === 0) {
    return null;
  }

  return (
    <div className="multi-device-view" ref={containerRef}>
      {/* Toolbar */}
      <div className="multi-device-toolbar">
        <div className="multi-device-toolbar__left">
          <Smartphone size={16} />
          <span>{activeDevices.length} thiết bị đang chạy</span>
        </div>
        <div className="multi-device-toolbar__actions">
          <button 
            className="btn btn-xs btn-ghost"
            onClick={arrangeWindows}
            title="Sắp xếp"
          >
            <Move size={14} />
          </button>
          <button 
            className="btn btn-xs btn-ghost"
            onClick={minimizeAll}
            title="Thu nhỏ tất cả"
          >
            <Minimize2 size={14} />
          </button>
          <button 
            className="btn btn-xs btn-ghost"
            onClick={restoreAll}
            title="Mở rộng tất cả"
          >
            <Maximize2 size={14} />
          </button>
          <button 
            className="btn btn-xs btn-ghost btn-danger"
            onClick={onClose}
            title="Đóng tất cả"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Device windows */}
      {activeDevices.map((device) => {
        const windowData = deviceWindows[device.deviceId] || {};
        return (
          <DeviceWindow
            key={device.deviceId}
            deviceId={device.deviceId}
            deviceName={device.deviceName}
            logs={windowData.logs || []}
            status={windowData.status || 'idle'}
            progress={windowData.progress || 0}
            isMinimized={windowData.isMinimized}
            position={windowData.position || { x: 50, y: 50 }}
            zIndex={windowData.zIndex || 1}
            onClose={() => handleCloseWindow(device.deviceId)}
            onMinimize={() => handleMinimize(device.deviceId)}
            onPositionChange={(pos) => handlePositionChange(device.deviceId, pos)}
            onFocus={() => handleFocus(device.deviceId)}
          />
        );
      })}
    </div>
  );
}

// Hook to manage multi-device execution
export function useMultiDeviceExecution() {
  const [activeDevices, setActiveDevices] = useState([]);
  const [showMultiView, setShowMultiView] = useState(false);

  const startMultiDeviceExecution = (devices) => {
    setActiveDevices(devices.map(d => ({
      deviceId: d.id || d,
      deviceName: d.name || d.model || d.id || d,
    })));
    setShowMultiView(true);
  };

  const closeMultiDeviceView = () => {
    setShowMultiView(false);
    setActiveDevices([]);
  };

  return {
    activeDevices,
    showMultiView,
    startMultiDeviceExecution,
    closeMultiDeviceView,
  };
}
