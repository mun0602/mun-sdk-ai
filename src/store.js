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

  // Check if user can use AI request
  canUseAiRequest: () => {
    const { license } = get();
    if (!license || !license.is_valid) return false;
    // Unlimited (-1) or has remaining
    if (license.max_ai_requests === -1) return true;
    return license.remaining_ai_requests > 0;
  },

  // Get AI request status
  getAiRequestStatus: () => {
    const { license } = get();
    if (!license || !license.is_valid) {
      return { max: 0, used: 0, remaining: 0, resetDate: null };
    }
    return {
      max: license.max_ai_requests || 0,
      used: license.used_ai_requests || 0,
      remaining: license.remaining_ai_requests || 0,
      resetDate: license.ai_reset_date,
    };
  },

  // Use an AI request (call before running AI task)
  useAiRequest: async (requestType = 'task') => {
    const { license } = get();
    if (!license || !license.is_valid || !license.license_key) {
      throw new Error('Invalid license');
    }

    // Check if can use
    if (!get().canUseAiRequest()) {
      throw new Error('Đã hết lượt gọi AI trong tháng này. Vui lòng nâng cấp gói hoặc chờ đến chu kỳ mới.');
    }

    try {
      // Get the actual license key (not masked)
      const storedLicense = await invoke('check_license');
      const result = await invoke('use_ai_request', { 
        licenseKey: storedLicense.license_key?.replace(/\*+/g, '') || '',
        requestType 
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to use AI request');
      }

      // Update local state
      set(state => ({
        license: {
          ...state.license,
          used_ai_requests: result.used_ai_requests || state.license.used_ai_requests + 1,
          remaining_ai_requests: result.remaining_ai_requests || Math.max(0, state.license.remaining_ai_requests - 1),
        }
      }));

      return result;
    } catch (error) {
      throw error;
    }
  },

  // Refresh AI request status from server
  refreshAiRequestStatus: async () => {
    const { license } = get();
    if (!license || !license.license_key) return;

    try {
      const result = await invoke('get_ai_request_status', { 
        licenseKey: license.license_key 
      });
      
      if (result.success) {
        set(state => ({
          license: {
            ...state.license,
            max_ai_requests: result.max_ai_requests ?? state.license.max_ai_requests,
            used_ai_requests: result.used_ai_requests ?? state.license.used_ai_requests,
            remaining_ai_requests: result.remaining_ai_requests ?? state.license.remaining_ai_requests,
            ai_reset_date: result.reset_date ?? state.license.ai_reset_date,
          }
        }));
      }
    } catch (error) {
      console.error('Failed to refresh AI request status:', error);
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

  // Get AI requests display text
  getAiRequestsDisplayText: () => {
    const { license } = get();
    if (!license || !license.is_valid) {
      return '';
    }
    
    const max = license.max_ai_requests;
    const remaining = license.remaining_ai_requests;
    
    if (max === -1) {
      return '🤖 AI: Unlimited';
    }
    
    if (remaining <= 0) {
      return '🤖 AI: 0 còn lại ⚠';
    }
    
    if (remaining <= 10) {
      return `🤖 AI: ${remaining}/${max} ⚠`;
    }
    
    return `🤖 AI: ${remaining}/${max}`;
  },
}));

// Device Store - with emulator auto-connect (Flet logic)
export const useDeviceStore = create((set, get) => ({
  devices: [],
  selectedDevice: null,
  isLoading: false,
  error: null,
  isScanning: false,

  refreshDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      // Auto-connect emulators first to ensure we don't miss any
      try {
        await invoke('auto_connect_emulators');
      } catch (e) {
        console.warn('[ADB] Auto-connect failed:', e);
      }

      // Then get all connected devices
      const devices = await invoke('get_connected_devices');
      set({ devices, isLoading: false });

      // Auto-select first device if none selected or selected device no longer exists
      const { selectedDevice } = get();
      if (!selectedDevice || !devices.find(d => d.id === selectedDevice)) {
        if (devices.length > 0) {
          set({ selectedDevice: devices[0].id });
        }
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
    }
  },

  // Scan all emulator ports (Flet logic: EMULATOR_PORTS)
  scanEmulatorPorts: async () => {
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
    }
  },

  // Check DroidRun Portal status - uses droidrun ping
  checkDroidRunPortal: async (deviceId) => {
    try {
      const result = await invoke('check_droidrun_portal', { deviceId });
      return result;
    } catch (error) {
      console.error('[DroidRun] Check portal error:', error);
      return { success: false, error: error.toString() };
    }
  },

  // Check if DroidRun Portal is ready (simplified)
  checkDroidRunInstalled: async (deviceId) => {
    try {
      const result = await invoke('check_droidrun_portal', { deviceId });
      return result.success;
    } catch (error) {
      console.error('[DroidRun] Check installed error:', error);
      return false;
    }
  },

  // Setup DroidRun Portal on device - uses droidrun setup
  setupDroidRun: async (deviceId) => {
    try {
      const result = await invoke('setup_droidrun_portal', { deviceId });
      return result;
    } catch (error) {
      console.error('[DroidRun] Setup error:', error);
      throw error;
    }
  },

  // Ensure DroidRun Portal is ready - check first, setup if needed
  ensureDroidRunReady: async (deviceId) => {
    try {
      // Check portal status first
      const checkResult = await invoke('check_droidrun_portal', { deviceId });
      if (checkResult.success) {
        return checkResult;
      }
      // Not ready, run setup
      const setupResult = await invoke('setup_droidrun_portal', { deviceId });
      return setupResult;
    } catch (error) {
      console.error('[DroidRun] Ensure ready error:', error);
      throw error;
    }
  },

  // Wake up device screen
  wakeDevice: async (deviceId) => {
    try {
      const result = await invoke('wake_device', { deviceId });
      return result;
    } catch (error) {
      console.error('[ADB] Wake device error:', error);
      throw error;
    }
  },

  // Launch scrcpy to view device screen
  launchScrcpy: async (deviceId) => {
    try {
      const result = await invoke('launch_scrcpy', { deviceId });
      return result;
    } catch (error) {
      console.error('[Scrcpy] Launch error:', error);
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
            // Ignore "already exists" errors, only warn for other errors
            if (!e.toString().includes('đã tồn tại')) {
              console.warn('Could not create default profile:', defaultProfile.name, e);
            }
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
    // Note: AI request limit is now enforced on backend (Rust)
    // Frontend check is just for UX - showing warning before attempt
    const licenseStore = useLicenseStore.getState();
    if (!licenseStore.canUseAiRequest()) {
      const error = new Error('Đã hết lượt gọi AI trong tháng này. Vui lòng nâng cấp gói hoặc chờ đến chu kỳ mới.');
      set(state => ({
        logs: [...state.logs, { level: 'error', message: error.message }],
      }));
      throw error;
    }

    return get()._withTaskExecution([params.device_id], async () => {
      // Backend will check and deduct AI request - no need to call useAiRequest here
      const result = await invoke('run_task', {
        deviceId: params.device_id,
        provider: params.provider,
        apiKey: params.api_key,
        model: params.model,
        prompt: params.prompt,
        baseUrl: params.base_url,
        vision: params.vision,
        reasoning: params.reasoning,
        debug: params.debug,
      });

      // Refresh AI status after task completes
      licenseStore.refreshAiRequestStatus();

      set(state => ({
        logs: [...state.logs, { level: 'success', message: 'Task hoàn thành!' }],
      }));
      return result;
    });
  },

  // Run task on multiple devices in parallel (Flet logic: run_all_devices)
  runParallelTasks: async (deviceIds, taskParams, maxParallel = 3) => {
    // Note: AI request limit is enforced on backend for each task
    // Frontend check is just for UX - warn user before attempting
    const licenseStore = useLicenseStore.getState();
    const aiStatus = licenseStore.getAiRequestStatus();
    
    // Check if we have enough AI requests for all devices (UX warning only)
    if (aiStatus.max !== -1 && aiStatus.remaining < deviceIds.length) {
      const error = new Error(`Không đủ lượt gọi AI. Cần ${deviceIds.length} lượt, còn ${aiStatus.remaining} lượt.`);
      set(state => ({
        logs: [...state.logs, { level: 'error', message: error.message }],
      }));
      throw error;
    }

    return get()._withTaskExecution(deviceIds, async () => {
      get().addLog({
        level: 'info',
        message: `[PARALLEL] Starting tasks on ${deviceIds.length} device(s)...`
      });

      // Backend will check and deduct AI requests for each task
      const tasks = deviceIds.map(deviceId => ({
        device_id: deviceId,
        provider: taskParams.provider,
        api_key: taskParams.api_key,
        model: taskParams.model,
        prompt: taskParams.prompt,
        base_url: taskParams.base_url,
        vision: taskParams.vision,
        reasoning: taskParams.reasoning,
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
        })),
        maxParallel,
      });

      // Refresh AI status after all tasks complete
      licenseStore.refreshAiRequestStatus();

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
      // Validate profile has required API config
      if (!schedule.profile?.provider?.name || !schedule.profile?.provider?.api_key || !schedule.profile?.provider?.model) {
        throw new Error('Profile không hợp lệ: thiếu provider, api_key hoặc model. Vui lòng chọn profile có cấu hình đầy đủ.');
      }

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

  // Stop a running scheduled task
  stopScheduledTask: async (taskId, deviceId) => {
    const { addLog, markTaskFinished } = get();
    try {
      addLog(`⏹️ Đang dừng task...`, 'warning');
      // Cancel task by device_id (used as task identifier in Rust)
      await invoke('cancel_task', { taskId: deviceId });
      markTaskFinished(taskId);
      addLog(`✅ Đã dừng task`, 'success');
      return true;
    } catch (error) {
      console.error('Error stopping task:', error);
      addLog(`❌ Lỗi dừng task: ${error}`, 'error');
      return false;
    }
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
          let launchedEmulators = []; // Track launched emulators for cleanup

          try {
            // Step 1: Launch emulator(s) if needed - SEQUENTIAL LAUNCHING
            if (task.emulatorIndex) {
              console.log(`[SCHEDULER] Checking emulator: ${task.emulatorIndex}`);
              addLog(`📱 Kiểm tra emulator ${task.emulatorIndex}...`, 'info');

              // Get all instances first
              const instances = await invoke('get_emulator_instances');
              console.log(`[SCHEDULER] Emulator instances:`, instances);
              
              // Determine which emulators to launch
              let emulatorsToLaunch = [];
              if (task.emulatorIndex === 'all') {
                // Launch all emulators sequentially
                emulatorsToLaunch = instances.instances?.map(i => i.index) || [];
              } else if (typeof task.emulatorIndex === 'string' && task.emulatorIndex.includes(',')) {
                // Multiple emulators specified
                emulatorsToLaunch = task.emulatorIndex.split(',').map(s => s.trim());
              } else {
                // Single emulator
                emulatorsToLaunch = [task.emulatorIndex];
              }

              console.log(`[SCHEDULER] Emulators to launch:`, emulatorsToLaunch);
              addLog(`📱 Sẽ khởi động ${emulatorsToLaunch.length} emulator(s)...`, 'info');

              // Launch emulators SEQUENTIALLY (one at a time)
              for (let i = 0; i < emulatorsToLaunch.length; i++) {
                const vmindex = emulatorsToLaunch[i];
                const emuIndex = i + 1;
                
                // Check if this emulator is already running
                const existingInstance = instances.instances?.find(inst => inst.index === vmindex);
                
                if (existingInstance?.is_android_started) {
                  console.log(`[SCHEDULER] Emulator ${vmindex} already running`);
                  addLog(`✅ Emulator #${vmindex} đã chạy sẵn`, 'success');
                  
                  // Still need to check DroidRun Portal
                  if (existingInstance.adb_host && existingInstance.adb_port) {
                    const deviceId = `${existingInstance.adb_host}:${existingInstance.adb_port}`;
                    addLog(`🔍 Kiểm tra DroidRun Portal cho emulator #${vmindex}...`, 'info');
                    try {
                      const pingResult = await invoke('check_droidrun_portal', { deviceId });
                      if (pingResult.success) {
                        addLog(`✅ DroidRun Portal sẵn sàng!`, 'success');
                      } else {
                        addLog(`📦 Đang cài đặt DroidRun Portal...`, 'warning');
                        await invoke('setup_droidrun_portal', { deviceId });
                        await new Promise(r => setTimeout(r, 30000));
                      }
                    } catch (e) {
                      console.warn('[SCHEDULER] DroidRun check failed:', e);
                    }
                  }
                  continue;
                }

                // Launch this emulator
                addLog(`🔄 Đang khởi động emulator #${vmindex} (${emuIndex}/${emulatorsToLaunch.length})...`, 'warning');
                console.log(`[SCHEDULER] Launching emulator ${vmindex}...`);
                await invoke('launch_emulator', { vmindex });
                launchedEmulators.push(vmindex);

                // Wait for emulator to start (poll every 10s, max 4 minutes = 240s)
                let attempts = 0;
                const maxAttempts = 24;
                let emulatorReady = false;
                
                while (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 10000));
                  attempts++;

                  const checkInstances = await invoke('get_emulator_instances');
                  const instance = checkInstances.instances?.find(inst => inst.index === vmindex);

                  if (instance?.is_android_started) {
                    console.log(`[SCHEDULER] Emulator ${vmindex} ready after ${attempts * 10}s`);
                    addLog(`✅ Emulator #${vmindex} sẵn sàng sau ${attempts * 10}s`, 'success');

                    // Wait for stability
                    addLog(`⏳ Chờ emulator #${vmindex} ổn định (30s)...`, 'info');
                    await new Promise(r => setTimeout(r, 30000));

                    // Connect ADB
                    if (instance.adb_host && instance.adb_port) {
                      console.log(`[SCHEDULER] Connecting ADB: ${instance.adb_host}:${instance.adb_port}`);
                      addLog(`🔗 Kết nối ADB ${instance.adb_host}:${instance.adb_port}...`, 'info');
                      await invoke('connect_emulator_adb', {
                        adbHost: instance.adb_host,
                        adbPort: instance.adb_port
                      });

                      // Setup DroidRun Portal
                      const deviceId = `${instance.adb_host}:${instance.adb_port}`;
                      addLog(`🔍 Kiểm tra DroidRun Portal...`, 'info');
                      try {
                        const pingResult = await invoke('check_droidrun_portal', { deviceId });
                        if (pingResult.success) {
                          addLog(`✅ DroidRun Portal sẵn sàng!`, 'success');
                        } else {
                          addLog(`📦 Đang cài đặt DroidRun Portal...`, 'warning');
                          await invoke('setup_droidrun_portal', { deviceId });
                          addLog(`⏳ Chờ Portal khởi động (120s)...`, 'info');
                          await new Promise(r => setTimeout(r, 120000));
                        }
                      } catch (pingErr) {
                        console.error('[SCHEDULER] DroidRun check failed:', pingErr);
                        addLog(`⚠️ Không thể kiểm tra DroidRun: ${pingErr}`, 'warning');
                      }
                    }
                    emulatorReady = true;
                    break;
                  }
                  
                  const elapsed = attempts * 10;
                  const remaining = maxAttempts * 10 - elapsed;
                  addLog(`⏳ Chờ emulator #${vmindex}... (${elapsed}s, còn ${remaining}s)`, 'info');
                }

                if (!emulatorReady) {
                  addLog(`❌ Timeout: Emulator #${vmindex} không khởi động được`, 'error');
                  throw new Error(`Emulator ${vmindex} startup timeout`);
                }

                // Wait between emulator launches (if more to launch)
                if (i < emulatorsToLaunch.length - 1) {
                  addLog(`⏳ Chờ 5s trước khi khởi động emulator tiếp theo...`, 'info');
                  await new Promise(r => setTimeout(r, 5000));
                }
              }

              addLog(`✅ Tất cả ${emulatorsToLaunch.length} emulator(s) đã sẵn sàng!`, 'success');
            }

            // Step 2: Build scheduled task object for Rust
            // Validate API config before running
            const provider = task.profile?.provider?.name;
            const apiKey = task.profile?.provider?.api_key;
            const model = task.profile?.provider?.model;

            if (!provider || !apiKey || !model) {
              const missing = [];
              if (!provider) missing.push('provider');
              if (!apiKey) missing.push('api_key');
              if (!model) missing.push('model');
              console.error(`[SCHEDULER] Missing API config for task "${task.name}":`, missing);
              addLog(`❌ Task "${task.name}" thiếu cấu hình: ${missing.join(', ')}. Vui lòng chỉnh sửa lịch trình và chọn lại profile.`, 'error');
              markTaskFinished(task.id);
              continue;
            }

            const scheduledTask = {
              id: task.id,
              task: {
                id: task.id,
                name: task.name,
                deviceId: task.deviceId,
                profileId: task.profileId || '',
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
                provider: provider,
                apiKey: apiKey,
                model: model,
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

            console.log(`[SCHEDULER] scheduledTask:`, scheduledTask.id, scheduledTask.task?.name);

            // Step 3: Run the task
            console.log(`[SCHEDULER] Calling run_scheduled_task...`);
            addLog(`🤖 Đang chạy task "${task.name}"...`, 'info');
            const taskResult = await invoke('run_scheduled_task', { scheduledTask });
            console.log(`[SCHEDULER] Task completed: ${task.name}`, taskResult);
            addLog(`✅ Task "${task.name}" hoàn thành!`, 'success');

            updateTaskAfterRun(task.id);

            // Step 4: Shutdown emulator(s) if we launched them AND autoShutdown is enabled
            if (launchedEmulators.length > 0 && task.autoShutdown !== false) {
              console.log(`[SCHEDULER] Will shutdown ${launchedEmulators.length} emulator(s) in 5s...`);
              addLog(`⏳ Chờ 5s trước khi đóng ${launchedEmulators.length} emulator(s)...`, 'info');
              await new Promise(r => setTimeout(r, 5000));
              
              for (const vmindex of launchedEmulators) {
                console.log(`[SCHEDULER] Shutting down emulator ${vmindex}...`);
                addLog(`🔌 Đang đóng emulator #${vmindex}...`, 'info');
                try {
                  await invoke('shutdown_emulator', { vmindex });
                  console.log(`[SCHEDULER] Emulator ${vmindex} shutdown complete`);
                  addLog(`✅ Emulator #${vmindex} đã đóng`, 'success');
                } catch (e) {
                  console.error(`[SCHEDULER] Emulator ${vmindex} shutdown failed:`, e);
                  addLog(`❌ Lỗi đóng emulator #${vmindex}: ${e}`, 'error');
                }
              }
            } else if (launchedEmulators.length > 0 && task.autoShutdown === false) {
              console.log(`[SCHEDULER] Auto shutdown disabled, keeping emulators running`);
              addLog(`ℹ️ Giữ ${launchedEmulators.length} emulator(s) chạy (auto shutdown tắt)`, 'info');
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
  theme: 'system', // 'light' | 'dark' | 'system'
  language: 'vi',
  autoConnect: true,
  maxParallelDevices: 3,
  emulatorPath: '', // Thư mục MuMu (nx_main)
  bluestacksPath: '', // Thư mục BlueStacks
  scrcpyPath: '', // Thư mục scrcpy
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
  setBluestacksPath: (path) => set({ bluestacksPath: path }),
  setScrcpyPath: (path) => set({ scrcpyPath: path }),

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
          theme: config.settings.theme || 'system',
          language: config.settings.language || 'vi',
          autoConnect: config.settings.auto_connect ?? true,
          maxParallelDevices: config.settings.max_parallel_devices || 3,
          emulatorPath: config.settings.emulator_path || '',
          bluestacksPath: config.settings.bluestacks_path || '',
          scrcpyPath: config.settings.scrcpy_path || '',
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
    const state = useSettingsStore.getState();
    try {
      await invoke('update_settings', {
        settings: {
          theme: state.theme,
          language: state.language,
          auto_connect: state.autoConnect,
          log_level: 'info',
          max_parallel_devices: state.maxParallelDevices,
          screenshot_quality: 80,
          emulator_path: state.emulatorPath || null,
          bluestacks_path: state.bluestacksPath || null,
          scrcpy_path: state.scrcpyPath || null,
          tracing: {
            enabled: state.tracing.enabled,
            provider: state.tracing.provider,
            phoenix_url: state.tracing.phoenixUrl || null,
            phoenix_project_name: state.tracing.phoenixProjectName || null,
            langfuse_secret_key: state.tracing.langfuseSecretKey || null,
            langfuse_public_key: state.tracing.langfusePublicKey || null,
            langfuse_host: state.tracing.langfuseHost || null,
            langfuse_user_id: state.tracing.langfuseUserId || null,
            save_trajectory: state.tracing.saveTrajectory,
          },
        },
      });
    } catch (error) {
      console.error('Lỗi save settings:', error);
    }
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

  // Create new MuMu instance(s)
  createInstance: async (count = 1) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('create_mumu_instance', { count });
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

  // Clone MuMu instance
  cloneInstance: async (vmindex) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('clone_mumu_instance', { vmindex });
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

  // Delete MuMu instance
  deleteInstance: async (vmindex) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('delete_mumu_instance', { vmindex });
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

  // Rename MuMu instance
  renameInstance: async (vmindex, newName) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke('rename_mumu_instance', { vmindex, new_name: newName });
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

  // ============================================
  // Sequential Emulator Launching
  // ============================================
  
  launchProgress: {}, // { index: { status, progress, message } }

  // Launch a single emulator and wait for it to be ready
  launchEmulatorAndWait: async (vmindex, options = {}) => {
    const { 
      timeout = 240000, // 4 minutes
      pollInterval = 10000, // 10 seconds
      onProgress = null,
      setupDroidRunPortal = true,
    } = options;

    const updateProgress = (status, progress, message) => {
      set(state => ({
        launchProgress: {
          ...state.launchProgress,
          [vmindex]: { status, progress, message },
        },
      }));
      if (onProgress) onProgress({ vmindex, status, progress, message });
    };

    updateProgress('launching', 0, 'Đang khởi động emulator...');

    try {
      // Check if already running
      const instances = await get().getInstances();
      const existingInstance = instances.find(i => i.index === vmindex);
      
      if (existingInstance?.is_android_started) {
        updateProgress('ready', 100, 'Emulator đã sẵn sàng');
        return {
          success: true,
          instance: existingInstance,
          deviceId: `${existingInstance.adb_host}:${existingInstance.adb_port}`,
          alreadyRunning: true,
        };
      }

      // Launch emulator
      await invoke('launch_emulator', { vmindex });
      updateProgress('waiting', 10, 'Chờ emulator khởi động...');

      // Poll until ready
      const startTime = Date.now();
      let attempts = 0;
      const maxAttempts = Math.ceil(timeout / pollInterval);

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, pollInterval));
        attempts++;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(90, 10 + (elapsed / timeout) * 80);
        updateProgress('waiting', progress, `Chờ Android khởi động... (${Math.round(elapsed/1000)}s)`);

        const checkInstances = await invoke('get_emulator_instances');
        const instance = checkInstances.instances?.find(i => i.index === vmindex);

        if (instance?.is_android_started) {
          updateProgress('connecting', 92, 'Kết nối ADB...');

          // Connect ADB
          if (instance.adb_host && instance.adb_port) {
            await invoke('connect_emulator_adb', {
              adbHost: instance.adb_host,
              adbPort: instance.adb_port,
            });

            const deviceId = `${instance.adb_host}:${instance.adb_port}`;

            // Setup DroidRun Portal if needed
            if (setupDroidRunPortal) {
              updateProgress('portal', 95, 'Kiểm tra DroidRun Portal...');
              try {
                const pingResult = await invoke('check_droidrun_portal', { deviceId });
                if (!pingResult.success) {
                  updateProgress('portal', 96, 'Cài đặt DroidRun Portal...');
                  await invoke('setup_droidrun_portal', { deviceId });
                  await new Promise(r => setTimeout(r, 30000)); // Wait for portal
                }
              } catch (e) {
                console.warn('DroidRun Portal check failed:', e);
              }
            }

            updateProgress('ready', 100, 'Emulator sẵn sàng!');
            return {
              success: true,
              instance,
              deviceId,
              alreadyRunning: false,
            };
          }
        }
      }

      updateProgress('timeout', 0, 'Timeout: Không thể khởi động emulator');
      return { success: false, error: 'Timeout', message: 'Emulator không khởi động được' };

    } catch (error) {
      updateProgress('error', 0, `Lỗi: ${error.message || error}`);
      return { success: false, error: error.message || String(error) };
    }
  },

  // Launch multiple emulators SEQUENTIALLY (one at a time)
  launchEmulatorsSequentially: async (vmindexes, options = {}) => {
    const {
      onProgress = null,
      onEmulatorReady = null,
      delayBetween = 5000, // 5 second delay between emulators
      ...launchOptions
    } = options;

    console.log(`[launchEmulatorsSequentially] Starting ${vmindexes.length} emulators sequentially`);

    const results = [];
    const deviceIds = [];

    for (let i = 0; i < vmindexes.length; i++) {
      const vmindex = vmindexes[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: vmindexes.length,
          vmindex,
          status: 'starting',
          message: `Đang khởi động emulator ${i + 1}/${vmindexes.length}...`,
        });
      }

      const result = await get().launchEmulatorAndWait(vmindex, {
        ...launchOptions,
        onProgress: (progress) => {
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: vmindexes.length,
              vmindex,
              ...progress,
            });
          }
        },
      });

      results.push(result);

      if (result.success) {
        deviceIds.push(result.deviceId);
        if (onEmulatorReady) {
          onEmulatorReady(result);
        }
      }

      // Wait before launching next emulator (if not the last one)
      if (i < vmindexes.length - 1 && result.success) {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: vmindexes.length,
            vmindex,
            status: 'waiting',
            message: `Chờ ${delayBetween/1000}s trước khi khởi động emulator tiếp theo...`,
          });
        }
        await new Promise(r => setTimeout(r, delayBetween));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[launchEmulatorsSequentially] Completed: ${successCount}/${vmindexes.length} emulators ready`);

    return {
      success: successCount === vmindexes.length,
      results,
      deviceIds,
      successCount,
      failCount: vmindexes.length - successCount,
    };
  },

  // Clear launch progress
  clearLaunchProgress: () => {
    set({ launchProgress: {} });
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

// ============================================
// SKILL STORE - Advanced Task Templates
// ============================================

const SKILLS_KEY = 'mun-sdk-skills';

const loadSkillsFromStorage = () => {
  try {
    const saved = localStorage.getItem(SKILLS_KEY);
    return saved ? JSON.parse(saved) : getDefaultSkills();
  } catch {
    return getDefaultSkills();
  }
};

const saveSkillsToStorage = (skills) => {
  try {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  } catch (e) {
    console.error('Failed to save skills:', e);
  }
};

// Variable types for skills
export const VARIABLE_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  TEXT: 'text', // multiline
};

// Error handling strategies
export const ERROR_STRATEGIES = {
  ABORT: 'abort',
  SKIP: 'skip',
  RETRY: 'retry',
  ASK: 'ask',
};

// Skill Categories - Phân loại các loại hướng dẫn AI
export const SKILL_CATEGORIES = {
  gesture: { label: 'Thao tác cử chỉ', color: '#ff6b35', icon: 'hand' },
  navigation: { label: 'Điều hướng', color: '#4f6ef7', icon: 'compass' },
  input: { label: 'Nhập liệu', color: '#22c55e', icon: 'keyboard' },
  search: { label: 'Tìm kiếm', color: '#f59e0b', icon: 'search' },
  wait: { label: 'Chờ đợi', color: '#8b5cf6', icon: 'clock' },
  app: { label: 'Ứng dụng', color: '#ec4899', icon: 'smartphone' },
  custom: { label: 'Tùy chỉnh', color: '#64748b', icon: 'sparkles' },
};

// Default AI Guidance Skills - Hướng dẫn để AI thực hiện tốt hơn
const getDefaultSkills = () => [
  // === GESTURE SKILLS ===
  {
    id: 'skill-swipe-scroll',
    name: 'Vuốt & Cuộn',
    description: 'Hướng dẫn AI vuốt màn hình hiệu quả',
    icon: 'hand',
    color: '#ff6b35',
    category: 'gesture',
    guidance: `Khi cần vuốt hoặc cuộn màn hình:
- Vuốt từ giữa màn hình (50% chiều cao), không vuốt từ mép
- Vuốt với tốc độ vừa phải, không quá nhanh để tránh bỏ qua nội dung
- Đợi nội dung load xong (1-2 giây) trước khi vuốt tiếp
- Nếu cần cuộn trong danh sách, vuốt ngắn (30% màn hình) để kiểm soát tốt hơn
- Với video/stories, vuốt dài hơn (70% màn hình) để chuyển content
- Nếu không thấy element cần tìm, thử vuốt ngược lại`,
    examples: [
      'Vuốt lên để xem thêm bài viết',
      'Cuộn danh sách để tìm item',
      'Lướt qua các stories/videos'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-tap-click',
    name: 'Nhấn & Click',
    description: 'Hướng dẫn AI nhấn vào các element chính xác',
    icon: 'pointer',
    color: '#3b82f6',
    category: 'gesture',
    guidance: `Khi cần nhấn/click vào element:
- Đợi element xuất hiện và ổn định trước khi nhấn (không nhấn khi đang animation)
- Nhấn vào trung tâm của element, không nhấn vào mép
- Nếu element bị che bởi popup/overlay, đóng popup trước
- Với nút nhỏ, zoom in hoặc nhấn nhiều lần nếu cần
- Sau khi nhấn, đợi phản hồi (loading, chuyển trang) trước khi thao tác tiếp
- Nếu không có phản hồi sau 2 giây, thử nhấn lại`,
    examples: [
      'Nhấn nút Like/Heart',
      'Click vào avatar để xem profile',
      'Tap vào menu item'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-long-press',
    name: 'Nhấn giữ',
    description: 'Hướng dẫn AI thực hiện long press đúng cách',
    icon: 'timer',
    color: '#8b5cf6',
    category: 'gesture',
    guidance: `Khi cần nhấn giữ (long press):
- Nhấn và giữ ít nhất 1-2 giây
- Không di chuyển ngón tay khi đang giữ
- Đợi menu/popup context xuất hiện
- Long press thường dùng để: xóa, sao chép, xem preview, thêm vào yêu thích
- Nếu không thấy phản hồi, thử giữ lâu hơn (3 giây)`,
    examples: [
      'Nhấn giữ tin nhắn để xem options',
      'Long press ảnh để lưu',
      'Giữ icon để xóa app'
    ],
    priority: 2,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },

  // === NAVIGATION SKILLS ===
  {
    id: 'skill-find-element',
    name: 'Tìm Element',
    description: 'Hướng dẫn AI tìm element trên màn hình',
    icon: 'search',
    color: '#f59e0b',
    category: 'search',
    guidance: `Khi cần tìm một element trên màn hình:
- Đầu tiên, scan toàn bộ màn hình từ trên xuống dưới
- Tìm theo text/label trước, sau đó mới tìm theo icon
- Nếu không thấy, thử cuộn xuống hoặc lên để tìm
- Kiểm tra các tab/menu khác nếu không tìm thấy ở màn hình hiện tại
- Element có thể nằm trong submenu - hãy mở menu trước
- Với danh sách dài, sử dụng chức năng search nếu có
- Chú ý các element bị ẩn sau popup hoặc bottom sheet`,
    examples: [
      'Tìm nút Settings trong menu',
      'Tìm input search trên màn hình',
      'Tìm tab Profile'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-navigate-back',
    name: 'Quay lại',
    description: 'Hướng dẫn AI điều hướng quay lại màn hình trước',
    icon: 'arrow-left',
    color: '#64748b',
    category: 'navigation',
    guidance: `Khi cần quay lại màn hình trước:
- Ưu tiên dùng nút Back của Android (phím cứng hoặc gesture)
- Nếu có nút back/arrow ở góc trên trái, có thể dùng
- Với popup/modal: tìm nút X/Close hoặc nhấn ra ngoài để đóng
- Với full-screen views: vuốt từ mép trái sang phải
- Cẩn thận: một số app sẽ thoát nếu nhấn back ở màn hình chính
- Nếu cần quay lại Home, nhấn nút Home hoặc vuốt lên từ dưới`,
    examples: [
      'Quay lại từ màn hình chi tiết',
      'Đóng popup settings',
      'Về trang chủ của app'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },

  // === INPUT SKILLS ===
  {
    id: 'skill-text-input',
    name: 'Nhập văn bản',
    description: 'Hướng dẫn AI nhập text vào input fields',
    icon: 'keyboard',
    color: '#22c55e',
    category: 'input',
    guidance: `Khi cần nhập văn bản:
- Đầu tiên, nhấn vào input field để focus (keyboard sẽ xuất hiện)
- Đợi keyboard hiện hoàn toàn trước khi bắt đầu gõ
- Clear text cũ nếu cần (Ctrl+A rồi Delete, hoặc nút X)
- Gõ từng ký tự hoặc dán text đã copy
- Với password, đảm bảo không hiển thị khi gõ xong
- Sau khi nhập xong, nhấn Enter hoặc nút Submit
- Nếu keyboard che element khác, cuộn trang lên`,
    examples: [
      'Nhập username và password',
      'Gõ tin nhắn để gửi',
      'Điền form đăng ký'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-select-option',
    name: 'Chọn Option',
    description: 'Hướng dẫn AI chọn từ dropdown/picker',
    icon: 'list',
    color: '#06b6d4',
    category: 'input',
    guidance: `Khi cần chọn option từ dropdown/picker:
- Nhấn vào dropdown để mở danh sách options
- Cuộn trong danh sách nếu không thấy option cần chọn
- Với date picker: chọn ngày/tháng/năm theo thứ tự
- Với time picker: chọn giờ trước, phút sau
- Sau khi chọn xong, nhấn OK/Done/Confirm để xác nhận
- Nếu chọn sai, mở lại dropdown và chọn lại`,
    examples: [
      'Chọn quốc gia từ danh sách',
      'Chọn ngày sinh',
      'Chọn số lượng sản phẩm'
    ],
    priority: 2,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },

  // === WAIT SKILLS ===
  {
    id: 'skill-wait-load',
    name: 'Chờ tải',
    description: 'Hướng dẫn AI chờ đợi đúng lúc',
    icon: 'clock',
    color: '#8b5cf6',
    category: 'wait',
    guidance: `Khi cần chờ đợi:
- Chờ loading spinner/indicator biến mất
- Chờ skeleton screen được thay bằng content thật
- Đợi animation kết thúc trước khi thao tác tiếp
- Với mạng chậm, chờ lâu hơn (3-5 giây)
- Nếu loading quá lâu (>10 giây), có thể refresh/retry
- Chờ toast/notification biến mất trước khi tiếp tục
- Với video/media, đợi buffer đủ trước khi play`,
    examples: [
      'Chờ trang load xong',
      'Đợi ảnh hiển thị',
      'Chờ API response'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },

  // === APP SKILLS ===
  {
    id: 'skill-open-app',
    name: 'Mở ứng dụng',
    description: 'Hướng dẫn AI mở app đúng cách',
    icon: 'smartphone',
    color: '#ec4899',
    category: 'app',
    guidance: `Khi cần mở một ứng dụng:
- Cách 1: Vuốt lên từ Home để mở App Drawer, tìm và nhấn vào icon app
- Cách 2: Dùng Search (kéo xuống từ Home) và gõ tên app
- Cách 3: Nếu app có widget/shortcut ở Home, nhấn trực tiếp
- Đợi app khởi động hoàn tất (splash screen biến mất)
- Nếu app yêu cầu login, xử lý login trước
- Nếu có popup permission, xử lý theo yêu cầu
- Nếu app bị crash, thử mở lại hoặc clear cache`,
    examples: [
      'Mở TikTok từ Home',
      'Mở Settings',
      'Mở Chrome để duyệt web'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-handle-popup',
    name: 'Xử lý Popup',
    description: 'Hướng dẫn AI xử lý các popup/dialog',
    icon: 'x-circle',
    color: '#ef4444',
    category: 'app',
    guidance: `Khi gặp popup/dialog/overlay:
- Xác định loại popup: permission, ads, notification, update, etc.
- Với permission popup: nhấn "Allow" hoặc "Deny" tùy yêu cầu
- Với ads: tìm nút X/Close (thường ở góc phải trên), hoặc đợi countdown
- Với update popup: nhấn "Later/Not now" nếu không cần update ngay
- Với notification: nhấn vào để xem hoặc dismiss bằng swipe
- Với modal: nhấn nút action hoặc nhấn ra ngoài để đóng
- Nếu không tìm thấy cách đóng, thử nhấn Back`,
    examples: [
      'Đóng quảng cáo',
      'Cho phép quyền camera',
      'Dismiss thông báo'
    ],
    priority: 1,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'skill-login-auth',
    name: 'Đăng nhập',
    description: 'Hướng dẫn AI xử lý đăng nhập/xác thực',
    icon: 'key',
    color: '#10b981',
    category: 'app',
    guidance: `Khi cần đăng nhập vào ứng dụng:
- Tìm nút "Login/Sign in" hoặc "Đăng nhập"
- Chọn phương thức login: email/phone, social (Google, Facebook), etc.
- Với email/phone: nhập credentials, nhấn login
- Với social login: chọn tài khoản đã có hoặc nhập mới
- Xử lý 2FA nếu có: nhập mã OTP từ SMS/email/authenticator
- Xử lý CAPTCHA nếu có
- Đợi login thành công (chuyển đến màn hình chính)
- Nếu fail, check lại credentials hoặc retry`,
    examples: [
      'Đăng nhập bằng Google',
      'Login với email và password',
      'Xác thực 2 bước'
    ],
    priority: 2,
    isEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
  },
];

export const useSkillStore = create((set, get) => ({
  skills: loadSkillsFromStorage(),

  // CRUD Operations
  addSkill: (skill) => {
    const newSkill = {
      id: crypto.randomUUID(),
      ...skill,
      isEnabled: true,
      priority: skill.priority || 5,
      createdAt: new Date().toISOString(),
      isBuiltin: false,
    };
    const newSkills = [...get().skills, newSkill];
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
    return newSkill;
  },

  updateSkill: (id, updates) => {
    const newSkills = get().skills.map(s =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    );
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
  },

  deleteSkill: (id) => {
    const newSkills = get().skills.filter(s => s.id !== id);
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
    return true;
  },

  duplicateSkill: (id) => {
    const skill = get().skills.find(s => s.id === id);
    if (!skill) return null;
    const duplicate = {
      ...skill,
      id: crypto.randomUUID(),
      name: `${skill.name} (Copy)`,
      isBuiltin: false,
      createdAt: new Date().toISOString(),
    };
    const newSkills = [...get().skills, duplicate];
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
    return duplicate;
  },

  getSkill: (id) => get().skills.find(s => s.id === id),

  // Toggle skill enabled/disabled
  toggleSkill: (id) => {
    const newSkills = get().skills.map(s =>
      s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
    );
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
  },

  // Enable/disable all skills
  toggleAllSkills: (enabled) => {
    const newSkills = get().skills.map(s => ({ ...s, isEnabled: enabled }));
    set({ skills: newSkills });
    saveSkillsToStorage(newSkills);
  },

  // Get enabled skills sorted by priority
  getEnabledSkills: () => {
    return get().skills
      .filter(s => s.isEnabled)
      .sort((a, b) => (a.priority || 5) - (b.priority || 5));
  },

  // Get skills by category
  getSkillsByCategory: (category) => {
    return get().skills.filter(s => s.category === category);
  },

  // Compile all enabled guidance into a single AI guidance text
  compileGuidance: () => {
    const enabledSkills = get().getEnabledSkills();
    if (enabledSkills.length === 0) return '';

    const sections = [];
    const byCategory = {};

    // Group by category
    enabledSkills.forEach(skill => {
      const cat = skill.category || 'custom';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(skill);
    });

    // Build guidance text
    sections.push('=== HƯỚNG DẪN THAO TÁC ===\n');
    sections.push('Các hướng dẫn dưới đây giúp bạn thực hiện tốt hơn các thao tác trên thiết bị Android:\n');

    Object.entries(byCategory).forEach(([category, skills]) => {
      const categoryInfo = SKILL_CATEGORIES[category] || { label: category };
      sections.push(`\n## ${categoryInfo.label.toUpperCase()}\n`);

      skills.forEach(skill => {
        sections.push(`### ${skill.name}`);
        sections.push(skill.guidance);
        if (skill.examples && skill.examples.length > 0) {
          sections.push(`\nVí dụ: ${skill.examples.join(', ')}`);
        }
        sections.push('');
      });
    });

    return sections.join('\n').trim();
  },

  // Get a quick summary of all guidance (for preview)
  getGuidanceSummary: () => {
    const enabledSkills = get().getEnabledSkills();
    return enabledSkills.map(s => `• ${s.name}: ${s.description}`).join('\n');
  },

  // Reset to defaults
  resetToDefaults: () => {
    const defaults = getDefaultSkills();
    set({ skills: defaults });
    saveSkillsToStorage(defaults);
  },

  // Import/Export
  exportSkills: () => {
    return JSON.stringify(get().skills.filter(s => !s.isBuiltin), null, 2);
  },

  exportSelectedSkills: (skillIds) => {
    const selectedSkills = get().skills.filter(s => skillIds.includes(s.id));
    return JSON.stringify(selectedSkills, null, 2);
  },

  importSkills: (jsonString) => {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const newSkills = imported.map(s => ({
        ...s,
        id: crypto.randomUUID(),
        isBuiltin: false,
        isEnabled: true,
        createdAt: new Date().toISOString(),
      }));

      const allSkills = [...get().skills, ...newSkills];
      set({ skills: allSkills });
      saveSkillsToStorage(allSkills);
      return newSkills.length;
    } catch (e) {
      console.error('Failed to import skills:', e);
      return 0;
    }
  },
}));

// ============================================
// WORKFLOW STORE - Step-based Task Automation
// ============================================

const WORKFLOWS_KEY = 'mun-sdk-workflows';

// Calculate humanlike delay based on action context (mirrors Rust implementation)
function calculateHumanlikeDelay(prevAction, nextAction, context = '') {
  // Base delay ranges for different action transitions (in ms)
  const delayRanges = {
    'tap_tap': [300, 800],
    'tap_swipe': [500, 1200],
    'tap_input_text': [400, 1000],
    'swipe_tap': [800, 2000],
    'swipe_swipe': [1500, 4000],
    'swipe_up_swipe_up': [1000, 3000],
    'swipe_up_tap': [500, 1500],
    'input_text_tap': [300, 700],
    'type_tap': [300, 700],
    'open_app_*': [2000, 4000],
    'start_app_*': [2000, 4000],
    'back_*': [500, 1200],
    'home_*': [800, 1500],
    'default': [500, 1500],
  };
  
  const key = `${prevAction}_${nextAction}`;
  let [baseMin, baseMax] = delayRanges[key] || 
                           delayRanges[`${prevAction}_*`] || 
                           delayRanges['default'];
  
  // Adjust based on context hints
  if (context.includes('fast') || context.includes('quick')) {
    baseMin = Math.floor(baseMin / 2);
    baseMax = Math.floor(baseMax / 2);
  } else if (context.includes('slow') || context.includes('careful')) {
    baseMin *= 2;
    baseMax *= 2;
  } else if (context.includes('browse') || context.includes('scroll')) {
    baseMin += 500;
    baseMax += 1000;
  }
  
  // Gaussian-like distribution using 3 random samples averaged
  const r1 = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
  const r2 = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
  const r3 = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
  
  return Math.floor((r1 + r2 + r3) / 3);
}

// Step types
export const STEP_TYPES = {
  ACTION: 'action',      // Single action (tap, swipe, type, etc)
  CONDITION: 'condition', // If-else branching
  LOOP: 'loop',          // Repeat N times
  WHILE: 'while',        // Repeat while condition
  PARALLEL: 'parallel',  // Run branches in parallel
  PYTHON: 'python',      // Run Python script
  PROMPT: 'prompt',      // Run AI prompt
  WAIT: 'wait',          // Wait for time or condition
  RANDOM_WAIT: 'random_wait', // Random wait để mô phỏng hành vi người
  AI_WAIT: 'ai_wait',    // AI-powered humanlike delay based on context
  EXTRACT: 'extract',    // Extract data from screen
  SKILL: 'skill',        // Run an existing skill
};

// Action types for ACTION step
export const ACTION_TYPES = {
  OPEN_APP: 'open_app',
  TAP: 'tap',
  TAP_IF: 'tap_if',
  SWIPE: 'swipe',
  SWIPE_UP: 'swipe_up',
  SWIPE_DOWN: 'swipe_down',
  TYPE: 'type',
  BACK: 'back',
  HOME: 'home',
  SCREENSHOT: 'screenshot',
  DISMISS_POPUP: 'dismiss_popup',
};

// Error strategies
export const WORKFLOW_ERROR_STRATEGIES = {
  ABORT: 'abort',     // Stop workflow
  SKIP: 'skip',       // Skip step, continue
  RETRY: 'retry',     // Retry step with backoff
  FALLBACK: 'fallback', // Run fallback steps
};

const loadWorkflowsFromStorage = () => {
  try {
    const saved = localStorage.getItem(WORKFLOWS_KEY);
    return saved ? JSON.parse(saved) : getDefaultWorkflows();
  } catch {
    return getDefaultWorkflows();
  }
};

const saveWorkflowsToStorage = (workflows) => {
  try {
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  } catch (e) {
    console.error('Failed to save workflows:', e);
  }
};

// Default example workflows
const getDefaultWorkflows = () => [
  {
    id: 'wf-tiktok-complex',
    name: 'TikTok Complex Flow',
    description: 'Workflow phức tạp với loop, condition và Python script',
    icon: 'zap',
    color: '#ff0050',
    category: 'social',

    // Input variables
    inputs: [
      { name: 'video_count', label: 'Số video', type: 'number', default: 5 },
      { name: 'like_videos', label: 'Like video', type: 'boolean', default: true },
      { name: 'min_watch_time', label: 'Thời gian xem tối thiểu (s)', type: 'number', default: 5 },
      { name: 'max_watch_time', label: 'Thời gian xem tối đa (s)', type: 'number', default: 15 },
    ],

    // Workflow steps
    steps: [
      {
        id: 'step-1',
        type: 'action',
        name: 'Mở TikTok',
        action: 'open_app',
        params: { package: 'com.ss.android.ugc.trill' },
        onError: { strategy: 'retry', retries: 3 },
      },
      {
        id: 'step-2',
        type: 'wait',
        name: 'Chờ app load',
        duration: 3000,
      },
      {
        id: 'step-3',
        type: 'loop',
        name: 'Lặp xem video',
        count: '{{video_count}}',
        variable: 'i',
        body: [
          {
            id: 'step-3-1',
            type: 'python',
            name: 'Random wait time',
            script: `
import random
min_time = inputs.get('min_watch_time', 5)
max_time = inputs.get('max_watch_time', 15)
wait_time = random.uniform(min_time, max_time)
return {"wait_time": wait_time}
            `,
            saveTo: 'random_result',
          },
          {
            id: 'step-3-2',
            type: 'wait',
            name: 'Xem video',
            duration: '{{random_result.wait_time}}',
          },
          {
            id: 'step-3-3',
            type: 'condition',
            name: 'Check like setting',
            condition: '{{like_videos}}',
            then: [
              {
                id: 'step-3-3-1',
                type: 'action',
                name: 'Like video',
                action: 'tap_if',
                params: {
                  element: 'like_button',
                  condition: 'not_active'
                },
              },
            ],
            else: [],
          },
          {
            id: 'step-3-4',
            type: 'action',
            name: 'Swipe to next',
            action: 'swipe_up',
          },
        ],
      },
      {
        id: 'step-4',
        type: 'python',
        name: 'Tổng kết',
        script: `
# Final summary
video_count = inputs.get('video_count', 0)
liked = inputs.get('like_videos', False)
summary = f"Đã xem {video_count} video"
if liked:
    summary += ", đã like tất cả"
return {"summary": summary, "videos_watched": video_count}
        `,
        saveTo: 'final_result',
      },
    ],

    // Output variables to return
    outputs: ['final_result'],

    // Metadata
    timeout: 600,
    createdAt: new Date().toISOString(),
    isBuiltin: true,
  },
];

export const useWorkflowStore = create((set, get) => ({
  workflows: loadWorkflowsFromStorage(),
  activeWorkflow: null,
  isRunning: false,
  abortRequested: false, // Flag to signal workflow abort
  currentStepId: null,
  context: {}, // Runtime context (variables, results)
  logs: [],
  runHistory: [],

  // CRUD Operations
  addWorkflow: (workflow) => {
    const newWorkflow = {
      id: crypto.randomUUID(),
      ...workflow,
      createdAt: new Date().toISOString(),
      isBuiltin: false,
    };
    const newWorkflows = [...get().workflows, newWorkflow];
    set({ workflows: newWorkflows });
    saveWorkflowsToStorage(newWorkflows);
    return newWorkflow;
  },

  updateWorkflow: (id, updates) => {
    const newWorkflows = get().workflows.map(w =>
      w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
    );
    set({ workflows: newWorkflows });
    saveWorkflowsToStorage(newWorkflows);
  },

  deleteWorkflow: (id) => {
    const workflow = get().workflows.find(w => w.id === id);
    if (workflow?.isBuiltin) {
      console.warn('Cannot delete builtin workflow');
      return false;
    }
    const newWorkflows = get().workflows.filter(w => w.id !== id);
    set({ workflows: newWorkflows });
    saveWorkflowsToStorage(newWorkflows);
    return true;
  },

  duplicateWorkflow: (id) => {
    const workflow = get().workflows.find(w => w.id === id);
    if (!workflow) return null;
    const duplicate = {
      ...workflow,
      id: crypto.randomUUID(),
      name: `${workflow.name} (Copy)`,
      isBuiltin: false,
      createdAt: new Date().toISOString(),
    };
    const newWorkflows = [...get().workflows, duplicate];
    set({ workflows: newWorkflows });
    saveWorkflowsToStorage(newWorkflows);
    return duplicate;
  },

  getWorkflow: (id) => get().workflows.find(w => w.id === id),

  // Runtime context management
  setContext: (key, value) => {
    set(state => ({
      context: { ...state.context, [key]: value }
    }));
  },

  getContext: (key) => get().context[key],

  clearContext: () => set({ context: {} }),

  // Logging
  addLog: (level, message) => {
    set(state => ({
      logs: [...state.logs, {
        id: crypto.randomUUID(),
        level,
        message,
        timestamp: new Date().toISOString(),
      }].slice(-100) // Keep last 100 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),

  // Compile workflow - replace variables with values
  compileValue: (value, inputs = {}) => {
    if (typeof value !== 'string') return value;

    let result = value;
    const context = get().context;

    // Replace {{input_name}} with input values
    Object.entries(inputs).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
    });

    // Replace {{context.key}} with context values
    Object.entries(context).forEach(([key, val]) => {
      if (typeof val === 'object') {
        Object.entries(val).forEach(([subKey, subVal]) => {
          result = result.replace(
            new RegExp(`\\{\\{${key}\\.${subKey}\\}\\}`, 'g'),
            String(subVal)
          );
        });
      }
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
    });

    return result;
  },

  // Run workflow (high-level)
  runWorkflow: async (workflowId, inputs = {}, deviceId) => {
    const workflow = get().workflows.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    console.log('[runWorkflow] Starting workflow:', workflow.name, 'with', workflow.steps?.length, 'steps');

    set({
      isRunning: true,
      activeWorkflow: workflow,
      context: { inputs },
      logs: [],
      abortRequested: false, // Reset abort flag
    });

    get().addLog('info', `🚀 Starting workflow: ${workflow.name}`);

    try {
      // Execute steps
      let stepIndex = 0;
      for (const step of workflow.steps) {
        // Check if abort was requested
        if (get().abortRequested) {
          get().addLog('warning', '⏹️ Workflow dừng bởi người dùng');
          break;
        }
        
        stepIndex++;
        get().addLog('info', `📍 Step ${stepIndex}/${workflow.steps.length}: ${step.name || step.action || step.type}`);
        console.log(`[runWorkflow] Executing step ${stepIndex}/${workflow.steps.length}:`, step);
        
        // Execute step and WAIT for completion
        await get().executeStep(step, inputs, deviceId);
        
        get().addLog('success', `  ✓ Step ${stepIndex} hoàn thành`);
        console.log(`[runWorkflow] Step ${stepIndex} completed`);
        
        // Check again after step execution
        if (get().abortRequested) {
          get().addLog('warning', '⏹️ Workflow dừng bởi người dùng');
          break;
        }
        
        // Wait is now handled inside executeStep via waitAfter
        if (get().abortRequested) break;
      }

      const wasAborted = get().abortRequested;
      
      if (!wasAborted) {
        get().addLog('success', `✅ Workflow completed: ${workflow.name}`);
      }

      // Add to history
      get().addRunHistory({
        workflowId,
        workflowName: workflow.name,
        inputs,
        deviceId,
        status: wasAborted ? 'stopped' : 'success',
        context: get().context,
      });

      return { success: !wasAborted, context: get().context, stepsExecuted: stepIndex };
    } catch (error) {
      console.error('[runWorkflow] Error:', error);
      get().addLog('error', `❌ Workflow failed: ${error.message}`);

      get().addRunHistory({
        workflowId,
        workflowName: workflow.name,
        inputs,
        deviceId,
        status: 'failed',
        error: error.message,
      });

      return { success: false, error: error.message };
    } finally {
      set({ isRunning: false, currentStepId: null, abortRequested: false });
    }
  },

  // Run workflow using Python backend (reliable timing)
  runWorkflowPython: async (workflowId, inputs = {}, deviceId) => {
    const workflow = get().workflows.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    console.log('[runWorkflowPython] Starting workflow via Python:', workflow.name);

    set({
      isRunning: true,
      activeWorkflow: workflow,
      context: { inputs },
      logs: [],
      abortRequested: false,
    });

    get().addLog('info', `🐍 Running workflow via Python: ${workflow.name}`);

    try {
      // Prepare workflow data with inputs applied
      const workflowData = {
        ...workflow,
        steps: workflow.steps.map(step => ({
          ...step,
          // Ensure waitAfter and waitVariance are set
          waitAfter: step.waitAfter || 500,
          waitVariance: step.waitVariance !== undefined ? step.waitVariance : 0.15,
        })),
      };

      // Call Python executor via Tauri
      const result = await invoke('run_workflow_python', {
        workflow: workflowData,
        deviceId,
      });

      console.log('[runWorkflowPython] Result:', result);

      // Add logs from Python
      if (result.logs) {
        result.logs.forEach(log => get().addLog('info', log));
      }

      if (result.success) {
        get().addLog('success', `✅ Workflow completed: ${result.steps_executed}/${result.total_steps} steps`);
      } else {
        get().addLog('error', `❌ Workflow failed: ${result.error}`);
      }

      // Add to history
      get().addRunHistory({
        workflowId,
        workflowName: workflow.name,
        inputs,
        deviceId,
        status: result.success ? 'success' : 'failed',
        error: result.error,
      });

      return {
        success: result.success,
        stepsExecuted: result.steps_executed,
        error: result.error,
      };
    } catch (error) {
      console.error('[runWorkflowPython] Error:', error);
      get().addLog('error', `❌ Python executor failed: ${error}`);

      get().addRunHistory({
        workflowId,
        workflowName: workflow.name,
        inputs,
        deviceId,
        status: 'failed',
        error: String(error),
      });

      return { success: false, error: String(error) };
    } finally {
      set({ isRunning: false, currentStepId: null, abortRequested: false });
    }
  },

  // Execute a single step (with optional wait after)
  executeStep: async (step, inputs, deviceId, skipWait = false) => {
    set({ currentStepId: step.id });
    const { compileValue, addLog, setContext, executeStep } = get();

    addLog('info', `▶️ Step: ${step.name || step.type}`);

    switch (step.type) {
      case STEP_TYPES.ACTION:
        await get().executeAction(step, inputs, deviceId);
        break;

      case STEP_TYPES.WAIT:
        const duration = Number(compileValue(String(step.duration), inputs)) || 1000;
        addLog('info', `⏳ Waiting ${duration}ms`);
        await new Promise(r => setTimeout(r, duration));
        break;

      case STEP_TYPES.RANDOM_WAIT:
        // Random delay để mô phỏng hành vi người
        const minDelay = Number(compileValue(String(step.min || step.duration || 1000), inputs));
        const maxDelay = Number(compileValue(String(step.max || minDelay * 2), inputs));
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        addLog('info', `⏳ Random wait: ${randomDelay}ms (${minDelay}-${maxDelay}ms)`);
        await new Promise(r => setTimeout(r, randomDelay));
        break;

      case STEP_TYPES.AI_WAIT:
        // AI-powered humanlike delay based on context
        const prevAction = step.prev_action || 'unknown';
        const nextAction = step.next_action || 'unknown';
        const contextHint = step.context || '';
        const aiDelay = calculateHumanlikeDelay(prevAction, nextAction, contextHint);
        addLog('info', `🤖 AI wait: ${aiDelay}ms (prev: ${prevAction}, next: ${nextAction})`);
        await new Promise(r => setTimeout(r, aiDelay));
        break;

      case STEP_TYPES.CONDITION:
        const condition = compileValue(step.condition, inputs);
        const conditionResult = condition === 'true' || condition === true;
        addLog('info', `🔀 Condition: ${condition} = ${conditionResult}`);

        const branch = conditionResult ? step.then : step.else;
        if (branch && branch.length > 0) {
          for (const subStep of branch) {
            await executeStep(subStep, inputs, deviceId, false);
          }
        }
        break;

      case STEP_TYPES.LOOP:
        const count = Number(compileValue(String(step.count), inputs)) || 0;
        addLog('info', `🔄 Loop: ${count} iterations`);

        for (let i = 0; i < count; i++) {
          setContext(step.variable || 'i', i);
          addLog('info', `  Iteration ${i + 1}/${count}`);

          for (const subStep of step.body || []) {
            await executeStep(subStep, inputs, deviceId, false);
          }
        }
        break;

      case STEP_TYPES.PYTHON:
        await get().executePython(step, inputs, deviceId);
        break;

      case STEP_TYPES.PROMPT:
        await get().executePrompt(step, inputs, deviceId);
        break;

      case STEP_TYPES.EXTRACT:
        // TODO: Implement extraction
        addLog('info', `📤 Extract: ${step.selector} → ${step.saveTo}`);
        break;

      case STEP_TYPES.SKILL:
        // Run existing skill
        const { compilePrompt } = useSkillStore.getState();
        const compiledPrompt = compilePrompt(step.skillId, inputs);
        if (compiledPrompt) {
          addLog('info', `🎯 Running skill: ${step.skillId}`);
          await invoke('run_task', {
            deviceId,
            prompt: compiledPrompt,
            // ... other params from profile
          });
        }
        break;

      default:
        addLog('warning', `Unknown step type: ${step.type}`);
    }

    // Apply waitAfter delay after step execution (unless skipped or it's a wait-type step)
    console.log(`[executeStep] Check wait: skipWait=${skipWait}, step.type=${step.type}, step.action=${step.action}`);
    if (!skipWait && step.type !== STEP_TYPES.WAIT && step.type !== STEP_TYPES.RANDOM_WAIT && step.type !== STEP_TYPES.AI_WAIT) {
      // Use step's waitAfter, or smart default based on action type
      let baseWait = step.waitAfter;
      if (baseWait === undefined || baseWait === null) {
        // Smart defaults based on action type
        const defaultWaits = {
          'start_app': 2000,
          'open_app': 2000,
          'tap': 500,
          'click': 500,
          'input_text': 800,
          'type': 800,
          'key_press': 400,
          'swipe': 600,
          'swipe_up': 800,
          'swipe_down': 800,
          'long_press': 800,
          'back': 500,
          'home': 800,
        };
        baseWait = defaultWaits[step.action] || 500; // Default 500ms for unknown actions
      }
      
      if (baseWait > 0) {
        const variance = step.waitVariance !== undefined ? step.waitVariance : 0.15;
        // Variance only INCREASES delay (0% to +variance%), not decreases
        const randomFactor = 1 + Math.random() * variance;
        const delay = Math.floor(baseWait * randomFactor);
        
        console.log(`[executeStep] WAIT: ${delay}ms (base=${baseWait}ms +${Math.round(variance*100)}%)`);
        addLog('info', `⏳ Chờ ${delay}ms`);
        
        // Use Rust backend for reliable sleep
        try {
          await invoke('sleep_ms', { ms: delay });
          console.log(`[executeStep] WAIT completed: ${delay}ms`);
        } catch (e) {
          // Fallback to JS setTimeout if invoke fails
          console.warn('[executeStep] Rust sleep failed, using JS fallback:', e);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  },

  // Execute ACTION step
  executeAction: async (step, inputs, deviceId) => {
    const { compileValue, addLog } = get();
    const params = {};

    // Compile params
    if (step.params) {
      Object.entries(step.params).forEach(([key, val]) => {
        params[key] = compileValue(val, inputs);
      });
    }

    addLog('info', `  ⚡ Action: ${step.action} ${JSON.stringify(params)}`);
    console.log('[executeAction] Running action:', step.action, 'with params:', params, 'on device:', deviceId);
    console.log('[executeAction] Waiting for ADB command to complete...');

    try {
      // Map action to ADB/DroidRun command
      switch (step.action) {
        case ACTION_TYPES.OPEN_APP:
        case 'start_app':
          // Try activity launch first, fallback to monkey
          if (params.activity) {
            console.log('[executeAction] Starting app with activity:', params.package, params.activity);
            await invoke('run_adb_command', {
              args: ['-s', deviceId, 'shell', 'am', 'start', '-n', `${params.package}/${params.activity}`]
            });
          } else {
            console.log('[executeAction] Starting app with monkey:', params.package);
            await invoke('run_adb_command', {
              args: ['-s', deviceId, 'shell', 'monkey', '-p', params.package, '1']
            });
          }
          break;

      case ACTION_TYPES.TAP:
      case 'tap':
      case 'click':
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'tap', String(params.x), String(params.y)]
        });
        break;

      case ACTION_TYPES.SWIPE_UP:
      case 'swipe_up':
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'swipe', '500', '1500', '500', '500', '300']
        });
        break;

      case ACTION_TYPES.SWIPE_DOWN:
      case 'swipe_down':
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'swipe', '500', '500', '500', '1500', '300']
        });
        break;

      case 'swipe':
        // Custom swipe with params
        const startX = params.start_x || params.x || 500;
        const startY = params.start_y || params.y || 800;
        const endX = params.end_x || startX;
        const endY = params.end_y || startY - 500;
        const duration = params.duration || 300;
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'swipe', String(startX), String(startY), String(endX), String(endY), String(duration)]
        });
        break;

      case ACTION_TYPES.TYPE:
      case 'type':
      case 'input_text':
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'text', params.text]
        });
        break;

      case ACTION_TYPES.BACK:
      case 'back':
      case 'key_press':
        // Handle key press with keycode
        const keycode = params.keycode || 4; // Default BACK = 4
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'keyevent', String(keycode)]
        });
        break;

      case ACTION_TYPES.HOME:
      case 'home':
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'keyevent', 'KEYCODE_HOME']
        });
        break;

      case 'long_press':
        // Long press = swipe with same start/end
        await invoke('run_adb_command', {
          args: ['-s', deviceId, 'shell', 'input', 'swipe', String(params.x), String(params.y), String(params.x), String(params.y), String(params.duration || 1000)]
        });
        break;

      default:
        addLog('warning', `Unknown action: ${step.action}`);
    }
    console.log('[executeAction] Action completed:', step.action);
    
    // Add minimum delay after ADB command to ensure device processes it
    await new Promise(r => setTimeout(r, 150));
    
    } catch (error) {
      console.error('[executeAction] Error:', error);
      addLog('error', `Action failed: ${step.action} - ${error}`);
      throw error;
    }
  },

  // Execute PYTHON step
  executePython: async (step, inputs, deviceId) => {
    const { addLog, setContext, context } = get();

    addLog('info', `🐍 Running Python script...`);

    try {
      const result = await invoke('run_python_script', {
        script: step.script,
        inputs: { ...inputs, ...context },
        deviceId,
      });

      if (step.saveTo && result) {
        setContext(step.saveTo, result);
        addLog('info', `  Result saved to: ${step.saveTo}`);
      }

      return result;
    } catch (e) {
      addLog('error', `  Python error: ${e}`);
      throw e;
    }
  },

  // Execute PROMPT step
  executePrompt: async (step, inputs, deviceId) => {
    const { compileValue, addLog, setContext } = get();
    const prompt = compileValue(step.prompt, inputs);

    addLog('info', `💬 Running AI prompt...`);

    try {
      const { activeProfile } = useProfileStore.getState();
      if (!activeProfile) {
        throw new Error('No active profile');
      }

      const result = await invoke('run_task', {
        deviceId,
        provider: activeProfile.provider.name,
        apiKey: activeProfile.provider.api_key,
        model: activeProfile.provider.model,
        prompt,
        baseUrl: activeProfile.provider.base_url,
      });

      if (step.saveTo && result) {
        setContext(step.saveTo, result);
      }

      return result;
    } catch (e) {
      addLog('error', `  Prompt error: ${e}`);
      throw e;
    }
  },

  // Run history
  addRunHistory: (entry) => {
    const history = [...get().runHistory, {
      id: crypto.randomUUID(),
      ...entry,
      timestamp: new Date().toISOString(),
    }].slice(-50);
    set({ runHistory: history });
  },

  // Stop running workflow
  stopWorkflow: () => {
    console.log('[stopWorkflow] Abort requested');
    get().addLog('warning', '⏹️ Đang dừng workflow...');
    set({ abortRequested: true });
  },

  // Import/Export
  exportWorkflows: () => {
    return JSON.stringify(get().workflows.filter(w => !w.isBuiltin), null, 2);
  },

  importWorkflows: (jsonString) => {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const newWorkflows = imported.map(w => ({
        ...w,
        id: crypto.randomUUID(),
        isBuiltin: false,
        createdAt: new Date().toISOString(),
      }));

      const allWorkflows = [...get().workflows, ...newWorkflows];
      set({ workflows: allWorkflows });
      saveWorkflowsToStorage(allWorkflows);
      return newWorkflows.length;
    } catch (e) {
      console.error('Failed to import workflows:', e);
      return 0;
    }
  },

  // Reset to defaults
  resetToDefaults: () => {
    const defaults = getDefaultWorkflows();
    set({ workflows: defaults });
    saveWorkflowsToStorage(defaults);
  },

  // ============================================
  // Multi-Device Workflow Execution
  // ============================================

  // Track multi-device execution state
  multiDeviceState: {
    isRunning: false,
    deviceStates: {}, // { deviceId: { status, progress, currentStep, logs } }
    totalDevices: 0,
    completedDevices: 0,
    failedDevices: 0,
  },

  // Run workflow on multiple devices simultaneously
  runWorkflowMultiDevice: async (workflowId, inputs = {}, deviceIds = [], options = {}) => {
    const workflow = get().workflows.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (deviceIds.length === 0) {
      throw new Error('No devices selected');
    }

    const { 
      parallel = true, // Run on all devices in parallel
      staggerDelay = 2000, // Delay between starting each device (ms)
      onDeviceProgress = null, // Callback for per-device progress
    } = options;

    console.log(`[runWorkflowMultiDevice] Starting "${workflow.name}" on ${deviceIds.length} devices`);

    // Initialize multi-device state
    const initialDeviceStates = {};
    deviceIds.forEach(id => {
      initialDeviceStates[id] = {
        status: 'pending',
        progress: 0,
        currentStep: null,
        logs: [],
        startTime: null,
        endTime: null,
        error: null,
      };
    });

    set({
      multiDeviceState: {
        isRunning: true,
        deviceStates: initialDeviceStates,
        totalDevices: deviceIds.length,
        completedDevices: 0,
        failedDevices: 0,
      },
    });

    get().addLog('info', `🚀 Starting workflow "${workflow.name}" on ${deviceIds.length} devices`);

    // Helper to update device state
    const updateDeviceState = (deviceId, updates) => {
      set(state => ({
        multiDeviceState: {
          ...state.multiDeviceState,
          deviceStates: {
            ...state.multiDeviceState.deviceStates,
            [deviceId]: {
              ...state.multiDeviceState.deviceStates[deviceId],
              ...updates,
            },
          },
        },
      }));
      if (onDeviceProgress) {
        onDeviceProgress(deviceId, updates);
      }
    };

    // Run workflow on a single device
    const runOnDevice = async (deviceId, delayMs = 0) => {
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }

      updateDeviceState(deviceId, { 
        status: 'running', 
        startTime: new Date().toISOString(),
      });

      try {
        // Clone workflow store's run method but for specific device
        const result = await get().runWorkflow(workflowId, inputs, deviceId);
        
        updateDeviceState(deviceId, {
          status: result.success ? 'completed' : 'failed',
          progress: 100,
          endTime: new Date().toISOString(),
          error: result.error || null,
        });

        set(state => ({
          multiDeviceState: {
            ...state.multiDeviceState,
            completedDevices: result.success 
              ? state.multiDeviceState.completedDevices + 1 
              : state.multiDeviceState.completedDevices,
            failedDevices: !result.success 
              ? state.multiDeviceState.failedDevices + 1 
              : state.multiDeviceState.failedDevices,
          },
        }));

        return result;
      } catch (error) {
        updateDeviceState(deviceId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          error: error.message,
        });

        set(state => ({
          multiDeviceState: {
            ...state.multiDeviceState,
            failedDevices: state.multiDeviceState.failedDevices + 1,
          },
        }));

        return { success: false, error: error.message };
      }
    };

    try {
      let results;
      
      if (parallel) {
        // Run on all devices in parallel with stagger delay
        const promises = deviceIds.map((deviceId, index) => 
          runOnDevice(deviceId, index * staggerDelay)
        );
        results = await Promise.all(promises);
      } else {
        // Run sequentially
        results = [];
        for (const deviceId of deviceIds) {
          const result = await runOnDevice(deviceId, 0);
          results.push(result);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      get().addLog('info', `✅ Multi-device workflow completed: ${successCount} success, ${failCount} failed`);

      return {
        success: failCount === 0,
        results,
        successCount,
        failCount,
      };
    } finally {
      set(state => ({
        multiDeviceState: {
          ...state.multiDeviceState,
          isRunning: false,
        },
      }));
    }
  },

  // Stop multi-device workflow
  stopMultiDeviceWorkflow: () => {
    get().stopWorkflow(); // This will trigger abort for current device
    set(state => ({
      multiDeviceState: {
        ...state.multiDeviceState,
        isRunning: false,
      },
    }));
    get().addLog('warning', '⏹️ Multi-device workflow stopped by user');
  },
}));
