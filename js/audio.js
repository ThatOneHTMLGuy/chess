/*
  audio.js — sound effects (move/capture/check/checkmate). Depends on
  nothing else; other files just call playSound(name).
*/
'use strict';

const SOUND_FILES = {
  move: 'sounds/move.mp3',
  capture: 'sounds/capture.mp3',
  check: 'sounds/check.mp3',
  checkmate: 'sounds/checkmate.mp3'
};
const SOUNDS = {};
Object.keys(SOUND_FILES).forEach(key=>{
  try {
    const a = new Audio(SOUND_FILES[key]);
    a.preload = 'auto';
    SOUNDS[key] = a;
  } catch(err){
    SOUNDS[key] = null;
  }
});

function playSound(name){
  const audio = SOUNDS[name];
  if(!audio) return;
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if(p && p.catch) p.catch(()=>{ /* ignore autoplay-block errors */ });
  } catch(err){
    /* ignore playback errors (e.g. unsupported/missing file) */
  }
}
