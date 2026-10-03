# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build tools or dependencies required. Two options:

```bash
# Python (recommended)
python3 -m http.server 8000
# Then open http://localhost:8000

# Or just open index.html directly in a browser
```

## Architecture

This is a **vanilla JavaScript Tetris** with zero dependencies — no npm, no bundler, no framework.

**Three files, one game:**
- `index.html` — DOM structure: main canvas (300×600px), next-piece preview canvas (120×120px), HUD elements (score/lines/level), pause/game-over overlay
- `game.js` — All game logic (~305 lines)
- `style.css` — Dark retro arcade styling

## game.js Structure

**Constants** (top of file): `COLS=10`, `ROWS=20`, `BLOCK=30` (px), `COLORS[]` (indexed 1–7), `PIECES[]` (2D arrays indexed 1–7), `LINE_SCORES[]`

**State variables** (module-level `let`): `board` (2D array), `current`/`next` (piece objects with `{type, shape, x, y}`), `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`

**Key functions and their roles:**
- `collide(shape, ox, oy)` — collision detection against walls and locked board cells; `ny < 0` skips ceiling (allows spawn above grid)
- `tryRotate()` — clockwise rotation with wall-kick offsets `[0, -1, 1, -2, 2]`
- `lockPiece()` → `merge()` + `clearLines()` + `spawn()` — the piece settling sequence
- `clearLines()` — scans bottom-up, splices full rows, prepends empty row; also updates level and `dropInterval`
- `ghostY()` — projects current piece downward until collision; used for ghost rendering and hard drop
- `draw()` — clears canvas, draws grid, locked board, ghost (alpha=0.2), current piece
- `loop(ts)` — `requestAnimationFrame` loop; accumulates delta time, triggers gravity drop when `dropAccum >= dropInterval`
- `init()` — full game reset, called on page load and restart button click

**Speed curve:** `dropInterval = Math.max(100, 1000 - (level - 1) * 90)` ms — floors at 100ms

**Scoring:** `LINE_SCORES[cleared] * level` for line clears; +1 per cell for soft drop; +2 per cell for hard drop

## GitHub Actions

- `.github/workflows/claude.yml` — Claude Code interactive assistant (triggers on issue/PR comments mentioning `@claude`)
- `.github/workflows/claude-code-review.yml` — Automated code review on pull requests
