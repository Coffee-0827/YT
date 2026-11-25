(function (root) {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    adFilterEnabled: true,
    autoSkipEnabled: true,
    backgroundPlayEnabled: true,
    pipEnabled: true
  });

  const STORAGE_KEY = "wme_settings_v1";

  function getExtensionRuntime() {
    if (typeof browser !== "undefined" && browser?.runtime) {
      return browser;
    }
    if (typeof chrome !== "undefined" && chrome?.runtime) {
      return chrome;
    }
    return null;
  }

  function hasExtensionStorage(api) {
    return Boolean(api && api.storage && api.storage.local);
  }

  async function getSettings() {
    const api = getExtensionRuntime();
    if (hasExtensionStorage(api)) {
      return new Promise((resolve) => {
        try {
          const maybePromise = api.storage.local.get(DEFAULT_SETTINGS, (result) => {
            resolve({ ...DEFAULT_SETTINGS, ...(result || {}) });
          });
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise
              .then((res) => resolve({ ...DEFAULT_SETTINGS, ...(res || {}) }))
              .catch(() => resolve({ ...DEFAULT_SETTINGS }));
          }
        } catch {
          resolve({ ...DEFAULT_SETTINGS });
        }
      });
    }

    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }
    return { ...DEFAULT_SETTINGS };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = { ...current, ...partial };
    const api = getExtensionRuntime();

    if (hasExtensionStorage(api)) {
      return new Promise((resolve) => {
        try {
          const maybePromise = api.storage.local.set(next, () => resolve(next));
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(() => resolve(next)).catch(() => resolve(next));
          }
        } catch {
          resolve(next);
        }
      });
    }

    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    return next;
  }

  const exported = {
    DEFAULT_SETTINGS,
    getExtensionRuntime,
    getSettings,
    saveSettings
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.browserApi = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
