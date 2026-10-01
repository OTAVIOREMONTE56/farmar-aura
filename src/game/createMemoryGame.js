import { MOVEMENTS } from '../entities/character/createMovementController.js';

export function createMemoryGame(character, { random = Math.random, storage, now = () => performance.now() } = {}) {
  try { storage ??= globalThis.localStorage; } catch {}
  const read = key => { try { const value=Number(storage?.getItem(key)); return Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0; } catch { return 0; } };
  let bestAura=read('farmar-aura-best'), bestSequence=read('farmar-aura-memory-best-sequence');
  let phase='ready', sequence=[], level=1, lives=3, score=0, combo=1, cleanWins=0, maxSequence=0;
  let index=0, demoIndex=-1, due=0, moving=false, roundHadError=false, retry=false;
  let feedback='', feedbackUntil=0;
  const pause=()=>Math.max(260,750-(level-1)*45);
  function save() {
    bestAura=Math.max(bestAura,score); bestSequence=Math.max(bestSequence,maxSequence);
    try { storage?.setItem('farmar-aura-best',String(bestAura)); storage?.setItem('farmar-aura-memory-best-sequence',String(bestSequence)); } catch {}
  }
  function append() { sequence.push(MOVEMENTS[Math.min(5,Math.floor(random()*6))]); maxSequence=sequence.length; }
  function demonstrate(t) { phase='memorize-intro'; due=t+1100; demoIndex=-1; index=0; moving=false; }
  function show(text,t,duration=900) { feedback=text; feedbackUntil=t+duration; }
  function start(t=now()) {
    if (!['ready','result'].includes(phase)) return false;
    character.stopAnimation({fade:0}); character.mixer.stopAllAction(); character.playAnimation('idle',{fade:0,loop:true});
    sequence=[]; level=1; lives=3; score=0; combo=1; cleanWins=0; maxSequence=0;
    index=0; demoIndex=-1; moving=false; roundHadError=false; retry=false; feedback='';
    append(); append(); phase='countdown'; due=t+3000; return true;
  }
  function update(t=now()) {
    if (feedback && t>=feedbackUntil) feedback='';
    if (phase==='countdown' && t>=due) demonstrate(t);
    else if (phase==='memorize-intro' && t>=due) { phase='demonstrate'; due=t; }
    else if (phase==='demonstrate') {
      if (moving) { if (!character.movements.busy) {moving=false; due=t+pause();} }
      else if (t>=due) {
        if (demoIndex+1>=sequence.length) {phase='turn-intro'; due=t+1000; demoIndex=-1;}
        else if(character.movements.play(sequence[demoIndex+1].name)) {demoIndex++; moving=true;}
      }
    } else if (phase==='turn-intro' && t>=due) {phase='player'; index=0;}
    else if (phase==='player-move' && !character.movements.busy) {
      if (index===sequence.length) {
        const bonus=100*level+(roundHadError?0:50); score+=bonus;
        cleanWins=roundHadError?0:cleanWins+1; combo=Math.max(1,cleanWins);
        save(); show('SEQUÊNCIA PERFEITA! 🔥 +'+bonus+' AURA',t,1600); phase='complete'; due=t+1800;
      } else phase='player';
    } else if (phase==='complete' && t>=due) {
      level++; append(); roundHadError=false; retry=false; save(); phase='level-intro'; due=t+1000;
    } else if (phase==='level-intro' && t>=due) demonstrate(t);
    else if (phase==='error' && t>=due) demonstrate(t);
  }
  function input(key,t=now()) {
    update(t);
    if (phase!=='player' || character.movements.busy) return false;
    const movement=MOVEMENTS.find(m=>m.key===key); if(!movement)return false;
    if(key!==sequence[index].key) {
      lives--; combo=1; cleanWins=0; roundHadError=true; retry=true; index=0;
      show('ERRO! 💀',t,1100);
      if(!lives) {phase='result'; save();} else {phase='error'; due=t+1200;}
      return false;
    }
    if(!character.movements.play(movement.name))return false;
    index++; score+=25; save(); show('CERTO! ✓ +25 AURA',t); phase='player-move'; return true;
  }
  return {start,update,input,snapshot(t=now()) {
    return {phase,level,lives,score,combo,maxSequence,bestAura,bestSequence,index,length:sequence.length,retry,feedback,
      countdown:Math.max(1,Math.ceil((due-t)/1000)),
      demonstration:phase==='demonstrate'&&demoIndex>=0?{...sequence[demoIndex],index:demoIndex+1}:null};
  }};
}
