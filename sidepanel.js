const APP_ORIGIN = "https://blockposter.pro";
const MM_TO_PT = 72 / 25.4;
const PAPERS = {
  a4: { label: "A4", widthMm: 210, heightMm: 297 },
  letter: { label: "US Letter", widthMm: 215.9, heightMm: 279.4 },
  a3: { label: "A3", widthMm: 297, heightMm: 420 },
  legal: { label: "Legal", widthMm: 215.9, heightMm: 355.6 },
  tabloid: { label: "Tabloid", widthMm: 279.4, heightMm: 431.8 },
  a2: { label: "A2", widthMm: 420, heightMm: 594 },
};

const state = {
  source: null,
  authToken: null,
  entitlement: {
    plan: "free",
    removeWatermark: false,
    unlimitedExports: false,
    singleExportCredits: 0,
  },
  scanImages: [],
  scanSelected: new Set(),
  toastTimer: null,
  initialized: false,
};

const elements = Object.fromEntries(
  [
    "accountButton",
    "accountMenu",
    "refreshAccountButton",
    "disconnectButton",
    "pickImageButton",
    "captureButton",
    "uploadButton",
    "pasteButton",
    "fileInput",
    "emptyState",
    "previewCard",
    "sourcePreview",
    "sourceName",
    "sourceSize",
    "clearButton",
    "settingsSection",
    "exportSection",
    "paperSelect",
    "orientationSelect",
    "pagesWideInput",
    "pagesWideValue",
    "marginInput",
    "overlapInput",
    "layoutSummary",
    "cutMarksInput",
    "freeExportButton",
    "cleanExportButton",
    "scanButton",
    "scanResults",
    "toast",
  ].map((id) => [id, document.getElementById(id)]),
);

function showToast(message, error = false) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.remove("hidden");
  state.toastTimer = setTimeout(
    () => elements.toast.classList.add("hidden"),
    error ? 8000 : 4200,
  );
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(response?.error || "The browser action failed.");
  return response.data;
}

function safeFilename(value) {
  return (
    (value || "block-poster")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "block-poster"
  );
}

function getPaperSize() {
  const paper = PAPERS[elements.paperSelect.value];
  const portrait = elements.orientationSelect.value === "portrait";
  const widthMm = portrait
    ? Math.min(paper.widthMm, paper.heightMm)
    : Math.max(paper.widthMm, paper.heightMm);
  const heightMm = portrait
    ? Math.max(paper.widthMm, paper.heightMm)
    : Math.min(paper.widthMm, paper.heightMm);
  return {
    widthMm,
    heightMm,
    widthPt: widthMm * MM_TO_PT,
    heightPt: heightMm * MM_TO_PT,
  };
}

function getLayout(source = state.source) {
  const paper = getPaperSize();
  const pagesWide = Number(elements.pagesWideInput.value);
  const marginMm = Math.max(0, Number(elements.marginInput.value) || 0);
  const overlapMm = Math.max(0, Number(elements.overlapInput.value) || 0);
  const printableWidthMm = Math.max(20, paper.widthMm - marginMm * 2);
  const printableHeightMm = Math.max(20, paper.heightMm - marginMm * 2);
  const stepX = Math.max(10, printableWidthMm - overlapMm);
  const stepY = Math.max(10, printableHeightMm - overlapMm);
  const posterWidthMm =
    pagesWide * printableWidthMm - Math.max(0, pagesWide - 1) * overlapMm;
  const ratio = source ? source.height / source.width : 1;
  const containHeightMm = posterWidthMm * ratio;
  const pagesHigh = Math.max(
    1,
    Math.ceil((containHeightMm - printableHeightMm) / stepY) + 1,
  );
  return {
    paper,
    pagesWide,
    pagesHigh,
    totalPages: pagesWide * pagesHigh,
    marginMm,
    overlapMm,
    printableWidthMm,
    printableHeightMm,
    stepX,
    stepY,
  };
}

function updateLayoutSummary() {
  const layout = getLayout();
  elements.pagesWideValue.textContent = String(layout.pagesWide);
  if (!state.source && state.scanSelected.size > 0) {
    const count = state.scanSelected.size;
    elements.layoutSummary.textContent =
      `${count} poster${count === 1 ? "" : "s"} · height varies by image`;
    return;
  }
  elements.layoutSummary.textContent = `${layout.pagesWide} × ${layout.pagesHigh} · ${layout.totalPages} sheets`;
}

function revokeSource(source) {
  if (source?.objectUrl) URL.revokeObjectURL(source.objectUrl);
}

function updateEditorAvailability() {
  const hasSingleSource = Boolean(state.source);
  const hasBatchSelection = state.scanSelected.size > 0;
  elements.settingsSection.classList.toggle(
    "disabled-section",
    !hasSingleSource && !hasBatchSelection,
  );
  elements.exportSection.classList.toggle(
    "disabled-section",
    !hasSingleSource,
  );
}

async function imageDimensions(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}

async function setSource(src, name, objectUrl = false) {
  const dimensions = await imageDimensions(src);
  revokeSource(state.source);
  state.source = {
    src,
    objectUrl: objectUrl ? src : null,
    name: name || "web-image.png",
    ...dimensions,
  };
  elements.sourcePreview.src = src;
  elements.sourceName.textContent = state.source.name;
  elements.sourceSize.textContent = `${dimensions.width} × ${dimensions.height}px`;
  elements.emptyState.classList.add("hidden");
  elements.previewCard.classList.remove("hidden");
  updateEditorAvailability();
  updateLayoutSummary();
}

function clearSource() {
  revokeSource(state.source);
  state.source = null;
  elements.sourcePreview.removeAttribute("src");
  elements.previewCard.classList.add("hidden");
  elements.emptyState.classList.remove("hidden");
  updateEditorAvailability();
  updateLayoutSummary();
}

async function cropCapture(dataUrl, capture) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scaleX = image.naturalWidth / capture.viewportWidth;
  const scaleY = image.naturalHeight / capture.viewportHeight;
  const sx = Math.max(0, Math.round(capture.rect.left * scaleX));
  const sy = Math.max(0, Math.round(capture.rect.top * scaleY));
  const sw = Math.min(
    image.naturalWidth - sx,
    Math.max(1, Math.round(capture.rect.width * scaleX)),
  );
  const sh = Math.min(
    image.naturalHeight - sy,
    Math.max(1, Math.round(capture.rect.height * scaleY)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Unable to create the selected image.");
  const objectUrl = URL.createObjectURL(blob);
  await setSource(objectUrl, `${safeFilename(capture.name)}.png`, true);
}

async function handlePageCapture(message) {
  try {
    if (message.error) throw new Error(message.error);
    const screenshot = await sendMessage({
      type: "CAPTURE_VISIBLE_TAB",
      tabId: message.tabId,
    });
    await cropCapture(screenshot, message);
    showToast(
      message.type === "PAGE_IMAGE_PICKED"
        ? "Image added from the page."
        : "Screen area captured.",
    );
  } catch (error) {
    showToast(error.message || "Capture failed.", true);
  }
}

function readFile(file) {
  if (!file?.type.startsWith("image/"))
    throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
  const objectUrl = URL.createObjectURL(file);
  return setSource(objectUrl, file.name, true).catch((error) => {
    URL.revokeObjectURL(objectUrl);
    throw error;
  });
}

function buildPdf({ pages, widthPt, heightPt }) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pageTreeId = addObject("");
  const pageIds = [];
  for (const page of pages) {
    const [, base64] = page.dataUrl.split(",");
    const binary = atob(base64);
    const imageId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${binary.length} >>\nstream\n${binary}\nendstream`,
    );
    const content = [
      "q",
      `${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm`,
      `/Im${imageId} Do`,
      "Q",
    ].join("\n");
    const contentId = addObject(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    pageIds.push(
      addObject(
        `<< /Type /Page /Parent ${pageTreeId} 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] /Resources << /XObject << /Im${imageId} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  objects[pageTreeId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1)
    bytes[index] = pdf.charCodeAt(index) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

async function renderPosterPdf(source, addWatermark) {
  const image = new Image();
  image.src = source.src;
  await image.decode();
  const layout = getLayout(source);
  const pagePxWidth = Math.round((layout.paper.widthPt / 72) * 150);
  const pagePxHeight = Math.round((layout.paper.heightPt / 72) * 150);
  const marginPxX = Math.round(
    (layout.marginMm / layout.paper.widthMm) * pagePxWidth,
  );
  const marginPxY = Math.round(
    (layout.marginMm / layout.paper.heightMm) * pagePxHeight,
  );
  const printablePxWidth = pagePxWidth - marginPxX * 2;
  const printablePxHeight = pagePxHeight - marginPxY * 2;
  const overlapPxX = Math.round(
    (layout.overlapMm / layout.printableWidthMm) * printablePxWidth,
  );
  const overlapPxY = Math.round(
    (layout.overlapMm / layout.printableHeightMm) * printablePxHeight,
  );
  const virtualWidth =
    layout.pagesWide * printablePxWidth -
    Math.max(0, layout.pagesWide - 1) * overlapPxX;
  const virtualHeight =
    layout.pagesHigh * printablePxHeight -
    Math.max(0, layout.pagesHigh - 1) * overlapPxY;
  const imageScale = virtualWidth / image.naturalWidth;
  const renderedWidth = image.naturalWidth * imageScale;
  const renderedHeight = image.naturalHeight * imageScale;
  const canvas = document.createElement("canvas");
  canvas.width = pagePxWidth;
  canvas.height = pagePxHeight;
  const context = canvas.getContext("2d");
  const pages = [];

  for (let row = 0; row < layout.pagesHigh; row += 1) {
    for (let col = 0; col < layout.pagesWide; col += 1) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pagePxWidth, pagePxHeight);
      context.save();
      context.beginPath();
      context.rect(marginPxX, marginPxY, printablePxWidth, printablePxHeight);
      context.clip();
      const sourceX = col * (printablePxWidth - overlapPxX);
      const sourceY = row * (printablePxHeight - overlapPxY);
      const offsetX = marginPxX - sourceX + (virtualWidth - renderedWidth) / 2;
      const offsetY =
        marginPxY - sourceY + (virtualHeight - renderedHeight) / 2;
      context.drawImage(image, offsetX, offsetY, renderedWidth, renderedHeight);
      context.restore();
      context.strokeStyle = "#d4d4d8";
      context.lineWidth = 1;
      context.strokeRect(
        marginPxX,
        marginPxY,
        printablePxWidth,
        printablePxHeight,
      );

      if (elements.cutMarksInput.checked) {
        context.strokeStyle = "#111827";
        const mark = 12;
        for (const [x, y] of [
          [marginPxX, marginPxY],
          [marginPxX + printablePxWidth, marginPxY],
          [marginPxX, marginPxY + printablePxHeight],
          [marginPxX + printablePxWidth, marginPxY + printablePxHeight],
        ]) {
          context.beginPath();
          context.moveTo(x - mark, y);
          context.lineTo(x + mark, y);
          context.moveTo(x, y - mark);
          context.lineTo(x, y + mark);
          context.stroke();
        }

        const label = `row ${row + 1}/${layout.pagesHigh}, column ${col + 1}/${layout.pagesWide}`;
        context.fillStyle = "#52525b";
        context.font = "12px Helvetica, Arial, sans-serif";
        context.fillText(
          label,
          marginPxX,
          pagePxHeight - Math.max(10, marginPxY / 2),
        );
      }
      if (addWatermark) {
        context.save();
        const watermark = "Block Poster Pro";
        const watermarkFontSize = 9;
        const watermarkPadding = 4;
        const watermarkX =
          pagePxWidth - Math.max(9, Math.round(marginPxX / 2));
        const watermarkY =
          pagePxHeight - Math.max(9, Math.round(marginPxY / 2));
        context.font = `500 ${watermarkFontSize}px Helvetica, Arial, sans-serif`;
        context.textAlign = "right";
        const watermarkWidth = context.measureText(watermark).width;
        context.fillStyle = "rgba(255,255,255,.92)";
        context.fillRect(
          watermarkX - watermarkWidth - watermarkPadding,
          watermarkY - watermarkFontSize - watermarkPadding / 2,
          watermarkWidth + watermarkPadding * 2,
          watermarkFontSize + watermarkPadding,
        );
        context.fillStyle = "rgba(82,82,91,.72)";
        context.fillText(watermark, watermarkX, watermarkY);
        context.restore();
      }
      pages.push({
        dataUrl: canvas.toDataURL("image/jpeg", 0.9),
        width: canvas.width,
        height: canvas.height,
      });
    }
  }

  return {
    blob: buildPdf({
      pages,
      widthPt: layout.paper.widthPt,
      heightPt: layout.paper.heightPt,
    }),
    filename: `${safeFilename(source.name)}-${layout.pagesWide}x${layout.pagesHigh}.pdf`,
  };
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateParts(date = new Date()) {
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((Math.floor(date.getSeconds() / 2) || 0) & 0x1f),
    date:
      (((Math.max(1980, date.getFullYear()) - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

async function buildZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralChunks = [];
  const { time, date } = zipDateParts();
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    local.set(name, 30);
    chunks.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, name.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(name, 46);
    centralChunks.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralChunks.reduce(
    (total, chunk) => total + chunk.length,
    0,
  );
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);
  return new Blob([...chunks, ...centralChunks, end], {
    type: "application/zip",
  });
}

async function requestImageOrigins(images) {
  const origins = [
    ...new Set(
      images
        .map((image) => {
          try {
            const url = new URL(image.src);
            return /^https?:$/.test(url.protocol) ? `${url.origin}/*` : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    ),
  ];
  if (!origins.length) return true;
  return chrome.permissions.request({ origins });
}

async function fetchBatchSource(image, index) {
  const response = await fetch(image.src);
  if (!response.ok)
    throw new Error(`Image ${index + 1} could not be downloaded.`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/"))
    throw new Error(`Image ${index + 1} is not a supported image.`);
  const objectUrl = URL.createObjectURL(blob);
  const dimensions = await imageDimensions(objectUrl);
  return {
    src: objectUrl,
    objectUrl,
    name: image.name || `web-image-${index + 1}`,
    ...dimensions,
  };
}

async function createBatch(button) {
  const selected = [...state.scanSelected]
    .slice(0, 20)
    .map((index) => state.scanImages[index])
    .filter(Boolean);
  if (!selected.length) {
    showToast("Select at least one image first.", true);
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  try {
    button.textContent = "Requesting access…";
    const granted = await requestImageOrigins(selected);
    if (!granted)
      throw new Error("Image access is required to create this batch.");
    const files = [];
    for (let index = 0; index < selected.length; index += 1) {
      button.textContent = `Building ${index + 1}/${selected.length}…`;
      const source = await fetchBatchSource(selected[index], index);
      try {
        const output = await renderPosterPdf(source, false);
        files.push({ blob: output.blob, name: output.filename });
      } finally {
        revokeSource(source);
      }
    }
    button.textContent = "Packing ZIP…";
    const zip = await buildZip(files);
    await downloadBlob(
      zip,
      `block-poster-batch-${new Date().toISOString().slice(0, 10)}.zip`,
    );
    showToast(`${files.length} watermark-free posters downloaded as a ZIP.`);
  } catch (error) {
    showToast(error.message || "Batch export failed.", true);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function exportCurrent(clean) {
  if (!state.source) return;
  if (clean && state.authToken && !state.entitlement.removeWatermark) {
    try {
      await refreshEntitlement();
    } catch {
      // The normal clean-export branch below will offer reconnection or upgrade.
    }
  }
  if (clean && !state.entitlement.removeWatermark) {
    if (!state.authToken) {
      await connectAccount();
      showToast(
        "Connect your Block Poster account, then try the clean export again.",
      );
    } else {
      await sendMessage({
        type: "OPEN_TAB",
        url: `${APP_ORIGIN}/pricing?utm_source=chrome_extension`,
      });
      showToast("A paid export or Pro plan removes the watermark.");
    }
    return;
  }

  const button = clean ? elements.cleanExportButton : elements.freeExportButton;
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Building PDF…";
  try {
    const output = await renderPosterPdf(state.source, !clean);
    if (clean && state.entitlement.plan === "single") {
      await apiFetch("/api/poster/extension-consume-export", {
        method: "POST",
      });
      await refreshEntitlement();
    }
    await downloadBlob(output.blob, output.filename);
    showToast(
      clean ? "Watermark-free PDF downloaded." : "Free PDF downloaded.",
    );
  } catch (error) {
    showToast(error.message || "PDF export failed.", true);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function apiFetch(path, init = {}) {
  if (!state.authToken)
    throw new Error("Connect your Block Poster account first.");
  const response = await fetch(`${APP_ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.authToken}`,
      ...(init.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.code !== 0)
    throw new Error(result?.message || "Block Poster account request failed.");
  return result.data;
}

function hasBatchAccess() {
  return (
    state.entitlement.plan === "pro" || state.entitlement.plan === "lifetime"
  );
}

function updateAccountUi() {
  if (!state.authToken) {
    elements.accountButton.textContent = "Connect";
    elements.cleanExportButton.innerHTML =
      "Download without watermark <span>✦</span>";
    return;
  }
  const plan = state.entitlement.plan;
  elements.accountButton.textContent =
    plan === "free"
      ? "Free"
      : plan === "lifetime"
        ? "Lifetime"
        : plan === "pro"
          ? "Pro"
          : `${state.entitlement.singleExportCredits} export`;
  elements.cleanExportButton.innerHTML = state.entitlement.removeWatermark
    ? "Download without watermark <span>✓</span>"
    : "Unlock watermark-free export <span>✦</span>";
}

async function refreshEntitlement() {
  state.entitlement = await apiFetch("/api/poster/extension-entitlement");
  updateAccountUi();
}

async function connectAccount() {
  const nonce = crypto.randomUUID();
  await chrome.storage.session.set({ pendingConnectNonce: nonce });
  await sendMessage({
    type: "OPEN_TAB",
    url: `${APP_ORIGIN}/extension/connect?nonce=${encodeURIComponent(nonce)}&utm_source=chrome_extension`,
  });
}

function renderScanResults() {
  elements.scanResults.replaceChildren();
  if (!state.scanImages.length) {
    elements.scanResults.classList.remove("hidden");
    const message = document.createElement("p");
    message.className = "section-copy";
    message.textContent = "No large images were found on this page.";
    elements.scanResults.append(message);
    updateEditorAvailability();
    return;
  }
  state.scanImages.forEach((image, index) => {
    const label = document.createElement("label");
    label.className = `scan-item${state.scanSelected.has(index) ? " selected" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.scanSelected.has(index);
    const preview = document.createElement("img");
    preview.src = image.src;
    preview.alt = image.name;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.scanSelected.add(index);
      else state.scanSelected.delete(index);
      label.classList.toggle("selected", checkbox.checked);
      updateEditorAvailability();
      updateLayoutSummary();
    });
    label.append(preview, checkbox);
    elements.scanResults.append(label);
  });
  const actions = document.createElement("div");
  actions.className = "scan-actions";
  const all = document.createElement("button");
  all.type = "button";
  all.textContent = "Select all";
  all.addEventListener("click", () => {
    state.scanSelected = new Set(state.scanImages.map((_, index) => index));
    renderScanResults();
  });
  const create = document.createElement("button");
  create.type = "button";
  create.textContent = "Create batch";
  create.addEventListener("click", () => createBatch(create));
  actions.append(all, create);
  elements.scanResults.append(actions);
  elements.scanResults.classList.remove("hidden");
  updateEditorAvailability();
  updateLayoutSummary();
}

async function scanPage() {
  if (state.authToken && !hasBatchAccess()) {
    try {
      await refreshEntitlement();
    } catch {
      // Continue to the normal connection or upgrade path below.
    }
  }
  if (!hasBatchAccess()) {
    if (!state.authToken) await connectAccount();
    else
      await sendMessage({
        type: "OPEN_TAB",
        url: `${APP_ORIGIN}/pricing?utm_source=chrome_extension&utm_content=batch`,
      });
    showToast("Batch page scanning is available with Pro and Lifetime.");
    return;
  }
  const original = elements.scanButton.innerHTML;
  try {
    elements.scanButton.disabled = true;
    elements.scanButton.textContent = "Scanning…";
    const result = await sendMessage({ type: "SCAN_PAGE_IMAGES" });
    state.scanImages = result?.images || [];
    state.scanSelected = new Set();
    renderScanResults();
    showToast(
      `Found ${state.scanImages.length} useful image${state.scanImages.length === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    showToast(error.message || "Unable to scan this page.", true);
  } finally {
    elements.scanButton.disabled = false;
    elements.scanButton.innerHTML = original;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (
    message?.type === "PAGE_IMAGE_PICKED" ||
    message?.type === "PAGE_REGION_PICKED"
  ) {
    handlePageCapture(message);
  }
  if (message?.type === "BLOCK_POSTER_AUTH_TOKEN") {
    chrome.storage.session
      .get("pendingConnectNonce")
      .then(async ({ pendingConnectNonce }) => {
        if (!pendingConnectNonce || pendingConnectNonce !== message.nonce)
          return;
        state.authToken = message.token;
        await chrome.storage.local.set({ extensionAuthToken: message.token });
        await chrome.storage.session.remove("pendingConnectNonce");
        try {
          await refreshEntitlement();
          showToast("Block Poster account connected.");
        } catch (error) {
          showToast(error.message || "Account connection failed.", true);
        }
      });
  }
  if (message?.type === "CONTEXT_ACTION_AVAILABLE" && message.actionId) {
    if (state.initialized) handlePendingContextAction(message.actionId);
  }
});

elements.pickImageButton.addEventListener("click", () =>
  sendMessage({ type: "START_IMAGE_PICK" }).catch((error) =>
    showToast(error.message, true),
  ),
);
elements.captureButton.addEventListener("click", () =>
  sendMessage({ type: "START_REGION_CAPTURE" }).catch((error) =>
    showToast(error.message, true),
  ),
);
elements.uploadButton.addEventListener("click", () =>
  elements.fileInput.click(),
);
elements.fileInput.addEventListener("change", async () => {
  try {
    await readFile(elements.fileInput.files?.[0]);
    showToast("Image uploaded.");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.fileInput.value = "";
  }
});
elements.pasteButton.addEventListener("click", async () => {
  try {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) =>
      entry.types.some((type) => type.startsWith("image/")),
    );
    const type = item?.types.find((value) => value.startsWith("image/"));
    if (!item || !type)
      throw new Error("The clipboard does not contain an image.");
    await readFile(await item.getType(type));
    showToast("Image pasted.");
  } catch (error) {
    showToast(error.message || "Clipboard access was denied.", true);
  }
});
elements.clearButton.addEventListener("click", clearSource);
elements.pagesWideInput.addEventListener("input", updateLayoutSummary);
elements.paperSelect.addEventListener("change", updateLayoutSummary);
elements.orientationSelect.addEventListener("change", updateLayoutSummary);
elements.marginInput.addEventListener("input", updateLayoutSummary);
elements.overlapInput.addEventListener("input", updateLayoutSummary);
elements.freeExportButton.addEventListener("click", () => exportCurrent(false));
elements.cleanExportButton.addEventListener("click", () => exportCurrent(true));
elements.accountButton.addEventListener("click", async () => {
  if (!state.authToken) {
    await connectAccount();
    return;
  }
  elements.accountMenu.classList.toggle("hidden");
});
elements.refreshAccountButton.addEventListener("click", async () => {
  elements.accountMenu.classList.add("hidden");
  try {
    await refreshEntitlement();
    showToast("Membership refreshed.");
  } catch (error) {
    showToast(error.message || "Unable to refresh membership.", true);
  }
});
elements.disconnectButton.addEventListener("click", async () => {
  state.authToken = null;
  state.entitlement = {
    plan: "free",
    removeWatermark: false,
    unlimitedExports: false,
    singleExportCredits: 0,
  };
  await chrome.storage.local.remove("extensionAuthToken");
  elements.accountMenu.classList.add("hidden");
  updateAccountUi();
  showToast("Block Poster account disconnected.");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".account-area")) {
    elements.accountMenu.classList.add("hidden");
  }
});
elements.scanButton.addEventListener("click", scanPage);

async function handlePendingContextAction(expectedActionId) {
  const { pendingContextAction } =
    await chrome.storage.session.get("pendingContextAction");
  if (!pendingContextAction) return;
  if (expectedActionId && pendingContextAction.id !== expectedActionId) return;
  await chrome.storage.session.remove("pendingContextAction");
  if (Date.now() - pendingContextAction.createdAt > 30_000) return;

  if (pendingContextAction.kind === "image") {
    try {
      const capture = await sendMessage({
        type: "CAPTURE_CONTEXT_IMAGE",
        tabId: pendingContextAction.tabId,
        srcUrl: pendingContextAction.srcUrl,
      });
      await handlePageCapture(capture);
    } catch (error) {
      showToast(error.message || "Unable to add this image.", true);
    }
    return;
  }

  await scanPage();
}

(async function initialize() {
  const { extensionAuthToken } =
    await chrome.storage.local.get("extensionAuthToken");
  if (extensionAuthToken) {
    state.authToken = extensionAuthToken;
    try {
      await refreshEntitlement();
    } catch {
      state.authToken = null;
      await chrome.storage.local.remove("extensionAuthToken");
      updateAccountUi();
    }
  }
  updateLayoutSummary();
  state.initialized = true;
  await handlePendingContextAction();
})();
