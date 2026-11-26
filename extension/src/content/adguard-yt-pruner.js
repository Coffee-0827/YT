(function (root) {
  "use strict";

  const AD_OBJECT_KEYS = ["adPlacements", "playerAds", "adSlots"];
  const AD_RENDERER_KEYS = [
    "adSlotRenderer",
    "promotedSparklesWebRenderer",
    "promotedVideoRenderer",
    "displayAdRenderer",
    "bannerPromoRenderer",
    "statementBannerRenderer",
    "inFeedAdLayoutRenderer"
  ];

  function isYouTubeHost(hostname) {
    return typeof hostname === "string" && /(^|\.)youtube\.com$/.test(hostname);
  }

  function isAdItem(item) {
    if (!item || typeof item !== "object") return false;
    for (const key of AD_RENDERER_KEYS) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        return true;
      }
    }
    if (item.richItemRenderer?.content) {
      return isAdItem(item.richItemRenderer.content);
    }
    if (item.itemSectionRenderer?.contents && Array.isArray(item.itemSectionRenderer.contents)) {
      const onlyAds =
        item.itemSectionRenderer.contents.length > 0 &&
        item.itemSectionRenderer.contents.every((c) => isAdItem(c));
      if (onlyAds) return true;
    }
    return false;
  }

  /**
   * Recursively strips YouTube player ad payloads and feed ad slots
   * (inspired by AdGuard's json-prune YouTube scriptlet).
   */
  function pruneYouTubeObject(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 12) {
      return obj;
    }

    if (Array.isArray(obj)) {
      const filtered = [];
      for (const entry of obj) {
        if (isAdItem(entry)) {
          continue;
        }
        filtered.push(pruneYouTubeObject(entry, depth + 1));
      }
      return filtered;
    }

    for (const adKey of AD_OBJECT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(obj, adKey)) {
        delete obj[adKey];
      }
    }

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === "object") {
        obj[key] = pruneYouTubeObject(val, depth + 1);
      }
    }

    return obj;
  }

  function installYouTubeAdPruner(win) {
    if (!win || win.__wmePrunerInstalled) return;
    if (!isYouTubeHost(win.location?.hostname)) return;
    win.__wmePrunerInstalled = true;

    // 1. Intercept JSON.parse so inline ytInitialPlayerResponse / ytInitialData are pruned
    const origParse = win.JSON?.parse;
    if (typeof origParse === "function") {
      win.JSON.parse = function (...args) {
        const parsed = origParse.apply(this, args);
        try {
          if (parsed && typeof parsed === "object") {
            if (
              parsed.adPlacements ||
              parsed.playerAds ||
              parsed.adSlots ||
              parsed.contents
            ) {
              return pruneYouTubeObject(parsed);
            }
          }
        } catch {
          // Never break page JSON parsing
        }
        return parsed;
      };
    }

    // 2. Hook ytInitialPlayerResponse & ytInitialData property assignments
    for (const propName of ["ytInitialPlayerResponse", "ytInitialData"]) {
      let internalVal = win[propName];
      if (internalVal && typeof internalVal === "object") {
        pruneYouTubeObject(internalVal);
      }
      try {
        Object.defineProperty(win, propName, {
          configurable: true,
          get() {
            return internalVal;
          },
          set(nextVal) {
            try {
              if (nextVal && typeof nextVal === "object") {
                pruneYouTubeObject(nextVal);
              }
            } catch {
              // Ignore
            }
            internalVal = nextVal;
          }
        });
      } catch {
        // Ignore if already non-configurable
      }
    }

    // 3. Intercept fetch() for /youtubei/v1/player, /next, /browse
    if (typeof win.fetch === "function") {
      const origFetch = win.fetch.bind(win);
      win.fetch = async function (input, init) {
        const response = await origFetch(input, init);
        try {
          const url = typeof input === "string" ? input : input?.url || "";
          if (/\/youtubei\/v1\/(player|next|browse|search)/.test(url)) {
            const cloned = response.clone();
            const text = await cloned.text();
            const data = origParse ? origParse(text) : JSON.parse(text);
            const cleaned = pruneYouTubeObject(data);
            return new win.Response(JSON.stringify(cleaned), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
        } catch {
          // Fall back to original response on any error
        }
        return response;
      };
    }
  }

  if (typeof root.window !== "undefined") {
    installYouTubeAdPruner(root);
  }

  const exported = {
    pruneYouTubeObject,
    installYouTubeAdPruner,
    isAdItem
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.pruner = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
