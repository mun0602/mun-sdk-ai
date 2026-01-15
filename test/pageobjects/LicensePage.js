const BasePage = require('./BasePage');

/**
 * License Page Object
 */
class LicensePage extends BasePage {
  // Selectors
  get titleElement() { return $('h1.license-title'); }
  get licenseInput() { return $('input[placeholder="Nhập license key..."]'); }
  get activateButton() { return $('button*=Kích hoạt License'); }
  get errorBadge() { return $('.badge-error'); }

  async isDisplayed() {
    try {
      return await (await this.titleElement).isDisplayed();
    } catch {
      return false;
    }
  }

  async enterLicenseKey(key) {
    await (await this.licenseInput).setValue(key);
  }

  async clickActivate() {
    await (await this.activateButton).click();
  }

  async hasError() {
    try {
      return await (await this.errorBadge).isDisplayed();
    } catch {
      return false;
    }
  }
}

module.exports = new LicensePage();
