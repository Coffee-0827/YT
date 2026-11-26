(function (root) {
  "use strict";

  function patchViewport() {
    const existing = document.querySelector('meta[name="viewport"]');
    if (existing) {
      const content = existing.getAttribute("content") || "";
      if (!content.includes("viewport-fit=cover")) {
        existing.setAttribute(
          "content",
          content ? `${content}, viewport-fit=cover` : "width=device-width, initial-scale=1, viewport-fit=cover"
        );
      }
    } else {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
      (document.head || document.documentElement).appendChild(meta);
    }
  }

  function injectSafeAreaCSS() {
    const id = "wme-safe-area-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      html, body, ytm-app, #app {
        background-color: #0f0f0f !important;
      }

      ytm-mobile-topbar-renderer,
      #header-bar,
      ytm-pivot-bar-renderer {
        background-color: #0f0f0f !important;
      }

      /* Ensure bottom pivot bar sits cleanly above the home indicator without black gap */
      ytm-pivot-bar-renderer {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function runAdSkipPass() {
    root.__WebMediaEnhancer?.controllers?.adFilter?.scanOnce?.();
  }

  function init() {
    patchViewport();
    injectSafeAreaCSS();
    runAdSkipPass();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Fast guard for mid-roll / playlist transition ads
  setInterval(runAdSkipPass, 250);

  const _pushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    _pushState(...args);
    setTimeout(init, 250);
  };
  root.addEventListener("popstate", () => setTimeout(init, 250));
})(typeof globalThis !== "undefined" ? globalThis : window);
