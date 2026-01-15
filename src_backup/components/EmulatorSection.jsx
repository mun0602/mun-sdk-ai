import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Power,
  MonitorPlay,
  Square,
} from 'lucide-react';
import { useEmulatorStore, useDeviceStore } from '../store';

function EmulatorSection() {
  const { 
    instances, 
    isLoading, 
    error, 
    isMumuInstalled, 
    checkMumuInstalled, 
    getInstances, 
    launchInstance, 
    shutdownInstance,
    connectAdb 
  } = useEmulatorStore();
  const { refreshDevices } = useDeviceStore();
  const [showEmulators, setShowEmulators] = useState(false);
  const [launchingIndex, setLaunchingIndex] = useState(null);

  // Check MuMu on mount
  useEffect(() => {
    checkMumuInstalled();
  }, []);

  // Load instances when expanded
  useEffect(() => {
    if (showEmulators && isMumuInstalled) {
      getInstances();
    }
  }, [showEmulators, isMumuInstalled]);

  const handleLaunch = async (instance) => {
    setLaunchingIndex(instance.index);
    try {
      await launchInstance(instance.index);
      // Poll until started
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const instances = await getInstances();
        const updated = instances.find(i => i.index === instance.index);
        if (updated?.is_android_started) {
          clearInterval(pollInterval);
          // Connect ADB
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

  const handleShutdown = async (instance) => {
    await shutdownInstance(instance.index);
    await refreshDevices();
  };

  if (!isMumuInstalled) {
    return null; // Don't show if MuMu not installed
  }

  return (
    <div className="card mb-4">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setShowEmulators(!showEmulators)}
      >
        <h3 className="card-title flex items-center gap-2">
          <MonitorPlay size={18} />
          Emulator Instances
          <span className="badge badge-info text-xs">{instances.length}</span>
        </h3>
        <button className="btn btn-secondary btn-sm">
          {showEmulators ? '▲' : '▼'}
        </button>
      </div>

      {showEmulators && (
        <div className="mt-3">
          <div className="flex gap-2 mb-3">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => getInstances()}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => launchInstance('all')}
              disabled={isLoading}
            >
              <Power size={14} />
              Khởi động tất cả
            </button>
          </div>

          {error && (
            <div className="badge badge-error mb-2">{error}</div>
          )}

          <div className="space-y-2">
            {instances.map((instance) => (
              <div 
                key={instance.index}
                className="flex items-center justify-between p-2 bg-secondary rounded"
              >
                <div className="flex items-center gap-2">
                  <span className={`badge ${instance.is_android_started ? 'badge-success' : instance.is_running ? 'badge-warning' : 'badge-secondary'}`}>
                    {instance.is_android_started ? '✓ Running' : instance.is_running ? '⏳ Starting' : '○ Stopped'}
                  </span>
                  <span className="font-medium">{instance.name}</span>
                  {instance.adb_port && instance.is_android_started && (
                    <span className="text-xs text-muted">
                      ADB: {instance.adb_host}:{instance.adb_port}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {!instance.is_running ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleLaunch(instance)}
                      disabled={launchingIndex === instance.index}
                    >
                      {launchingIndex === instance.index ? (
                        <div className="spinner" style={{ width: 14, height: 14 }} />
                      ) : (
                        <Power size={14} />
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => handleShutdown(instance)}
                      disabled={isLoading}
                    >
                      <Square size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {instances.length === 0 && !isLoading && (
            <p className="text-muted text-sm">Không tìm thấy emulator nào</p>
          )}
        </div>
      )}
    </div>
  );
}

export default EmulatorSection;
