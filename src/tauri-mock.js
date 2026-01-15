// Tauri Mock - Cho phép test app trong browser
// Detect if running in Tauri or browser
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

// Mock data
const mockData = {
  license: {
    is_valid: true,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  config: {
    version: '2.0.0',
    active_profile_id: null,
    profiles: [],
    settings: {
      theme: 'light',
      language: 'vi',
      auto_connect: true,
      log_level: 'info',
      max_parallel_devices: 3,
      screenshot_quality: 80,
    },
  },
  devices: [
    {
      id: 'emulator-5554',
      model: 'Pixel 4 (Mock)',
      status: 'device',
      android_version: '13',
    },
    {
      id: '192.168.1.100:5555',
      model: 'Samsung Galaxy S21 (Mock)',
      status: 'device',
      android_version: '12',
    },
  ],
};

// Mock command handlers
const mockHandlers = {
  check_license: async () => mockData.license,

  activate_license: async ({ licenseKey }) => {
    console.log('[Mock] Activating license:', licenseKey);
    mockData.license.is_valid = true;
    return mockData.license;
  },

  logout_license: async () => {
    mockData.license.is_valid = false;
    return true;
  },

  load_config: async () => {
    console.log('[Mock] Loading config:', mockData.config);
    return mockData.config;
  },

  save_config: async ({ config }) => {
    console.log('[Mock] Saving config:', config);
    mockData.config = config;
    return true;
  },

  create_profile: async ({ profile }) => {
    console.log('[Mock] Creating profile:', profile?.name);
    // Check duplicate
    if (mockData.config.profiles.some(p => p.id === profile.id)) {
      console.log('[Mock] Profile already exists, skipping');
      return profile;
    }
    mockData.config.profiles.push(profile);
    return profile;
  },

  update_profile: async ({ profile }) => {
    console.log('[Mock] Updating profile:', profile?.name);
    const idx = mockData.config.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      mockData.config.profiles[idx] = profile;
    }
    return profile;
  },

  delete_profile: async ({ profileId }) => {
    console.log('[Mock] Deleting profile:', profileId);
    mockData.config.profiles = mockData.config.profiles.filter(p => p.id !== profileId);
    if (mockData.config.active_profile_id === profileId) {
      mockData.config.active_profile_id = null;
    }
    return true;
  },

  set_active_profile: async ({ profileId }) => {
    console.log('[Mock] Setting active profile:', profileId);
    mockData.config.active_profile_id = profileId;
    return true;
  },

  get_active_profile: async () => {
    const profile = mockData.config.profiles.find(
      p => p.id === mockData.config.active_profile_id
    );
    return profile || null;
  },

  update_settings: async ({ settings }) => {
    console.log('[Mock] Updating settings:', settings);
    mockData.config.settings = settings;
    return true;
  },

  get_connected_devices: async () => {
    console.log('[Mock] Getting devices');
    return mockData.devices;
  },

  adb_connect: async ({ address }) => {
    console.log('[Mock] ADB connect:', address);
    mockData.devices.push({
      id: address,
      model: `Device ${address} (Mock)`,
      status: 'device',
      android_version: '11',
    });
    return { success: true };
  },

  adb_disconnect: async ({ address }) => {
    console.log('[Mock] ADB disconnect:', address);
    mockData.devices = mockData.devices.filter(d => d.id !== address);
    return true;
  },

  run_task: async (params) => {
    console.log('[Mock] Running task:', params);
    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      task_id: crypto.randomUUID(),
      success: true,
      output: '[Mock] Task completed successfully!\nAI đã thực hiện các bước:\n1. Mở app\n2. Click button\n3. Nhập text\n4. Submit form',
      screenshots: [],
      duration_ms: 2000,
    };
  },

  // Utils
  check_python_installed: async () => true,
  get_python_version: async () => '3.11.0',
  check_droidrun_installed: async () => true,
  get_droidrun_version: async () => '0.1.0',
  install_droidrun: async () => true,
  open_url: async ({ url }) => {
    window.open(url, '_blank');
    return true;
  },
  get_system_info: async () => ({
    os: 'Windows',
    arch: 'x64',
    version: '10.0.19045',
  }),

  // ADB commands
  run_adb_command: async ({ args }) => {
    console.log('[Mock] ADB command:', args);
    return { success: true, output: 'Mock ADB output' };
  },
  test_adb: async () => ({ success: true, version: '1.0.41' }),
  check_apk_installed: async () => true,
  install_apk: async () => true,
  take_screenshot: async () => 'data:image/png;base64,mock',

  // DroidRun Portal commands (simplified)
  check_droidrun_portal: async ({ deviceId }) => {
    console.log('[Mock] Check DroidRun Portal:', deviceId);
    return { success: true, output: 'Portal is installed and accessible' };
  },
  setup_droidrun_portal: async ({ deviceId }) => {
    console.log('[Mock] Setup DroidRun Portal:', deviceId);
    return { success: true, output: 'Installation successful!' };
  },

  // AI Generation
  generate_workflow: async ({ description }) => {
    console.log('[Mock] Generate workflow:', description);
    await new Promise(r => setTimeout(r, 2000)); // Simulate AI delay
    return {
      name: 'Auto Generated Workflow',
      description: description.substring(0, 100),
      color: '#4f6ef7',
      timeout: 300,
      inputs: [
        { name: 'repeat_count', label: 'Số lần lặp', type: 'number', default: 5 },
        { name: 'like_enabled', label: 'Bật like', type: 'boolean', default: true },
      ],
      steps: [
        { id: 'step-1', type: 'action', name: 'Mở app', action: 'open_app', params: { package: 'com.example' } },
        { id: 'step-2', type: 'wait', name: 'Chờ load', duration: '3000' },
        {
          id: 'step-3', type: 'loop', name: 'Lặp lại', count: '{{repeat_count}}', variable: 'i', body: [
            { id: 'step-3-1', type: 'prompt', name: 'Thực hiện', prompt: 'Perform the action', save_to: 'result' },
          ]
        },
      ],
    };
  },

  // Run workflow
  run_workflow: async ({ workflow, inputs, deviceId }) => {
    console.log('[Mock] Run workflow:', workflow.name, 'on device:', deviceId);
    await new Promise(r => setTimeout(r, 3000)); // Simulate execution
    return {
      success: true,
      stepsExecuted: workflow.steps?.length || 0,
      stepsFailed: 0,
      durationMs: 3000,
      outputs: { result: 'Workflow completed successfully' },
      error: null,
      logs: [
        { stepId: 'start', stepName: workflow.name, status: 'success', message: 'Workflow started', timestamp: new Date().toISOString() },
        { stepId: 'end', stepName: workflow.name, status: 'success', message: 'Workflow completed', timestamp: new Date().toISOString() },
      ],
    };
  },

  // Task commands
  create_task: async (params) => ({
    id: crypto.randomUUID(),
    ...params,
    status: 'Pending',
    progress: 0,
    current_step: 0,
    logs: [],
    created_at: new Date().toISOString(),
  }),
  run_parallel_tasks: async ({ tasks }) => tasks.map(t => ({
    task_id: t.id,
    success: true,
    output: 'Mock output',
    screenshots: [],
    duration_ms: 1000,
  })),
  cancel_task: async () => true,
  schedule_task: async ({ task, schedule_time, repeat }) => ({
    id: crypto.randomUUID(),
    task,
    schedule_time,
    repeat,
    enabled: true,
  }),

  // Emulator commands
  check_mumu_installed: async () => true,
  get_mumu_path: async () => 'C:\\NetEase\\MuMu\\nx_main\\MuMuManager.exe',
  set_emulator_path: async () => true,
  get_emulator_path: async () => 'C:\\NetEase\\MuMu\\nx_main\\MuMuManager.exe',
  get_emulator_instances: async () => ({
    success: true,
    message: 'Found 2 emulator(s)',
    instances: [
      { index: '0', name: 'MuMu-0', is_running: false, is_android_started: false, adb_port: 16384, adb_host: '127.0.0.1' },
      { index: '1', name: 'MuMu-1', is_running: true, is_android_started: true, adb_port: 16416, adb_host: '127.0.0.1' },
    ],
  }),
  get_all_emulator_instances: async () => ({
    success: true,
    message: 'Found 2 emulator(s)',
    instances: [
      { index: '0', name: 'MuMu-0', is_running: false, is_android_started: false, adb_port: 16384, adb_host: '127.0.0.1' },
      { index: '1', name: 'MuMu-1', is_running: true, is_android_started: true, adb_port: 16416, adb_host: '127.0.0.1' },
    ],
  }),
  launch_emulator: async ({ vmindex }) => {
    console.log('[Mock] Launching emulator:', vmindex);
    return { success: true, message: `Launched emulator ${vmindex}` };
  },
  shutdown_emulator: async ({ vmindex }) => {
    console.log('[Mock] Shutting down emulator:', vmindex);
    return { success: true, message: `Shutdown emulator ${vmindex}` };
  },
  connect_emulator_adb: async ({ adbHost, adbPort }) => {
    console.log('[Mock] Connecting ADB:', adbHost, adbPort);
    return { success: true, message: `Connected to ${adbHost}:${adbPort}` };
  },
  create_mumu_instance: async ({ count }) => {
    console.log('[Mock] Creating', count, 'MuMu instance(s)');
    return { success: true, message: `Created ${count} emulator(s)` };
  },
  clone_mumu_instance: async ({ vmindex }) => {
    console.log('[Mock] Cloning MuMu instance:', vmindex);
    return { success: true, message: `Cloned emulator ${vmindex}` };
  },
  delete_mumu_instance: async ({ vmindex }) => {
    console.log('[Mock] Deleting MuMu instance:', vmindex);
    return { success: true, message: `Deleted emulator ${vmindex}` };
  },
  rename_mumu_instance: async ({ vmindex, newName }) => {
    console.log('[Mock] Renaming MuMu instance:', vmindex, 'to', newName);
    return { success: true, message: `Renamed emulator ${vmindex} to ${newName}` };
  },
};

// Mock invoke function
async function mockInvoke(command, args = {}) {
  console.log(`[Mock Invoke] ${command}`, args);

  const handler = mockHandlers[command];
  if (handler) {
    try {
      const result = await handler(args);
      console.log(`[Mock Invoke] ${command} result:`, result);
      return result;
    } catch (error) {
      console.error(`[Mock Invoke] ${command} error:`, error);
      throw error;
    }
  }

  console.warn(`[Mock Invoke] Unknown command: ${command}`);
  throw new Error(`Unknown command: ${command}`);
}

// Export the appropriate invoke function
export async function invoke(command, args) {
  if (isTauri) {
    // Use real Tauri invoke
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(command, args);
  } else {
    // Use mock invoke for browser testing
    return mockInvoke(command, args);
  }
}

// Export listen function for Tauri events
export async function listen(event, callback) {
  if (isTauri) {
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    return tauriListen(event, callback);
  } else {
    // Mock listener - return unlisten function
    console.log(`[Mock Listen] ${event}`);
    return () => { };
  }
}

// Export isTauri for conditional rendering
export { isTauri };
