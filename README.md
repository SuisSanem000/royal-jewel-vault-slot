# Royal Jewel Vault — PixiJS Slot Game

> **Live Demo:** https://suissanem000.github.io/royal-jewel-vault-slot/

A client-side 5×3 video slot game built with **PixiJS v8**, **TypeScript**, **Vite**, **GSAP**, and **Vitest**, featuring strict separation between game logic and rendering.

---

## Quick Start (Run Locally)

**Prerequisites:** Node.js 18+ (or Bun) and `npm`.

```bash
cd game
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
game/
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
