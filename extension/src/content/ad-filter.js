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
        if (node.getAttribute && node.getAttribute("data-wme-hidden") === "1") {
          continue;
        }
        if (node.style) {
          node.style.setProperty("display", "none", "important");
        }
        if (node.setAttribute) {
          node.setAttribute("data-wme-hidden", "1");
        }
        newlyHidden += 1;
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
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
          video.muted = true;
          if (video.currentTime < video.duration - 0.1) {
            video.currentTime = video.duration;
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
        typeof root.requestAnimationFrame === "function"
          ? root.requestAnimationFrame
          : (fn) => setTimeout(fn, 16);

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
        subtree: true
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
