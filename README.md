# <img src="./public/favicon.png" alt="Royal Jewel Vault" width="32" align="absmiddle" /> Royal Jewel Vault — PixiJS Slot Game

> **Live Demo:** https://suissanem000.github.io/royal-jewel-vault-slot/

A client-side **5×3, 20-payline video slot game** built with **PixiJS v8**, **TypeScript (strict)**, **Vite**, **GSAP**, and **Vitest**, architected with strict separation between pure game math/state and rendering.

---

## Quick Start

**Prerequisites:** Node.js 18+ and `npm`.

```bash
git clone https://github.com/SuisSanem000/royal-jewel-vault-slot.git
cd royal-jewel-vault-slot
npm install
npm run dev
```

Open the local URL printed by Vite (default: `http://localhost:5173`).

### Tests & Production Build

```bash
npm test        # Runs Vitest unit & end-to-end flow tests
npm run build   # Strict TypeScript check (tsc --noEmit) + Vite production bundle (dist/)
npm run preview # Preview the production bundle locally
```

---

## Gameplay & Controls

- **Base Game:** 5 reels × 3 rows, 20 fixed paylines (left-to-right, 3+ matching symbols). Uses all 8 provided gem/royal symbols plus `symbol_overlay.png` pulsing win frames, paired with custom gold-and-ruby `WILD` and `SCATTER` emblems.
- **Bonus Game (Royal Free Spins):** Triggered by 3 / 4 / 5 `SCATTER` symbols anywhere (`8 / 10 / 12` Free Spins). Transitions into a crimson-violet bonus state with a persistent progressive multiplier (`1x → 2x → 3x → 5x` stepping up on each winning bonus spin), Scatter re-triggers, a `BONUS COMPLETE!` summary modal, and a clean return to base play.
- **Controls:**
  - `SPIN` button or `Space` key to spin; click `STOP` or press `Space` again mid-spin for **Quick Stop**.
  - `-` / `+` adjusts bet (`1, 2, 5, 10, 20, 50` credits; locked during active Free Spins).
  - `AUTO` toggles continuous spins; `TURBO` toggles fast reel stops; `INFO` opens the visual Paytable & Rules modal (`ESC` / `Space` / click to close); `SFX ON / MUTED` toggles procedural Web Audio sound effects.
  - **`DEMO BONUS`** (top-right of HUD) guarantees a 3-Scatter spin so evaluators can inspect the full Bonus Game flow on demand.
  - **`REFILL +1000`** appears automatically if balance drops below the current bet.

---

## Architecture & Project Structure

```text
royal-jewel-vault-slot/
├── scripts/
│   └── normalize-assets.mjs   # Automated designer-asset renamer & resizer (512×512)
├── public/assets/symbols/     # Normalized, 512×512 optimized PNG copies of provided symbols
├── src/
│   ├── core/                  # PURE TypeScript — ZERO PixiJS or DOM imports
│   │   ├── types.ts           # Immutable domain types (Grid, LineWin, BonusState, SpinResult, GameState)
│   │   ├── config.ts          # Data-driven paytable, 20 paylines, 5×28 virtual reel strips, bonus rules
│   │   ├── rng.ts             # Rng interface + MathRng + deterministic Mulberry32 SeededRng
│   │   ├── evaluator.ts       # Left-to-right payline, WILD substitution, and SCATTER evaluator
│   │   ├── stateMachine.ts    # Guarded FSM enforcing valid state transitions
│   │   └── slotEngine.ts      # Balance accounting, spin resolution & Free Spins lifecycle
│   ├── presentation/          # PixiJS v8 rendering, GSAP timelines & Web Audio SFX
│   │   ├── assets.ts          # PixiJS Assets preloader + procedural WILD/SCATTER emblem textures
│   │   ├── audio.ts           # Zero-dependency Web Audio API sound synthesizer
│   │   ├── SlotStage.ts       # Responsive 1280×720 virtual stage, loading state & sparkle particles
│   │   ├── reels/             # Masked 4-sprite ReelColumn + staggered 5×3 ReelGridView
│   │   └── ui/                # HudView + BonusHeaderBar, ModalBanner, visual PaytableModal
│   ├── controller/
│   │   └── GameController.ts  # Mediates HUD input, FSM, SlotEngine, and PresentationAdapter
│   └── main.ts                # Application bootstrap & keyboard shortcuts
└── tests/
    ├── core/                  # Unit tests for evaluator, stateMachine, slotEngine
    └── controller/            # End-to-end base + bonus flow tests via mock PresentationAdapter
```

---

## Technical Choices & Design Rationale

1. **Strict Logic vs. Rendering Separation (`src/core/` & `PresentationAdapter`):**
   `src/core/` contains zero PixiJS or browser DOM imports. `GameController` mediates between `SlotEngine` and a `PresentationAdapter` interface so replacing local RNG simulation with a remote game server (RGS) API requires changing only the controller's spin fetch—leaving every PixiJS scene, reel, and animation untouched.
2. **Spoiler-Free Result Presentation:**
   `SlotEngine.spin()` resolves outcomes upfront, while `GameController` intentionally withholds the updated `BonusState` and `WIN` payout until `ReelGridView.spinTo()` lands the final reel. Similarly, 2-Scatter anticipation glows only activate dynamically as each reel visually lands.
3. **PixiJS v8 + GSAP Animation Pipeline:**
   Each `ReelColumn` recycles 4 sprites inside a `Graphics`-masked `Container` driven by PixiJS's 60fps `Ticker` with a vertical `BlurFilter` during high-speed scroll. GSAP handles declarative timelines (`back.out(2.2)` landing bounce, pulsing `symbol_overlay.png` win frames, winning symbol scale pop with non-winner dimming, and rolling win count-ups) with clean `killTweensOf` cancellation on Quick Stop.
4. **Guarded Finite State Machine (`GameStateMachine`):**
   An explicit `ALLOWED_TRANSITIONS` table (`BOOT → IDLE → SPINNING → EVALUATING → WIN_PRESENTATION → BONUS_INTRO → BONUS_ACTIVE → BONUS_OUTRO → IDLE`) prevents double-spins, mid-spin bet changes, and invalid bonus transitions.
5. **Proactive Asset Normalization Pipeline ([`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs)):**
   Designer handoffs often arrive with inconsistent naming (`symbol_high3.png`, `Symbol high_4.png`, `symbol_low4.png`) and oversized `1254×1254` textures (~9.7 MB total). I separated this step into [`scripts/normalize-assets.mjs`](./scripts/normalize-assets.mjs) (`npm run assets:normalize`) to automatically map raw filenames to clean canonical names and downscale copies to `512×512` (~2.2 MB total, ~77% smaller) for fast WebGL loading. Keeping it isolated makes it straightforward to extend into a full studio asset tool (spritesheet/atlas packing, WebP conversion, and schema validation). Alongside these, `WILD` and `SCATTER` emblems are procedurally generated in matching gold-and-ruby style.
6. **Zero-Dependency Procedural Web Audio:**
   Button clicks, spin whooshes, pitched per-reel stop thuds, win arpeggios, and bonus fanfares are synthesized via the Web Audio API, eliminating external audio file loading or licensing overhead.
7. **Deterministic Testing & Automated CI/CD:**
   A Mulberry32 `SeededRng` makes payline, Wild/Scatter, and Free Spins tests 100% reproducible (`10/10` Vitest tests passing). Every push to `main` automatically runs `npm test` and `npm run build` via GitHub Actions before deploying to GitHub Pages.
