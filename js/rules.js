/*
  rules.js — the chess rules engine: board setup, move legality, applying
  moves, and the make/undo simulation used by the AI search. No DOM code
  lives here on purpose, so this file can be reasoned about (or reused)
  in isolation from rendering/UI.
*/
'use strict';

/* ========== BOARD & RULES ========= */
function createInitialBoard(){
  board = [];
  board.push([{type:'R',color:'b'},{type:'N',color:'b'},{type:'B',color:'b'},{type:'Q',color:'b'},{type:'K',color:'b'},{type:'B',color:'b'},{type:'N',color:'b'},{type:'R',color:'b'}]);
  board.push(Array(8).fill(null).map(()=>({type:'P',color:'b'})));
  for(let r=2;r<6;r++) board.push(Array(8).fill(null));
  board.push(Array(8).fill(null).map(()=>({type:'P',color:'w'})));
  board.push([{type:'R',color:'w'},{type:'N',color:'w'},{type:'B',color:'w'},{type:'Q',color:'w'},{type:'K',color:'w'},{type:'B',color:'w'},{type:'N',color:'w'},{type:'R',color:'w'}]);
  moved = {wK:false,bK:false,wR0:false,wR7:false,bR0:false,bR7:false};
  lastMoveFrom = lastMoveTo = null;
}

function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
function isPathClear(fr,fc,tr,tc){
  const dr = Math.sign(tr-fr), dc = Math.sign(tc-fc);
  let r = fr + dr, c = fc + dc;
  while(r !== tr || c !== tc){
    if(board[r][c]) return false;
    r += dr; c += dc;
  }
  return true;
}
function findKing(color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.type === 'K' && p.color === color) return {row:r,col:c};
  }
  return null;
}
function isSquareAttacked(r,c,byColor){
  for(let i=0;i<8;i++) for(let j=0;j<8;j++){
    const p = board[i][j];
    if(p && p.color === byColor && isLegalMove(p,i,j,r,c,true)) return true;
  }
  return false;
}

function isLegalMove(p,fr,fc,tr,tc,ignoreCheck=false){
  if(!p) return false;
  if(!inBounds(tr,tc)) return false;
  const dest = board[tr][tc];
  if(dest && dest.color === p.color) return false;
  const dr = tr - fr, dc = tc - fc;
  let legal = false;
  switch(p.type){
    case 'P': {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      if(dc === 0){
        if(dr === dir && !dest) legal = true;
        if(fr === startRow && dr === 2*dir && !dest && board[fr+dir][fc] == null) legal = true;
      }
      if(dr === dir && Math.abs(dc) === 1 && dest) legal = true;
      break;
    }
    case 'N':
      if((Math.abs(dr)===2 && Math.abs(dc)===1) || (Math.abs(dr)===1 && Math.abs(dc)===2)) legal = true;
      break;
    case 'B':
      if(Math.abs(dr) === Math.abs(dc) && isPathClear(fr,fc,tr,tc)) legal = true;
      break;
    case 'R':
      if((dr===0 || dc===0) && isPathClear(fr,fc,tr,tc)) legal = true;
      break;
    case 'Q':
      if((dr===0 || dc===0 || Math.abs(dr)===Math.abs(dc)) && isPathClear(fr,fc,tr,tc)) legal = true;
      break;
    case 'K':
      if(Math.abs(dr)<=1 && Math.abs(dc)<=1) legal = true;
      break;
  }

  // Castling (basic)
  if(p.type === 'K' && !moved[p.color+'K'] && dr===0 && Math.abs(dc)===2){
    if(dc === 2 && board[fr][fc+1] == null && board[fr][fc+2] == null &&
       !isSquareAttacked(fr,fc,p.color==='w'?'b':'w') &&
       !isSquareAttacked(fr,fc+1,p.color==='w'?'b':'w') &&
       !isSquareAttacked(fr,fc+2,p.color==='w'?'b':'w')) legal = true;
    if(dc === -2 && board[fr][fc-1] == null && board[fr][fc-2] == null && board[fr][fc-3] == null &&
       !isSquareAttacked(fr,fc,p.color==='w'?'b':'w') &&
       !isSquareAttacked(fr,fc-1,p.color==='w'?'b':'w') &&
       !isSquareAttacked(fr,fc-2,p.color==='w'?'b':'w')) legal = true;
  }

  if(!legal) return false;
  if(ignoreCheck) return true;

  const backup = board[tr][tc];
  board[tr][tc] = p;
  board[fr][fc] = null;
  const kingPos = findKing(p.color);
  const inCheck = kingPos && isSquareAttacked(kingPos.row, kingPos.col, p.color === 'w' ? 'b' : 'w');
  board[fr][fc] = p;
  board[tr][tc] = backup;
  return !inCheck;
}

function applyMove(fr,fc,tr,tc){
  const p = board[fr][fc];
  if(!p) return false;
  const wasCapture = !!board[tr][tc];
  if(p.type === 'K' && Math.abs(tc - fc) === 2){
    if(tc > fc){ board[fr][5] = board[fr][7]; board[fr][7] = null; moved[p.color+'R7']=true; }
    else { board[fr][3] = board[fr][0]; board[fr][0] = null; moved[p.color+'R0']=true; }
  }
  board[fr][fc] = null;
  if(p.type === 'P' && (p.color === 'w' && tr === 0 || p.color === 'b' && tr === 7)) p.type = 'Q';
  board[tr][tc] = p;
  if(p.type === 'K') moved[p.color+'K'] = true;
  if(p.type === 'R'){
    if(fr===7 && fc===0) moved['wR0'] = true;
    if(fr===7 && fc===7) moved['wR7'] = true;
    if(fr===0 && fc===0) moved['bR0'] = true;
    if(fr===0 && fc===7) moved['bR7'] = true;
  }
  lastMoveFrom = {row:fr,col:fc};
  lastMoveTo = {row:tr,col:tc};
  currentTurn = currentTurn === 'w' ? 'b' : 'w';
  lastMoveWasCapture = wasCapture;

  pushSnapshot();
  return true;
}

/* ========== Move generation & simulation (used by the AI search) ========= */
function generateAllLegalMoves(color){
  const moves = [];
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(!p || p.color !== color) continue;
      for(let tr=0;tr<8;tr++){
        for(let tc=0;tc<8;tc++){
          if(isLegalMove(p,r,c,tr,tc)){
            moves.push({fr:r,fc:c,tr:tr,tc:tc, captured: board[tr][tc] ? board[tr][tc].type : null});
          }
        }
      }
    }
  }
  return moves;
}

function makeMoveSim(fr,fc,tr,tc){
  const p = board[fr][fc];
  const captured = board[tr][tc];
  const movedSnapshot = {...moved};
  const prevLastFrom = lastMoveFrom ? {...lastMoveFrom} : null;
  const prevLastTo = lastMoveTo ? {...lastMoveTo} : null;
  const originalType = p ? p.type : null;
  const rookMove = {performed:false, from:null, to:null, piece:null};

  if(p && p.type === 'K' && Math.abs(tc - fc) === 2){
    if(tc > fc){
      rookMove.performed = true;
      rookMove.from = {r:fr, c:7};
      rookMove.to   = {r:fr, c:5};
      rookMove.piece = board[fr][7];
      board[fr][5] = board[fr][7];
      board[fr][7] = null;
      moved[p.color+'R7'] = true;
    } else {
      rookMove.performed = true;
      rookMove.from = {r:fr, c:0};
      rookMove.to   = {r:fr, c:3};
      rookMove.piece = board[fr][0];
      board[fr][3] = board[fr][0];
      board[fr][0] = null;
      moved[p.color+'R0'] = true;
    }
  }

  board[tr][tc] = p;
  board[fr][fc] = null;

  let promoted = false;
  if(p && p.type === 'P' && ((p.color==='w' && tr===0) || (p.color==='b' && tr===7))){
    p.type = 'Q'; promoted = true;
  }

  if(p && originalType === 'K') moved[p.color+'K'] = true;
  if(p && originalType === 'R'){
    if(fr===7 && fc===0) moved['wR0'] = true;
    if(fr===7 && fc===7) moved['wR7'] = true;
    if(fr===0 && fc===0) moved['bR0'] = true;
    if(fr===0 && fc===7) moved['bR7'] = true;
  }

  const prevLast = {from: prevLastFrom, to: prevLastTo};
  lastMoveFrom = {row:fr,col:fc}; lastMoveTo = {row:tr,col:tc};

  return {fr,fc,tr,tc,p,captured,movedSnapshot,originalType,promoted,rookMove,prevLast};
}

function undoMoveSim(undo){
  const {fr,fc,tr,tc,captured,movedSnapshot,originalType,promoted,rookMove,prevLast} = undo;
  board[fr][fc] = board[tr][tc];
  board[tr][tc] = captured;
  if(promoted && board[fr][fc]) board[fr][fc].type = originalType;
  if(rookMove && rookMove.performed){
    board[rookMove.from.r][rookMove.from.c] = rookMove.piece;
    board[rookMove.to.r][rookMove.to.c] = null;
  }
  moved = {...movedSnapshot};
  lastMoveFrom = prevLast.from ? {...prevLast.from} : null;
  lastMoveTo = prevLast.to ? {...prevLast.to} : null;
}
