(function (root) {
  "use strict";

  const AD_HIDE_SELECTORS = Object.freeze([
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-action-interstitial",
    "ytd-ad-slot-renderer",
    "ytd-banner-promo-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-display-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytm-promoted-sparkles-web-renderer",
    "ytm-companion-slot-renderer",
    "[id^='player-ads']",
    "[class*='ad-showing'] .ytp-ad-overlay-slot"
  ]);

  const SKIP_BUTTON_SELECTORS = Object.freeze([
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    "button[class*='skip-ad']",
    "[aria-label*='Skip Ad']",
    "[aria-label*='略過廣告']"
  ]);

  const AD_PLAYING_CONTAINER_SELECTORS = Object.freeze([
    ".ad-showing",
    ".ad-interrupting"
  ]);

  function buildHideCss(selectors = AD_HIDE_SELECTORS) {
    if (!Array.isArray(selectors) || selectors.length === 0) {
      return "";
    }
    return `${selectors.join(",\n")} {\n  display: none !important;\n  visibility: hidden !important;\n  opacity: 0 !important;\n  pointer-events: none !important;\n}`;
  }

  const exported = {
    AD_HIDE_SELECTORS,
    SKIP_BUTTON_SELECTORS,
    AD_PLAYING_CONTAINER_SELECTORS,
    buildHideCss
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.rules = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
