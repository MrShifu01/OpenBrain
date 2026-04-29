// One-shot icon generator. Sources from logoNew.webp at the repo root and
// renders PNGs sized for iOS, Android, and the PWA manifest.
//
//   node scripts/generate-app-icon.mjs
//
// Outputs:
//   public/icons/icon-192.png
//   public/icons/icon-512.png
//   public/icons/apple-touch-icon.png  (180x180, iOS home screen)
//   public/og.png                      (1200x630, social share card)
//   public/favicon-32.png              (32x32, browser tab)
//
// Sharp is required only for this script — install with:
//   npm i --no-save sharp

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BG = "#2D2926"; // espresso charcoal — matches favicon palette
const STROKE = "#E5E0D8"; // ivory mist — readable on dark
const RADIUS_RATIO = 0.22; // iOS-style squircle-ish corner

const root = path.resolve(process.cwd());
const SOURCE = path.join(root, "logoNew.webp");
if (!existsSync(SOURCE)) {
  throw new Error(`logoNew.webp not found at ${SOURCE}`);
}
const SOURCE_BUF = readFileSync(SOURCE);

// Trim transparent/white border once so we can centre cleanly on every canvas.
async function trimmedLogoBuffer() {
  return sharp(SOURCE_BUF).trim({ threshold: 10 }).toBuffer();
}

// Generate a square icon: dark BG + optional rounded corners + centred logo.
async function renderIcon(size, outPath, { round = false, padRatio = 0.18 } = {}) {
  const r = round ? Math.round(size * RADIUS_RATIO) : 0;
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
</svg>`;

  const inner = Math.round(size * (1 - padRatio * 2));
  const trimmed = await trimmedLogoBuffer();
  const logo = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const buf = await sharp(Buffer.from(bgSvg))
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

// 1200x630 OG / Twitter card — the image link previews show in iMessage,
// WhatsApp, Slack, Twitter, Discord. Logo left-of-centre, wordmark + tagline.
async function renderOg(outPath) {
  const W = 1200;
  const H = 630;
  const logoSize = 240;
  const logoX = 140;
  const logoY = (H - logoSize) / 2;
  const textX = logoX + logoSize + 64;

  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="${textX}" y="${H / 2 - 10}" fill="${STROKE}" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="500" letter-spacing="-2">Everion</text>
  <text x="${textX}" y="${H / 2 + 60}" fill="${STROKE}" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-style="italic" opacity="0.78">your personal memory and knowledge OS</text>
</svg>`;

  const trimmed = await trimmedLogoBuffer();
  const logo = await sharp(trimmed)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const buf = await sharp(Buffer.from(bgSvg))
    .composite([{ input: logo, top: Math.round(logoY), left: logoX }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 90 })
    .toBuffer();

  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

const iconsDir = path.join(root, "public/icons");
if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

// PWA manifest icons — let the OS apply its own corner mask.
await renderIcon(192, path.join(iconsDir, "icon-192.png"), { round: true });
await renderIcon(512, path.join(iconsDir, "icon-512.png"), { round: true });
// iOS apple-touch-icon — iOS already squircle-masks; use a flat square.
await renderIcon(180, path.join(iconsDir, "apple-touch-icon.png"), { round: false });

// Browser-tab favicon — multiple sizes so retina tabs stay sharp.
await renderIcon(32, path.join(root, "public/favicon-32.png"), { round: false, padRatio: 0.1 });
await renderIcon(64, path.join(root, "public/favicon-64.png"), { round: false, padRatio: 0.1 });

// Social-share preview card.
await renderOg(path.join(root, "public/og.png"));
