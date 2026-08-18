# Play Chess

A self-contained, single-page chess game with drag-and-drop or click-to-move,
full rule enforcement (castling, promotion, check/checkmate/stalemate), move
history navigation, sound effects, and an adjustable-strength AI opponent.
No build step, no dependencies — just open `index.html`.

## Getting started

1. Make sure your project folder looks like this:

   ```
   your-project/
   ├── index.html
   ├── styles.css
   ├── js/
   │   ├── state.js
   │   ├── audio.js
   │   ├── rules.js
   │   ├── ai.js
   │   ├── render.js
   │   ├── ui.js
   │   └── main.js
   ├── pieces/
   │   ├── wk.png  wq.png  wr.png  wb.png  wn.png  wp.png
   │   └── bk.png  bq.png  br.png  bb.png  bn.png  bp.png
   ├── sounds/
   │   ├── move.mp3
   │   ├── capture.mp3
   │   ├── check.mp3
   │   └── checkmate.mp3
   ├── highlight.png
   ├── arrow-left.png
   └── arrow-right.png
   ```

2. Open `index.html` in a browser. That's it — everything runs client-side.

   If a piece/sound/arrow image is missing, the game still works: pieces
   just won't render, sounds fail silently, and the move-history arrows
   fall back to plain text `←` / `→`.

## Features

- **Full rules**: legal move generation, castling (kingside/queenside),
  pawn promotion (auto-promotes to queen), check/checkmate/stalemate
  detection.
- **Two input methods**: click a piece then click a destination, or drag
  and drop.
- **Move history**: every move is snapshotted; use the arrow buttons to
  step back and forward through the game. Making a new move from a
  past position isn't supported — the arrows are for review only.
- **In-check indicator**: the checked king's square gets a pulsing red
  outline.
- **Sound effects**: distinct sounds for an ordinary move, a capture, a
  check, and a checkmate (priority: checkmate > check > capture > move).
- **Game-over popup**: a styled modal for checkmate/stalemate instead of
  a browser `alert()`.
- **AI opponent**: toggle on/off, pick which color it plays, and choose
  a search depth (1–6) from the controls above the board.

# 🔴 Live Demo

- **[Chess](https://thatonehtmlguy.github.io/chess/)**


## How the AI works

The AI is a classical alpha-beta search, not a neural engine:

- **Evaluation** = material (`ai.js` → `PIECE_VALUE`) + piece-square
  tables (positional bonuses/penalties per square, per piece type) +
  a "mop-up" term that, once one side has a decisive material lead,
  rewards driving the enemy king to the edge and bringing the winning
  king closer — the technique actually needed to convert a winning
  position into checkmate rather than just shuffling.
- **Search** = iterative deepening alpha-beta (depth 1, then 2, then 3...
  up to the selected depth) with a **3-second time budget**
  (`AI_TIME_BUDGET_MS` in `ai.js`). If a deeper pass doesn't finish in
  time, the AI falls back to the best move found at the last depth that
  *did* finish — so higher depth settings degrade gracefully instead of
  freezing the page.
- **Quiescence search** extends the search through capture sequences at
  the end of each branch, so it doesn't misjudge a position right after
  a trade (the classic "horizon effect").
- **Move variety**: rather than always playing the single top-scored
  move, the AI randomly picks among every move within a small margin
  (`MOVE_VARIETY_MARGIN_CP`, 25 centipawns) of the best score at the
  deepest completed depth. This keeps play strong while avoiding
  repeating the exact same game every time. A forced mate is never
  skipped by this — mate scores are far outside that margin.

Tuning knobs, all in `ai.js`:

| Constant | Purpose |
|---|---|
| `AI_TIME_BUDGET_MS` | Max thinking time per move, in milliseconds |
| `MOVE_VARIETY_MARGIN_CP` | How close (in centipawns) a move's score must be to the best to be considered for random selection |
| `QUIESCENCE_MAX_DEPTH` | How many extra plies of captures the quiescence search resolves |
| `ENDGAME_MATERIAL_THRESHOLD` | Combined non-pawn material below which the AI switches to endgame-style king evaluation |

## File structure

The app is split into plain `<script>` files (no bundler, no ES modules —
so it works straight off the filesystem via `file://`, no local server
needed). They're loaded in dependency order in `index.html` and share one
global scope, so later files can use functions/variables declared in
earlier ones.

| File | Responsibility |
|---|---|
| `js/state.js` | All shared mutable game state (board, turn, AI settings, drag state, move history) and DOM element references. Loaded first. |
| `js/audio.js` | Sound effect config and playback (`playSound`). |
| `js/rules.js` | The chess rules engine: board setup, move legality, applying moves, and the make/undo move simulation used by the AI search. No DOM code. |
| `js/ai.js` | Evaluation and search: piece-square tables, `evaluateBoard`, quiescence search, minimax with alpha-beta pruning, iterative deepening, `makeAIMove`. |
| `js/render.js` | Drawing the board: piece images, highlights, the in-check outline, legal-move dots. |
| `js/ui.js` | User interaction: click-to-move, drag & drop, move-history navigation, checkmate/stalemate detection, the game-over modal. |
| `js/main.js` | Builds the New Game / AI toggle / color / depth / history-arrow controls and boots the app on `DOMContentLoaded`. Loaded last. |
| `styles.css` | All visual styling — board, pieces, controls, modal, dropdowns. |
| `index.html` | Page structure and the `<script>` tags that wire everything together. |

## Known limitations

- No en passant.
- No draw by repetition or 50-move rule — only checkmate and stalemate
  end the game.
- The move-history arrows are for reviewing past positions, not for
  branching/editing the game from an earlier point.
- The AI runs synchronously on the main thread (no Web Worker), so the
  page is unresponsive while it's thinking. This is bounded by the
  3-second time budget above.
