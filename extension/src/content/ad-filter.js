(function (root) {
  "use strict";

  const STYLE_ELEMENT_ID = "wme-ad-filter-style";

  function getRulesModule() {
    if (root.__WebMediaEnhancer?.rules) {
      return root.__WebMediaEnhancer.rules;
    }
    if (typeof require === "function") {
      return require("../rules/ad-selectors");
    }
    throw new Error("ad-selectors module not loaded");
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (typeof el.offsetParent !== "undefined" && el.offsetParent === null) {
      return false;
    }
    if (typeof el.getBoundingClientRect === "function") {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    return true;
  }

  function hideNode(node) {
    if (!node || node.getAttribute?.("data-wme-hidden") === "1") {
      return false;
    }
    if (node.style) {
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("height", "0", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
    }
    node.setAttribute?.("data-wme-hidden", "1");
    return true;
  }

  /**
   * Creates an ad-element filter controller bound to a document instance.
   */
  function createAdFilter(doc, initialOptions = {}) {
    const rules = getRulesModule();
    let options = {
      adFilterEnabled: true,
      autoSkipEnabled: true,
      ...initialOptions
    };
    let hiddenCount = 0;
    let observer = null;
    let scheduled = false;

    function injectStyles() {
      if (!doc || !options.adFilterEnabled) return;
      if (doc.getElementById && doc.getElementById(STYLE_ELEMENT_ID)) return;

      const style = doc.createElement("style");
      style.id = STYLE_ELEMENT_ID;
      style.textContent = rules.buildHideCss(rules.AD_HIDE_SELECTORS);

      const target = doc.head || doc.documentElement;
      if (target && typeof target.appendChild === "function") {
        target.appendChild(style);
      }
    }

    function removeStyles() {
      const existing = doc?.getElementById?.(STYLE_ELEMENT_ID);
      if (existing && typeof existing.remove === "function") {
        existing.remove();
      }
    }

    function hideMatchingContainers() {
      if (!doc?.querySelectorAll || !options.adFilterEnabled) return 0;

      let newlyHidden = 0;
      const selector = rules.AD_HIDE_SELECTORS.join(",");
      const nodes = doc.querySelectorAll(selector);

      for (const node of nodes) {
        if (hideNode(node)) {
          newlyHidden += 1;
        }
      }

      // Hide entire feed card wrappers that contain ad-slot-renderer or sponsored text badges
      if (Array.isArray(rules.FEED_CARD_SELECTORS) && rules.FEED_CARD_SELECTORS.length > 0) {
        const cards = doc.querySelectorAll(rules.FEED_CARD_SELECTORS.join(","));
        for (const card of cards) {
          if (card.getAttribute?.("data-wme-hidden") === "1") continue;

          const hasAdChild = Boolean(
            card.querySelector?.("ad-slot-renderer, ytm-ad-slot-renderer, ytd-ad-slot-renderer, a[href*='googleadservices.com']")
          );
          let hasSponsoredBadge = false;
          if (!hasAdChild && card.querySelectorAll) {
            const badges = card.querySelectorAll("span, ytm-badge-supported-renderer, .badge-style-type-ad");
            for (const badge of badges) {
              const txt = (badge.textContent || "").trim();
              if (
                rules.SPONSORED_BADGE_TEXTS.includes(txt) ||
                txt.includes("贊助商廣告")
              ) {
                hasSponsoredBadge = true;
                break;
              }
            }
          }

          if ((hasAdChild || hasSponsoredBadge) && hideNode(card)) {
            newlyHidden += 1;
          }
        }
      }

      hiddenCount += newlyHidden;
      return newlyHidden;
    }

    function tryAutoSkipAndSpeedUp() {
      if (!doc?.querySelector || !options.autoSkipEnabled) return false;

      for (const skipSelector of rules.SKIP_BUTTON_SELECTORS) {
        const btn = doc.querySelector(skipSelector);
        if (btn && isElementVisible(btn) && typeof btn.click === "function") {
          btn.click();
          return true;
        }
      }

      const adContainerSelector = rules.AD_PLAYING_CONTAINER_SELECTORS.join(",");
      const adContainer = doc.querySelector(adContainerSelector);
      if (adContainer) {
        const video = adContainer.querySelector?.("video") || doc.querySelector("video");
        if (video) {
          video.muted = true;
          try {
            video.playbackRate = 16;
          } catch {
            // Ignore playbackRate clamp in restricted players
          }
          if (Number.isFinite(video.duration) && video.duration > 0.2 && video.currentTime < video.duration - 0.15) {
            video.currentTime = video.duration - 0.1;
          } else if (video.seekable && video.seekable.length > 0) {
            video.currentTime = video.seekable.end(0);
          }
          return true;
        }
      }

      return false;
    }

    function scanOnce() {
      if (!options.adFilterEnabled) {
        removeStyles();
        return { hiddenCount, skipped: false };
      }
      injectStyles();
      hideMatchingContainers();
      const skipped = tryAutoSkipAndSpeedUp();
      return { hiddenCount, skipped };
    }

    function scheduleScan() {
      if (scheduled) return;
      scheduled = true;
      const scheduleFn =
        !doc?.hidden && typeof root.requestAnimationFrame === "function"
          ? root.requestAnimationFrame
          : (fn) => setTimeout(fn, 50);

      scheduleFn(() => {
        scheduled = false;
        scanOnce();
      });
    }

    function start() {
      scanOnce();
      if (observer || typeof root.MutationObserver !== "function" || !doc?.documentElement) {
        return;
      }
      observer = new root.MutationObserver(() => {
        scheduleScan();
      });
      observer.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    function stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      removeStyles();
    }

    function updateOptions(nextOptions) {
      options = { ...options, ...nextOptions };
      if (!options.adFilterEnabled) {
        removeStyles();
      } else {
        scanOnce();
      }
    }

    return {
      start,
      stop,
      scanOnce,
      updateOptions,
      getHiddenCount: () => hiddenCount
    };
  }

  const exported = {
    STYLE_ELEMENT_ID,
    createAdFilter
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.adFilter = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
