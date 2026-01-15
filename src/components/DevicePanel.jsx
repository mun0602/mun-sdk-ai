import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  RefreshCw,
  Check,
  AlertCircle,
  Radio,
  Signal,
  X,
  Monitor,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Edit3,
  Power,
  Square,
  Download,
  Sun,
  Eye,
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
    ensureDroidRunReady,
    checkDroidRunPortal,
    wakeDevice,
    launchScrcpy,
  } = useDeviceStore();

  const {
    instances,
    isLoading: emuLoading,
    error: emuError,
    isMumuInstalled,
    checkMumuInstalled,
    getInstances,
    launchInstance,
    shutdownInstance,
    createInstance,
    cloneInstance,
    deleteInstance,
    renameInstance,
    connectAdb,
  } = useEmulatorStore();

  const [activeTab, setActiveTab] = useState('devices'); // 'devices' | 'mumu'
  const [showConnect, setShowConnect] = useState(false);
  const [connectAddress, setConnectAddress] = useState('');
  const [setupStatus, setSetupStatus] = useState({});

  // MuMu management state
  const [editingInstance, setEditingInstance] = useState(null);
  const [newName, setNewName] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [setupErrors, setSetupErrors] = useState({}); // Track setup errors per device
  const [wakingDevice, setWakingDevice] = useState(false);
  const [launchingScrcpy, setLaunchingScrcpy] = useState(false);

  useEffect(() => {
    const init = async () => {
      console.log('[DevicePanel] Init: checking MuMu installed...');
      const installed = await checkMumuInstalled();
      console.log('[DevicePanel] MuMu installed:', installed);
      await autoConnectEmulators();
      await refreshDevices();
    };
    init();
  }, []);

  useEffect(() => {
    console.log('[DevicePanel] Tab changed, activeTab:', activeTab, 'isMumuInstalled:', isMumuInstalled);
    if (activeTab === 'mumu' && isMumuInstalled) {
      console.log('[DevicePanel] Fetching MuMu instances...');
      getInstances().then(instances => {
        console.log('[DevicePanel] Got instances:', instances);
      });
    }
  }, [activeTab, isMumuInstalled]);

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
    // Check if device is online first
    const device = devices.find(d => d.id === deviceId);
    if (!device || device.status !== 'device') {
      setSetupErrors(prev => ({ ...prev, [deviceId]: 'Thiết bị không online. Hãy kết nối lại.' }));
      setSetupStatus(prev => ({ ...prev, [deviceId]: 'failed' }));
      return;
    }

    setSetupStatus(prev => ({ ...prev, [deviceId]: 'installing' }));
    setSetupErrors(prev => ({ ...prev, [deviceId]: null })); // Clear previous error

    try {
      // Use ensureDroidRunReady: ping first, auto setup if needed
      const result = await ensureDroidRunReady(deviceId);
      if (result.success) {
        setSetupStatus(prev => ({ ...prev, [deviceId]: 'installed' }));
        setSetupErrors(prev => ({ ...prev, [deviceId]: null }));
      } else {
        const errorMsg = result.error || result.output || 'Cài đặt thất bại. Hãy thử lại.';
        setSetupErrors(prev => ({ ...prev, [deviceId]: errorMsg }));
        setSetupStatus(prev => ({ ...prev, [deviceId]: 'failed' }));
      }
    } catch (error) {
      console.error('Setup failed:', error);
      setSetupErrors(prev => ({ ...prev, [deviceId]: error.toString() }));
      setSetupStatus(prev => ({ ...prev, [deviceId]: 'failed' }));
    }
  };

  const handleRefresh = async () => {
    console.log('[DevicePanel] Refresh button clicked');
    try {
      const devices = await refreshDevices();
      console.log('[DevicePanel] Refreshed, found', devices?.length || 0, 'devices');
    } catch (e) {
      console.error('[DevicePanel] Refresh error:', e);
    }
  };

  const handleConnect = async () => {
    if (!connectAddress.trim()) return;
    try {
      await connectDevice(connectAddress);
      setShowConnect(false);
      setConnectAddress('');
      // Refresh devices after connecting
      await refreshDevices();
    } catch (e) {
      console.error(e);
    }
  };

  // MuMu Actions
  const handleCreate = async () => {
    console.log('[DevicePanel] handleCreate called');
    setActionLoading('create');
    try {
      console.log('[DevicePanel] Calling createInstance(1)...');
      const result = await createInstance(1);
      console.log('[DevicePanel] createInstance result:', result);
    } catch (e) {
      console.error('[DevicePanel] createInstance error:', e);
    }
    setActionLoading(null);
  };

  const handleClone = async (vmindex) => {
    console.log('[DevicePanel] handleClone called, vmindex:', vmindex);
    setActionLoading(`clone-${vmindex}`);
    try {
      console.log('[DevicePanel] Calling cloneInstance...');
      const result = await cloneInstance(vmindex);
      console.log('[DevicePanel] cloneInstance result:', result);
    } catch (e) {
      console.error('[DevicePanel] cloneInstance error:', e);
    }
    setActionLoading(null);
  };

  const handleDelete = async (vmindex, name) => {
    console.log('[DevicePanel] handleDelete called, vmindex:', vmindex, 'name:', name);
    if (!confirm(`Xóa giả lập "${name}"?`)) return;
    setActionLoading(`delete-${vmindex}`);
    try {
      console.log('[DevicePanel] Calling deleteInstance...');
      const result = await deleteInstance(vmindex);
      console.log('[DevicePanel] deleteInstance result:', result);
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  };

  const handleRename = async (vmindex) => {
    console.log('[DevicePanel] handleRename called, vmindex:', vmindex, 'newName:', newName);
    if (!newName.trim()) return;
    setActionLoading(`rename-${vmindex}`);
    try {
      console.log('[DevicePanel] Calling renameInstance...');
      const result = await renameInstance(vmindex, newName);
      console.log('[DevicePanel] renameInstance result:', result);
      setEditingInstance(null);
      setNewName('');
    } catch (e) {
      console.error('[DevicePanel] renameInstance error:', e);
    }
    setActionLoading(null);
  };

  const handleLaunch = async (instance) => {
    console.log('[DevicePanel] handleLaunch called, instance:', instance);
    setActionLoading(`launch-${instance.index}`);
    try {
      console.log('[DevicePanel] Calling launchInstance...');
      await launchInstance(instance.index);
      console.log('[DevicePanel] launchInstance done, polling...');
      // Poll until started
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const updatedInstances = await getInstances();
        const updated = updatedInstances.find(i => i.index === instance.index);
        if (updated?.is_android_started) {
          clearInterval(pollInterval);
          if (updated.adb_host && updated.adb_port) {
            await connectAdb(updated.adb_host, updated.adb_port);
            await refreshDevices();
          }
          setActionLoading(null);
        } else if (attempts > 60) {
          clearInterval(pollInterval);
          setActionLoading(null);
        }
      }, 2000);
    } catch (e) {
      console.error('[DevicePanel] launchInstance error:', e);
      setActionLoading(null);
    }
  };

  const handleShutdown = async (instance) => {
    console.log('[DevicePanel] handleShutdown called, instance:', instance);
    setActionLoading(`shutdown-${instance.index}`);
    try {
      console.log('[DevicePanel] Calling shutdownInstance...');
      const result = await shutdownInstance(instance.index);
      console.log('[DevicePanel] shutdownInstance result:', result);
      await refreshDevices();
    } catch (e) {
      console.error('[DevicePanel] shutdownInstance error:', e);
    }
    setActionLoading(null);
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'installed': return { icon: Check, label: 'Sẵn sàng', variant: 'success' };
      case 'installing': return { icon: RefreshCw, label: 'Đang cài...', variant: 'pending' };
      case 'failed': return { icon: AlertCircle, label: 'Lỗi', variant: 'error' };
      default: return { icon: Download, label: 'Cài đặt', variant: 'action' };
    }
  };

  const onlineCount = devices.filter(d => d.status === 'device').length;
  const runningCount = instances.filter(i => i.is_running).length;

  return (
    <div className="device-panel">
      {/* Header with Tabs */}
      <div className="device-header">
        <div className="device-header-left">
          <div className="device-tabs">
            <button
              className={`device-tab ${activeTab === 'devices' ? 'device-tab--active' : ''}`}
              onClick={() => setActiveTab('devices')}
            >
              <Smartphone size={14} />
              Thiết bị
              {devices.length > 0 && <span className="device-tab-count">{devices.length}</span>}
            </button>
            {isMumuInstalled && (
              <button
                className={`device-tab ${activeTab === 'mumu' ? 'device-tab--active' : ''}`}
                onClick={() => setActiveTab('mumu')}
              >
                <Monitor size={14} />
                MuMu
                {instances.length > 0 && <span className="device-tab-count">{instances.length}</span>}
              </button>
            )}
          </div>
        </div>
        <div className="device-header-actions">
          {activeTab === 'devices' ? (
            <>
              {selectedDevice && (
                <>
                  <button
                    className="device-btn device-btn--ghost"
                    onClick={async () => {
                      setLaunchingScrcpy(true);
                      try {
                        await launchScrcpy(selectedDevice);
                      } finally {
                        setLaunchingScrcpy(false);
                      }
                    }}
                    disabled={launchingScrcpy}
                    title="Xem màn hình thiết bị (scrcpy)"
                  >
                    {launchingScrcpy ? <RefreshCw size={16} className="spin" /> : <Eye size={16} />}
                  </button>
                  <button
                    className="device-btn device-btn--ghost"
                    onClick={async () => {
                      setWakingDevice(true);
                      try {
                        await wakeDevice(selectedDevice);
                      } finally {
                        setWakingDevice(false);
                      }
                    }}
                    disabled={wakingDevice}
                    title="Đánh thức màn hình thiết bị"
                  >
                    {wakingDevice ? <RefreshCw size={16} className="spin" /> : <Sun size={16} />}
                  </button>
                  <button
                    className={`device-btn ${setupStatus[selectedDevice] === 'installed' ? 'device-btn--success' : 'device-btn--accent'}`}
                    onClick={() => handleSetupDroidRun(selectedDevice)}
                    disabled={setupStatus[selectedDevice] === 'installing'}
                    title="Cài DroidRun Portal cho thiết bị đang chọn"
                  >
                    {setupStatus[selectedDevice] === 'installing' ? (
                      <RefreshCw size={16} className="spin" />
                    ) : setupStatus[selectedDevice] === 'installed' ? (
                      <Check size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    {setupStatus[selectedDevice] === 'installing' ? 'Đang cài...' :
                      setupStatus[selectedDevice] === 'installed' ? 'Portal OK' : 'Cài Portal'}
                  </button>
                </>
              )}
              <button
                className="device-btn device-btn--ghost"
                onClick={() => setShowConnect(!showConnect)}
                title="Kết nối WiFi ADB"
              >
                <Wifi size={16} />
              </button>
              <button
                className="device-btn device-btn--ghost"
                onClick={scanEmulatorPorts}
                disabled={isScanning}
                title="Quét Emulator"
              >
                <Radio size={16} className={isScanning ? 'spin' : ''} />
              </button>
              <button
                className="device-btn device-btn--primary"
                onClick={handleRefresh}
                disabled={isLoading}
                title="Làm mới danh sách thiết bị"
              >
                <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
                {isLoading ? 'Đang tải...' : 'Làm mới'}
              </button>
            </>
          ) : (
            <>
              <button
                className="device-btn device-btn--primary"
                onClick={handleCreate}
                disabled={actionLoading === 'create'}
              >
                {actionLoading === 'create' ? (
                  <RefreshCw size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                Tạo mới
              </button>
              <button
                className="device-btn device-btn--ghost"
                onClick={() => getInstances()}
                disabled={emuLoading}
              >
                <RefreshCw size={16} className={emuLoading ? 'spin' : ''} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connect Dialog */}
      {showConnect && activeTab === 'devices' && (
        <div className="device-connect">
          <div className="device-connect-row">
            <input
              type="text"
              className="device-input"
              placeholder="IP:Port (vd: 192.168.1.100:5555)"
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              autoFocus
            />
            <button
              className="device-btn device-btn--primary"
              onClick={handleConnect}
              disabled={!connectAddress.trim()}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="device-btn device-btn--icon"
              onClick={() => setShowConnect(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p className="device-connect-hint">
            LDPlayer: 5555 • Nox: 62001 • Memu: 21503 • MuMu: 16384
          </p>
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="device-list">
          {devices.length === 0 ? (
            <div className="device-empty">
              <Signal size={40} strokeWidth={1.5} />
              <p>Chưa có thiết bị</p>
              <span>Kết nối qua USB hoặc WiFi ADB</span>
              <button
                className="device-btn device-btn--primary"
                onClick={scanEmulatorPorts}
                disabled={isScanning}
              >
                <Radio size={16} className={isScanning ? 'spin' : ''} />
                {isScanning ? 'Đang quét...' : 'Quét Emulator'}
              </button>

              <div className="device-troubleshoot">
                <p className="device-troubleshoot-title">
                  <AlertCircle size={14} /> Không tìm thấy thiết bị?
                </p>
                <ul className="device-troubleshoot-list">
                  <li>Rút/cắm lại cáp USB, thử cổng khác</li>
                  <li>Bật <strong>USB Debugging</strong> trong Developer Options</li>
                  <li>Nhấn <strong>"Always allow"</strong> khi có popup xác nhận</li>
                  <li>Windows: Cài <strong>Google USB Driver</strong></li>
                </ul>
              </div>
            </div>
          ) : (
            devices.map((device) => {
              const isSelected = selectedDevice === device.id;
              const statusInfo = getStatusInfo(setupStatus[device.id]);
              const StatusIcon = statusInfo.icon;
              const isOnline = device.status === 'device';

              return (
                <div
                  key={device.id}
                  className={`device-card ${isSelected ? 'device-card--selected' : ''} ${isOnline ? '' : 'device-card--offline'}`}
                  onClick={() => selectDevice(device.id)}
                >
                  <div className="device-card-indicator" />

                  <div className="device-card-icon">
                    <Smartphone size={20} strokeWidth={1.5} />
                  </div>

                  <div className="device-card-content">
                    <div className="device-card-header">
                      <span className="device-card-name">
                        {device.model || 'Android Device'}
                      </span>
                      <span className={`device-card-status ${isOnline ? 'device-card-status--online' : ''}`}>
                        <span className="device-card-dot" />
                        {isOnline ? 'Online' : device.status}
                      </span>
                    </div>
                    <div className="device-card-meta">
                      <span className="device-card-id">{device.id}</span>
                      {device.android_version && (
                        <span className="device-card-android">
                          <Monitor size={12} />
                          Android {device.android_version}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="device-card-setup-wrapper">
                    <button
                      className={`device-card-setup device-card-setup--${statusInfo.variant}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (statusInfo.variant !== 'success' && statusInfo.variant !== 'pending') {
                          handleSetupDroidRun(device.id);
                        }
                      }}
                      disabled={statusInfo.variant === 'pending'}
                      title={setupErrors[device.id] || statusInfo.label}
                    >
                      <StatusIcon
                        size={14}
                        className={statusInfo.variant === 'pending' ? 'spin' : ''}
                      />
                      <span>{statusInfo.variant === 'error' ? 'Thử lại' : statusInfo.label}</span>
                    </button>
                    {setupErrors[device.id] && statusInfo.variant === 'error' && (
                      <div className="device-card-error" title={setupErrors[device.id]}>
                        <AlertCircle size={12} />
                        <span>{setupErrors[device.id].length > 50 ? setupErrors[device.id].substring(0, 50) + '...' : setupErrors[device.id]}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MuMu Tab */}
      {activeTab === 'mumu' && (
        <div className="device-list">
          {emuError && (
            <div className="device-error">
              <AlertCircle size={16} />
              {emuError}
            </div>
          )}

          {instances.length === 0 ? (
            <div className="device-empty">
              <Monitor size={40} strokeWidth={1.5} />
              <p>Chưa có giả lập MuMu</p>
              <span>Tạo mới để bắt đầu</span>
              <button
                className="device-btn device-btn--primary"
                onClick={handleCreate}
                disabled={actionLoading === 'create'}
              >
                {actionLoading === 'create' ? (
                  <RefreshCw size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                Tạo giả lập mới
              </button>
            </div>
          ) : (
            instances.map((instance) => {
              const isRunning = instance.is_running;
              const isAndroidStarted = instance.is_android_started;
              const isEditing = editingInstance === instance.index;

              return (
                <div
                  key={instance.index}
                  className={`device-card ${isRunning ? 'device-card--running' : ''}`}
                >
                  <div className="device-card-indicator" style={{
                    background: isAndroidStarted ? 'var(--success)' : isRunning ? 'var(--warning)' : 'var(--muted)'
                  }} />

                  <div className="device-card-icon">
                    <Monitor size={20} strokeWidth={1.5} />
                  </div>

                  <div className="device-card-content">
                    <div className="device-card-header">
                      {isEditing ? (
                        <div className="device-card-edit">
                          <input
                            type="text"
                            className="device-input device-input--sm"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename(instance.index)}
                            autoFocus
                          />
                          <button
                            className="device-btn device-btn--icon"
                            onClick={() => handleRename(instance.index)}
                            disabled={actionLoading === `rename-${instance.index}`}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="device-btn device-btn--icon"
                            onClick={() => { setEditingInstance(null); setNewName(''); }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="device-card-name">
                          {instance.name}
                        </span>
                      )}
                      <span className={`device-card-status ${isAndroidStarted ? 'device-card-status--online' : ''}`}>
                        <span className="device-card-dot" />
                        {isAndroidStarted ? 'Running' : isRunning ? 'Starting...' : 'Stopped'}
                      </span>
                    </div>
                    <div className="device-card-meta">
                      <span className="device-card-id">Index: {instance.index}</span>
                      {instance.adb_port && isAndroidStarted && (
                        <span className="device-card-android">
                          ADB: {instance.adb_host}:{instance.adb_port}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="device-card-actions">
                    {/* Launch/Shutdown */}
                    {!isRunning ? (
                      <button
                        className="device-btn device-btn--icon device-btn--success"
                        onClick={(e) => { e.stopPropagation(); handleLaunch(instance); }}
                        disabled={actionLoading?.startsWith('launch')}
                        title="Khởi động"
                      >
                        {actionLoading === `launch-${instance.index}` ? (
                          <RefreshCw size={14} className="spin" />
                        ) : (
                          <Power size={14} />
                        )}
                      </button>
                    ) : (
                      <button
                        className="device-btn device-btn--icon device-btn--error"
                        onClick={(e) => { e.stopPropagation(); handleShutdown(instance); }}
                        disabled={actionLoading?.startsWith('shutdown')}
                        title="Tắt"
                      >
                        {actionLoading === `shutdown-${instance.index}` ? (
                          <RefreshCw size={14} className="spin" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    )}

                    {/* Clone */}
                    <button
                      className="device-btn device-btn--icon"
                      onClick={(e) => { e.stopPropagation(); handleClone(instance.index); }}
                      disabled={actionLoading?.startsWith('clone') || isRunning}
                      title="Clone"
                    >
                      {actionLoading === `clone-${instance.index}` ? (
                        <RefreshCw size={14} className="spin" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>

                    {/* Rename */}
                    <button
                      className="device-btn device-btn--icon"
                      onClick={(e) => { e.stopPropagation(); setEditingInstance(instance.index); setNewName(instance.name); }}
                      disabled={isRunning}
                      title="Đổi tên"
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* Delete */}
                    <button
                      className="device-btn device-btn--icon device-btn--danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(instance.index, instance.name); }}
                      disabled={actionLoading?.startsWith('delete') || isRunning || instance.index === '0'}
                      title={instance.index === '0' ? 'Không thể xóa instance đầu tiên' : 'Xóa'}
                    >
                      {actionLoading === `delete-${instance.index}` ? (
                        <RefreshCw size={14} className="spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default DevicePanel;
