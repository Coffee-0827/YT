(function (root) {
  "use strict";

  const AD_HIDE_SELECTORS = Object.freeze([
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    ".ytp-ad-action-interstitial",
    "ad-slot-renderer",
    "ytd-ad-slot-renderer",
    "ytd-banner-promo-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-display-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytm-ad-slot-renderer",
    "ytm-promoted-sparkles-web-renderer",
    "ytm-promoted-video-renderer",
    "ytm-companion-slot-renderer",
    "ytm-banner-promo-renderer",
    "ytm-action-companion-ad-renderer",
    "[id^='player-ads']",
    "[class*='ad-showing'] .ytp-ad-overlay-slot"
  ]);

  const FEED_CARD_SELECTORS = Object.freeze([
    "ytm-rich-item-renderer",
    "ytm-video-with-context-renderer",
    "ytm-item-section-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer"
  ]);

  const SPONSORED_BADGE_TEXTS = Object.freeze([
    "贊助商廣告",
    "廣告",
    "Sponsored",
    "Ad"
  ]);

  const SKIP_BUTTON_SELECTORS = Object.freeze([
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-container button",
    "button[class*='skip-ad']",
    "[aria-label*='Skip Ad']",
    "[aria-label*='Skip']",
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
    return `${selectors.join(",\n")} {\n  display: none !important;\n  visibility: hidden !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  opacity: 0 !important;\n  pointer-events: none !important;\n}`;
  }

  const exported = {
    AD_HIDE_SELECTORS,
    FEED_CARD_SELECTORS,
    SPONSORED_BADGE_TEXTS,
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
