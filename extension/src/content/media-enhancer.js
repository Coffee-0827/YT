(function (root) {
  "use strict";

  const DEFAULT_SEEK_OFFSET_SECONDS = 10;

  function findPrimaryMedia(doc) {
    if (!doc?.querySelectorAll) return null;
    const mediaNodes = Array.from(doc.querySelectorAll("video, audio"));
    if (mediaNodes.length === 0) return null;

    const playing = mediaNodes.find((m) => !m.paused && !m.ended);
    if (playing) return playing;

    return mediaNodes.find((m) => m.readyState > 0 || m.currentSrc) || mediaNodes[0];
  }

  function extractPageMetadata(doc, win) {
    const title =
      doc?.querySelector?.("meta[property='og:title']")?.getAttribute?.("content") ||
      doc?.title ||
      "網頁影音播放中";
    const artist = win?.location?.hostname || "Web Media";
    const artworkUrl =
      doc?.querySelector?.("meta[property='og:image']")?.getAttribute?.("content") || "";

    return {
      title: String(title).trim(),
      artist,
      artwork: artworkUrl ? [{ src: artworkUrl }] : []
    };
  }

  /**
   * Enhances HTML5 media elements with Media Session controls, PiP helper,
   * and visibility-change playback continuity.
   */
  function createMediaEnhancer(win, doc, initialOptions = {}) {
    let options = {
      backgroundPlayEnabled: true,
      pipEnabled: true,
      ...initialOptions
    };
    let started = false;
    let userPaused = false;
    let lastActiveMedia = null;
    let visibilityPatchApplied = false;

    function notifyNativeHost(state) {
      try {
        win?.webkit?.messageHandlers?.mediaState?.postMessage?.(state);
      } catch {
        // Not running inside WKWebView native wrapper
      }
    }

    function syncMediaSession(media) {
      const nav = win?.navigator;
      if (!nav?.mediaSession || !media) return false;

      const meta = extractPageMetadata(doc, win);
      if (typeof win.MediaMetadata === "function") {
        nav.mediaSession.metadata = new win.MediaMetadata(meta);
      }

      const safeSetHandler = (action, handler) => {
        try {
          nav.mediaSession.setActionHandler(action, handler);
        } catch {
          // Action not supported on this browser version
        }
      };

      safeSetHandler("play", () => {
        userPaused = false;
        media.play?.();
      });
      safeSetHandler("pause", () => {
        userPaused = true;
        media.pause?.();
      });
      safeSetHandler("seekbackward", (details) => {
        const offset = details?.seekOffset || DEFAULT_SEEK_OFFSET_SECONDS;
        media.currentTime = Math.max(0, (media.currentTime || 0) - offset);
      });
      safeSetHandler("seekforward", (details) => {
        const offset = details?.seekOffset || DEFAULT_SEEK_OFFSET_SECONDS;
        const duration = Number.isFinite(media.duration) ? media.duration : Infinity;
        media.currentTime = Math.min(duration, (media.currentTime || 0) + offset);
      });

      notifyNativeHost({
        title: meta.title,
        artist: meta.artist,
        isPlaying: !media.paused,
        currentTime: media.currentTime || 0,
        duration: Number.isFinite(media.duration) ? media.duration : 0
      });

      return true;
    }

    function patchVisibilityApi() {
      if (visibilityPatchApplied || !doc || !options.backgroundPlayEnabled) return;
      visibilityPatchApplied = true;

      try {
        Object.defineProperty(doc, "hidden", {
          configurable: true,
          get: () => false
        });
        Object.defineProperty(doc, "visibilityState", {
          configurable: true,
          get: () => "visible"
        });
      } catch {
        // Some browsers disallow redefining document.hidden
      }
    }

    function handleVisibilityChange(event) {
      if (!options.backgroundPlayEnabled) return;

      if (doc?.hidden && event?.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }

      const media = lastActiveMedia || findPrimaryMedia(doc);
      if (!media) return;

      if (!userPaused && media.paused) {
        Promise.resolve(media.play?.()).catch(() => {
          // Playback resume may require active audio session / PiP
        });
      }
      syncMediaSession(media);
    }

    function handleMediaEvent(event) {
      const target = event?.target;
      if (!target || (target.tagName !== "VIDEO" && target.tagName !== "AUDIO")) {
        return;
      }
      lastActiveMedia = target;
      if (event.type === "play") {
        userPaused = false;
      } else if (event.type === "pause" && !doc?.hidden) {
        userPaused = true;
      }
      syncMediaSession(target);
    }

    async function requestPictureInPicture() {
      if (!options.pipEnabled) return false;
      const video = findPrimaryMedia(doc);
      if (!video || video.tagName !== "VIDEO") return false;

      if (typeof video.webkitSetPresentationMode === "function") {
        const nextMode =
          video.webkitPresentationMode === "picture-in-picture"
            ? "inline"
            : "picture-in-picture";
        video.webkitSetPresentationMode(nextMode);
        return true;
      }

      if (typeof video.requestPictureInPicture === "function") {
        if (doc.pictureInPictureElement) {
          await doc.exitPictureInPicture?.();
        } else {
          await video.requestPictureInPicture();
        }
        return true;
      }

      return false;
    }

    function start() {
      if (started || !doc) return;
      started = true;

      if (options.backgroundPlayEnabled) {
        patchVisibilityApi();
      }

      doc.addEventListener?.("visibilitychange", handleVisibilityChange, true);
      doc.addEventListener?.("play", handleMediaEvent, true);
      doc.addEventListener?.("pause", handleMediaEvent, true);
      doc.addEventListener?.("loadedmetadata", handleMediaEvent, true);

      const media = findPrimaryMedia(doc);
      if (media) {
        lastActiveMedia = media;
        syncMediaSession(media);
      }
    }

    function stop() {
      if (!started || !doc) return;
      started = false;
      doc.removeEventListener?.("visibilitychange", handleVisibilityChange, true);
      doc.removeEventListener?.("play", handleMediaEvent, true);
      doc.removeEventListener?.("pause", handleMediaEvent, true);
      doc.removeEventListener?.("loadedmetadata", handleMediaEvent, true);
    }

    function updateOptions(nextOptions) {
      options = { ...options, ...nextOptions };
      if (options.backgroundPlayEnabled) {
        patchVisibilityApi();
      }
    }

    return {
      start,
      stop,
      updateOptions,
      requestPictureInPicture,
      syncMediaSession,
      getActiveMedia: () => lastActiveMedia || findPrimaryMedia(doc)
    };
  }

  const exported = {
    createMediaEnhancer,
    findPrimaryMedia,
    extractPageMetadata
  };

  root.__WebMediaEnhancer = root.__WebMediaEnhancer || {};
  root.__WebMediaEnhancer.mediaEnhancer = exported;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
