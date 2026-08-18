/*
  ui.js — user interaction: click-to-move, drag & drop, move-history
  (snapshot) navigation, checkmate/stalemate detection, and the
  game-over popup.
*/
'use strict';

/* ========== Move history ========== */
function deepCopyBoard(src){
  return src.map(row => row.map(cell => cell ? { type: cell.type, color: cell.color } : null));
}

function pushSnapshot(){
  if(snapshotIndex < historySnapshots.length - 1){
    historySnapshots.length = snapshotIndex + 1;
  }
  historySnapshots.push({
    board: deepCopyBoard(board),
    currentTurn: currentTurn,
    lastMoveFrom: lastMoveFrom ? {row:lastMoveFrom.row, col:lastMoveFrom.col} : null,
    lastMoveTo: lastMoveTo ? {row:lastMoveTo.row, col:lastMoveTo.col} : null
  });
  snapshotIndex = historySnapshots.length - 1;
  updateArrowsDisabled();
}

function setViewingSnapshot(index){
  if(index < 0) index = 0;
  if(index >= historySnapshots.length) index = historySnapshots.length - 1;
  snapshotIndex = index;
  viewingSnapshot = (snapshotIndex !== historySnapshots.length - 1);
  updateArrowsDisabled();
  const snap = historySnapshots[snapshotIndex];
  renderBoard(snap.board, snap.currentTurn, snap.lastMoveFrom, snap.lastMoveTo, true);
}

function updateArrowsDisabled(){
  if(!prevBtn || !nextBtn) return;
  const atStart = snapshotIndex <= 0;
  const atEnd = snapshotIndex >= (historySnapshots.length - 1);
  prevBtn.disabled = atStart;
  nextBtn.disabled = atEnd;

  // Visual feedback for image opacity
  const pImg = prevBtn.querySelector('img');
  const nImg = nextBtn.querySelector('img');
  if(pImg) pImg.style.opacity = atStart ? '0.45' : '1';
  if(nImg) nImg.style.opacity = atEnd ? '0.45' : '1';
}

/* ========== Click-to-move ========== */
function handleClick(e){
  if(isPointerDragging) return;
  if(!boardEl) return;
  const sq = e.target.closest('.square');
  if(!sq) return;
  const r = parseInt(sq.dataset.row), c = parseInt(sq.dataset.col);
  const p = board[r][c];

  if(aiEnabled && aiColor === currentTurn) return;

  if(viewingSnapshot){
    setViewingSnapshot(historySnapshots.length - 1);
    viewingSnapshot = false;
    renderBoard();
    return;
  }

  if(selected){
    if(isLegalMove(board[selected.row][selected.col], selected.row, selected.col, r, c)){
      applyMove(selected.row, selected.col, r, c);
      selected = null;
      renderBoard();
      if(!checkGameStatus()) maybeTriggerAI();
      return;
    }
    selected = null;
    renderBoard();
  }

  if(p && p.color === currentTurn){
    selected = {row:r, col:c};
    showLegalMoves(r,c);
  }
}

/* ========== Game status & game-over modal ========== */
function checkGameStatus(){
  let hasMove = false;
  outer: for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(p && p.color === currentTurn){
        for(let tr=0;tr<8;tr++){
          for(let tc=0;tc<8;tc++){
            if(isLegalMove(p,r,c,tr,tc)){ hasMove = true; break outer; }
          }
        }
      }
    }
  }
  const kingPos = findKing(currentTurn);
  const inCheck = kingPos && isSquareAttacked(kingPos.row, kingPos.col, currentTurn === 'w' ? 'b' : 'w');
  if(!hasMove){
    if(inCheck){
      playSound('checkmate');
      showGameOverModal('Checkmate', (currentTurn==='w'?'White':'Black') + ' is checkmated!');
    } else {
      playSound('move');
      showGameOverModal('Stalemate', 'No legal moves remain — the game is a draw.');
    }
    return true;
  }
  playSound(inCheck ? 'check' : (lastMoveWasCapture ? 'capture' : 'move'));
  return false;
}

/* Game-over popup, replacing the old window.alert(). Built and appended
   to document.body the same way other dynamic controls in this file are. */
function showGameOverModal(title, message){
  const existing = document.getElementById('gameOverModal');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gameOverModal';
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const h2 = document.createElement('h2');
  h2.textContent = title;
  box.appendChild(h2);

  const p = document.createElement('p');
  p.textContent = message;
  box.appendChild(p);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'OK';
  closeBtn.className = 'modal-close-btn';
  closeBtn.addEventListener('click', ()=> overlay.remove());
  box.appendChild(closeBtn);

  overlay.appendChild(box);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/* ========== Drag & Drop ========== */
function piecePointerDown(e){
  try {
    const img = e.currentTarget;
    const r = parseInt(img.dataset.row), c = parseInt(img.dataset.col);
    const p = board[r][c];
    if(!p || p.color !== currentTurn) return;
    if(aiEnabled && aiColor === currentTurn) return;

    isPointerDragging = true;
    img.setPointerCapture && img.setPointerCapture(e.pointerId);

    dragging = {
      pieceEl: img,
      from: {row:r, col:c},
      origParent: img.parentElement,
      offsetX: e.clientX - img.getBoundingClientRect().left,
      offsetY: e.clientY - img.getBoundingClientRect().top
    };

    img.classList.add('dragging');
    img.style.position = 'fixed';
    img.style.left = (e.clientX - dragging.offsetX) + 'px';
    img.style.top = (e.clientY - dragging.offsetY) + 'px';
    img.style.width = getComputedStyle(img).width;
    img.style.height = getComputedStyle(img).height;
    document.body.appendChild(img);

    document.addEventListener('pointermove', piecePointerMove);
    document.addEventListener('pointerup', piecePointerUp, {once:true});
  } catch(err){
    safeError('pointerdown error:', err);
  }
}

function piecePointerMove(e){
  if(!dragging) return;
  const img = dragging.pieceEl;
  img.style.left = (e.clientX - dragging.offsetX) + 'px';
  img.style.top = (e.clientY - dragging.offsetY) + 'px';
}

function piecePointerUp(e){
  try {
    if(!dragging) return;
    const img = dragging.pieceEl;
    try { img.releasePointerCapture && img.releasePointerCapture(e.pointerId); } catch(_) {}
    img.classList.remove('dragging');
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    const sq = elem ? elem.closest('.square') : null;
    let tr, tc;
    if(sq){ tr = parseInt(sq.dataset.row); tc = parseInt(sq.dataset.col); }
    else { tr = dragging.from.row; tc = dragging.from.col; }

    if(selected && !(selected.row === dragging.from.row && selected.col === dragging.from.col)) selected = null;
    if(isLegalMove(board[dragging.from.row][dragging.from.col], dragging.from.row, dragging.from.col, tr, tc)){
      applyMove(dragging.from.row, dragging.from.col, tr, tc);
      renderBoard();
      if(!checkGameStatus()) maybeTriggerAI();
    } else {
      dragging.origParent.appendChild(img);
      img.style.position = ''; img.style.left=''; img.style.top=''; img.style.width=''; img.style.height='';
    }
  } catch(err){
    safeError('pointerup error:', err);
  } finally {
    document.removeEventListener('pointermove', piecePointerMove);
    isPointerDragging = false;
    dragging = null;
  }
}
