# iOS 網頁影音增強與廣告過濾工具

專為 **Windows 11（無 Mac）+ iPhone（iOS 17+ / iOS 26.6.1）** 個人學習與自用測試設計的專案。

## 專案架構

- `extension/` — 跨瀏覽器 Manifest V3 擴充功能（同時相容 Windows Chrome/Edge 與 iOS Safari Web Extension）
  - `src/rules/ad-selectors.js` — 廣告元素 CSS 隱藏與略過按鈕規則
  - `rules/content-blocker.json` — Safari Content Blocker 網路過濾規則
  - `src/content/ad-filter.js` — `MutationObserver` 動態廣告過濾與自動略過
  - `src/content/media-enhancer.js` — `MediaSession` 鎖屏控制、子母畫面 (PiP) 與背景播放增強
  - `src/popup/` — 擴充功能開關介面
- `ios/` — iOS 原生專案（透過 XcodeGen `project.yml` 自動生成）
  - `MediaEnhancerApp/` — 內建 SwiftUI + `WKWebView` 瀏覽器，配置 `AVAudioSession` (`.playback`) 與 `MPNowPlayingInfoCenter` / `MPRemoteCommandCenter` 支援背景音訊與鎖屏控制
  - `MediaEnhancerExtension/` — 包裝 `extension/` 的 iOS Safari 擴充功能目標
- `.github/workflows/build-ios.yml` — 在 GitHub 雲端 macOS 主機自動編譯並產出 `.ipa` 檔案
- `tests/extension.test.mjs` — Node.js 單元測試

## 使用步驟

### 1. 在 Windows 11 本機測試（立即可用）
1. 執行單元測試：
   ```powershell
   npm test
   ```
2. 在 Windows Edge 或 Chrome 開啟 `edge://extensions`（或 `chrome://extensions`）。
3. 開啟右上角「開發人員模式」→ 點選「載入未封裝項目」→ 選擇本專案的 `extension` 資料夾即可直接測試過濾與控制面板。

### 2. 在沒有 Mac 的情況下編譯並安裝到 iPhone
1. 將本專案上傳（`git push`）到你自己的 GitHub 儲存庫。
2. 到 GitHub 專案頁面的 **Actions** 分頁 → 執行 **Build iOS IPA**。
3. 下載產出的 `MediaEnhancer-unsigned-ipa`（解壓取得 `MediaEnhancer-unsigned.ipa`）。
4. 在 Windows 11 使用 **Sideloadly** 或 **AltStore / SideStore** 搭配個人 Apple ID 將 `.ipa` 簽章並安裝到你的 iPhone 17 Pro Max。
5. 安裝後可直接開啟 App 內的瀏覽器使用背景播放，或到 iPhone「設定 → App → Safari → 延伸功能」開啟「影音增強器」。
