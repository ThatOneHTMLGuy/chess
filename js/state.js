/*
  state.js — shared game state, DOM element references, and small log
  helpers used by every other file. Loaded first so everything else can
  read/write these directly (classic scripts sharing the same global
  lexical scope — no bundler, no window.* namespace needed).
*/
'use strict';

/* ========== STATE ========= */
let board = [];
let currentTurn = 'w';
let selected = null;
let moved = {wK:false,bK:false,wR0:false,wR7:false,bR0:false,bR7:false};
let lastMoveFrom = null;
let lastMoveTo = null;
let lastMoveWasCapture = false;

let aiEnabled = false;
let aiColor = 'b';
let aiDepth = 3;
let boardFlipped = false;
let searchDeadline = Infinity; // wall-clock cutoff used by the search to avoid runaway think time

let dragging = null;
let isPointerDragging = false;
let aiBusy = false;

// History
let historySnapshots = [];
let snapshotIndex = -1;
let viewingSnapshot = false;

/* ========== DOM refs ========= */
let boardEl = null;
let turnIndicator = null;
let newGameBtn = null;
let controlsEl = null;
let prevBtn = null;
let nextBtn = null;

/* ========== UTILITIES ========== */
function safeLog(...args){ if(window.console) console.log(...args); }
function safeError(...args){ if(window.console) console.error(...args); }
