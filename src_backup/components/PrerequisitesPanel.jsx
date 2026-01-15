import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Settings,
  Check,
  AlertCircle,
} from 'lucide-react';
import { invoke, listen } from '../tauri-mock';

function PrerequisitesPanel() {
  const [status, setStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(null);
  const [installLog, setInstallLog] = useState('');
  const [installProgress, setInstallProgress] = useState(null);

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

  useEffect(() => {
    checkPrerequisites();
  }, []);

  const handleInstallDroidrun = async () => {
    setIsInstalling('droidrun');
    setInstallLog('');
    setInstallProgress({ percent: 0, package: '', current: 0, total: 6 });
    
    const unlisten = await listen('install-progress', (event) => {
      const { current, total, percent, package: pkg, status } = event.payload;
      setInstallProgress({ current, total, percent, package: pkg });
      if (status === 'installing') {
        setInstallLog(`Đang cài đặt ${pkg} (${current}/${total})...`);
      } else if (status === 'done') {
        setInstallLog(`✓ ${pkg} (${current}/${total})`);
      } else if (status === 'error') {
        setInstallLog(`✗ Lỗi cài đặt ${pkg}`);
      }
    });
    
    try {
      await invoke('install_droidrun');
      setInstallLog('✓ Cài đặt hoàn tất!');
      setInstallProgress({ percent: 100, package: 'done', current: 6, total: 6 });
      await checkPrerequisites();
    } catch (e) {
      setInstallLog(`Lỗi: ${e}`);
    } finally {
      unlisten();
      setIsInstalling(null);
    }
  };

  const handleOpenPythonDownload = async () => {
    await invoke('open_url', { url: 'https://www.python.org/downloads/' });
  };

  const handleOpenAdbDownload = async () => {
    await invoke('open_url', { url: 'https://developer.android.com/tools/releases/platform-tools' });
  };

  const getStatusIcon = (installed) => {
    return installed ? (
      <Check size={16} className="text-success" />
    ) : (
      <AlertCircle size={16} className="text-danger" />
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">
          <Settings size={18} className="inline mr-2" />
          Thành phần cần thiết
        </h3>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={checkPrerequisites}
            disabled={isChecking}
          >
            {isChecking ? <div className="spinner" /> : <RefreshCw size={14} />}
            Kiểm tra
          </button>
          {status && !(status.python.installed && status.droidrun.installed && status.adb.installed) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!status.python.installed) handleOpenPythonDownload();
                else if (!status.droidrun.installed) handleInstallDroidrun();
                else if (!status.adb.installed) handleOpenAdbDownload();
              }}
              disabled={isInstalling}
            >
              {isInstalling ? <><div className="spinner" /> Đang cài 1/{[!status.python.installed, !status.droidrun.installed, !status.adb.installed].filter(Boolean).length}...</> : 'Cài đặt'}
            </button>
          )}
        </div>
      </div>

      {status ? (
        <div className={`p-3 rounded ${status.python.installed && status.droidrun.installed && status.adb.installed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
          {status.python.installed && status.droidrun.installed && status.adb.installed ? (
            <div className="flex items-center gap-2">
              <Check size={18} />
              <span className="font-medium">Tất cả thành phần đã sẵn sàng!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="font-medium">
                Còn thiếu {[!status.python.installed, !status.droidrun.installed, !status.adb.installed].filter(Boolean).length} thành phần
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-muted">
          {isChecking ? 'Đang kiểm tra...' : 'Nhấn "Kiểm tra" để xem trạng thái'}
        </div>
      )}

      {/* Install Log */}
      {installLog && (
        <div className="mt-3">
          <pre className="bg-secondary p-2 rounded text-sm max-h-32 overflow-auto">
            {installLog}
          </pre>
        </div>
      )}

      {/* Progress Bar */}
      {isInstalling && installProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted">
              {installProgress.package && installProgress.package !== 'done' 
                ? `Đang cài: ${installProgress.package}` 
                : 'Hoàn tất'}
            </span>
            <span className="text-sm font-medium">{installProgress.percent}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${installProgress.percent}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1 text-center">
            {installProgress.current}/{installProgress.total} packages
          </div>
        </div>
      )}
    </div>
  );
}

export default PrerequisitesPanel;
