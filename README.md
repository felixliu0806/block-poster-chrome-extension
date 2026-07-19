# Block Poster Chrome Extension

Chrome companion for turning images found on the web into printable, tiled
Block Poster PDFs.

- **Website:** [Block Poster Pro](https://blockposter.pro/)
- **Extension guide:** [Block Poster for Chrome](https://blockposter.pro/block-poster-chrome-extension)
- **Support:** [blockposter.pro/support](https://blockposter.pro/support)

## Product scope

### Free workflow

- Pick a single image directly from the current web page.
- Capture a selected region of the current tab.
- Upload or paste an image from the clipboard.
- Configure the existing Block Poster print options in a Chrome side panel.
- Preview and export a watermarked PDF.
- Scan the current page and export up to 5 watermarked posters in one ZIP.

### Paid workflow

- Export without the Block Poster watermark.
- Select and process up to 30 images as one batch.
- Download a watermark-free batch without creating a saved project or history.

### Explicit non-goals

- No generation history or cloud gallery.
- No long-lived storage of source images or generated PDFs.
- No AI poster generator.
- No full copy of the website inside the extension.

## Extension experience

The toolbar action opens a persistent Chrome side panel. The extension only
injects temporary page UI while the user is selecting an image or drawing a
capture region.

1. Open the Block Poster side panel.
2. Pick an image, capture a region, upload a file, or paste an image.
3. Configure paper size, orientation, margins, overlap, and poster dimensions.
4. Preview the tiled poster.
5. Download a free watermarked PDF or use an existing paid entitlement for a
   clean export.

The page scanner presents eligible images in the side panel and filters icons
and duplicates. Free users can export up to 5 watermarked posters per batch;
Pro and Lifetime members can export up to 30 without watermarks.

The page context menu provides a permission-friendly shortcut. Right-clicking
an image opens the side panel and imports that rendered image. Right-clicking
the page background opens the side panel and starts the page scan. Both
actions use Chrome's temporary `activeTab` grant for the page where the menu was
invoked.

## Integration boundaries

- Manifest V3 Chrome extension.
- Chrome Side Panel is the primary UI.
- Existing `blockposter.pro` authentication and payment products remain the
  source of truth.
- Existing poster entitlements (`single`, `pro`, and `lifetime`) should be
  reused rather than duplicated in extension storage.
- Single-export credit is consumed only for a successful clean export.
- Pro and lifetime plans unlock clean exports and increase batches from 5
  watermarked posters to 30 watermark-free posters.
- Source images and output PDFs are session-only. Any server-side handoff must
  use short-lived storage and expiring URLs.

## Initial delivery milestones

1. Loadable side-panel shell and extension permissions.
2. Single-image page picker, clipboard paste, upload, and region capture.
3. Handoff to the existing poster rendering pipeline.
4. Extension authentication and entitlement lookup.
5. Watermarked free export and paid clean export.
6. Paid page scan, multi-select, bounded batch queue, and ZIP download.
7. Store listing assets, privacy disclosures, support page, and extension
   landing page backlink.

## Current implementation

The folder is directly loadable as an unpacked Manifest V3 extension; there is
no extension build step.

- The toolbar action opens the side panel.
- The page context menu imports a right-clicked image or starts a whole-page
  scan without requiring permanent access to every website.
- Single-image picking uses a temporary page highlighter and captures the
  visible rendered image without requesting permanent access to every site.
- Region capture, upload, and clipboard paste are implemented.
- Tiling and PDF creation happen locally in the extension.
- Free PDFs receive a real canvas-rendered watermark on every sheet.
- Account connection uses a scoped 30-day token issued by `blockposter.pro`.
  The extension never reads the website's cookies.
- Existing single-export credits, Pro subscriptions, and Lifetime purchases
  control watermark-free export.
- Free users can select up to 5 scanned images per batch with watermarks. Pro
  and Lifetime users can select up to 30 per batch without watermarks.
- No source, PDF, batch, or generation history is persisted.

## Load locally

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `chrome-extension` directory.
5. Pin Block Poster or open it from Chrome's Extensions menu.

The free capture and watermarked export workflow works without the website
running. Account connection requires the companion API routes from the private
Block Poster website repository to be deployed to `https://blockposter.pro`.

The production manifest contains no localhost host access. For local account
connection development, temporarily change `APP_ORIGIN` at the top of
`sidepanel.js`, add the exact localhost origin to both `host_permissions` and
the connection bridge match list, then remove it before packaging a release.

## Privacy and storage

- The current source image exists only in side-panel memory as an object URL.
- The connected account token is the only persistent extension value.
- A pending one-time connection nonce is stored in `chrome.storage.session`.
- PDF and ZIP object URLs are revoked after download.
- Batch mode requests access only to the image origins selected by the user,
  using optional host permissions.

## Official links

- [Block Poster Pro homepage](https://blockposter.pro/)
- [Chrome extension product page](https://blockposter.pro/block-poster-chrome-extension)
- [Privacy policy](https://blockposter.pro/privacy-policy)
- [Support](https://blockposter.pro/support)
