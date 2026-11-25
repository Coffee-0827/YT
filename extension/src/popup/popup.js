(function () {
  "use strict";

  const { browserApi } = window.__WebMediaEnhancer;
  const api = browserApi.getExtensionRuntime();

  const toggleIds = ["adFilterEnabled", "autoSkipEnabled", "backgroundPlayEnabled"];
  const hiddenCountEl = document.getElementById("hiddenCount");
  const pipButton = document.getElementById("pipButton");
  const feedbackEl = document.getElementById("feedback");

  function setFeedback(text) {
    feedbackEl.textContent = text;
  }

  function queryActiveTab(callback) {
    if (!api?.tabs?.query) return;
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      callback(tabs?.[0] || null);
    });
  }

  function sendTabMessage(tabId, payload, onResponse) {
    if (!api?.tabs?.sendMessage || !tabId) return;
    try {
      api.tabs.sendMessage(tabId, payload, (response) => {
        if (api.runtime?.lastError) {
          onResponse?.(null);
          return;
        }
        onResponse?.(response);
      });
    } catch {
      onResponse?.(null);
    }
  }

  async function initPopup() {
    const settings = await browserApi.getSettings();

    for (const id of toggleIds) {
      const checkbox = document.getElementById(id);
      checkbox.checked = Boolean(settings[id]);
      checkbox.addEventListener("change", async () => {
        const updated = await browserApi.saveSettings({ [id]: checkbox.checked });
        queryActiveTab((tab) => {
          sendTabMessage(tab?.id, { type: "UPDATE_SETTINGS", settings: updated });
        });
        setFeedback("設定已更新");
      });
    }

    queryActiveTab((tab) => {
      sendTabMessage(tab?.id, { type: "GET_STATUS" }, (res) => {
        if (res && typeof res.hiddenCount === "number") {
          hiddenCountEl.textContent = String(res.hiddenCount);
        }
      });
    });

    pipButton.addEventListener("click", () => {
      queryActiveTab((tab) => {
        sendTabMessage(tab?.id, { type: "TRIGGER_PIP" }, (res) => {
          setFeedback(res?.ok ? "已切換子母畫面" : "目前頁面未偵測到可切換的影片");
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initPopup);
})();
