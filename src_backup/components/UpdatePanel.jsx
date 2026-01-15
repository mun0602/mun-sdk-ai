import React, { useState } from 'react';
import {
  RefreshCw,
  Check,
  AlertCircle,
  ArrowDownCircle,
  Download,
} from 'lucide-react';

function UpdatePanel() {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [error, setError] = useState(null);

  const checkForUpdate = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateInfo({
          version: update.version,
          body: update.body,
          date: update.date,
        });
      } else {
        setUpdateInfo({ upToDate: true });
      }
    } catch (e) {
      setError(e.toString());
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    setIsUpdating(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }
    } catch (e) {
      setError(e.toString());
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="card mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">
          <ArrowDownCircle size={18} className="inline mr-2" />
          Cập nhật ứng dụng
        </h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={checkForUpdate}
          disabled={isChecking || isUpdating}
        >
          {isChecking ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : <RefreshCw size={14} />}
          <span className="ml-1">Kiểm tra</span>
        </button>
      </div>

      <p className="text-muted text-sm mb-3">
        Phiên bản hiện tại: <strong>v3.5.0</strong>
      </p>

      {error && (
        <div className="badge badge-error mb-3 w-full justify-center">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {updateInfo && !updateInfo.upToDate && (
        <div className="p-3 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Phiên bản mới: v{updateInfo.version}</p>
              {updateInfo.body && <p className="text-sm text-muted mt-1">{updateInfo.body}</p>}
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={downloadAndInstall}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px' }} />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Cập nhật ngay
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {updateInfo?.upToDate && (
        <div className="badge badge-success w-full justify-center">
          <Check size={14} />
          Bạn đang dùng phiên bản mới nhất!
        </div>
      )}
    </div>
  );
}

export default UpdatePanel;
