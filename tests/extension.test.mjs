import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rules = require("../extension/src/rules/ad-selectors.js");
const adFilterMod = require("../extension/src/content/ad-filter.js");
const mediaEnhancerMod = require("../extension/src/content/media-enhancer.js");

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
