import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  RefreshCw,
  Zap,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Cpu,
  MonitorPlay,
  Power,
  Square,
  FolderOpen,
  Settings2,
} from 'lucide-react';
import { useDeviceStore, useEmulatorStore } from '../store';

function DevicePanel() {
  const {
    devices,
    selectedDevice,
    refreshDevices,
    selectDevice,
    connectDevice,
    isLoading,
    isScanning,
    autoConnectEmulators,
    scanEmulatorPorts,
    checkDroidRunInstalled,
    setupDroidRun,
  } = useDeviceStore();

  const {
    instances,
    isLoading: emulatorLoading,
    isMumuInstalled,
    customPath,
    checkMumuInstalled,
    getInstances,
    launchInstance,
    shutdownInstance,
    connectAdb,
    setEmulatorPath,
    getEmulatorPath,
  } = useEmulatorStore();
  
  const [showConnect, setShowConnect] = useState(false);
  const [connectAddress, setConnectAddress] = useState('');
  const [setupStatus, setSetupStatus] = useState({});
  const [showEmulators, setShowEmulators] = useState(false);
  const [showEmulatorSettings, setShowEmulatorSettings] = useState(false);
  const [emulatorPath, setEmulatorPathLocal] = useState('');
  const [launchingIndex, setLaunchingIndex] = useState(null);

  useEffect(() => {
    const init = async () => {
      await autoConnectEmulators();
      await refreshDevices();
      await checkMumuInstalled();
      const path = await getEmulatorPath();
      if (path) setEmulatorPathLocal(path);
    };
    init();
  }, []);

  useEffect(() => {
    if (showEmulators && isMumuInstalled) {
      getInstances();
    }
  }, [showEmulators, isMumuInstalled]);

  useEffect(() => {
    const checkInstallation = async () => {
      const status = {};
      for (const device of devices) {
        try {
          const installed = await checkDroidRunInstalled(device.id);
          status[device.id] = installed ? 'installed' : 'not_installed';
        } catch {
          status[device.id] = 'unknown';
        }
      }
      setSetupStatus(status);
    };
    if (devices.length > 0) {
      checkInstallation();
    }
  }, [devices]);

  const handleSetupDroidRun = async (deviceId) => {
    setSetupStatus(prev => ({ ...prev, [deviceId]: 'installing' }));
    try {
      await setupDroidRun(deviceId);
      setSetupStatus(prev => ({ ...prev, [deviceId]: 'installed' }));
    } catch (error) {
      console.error('Setup failed:', error);
      setSetupStatus(prev => ({ ...prev, [deviceId]: 'failed' }));
    }
  };

  const handleConnect = async () => {
    if (!connectAddress.trim()) return;
    try {
      await connectDevice(connectAddress);
      setShowConnect(false);
      setConnectAddress('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEmulatorPath = async () => {
    await setEmulatorPath(emulatorPath);
    setShowEmulatorSettings(false);
  };

  const handleLaunchEmulator = async (instance) => {
    setLaunchingIndex(instance.index);
    try {
      await launchInstance(instance.index);
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const newInstances = await getInstances();
        const updated = newInstances.find(i => i.index === instance.index);
        if (updated?.is_android_started) {
          clearInterval(pollInterval);
          if (updated.adb_host && updated.adb_port) {
            await connectAdb(updated.adb_host, updated.adb_port);
            await refreshDevices();
          }
          setLaunchingIndex(null);
        } else if (attempts > 60) {
          clearInterval(pollInterval);
          setLaunchingIndex(null);
        }
      }, 2000);
    } catch (e) {
      console.error('[Emulator] Launch error:', e);
      setLaunchingIndex(null);
    }
  };

  const handleShutdownEmulator = async (instance) => {
    await shutdownInstance(instance.index);
    await refreshDevices();
  };

  const getStatusInfo = (status) => {
    if (status === 'installed') return { icon: Check, label: 'Sẵn sàng', color: 'success' };
    if (status === 'installing') return { icon: RefreshCw, label: 'Đang cài...', color: 'warning' };
    if (status === 'failed') return { icon: AlertCircle, label: 'Lỗi', color: 'error' };
    return { icon: Zap, label: 'Cần cài đặt', color: 'muted' };
  };

  return (
    <div className="device-panel">
      {/* Header */}
      <header className="device-panel__header">
        <div className="device-panel__title-group">
          <h1 className="device-panel__title">Thiết bị</h1>
          <span className="device-panel__count">{devices.length}</span>
        </div>
        
        <div className="device-panel__actions">
          <button 
            className="device-panel__action-btn"
            onClick={() => setShowConnect(!showConnect)}
            data-active={showConnect}
            title="Kết nối WiFi ADB"
          >
            <Wifi size={18} />
          </button>
          <button 
            className="device-panel__action-btn"
            onClick={scanEmulatorPorts}
            disabled={isScanning}
            title="Quét emulator ports"
          >
            <Zap size={18} className={isScanning ? 'spin' : ''} />
          </button>
          <button 
            className="device-panel__action-btn"
            onClick={refreshDevices}
            disabled={isLoading}
            title="Làm mới"
          >
            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* Connect Form */}
      {showConnect && (
        <div className="device-panel__connect">
          <div className="device-panel__connect-input-group">
            <input
              type="text"
              className="device-panel__connect-input"
              placeholder="IP:Port (vd: 127.0.0.1:5555)"
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              autoFocus
            />
            <button 
              className="device-panel__connect-btn"
              onClick={handleConnect}
              disabled={!connectAddress.trim()}
            >
              Kết nối
            </button>
          </div>
          <p className="device-panel__connect-hint">
            LDPlayer: 5555 · Nox: 62001 · Memu: 21503
          </p>
        </div>
      )}

      {/* Emulator Section */}
      <div className="device-panel__emulator-section">
        <div 
          className="device-panel__emulator-header"
          onClick={() => setShowEmulators(!showEmulators)}
        >
          <div className="device-panel__emulator-title">
            <MonitorPlay size={18} />
            <span>Giả lập</span>
            {instances.length > 0 && (
              <span className="device-panel__count">{instances.length}</span>
            )}
          </div>
          <div className="device-panel__emulator-actions">
            <button
              className="device-panel__action-btn"
              onClick={(e) => { e.stopPropagation(); setShowEmulatorSettings(!showEmulatorSettings); }}
              title="Cài đặt đường dẫn"
            >
              <Settings2 size={16} />
            </button>
            {showEmulators ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
        </div>

        {/* Emulator Path Settings */}
        {showEmulatorSettings && (
          <div className="device-panel__emulator-settings">
            <label className="device-panel__label">Đường dẫn Emulator Manager</label>
            <div className="device-panel__connect-input-group">
              <input
                type="text"
                className="device-panel__connect-input"
                placeholder="D:\NetEase\MuMu\nx_main\MuMuManager.exe"
                value={emulatorPath}
                onChange={(e) => setEmulatorPathLocal(e.target.value)}
              />
              <button 
                className="device-panel__connect-btn"
                onClick={handleSaveEmulatorPath}
              >
                Lưu
              </button>
            </div>
            <p className="device-panel__connect-hint">
              Hỗ trợ: MuMu, LDPlayer (dnconsole.exe), Nox, Memu
            </p>
          </div>
        )}

        {/* Emulator List */}
        {showEmulators && (
          <div className="device-panel__emulator-list">
            {!isMumuInstalled && !customPath ? (
              <div className="device-panel__emulator-empty">
                <FolderOpen size={20} />
                <span>Nhập đường dẫn emulator ở trên</span>
              </div>
            ) : emulatorLoading ? (
              <div className="device-panel__emulator-empty">
                <RefreshCw size={20} className="spin" />
                <span>Đang tải...</span>
              </div>
            ) : instances.length === 0 ? (
              <div className="device-panel__emulator-empty">
                <MonitorPlay size={20} />
                <span>Không có instance nào</span>
              </div>
            ) : (
              instances.map((instance) => (
                <div key={instance.index} className="device-panel__emulator-item">
                  <div className="device-panel__emulator-info">
                    <span className={`device-panel__emulator-status device-panel__emulator-status--${
                      instance.is_android_started ? 'running' : instance.is_running ? 'starting' : 'stopped'
                    }`}>
                      {instance.is_android_started ? '●' : instance.is_running ? '◐' : '○'}
                    </span>
                    <span className="device-panel__emulator-name">{instance.name}</span>
                    {instance.adb_port && instance.is_android_started && (
                      <span className="device-panel__emulator-port">
                        :{instance.adb_port}
                      </span>
                    )}
                  </div>
                  <div className="device-panel__emulator-controls">
                    {!instance.is_running ? (
                      <button
                        className="device-panel__emulator-btn device-panel__emulator-btn--start"
                        onClick={() => handleLaunchEmulator(instance)}
                        disabled={launchingIndex === instance.index}
                        title="Khởi động"
                      >
                        {launchingIndex === instance.index ? (
                          <RefreshCw size={14} className="spin" />
                        ) : (
                          <Power size={14} />
                        )}
                      </button>
                    ) : (
                      <button
                        className="device-panel__emulator-btn device-panel__emulator-btn--stop"
                        onClick={() => handleShutdownEmulator(instance)}
                        disabled={emulatorLoading}
                        title="Tắt"
                      >
                        <Square size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Device List */}
      <div className="device-panel__list">
        {devices.length === 0 ? (
          <div className="device-panel__empty">
            <div className="device-panel__empty-icon">
              <Smartphone size={32} strokeWidth={1.5} />
            </div>
            <p className="device-panel__empty-title">Chưa có thiết bị</p>
            <p className="device-panel__empty-desc">
              Kết nối qua USB hoặc WiFi ADB
            </p>
            <button
              className="device-panel__empty-btn"
              onClick={scanEmulatorPorts}
              disabled={isScanning}
            >
              <Zap size={16} />
              {isScanning ? 'Đang quét...' : 'Quét Emulator'}
            </button>
          </div>
        ) : (
          devices.map((device) => {
            const status = getStatusInfo(setupStatus[device.id]);
            const StatusIcon = status.icon;
            const isSelected = selectedDevice === device.id;
            
            return (
              <div
                key={device.id}
                className={`device-card ${isSelected ? 'device-card--selected' : ''}`}
                onClick={() => selectDevice(device.id)}
              >
                {/* Device Icon */}
                <div className="device-card__icon">
                  <Smartphone size={20} strokeWidth={1.5} />
                  <span className={`device-card__status-dot device-card__status-dot--${device.status === 'device' ? 'online' : 'offline'}`} />
                </div>

                {/* Device Info */}
                <div className="device-card__info">
                  <h3 className="device-card__name">
                    {device.model || 'Unknown Device'}
                  </h3>
                  <p className="device-card__id">{device.id}</p>
                </div>

                {/* Meta Tags */}
                <div className="device-card__meta">
                  {device.android_version && (
                    <span className="device-card__tag">
                      <Cpu size={12} />
                      Android {device.android_version}
                    </span>
                  )}
                  <span className={`device-card__tag device-card__tag--${status.color}`}>
                    <StatusIcon size={12} className={status.color === 'warning' ? 'spin' : ''} />
                    {status.label}
                  </span>
                </div>

                {/* Setup Button */}
                {setupStatus[device.id] !== 'installed' && setupStatus[device.id] !== 'installing' && (
                  <button
                    className="device-card__setup-btn"
                    onClick={(e) => { e.stopPropagation(); handleSetupDroidRun(device.id); }}
                  >
                    {setupStatus[device.id] === 'failed' ? 'Thử lại' : 'Cài đặt'}
                    <ChevronRight size={14} />
                  </button>
                )}

                {/* Selection Indicator */}
                {isSelected && <div className="device-card__indicator" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default DevicePanel;
