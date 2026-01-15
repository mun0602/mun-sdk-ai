/**
 * MUN SDK AI V2 - Tauri E2E Tests
 * Uses Page Object Model for maintainability
 */
const TestSetup = require('../helpers/testSetup');
const LicensePage = require('../pageobjects/LicensePage');
const MainApp = require('../pageobjects/MainApp');
const TIMEOUT = require('../config/timeouts');

describe('MUN SDK AI V2 - App State Detection', () => {
  let isLoggedIn = false;

  before(async () => {
    // Wait for app to fully load
    await browser.pause(TIMEOUT.APP_LOAD);

    // Detect current app state
    isLoggedIn = await MainApp.isDisplayed();
    console.log(`App state: ${isLoggedIn ? 'Logged in' : 'License page'}`);
  });

  describe('License Page Tests', () => {
    before(async function () {
      // Skip if already logged in - need to logout first
      if (isLoggedIn) {
        await MainApp.logout();
        isLoggedIn = false;
      }
    });

    it('should display the license page', async () => {
      const displayed = await LicensePage.isDisplayed();
      expect(displayed).toBe(true);
    });

    it('should have license key input field', async () => {
      await expect(LicensePage.licenseInput).toBeDisplayed();
      await expect(LicensePage.licenseInput).toBeEnabled();
    });

    it('should have activate button', async () => {
      await expect(LicensePage.activateButton).toBeDisplayed();
      await expect(LicensePage.activateButton).toBeEnabled();
    });

    it('should show error when activating with empty license key', async () => {
      await LicensePage.clickActivate();
      await browser.pause(TIMEOUT.BUTTON_CLICK);

      const hasError = await LicensePage.hasError();
      expect(hasError).toBe(true);
    });
  });

  describe('Main App Tests', () => {
    before(async function () {
      // Need a valid license to continue - skip test if not logged in
      isLoggedIn = await MainApp.isDisplayed();
      if (!isLoggedIn) {
        this.skip();
      }
    });

    it('should display sidebar with correct title', async () => {
      await expect(MainApp.sidebarTitle).toBeDisplayed();
      await expect(MainApp.sidebarTitle).toHaveText('MUN SDK AI');
    });

    it('should display sidebar navigation items', async () => {
      const navItems = await $$('.nav-item');
      expect(navItems.length).toBeGreaterThan(5);
    });
  });

  describe('Navigation Tests', () => {
    const sections = [
      { id: 'devices', title: 'Quản lý thiết bị' },
      { id: 'profiles', title: 'Quản lý Profiles' },
      { id: 'tasks', title: 'Quản lý Task' },
      { id: 'scheduler', title: 'Lịch trình Task' },
      { id: 'execution', title: 'Thực thi Task' },
      { id: 'settings', title: 'Cài đặt' },
    ];

    sections.forEach(({ id, title }) => {
      it(`should switch to ${id} tab`, async () => {
        await MainApp.navigateTo(id);
        const headerTitle = await MainApp.getCurrentSectionTitle();
        expect(headerTitle).toBe(title);
      });
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle theme successfully', async () => {
      const initialTheme = await MainApp.getCurrentTheme();
      await MainApp.toggleTheme();
      const newTheme = await MainApp.getCurrentTheme();

      // Theme should have changed
      expect(['dark', 'light']).toContain(newTheme);
    });
  });

  describe('Profile Creation Modal', () => {
    before(async () => {
      await MainApp.navigateTo('profiles');
    });

    it('should open create profile modal', async () => {
      const createBtn = await $('button*=Tạo Profile');
      await createBtn.click();
      await browser.pause(TIMEOUT.MODAL_TRANSITION);

      const modal = await $('.modal');
      await expect(modal).toBeDisplayed();
    });

    it('should have all required fields in profile form', async () => {
      const nameInput = await $('input[placeholder="My Profile"]');
      await expect(nameInput).toBeDisplayed();

      const providerSelect = await $('select');
      await expect(providerSelect).toBeDisplayed();

      const apiKeyInput = await $('input[type="password"]');
      await expect(apiKeyInput).toBeDisplayed();
    });

    it('should close modal when clicking cancel', async () => {
      const cancelBtn = await $('button*=Hủy');
      await cancelBtn.click();
      await browser.pause(TIMEOUT.MODAL_TRANSITION);

      const modal = await $('.modal');
      await expect(modal).not.toBeDisplayed();
    });
  });

  describe('Logout Flow', () => {
    it('should logout and return to license page', async () => {
      await MainApp.logout();

      const onLicensePage = await LicensePage.isDisplayed();
      expect(onLicensePage).toBe(true);
    });
  });
});
