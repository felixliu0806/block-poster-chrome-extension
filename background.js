const PANEL_PATH = "sidepanel.html";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: "block-poster-pick",
    title: "Create a Block Poster from this page",
    contexts: ["page", "image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (_info, tab) => {
  if (!tab?.id || !tab.windowId) return;
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: PANEL_PATH,
    enabled: true,
  });
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active browser tab was found.");
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error("Chrome does not allow extensions to capture this page.");
  }
  return tab;
}

async function ensureCaptureScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();
  await ensureCaptureScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, { type });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return false;

  (async () => {
    switch (message.type) {
      case "START_IMAGE_PICK":
        return sendToActiveTab("START_IMAGE_PICK");
      case "START_REGION_CAPTURE":
        return sendToActiveTab("START_REGION_CAPTURE");
      case "SCAN_PAGE_IMAGES":
        return sendToActiveTab("SCAN_PAGE_IMAGES");
      case "CAPTURE_VISIBLE_TAB": {
        const tab = await getActiveTab();
        return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      }
      case "OPEN_TAB": {
        if (!message.url) throw new Error("A URL is required.");
        await chrome.tabs.create({ url: message.url });
        return true;
      }
      default:
        return undefined;
    }
  })()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );

  return true;
});
