import sharp from "sharp";

const BG = "#0b0d13";
const GREEN = "#4CC9A0";
const PURPLE = "#9B8FE8";

function makeSvg(size) {
  const stroke = Math.max(2, Math.round(size * 0.01125));
  const r = Math.round(size * 0.225);
  const cxLeft = Math.round(size * 0.425);
  const cxRight = Math.round(size * 0.6);
  const cy = Math.round(size * 0.5);
  const dot = Math.max(4, Math.round(size * 0.04));
  const halo = Math.max(dot + 4, Math.round(size * 0.08));
  const rx = Math.round(size * 0.2);
  const interX = Math.round((cxLeft + cxRight) / 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}" />
  <circle cx="${cxLeft}" cy="${cy}" r="${r}" fill="none" stroke="${GREEN}" stroke-width="${stroke}" />
  <circle cx="${cxRight}" cy="${cy}" r="${r}" fill="none" stroke="${PURPLE}" stroke-width="${stroke}" />
  <circle cx="${interX}" cy="${cy}" r="${halo}" fill="#FFFFFF" fill-opacity="0.18" />
  <circle cx="${interX}" cy="${cy}" r="${dot}" fill="#FFFFFF" />
</svg>`;
}

async function generate(size, outFile) {
  const svg = makeSvg(size);
  await sharp(Buffer.from(svg)).png().toFile(outFile);
}

await generate(180, "public/apple-touch-icon.png");
await generate(192, "public/icon-192.png");
await generate(512, "public/icon-512.png");
