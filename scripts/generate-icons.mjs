import sharp from '../node_modules/sharp/lib/index.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ── Grinta icon: dark rounded square + lime lightning bolt ────────────────────
function makeSvg(size) {
  const r = Math.round(size * 0.17); // corner radius ≈ iOS style
  // Bolt path scaled to size (original design on 512×512)
  const scale = size / 512;
  const bolt = [
    [304, 48],
    [176, 272],
    [258, 272],
    [208, 464],
    [336, 240],
    [254, 240],
  ]
    .map(([x, y]) => `${(x * scale).toFixed(1)},${(y * scale).toFixed(1)}`)
    .join(' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#0D0D0D"/>
  <polygon points="${bolt}" fill="#AAFF00"/>
</svg>`;
}

// Standard + maskable sizes
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

await Promise.all(
  SIZES.map((size) =>
    sharp(Buffer.from(makeSvg(size)))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, `icon-${size}x${size}.png`))
  )
);

// apple-touch-icon (must be exactly 180×180, no alpha background for iOS)
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#0D0D0D"/>
  <polygon points="${[
    [304, 48], [176, 272], [258, 272], [208, 464], [336, 240], [254, 240],
  ].map(([x, y]) => `${(x * 180 / 512).toFixed(1)},${(y * 180 / 512).toFixed(1)}`).join(' ')}" fill="#AAFF00"/>
</svg>`;

await sharp(Buffer.from(appleSvg))
  .resize(180, 180)
  .flatten({ background: '#0D0D0D' })
  .png()
  .toFile(join(OUT, 'apple-touch-icon.png'));

// favicon 32×32
await sharp(Buffer.from(makeSvg(32)))
  .resize(32, 32)
  .png()
  .toFile(join(__dirname, '..', 'public', 'favicon-32x32.png'));

// favicon 16×16
await sharp(Buffer.from(makeSvg(16)))
  .resize(16, 16)
  .png()
  .toFile(join(__dirname, '..', 'public', 'favicon-16x16.png'));

console.log('✓ PWA icons generated in public/icons/');
