import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rules = require("../extension/src/rules/ad-selectors.js");
const adFilterMod = require("../extension/src/content/ad-filter.js");
const mediaEnhancerMod = require("../extension/src/content/media-enhancer.js");
const prunerMod = require("../extension/src/content/adguard-yt-pruner.js");

function createMockElement(tagName, attrs = {}) {
  const attributes = new Map(Object.entries(attrs));
  const styles = new Map();
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    textContent: "",
    id: attrs.id || "",
    offsetParent: {},
    clicked: false,
    style: {
      setProperty(k, v) {
        styles.set(k, v);
      },
      getPropertyValue(k) {
        return styles.get(k) || "";
      }
    },
    setAttribute(k, v) {
      attributes.set(k, String(v));
    },
    getAttribute(k) {
      return attributes.get(k) ?? null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {
      this.removed = true;
    },
    click() {
      this.clicked = true;
    },
    getBoundingClientRect() {
      return { width: 100, height: 30 };
    }
  };
}

test("manifest.json and content-blocker.json are valid", () => {
  const manifestRaw = fs.readFileSync(path.resolve("extension/manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.manifest_version, 3);
  assert.ok(Array.isArray(manifest.content_scripts));
  assert.equal(manifest.content_scripts[0].run_at, "document_start");

  const blockerRaw = fs.readFileSync(path.resolve("extension/rules/content-blocker.json"), "utf8");
  const blockerRules = JSON.parse(blockerRaw);
  assert.ok(Array.isArray(blockerRules) && blockerRules.length > 0);
  for (const rule of blockerRules) {
    assert.ok(rule.trigger?.["url-filter"]);
    assert.equal(rule.action?.type, "block");
  }
});

test("buildHideCss generates non-empty CSS for ad selectors", () => {
  const css = rules.buildHideCss();
  assert.ok(css.includes(".ytp-ad-module"));
  assert.ok(css.includes("display: none !important"));
  assert.equal(rules.buildHideCss([]), "");
});

test("createAdFilter injects style, hides ad elements, and clicks skip button", () => {
  const adNode = createMockElement("div", { class: "ytp-ad-module" });
  const skipBtn = createMockElement("button", { class: "ytp-ad-skip-button" });
  const head = createMockElement("head");
  const elementsById = new Map();

  const mockDoc = {
    head,
    documentElement: head,
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector.includes(".ytp-ad-module")) {
        return [adNode];
      }
      return [];
    },
    querySelector(selector) {
      if (selector === ".ytp-ad-skip-button") {
        return skipBtn;
      }
      return null;
    }
  };

  // Track inserted style by ID
  const origAppend = head.appendChild.bind(head);
  head.appendChild = (child) => {
    if (child.id) elementsById.set(child.id, child);
    return origAppend(child);
  };

  const filter = adFilterMod.createAdFilter(mockDoc, {
    adFilterEnabled: true,
    autoSkipEnabled: true
  });

  const res = filter.scanOnce();
  assert.equal(res.hiddenCount, 1);
  assert.equal(res.skipped, true);
  assert.equal(adNode.getAttribute("data-wme-hidden"), "1");
  assert.equal(adNode.style.getPropertyValue("display"), "none");
  assert.equal(skipBtn.clicked, true);
  assert.ok(elementsById.has(adFilterMod.STYLE_ELEMENT_ID));

  // Re-scanning does not double-count already hidden node
  const res2 = filter.scanOnce();
  assert.equal(res2.hiddenCount, 1);
});

test("createAdFilter hides feed cards with sponsored badge and fast-forwards .ad-showing", () => {
  const badge = createMockElement("span");
  badge.textContent = "贊助商廣告";

  const feedCard = createMockElement("ytm-rich-item-renderer");
  feedCard.querySelector = () => null;
  feedCard.querySelectorAll = () => [badge];

  const adVideo = {
    tagName: "VIDEO",
    muted: false,
    playbackRate: 1,
    currentTime: 2,
    duration: 30
  };
  const adPlayer = createMockElement("div");
  adPlayer.querySelector = (sel) => (sel === "video" ? adVideo : null);

  const mockDoc = {
    head: createMockElement("head"),
    documentElement: createMockElement("html"),
    createElement: (tag) => createMockElement(tag),
    getElementById: () => null,
    querySelectorAll(sel) {
      if (sel.includes("ytm-rich-item-renderer")) return [feedCard];
      return [];
    },
    querySelector(sel) {
      if (sel.includes(".ad-showing")) return adPlayer;
      return null;
    }
  };

  const filter = adFilterMod.createAdFilter(mockDoc, {
    adFilterEnabled: true,
    autoSkipEnabled: true
  });

  const res = filter.scanOnce();
  assert.equal(res.hiddenCount, 1);
  assert.equal(res.skipped, true);
  assert.equal(feedCard.getAttribute("data-wme-hidden"), "1");
  assert.equal(adVideo.muted, true);
  assert.equal(adVideo.playbackRate, 16);
  assert.equal(adVideo.currentTime, 29.9);
});

test("createMediaEnhancer configures MediaSession and handles visibilitychange", () => {
  let playCalled = 0;
  let paused = true;
  const listeners = new Map();

  const videoEl = {
    tagName: "VIDEO",
    get paused() {
      return paused;
    },
    currentTime: 5,
    duration: 120,
    readyState: 4,
    play() {
      playCalled += 1;
      paused = false;
      return Promise.resolve();
    },
    pause() {
      paused = true;
    }
  };

  const mockDoc = {
    title: "測試影片標題",
    hidden: false,
    visibilityState: "visible",
    querySelectorAll(selector) {
      return selector.includes("video") ? [videoEl] : [];
    },
    querySelector() {
      return null;
    },
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    }
  };

  const handlers = {};
  const mockWin = {
    location: { hostname: "example.com" },
    MediaMetadata: function (meta) {
      return meta;
    },
    navigator: {
      mediaSession: {
        metadata: null,
        setActionHandler(name, fn) {
          handlers[name] = fn;
        }
      }
    }
  };

  const enhancer = mediaEnhancerMod.createMediaEnhancer(mockWin, mockDoc, {
    backgroundPlayEnabled: true,
    pipEnabled: true
  });
  enhancer.start();

  assert.equal(mockWin.navigator.mediaSession.metadata.title, "測試影片標題");
  assert.equal(mockWin.navigator.mediaSession.metadata.artist, "example.com");
  assert.equal(typeof handlers.play, "function");
  assert.equal(typeof handlers.pause, "function");
  assert.equal(typeof handlers.seekbackward, "function");
  assert.equal(typeof handlers.seekforward, "function");

  handlers.seekforward({ seekOffset: 15 });
  assert.equal(videoEl.currentTime, 20);

  handlers.seekbackward({ seekOffset: 10 });
  assert.equal(videoEl.currentTime, 10);

  // Trigger visibilitychange while not user-paused
  listeners.get("visibilitychange")({});
  assert.equal(playCalled, 1);
});

test("pruneYouTubeObject strips player ads and feed adSlotRenderer while keeping content", () => {
  const payload = {
    videoDetails: { videoId: "abc123", title: "My Song" },
    adPlacements: [{ adPlacementRenderer: {} }],
    playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
    adSlots: [{ adSlotRenderer: {} }],
    contents: [
      { richItemRenderer: { content: { adSlotRenderer: { id: "ad1" } } } },
      { richItemRenderer: { content: { videoRenderer: { videoId: "keepMe" } } } }
    ]
  };

  const cleaned = prunerMod.pruneYouTubeObject(payload);
  assert.equal(cleaned.adPlacements, undefined);
  assert.equal(cleaned.playerAds, undefined);
  assert.equal(cleaned.adSlots, undefined);
  assert.equal(cleaned.videoDetails.videoId, "abc123");
  assert.equal(cleaned.contents.length, 1);
  assert.equal(cleaned.contents[0].richItemRenderer.content.videoRenderer.videoId, "keepMe");

  const xssiText = `)]}'\n${JSON.stringify({ adPlacements: [{}], videoDetails: { videoId: "xyz" } })}`;
  const prunedText = prunerMod.pruneJsonText(xssiText, JSON.parse);
  assert.ok(prunedText.startsWith(")]}'\n"));
  const reparsed = JSON.parse(prunedText.slice(5));
  assert.equal(reparsed.adPlacements, undefined);
  assert.equal(reparsed.videoDetails.videoId, "xyz");
});
