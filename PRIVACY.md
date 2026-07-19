# Block Poster Chrome Extension Privacy Disclosure

Last updated: July 19, 2026

## Data used by the extension

Block Poster processes images that the user explicitly selects, captures,
uploads, or pastes. It also reads basic image URLs and dimensions when a user
explicitly asks it to scan the current page.

## How images are processed

Single-image captures, tiled poster rendering, watermarking, PDF creation, and
batch ZIP creation happen locally in the Chrome extension. Block Poster does
not create a cloud gallery or generation history for extension images and
PDFs.

Batch mode may download the specific image URLs selected by the user. The
extension asks for optional access to those image origins at that time. The
downloaded images remain in the current extension session and are discarded
after the batch is created or the side panel closes.

## Account information

Account connection happens on `blockposter.pro`. After the user confirms the
connection, the website issues a scoped account token so the extension can
check the user's current export entitlement and consume a purchased single
export. The extension never receives the user's password, payment information,
or website cookies.

The account token is stored in Chrome extension storage so the connection can
survive a browser restart. A temporary connection nonce is stored only for the
current browser session.

## Payments

Payments are completed on `blockposter.pro`, not inside the extension. The
extension receives only the resulting plan and export-entitlement information.

## Selling or advertising use

Block Poster does not sell extension data and does not use selected images,
page contents, or browsing activity for advertising or credit decisions.

## Chrome Web Store Limited Use

Information received through Chrome extension permissions is used only to
provide or improve the user-facing Block Poster workflow. It is not transferred
for unrelated purposes, used for personalized or interest-based advertising,
or made available for human review except when the user gives specific consent
for support, when required for security or legal compliance, or when the data
has been aggregated and anonymized for internal operations.

## User control

Users can remove the stored account token with the extension's Disconnect
account control, by clearing its extension storage, or by uninstalling the
extension.

## Contact

Questions about extension privacy can be sent through the support page at
`https://blockposter.pro/support`.
