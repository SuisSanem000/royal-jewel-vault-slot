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
npm test        # Vitest unit & end-to-end flow tests (31/31 passing)
npm run build   # Strict TypeScript check (tsc --noEmit) + Vite bundle
npm run preview # Preview production build locally
```

---

## Gameplay & Controls

- **Base Game:** 5×3 grid, 20 fixed paylines (left-to-right, 3+ matching symbols), 8 provided gem/royal symbols + `symbol_overlay.png` win frames + procedural `WILD` and `SCATTER` emblems.
- **Bonus Game (Royal Free Spins):** 3 / 4 / 5 Scatters award `8 / 10 / 12` Free Spins with a progressive win multiplier (`1x → 2x → 3x → 5x`), Scatter re-triggers, `BONUS COMPLETE!` summary, and clean return to base play.
- **Controls & Shortcuts:**
  - `SPIN` / `Space` / `Enter`: Spin reels; press again mid-spin for **Quick Stop** (`STOP`).
  - `-` / `+` or `ArrowUp` / `ArrowDown`: Step bet (`1, 2, 5, 10, 20, 50` credits; locked during `AUTO` and `BONUS`).
  - `AUTO`, `TURBO` (`T`), `INFO` (`I`), `SFX ON` (`M`): Autoplay, fast stops, Paytable & Rules modal (`ESC` to close), Web Audio mute.
  - `FS`: Fullscreen toggle (shown only where `document.fullscreenEnabled` is supported).
  - `DEMO BONUS`: Guarantees a 3-Scatter trigger for quick evaluation.
  - `RESET` / `STOP ALL`: Always active; switches to **`STOP ALL`** during `AUTO` or `BONUS` to abort any running flow immediately and reset (`1000.00` balance, `5.00` bet).
  - `REFILL +1000`: Appears when idle and balance drops below the active bet.
- **Operator / Compliance Launch Params (URL Query):**
  - `?currency=EUR&locale=de-DE`: Formats all credits via `Intl.NumberFormat`.
  - `?ukgc=1&minSpinMs=2500`: Enforces minimum spin floor and disables `AUTO` / `TURBO` / Quick Stop.
  - `?realityCheckMin=15`: Displays a periodic `REALITY CHECK` session summary modal.
  - `?rgsUrl=https://...`: Switches from `LocalSlotBackend` to `RgsSlotBackend` (idempotent `Idempotency-Key` + retry + `CONNECTION LOST` recovery).

---

## Architecture

```text
royal-jewel-vault-slot/
├── scripts/normalize-assets.mjs   # Designer-asset renamer, 512×512 resizer & WebP atlas packer
├── public/assets/symbols/         # WebP texture atlas (symbols.webp + symbols.json) + PNGs
├── src/
│   ├── core/                      # Pure TypeScript — zero PixiJS or DOM imports
│   │   ├── types.ts               # Domain types (Grid, LineWin, BonusState, SpinResult, GameState)
│   │   ├── config.ts              # Paytable, 20 paylines, 5×28 virtual reel strips, bonus rules
│   │   ├── format.ts              # Intl.NumberFormat formatting & URL launch config parser
│   │   ├── backend.ts             # GameBackend interface, LocalSlotBackend & RgsSlotBackend
│   │   ├── rng.ts                 # Rng interface, MathRng & deterministic Mulberry32 SeededRng
│   │   ├── evaluator.ts           # Left-to-right payline, WILD substitution & SCATTER evaluator
│   │   ├── stateMachine.ts        # Guarded FSM + safe reset()
│   │   └── slotEngine.ts          # Balance accounting, spin resolution & Free Spins lifecycle
│   ├── presentation/              # PixiJS v8, GSAP timelines & Web Audio
│   │   ├── assets.ts              # Font wait + Spritesheet atlas loader (with progress & fallback)
│   │   ├── audio.ts               # Zero-dependency Web Audio synthesizer (iOS & tab-pause hardened)
│   │   ├── storage.ts             # Safe localStorage persistence (Private Mode / iframe guarded)
│   │   ├── layout.ts              # Pure dual-orientation stage & DPR math
│   │   ├── SlotStage.ts           # Adaptive stage, WebGL recovery, visibility pause & loading bar
│   │   ├── reels/                 # Masked 4-sprite ReelColumn + staggered 5×3 ReelGridView
│   │   └── ui/                    # Reflowable HudView + BonusHeaderBar, ModalBanner, PaytableModal
│   ├── controller/GameController.ts  # Mediates HUD, FSM, GameBackend & PresentationAdapter
│   └── main.ts                    # Bootstrap, launch params, visibility & keyboard shortcuts
└── tests/                         # 31/31 Vitest tests (core, presentation, controller)
```

---

## Technical Highlights

- **Decoupled Core & RGS Transport ([`backend.ts`](./src/core/backend.ts)):** `src/core/` has zero PixiJS/DOM imports; `GameController` talks to `GameBackend` (`LocalSlotBackend` or `RgsSlotBackend` with `Idempotency-Key`, retries, and disconnect recovery) and `PresentationAdapter`.
- **Spoiler-Free Presentation:** Outcomes resolve upfront in `SlotEngine.spin()`, while `WIN`, `BonusState`, and 2-Scatter anticipation glows reveal only as reels land.
- **PixiJS v8 + GSAP Pipeline:** 4-sprite recycled `ReelColumn` inside a `Graphics` mask, `Ticker`-driven scroll with `BlurFilter`, GSAP `back.out(2.2)` bounce, pulsing `symbol_overlay.png` frames, and clean `forceStop` / `killTweensOf` teardown.
- **Guarded FSM & Cancellation:** `ALLOWED_TRANSITIONS` prevents invalid states; `runId` cancellation tokens + `forceStop()` guarantee `STOP ALL` / `RESET` never leaves dangling timers or half-finished bonus flows.
- **Asset Normalization & WebP Atlas Pipeline ([`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs)):** Maps raw designer filenames, resizes `1254×1254` PNGs (`~9.7 MB`) to `512×512`, and packs them into a single `426.8 KB` WebP spritesheet (`symbols.webp` + validated `symbols.json`, >95% lighter).
- **Zero-Dependency Web Audio:** Synthesizes UI clicks, spin whooshes, pitched reel stops, win arpeggios, and bonus fanfares with no external audio files.

---

## Responsiveness, Mobile & Cross-Browser Engineering

- **Dual-Orientation Virtual Stage ([`layout.ts`](./src/presentation/layout.ts), [`SlotStage.ts`](./src/presentation/SlotStage.ts)):** Auto-switches between `1280×720` (desktop/landscape) and `820×1060` (portrait when `h > w × 1.05`).
- **Thumb-Zone Mobile HUD & Modal Scaling ([`HudView.ts`](./src/presentation/ui/HudView.ts), [`Overlays.ts`](./src/presentation/ui/Overlays.ts)):** Portrait mode reflows into a `780×352` 3-row card (`360×96` `SPIN`, `56×56` `-`/`+`, `170×68` toggles); `PaytableModal` and `ModalBanner` auto-center, word-wrap, and scale to fit narrow screens.
- **Viewport, Notches & Touch ([`index.html`](./index.html)):** Uses `100dvh` (`100%` fallback), `viewport-fit=cover`, `env(safe-area-inset-*)` padding, `overscroll-behavior: none`, `touch-action`, and `-webkit-tap-highlight-color: transparent` without blocking accessibility zoom.
- **Browser Zoom & DPR Cap:** Clamps `devicePixelRatio` to `[1, 2]` and updates `renderer.resolution` live on `window.resize`, `visualViewport.resize`, and `screen.orientation` changes.
- **WebGL Context Loss & Tab Visibility:** `webglcontextlost`/`webglcontextrestored` DOM recovery overlay; `visibilitychange`/`blur` pauses PixiJS `Ticker`, GSAP, and Web Audio.
- **Texture Atlas & Font Preloading:** [`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs) packs all 9 symbols into a single `426.8 KB` WebP spritesheet (`symbols.webp` + `symbols.json`, >95% smaller than raw `9.7 MB` PNGs) loaded with a live `%` progress bar after `document.fonts.ready`.
- **Accessibility & Persistence:** `prefers-reduced-motion` disables blur, bounce, and sparkles; `localStorage` persists mute/turbo/bet safely inside `try/catch` (Private Mode & sandboxed iframe safe).

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
| 10 | **Automated Tests & CI/CD** | <ul><li>Expanded Vitest suite to `31/31` tests (core math, formatting, RGS backend, storage, cancellation, UKGC/Reality Check, layout)</li><li>Configured GitHub Actions (`npm test` → `tsc --noEmit` → `vite build` → GitHub Pages)</li></ul> |
| 11 | **Production Web-Game & iGaming Standards** | <ul><li>Upgraded asset pipeline to single WebP atlas (`426.8 KB`), added WebGL context recovery, `visibilitychange` pause, `prefers-reduced-motion`, and `localStorage` preferences</li><li>Added `Intl.NumberFormat` launch params, UKGC spin-floor/locks, Reality Check modal, Fullscreen toggle, and `RgsSlotBackend` disconnect recovery</li></ul> |
