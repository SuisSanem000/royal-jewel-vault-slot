#!/usr/bin/env node
/**
 * Asset Normalization & Texture Atlas Pipeline (Designer Handoff -> Game-Ready Atlas)
 *
 * 1. Normalizes inconsistent designer filenames (casing, spaces, missing underscores)
 * 2. Downscales oversized raw PNGs (1254x1254) to 768x768 using high-quality Lanczos resampling
 *    for crisp rendering on 2K/4K desktops and 3x Retina mobile displays
 * 3. Packs all 9 normalized textures into a single WebP spritesheet atlas (`symbols.webp` + `symbols.json`)
 *
 * Usage:
 *   node scripts/normalize-assets.mjs --src ../resources/slot_game_assets
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ASSET_NAME_MAP = {
  'symbol_high_1.png': 'high_ruby.png',
  'symbol_high_2.png': 'high_sapphire.png',
  'symbol_high3.png': 'high_emerald.png',
  'Symbol high_4.png': 'high_amethyst.png',
  'symbol_low_1.png': 'low_a.png',
  'symbol_low_2.png': 'low_k.png',
  'symbol_low_3.png': 'low_q.png',
  'symbol_low4.png': 'low_j.png',
  'symbol_overlay.png': 'symbol_overlay.png',
};

const TARGET_SIZE = 768;
const srcArgIdx = process.argv.indexOf('--src');
const srcDir = resolve(srcArgIdx !== -1 ? process.argv[srcArgIdx + 1] : '../resources/slot_game_assets');
const outDir = resolve('public/assets/symbols');

if (!existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const pairs = Object.entries(ASSET_NAME_MAP).filter(([rawName]) => {
  if (!existsSync(join(srcDir, rawName))) {
    console.warn(`Skipping missing asset: ${rawName}`);
    return false;
  }
  return true;
});

const pyPipeline = `
import json, math, os
from PIL import Image

src_dir = ${JSON.stringify(srcDir)}
out_dir = ${JSON.stringify(outDir)}
pairs = ${JSON.stringify(pairs)}
cell = ${TARGET_SIZE}
cols = 3
rows = math.ceil(len(pairs) / cols)
sheet = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
frames = {}

for idx, (raw_name, clean_name) in enumerate(pairs):
    src_path = os.path.join(src_dir, raw_name)
    out_path = os.path.join(out_dir, clean_name)
    img = Image.open(src_path).convert("RGBA")
    if img.size != (cell, cell):
        img = img.resize((cell, cell), Image.Resampling.LANCZOS)
    img.save(out_path, "PNG", optimize=True)
    x = (idx % cols) * cell
    y = (idx // cols) * cell
    sheet.paste(img, (x, y))
    frames[clean_name] = {
        "frame": {"x": x, "y": y, "w": cell, "h": cell},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
        "sourceSize": {"w": cell, "h": cell}
    }
    print(f"Normalized (Lanczos): {raw_name} -> {clean_name} ({cell}x{cell})")

atlas_webp = os.path.join(out_dir, "symbols.webp")
sheet.save(atlas_webp, "WEBP", quality=96, method=6)

manifest = {
    "frames": frames,
    "meta": {
        "app": "royal-jewel-vault-asset-pipeline",
        "version": "2.1",
        "image": "symbols.webp",
        "format": "RGBA8888",
        "size": {"w": cols * cell, "h": rows * cell},
        "scale": "1"
    }
}
with open(os.path.join(out_dir, "symbols.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
`;

execFileSync('python3', ['-c', pyPipeline], { stdio: 'inherit' });

const manifest = JSON.parse(readFileSync(join(outDir, 'symbols.json'), 'utf8'));
for (const [, cleanName] of pairs) {
  if (!manifest.frames?.[cleanName]?.frame) {
    throw new Error(`Atlas manifest validation failed: missing frame for ${cleanName}`);
  }
}
const webpBytes = statSync(join(outDir, 'symbols.webp')).size;
console.log(
  `Packed WebP Atlas: symbols.webp (${(webpBytes / 1024).toFixed(1)} KB, ${pairs.length}x ${TARGET_SIZE}x${TARGET_SIZE} frames) + symbols.json`,
);
