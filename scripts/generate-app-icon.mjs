// One-shot icon generator. Renders the brain mark from LoadingScreen.tsx
// into PNGs sized for iOS, Android, and the PWA manifest.
//
//   node scripts/generate-app-icon.mjs
//
// Outputs:
//   public/icons/icon-192.png
//   public/icons/icon-512.png
//   public/icons/apple-touch-icon.png  (180x180, iOS home screen)
//
// Sharp is required only for this script — install with:
//   npm i --no-save sharp

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const BG = "#2D2926"; // espresso charcoal — matches favicon.svg
const STROKE = "#E5E0D8"; // ivory mist — readable on dark
const ACCENT = "#A68B67"; // bronze accent dot — same warmth as favicon
const RADIUS_RATIO = 0.22; // matches iOS-style rounded square (squircle-ish)

// Brain path lifted verbatim from src/components/LoadingScreen.tsx so the
// in-app loading mark and the home-screen icon are the same shape.
const BRAIN_PATH =
  "M8.5 3a3.5 3.5 0 0 0-3.5 3.5c-1.5.5-2.5 2-2.5 3.5 0 1 .5 2 1.5 2.5-.5.8-.5 2 0 3 .3.6.8 1 1.5 1.3-.2.9.1 2 .8 2.7.8.7 2 1 3 .5.3 1 1.3 2 2.7 2A2.5 2.5 0 0 0 14.5 20V4.5A1.5 1.5 0 0 0 13 3M15.5 3A3.5 3.5 0 0 1 19 6.5c1.5.5 2.5 2 2.5 3.5 0 1-.5 2-1.5 2.5.5.8.5 2 0 3-.3.6-.8 1-1.5 1.3.2.9-.1 2-.8 2.7-.8.7-2 1-3 .5-.3 1-1.3 2-2.7 2A2.5 2.5 0 0 1 9.5 20V4.5A1.5 1.5 0 0 1 11 3";

function buildSvg(size, withRadius) {
  const r = withRadius ? Math.round(size * RADIUS_RATIO) : 0;
  // Brain at 60% of canvas, centred. Stroke scales with the canvas.
  const brainSize = size * 0.6;
  const brainOffset = (size - brainSize) / 2;
  const strokeWidth = (size / 24) * 1.5; // 1.5 in viewBox units
  // Bronze accent dot in the bottom-right, sized like favicon.svg's dot.
  const dotR = size * 0.073;
  const dotCx = size - dotR - size * 0.083;
  const dotCy = size - dotR - size * 0.083;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <g transform="translate(${brainOffset} ${brainOffset}) scale(${brainSize / 24})">
    <path d="${BRAIN_PATH}" fill="none" stroke="${STROKE}" stroke-width="${strokeWidth / (brainSize / 24)}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="${ACCENT}"/>
</svg>`;
}

async function render(size, outPath, { round = false } = {}) {
  const svg = buildSvg(size, round);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

// 1200x630 OG / Twitter card — the image link previews show in iMessage,
// WhatsApp, Slack, Twitter, Discord, etc. Brain mark left-of-centre with
// wordmark + tagline. Same espresso/ivory/bronze palette as the icons so
// the share preview reads as the same brand.
function buildOgSvg() {
  const W = 1200;
  const H = 630;
  const brainSize = 220;
  const brainX = 140;
  const brainY = (H - brainSize) / 2;
  const brainStrokeViewbox = 1.5; // viewBox units, same as brain at 24px box
  const dotR = 18;
  const dotCx = brainX + brainSize - dotR - 12;
  const dotCy = brainY + brainSize - dotR - 12;
  const textX = brainX + brainSize + 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g transform="translate(${brainX} ${brainY}) scale(${brainSize / 24})">
    <path d="${BRAIN_PATH}" fill="none" stroke="${STROKE}" stroke-width="${brainStrokeViewbox}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="${ACCENT}"/>
  <text x="${textX}" y="${H / 2 - 10}" fill="${STROKE}" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="500" letter-spacing="-2">Everion</text>
  <text x="${textX}" y="${H / 2 + 60}" fill="${STROKE}" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-style="italic" opacity="0.78">your personal memory and knowledge OS</text>
</svg>`;
}

async function renderOg(outPath) {
  const buf = await sharp(Buffer.from(buildOgSvg())).png().toBuffer();
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

const root = path.resolve(process.cwd(), "public/icons");
if (!existsSync(root)) mkdirSync(root, { recursive: true });

// PWA manifest icons — let the OS apply its own corner mask.
await render(192, path.join(root, "icon-192.png"), { round: true });
await render(512, path.join(root, "icon-512.png"), { round: true });
// iOS apple-touch-icon — iOS already squircle-masks; use a flat square.
// 180x180 is the size iOS Safari pulls for retina iPhones.
await render(180, path.join(root, "apple-touch-icon.png"), { round: false });

// Social-share preview card. Lives at /og.png so meta tags can reference it
// directly. 1200x630 is the canonical size that Facebook, LinkedIn, X, and
// most other unfurlers expect.
await renderOg(path.resolve(process.cwd(), "public/og.png"));
