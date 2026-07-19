import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "store-assets");

function dataUri(path) {
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function render(name) {
  const sourcePath = join(assets, `${name}.svg`);
  const scenePath = join(assets, `${name}-scene.png`);
  const iconPath = join(root, "icons", "icon-128.png");
  const embeddedPath = join(assets, `.${name}-embedded.svg`);
  const outputPath = join(assets, `${name}.png`);

  const embedded = readFileSync(sourcePath, "utf8")
    .replace(`${name}-scene.png`, dataUri(scenePath))
    .replace("../icons/icon-128.png", dataUri(iconPath));

  writeFileSync(embeddedPath, embedded);
  try {
    execFileSync("sips", [
      "-s",
      "format",
      "png",
      embeddedPath,
      "--out",
      outputPath,
    ]);
  } finally {
    unlinkSync(embeddedPath);
  }
}

render("promo-small");
render("promo-marquee");
