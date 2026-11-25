(function (root) {
  "use strict";

  const api =
    typeof browser !== "undefined" && browser?.runtime
      ? browser
      : typeof chrome !== "undefined" && chrome?.runtime
        ? chrome
        : null;

  if (!api?.runtime?.onInstalled) return;

  api.runtime.onInstalled.addListener(() => {
    if (api.storage?.local) {
      api.storage.local.get(
        {
          adFilterEnabled: true,
          autoSkipEnabled: true,
          backgroundPlayEnabled: true,
          pipEnabled: true
        },
        (current) => {
          api.storage.local.set(current);
        }
      );
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
