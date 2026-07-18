const PAGE_ACCESS_HELP =
  "Access needed. Keep this website tab active, click the Block Poster toolbar icon, then try again. Or right-click the page and choose ‘Create a Block Poster’. Chrome settings and Web Store pages cannot be captured.";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: "block-poster-pick",
    title: "Create a Block Poster",
    contexts: ["page", "image", "link", "selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.id == null || tab.windowId == null) return;
  const action = {
    id: crypto.randomUUID(),
    tabId: tab.id,
    kind: info.mediaType === "image" && info.srcUrl ? "image" : "page",
    srcUrl: info.srcUrl || null,
    createdAt: Date.now(),
  };

  // Chrome only permits sidePanel.open() during the original user gesture.
  // Start it before awaiting storage or any other asynchronous work.
  const storeAction = chrome.storage.session.set({
    pendingContextAction: action,
  });
  const openPanel = chrome.sidePanel.open({ windowId: tab.windowId });

  await Promise.all([storeAction, openPanel]);
  await chrome.runtime
    .sendMessage({
      type: "CONTEXT_ACTION_AVAILABLE",
      actionId: action.id,
    })
    .catch(() => undefined);
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active browser tab was found.");
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error(PAGE_ACCESS_HELP);
  }
  return tab;
}

async function ensureCaptureScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /cannot access|missing host permission|permission|extensions gallery/i.test(
        message,
      )
    ) {
      throw new Error(PAGE_ACCESS_HELP);
    }
    throw error;
  }
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();
  await ensureCaptureScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, { type });
}

async function sendToTab(tabId, type, payload = {}) {
  const tab = await getActiveTab();
  if (tab.id !== tabId) {
    throw new Error(
      "This is a different tab. Return to the page where you opened Block Poster, or click the Block Poster toolbar icon on this tab.",
    );
  }
  await ensureCaptureScript(tabId);
  const result = await chrome.tabs.sendMessage(tabId, { type, ...payload });
  return { ...result, tabId };
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
      case "CAPTURE_CONTEXT_IMAGE":
        if (!Number.isInteger(message.tabId) || !message.srcUrl) {
          throw new Error("The selected page image is no longer available.");
        }
        return sendToTab(message.tabId, "CAPTURE_CONTEXT_IMAGE", {
          srcUrl: message.srcUrl,
        });
      case "CAPTURE_VISIBLE_TAB": {
        const tab = await getActiveTab();
        if (message.tabId && tab.id !== message.tabId) {
          throw new Error(
            "This is a different tab. Return to the page where you selected the image, or start again from this tab.",
          );
        }
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
