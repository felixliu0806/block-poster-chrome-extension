(() => {
  if (globalThis.__blockPosterCaptureInstalled) return;
  globalThis.__blockPosterCaptureInstalled = true;

  let cleanupCurrentMode = null;

  function resetMode() {
    cleanupCurrentMode?.();
    cleanupCurrentMode = null;
  }

  function pageMetrics() {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  function getBackgroundUrl(element) {
    const value = getComputedStyle(element).backgroundImage;
    const match = value?.match(/^url\(["']?(.*?)["']?\)$/);
    return match?.[1] || "";
  }

  function getImageTarget(node) {
    if (!(node instanceof Element)) return null;
    const image = node.closest("img");
    if (image) {
      return {
        element: image,
        src: image.currentSrc || image.src,
        name: image.alt || "web-image",
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    }

    let element = node;
    for (let depth = 0; element && depth < 4; depth += 1) {
      const src = getBackgroundUrl(element);
      if (src) {
        return {
          element,
          src,
          name: element.getAttribute("aria-label") || "background-image",
          naturalWidth: 0,
          naturalHeight: 0,
        };
      }
      element = element.parentElement;
    }
    return null;
  }

  function startImagePick() {
    resetMode();
    const outline = document.createElement("div");
    const hint = document.createElement("div");
    outline.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #6558f5;background:rgba(101,88,245,.12);border-radius:8px;display:none;box-sizing:border-box";
    hint.textContent = "Click an image · Esc to cancel";
    hint.style.cssText =
      "position:fixed;z-index:2147483647;left:50%;top:18px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#17171b;color:white;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none";
    document.documentElement.append(outline, hint);

    let current = null;
    const move = (event) => {
      current = getImageTarget(event.target);
      if (!current?.src) {
        outline.style.display = "none";
        return;
      }
      const rect = current.element.getBoundingClientRect();
      outline.style.display = "block";
      outline.style.left = `${rect.left}px`;
      outline.style.top = `${rect.top}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
    };
    const click = (event) => {
      if (!current?.src) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = current.element.getBoundingClientRect();
      chrome.runtime.sendMessage({
        type: "PAGE_IMAGE_PICKED",
        sourceUrl: current.src,
        name: current.name,
        naturalWidth: current.naturalWidth,
        naturalHeight: current.naturalHeight,
        rect: {
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          width: Math.min(
            window.innerWidth - Math.max(0, rect.left),
            rect.width,
          ),
          height: Math.min(
            window.innerHeight - Math.max(0, rect.top),
            rect.height,
          ),
        },
        ...pageMetrics(),
      });
      resetMode();
    };
    const keydown = (event) => {
      if (event.key === "Escape") resetMode();
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keydown, true);
    cleanupCurrentMode = () => {
      outline.remove();
      hint.remove();
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
    };
    return { started: true };
  }

  function startRegionCapture() {
    resetMode();
    const overlay = document.createElement("div");
    const selection = document.createElement("div");
    const hint = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483645;background:rgba(16,16,20,.2);cursor:crosshair";
    selection.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #6558f5;background:rgba(101,88,245,.12);display:none;box-sizing:border-box";
    hint.textContent = "Drag to capture · Esc to cancel";
    hint.style.cssText =
      "position:fixed;z-index:2147483647;left:50%;top:18px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#17171b;color:white;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none";
    document.documentElement.append(overlay, selection, hint);

    let start = null;
    let rect = null;
    const setRect = (x, y) => {
      const left = Math.min(start.x, x);
      const top = Math.min(start.y, y);
      rect = {
        left,
        top,
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y),
      };
      selection.style.display = "block";
      selection.style.left = `${left}px`;
      selection.style.top = `${top}px`;
      selection.style.width = `${rect.width}px`;
      selection.style.height = `${rect.height}px`;
    };
    const down = (event) => {
      start = { x: event.clientX, y: event.clientY };
      setRect(event.clientX, event.clientY);
    };
    const move = (event) => {
      if (start) setRect(event.clientX, event.clientY);
    };
    const up = (event) => {
      if (!start) return;
      setRect(event.clientX, event.clientY);
      if (rect.width >= 10 && rect.height >= 10) {
        chrome.runtime.sendMessage({
          type: "PAGE_REGION_PICKED",
          name: "screen-capture",
          rect,
          ...pageMetrics(),
        });
      }
      resetMode();
    };
    const keydown = (event) => {
      if (event.key === "Escape") resetMode();
    };
    overlay.addEventListener("pointerdown", down, true);
    overlay.addEventListener("pointermove", move, true);
    overlay.addEventListener("pointerup", up, true);
    document.addEventListener("keydown", keydown, true);
    cleanupCurrentMode = () => {
      overlay.remove();
      selection.remove();
      hint.remove();
      document.removeEventListener("keydown", keydown, true);
    };
    return { started: true };
  }

  function captureContextImage(srcUrl) {
    const image = [...document.images].find(
      (candidate) =>
        candidate.currentSrc === srcUrl || candidate.src === srcUrl,
    );
    if (!image) {
      throw new Error("The selected image is no longer visible on this page.");
    }
    const rect = image.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      throw new Error("The selected image is not currently visible.");
    }
    return {
      type: "PAGE_IMAGE_PICKED",
      sourceUrl: image.currentSrc || image.src,
      name: image.alt || "web-image",
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      rect: {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        width: Math.min(
          window.innerWidth - Math.max(0, rect.left),
          rect.width,
        ),
        height: Math.min(
          window.innerHeight - Math.max(0, rect.top),
          rect.height,
        ),
      },
      ...pageMetrics(),
    };
  }

  function scanPageImages() {
    const seen = new Set();
    const images = [];
    for (const image of document.images) {
      const src = image.currentSrc || image.src;
      if (!src || seen.has(src)) continue;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width < 180 || height < 180 || width * height < 60000) continue;
      seen.add(src);
      images.push({
        src,
        name: image.alt || `image-${images.length + 1}`,
        width,
        height,
      });
      if (images.length >= 100) break;
    }

    if (images.length < 100) {
      const elements = document.querySelectorAll("body *");
      for (let index = 0; index < Math.min(elements.length, 2000); index += 1) {
        const element = elements[index];
        const src = getBackgroundUrl(element);
        if (!src || seen.has(src)) continue;
        const rect = element.getBoundingClientRect();
        if (
          rect.width < 180 ||
          rect.height < 180 ||
          rect.width * rect.height < 60000
        ) {
          continue;
        }
        seen.add(src);
        images.push({
          src,
          name:
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            `background-${images.length + 1}`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
        if (images.length >= 100) break;
      }
    }
    return { images, pageTitle: document.title, pageUrl: location.href };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "START_IMAGE_PICK") sendResponse(startImagePick());
    else if (message?.type === "START_REGION_CAPTURE")
      sendResponse(startRegionCapture());
    else if (message?.type === "SCAN_PAGE_IMAGES")
      sendResponse(scanPageImages());
    else if (message?.type === "CAPTURE_CONTEXT_IMAGE") {
      try {
        sendResponse(captureContextImage(message.srcUrl));
      } catch (error) {
        sendResponse({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
})();
