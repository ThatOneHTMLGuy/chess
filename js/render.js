/*
  render.js — drawing the board: piece images, last-move/selection/capture
  highlights, the in-check outline, and the legal-move dots.
*/
'use strict';

const PIECE_IMAGES = {
  w:{K:'pieces/wk.png',Q:'pieces/wq.png',R:'pieces/wr.png',B:'pieces/wb.png',N:'pieces/wn.png',P:'pieces/wp.png'},
  b:{K:'pieces/bk.png',Q:'pieces/bq.png',R:'pieces/br.png',B:'pieces/bb.png',N:'pieces/bn.png',P:'pieces/bp.png'}
};
const HIGHLIGHT = 'highlight.png';

function clearHighlights(){
  if(!boardEl) return;
  boardEl.querySelectorAll('.dot-highlight, .highlight').forEach(h=>h.remove());
  boardEl.querySelectorAll('.square').forEach(sq=>{
    sq.classList.remove('capture','selected','last-move');
  });
}

/* Finds the square of the king that is currently in check for the given
   board/turn, or null if nobody is in check. Temporarily swaps the module
   board reference so this works for both the live game and history
   snapshots (findKing/isSquareAttacked read the shared `board` variable). */
function getCheckedKingSquare(bd, turnColor){
  const prevBoard = board;
  board = bd;
  try {
    const kingPos = findKing(turnColor);
    if(!kingPos) return null;
    const inCheck = isSquareAttacked(kingPos.row, kingPos.col, turnColor === 'w' ? 'b' : 'w');
    return inCheck ? kingPos : null;
  } finally {
    board = prevBoard;
  }
}

function renderBoard(boardState, turnState, lastFrom, lastTo, isSnapshot){
  if(!boardEl){
    safeError('renderBoard: boardEl not set');
    return;
  }
  clearHighlights();

  const useBoard = boardState || board;
  const useTurn = typeof turnState !== 'undefined' ? turnState : currentTurn;
  const useLastFrom = lastFrom || lastMoveFrom;
  const useLastTo = lastTo || lastMoveTo;
  const checkedKingSq = getCheckedKingSquare(useBoard, useTurn);

  boardEl.innerHTML = '';
  for(let dr=0; dr<8; dr++){
    for(let dc=0; dc<8; dc++){
      const logicalR = boardFlipped ? 7 - dr : dr;
      const logicalC = boardFlipped ? 7 - dc : dc;
      const sq = document.createElement('div');
      sq.className = 'square ' + (((dr + dc) % 2 === 0) ? 'light' : 'dark');
      sq.dataset.row = logicalR;
      sq.dataset.col = logicalC;
      boardEl.appendChild(sq);
    }
  }

  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq = boardEl.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
      if(!sq) continue;
      if(useLastFrom && useLastFrom.row===r && useLastFrom.col===c) sq.classList.add('last-move');
      if(useLastTo && useLastTo.row===r && useLastTo.col===c) sq.classList.add('last-move');
      if(checkedKingSq && checkedKingSq.row===r && checkedKingSq.col===c) sq.classList.add('in-check');

      const p = useBoard[r][c];
      if(p){
        const img = document.createElement('img');
        img.className = 'piece';
        img.src = (PIECE_IMAGES[p.color] && PIECE_IMAGES[p.color][p.type]) ? PIECE_IMAGES[p.color][p.type] : '';
        img.alt = p.color === 'w' ? 'White '+p.type : 'Black '+p.type;
        img.draggable = false;
        img.dataset.row = r; img.dataset.col = c;

        if(!isSnapshot){
          img.addEventListener('pointerdown', piecePointerDown);
          img.addEventListener('contextmenu', e=>e.preventDefault());
        } else {
          img.style.pointerEvents = 'none';
        }

        sq.appendChild(img);
      }
    }
  }

  if(turnIndicator) turnIndicator.textContent = useTurn === 'w' ? 'White' : 'Black';
}

function showLegalMoves(r,c){
  clearHighlights();
  const p = board[r][c];
  if(!p || p.color !== currentTurn) return;
  const originSq = boardEl.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
  if(originSq) originSq.classList.add('selected');

  for(let tr=0;tr<8;tr++){
    for(let tc=0;tc<8;tc++){
      if(isLegalMove(p,r,c,tr,tc)){
        const sq = boardEl.querySelector(`.square[data-row="${tr}"][data-col="${tc}"]`);
        if(sq){
          if(board[tr][tc]) sq.classList.add('capture');
          const mark = document.createElement('img');
          mark.className = 'highlight';
          mark.src = HIGHLIGHT;
          mark.draggable = false;
          mark.style.pointerEvents = 'none';
          sq.appendChild(mark);
        }
      }
    }
  }
}

function updateBoardOrientation(){
  boardFlipped = (aiColor === 'w');
  if(viewingSnapshot && historySnapshots[snapshotIndex]){
    const snap = historySnapshots[snapshotIndex];
    renderBoard(snap.board, snap.currentTurn, snap.lastMoveFrom, snap.lastMoveTo, true);
  } else {
    renderBoard();
  }
}
