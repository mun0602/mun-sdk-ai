/**
 * Global test setup utilities
 */
class TestSetup {
  /**
   * Wait for app to fully load
   */
  static async waitForAppReady(timeout = 5000) {
    await browser.pause(2000); // Initial load

    // Wait for either license page or main app
    const licenseTitle = await $('h1.license-title');
    const sidebarTitle = await $('.sidebar-title');

    await browser.waitUntil(
      async () => {
        const licenseDisplayed = await licenseTitle.isDisplayed().catch(() => false);
        const sidebarDisplayed = await sidebarTitle.isDisplayed().catch(() => false);
        return licenseDisplayed || sidebarDisplayed;
      },
      {
        timeout,
        timeoutMsg: 'App did not load within timeout',
      }
    );
  }

  /**
   * Reset app to initial state (license page)
   */
  static async resetToLicensePage() {
    const sidebarTitle = await $('.sidebar-title');
    const isLoggedIn = await sidebarTitle.isDisplayed().catch(() => false);

    if (isLoggedIn) {
      const logoutBtn = await $('button.nav-item*=Đăng xuất');
      await logoutBtn.click();
      await browser.pause(1000);
    }
  }

  /**
   * Check if currently on specific page
   */
  static async isOnPage(pageName) {
    switch (pageName) {
      case 'license':
        const licenseTitle = await $('h1.license-title');
        return licenseTitle.isDisplayed().catch(() => false);
      case 'main':
        const sidebarTitle = await $('.sidebar-title');
        return sidebarTitle.isDisplayed().catch(() => false);
      default:
        return false;
    }
  }
}

module.exports = TestSetup;
