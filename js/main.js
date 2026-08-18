/*
  main.js — builds the New Game / AI / history-arrow controls and boots
  the app on DOMContentLoaded. Loaded last, after every other file has
  registered its functions.
*/
'use strict';

function createImgButton(imgSrc, altText){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.padding = '6px';
  btn.style.background = 'transparent';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';

  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = altText || '';
  img.style.width = '22px';
  img.style.height = '22px';
  img.style.objectFit = 'contain';
  img.style.pointerEvents = 'none';
  img.style.userSelect = 'none';

  // fallback: if image fails, replace with text arrow
  img.addEventListener('error', function onerr(){
    img.removeEventListener('error', onerr);
    img.style.display = 'none';

    const text = document.createElement('span');
    text.textContent =
      altText && altText.indexOf('left') >= 0 ? '←' : '→';

    text.style.fontSize = '1.05rem';
    text.style.color = 'var(--light)';
    btn.appendChild(text);
  });

  btn.appendChild(img);
  return btn;
}


function createAIControlsAndPlaceNewGameAndArrows(){
  controlsEl = document.querySelector('.controls');

  const existingBtn = document.getElementById('newGameBtn');

  if(existingBtn){
    newGameBtn = existingBtn;
  } else {
    const ng = document.createElement('button');
    ng.id = 'newGameBtn';
    ng.textContent = 'New Game';
    newGameBtn = ng;
  }

  if(!newGameBtn.__wired_newgame){
    newGameBtn.addEventListener('click', onNewGameClicked);
    newGameBtn.__wired_newgame = true;
  }

  boardEl = document.getElementById('board');

  if(boardEl){
    newGameBtn.style.display = 'block';
    newGameBtn.style.margin = '12px auto';
    boardEl.insertAdjacentElement('afterend', newGameBtn);
  } else if(controlsEl){
    if(newGameBtn.parentElement !== controlsEl){
      controlsEl.insertBefore(newGameBtn, controlsEl.firstChild);
    }
  } else {
    if(!document.body.contains(newGameBtn)){
      document.body.appendChild(newGameBtn);
    }
  }


  // arrows container directly after newGameBtn
  let arrowsContainer = document.getElementById('moveArrowsContainer');

  if(!arrowsContainer){
    arrowsContainer = document.createElement('div');
    arrowsContainer.id = 'moveArrowsContainer';
    arrowsContainer.style.display = 'flex';
    arrowsContainer.style.justifyContent = 'center';
    arrowsContainer.style.alignItems = 'center';
    arrowsContainer.style.gap = '12px';
    arrowsContainer.style.margin = '6px auto 0 auto';
    arrowsContainer.style.width = '100%';
    arrowsContainer.style.maxWidth = '360px';
  }


  // create prev/next using images
  prevBtn = document.getElementById('prevMoveBtn');

  if(!prevBtn){
    prevBtn = createImgButton('arrow-left.png', 'arrow-left');
    prevBtn.id = 'prevMoveBtn';
    prevBtn.title = 'Previous position';

    prevBtn.addEventListener('click', ()=>{
      if(historySnapshots.length === 0) return;

      setViewingSnapshot(
        Math.max(0, snapshotIndex - 1)
      );
    });
  }


  nextBtn = document.getElementById('nextMoveBtn');

  if(!nextBtn){
    nextBtn = createImgButton('arrow-right.png', 'arrow-right');
    nextBtn.id = 'nextMoveBtn';
    nextBtn.title = 'Next position';

    nextBtn.addEventListener('click', ()=>{
      if(historySnapshots.length === 0) return;

      setViewingSnapshot(
        Math.min(
          historySnapshots.length - 1,
          snapshotIndex + 1
        )
      );
    });
  }


  // middle label
  const label = document.createElement('div');

  label.style.minWidth = '120px';
  label.style.textAlign = 'center';
  label.style.color = 'var(--light)';
  label.style.fontSize = '0.95rem';
  label.style.userSelect = 'none';
  label.textContent = 'View moves';


  arrowsContainer.innerHTML = '';

  arrowsContainer.appendChild(prevBtn);
  arrowsContainer.appendChild(label);
  arrowsContainer.appendChild(nextBtn);


  if(newGameBtn.nextSibling !== arrowsContainer){
    newGameBtn.insertAdjacentElement(
      'afterend',
      arrowsContainer
    );
  }

  updateArrowsDisabled();


  // create AI controls inside .controls
  if(!controlsEl) return;

  controlsEl.innerHTML = '';


  // ================================
  // AI TOGGLE
  // ================================

  const aiToggle = document.createElement('button');

  aiToggle.id = 'aiToggle';
  aiToggle.textContent =
    'AI Mode: ' + (aiEnabled ? 'On' : 'Off');

  aiToggle.addEventListener('click', ()=>{
    aiEnabled = !aiEnabled;

    aiToggle.textContent =
      'AI Mode: ' + (aiEnabled ? 'On' : 'Off');

    if(aiEnabled && aiColor === currentTurn){
      setTimeout(makeAIMove, 200);
    }

    updateBoardOrientation();
  });

  controlsEl.appendChild(aiToggle);


  // ================================
  // CUSTOM DROPDOWN FUNCTION
  // ================================

  function createCustomDropdown(
    id,
    options,
    initialValue,
    onChange
  ){
    const wrapper = document.createElement('div');

    wrapper.className = 'custom-dropdown';
    wrapper.id = id;

    const selected = document.createElement('button');

    selected.type = 'button';
    selected.className = 'custom-dropdown-selected';


    const menu = document.createElement('div');

    menu.className = 'custom-dropdown-menu';


    let currentValue = initialValue;


    function updateSelectedText(){
      const current = options.find(
        opt => String(opt.value) === String(currentValue)
      );

      selected.textContent =
        current ? current.text : '';
    }


    options.forEach(opt => {
      const option = document.createElement('button');

      option.type = 'button';
      option.className = 'custom-dropdown-option';
      option.textContent = opt.text;


      option.addEventListener('click', ()=>{
        currentValue = opt.value;

        updateSelectedText();

        wrapper.classList.remove('open');

        onChange(currentValue);
      });


      menu.appendChild(option);
    });


    selected.addEventListener('click', (e)=>{
      e.stopPropagation();


      // Close other dropdowns
      document
        .querySelectorAll('.custom-dropdown.open')
        .forEach(dropdown => {
          if(dropdown !== wrapper){
            dropdown.classList.remove('open');
          }
        });


      wrapper.classList.toggle('open');
    });


    wrapper.appendChild(selected);
    wrapper.appendChild(menu);


    updateSelectedText();


    // Allows code to read/write the selected value
    Object.defineProperty(wrapper, 'value', {
      get(){
        return currentValue;
      },

      set(value){
        currentValue = value;
        updateSelectedText();
      }
    });


    return wrapper;
  }


  // ================================
  // AI COLOR DROPDOWN
  // ================================

  const colorSelect = createCustomDropdown(
    'aiColorSelect',

    [
      {
        value: 'b',
        text: 'AI plays Black'
      },
      {
        value: 'w',
        text: 'AI plays White'
      }
    ],

    aiColor,

    (value)=>{
      aiColor = value;

      updateBoardOrientation();

      if(aiEnabled && aiColor === currentTurn){
        setTimeout(makeAIMove, 200);
      }
    }
  );

  controlsEl.appendChild(colorSelect);


  // ================================
  // AI DEPTH DROPDOWN
  // ================================

  const depthSelect = createCustomDropdown(
    'aiDepthSelect',

    [1,2,3,4,5,6].map(d => ({
      value: d,
      text: 'Depth ' + d
    })),

    aiDepth,

    (value)=>{
      aiDepth = parseInt(value, 10) || 1;
    }
  );

  controlsEl.appendChild(depthSelect);


  // Close dropdowns when clicking elsewhere
  document.addEventListener('click', ()=>{
    document
      .querySelectorAll('.custom-dropdown.open')
      .forEach(dropdown => {
        dropdown.classList.remove('open');
      });
  });
}


function onNewGameClicked(){
  createInitialBoard();

  currentTurn = 'w';
  selected = null;

  lastMoveFrom = lastMoveTo = null;

  historySnapshots = [];
  snapshotIndex = -1;
  viewingSnapshot = false;

  pushSnapshot();

  renderBoard();

  if(aiEnabled && aiColor === currentTurn){
    setTimeout(makeAIMove, 200);
  }
}


/* ========== INIT + SAFE START ========== */

function safeInit(){
  boardEl = document.getElementById('board');
  turnIndicator = document.getElementById('turnIndicator');
  controlsEl = document.querySelector('.controls');
  newGameBtn = document.getElementById('newGameBtn');


  if(!boardEl){
    safeError(
      'Missing #board element in DOM. Please add <div id="board"></div> to your HTML.'
    );
  }

  if(!turnIndicator){
    safeError(
      'Missing #turnIndicator element in DOM. Add <div id="turnIndicator"></div>.'
    );
  }


  if(boardEl){
    boardEl.addEventListener('click', handleClick);
  }


  createInitialBoard();

  createAIControlsAndPlaceNewGameAndArrows();

  pushSnapshot();

  updateBoardOrientation();

  renderBoard();

  safeLog(
    'script initialized with image arrows (arrow-left.png / arrow-right.png).'
  );
}


if(document.readyState === 'loading'){
  document.addEventListener(
    'DOMContentLoaded',
    safeInit
  );
} else {
  setTimeout(
    safeInit,
    1
  );
}