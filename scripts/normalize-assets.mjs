#!/usr/bin/env node
/**
 * Asset Normalization & Texture Atlas Pipeline (Designer Handoff -> Game-Ready Atlas)
 *
 * 1. Normalizes inconsistent designer filenames (casing, spaces, missing underscores)
 * 2. Resizes oversized raw PNGs to 512x512
 * 3. Packs all 9 normalized textures into a single WebP spritesheet atlas (`symbols.webp` + `symbols.json`)
 *    so PixiJS loads all symbols in 1 HTTP request and 1 GPU texture bind.
 *
 * Usage:
 *   node scripts/normalize-assets.mjs --src ../resources/slot_game_assets
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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

const TARGET_SIZE = 512;
const srcArgIdx = process.argv.indexOf('--src');
const srcDir = resolve(srcArgIdx !== -1 ? process.argv[srcArgIdx + 1] : '../resources/slot_game_assets');
const outDir = resolve('public/assets/symbols');

if (!existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const normalizedNames = [];
for (const [rawName, cleanName] of Object.entries(ASSET_NAME_MAP)) {
  const srcPath = join(srcDir, rawName);
  const outPath = join(outDir, cleanName);

  if (!existsSync(srcPath)) {
    console.warn(`Skipping missing asset: ${rawName}`);
    continue;
  }

  copyFileSync(srcPath, outPath);
  execFileSync('sips', ['-Z', String(TARGET_SIZE), outPath], { stdio: 'ignore' });
  normalizedNames.push(cleanName);
  console.log(`Normalized: ${rawName} -> ${cleanName} (${TARGET_SIZE}x${TARGET_SIZE})`);
}

// Pack normalized 512x512 PNGs into a single 3x3 WebP spritesheet + TexturePacker JSON manifest
const atlasPngNames = JSON.stringify(normalizedNames);
const pyPacker = `
import json, math, os
from PIL import Image

out_dir = ${JSON.stringify(outDir)}
names = ${atlasPngNames}
cell = ${TARGET_SIZE}
cols = 3
rows = math.ceil(len(names) / cols)
sheet = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
frames = {}

for idx, name in enumerate(names):
    img = Image.open(os.path.join(out_dir, name)).convert("RGBA")
    if img.size != (cell, cell):
        img = img.resize((cell, cell), Image.Resampling.LANCZOS)
    x = (idx % cols) * cell
    y = (idx // cols) * cell
    sheet.paste(img, (x, y))
    frames[name] = {
        "frame": {"x": x, "y": y, "w": cell, "h": cell},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
        "sourceSize": {"w": cell, "h": cell}
    }

atlas_webp = os.path.join(out_dir, "symbols.webp")
sheet.save(atlas_webp, "WEBP", quality=90, method=6)

manifest = {
    "frames": frames,
    "meta": {
        "app": "royal-jewel-vault-asset-pipeline",
        "version": "2.0",
        "image": "symbols.webp",
        "format": "RGBA8888",
        "size": {"w": cols * cell, "h": rows * cell},
        "scale": "1"
    }
}
with open(os.path.join(out_dir, "symbols.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
`;

execFileSync('python3', ['-c', pyPacker], { stdio: 'inherit' });

// Validate atlas manifest schema
const manifest = JSON.parse(readFileSync(join(outDir, 'symbols.json'), 'utf8'));
for (const name of normalizedNames) {
  if (!manifest.frames?.[name]?.frame) {
    throw new Error(`Atlas manifest validation failed: missing frame for ${name}`);
  }
}
const webpBytes = statSync(join(outDir, 'symbols.webp')).size;
console.log(
  `Packed WebP Atlas: symbols.webp (${(webpBytes / 1024).toFixed(1)} KB, ${normalizedNames.length} frames) + symbols.json`,
);
