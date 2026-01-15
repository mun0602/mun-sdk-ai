import React, { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  ChevronRight,
  Check,
  AlertCircle,
  RefreshCw,
  Download,
  ExternalLink,
  Layers,
  Activity,
  FolderOpen,
} from 'lucide-react';
import { useSettingsStore } from '../store';
import { invoke, listen } from '../tauri-mock';

function SettingsPanel() {
  const { 
    theme, setTheme, 
    maxParallelDevices, setMaxParallelDevices, 
    emulatorPath, setEmulatorPath, 
    tracing, updateTracing 
  } = useSettingsStore();

  const [status, setStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    checkPrerequisites();
  }, []);

  const checkPrerequisites = async () => {
    setIsChecking(true);
    try {
      const result = await invoke('check_all_prerequisites');
      setStatus(result);
    } catch (e) {
      console.error('Failed to check prerequisites:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const handleInstall = async () => {
    if (!status) return;
    
    if (!status.python.installed) {
      await invoke('open_url', { url: 'https://www.python.org/downloads/' });
      return;
    }
    
    if (!status.droidrun.installed) {
      setIsInstalling(true);
      setInstallProgress({ percent: 0, package: '', current: 0, total: 6 });
      
      const unlisten = await listen('install-progress', (event) => {
        const { current, total, percent, package: pkg } = event.payload;
        setInstallProgress({ current, total, percent, package: pkg });
      });
      
      try {
        await invoke('install_droidrun');
        await checkPrerequisites();
      } finally {
        unlisten();
        setIsInstalling(false);
        setInstallProgress(null);
      }
      return;
    }
    
    if (!status.adb.installed) {
      await invoke('open_url', { url: 'https://developer.android.com/tools/releases/platform-tools' });
    }
  };

  const checkForUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      setUpdateInfo(update ? { version: update.version, available: true } : { available: false });
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const allReady = status?.python?.installed && status?.droidrun?.installed && status?.adb?.installed;

  return (
    <div className="settings-container">
      {/* Header */}
      <header className="settings-header">
        <h1>Cài đặt</h1>
        <span className="settings-version">v3.9</span>
      </header>

      {/* Theme Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Giao diện</h2>
        <div className="settings-theme-grid">
          <button 
            className={`settings-theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => { setTheme('light'); document.documentElement.setAttribute('data-theme', 'light'); }}
          >
            <Sun size={20} />
            <span>Sáng</span>
          </button>
          <button 
            className={`settings-theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => { setTheme('dark'); document.documentElement.setAttribute('data-theme', 'dark'); }}
          >
            <Moon size={20} />
            <span>Tối</span>
          </button>
        </div>
      </section>

      {/* General Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Cấu hình</h2>
        
        <div className="settings-item">
          <div className="settings-item-info">
            <Layers size={18} />
            <div>
              <span className="settings-item-label">Thiết bị song song</span>
              <span className="settings-item-desc">Số lượng thiết bị chạy đồng thời</span>
            </div>
          </div>
          <div className="settings-stepper">
            <button onClick={() => setMaxParallelDevices(Math.max(1, maxParallelDevices - 1))}>−</button>
            <span>{maxParallelDevices}</span>
            <button onClick={() => setMaxParallelDevices(Math.min(10, maxParallelDevices + 1))}>+</button>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <FolderOpen size={18} />
            <div>
              <span className="settings-item-label">Thư mục giả lập</span>
              <span className="settings-item-desc">MuMu, LDPlayer, Nox...</span>
            </div>
          </div>
          <input
            type="text"
            className="settings-input"
            placeholder="Chọn thư mục..."
            value={emulatorPath}
            onChange={(e) => {
              setEmulatorPath(e.target.value);
              invoke('set_emulator_path', { path: e.target.value }).catch(console.error);
            }}
          />
        </div>
      </section>

      {/* Tracing Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Tracing</h2>
        
        <div className="settings-item clickable" onClick={() => updateTracing({ enabled: !tracing.enabled })}>
          <div className="settings-item-info">
            <Activity size={18} />
            <div>
              <span className="settings-item-label">Bật Tracing</span>
              <span className="settings-item-desc">Theo dõi và ghi log hoạt động</span>
            </div>
          </div>
          <div className={`settings-toggle ${tracing.enabled ? 'active' : ''}`}>
            <div className="settings-toggle-thumb" />
          </div>
        </div>

        {tracing.enabled && (
          <>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label" style={{ marginLeft: 26 }}>Provider</span>
              </div>
              <select
                className="settings-select"
                value={tracing.provider}
                onChange={(e) => updateTracing({ provider: e.target.value })}
              >
                <option value="none">Không</option>
                <option value="phoenix">Phoenix</option>
                <option value="langfuse">Langfuse</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label" style={{ marginLeft: 26 }}>Lưu Trajectory</span>
              </div>
              <select
                className="settings-select"
                value={tracing.saveTrajectory}
                onChange={(e) => updateTracing({ saveTrajectory: e.target.value })}
              >
                <option value="none">Không</option>
                <option value="step">Theo Step</option>
                <option value="action">Theo Action</option>
              </select>
            </div>
          </>
        )}
      </section>

      {/* Prerequisites Section */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">Tài nguyên</h2>
          <button className="settings-icon-btn" onClick={checkPrerequisites} disabled={isChecking}>
            <RefreshCw size={16} className={isChecking ? 'spin' : ''} />
          </button>
        </div>

        {status ? (
          <div className="settings-prerequisites">
            <div className={`settings-prereq-item ${status.python.installed ? 'ready' : ''}`}>
              <div className="settings-prereq-icon">
                {status.python.installed ? <Check size={14} /> : <AlertCircle size={14} />}
              </div>
              <span>Python</span>
              {status.python.version && <span className="settings-prereq-version">{status.python.version}</span>}
            </div>
            <div className={`settings-prereq-item ${status.droidrun.installed ? 'ready' : ''}`}>
              <div className="settings-prereq-icon">
                {status.droidrun.installed ? <Check size={14} /> : <AlertCircle size={14} />}
              </div>
              <span>DroidRun</span>
              {status.droidrun.version && <span className="settings-prereq-version">{status.droidrun.version}</span>}
            </div>
            <div className={`settings-prereq-item ${status.adb.installed ? 'ready' : ''}`}>
              <div className="settings-prereq-icon">
                {status.adb.installed ? <Check size={14} /> : <AlertCircle size={14} />}
              </div>
              <span>ADB</span>
            </div>

            {!allReady && (
              <button 
                className="settings-install-btn" 
                onClick={handleInstall}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <>
                    <div className="settings-progress-ring">
                      <svg viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${installProgress?.percent || 0}, 100`}
                        />
                      </svg>
                      <span>{installProgress?.percent || 0}%</span>
                    </div>
                    <span>Đang cài {installProgress?.package}...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Cài đặt thiếu</span>
                  </>
                )}
              </button>
            )}

            {allReady && (
              <div className="settings-all-ready">
                <Check size={16} />
                <span>Sẵn sàng</span>
              </div>
            )}
          </div>
        ) : (
          <div className="settings-loading">
            <RefreshCw size={16} className="spin" />
            <span>Đang kiểm tra...</span>
          </div>
        )}
      </section>

      {/* Update Section */}
      <section className="settings-section">
        <div className="settings-item clickable" onClick={checkForUpdate}>
          <div className="settings-item-info">
            <Download size={18} />
            <div>
              <span className="settings-item-label">Kiểm tra cập nhật</span>
              <span className="settings-item-desc">
                {updateInfo?.available 
                  ? `Có phiên bản mới: v${updateInfo.version}` 
                  : updateInfo?.available === false 
                    ? 'Đã là bản mới nhất'
                    : 'Nhấn để kiểm tra'}
              </span>
            </div>
          </div>
          {isCheckingUpdate ? (
            <RefreshCw size={18} className="spin" />
          ) : (
            <ChevronRight size={18} className="settings-chevron" />
          )}
        </div>
      </section>
    </div>
  );
}

export default SettingsPanel;
