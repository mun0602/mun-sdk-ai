/**
 * Centralized timeout configuration for tests
 * Adjust based on environment (CI is slower)
 */
const isCI = process.env.CI === 'true';
const multiplier = isCI ? 2 : 1;

module.exports = {
  // App initialization
  APP_LOAD: 2000 * multiplier,

  // UI interactions
  NAVIGATION: 500 * multiplier,
  MODAL_TRANSITION: 300 * multiplier,
  THEME_CHANGE: 300 * multiplier,

  // User actions
  BUTTON_CLICK: 500 * multiplier,
  FORM_SUBMIT: 1000 * multiplier,

  // Element waits
  ELEMENT_DISPLAY: 5000 * multiplier,
  PAGE_LOAD: 10000 * multiplier,
};
