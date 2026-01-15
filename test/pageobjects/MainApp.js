const BasePage = require('./BasePage');

/**
 * Main App Page Object
 */
class MainApp extends BasePage {
  // Selectors
  get sidebarTitle() { return $('.sidebar-title'); }
  get headerTitle() { return $('.header-title'); }
  get themeToggle() { return $('button[title*="Mode"]'); }

  // Navigation mapping
  navItems = {
    devices: 'Thiết bị',
    profiles: 'Profiles',
    tasks: 'Quản lý Task',
    scheduler: 'Lịch trình',
    execution: 'Thực thi',
    settings: 'Cài đặt',
    logout: 'Đăng xuất',
  };

  // Expected titles
  sectionTitles = {
    devices: 'Quản lý thiết bị',
    profiles: 'Quản lý Profiles',
    tasks: 'Quản lý Task',
    scheduler: 'Lịch trình Task',
    execution: 'Thực thi Task',
    settings: 'Cài đặt',
  };

  async isDisplayed() {
    try {
      return await (await this.sidebarTitle).isDisplayed();
    } catch {
      return false;
    }
  }

  async navigateTo(section) {
    const navText = this.navItems[section];
    const navButton = await $(`button.nav-item*=${navText}`);
    await navButton.click();
    await this.smartPause(500);
  }

  async getCurrentSectionTitle() {
    return (await this.headerTitle).getText();
  }

  async verifySection(section) {
    const actualTitle = await this.getCurrentSectionTitle();
    const expectedTitle = this.sectionTitles[section];
    expect(actualTitle).toBe(expectedTitle);
  }

  async toggleTheme() {
    await (await this.themeToggle).click();
    await this.smartPause(300);
  }

  async getCurrentTheme() {
    const html = await $('html');
    return html.getAttribute('data-theme');
  }

  async logout() {
    await this.navigateTo('logout');
    await this.smartPause(1000);
  }
}

module.exports = new MainApp();
