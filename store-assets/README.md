# Store graphic assets

- `icon-128.png`: upload as the Chrome Web Store icon.
- `promo-small.png`: 440 × 280 small promotional tile.
- `promo-marquee.png`: 1400 × 560 marquee promotional tile.
- `screenshots/01-pick-from-page.png`: pick a page image.
- `screenshots/02-capture-area.png`: draw a page capture region.
- `screenshots/03-upload-image.png`: upload a local image.
- `screenshots/04-scan-current-page.png`: scan and select page images.
- `screenshots/05-pdf-preview.png`: review the tiled PDF beside the extension.

The SVG files contain the editable brand and typography overlays. The
`*-scene.png` files are AI-generated photorealistic source scenes, and the PNG
files without `-scene` are the upload-ready composites.

Run `node scripts/render-store-promos.mjs` after changing either SVG overlay or
source scene. The renderer embeds the local image files before rasterizing so
the final PNGs are self-contained.

Run `scripts/prepare-store-screenshots.sh` to recreate the five 1280 × 800
screenshots from the original captures in the adjacent `block poster` project.
The script only crops, joins, and proportionally scales real screenshots; it
does not generate or alter interface content.
