// Zustand Store - Quản lý state toàn cục
// Ported from Flet Python logic (droidrun_app_flet.py)

import { create } from 'zustand';
import { invoke } from './tauri-mock';
import { listen } from '@tauri-apps/api/event';
import { DEFAULT_PROFILES } from './constants/providers';

// License Store - with online validation + offline fallback (Flet logic)
export const useLicenseStore = create((set, get) => ({
  license: null,
  isLoading: true,
  error: null,

  checkLicense: async () => {
    set({ isLoading: true, error: null });
    try {
      const license = await invoke('check_license');
      set({ license, isLoading: false });
      return license;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      return null;
    }
  },

  activateLicense: async (key) => {
    set({ isLoading: true, error: null });
    try {
      const license = await invoke('activate_license', { licenseKey: key });
      set({ license, isLoading: false });
      return license;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await invoke('logout_license');
      set({ license: null });
    } catch (error) {
      set({ error: error.toString() });
    }
  },

  // Get license display text (Flet logic: _get_license_display_text)
  getLicenseDisplayText: () => {
    const { license } = get();
    if (!license || !license.is_valid) {
      return '⚠ No License';
    }
    
    const plan = license.plan || 'Unknown';
    const expiryDate = license.expiry_date;
    
    if (expiryDate && expiryDate !== 'Unlimited') {
      try {
        const expDate = new Date(expiryDate);
        const now = new Date();
        const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        const expStr = expDate.toLocaleDateString('vi-VN');
        
        if (daysLeft < 0) {
          return `⚠ ${plan} - Expired`;
        } else if (daysLeft <= 7) {
          return `⚠ ${plan} - Expires: ${expStr} (${daysLeft}d left)`;
        } else {
          return `✓ ${plan} - Expires: ${expStr}`;
        }
      } catch {
        return `✓ ${plan}`;
      }
    } else {
      return `✓ ${plan} - Lifetime`;
    }
  },
}));

// Device Store - with emulator auto-connect (Flet logic)
// Lock to prevent duplicate calls
let isAutoConnecting = false;
let isScanningPorts = false;

export const useDeviceStore = create((set, get) => ({
  devices: [],
  selectedDevice: null,
  isLoading: false,
  error: null,
  isScanning: false,

  refreshDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const devices = await invoke('get_connected_devices');
      set({ devices, isLoading: false });

      // Auto-select first device if none selected
      if (!get().selectedDevice && devices.length > 0) {
        set({ selectedDevice: devices[0].id });
      }
      return devices;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      return [];
    }
  },

  selectDevice: (deviceId) => {
    set({ selectedDevice: deviceId });
  },

  connectDevice: async (address) => {
    try {
      const result = await invoke('adb_connect', { address });
      if (result.success) {
        await get().refreshDevices();
      }
      return result;
    } catch (error) {
      set({ error: error.toString() });
      throw error;
    }
  },

  disconnectDevice: async (address) => {
    try {
      await invoke('adb_disconnect', { address });
      await get().refreshDevices();
    } catch (error) {
      set({ error: error.toString() });
    }
  },

  // Auto-connect to emulators on startup (Flet logic: auto_connect_adb)
  autoConnectEmulators: async () => {
    // Prevent duplicate calls
    if (isAutoConnecting) {
      console.log('[ADB] Auto-connect already in progress, skipping...');
      return [];
    }
    isAutoConnecting = true;
    set({ isScanning: true });
    try {
      const connected = await invoke('auto_connect_emulators');
      console.log('[ADB] Auto-connected to emulators:', connected);
      await get().refreshDevices();
      return connected;
    } catch (error) {
      console.error('[ADB] Auto-connect error:', error);
      return [];
    } finally {
      set({ isScanning: false });
      isAutoConnecting = false;
    }
  },

  // Scan all emulator ports (Flet logic: EMULATOR_PORTS)
  scanEmulatorPorts: async () => {
    // Prevent duplicate calls
    if (isScanningPorts) {
      console.log('[ADB] Port scan already in progress, skipping...');
      return [];
    }
    isScanningPorts = true;
    set({ isScanning: true });
    try {
      const connected = await invoke('scan_emulator_ports');
      console.log('[ADB] Scanned emulator ports:', connected);
      await get().refreshDevices();
      return connected;
    } catch (error) {
      console.error('[ADB] Scan error:', error);
      return [];
    } finally {
      set({ isScanning: false });
      isScanningPorts = false;
    }
  },

  // Check if DroidRun APK is installed (Flet logic: _check_droidrun_installed)
  checkDroidRunInstalled: async (deviceId) => {
    try {
      return await invoke('check_droidrun_installed', { deviceId });
    } catch (error) {
      console.error('[DroidRun] Check installed error:', error);
      return false;
    }
  },

  // Setup DroidRun APK on device (Flet logic: _setup_droidrun)
  setupDroidRun: async (deviceId) => {
    try {
      const result = await invoke('setup_droidrun', { deviceId });
      return result;
    } catch (error) {
      console.error('[DroidRun] Setup error:', error);
      throw error;
    }
  },

  // Restart ADB server
  restartAdbServer: async () => {
    set({ isLoading: true });
    try {
      await invoke('restart_adb_server');
      await get().refreshDevices();
    } catch (error) {
      set({ error: error.toString() });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Profile Store
export const useProfileStore = create((set, get) => ({
  profiles: [],
  activeProfile: null,
  isLoading: false,

  loadProfiles: async () => {
    set({ isLoading: true });
    try {
      const config = await invoke('load_config');
      let profiles = config.profiles || [];

      // Auto-create default profiles if they don't exist
      for (const defaultProfile of DEFAULT_PROFILES) {
        const exists = profiles.find(p => p.id === defaultProfile.id);
        if (!exists) {
          try {
            const newProfile = await invoke('create_profile', { profile: defaultProfile });
            profiles.push(newProfile);
          } catch (e) {
            console.warn('Could not create default profile:', defaultProfile.name, e);
          }
        }
      }

      const foundProfile = profiles.find(p => p.id === config.active_profile_id);
      set({
        profiles,
        activeProfile: foundProfile || null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading profiles:', error);
      set({ isLoading: false });
    }
  },

  createProfile: async (profile) => {
    try {
      const newProfile = await invoke('create_profile', { profile });
      set(state => ({
        profiles: [...state.profiles, newProfile],
        activeProfile: newProfile,
      }));
      await invoke('set_active_profile', { profileId: newProfile.id });
      return newProfile;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  },

  updateProfile: async (profile) => {
    try {
      const updated = await invoke('update_profile', { profile });
      set(state => ({
        profiles: state.profiles.map(p => p.id === updated.id ? updated : p),
        activeProfile: state.activeProfile?.id === updated.id ? updated : state.activeProfile,
      }));
      return updated;
    } catch (error) {
      throw error;
    }
  },

  deleteProfile: async (profileId) => {
    try {
      await invoke('delete_profile', { profileId });
      set(state => ({
        profiles: state.profiles.filter(p => p.id !== profileId),
        activeProfile: state.activeProfile?.id === profileId ? null : state.activeProfile,
      }));
    } catch (error) {
      throw error;
    }
  },

  setActiveProfile: async (profileId) => {
    try {
      await invoke('set_active_profile', { profileId });
      const profile = get().profiles.find(p => p.id === profileId);
      set({ activeProfile: profile });
    } catch (error) {
      throw error;
    }
  },
}));

// Task Store - with parallel execution (Flet logic: run_all_devices)
export const useTaskStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  isRunning: false,
  logs: [],
  outputListener: null,
  runningDevices: [], // Track which devices are currently running

  setupOutputListener: async () => {
    // Setup listener for real-time task output
    const unlisten = await listen('task-output', (event) => {
      const output = event.payload;
      get().addLog({ level: 'info', message: output });
    });
    set({ outputListener: unlisten });
  },

  cleanupOutputListener: () => {
    const { outputListener } = get();
    if (outputListener) {
      outputListener();
      set({ outputListener: null });
    }
  },

  // Helper function to wrap task execution with listener setup/cleanup
  _withTaskExecution: async (deviceIds, executeFn) => {
    set({ isRunning: true, logs: [], runningDevices: deviceIds });
    await get().setupOutputListener();

    try {
      const result = await executeFn();
      set({ isRunning: false, runningDevices: [] });
      return result;
    } catch (error) {
      set(state => ({
        isRunning: false,
        runningDevices: [],
        logs: [...state.logs, { level: 'error', message: error.toString() }],
      }));
      throw error;
    } finally {
      get().cleanupOutputListener();
    }
  },

  // Run task on single device
  runTask: async (params) => {
    return get()._withTaskExecution([params.device_id], async () => {
      const result = await invoke('run_task', {
        deviceId: params.device_id,
        provider: params.provider,
        apiKey: params.api_key,
        model: params.model,
        prompt: params.prompt,
        baseUrl: params.base_url,
        vision: params.vision,
        reasoning: params.reasoning,
        tracing: params.tracing,
      });

      set(state => ({
        logs: [...state.logs, { level: 'success', message: 'Task hoàn thành!' }],
      }));
      return result;
    });
  },

  // Run task on multiple devices in parallel (Flet logic: run_all_devices)
  runParallelTasks: async (deviceIds, taskParams, maxParallel = 3) => {
    return get()._withTaskExecution(deviceIds, async () => {
      get().addLog({
        level: 'info',
        message: `[PARALLEL] Starting tasks on ${deviceIds.length} device(s)...`
      });

      const tasks = deviceIds.map(deviceId => ({
        device_id: deviceId,
        provider: taskParams.provider,
        api_key: taskParams.api_key,
        model: taskParams.model,
        prompt: taskParams.prompt,
        base_url: taskParams.base_url,
        vision: taskParams.vision,
        reasoning: taskParams.reasoning,
        tracing: taskParams.tracing,
      }));

      const results = await invoke('run_parallel_tasks', {
        tasks: tasks.map(t => ({
          deviceId: t.device_id,
          provider: t.provider,
          apiKey: t.api_key,
          model: t.model,
          prompt: t.prompt,
          baseUrl: t.base_url,
          vision: t.vision,
          reasoning: t.reasoning,
          tracing: t.tracing,
        })),
        maxParallel,
      });

      const successCount = results.filter(r => r.success).length;
      set(state => ({
        logs: [...state.logs, {
          level: successCount === results.length ? 'success' : 'warning',
          message: `[DONE] ${successCount}/${results.length} tasks succeeded`
        }],
      }));

      return results;
    });
  },

  // Stop all running tasks (Flet logic: stop_task)
  stopTasks: async () => {
    const { runningDevices } = get();
    get().addLog({ level: 'info', message: '[SYS] Stopping all tasks...' });
    
    // TODO: Implement actual task cancellation
    for (const deviceId of runningDevices) {
      try {
        await invoke('cancel_task', { taskId: deviceId });
      } catch (error) {
        console.error(`Failed to cancel task for ${deviceId}:`, error);
      }
    }

    set({ isRunning: false, runningDevices: [] });
    get().cleanupOutputListener();
  },

  addLog: (log) => {
    set(state => ({ logs: [...state.logs, log] }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },
}));

// Task Template Store - Quản lý các task template có thể tái sử dụng
// Persist to localStorage
const TASK_TEMPLATES_KEY = 'mun-sdk-task-templates';

const loadTemplatesFromStorage = () => {
  try {
    const saved = localStorage.getItem(TASK_TEMPLATES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveTemplatesToStorage = (templates) => {
  try {
    localStorage.setItem(TASK_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save templates:', e);
  }
};

export const useTaskTemplateStore = create((set, get) => ({
  templates: loadTemplatesFromStorage(),
  isLoading: false,

  addTemplate: (template) => {
    const newTemplate = {
      id: crypto.randomUUID(),
      name: template.name,
      prompt: template.prompt,
      createdAt: new Date().toISOString(),
    };
    const newTemplates = [...get().templates, newTemplate];
    set({ templates: newTemplates });
    saveTemplatesToStorage(newTemplates);
    return newTemplate;
  },

  updateTemplate: (id, updates) => {
    const newTemplates = get().templates.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    set({ templates: newTemplates });
    saveTemplatesToStorage(newTemplates);
  },

  removeTemplate: (id) => {
    const newTemplates = get().templates.filter(t => t.id !== id);
    set({ templates: newTemplates });
    saveTemplatesToStorage(newTemplates);
  },

  getTemplate: (id) => {
    return get().templates.find(t => t.id === id);
  },

  loadTemplates: () => {
    set({ templates: loadTemplatesFromStorage() });
  },
}));

// Scheduler Store - Persist to localStorage
const SCHEDULES_KEY = 'mun-sdk-schedules';

const loadSchedulesFromStorage = () => {
  try {
    const saved = localStorage.getItem(SCHEDULES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load schedules:', e);
    return [];
  }
};

const saveSchedulesToStorage = (schedules) => {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.error('Failed to save schedules:', e);
  }
};

export const useSchedulerStore = create((set, get) => ({
  scheduledTasks: loadSchedulesFromStorage(),
  isLoading: false,
  runningTaskIds: [], // Track tasks currently running
  schedulerInterval: null,
  logs: [], // Scheduler logs for UI

  // Add log entry
  addLog: (msg, type = 'info') => {
    set(state => ({
      logs: [...state.logs, { time: new Date(), msg, type }].slice(-30),
    }));
  },

  // Clear logs
  clearLogs: () => {
    set({ logs: [] });
  },

  addSchedule: async (schedule) => {
    try {
      // Tauri expects camelCase parameter names
      const result = await invoke('schedule_task', {
        task: {
          prompt: schedule.prompt,
          deviceId: schedule.deviceId,
          provider: schedule.profile?.provider?.name,
          apiKey: schedule.profile?.provider?.api_key,
          model: schedule.profile?.provider?.model,
          baseUrl: schedule.profile?.provider?.base_url,
          emulatorIndex: schedule.emulatorIndex,
          macroId: schedule.macroId,
          taskSource: schedule.taskSource,
        },
        scheduleTime: schedule.scheduleTime,
        // Convert repeat string to RepeatConfig hoặc null
        repeat: schedule.repeat && schedule.repeat !== 'none' ? {
          intervalMinutes: schedule.repeat === 'daily' ? 1440 : schedule.repeat === 'weekly' ? 10080 : 0,
          maxRuns: null,
          currentRuns: 0,
          repeatType: schedule.repeat,
        } : null,
      });

      const newSchedule = {
        id: result.id,
        name: schedule.name,
        prompt: schedule.prompt,
        deviceId: schedule.deviceId,
        scheduleTime: schedule.scheduleTime,
        repeat: schedule.repeat,
        profile: schedule.profile,
        enabled: result.enabled,
        emulatorIndex: schedule.emulatorIndex,
        macroId: schedule.macroId,
        taskSource: schedule.taskSource,
        autoShutdown: schedule.autoShutdown !== false, // default true
        createdAt: new Date().toISOString(),
        lastRun: null,
      };

      const newTasks = [...get().scheduledTasks, newSchedule];
      set({ scheduledTasks: newTasks });
      saveSchedulesToStorage(newTasks);
      return newSchedule;
    } catch (error) {
      console.error('Error adding schedule:', error);
      throw error;
    }
  },

  removeSchedule: (id) => {
    const newTasks = get().scheduledTasks.filter(t => t.id !== id);
    set({ scheduledTasks: newTasks });
    saveSchedulesToStorage(newTasks);
  },

  toggleSchedule: (id) => {
    const newTasks = get().scheduledTasks.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    set({ scheduledTasks: newTasks });
    saveSchedulesToStorage(newTasks);
  },

  updateSchedule: (id, updates) => {
    const newTasks = get().scheduledTasks.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ scheduledTasks: newTasks });
    saveSchedulesToStorage(newTasks);
  },

  clearSchedules: () => {
    set({ scheduledTasks: [] });
    saveSchedulesToStorage([]);
  },

  // Mark task as running
  markTaskRunning: (id) => {
    set(state => ({
      runningTaskIds: [...state.runningTaskIds, id],
    }));
  },

  // Mark task as finished
  markTaskFinished: (id) => {
    set(state => ({
      runningTaskIds: state.runningTaskIds.filter(tid => tid !== id),
    }));
  },

  // Update last run time and schedule next run for repeating tasks
  updateTaskAfterRun: (id) => {
    const newTasks = get().scheduledTasks.map(t => {
      if (t.id !== id) return t;
      
      const now = new Date();
      let newScheduleTime = t.scheduleTime;
      
      // Calculate next run for repeating tasks
      if (t.repeat && t.repeat !== 'none') {
        const nextRun = new Date(t.scheduleTime);
        if (t.repeat === 'daily') {
          nextRun.setDate(nextRun.getDate() + 1);
        } else if (t.repeat === 'weekly') {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        newScheduleTime = nextRun.toISOString().slice(0, 16);
      }
      
      return {
        ...t,
        lastRun: now.toISOString(),
        scheduleTime: newScheduleTime,
      };
    });
    set({ scheduledTasks: newTasks });
    saveSchedulesToStorage(newTasks);
  },

  // Start scheduler loop
  startScheduler: () => {
    const { schedulerInterval, addLog } = get();
    if (schedulerInterval) return; // Already running

    console.log('[SCHEDULER] Starting scheduler loop...');
    addLog('🚀 Scheduler đã khởi động', 'success');
    
    const interval = setInterval(async () => {
      const { scheduledTasks, runningTaskIds, markTaskRunning, markTaskFinished, updateTaskAfterRun, addLog } = get();
      const now = new Date();

      for (const task of scheduledTasks) {
        // Skip if not enabled or already running
        if (!task.enabled) {
          continue;
        }
        if (runningTaskIds.includes(task.id)) {
          continue;
        }

        // Parse schedule time - handle datetime-local format (YYYY-MM-DDTHH:MM)
        const scheduleTime = new Date(task.scheduleTime);
        const timeDiff = now.getTime() - scheduleTime.getTime();
        const diffSec = Math.round(timeDiff / 1000);
        
        // Log countdown for tasks coming up soon
        if (timeDiff < 0 && timeDiff > -60000) {
          addLog(`⏳ "${task.name}" sẽ chạy sau ${-diffSec}s`, 'info');
        }
        
        // Check if it's time to run (within 2 minute window to be safe)
        if (timeDiff >= 0 && timeDiff < 120000) {
          console.log(`[SCHEDULER] >>> RUNNING task: ${task.name} (${task.id})`);
          addLog(`▶️ Bắt đầu: "${task.name}"`, 'success');
          
          markTaskRunning(task.id);
          let launchedEmulator = false;
          
          try {
            // Step 1: Launch emulator if needed
            if (task.emulatorIndex) {
              console.log(`[SCHEDULER] Checking emulator: ${task.emulatorIndex}`);
              addLog(`📱 Kiểm tra emulator ${task.emulatorIndex}...`, 'info');
              
              // Check if emulator is already running
              const instances = await invoke('get_emulator_instances');
              console.log(`[SCHEDULER] Emulator instances:`, instances);
              const targetInstance = instances.instances?.find(
                i => i.index === task.emulatorIndex || task.emulatorIndex === 'all'
              );
              
              if (!targetInstance?.is_running) {
                console.log(`[SCHEDULER] Launching emulator...`);
                addLog(`🔄 Đang khởi động emulator... (chờ ~60s)`, 'warning');
                await invoke('launch_emulator', { vmindex: task.emulatorIndex });
                launchedEmulator = true;
                
                // Wait for emulator to start (poll every 5s, max 90s)
                let attempts = 0;
                const maxAttempts = 18;
                while (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 5000));
                  attempts++;
                  
                  const checkInstances = await invoke('get_emulator_instances');
                  const instance = checkInstances.instances?.find(
                    i => i.index === task.emulatorIndex
                  );
                  
                  if (instance?.is_android_started) {
                    console.log(`[SCHEDULER] Emulator ready after ${attempts * 5}s`);
                    addLog(`✅ Emulator sẵn sàng sau ${attempts * 5}s`, 'success');
                    // Connect ADB
                    if (instance.adb_host && instance.adb_port) {
                      console.log(`[SCHEDULER] Connecting ADB: ${instance.adb_host}:${instance.adb_port}`);
                      addLog(`🔗 Kết nối ADB ${instance.adb_host}:${instance.adb_port}...`, 'info');
                      await invoke('connect_emulator_adb', { 
                        adbHost: instance.adb_host, 
                        adbPort: instance.adb_port 
                      });
                    }
                    break;
                  }
                  console.log(`[SCHEDULER] Waiting for emulator... (${attempts * 5}s)`);
                  addLog(`⏳ Chờ emulator khởi động... (${attempts * 5}s/${maxAttempts * 5}s)`, 'info');
                }
                
                if (attempts >= maxAttempts) {
                  console.error(`[SCHEDULER] Emulator startup timeout`);
                  addLog(`❌ Timeout: Emulator không khởi động được`, 'error');
                  throw new Error('Emulator startup timeout');
                }
              } else {
                console.log(`[SCHEDULER] Emulator already running`);
                addLog(`✅ Emulator đã chạy sẵn`, 'success');
              }
            }

            // Step 2: Build scheduled task object for Rust
            const scheduledTask = {
              id: task.id,
              task: {
                id: task.id,
                name: task.name,
                deviceId: task.deviceId,
                profileId: '',
                prompt: task.prompt,
                status: 'Pending',
                progress: 0,
                currentStep: 0,
                maxSteps: 50,
                logs: [],
                createdAt: task.createdAt,
                startedAt: null,
                completedAt: null,
                error: null,
                emulatorIndex: task.emulatorIndex || null,
                provider: task.profile?.provider?.name || null,
                apiKey: task.profile?.provider?.api_key || null,
                model: task.profile?.provider?.model || null,
                baseUrl: task.profile?.provider?.base_url || null,
                macroId: task.macroId || null,
                taskSource: task.taskSource || null,
              },
              scheduleTime: task.scheduleTime,
              repeat: task.repeat && task.repeat !== 'none' ? {
                intervalMinutes: task.repeat === 'daily' ? 1440 : 10080,
                maxRuns: null,
                currentRuns: 0,
                repeatType: task.repeat,
              } : null,
              enabled: true,
            };
            
            console.log(`[SCHEDULER] scheduledTask payload:`, JSON.stringify(scheduledTask, null, 2));

            // Step 3: Run the task
            console.log(`[SCHEDULER] Calling run_scheduled_task...`);
            addLog(`🤖 Đang chạy task "${task.name}"...`, 'info');
            const taskResult = await invoke('run_scheduled_task', { scheduledTask });
            console.log(`[SCHEDULER] Task completed: ${task.name}`, taskResult);
            addLog(`✅ Task "${task.name}" hoàn thành!`, 'success');
            
            updateTaskAfterRun(task.id);
            
            // Step 4: Shutdown emulator if we launched it AND autoShutdown is enabled
            if (launchedEmulator && task.emulatorIndex && task.autoShutdown !== false) {
              console.log(`[SCHEDULER] Will shutdown emulator in 5s...`);
              addLog(`⏳ Chờ 5s trước khi đóng emulator...`, 'info');
              await new Promise(r => setTimeout(r, 5000));
              console.log(`[SCHEDULER] Shutting down emulator...`);
              addLog(`🔌 Đang đóng emulator...`, 'info');
              try {
                await invoke('shutdown_emulator', { vmindex: task.emulatorIndex });
                console.log(`[SCHEDULER] Emulator shutdown complete`);
                addLog(`✅ Emulator đã đóng`, 'success');
              } catch (e) {
                console.error(`[SCHEDULER] Emulator shutdown failed:`, e);
                addLog(`❌ Lỗi đóng emulator: ${e}`, 'error');
              }
            } else if (launchedEmulator && task.autoShutdown === false) {
              console.log(`[SCHEDULER] Auto shutdown disabled, keeping emulator running`);
              addLog(`ℹ️ Giữ emulator chạy (auto shutdown tắt)`, 'info');
            }
          } catch (error) {
            console.error(`[SCHEDULER] Task failed: ${task.name}`, error);
            addLog(`❌ Task "${task.name}" thất bại: ${error?.message || error}`, 'error');
            // DON'T shutdown on error - let user debug
          } finally {
            markTaskFinished(task.id);
          }
        }
      }
    }, 10000); // Check every 10 seconds

    set({ schedulerInterval: interval });
  },

  // Stop scheduler loop
  stopScheduler: () => {
    const { schedulerInterval, addLog } = get();
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      set({ schedulerInterval: null });
      addLog('⏹️ Scheduler đã dừng', 'warning');
    }
  },
}));

// Settings Store
export const useSettingsStore = create((set) => ({
  theme: 'light',
  language: 'vi',
  autoConnect: true,
  maxParallelDevices: 3,
  emulatorPath: '', // Thư mục chứa giả lập (MuMu, LDPlayer, etc.)
  // Tracing settings
  tracing: {
    enabled: false,
    provider: 'none', // 'none' | 'phoenix' | 'langfuse'
    phoenixUrl: '',
    phoenixProjectName: '',
    langfuseSecretKey: '',
    langfusePublicKey: '',
    langfuseHost: 'https://cloud.langfuse.com',
    langfuseUserId: '',
    saveTrajectory: 'none', // 'none' | 'step' | 'action'
  },

  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setAutoConnect: (autoConnect) => set({ autoConnect }),
  setMaxParallelDevices: (max) => set({ maxParallelDevices: max }),
  setEmulatorPath: (path) => set({ emulatorPath: path }),
  
  // Tracing setters
  setTracing: (tracing) => set({ tracing }),
  updateTracing: (updates) => set((state) => ({
    tracing: { ...state.tracing, ...updates }
  })),

  loadSettings: async () => {
    try {
      const config = await invoke('load_config');
      if (config.settings) {
        set({
          theme: config.settings.theme || 'light',
          language: config.settings.language || 'vi',
          autoConnect: config.settings.auto_connect ?? true,
          maxParallelDevices: config.settings.max_parallel_devices || 3,
          emulatorPath: config.settings.emulator_path || '',
          tracing: config.settings.tracing ? {
            enabled: config.settings.tracing.enabled || false,
            provider: config.settings.tracing.provider || 'none',
            phoenixUrl: config.settings.tracing.phoenix_url || '',
            phoenixProjectName: config.settings.tracing.phoenix_project_name || '',
            langfuseSecretKey: config.settings.tracing.langfuse_secret_key || '',
            langfusePublicKey: config.settings.tracing.langfuse_public_key || '',
            langfuseHost: config.settings.tracing.langfuse_host || 'https://cloud.langfuse.com',
            langfuseUserId: config.settings.tracing.langfuse_user_id || '',
            saveTrajectory: config.settings.tracing.save_trajectory || 'none',
          } : {
            enabled: false,
            provider: 'none',
            phoenixUrl: '',
            phoenixProjectName: '',
            langfuseSecretKey: '',
            langfusePublicKey: '',
            langfuseHost: 'https://cloud.langfuse.com',
            langfuseUserId: '',
            saveTrajectory: 'none',
          },
        });
      }
    } catch (error) {
      console.error('Lỗi load settings:', error);
    }
  },

  saveSettings: async () => {
    // TODO: Implement save settings
  },
}));

// UI Store
export const useUIStore = create((set, get) => ({
  activeTab: 'devices',
  showProfileModal: false,
  showSettingsModal: false,
  showSchedulerModal: false,
  notifications: [],
  isBusy: false, // Global busy state (recording/replaying)
  busyMessage: '',

  setActiveTab: (tab) => {
    const { isBusy } = get();
    if (isBusy) {
      // Don't allow tab change while busy
      return;
    }
    set({ activeTab: tab });
  },
  
  setBusy: (busy, message = '') => set({ isBusy: busy, busyMessage: message }),
  
  toggleProfileModal: () => set(state => ({ showProfileModal: !state.showProfileModal })),
  toggleSettingsModal: () => set(state => ({ showSettingsModal: !state.showSettingsModal })),
  toggleSchedulerModal: () => set(state => ({ showSchedulerModal: !state.showSchedulerModal })),

  addNotification: (notification) => {
    const id = Date.now();
    set(state => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    // Auto remove after 5 seconds
    setTimeout(() => {
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id),
      }));
    }, 5000);
  },

  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },
}));

// Emulator Store - MuMu/LDPlayer management
export const useEmulatorStore = create((set, get) => ({
  instances: [],
  isLoading: false,
  error: null,
  isMumuInstalled: false,
  mumuPath: null,
  customPath: '',

  // Set custom emulator path
  setEmulatorPath: async (path) => {
    try {
      await invoke('set_emulator_path', { path: path.trim() });
      set({ customPath: path.trim() });
      // Re-check installation with new path
      await get().checkMumuInstalled();
      return true;
    } catch (error) {
      console.error('[Emulator] Set path error:', error);
      return false;
    }
  },

  // Get current emulator path
  getEmulatorPath: async () => {
    try {
      const path = await invoke('get_emulator_path');
      set({ customPath: path || '' });
      return path;
    } catch (error) {
      console.error('[Emulator] Get path error:', error);
      return null;
    }
  },

  // Check if MuMu is installed
  checkMumuInstalled: async () => {
    try {
      const installed = await invoke('check_mumu_installed');
      const path = installed ? await invoke('get_mumu_path') : null;
      set({ isMumuInstalled: installed, mumuPath: path });
      return installed;
    } catch (error) {
      console.error('[Emulator] Check MuMu installed error:', error);
      set({ isMumuInstalled: false });
      return false;
    }
  },

  // Get all emulator instances
  getInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('get_emulator_instances');
      if (result.success && result.instances) {
        set({ instances: result.instances, isLoading: false });
        return result.instances;
      } else {
        set({ error: result.message, isLoading: false });
        return [];
      }
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      return [];
    }
  },

  // Launch emulator instance(s)
  launchInstance: async (vmindex) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('launch_emulator', { vmindex });
      if (result.success) {
        // Refresh instances after launch
        await get().getInstances();
      }
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      throw error;
    }
  },

  // Shutdown emulator instance(s)
  shutdownInstance: async (vmindex) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('shutdown_emulator', { vmindex });
      if (result.success) {
        await get().getInstances();
      }
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      throw error;
    }
  },

  // Launch and wait for Android + connect ADB
  launchAndConnect: async (vmindex) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('launch_and_connect_emulator', { vmindex });
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: error.toString(), isLoading: false });
      throw error;
    }
  },

  // Connect to emulator ADB
  connectAdb: async (adbHost, adbPort) => {
    try {
      return await invoke('connect_emulator_adb', { adbHost, adbPort });
    } catch (error) {
      set({ error: error.toString() });
      throw error;
    }
  },
}));

// Template Store - Task templates management
export const useTemplateStore = create((set, get) => ({
  templates: [],
  isLoading: false,

  loadTemplates: async () => {
    set({ isLoading: true });
    try {
      const templates = await invoke('get_templates');
      set({ templates, isLoading: false });
    } catch (error) {
      console.error('Error loading templates:', error);
      set({ templates: [], isLoading: false });
    }
  },

  createTemplate: async (template) => {
    try {
      const newTemplate = await invoke('create_template', { template: {
        ...template,
        id: template.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
      }});
      set(state => ({ templates: [...state.templates, newTemplate] }));
      return newTemplate;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  },

  updateTemplate: async (template) => {
    try {
      const updated = await invoke('update_template', { template: {
        ...template,
        updated_at: new Date().toISOString(),
      }});
      set(state => ({
        templates: state.templates.map(t => t.id === template.id ? updated : t),
      }));
      return updated;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  },

  deleteTemplate: async (templateId) => {
    try {
      await invoke('delete_template', { templateId });
      set(state => ({
        templates: state.templates.filter(t => t.id !== templateId),
      }));
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  duplicateTemplate: async (templateId) => {
    const { templates } = get();
    const original = templates.find(t => t.id === templateId);
    if (!original) return;
    
    const duplicate = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      created_at: new Date().toISOString(),
    };
    return get().createTemplate(duplicate);
  },
}));

// Agent Events Store - Realtime monitoring
export const useAgentEventsStore = create((set, get) => ({
  // Current state per device
  deviceStates: {}, // { deviceId: { screenshot, plan, currentSubgoal, actions, thinking, result } }
  
  // Event listeners
  eventListeners: null,
  
  // Setup all event listeners
  setupEventListeners: async () => {
    const listeners = [];
    
    // Screenshot event
    listeners.push(await listen('agent-screenshot', (event) => {
      const { device_id, data, step } = event.payload;
      get().updateDeviceState(device_id, {
        screenshot: `data:image/png;base64,${data}`,
        screenshotStep: step,
      });
    }));
    
    // Plan event
    listeners.push(await listen('agent-plan', (event) => {
      const { device_id, plan, current_subgoal, thought } = event.payload;
      get().updateDeviceState(device_id, {
        plan,
        currentSubgoal: current_subgoal,
        planThought: thought,
      });
    }));
    
    // Action event
    listeners.push(await listen('agent-action', (event) => {
      const { device_id, step, description, thought } = event.payload;
      get().addAction(device_id, { step, description, thought, timestamp: Date.now() });
    }));
    
    // Thinking event
    listeners.push(await listen('agent-thinking', (event) => {
      const { device_id, code, thoughts } = event.payload;
      get().updateDeviceState(device_id, {
        thinkingCode: code,
        thinkingThoughts: thoughts,
      });
    }));
    
    // Execution result event
    listeners.push(await listen('agent-execution', (event) => {
      const { device_id, output } = event.payload;
      get().updateDeviceState(device_id, {
        lastExecutionOutput: output,
      });
    }));
    
    // Result event
    listeners.push(await listen('agent-result', (event) => {
      const { device_id, success, reason, steps } = event.payload;
      get().updateDeviceState(device_id, {
        result: { success, reason, steps },
        isCompleted: true,
      });
    }));
    
    // Executor input event
    listeners.push(await listen('agent-executor-input', (event) => {
      const { device_id, current_subgoal } = event.payload;
      get().updateDeviceState(device_id, {
        executorSubgoal: current_subgoal,
      });
    }));
    
    set({ eventListeners: listeners });
  },
  
  // Cleanup listeners
  cleanupEventListeners: () => {
    const { eventListeners } = get();
    if (eventListeners) {
      eventListeners.forEach(unlisten => unlisten());
      set({ eventListeners: null });
    }
  },
  
  // Update device state
  updateDeviceState: (deviceId, updates) => {
    set(state => ({
      deviceStates: {
        ...state.deviceStates,
        [deviceId]: {
          ...state.deviceStates[deviceId],
          ...updates,
        },
      },
    }));
  },
  
  // Add action to device history
  addAction: (deviceId, action) => {
    set(state => {
      const deviceState = state.deviceStates[deviceId] || {};
      const actions = deviceState.actions || [];
      return {
        deviceStates: {
          ...state.deviceStates,
          [deviceId]: {
            ...deviceState,
            actions: [...actions, action],
            currentStep: action.step,
          },
        },
      };
    });
  },
  
  // Get state for specific device
  getDeviceState: (deviceId) => {
    return get().deviceStates[deviceId] || null;
  },
  
  // Clear device state
  clearDeviceState: (deviceId) => {
    set(state => {
      const { [deviceId]: _, ...rest } = state.deviceStates;
      return { deviceStates: rest };
    });
  },
  
  // Clear all states
  clearAllStates: () => {
    set({ deviceStates: {} });
  },
  
  // Initialize device for new task
  initDevice: (deviceId) => {
    set(state => ({
      deviceStates: {
        ...state.deviceStates,
        [deviceId]: {
          screenshot: null,
          plan: null,
          currentSubgoal: null,
          actions: [],
          currentStep: 0,
          result: null,
          isCompleted: false,
          startedAt: Date.now(),
        },
      },
    }));
  },
}));
