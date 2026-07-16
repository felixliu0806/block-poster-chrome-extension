# Chrome Web Store draft

## Name

Block Poster – Web Image to Printable Poster

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

Pro and Lifetime members can also scan the current page for useful images,
filter out small assets and duplicates, select multiple images, and download a
batch of printable poster PDFs in one ZIP file.

Block Poster does not save a creation history or upload a gallery of your
images. Poster rendering happens locally in the extension. Account connection
uses a scoped token and does not expose your password or website cookies to the
extension.

## Store fields

- Category: Tools
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
- Required host access to `blockposter.pro`: Connect an existing account and
  check paid export entitlements.
- Optional host access: Download only the image origins selected by a paid user
  for a batch. It is requested at the moment the batch is created.
