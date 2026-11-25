# <img src="./public/favicon.png" alt="Royal Jewel Vault" width="32" align="absmiddle" /> Royal Jewel Vault — PixiJS Slot Game

> **Live Demo:** https://suissanem000.github.io/royal-jewel-vault-slot/

A client-side **5×3, 20-payline video slot game** built with **PixiJS v8**, **TypeScript (strict)**, **Vite**, **GSAP**, and **Vitest**, with strict separation between pure game math/state and rendering.

---

## Quick Start

**Prerequisites:** Node.js 18+ and `npm`.

```bash
git clone https://github.com/SuisSanem000/royal-jewel-vault-slot.git
cd royal-jewel-vault-slot
npm install
npm run dev
```

Open the Vite URL (default: `http://localhost:5173`).

```bash
npm test        # Vitest unit & end-to-end flow tests (20/20 passing)
npm run build   # Strict TypeScript check (tsc --noEmit) + Vite bundle
npm run preview # Preview production build locally
```

---

## Gameplay & Controls

- **Base Game:** 5×3 grid, 20 fixed paylines (left-to-right, 3+ matching symbols), 8 provided gem/royal symbols + `symbol_overlay.png` win frames + procedural `WILD` and `SCATTER` emblems.
- **Bonus Game (Royal Free Spins):** 3 / 4 / 5 Scatters award `8 / 10 / 12` Free Spins with a progressive win multiplier (`1x → 2x → 3x → 5x`), Scatter re-triggers, `BONUS COMPLETE!` summary, and clean return to base play.
- **Controls:**
  - `SPIN` / `Space`: Spin reels; press again mid-spin for **Quick Stop** (`STOP`).
  - `-` / `+`: Step bet (`1, 2, 5, 10, 20, 50` credits; locked during `AUTO` and `BONUS`).
  - `AUTO` / `TURBO` / `INFO` / `SFX ON`: Autoplay toggle, fast stops, dynamic Paytable & Rules modal, procedural Web Audio mute toggle.
  - `DEMO BONUS`: Guarantees a 3-Scatter trigger for quick evaluation.
  - `RESET` / `STOP ALL`: Always active; switches to **`STOP ALL`** during `AUTO` or `BONUS` to abort any running flow immediately and reset (`1000.00` balance, `5.00` bet).
  - `REFILL +1000`: Appears when idle and balance drops below the active bet.

---

## Architecture

```text
royal-jewel-vault-slot/
├── scripts/normalize-assets.mjs   # Standalone designer-asset renamer & 512×512 resizer
├── public/assets/symbols/         # Normalized 512×512 PNG assets + favicon
├── src/
│   ├── core/                      # Pure TypeScript — zero PixiJS or DOM imports
│   │   ├── types.ts               # Domain types (Grid, LineWin, BonusState, SpinResult, GameState)
│   │   ├── config.ts              # Paytable, 20 paylines, 5×28 virtual reel strips, bonus rules
│   │   ├── rng.ts                 # Rng interface, MathRng & deterministic Mulberry32 SeededRng
│   │   ├── evaluator.ts           # Left-to-right payline, WILD substitution & SCATTER evaluator
│   │   ├── stateMachine.ts        # Guarded FSM + safe reset()
│   │   └── slotEngine.ts          # Balance accounting, spin resolution & Free Spins lifecycle
│   ├── presentation/              # PixiJS v8, GSAP timelines & Web Audio
│   │   ├── assets.ts              # Asset preloader + procedural WILD/SCATTER emblem textures
│   │   ├── audio.ts               # Zero-dependency Web Audio synthesizer (iOS-hardened)
│   │   ├── layout.ts              # Pure dual-orientation stage & DPR math
│   │   ├── SlotStage.ts           # Adaptive stage, zoom/DPR sync, backdrop & sparkle FX
│   │   ├── reels/                 # Masked 4-sprite ReelColumn + staggered 5×3 ReelGridView
│   │   └── ui/                    # Reflowable HudView + BonusHeaderBar, ModalBanner, PaytableModal
│   ├── controller/GameController.ts  # Mediates HUD, FSM, SlotEngine & PresentationAdapter
│   └── main.ts                    # Bootstrap, layout wiring & keyboard shortcuts
└── tests/                         # core/, presentation/, and controller/ Vitest suites
```

---

## Technical Highlights

- **Decoupled Core & RGS-Ready Adapter:** `src/core/` has zero PixiJS/DOM imports; `GameController` talks to `PresentationAdapter`, making local RNG → Remote Game Server (RGS) migration straightforward.
- **Spoiler-Free Presentation:** Outcomes resolve upfront in `SlotEngine.spin()`, while `WIN`, `BonusState`, and 2-Scatter anticipation glows reveal only as reels land.
- **PixiJS v8 + GSAP Pipeline:** 4-sprite recycled `ReelColumn` inside a `Graphics` mask, `Ticker`-driven scroll with `BlurFilter`, GSAP `back.out(2.2)` bounce, pulsing `symbol_overlay.png` frames, and clean `forceStop` / `killTweensOf` teardown.
- **Guarded FSM & Cancellation:** `ALLOWED_TRANSITIONS` prevents invalid states; `runId` cancellation tokens + `forceStop()` guarantee `STOP ALL` / `RESET` never leaves dangling timers or half-finished bonus flows.
- **Separated Asset Pipeline ([`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs)):** Normalizes raw designer filenames and downscales `1254×1254` PNGs (`~9.7 MB`) to `512×512` (`~2.2 MB`, ~77% lighter), isolated for easy expansion into spritesheet packing and WebP conversion.
- **Zero-Dependency Web Audio:** Synthesizes UI clicks, spin whooshes, pitched reel stops, win arpeggios, and bonus fanfares with no external audio files.

---

## Responsiveness, Mobile & Cross-Browser Engineering

- **Dual-Orientation Virtual Stage ([`layout.ts`](./src/presentation/layout.ts), [`SlotStage.ts`](./src/presentation/SlotStage.ts)):** Auto-switches between `1280×720` (desktop/landscape) and `820×1060` (portrait when `h > w × 1.05`).
- **Thumb-Zone Mobile HUD & Modal Scaling ([`HudView.ts`](./src/presentation/ui/HudView.ts), [`Overlays.ts`](./src/presentation/ui/Overlays.ts)):** Portrait mode reflows into a `780×352` 3-row card (`360×96` `SPIN`, `56×56` `-`/`+`, `170×68` toggles); `PaytableModal` and `ModalBanner` auto-center, word-wrap, and scale to fit narrow screens.
- **Viewport, Notches & Touch ([`index.html`](./index.html)):** Uses `100dvh` (`100%` fallback), `viewport-fit=cover`, `env(safe-area-inset-*)` padding, `overscroll-behavior: none`, `touch-action`, and `-webkit-tap-highlight-color: transparent` without blocking accessibility zoom.
- **Browser Zoom & DPR Cap:** Clamps `devicePixelRatio` to `[1, 2]` and updates `renderer.resolution` live on `window.resize`, `visualViewport.resize`, and `screen.orientation` changes.
- **Cross-Browser Canvas & iOS Audio:** Includes an `arcTo` fallback for `ctx.roundRect`, `webkitAudioContext` fallback, first-gesture audio unlock, and iOS `'interrupted'` AudioContext recovery.

---

## Engineering & QA Log (Project Execution)

A compact summary of how the project was planned, built, reviewed, and hardened:

| Step | Focus | Key Engineering & QA Actions |
| :--- | :--- | :--- |
| 1 | **Planning & Scope** | <ul><li>Defined slot spec: 5×3 grid, 20 paylines, Wild/Scatter math, Free Spins bonus</li><li>Selected PixiJS v8 + strict TypeScript + GSAP + Vitest + Vite stack</li></ul> |
| 2 | **Asset Normalization** | <ul><li>Audited raw designer PNGs for inconsistent naming and oversized `1254×1254` dimensions</li><li>Isolated [`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs) (`512×512`, ~77% size cut) for future studio tooling</li></ul> |
| 3 | **Pure Core Engine** | <ul><li>Built DOM-free `evaluator.ts`, `slotEngine.ts`, `stateMachine.ts`, and Mulberry32 `SeededRng`</li><li>Verified paylines, Wild substitution, progressive bonus multipliers, and re-triggers</li></ul> |
| 4 | **PixiJS Presentation** | <ul><li>Implemented masked 4-sprite `ReelColumn`, `BlurFilter`, anticipation glow, and win overlays</li><li>Added procedural gold-and-ruby `WILD`/`SCATTER` emblems and Web Audio SFX</li></ul> |
| 5 | **Controller & Spoiler-Free UX** | <ul><li>Wired `GameController` + `PresentationAdapter` with `DEMO BONUS`, `AUTO`, `TURBO`, and `Quick Stop`</li><li>Withheld `WIN` / `BonusState` HUD updates until final reel landing</li></ul> |
| 6 | **Visual & HUD QA** | <ul><li>Tested live gameplay and caught `REFILL +1000` mid-spin flash and uneven `-`/`+` bet spacing</li><li>Centered `BET` steppers, tightened `isIdle` gating, and added one-click `RESET`</li></ul> |
| 7 | **Paytable & Audio Audit** | <ul><li>Replaced text-only info view with visual symbol icons and bet-scaled payouts</li><li>Caught subtle logic/audio edge cases (missing `playClick` / `playSpin`, duplicate quick-stop SFX)</li></ul> |
| 8 | **Mobile & Zoom Hardening** | <ul><li>Identified mobile portrait squeeze, notch/address-bar clipping, and desktop zoom DPR drift</li><li>Added dual-orientation `820×1060` portrait reflow, `100dvh`, `safe-area-inset-*`, and live DPR sync</li></ul> |
| 9 | **Cancellation & Text Bounds** | <ul><li>Tested interrupting `AUTO` / `DEMO BONUS` and found unstoppable loops and banner text overflow</li><li>Implemented `runId` async cancellation, `STOP ALL` mode, `forceStop()`, and `wordWrap` clamping</li></ul> |
| 10 | **Automated Tests & CI/CD** | <ul><li>Expanded Vitest suite to `20/20` tests (core math, FSM, cancellation flows, layout math)</li><li>Configured GitHub Actions (`npm test` → `tsc --noEmit` → `vite build` → GitHub Pages)</li></ul> |
