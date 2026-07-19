# Chrome Web Store submission copy

## Name

Block Poster

## Summary

Pick an image or capture part of a web page, then print it as a tiled poster on
ordinary paper.

## Detailed description

Turn inspiration from the web into a wall-sized printable poster without
downloading, cropping, and re-uploading files by hand.

Block Poster lets you:

- Click a visible image on the current page.
- Capture any visible region of a page.
- Upload or paste an image.
- Choose paper size, orientation, margins, overlap, and poster width.
- Download a tiled PDF ready to print on a home or office printer.

The complete single-image workflow is free. Free PDFs include a Block Poster
watermark. Existing Block Poster purchases and memberships unlock
watermark-free exports.

Everyone can scan the current page for useful images, filter out small assets
and duplicates, and download up to 5 watermarked posters in one ZIP file. Pro
and Lifetime members can download up to 30 watermark-free posters per batch.

Block Poster does not save a creation history or upload a gallery of your
images. Poster rendering happens locally in the extension. Account connection
uses a scoped token and does not expose your password or website cookies to the
extension.

## Store fields

- Category: Art & Design
- Language: English
- Homepage URL: `https://blockposter.pro/`
- Support URL: `https://blockposter.pro/support`
- Privacy policy URL: `https://blockposter.pro/privacy-policy`
- Official URL: `https://blockposter.pro/`

The Official URL should be selected only after `blockposter.pro` is verified in
the publisher's Google Search Console account.

The product-specific guide is available at
`https://blockposter.pro/block-poster-chrome-extension` and should be linked
from the GitHub repository and GitHub Pages site.

## Single purpose

Turn user-selected web images and screen captures into printable tiled poster
PDFs.

## Permission explanations

- `activeTab`: Access the current page only after the user chooses to pick an
  image, capture an area, or scan the page.
- `scripting`: Install the temporary image picker and capture overlay.
- `sidePanel`: Display the Block Poster controls beside the current page.
- `downloads`: Save user-created PDF and ZIP files.
- `clipboardRead`: Paste an image only after the user clicks Paste image.
- `storage`: Remember the connected Block Poster account token. No poster
  history is stored.
- `contextMenus`: Offer a shortcut for opening Block Poster from the page.
  Right-clicking an image imports that image; right-clicking the page starts a
  user-requested page scan.
- Required host access to `blockposter.pro`: Connect an existing account and
  check paid export entitlements.
- Optional host access: Download only the image origins selected by the user
  for a batch. It is requested at export time and only for those origins.

## Privacy dashboard disclosures

- Website content: Yes. The extension locally processes images and dimensions
  only after the user selects, captures, pastes, uploads, or scans a page.
- Authentication information: Yes. A scoped Block Poster account token is
  stored to verify paid export entitlements. The extension does not receive a
  password, payment card details, or website cookies.
- Personally identifiable information: No account profile fields are read by
  the extension. The scoped token identifies the connected account to the
  Block Poster API.
- Data use certification: Data is used only to provide the user-facing poster
  workflow. It is not sold, used for personalized advertising, used for credit
  decisions, or made available for unrelated human review.

## Graphic assets

- Store icon: 128 × 128 PNG, derived from the Block Poster website favicon.
- Screenshots: five 1280 × 800 PNG or JPEG images; see
  `STORE_SCREENSHOTS.md`.
- Small promo tile: 440 × 280 PNG or JPEG.
- Marquee promo tile: 1400 × 560 PNG or JPEG.
