# <img src="./public/favicon.png" alt="Royal Jewel Vault" width="32" align="absmiddle" /> Royal Jewel Vault — PixiJS Slot Game

> **Live Demo:** https://suissanem000.github.io/royal-jewel-vault-slot/

A client-side 5×3 video slot game built with **PixiJS v8**, **TypeScript**, **Vite**, **GSAP**, and **Vitest**, featuring strict separation between game logic and rendering.

---

## Quick Start (Run Locally)

**Prerequisites:** Node.js 18+ (or Bun) and `npm`.

```bash
git clone https://github.com/SuisSanem000/royal-jewel-vault-slot.git
cd royal-jewel-vault-slot
npm install
npm run dev
```

Open the local URL printed by Vite (default: `http://localhost:5173`).

### Run Automated Tests & Production Build

```bash
npm test        # Runs unit & end-to-end flow tests (Vitest)
npm run build   # Type-checks with tsc and builds production bundle into dist/
npm run preview # Preview the production build locally
```

---

## Features & Controls

- **Base Game:** 5 reels × 3 rows, 20 fixed paylines (left-to-right), all 8 provided gem/royal symbols + `symbol_overlay.png` pulsing win frames, plus cohesive `WILD` and `SCATTER` emblems.
- **Bonus Game (Royal Free Spins):** Triggered by 3+ `SCATTER` symbols anywhere (`8 / 10 / 12` Free Spins). Shifts to a crimson-violet bonus mood with a progressive win multiplier (`1x → 2x → 3x → 5x`), re-triggers, bonus win summary, and clean return to the base game.
- **Controls:**
  - `SPIN` button or `Space` key to spin (click / press `Space` again mid-spin for **Quick Stop**).
  - `-` / `+` to adjust bet (`1`–`50` credits); `AUTO` for auto-spin; `INFO` for paytable; `SFX ON / MUTED` for Web Audio sound effects.
  - **`DEMO BONUS`** button (top-right of HUD) triggers a guaranteed 3-Scatter spin on demand for convenient bonus testing.
  - **`REFILL +1000`** appears automatically if balance drops below the current bet.

---

## Architecture Overview

```text
royal-jewel-vault-slot/
├── public/assets/symbols/     # Normalized, 512×512 optimized PNG copies of provided symbols
├── src/
│   ├── core/                  # Pure TypeScript game logic (ZERO PixiJS/DOM imports)
│   │   ├── types.ts           # Domain types (Grid, LineWin, BonusState, SpinResult, GameState)
│   │   ├── config.ts          # Paytable, 20 paylines, weighted reel strips, bonus rules
│   │   ├── rng.ts             # Rng interface + MathRng + deterministic SeededRng
│   │   ├── evaluator.ts       # Pure payline, Wild, and Scatter evaluator
│   │   ├── stateMachine.ts    # Guarded FSM enforcing valid game state transitions
│   │   └── slotEngine.ts      # Balance, bet, spin resolution & Free Spins lifecycle
│   ├── presentation/          # PixiJS v8 rendering, GSAP animations & Web Audio SFX
│   │   ├── assets.ts          # Asset preloader + procedural WILD/SCATTER emblem textures
│   │   ├── audio.ts           # Procedural Web Audio API sound effects
│   │   ├── SlotStage.ts       # Responsive 1280×720 virtual stage & win sparkle particles
│   │   ├── reels/             # Masked ReelColumn + staggered 5×3 ReelGridView
│   │   └── ui/                # HudView + BonusHeaderBar, ModalBanner, PaytableModal
│   ├── controller/
│   │   └── GameController.ts  # Mediates input, FSM, SlotEngine, and PresentationAdapter
│   └── main.ts                # Application bootstrap
└── tests/
    ├── core/                  # Unit tests for evaluator, stateMachine, slotEngine
    └── controller/            # End-to-end base + bonus flow tests via mock adapter
```

---

## Technical Choices & Design Rationale

- **Strict Logic vs. Rendering Separation (`src/core/` vs. `src/presentation/`):**
  `src/core/` is pure TypeScript with zero PixiJS or DOM imports. `GameController` mediates between `SlotEngine` and a `PresentationAdapter` interface so swapping local simulation for a remote game server (RGS) requires touching only one boundary—leaving all PixiJS rendering intact.
- **PixiJS v8 + GSAP:**
  PixiJS v8 `Ticker` drives smooth 60fps masked reel scrolling (`ReelColumn`), while GSAP handles declarative timelines (`back.out(2.2)` landing bounce, pulsing `symbol_overlay.png` win frames, rolling win count-ups) and clean interruption (`killTweensOf`) for instant Quick Stop.
- **Guarded Finite State Machine (`GameStateMachine`):**
  An explicit `ALLOWED_TRANSITIONS` table (`BOOT -> IDLE -> SPINNING -> EVALUATING -> WIN_PRESENTATION -> BONUS_* -> IDLE`) prevents double-spins, mid-spin bet changes, and invalid bonus state transitions.
- **Proactive Asset Optimization:**
  Normalized inconsistent raw filenames and downscaled symbol textures to `512×512` (~2.2 MB total vs. ~9.7 MB raw) for fast WebGL loading while preserving retina sharpness, alongside matching gold-and-ruby procedural `WILD` and `SCATTER` emblems.
- **Zero-Dependency Procedural Web Audio:**
  Sound effects (clicks, spins, pitched reel stops, win arpeggios, bonus fanfares) are synthesized via the Web Audio API with a Mute toggle, avoiding external audio asset loading overhead.
- **Deterministic Testing & CI/CD (`SeededRng` + Vitest + GitHub Pages):**
  A Mulberry32 `SeededRng` enables reproducible unit tests for 20-payline evaluation, Wild/Scatter rules, balance invariants, and end-to-end Free Spins flows (`10/10` tests passing), automatically verified and deployed via GitHub Actions.
