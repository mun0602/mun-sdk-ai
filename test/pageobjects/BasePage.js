/**
 * Base Page Object - Common methods for all pages
 */
class BasePage {
  /**
   * Wait for element and return it
   */
  async waitForElement(selector, timeout = 5000) {
    const element = await $(selector);
    await element.waitForDisplayed({ timeout });
    return element;
  }

  /**
   * Click element and wait
   */
  async clickAndWait(selector, waitMs = 500) {
    const element = await this.waitForElement(selector);
    await element.click();
    await browser.pause(waitMs);
  }

  /**
   * Get text from element
   */
  async getElementText(selector) {
    const element = await this.waitForElement(selector);
    return element.getText();
  }

  /**
   * Smart wait
   */
  async smartPause(ms = 300) {
    await browser.pause(ms);
  }
}

module.exports = BasePage;
