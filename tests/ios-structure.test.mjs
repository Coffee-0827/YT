import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("iOS project.yml references existing Swift, plist, and extension files", () => {
  const requiredFiles = [
    "ios/project.yml",
    "ios/MediaEnhancerApp/Info.plist",
    "ios/MediaEnhancerApp/MediaEnhancerApp.swift",
    "ios/MediaEnhancerApp/Audio/AudioSessionManager.swift",
    "ios/MediaEnhancerApp/Audio/NowPlayingManager.swift",
    "ios/MediaEnhancerApp/WebView/WebPlayerViewModel.swift",
    "ios/MediaEnhancerApp/WebView/WebPlayerView.swift",
    "ios/MediaEnhancerApp/Views/ContentView.swift",
    "ios/MediaEnhancerExtension/Info.plist",
    "ios/MediaEnhancerExtension/SafariWebExtensionHandler.swift",
    ".github/workflows/build-ios.yml"
  ];

  for (const relPath of requiredFiles) {
    assert.ok(fs.existsSync(path.resolve(relPath)), `Missing expected file: ${relPath}`);
  }

  const appPlist = fs.readFileSync(path.resolve("ios/MediaEnhancerApp/Info.plist"), "utf8");
  assert.ok(appPlist.includes("<key>UIBackgroundModes</key>"));
  assert.ok(appPlist.includes("<string>audio</string>"));

  const extPlist = fs.readFileSync(path.resolve("ios/MediaEnhancerExtension/Info.plist"), "utf8");
  assert.ok(extPlist.includes("com.apple.Safari.web-extension"));

  const projectYml = fs.readFileSync(path.resolve("ios/project.yml"), "utf8");
  assert.ok(projectYml.includes("../extension/manifest.json"));
  assert.ok(projectYml.includes("AVFoundation.framework"));
  assert.ok(projectYml.includes("MediaPlayer.framework"));
});
