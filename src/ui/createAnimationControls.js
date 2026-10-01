import { bindMovementInput } from './bindMovementInput.js';
import { MOVEMENT_IDENTITY } from './movementIdentity.js';
import { MOVEMENTS } from '../entities/character/createMovementController.js';
import { createMemoryGame } from '../game/createMemoryGame.js';
import { createBackgroundMusic } from '../audio/createBackgroundMusic.js';

export function createAnimationControls(character) {
  const game=createMemoryGame(character);
  const music=createBackgroundMusic();
  const ui=document.createElement('div'); ui.className='game-ui memory-ui';
  ui.innerHTML='<div class="hud"><div>NÍVEL<strong class="level">1</strong></div><div class="lives" aria-label="3 vidas">❤️ ❤️ ❤️</div><div class="score"><button class="music-toggle" type="button" aria-label="Silenciar música" aria-pressed="false">🔊</button>AURA<strong class="aura">0</strong><span id="round-combo">COMBO x1</span></div></div><div class="memory-status" role="status" aria-live="polite"></div><div class="command" hidden><strong class="command-symbol" aria-hidden="true"></strong><b class="command-name"></b><span class="demo-progress"></span><small class="command-key"></small></div><div class="memory-progress" hidden>PROGRESSO <strong></strong></div><div class="memory-feedback" role="status" aria-live="polite"></div><div class="game-overlay"></div><div class="countdown" hidden></div><div class="animation-controls" role="group" aria-label="Movimentos"></div>';
  document.body.appendChild(ui);
  const find=selector=>ui.querySelector(selector), overlay=find('.game-overlay');
  const soundButton=find('.music-toggle');
  function refreshSound() {
    soundButton.textContent=music.muted?'🔇':'🔊';
    soundButton.setAttribute('aria-label',music.muted?'Ativar música':'Silenciar música');
    soundButton.setAttribute('aria-pressed',String(music.muted));
  }
  soundButton.addEventListener('click',()=>{music.toggle();refreshSound();});
  refreshSound();
  const buttons=MOVEMENTS.map(movement=>{
    const button=document.createElement('button'); button.type='button';
    const identity=MOVEMENT_IDENTITY[movement.key];
    button.dataset.movement=movement.key;
    button.style.setProperty('--move-color',identity.color);
    button.style.setProperty('--move-ink',identity.ink);
    button.innerHTML='<span class="movement-symbol" aria-hidden="true">'+identity.symbol+'</span><span class="movement-name">'+identity.label+'</span><span class="movement-key">'+movement.key+'</span>';
    button.setAttribute('aria-label',movement.key+' — '+movement.label); button.setAttribute('aria-keyshortcuts',movement.key);
    find('.animation-controls').appendChild(button); return {movement,button};
  });
  const unbindInput=bindMovementInput(buttons,submitMovement);
  let renderedOverlay='', state=game.snapshot();
  let friendlyFeedback='', friendlyUntil=0;
  const buttonEffects=new Map();
  const cheers=['BOA! ⭐','ISSO! 🔥','ARRASOU! 😎','MANDOU BEM! 🐸'];
  function submitMovement(key) {
    const now=performance.now(), before=game.snapshot(now);
    const accepted=game.input(key,now), after=game.snapshot(now);
    if(accepted || after.lives<before.lives) {
      const success=accepted;
      friendlyFeedback=success?cheers[Math.floor(Math.random()*cheers.length)]:['OPA! 😜','QUASE! 🐸'][Math.floor(Math.random()*2)];
      friendlyUntil=now+(success?900:1100);
      buttonEffects.set(key,{kind:success?'hit':'oops',until:now+550});
    }
    update(now);
  }
  function renderOverlay() {
    if(!['ready','result'].includes(state.phase)){overlay.hidden=true; renderedOverlay='';return;}
    overlay.hidden=false;
    const signature=state.phase+':'+state.bestAura+':'+state.bestSequence;
    if(signature===renderedOverlay)return; renderedOverlay=signature;
    overlay.innerHTML=state.phase==='ready'
      ? '<section><h1>FARMAR AURA</h1><p class="desktop-copy">MEMORIZE A DANÇA.<br>REPITA SEM ERRAR.<br>FARME AURA.</p><div class="mobile-copy intro-frog" aria-hidden="true">🐸</div><p class="mobile-copy">MEMORIZE.<br>DANCE.<br>FARME AURA.</p><small class="rotate-tip">📱↔️ VIRE O CELULAR PARA JOGAR MELHOR</small><div class="memory-records"><div>MELHOR SEQUÊNCIA<strong>'+state.bestSequence+'</strong></div><div>MELHOR AURA<strong>'+state.bestAura+'</strong></div></div><button class="start-button" type="button"><span class="desktop-copy">COMEÇAR</span><span class="mobile-copy">JOGAR</span></button><small class="desktop-copy">Teclado Q W E R T Y ou toque nos botões</small></section>'
      : '<section class="result"><h1><span class="desktop-copy">GAME OVER</span><span class="mobile-copy">🌟 MUITO BEM! 🌟</span></h1><p>AURA TOTAL</p><strong class="total">'+state.score+'</strong><p><span class="desktop-copy">SEQUÊNCIA MÁXIMA</span><span class="mobile-copy">MELHOR SEQUÊNCIA</span> <b>'+state.maxSequence+'</b></p><div class="memory-records"><div>MELHOR AURA<strong>'+state.bestAura+'</strong></div><div>MELHOR SEQUÊNCIA<strong>'+state.bestSequence+'</strong></div></div><button class="start-button" type="button"><span class="desktop-copy">TENTAR NOVAMENTE</span><span class="mobile-copy">TENTAR DE NOVO</span></button></section>';
    if(state.phase==='result')overlay.querySelector('button').focus({preventScroll:true});
  }
  function refresh() {
    const ready=character.status!=='loading'&&MOVEMENTS.every(m=>character.animationNames.includes(m.name));
    const startButton=overlay.querySelector('button'); if(startButton)startButton.disabled=!ready;
    for(const {button} of buttons)button.disabled=!ready||state.phase!=='player'||character.movements.busy;
  }
  function update(now=performance.now()) {
    game.update(now); state=game.snapshot(now); music.update(state.phase,now); renderOverlay();
    find('.level').textContent=state.level; find('.aura').textContent=state.score;
    find('#round-combo').textContent='COMBO x'+state.combo; ui.dataset.combo=state.combo;
    find('.lives').textContent=Array.from({length:3},(_,i)=>i<state.lives?'❤️':'🖤').join(' ');
    find('.lives').setAttribute('aria-label',state.lives+' vidas');
    const labels={ 'memorize-intro':state.retry?'👀 PRESTE ATENÇÃO!':'👀 MEMORIZE!', demonstrate:'👀 MEMORIZE!', 'turn-intro':state.retry?'TENTE NOVAMENTE':'🔥 AGORA É VOCÊ!', player:'🔥 SUA VEZ!', 'player-move':'🔥 SUA VEZ!', 'level-intro':'NÍVEL '+state.level };
    find('.memory-status').textContent=labels[state.phase]??'';
    const demo=state.demonstration; find('.command').hidden=!demo;
    if(demo){
      const identity=MOVEMENT_IDENTITY[demo.key];
      find('.command').style.setProperty('--move-color',identity.color);
      find('.command-symbol').textContent=identity.symbol;
      find('.demo-progress').textContent=demo.index+' / '+state.length;
      find('.command-key').textContent='Tecla '+demo.key;
      find('.command-name').textContent=identity.label;
    }
    for(const {movement,button} of buttons) {
      button.classList.toggle('demonstrating',!!demo && demo.key===movement.key && character.movements.busy);
      const effect=buttonEffects.get(movement.key);
      button.classList.toggle('move-hit',effect?.kind==='hit' && now<effect.until);
      button.classList.toggle('move-oops',effect?.kind==='oops' && now<effect.until);
    }
    ui.classList.toggle('sequence-celebration',state.phase==='complete');
    const player=['player','player-move','complete'].includes(state.phase);
    find('.memory-progress').hidden=!player; find('.memory-progress strong').textContent=state.index+' / '+state.length;
    find('.memory-feedback').textContent=state.phase==='complete'?'🌟 SEQUÊNCIA PERFEITA! 🌟':now<friendlyUntil?friendlyFeedback:state.feedback.startsWith('CERTO!')?'':state.feedback.startsWith('ERRO!')?'OPA! 😜':state.feedback;
    find('.memory-feedback').classList.toggle('celebration',state.phase==='complete');
    find('.memory-feedback').classList.toggle('miss',state.phase==='error');
    find('.countdown').hidden=state.phase!=='countdown'; find('.countdown').textContent=state.countdown;
    refresh();
  }
  function onKey(event) {
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)||event.target?.isContentEditable)return;
    const movement=MOVEMENTS.find(m=>event.code==='Key'+m.key);
    if(movement){event.preventDefault();submitMovement(movement.key);}
  }
  overlay.addEventListener('click',event=>{if(event.target.closest('.start-button')&&!event.target.disabled){if(game.start()){friendlyFeedback='';friendlyUntil=0;buttonEffects.clear();music.update(game.snapshot().phase);music.start();}update();}});
  window.addEventListener('keydown',onKey); update();
  return {refresh,update,getVisualState:()=>({...state}),getVisualCombo:()=>['ready','result','countdown'].includes(state.phase)?1:state.combo,dispose(){window.removeEventListener('keydown',onKey);unbindInput();music.dispose();ui.remove();}};
}
