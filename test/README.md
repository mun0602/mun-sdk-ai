# E2E Testing Guide for MUN SDK AI V2

## Prerequisites

- Node.js 18+ and npm
- Rust and Cargo (for Tauri)
- Built Tauri app executable
- msedgedriver.exe (downloaded automatically or manually)

## Installation

```bash
# Install all dependencies
npm install

# Install tauri-driver globally (for running tests)
cargo install tauri-driver
```

## Building the App for Testing

```bash
# Build debug version (faster, for development)
npm run tauri:build -- --debug

# Build release version (for production-like testing)
npm run tauri:build
```

The executable will be at:
- Debug: `src-tauri/target/debug/mun-sdk-ai-v2.exe`
- Release: `src-tauri/target/release/mun-sdk-ai-v2.exe`

## Running Tests

```bash
# Run all E2E tests (starts tauri-driver automatically)
npm run test:tauri

# Run tests only (assumes tauri-driver is already running)
npm run test:e2e

# Run specific test file
npx wdio run wdio.conf.js --spec test/specs/app.test.js

# Run with different log level
npx wdio run wdio.conf.js --logLevel debug
```

## Test Structure

```
test/
├── config/
│   └── timeouts.js          # Centralized timeout config
├── helpers/
│   └── testSetup.js         # Test setup utilities
├── pageobjects/
│   ├── BasePage.js          # Base page object class
│   ├── LicensePage.js       # License page object
│   └── MainApp.js           # Main app page object
├── specs/
│   └── app.test.js          # Main test suite
├── screenshots/             # Generated screenshots (gitignored)
└── logs/                    # Test logs (gitignored)
```

## Page Object Model

Tests use Page Object Model pattern for maintainability:

```javascript
const LicensePage = require('../pageobjects/LicensePage');
const MainApp = require('../pageobjects/MainApp');

it('should activate demo mode', async () => {
  await LicensePage.clickDemo();
  await expect(MainApp.sidebarTitle).toBeDisplayed();
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BUILD_TYPE` | Build type: debug or release | debug |
| `TAURI_APP_PATH` | Custom app executable path | auto-detected |
| `CI` | Set to 'true' in CI environment | false |

## Troubleshooting

### Tests fail with "application not found"
Make sure app is built:
```bash
npm run tauri:build -- --debug
```

### tauri-driver fails to start
Check if port 4444 is already in use:
```bash
netstat -ano | findstr :4444
```

### Tests are flaky
- Increase timeouts in `test/config/timeouts.js`
- Check if selectors are stable
- Add proper waits instead of fixed pauses

## Resources

- [WebdriverIO Docs](https://webdriver.io/)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
- [Page Object Model Pattern](https://webdriver.io/docs/pageobjects/)
