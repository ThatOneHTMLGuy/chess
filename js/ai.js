/*
  ai.js — evaluation (material + piece-square tables + mop-up) and the
  alpha-beta / quiescence / iterative-deepening search. Depends on
  rules.js for move generation and simulation.
*/
'use strict';

const PIECE_VALUE = {P:100,N:320,B:330,R:500,Q:900,K:20000};
const MATE_VALUE = 1000000;

/* Piece-square tables (white's perspective, row0=rank8..row7=rank1).
   These give the AI positional understanding instead of pure material
   counting, so it develops pieces sensibly and improves king safety. */
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0
];
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];
const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];
const PST_KING_END = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -40,-20,-10,  0,  0,-10,-20,-40,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -20,  0, 30, 40, 40, 30,  0,-20,
  -20,  0, 30, 40, 40, 30,  0,-20,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -40,-20,-10,  0,  0,-10,-20,-40,
  -50,-40,-30,-20,-20,-30,-40,-50
];
const PST_TABLES = {P:PST_PAWN,N:PST_KNIGHT,B:PST_BISHOP,R:PST_ROOK,Q:PST_QUEEN};
const ENDGAME_MATERIAL_THRESHOLD = 2600; // combined non-pawn material below which we treat it as an endgame
const QUIESCENCE_MAX_DEPTH = 4;
const AI_TIME_BUDGET_MS = 3000; // hard cap so a deep search can never hang/crash the tab
const MOVE_VARIETY_MARGIN_CP = 25; // moves within this many centipawns of the best are treated as "equally good"

/* Thrown to unwind the search once the time budget is used up. Caught only
   in findBestMoveFor, which falls back to the best move found at the last
   depth that finished in time (standard iterative-deepening time control). */
function SearchTimeout(){}
SearchTimeout.prototype = Object.create(Error.prototype);

function checkSearchTimeout(){
  if(Date.now() > searchDeadline) throw new SearchTimeout();
}

/* Total non-king, non-pawn material still on the board (both sides).
   A low value means most pieces are traded off, so we switch to
   endgame-style evaluation (active king, drive the enemy king to the edge). */
function isEndgamePhase(){
  let nonPawnMaterial = 0;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(p && p.type !== 'P' && p.type !== 'K') nonPawnMaterial += (PIECE_VALUE[p.type]||0);
    }
  }
  return nonPawnMaterial <= ENDGAME_MATERIAL_THRESHOLD;
}

function materialByColor(color){
  let total = 0;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(p && p.color === color) total += (PIECE_VALUE[p.type]||0);
    }
  }
  return total;
}

function centerManhattanDistance(row,col){
  const distRow = Math.max(3-row, row-4);
  const distCol = Math.max(3-col, col-4);
  return distRow + distCol;
}

/* "Mop-up" evaluation: once one side has a decisive material lead,
   this rewards pushing the enemy king toward the edge/corner and
   bringing the winning king closer to it — the technique actually
   required to force checkmate instead of just sitting on the material. */
function mopUpEval(){
  const wMat = materialByColor('w');
  const bMat = materialByColor('b');
  const wKing = findKing('w');
  const bKing = findKing('b');
  if(!wKing || !bKing) return 0;
  let score = 0;
  if(wMat - bMat > 400){
    const cmd = centerManhattanDistance(bKing.row, bKing.col);
    const kingDist = Math.abs(wKing.row-bKing.row) + Math.abs(wKing.col-bKing.col);
    score += cmd*10 + (14-kingDist)*4;
  } else if(bMat - wMat > 400){
    const cmd = centerManhattanDistance(wKing.row, wKing.col);
    const kingDist = Math.abs(wKing.row-bKing.row) + Math.abs(wKing.col-bKing.col);
    score -= cmd*10 + (14-kingDist)*4;
  }
  return score;
}

function evaluateBoard(){
  let score = 0;
  const endgame = isEndgamePhase();
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(!p) continue;
      const val = (PIECE_VALUE[p.type] || 0);
      const table = p.type === 'K' ? (endgame ? PST_KING_END : PST_KING_MID) : PST_TABLES[p.type];
      const idx = p.color === 'w' ? (r*8+c) : ((7-r)*8+c);
      const pst = table ? table[idx] : 0;
      const total = val + pst;
      score += (p.color === 'w' ? total : -total);
    }
  }
  score += mopUpEval();
  return score;
}

function orderMoves(moves){
  moves.sort((a,b)=>{
    const av = a.captured ? (PIECE_VALUE[a.captured] || 0) : 0;
    const bv = b.captured ? (PIECE_VALUE[b.captured] || 0) : 0;
    return bv - av;
  });
  return moves;
}

/* Quiescence search: at the end of the main search, keep resolving
   captures until the position is "quiet". Without this, the AI can
   stop searching right after a losing trade and misjudge the position
   (the classic horizon-effect blunder of shallow material-only engines). */
function quiescence(alpha, beta, color, qDepth){
  checkSearchTimeout();
  const standPat = evaluateBoard();
  if(qDepth <= 0) return standPat;

  if(color === 'w'){
    if(standPat >= beta) return beta;
    if(alpha < standPat) alpha = standPat;
  } else {
    if(standPat <= alpha) return alpha;
    if(beta > standPat) beta = standPat;
  }

  const captures = orderMoves(generateAllLegalMoves(color).filter(m => m.captured));
  for(const m of captures){
    const undo = makeMoveSim(m.fr,m.fc,m.tr,m.tc);
    let score;
    try {
      score = quiescence(alpha, beta, color === 'w' ? 'b' : 'w', qDepth-1);
    } finally {
      undoMoveSim(undo);
    }
    if(color === 'w'){
      if(score > alpha) alpha = score;
      if(alpha >= beta) return beta;
    } else {
      if(score < beta) beta = score;
      if(beta <= alpha) return alpha;
    }
  }
  return color === 'w' ? alpha : beta;
}

function minimax(depth, alpha, beta, color){
  checkSearchTimeout();
  if(depth === 0) return quiescence(alpha, beta, color, QUIESCENCE_MAX_DEPTH);
  const moves = generateAllLegalMoves(color);
  if(moves.length === 0){
    const kingPos = findKing(color);
    const inCheck = kingPos && isSquareAttacked(kingPos.row, kingPos.col, color === 'w' ? 'b' : 'w');
    // Bias the mate score by remaining depth so a forced mate found
    // sooner (more depth left) scores higher than one found deeper in
    // the tree — this makes the AI actually walk toward mate instead
    // of treating every mate as equally good and shuffling pieces.
    if(inCheck) return color === 'w' ? -(MATE_VALUE + depth) : (MATE_VALUE + depth);
    return 0;
  }

  orderMoves(moves);

  if(color === 'w'){
    let maxEval = -Infinity;
    for(const m of moves){
      const undo = makeMoveSim(m.fr,m.fc,m.tr,m.tc);
      let evalScore;
      try {
        evalScore = minimax(depth-1, alpha, beta, 'b');
      } finally {
        undoMoveSim(undo);
      }
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if(beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for(const m of moves){
      const undo = makeMoveSim(m.fr,m.fc,m.tr,m.tc);
      let evalScore;
      try {
        evalScore = minimax(depth-1, alpha, beta, 'w');
      } finally {
        undoMoveSim(undo);
      }
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if(beta <= alpha) break;
    }
    return minEval;
  }
}

function findBestMoveFor(color, depth){
  const allMoves = generateAllLegalMoves(color);
  if(allMoves.length === 0) return null;
  orderMoves(allMoves);

  searchDeadline = Date.now() + AI_TIME_BUDGET_MS;

  let overallBest = allMoves[0];
  for(let d=1; d<=depth; d++){
    let bestMove = null;
    let bestScore = color === 'w' ? -Infinity : Infinity;
    const scored = []; // every move's score at this depth, so we can pick among near-ties below
    try {
      for(const m of allMoves){
        const undo = makeMoveSim(m.fr,m.fc,m.tr,m.tc);
        let score;
        try {
          score = minimax(d-1, -Infinity, Infinity, color === 'w' ? 'b' : 'w');
        } finally {
          undoMoveSim(undo);
        }
        scored.push({move:m, score});
        if(color === 'w'){
          if(score > bestScore){ bestScore = score; bestMove = m; }
        } else {
          if(score < bestScore){ bestScore = score; bestMove = m; }
        }
      }
    } catch(err){
      if(err instanceof SearchTimeout) break; // ran out of time mid-depth; keep the last completed depth's result
      throw err;
    }
    if(!bestMove) break; // timed out before even the first move at this depth finished

    // Rather than always taking the single top move (which makes the AI
    // deterministic and repetitive from the same position), pick randomly
    // among every move whose score is within a small margin of the best.
    // Mate scores dwarf this margin, so a forced mate is never skipped.
    const candidates = scored.filter(s => color === 'w'
      ? s.score >= bestScore - MOVE_VARIETY_MARGIN_CP
      : s.score <= bestScore + MOVE_VARIETY_MARGIN_CP);
    overallBest = candidates[Math.floor(Math.random() * candidates.length)].move;

    // Move the best move from this depth to the front so the next, deeper
    // iteration searches it first — better move ordering means better
    // alpha-beta pruning, and it's also our fallback if that depth times out.
    const idx = allMoves.indexOf(bestMove);
    if(idx > 0){ allMoves.splice(idx,1); allMoves.unshift(bestMove); }
  }
  return overallBest;
}

function makeAIMove(){
  if(aiBusy || !aiEnabled || aiColor !== currentTurn) return;
  aiBusy = true;
  setTimeout(()=>{
    try{
      const best = findBestMoveFor(aiColor, aiDepth);
      if(best){
        applyMove(best.fr,best.fc,best.tr,best.tc);
        renderBoard();
        if(!checkGameStatus()) maybeTriggerAI();
      } else {
        checkGameStatus();
      }
    } catch(err){
      safeError('AI move error:', err);
    } finally {
      aiBusy = false;
    }
  }, 50);
}

function maybeTriggerAI(){
  if(aiEnabled && aiColor === currentTurn) setTimeout(makeAIMove, 120);
}
