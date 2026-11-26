(function (root) {
  "use strict";

  const AD_OBJECT_KEYS = ["adPlacements", "playerAds", "adSlots"];
  const AD_RENDERER_KEYS = [
    "adSlotRenderer",
    "promotedSparklesWebRenderer",
    "promotedSparklesTextSearchRenderer",
    "promotedVideoRenderer",
    "displayAdRenderer",
    "bannerPromoRenderer",
    "statementBannerRenderer",
    "inFeedAdLayoutRenderer"
  ];
  const YOUTUBE_API_RE = /\/youtubei\/v1\/(player|next|browse|search|reel)/;

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
    if (item.richSectionRenderer?.content) {
      return isAdItem(item.richSectionRenderer.content);
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
  function pruneYouTubeObject(obj, depth = 0, seen = new WeakSet()) {
    if (!obj || typeof obj !== "object" || depth > 28) {
      return obj;
    }
    if (seen.has(obj)) {
      return obj;
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      const filtered = [];
      for (const entry of obj) {
        if (isAdItem(entry)) {
          continue;
        }
        filtered.push(pruneYouTubeObject(entry, depth + 1, seen));
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
        obj[key] = pruneYouTubeObject(val, depth + 1, seen);
      }
    }

    return obj;
  }

  function pruneJsonText(text, parseFn) {
    if (typeof text !== "string" || text.length === 0) return text;
    let prefix = "";
    let body = text;
    if (body.startsWith(")]}'")) {
      const nlIdx = body.indexOf("\n");
      if (nlIdx !== -1) {
        prefix = body.slice(0, nlIdx + 1);
        body = body.slice(nlIdx + 1);
      }
    }
    const parsed = parseFn(body);
    const cleaned = pruneYouTubeObject(parsed);
    return prefix + JSON.stringify(cleaned);
  }

  function installYouTubeAdPruner(win) {
    if (!win || win.__wmePrunerInstalled) return;
    if (!isYouTubeHost(win.location?.hostname)) return;
    win.__wmePrunerInstalled = true;

    const origParse = win.JSON?.parse;

    // 1. Intercept JSON.parse so inline ytInitialPlayerResponse / ytInitialData are pruned
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

    // 3. Intercept fetch() for /youtubei/v1/player, /next, /browse, /search
    if (typeof win.fetch === "function") {
      const origFetch = win.fetch.bind(win);
      win.fetch = async function (input, init) {
        const response = await origFetch(input, init);
        try {
          const url = typeof input === "string" ? input : input?.url || "";
          if (YOUTUBE_API_RE.test(url) && response.status !== 204) {
            const cloned = response.clone();
            const text = await cloned.text();
            const cleanedText = pruneJsonText(text, origParse || JSON.parse);
            const headers = new win.Headers(response.headers);
            headers.delete("content-length");
            headers.delete("content-encoding");
            return new win.Response(cleanedText, {
              status: response.status,
              statusText: response.statusText,
              headers
            });
          }
        } catch {
          // Fall back to original response on any error
        }
        return response;
      };
    }

    // 4. Intercept XMLHttpRequest for YouTube mobile SPA requests
    if (typeof win.XMLHttpRequest === "function") {
      const XHR = win.XMLHttpRequest;
      const origOpen = XHR.prototype.open;
      const origSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url, ...rest) {
        this.__wmeUrl = typeof url === "string" ? url : String(url || "");
        return origOpen.call(this, method, url, ...rest);
      };

      XHR.prototype.send = function (...args) {
        if (this.__wmeUrl && YOUTUBE_API_RE.test(this.__wmeUrl)) {
          this.addEventListener("readystatechange", () => {
            if (this.readyState !== 4) return;
            try {
              if (typeof this.responseText === "string" && this.responseText.length > 0) {
                const cleanedText = pruneJsonText(this.responseText, origParse || JSON.parse);
                Object.defineProperty(this, "responseText", {
                  configurable: true,
                  get: () => cleanedText
                });
                Object.defineProperty(this, "response", {
                  configurable: true,
                  get: () =>
                    this.responseType === "json"
                      ? (origParse || JSON.parse)(cleanedText)
                      : cleanedText
                });
              }
            } catch {
              // Ignore XHR override failure
            }
          });
        }
        return origSend.apply(this, args);
      };
    }
  }

  if (typeof root.window !== "undefined") {
    installYouTubeAdPruner(root);
  }

  const exported = {
    pruneYouTubeObject,
    pruneJsonText,
    installYouTubeAdPruner,
    isAdItem
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.pruner = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
