// WebdriverIO configuration for Tauri app testing
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create directories for test artifacts
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test/screenshots');
const LOGS_DIR = path.resolve(__dirname, 'test/logs');

[SCREENSHOTS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Detect platform and build type
const platform = os.platform();
const buildType = process.env.BUILD_TYPE || 'debug';

// Platform-specific executable name
const getExecutableName = () => {
  if (platform === 'win32') return 'mun-sdk-ai-v2.exe';
  if (platform === 'darwin') return 'mun-sdk-ai-v2.app';
  return 'mun-sdk-ai-v2'; // Linux
};

// Build executable path (can be overridden with TAURI_APP_PATH env var)
const executablePath = process.env.TAURI_APP_PATH || path.resolve(
  __dirname,
  'src-tauri',
  'target',
  buildType,
  getExecutableName()
);

// Validate executable exists
if (!fs.existsSync(executablePath)) {
  console.warn(`⚠️  Executable not found at: ${executablePath}`);
  console.warn(`   Make sure to build the app first: npm run tauri:build -- --debug`);
}

exports.config = {
  // Runner Configuration
  runner: 'local',

  // Specify test files
  specs: ['./test/specs/**/*.js'],

  // Exclude specific files
  exclude: [],

  // Capabilities
  capabilities: [{
    maxInstances: 1,
    'tauri:options': {
      application: executablePath,
    },
  }],

  // Log level: trace | debug | info | warn | error | silent
  logLevel: 'info',

  // Output directory for logs
  outputDir: LOGS_DIR,

  // Base URL (not used for Tauri but required)
  baseUrl: '',

  // Wait timeouts
  waitforTimeout: 10000,

  // Connection retry
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Services - use tauri-driver
  port: 4444,

  // Framework
  framework: 'mocha',

  // Reporters
  reporters: ['spec'],

  // Mocha options
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    retries: 1, // Retry failed tests once
  },

  // Hooks
  /**
   * Gets executed before test execution begins
   */
  before: function (capabilities, specs) {
    // Set global timeout for browser commands
    browser.setTimeout({
      implicit: 5000,
      pageLoad: 30000,
      script: 30000,
    });
  },

  /**
   * Gets executed before a test
   */
  beforeTest: function (test, context) {
    console.log(`\n▶ Starting: ${test.title}`);
  },

  /**
   * Gets executed after test
   */
  afterTest: async function (test, context, { error, result, duration, passed, retries }) {
    // Take screenshot on failure
    if (error) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const testName = test.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const screenshotPath = path.join(SCREENSHOTS_DIR, `FAIL_${testName}_${timestamp}.png`);

      try {
        await browser.saveScreenshot(screenshotPath);
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        console.error('Failed to save screenshot:', e.message);
      }
    }

    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test.title} (${duration}ms)`);
  },
};
