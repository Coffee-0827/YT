(function (root) {
  "use strict";

  const ns = root.__WebMediaEnhancer;
  if (!ns || !ns.browserApi || !ns.adFilter || !ns.mediaEnhancer) {
    return;
  }

  if (root.__WebMediaEnhancerInitialized) {
    return;
  }
  root.__WebMediaEnhancerInitialized = true;

  let adFilterController = null;
  let mediaEnhancerController = null;

  async function init() {
    const settings = await ns.browserApi.getSettings();

    adFilterController = ns.adFilter.createAdFilter(document, settings);
    mediaEnhancerController = ns.mediaEnhancer.createMediaEnhancer(window, document, settings);

    adFilterController.start();
    mediaEnhancerController.start();

    ns.controllers = {
      adFilter: adFilterController,
      mediaEnhancer: mediaEnhancerController
    };
  }

  const runtime = ns.browserApi.getExtensionRuntime();
  if (runtime?.runtime?.onMessage) {
    runtime.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== "object") return false;

      if (message.type === "GET_STATUS") {
        sendResponse({
          hiddenCount: adFilterController?.getHiddenCount?.() || 0,
          hasActiveMedia: Boolean(mediaEnhancerController?.getActiveMedia?.())
        });
        return false;
      }

      if (message.type === "UPDATE_SETTINGS" && message.settings) {
        adFilterController?.updateOptions(message.settings);
        mediaEnhancerController?.updateOptions(message.settings);
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === "TRIGGER_PIP") {
        Promise.resolve(mediaEnhancerController?.requestPictureInPicture?.())
          .then((ok) => sendResponse({ ok: Boolean(ok) }))
          .catch(() => sendResponse({ ok: false }));
        return true;
      }

      return false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
