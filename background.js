const PAGE_ACCESS_HELP =
  "Click the Block Poster icon in the browser toolbar once to enable access to this page, then try again.";
const UNSUPPORTED_PAGE_HELP =
  "Block Poster cannot capture Chrome settings or Chrome Web Store pages. Open a regular website and reopen the extension.";

// Handle toolbar clicks ourselves. Chrome's built-in side-panel action can open
// the UI without granting activeTab, while chrome.action.onClicked does grant it.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "block-poster-pick",
    title: "Create a Block Poster",
    contexts: ["page", "image", "link", "selection"],
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId == null) return;
  // Call open() directly inside the click handler so Chrome preserves the
  // user gesture and grants temporary access to the active tab.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined);
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
    throw new Error(UNSUPPORTED_PAGE_HELP);
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

function capturePositions(start, size, viewportSize, maximumScroll) {
  const end = start + size;
  const positions = [Math.max(0, Math.min(start, maximumScroll))];
  while (
    positions[positions.length - 1] + viewportSize < end &&
    positions.length < 20
  ) {
    const current = positions[positions.length - 1];
    const next = Math.max(
      0,
      Math.min(current + viewportSize, end - viewportSize, maximumScroll),
    );
    if (next <= current) break;
    positions.push(next);
  }
  return positions;
}

async function scrollTab(tabId, left, top) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (x, y) => {
      window.scrollTo(x, y);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      return {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    },
    args: [left, top],
  });
  return result.result;
}

async function capturePageRegion(tab, capture) {
  const initialPosition = await scrollTab(
    tab.id,
    capture.scrollX,
    capture.scrollY,
  );
  const maximumScrollX = Math.max(
    0,
    capture.documentWidth - capture.viewportWidth,
  );
  const maximumScrollY = Math.max(
    0,
    capture.documentHeight - capture.viewportHeight,
  );
  const xPositions = capturePositions(
    capture.rect.left,
    capture.rect.width,
    capture.viewportWidth,
    maximumScrollX,
  );
  const yPositions = capturePositions(
    capture.rect.top,
    capture.rect.height,
    capture.viewportHeight,
    maximumScrollY,
  );
  if (xPositions.length * yPositions.length > 20) {
    throw new Error(
      "This capture area is too large. Select a smaller area and try again.",
    );
  }

  const captures = [];
  try {
    for (const top of yPositions) {
      for (const left of xPositions) {
        const position = await scrollTab(tab.id, left, top);
        if (captures.length) {
          await new Promise((resolve) => setTimeout(resolve, 550));
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });
        captures.push({ ...position, dataUrl });
      }
    }
  } finally {
    await scrollTab(
      tab.id,
      initialPosition.scrollX,
      initialPosition.scrollY,
    ).catch(() => undefined);
  }
  return captures;
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
      case "CAPTURE_PAGE_REGION": {
        const tab = await getActiveTab();
        if (message.tabId && tab.id !== message.tabId) {
          throw new Error(
            "This is a different tab. Return to the page where you selected the area, or start again from this tab.",
          );
        }
        return capturePageRegion(tab, message.capture);
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
