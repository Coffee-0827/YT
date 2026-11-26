(function (root) {
  "use strict";

  // ── 1. Force viewport-fit=cover so CSS env(safe-area-inset-*) variables work
  //       and the page background extends under the status bar / home indicator
  function patchViewport() {
    const existing = document.querySelector('meta[name="viewport"]');
    if (existing) {
      const content = existing.getAttribute("content") || "";
      if (!content.includes("viewport-fit")) {
        existing.setAttribute("content", content + ", viewport-fit=cover");
      }
    } else {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
      (document.head || document.documentElement).appendChild(meta);
    }
  }

  // ── 2. Inject CSS to push YouTube's own UI into safe areas so the black
  //       home-indicator gap disappears and content fills edge-to-edge
  function injectSafeAreaCSS() {
    const id = "wme-safe-area-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      /* Extend the page background to cover the home indicator area */
      html, body {
        background-color: #0f0f0f !important;
        min-height: 100dvh !important;
      }

      /* YouTube's main app shell (#app / ytd-app) must fill the full height */
      ytd-app, #app, #content, ytm-app {
        min-height: 100dvh !important;
      }

      /* Push the bottom nav bar above the home indicator line */
      ytd-mini-guide-renderer,
      ytm-pivot-bar-renderer,
      .pivot-bar-container,
      .mobile-topbar-header-sign-in-button {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
      }

      /* Remove the extra spacing YouTube adds for native apps (not needed in WebView) */
      ytd-watch-flexy[theater] #columns {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 3. Block in-feed banner/card ads aggressively
  function injectFeedAdBlockCSS() {
    const id = "wme-feed-ad-block-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      /* In-feed display / companion / masthead ads */
      ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-video-renderer,
      ytd-movie-offer-module-renderer,
      ytd-action-companion-ad-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-companion-slot-renderer,
      ytd-ad-slot-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-primetime-promo-renderer,
      ytd-watch-next-secondary-results-renderer ytd-compact-promoted-video-renderer,
      ytm-promoted-sparkles-web-renderer,
      ytm-companion-slot-renderer,
      ytm-promoted-video-renderer,
      ytm-ad-slot-renderer,
      ytm-banner-promo-renderer,
      ytm-action-companion-ad-renderer,
      /* Paid product placements notice */
      .ytp-paid-content-overlay,
      /* Masthead */
      ytd-masthead-ad,
      #masthead-ad,
      /* Thumbnail overlay ads */
      a.ytd-thumbnail-overlay-time-status-renderer[href*="/ads/"],
      /* Watch page right column ad */
      #player-ads,
      #top-row ytd-ad-slot-renderer,
      /* Music app ads */
      ytmusic-mealbar-promo-renderer,
      ytmusic-notification-action-renderer {
        display: none !important;
        height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 4. Mute + fast-forward pre-roll / mid-roll video ads in the music player
  function skipMusicPlayerAds() {
    const video = document.querySelector("video");
    if (!video) return;

    // If the ad container is active, mute and jump to end
    const adContainers = [
      ".ytp-ad-player-overlay",
      ".ad-showing",
      ".ad-interrupting",
      ".ytp-ad-action-interstitial",
    ];
    const adActive = adContainers.some((sel) => document.querySelector(sel));
    if (!adActive) return;

    if (!video.muted) video.muted = true;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }

    // Click any skip button that is now visible
    const skipSelectors = [
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      "[id*='skip']",
      "[class*='skip-ad']",
    ];
    for (const sel of skipSelectors) {
      const btn = document.querySelector(sel);
      if (btn && typeof btn.click === "function") {
        btn.click();
        break;
      }
    }
  }

  // ── Initialise ────────────────────────────────────────────────────────────
  function init() {
    patchViewport();
    injectSafeAreaCSS();
    injectFeedAdBlockCSS();

    // Poll for music-player mid-roll ads every 800 ms
    setInterval(skipMusicPlayerAds, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Also re-run after SPA navigations (YouTube is a Single Page App)
  const _pushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    _pushState(...args);
    setTimeout(init, 500);
  };
  root.addEventListener("popstate", () => setTimeout(init, 500));

})(typeof globalThis !== "undefined" ? globalThis : window);
