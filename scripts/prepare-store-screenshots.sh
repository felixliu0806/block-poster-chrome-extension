#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${1:-$(dirname "$ROOT_DIR")/block poster}"
OUTPUT_DIR="${2:-$ROOT_DIR/store-assets/screenshots}"

mkdir -p "$OUTPUT_DIR"

render_screenshot() {
  local source_name="$1"
  local output_name="$2"
  local page_x="$3"
  local page_width="$4"
  local panel_x="$5"
  local panel_width="$6"
  local height="$7"

  ffmpeg -hide_banner -loglevel error -y \
    -i "$SOURCE_DIR/$source_name" \
    -filter_complex \
    "[0:v]crop=${page_width}:${height}:${page_x}:0[page];[0:v]crop=${panel_width}:${height}:${panel_x}:0[panel];[page][panel]hstack=inputs=2,scale=1280:800:flags=lanczos[final]" \
    -map "[final]" \
    "$OUTPUT_DIR/$output_name"
}

# Keep the full extension side panel while choosing the most explanatory part
# of the web page for each feature. Combined crops are 16:10 before resizing.
render_screenshot "pick-from-page.png" "01-pick-from-page.png" 80 1818 2668 1164 1864
render_screenshot "capture-area.png" "02-capture-area.png" 80 1816 2660 1176 1870
render_screenshot "upload-image.png" "03-upload-image.png" 680 1890 2572 1096 1866
render_screenshot "scan-current-page.png" "04-scan-current-page.png" 610 1816 2658 1160 1860
render_screenshot "pdf-preview.png" "05-pdf-preview.png" 560 1814 2667 1159 1858

echo "Prepared screenshots in $OUTPUT_DIR"
