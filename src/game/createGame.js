import { MOVEMENTS } from '../entities/character/createMovementController.js';
export const AURA_VALUES={passinho:60,giro:100,moonwalk:120,'pose-sigma':80,dab:90,breakdance:150};
const COMBOS=[1,1.5,2,2.5,3,4];
export function auraCategory(score){return score>=2000?'AURA LENDÁRIA':score>=1300?'AURA MONSTRUOSA':score>=800?'AURA ABSURDA':score>=400?'AURA RESPEITÁVEL':'AURA EM TREINAMENTO';}
export function classifyTiming(elapsed,window){const ideal=window*.28;return Math.abs(elapsed-ideal)<=window*.14?'PERFEITO':elapsed<=window*.72?'BOM':'ATRASADO';}
export function createGame(character,{now=()=>performance.now()/1000,random=Math.random,storage}={}){
  let phase='ready',countdownStart=0,roundStart=0,score=0,streak=0,command=null,nextAt=0,lastName=null,feedback=null,result=null;
  let best=0;try{storage ??= globalThis.localStorage;}catch{}try{const value=Number(storage?.getItem('farmar-aura.best'));if(Number.isFinite(value)&&value>=0)best=Math.floor(value);}catch{}
  const combo=()=>COMBOS[Math.min(streak,COMBOS.length-1)];
  function finish(t){phase='result';command=null;const previousBest=best;const newRecord=score>best;best=Math.max(best,score);try{storage?.setItem('farmar-aura.best',String(best));}catch{}result={score,best,category:auraCategory(score),message:newRecord?'NOVO RECORDE!':previousBest>score?'FALTARAM '+(previousBest-score+1)+' DE AURA PARA BATER SEU RECORDE!':score>0?'VOCÊ IGUALOU SEU RECORDE!':'MAIS UMA RODADA?'};feedback=null;}
  function fail(text,t){streak=0;command=null;feedback={id:t,text,points:0,kind:'miss',until:t+.65};nextAt=t+.22;}
  function update(t=now()){
    if(!character.movements.busy)character.mixer.timeScale=1;
    if(phase==='countdown'&&t>=countdownStart+3.55){phase='playing';roundStart=countdownStart+3.55;nextAt=roundStart;}
    if(phase==='playing'){
      if(t>=roundStart+10){finish(t);return;}
      if(command&&t>=command.deadline)fail('PERDEU!',t);
      if(!command&&!character.movements.busy&&t>=nextAt){
        let choices=MOVEMENTS.filter(m=>character.animationNames.includes(m.name)&&m.name!==lastName);
        // Reserve time for the long showcase; closing seconds favor shorter moves.
        if(roundStart+10-t<3)choices=choices.filter(m=>!['breakdance','passinho','moonwalk'].includes(m.name));
        if(choices.length){const move=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];const window=roundStart+10-t<=3?.95:1.2;command={...move,started:t,window,deadline:Math.min(t+window,roundStart+10)};lastName=move.name;}
      }
    }
    if(feedback&&t>=feedback.until)feedback=null;
  }
  return {
    start(t=now()){if(!['ready','result'].includes(phase)||character.movements.busy)return false;phase='countdown';countdownStart=t;score=0;streak=0;command=null;feedback=null;result=null;lastName=null;return true;},
    input(name,t=now()){
      update(t);if(phase!=='playing'||!command||character.movements.busy)return false;
      if(name!==command.name){fail('ERRO!',t);return false;}
      if(!character.movements.play(name))return false;
      // Playback speed changes only scheduling, never the authored clips or Passinho V2.
      const rate=name==='breakdance'?1.5:name==='moonwalk'?1.2:1;
      character.mixer.timeScale=rate;
      const timing=classifyTiming(t-command.started,command.window);
      const points=Math.round(AURA_VALUES[name]*({PERFEITO:1.5,BOM:1,ATRASADO:.6}[timing])*combo());
      score+=points;streak++;feedback={id:t,text:timing+'!',points,kind:timing==='PERFEITO'?'perfect':timing==='BOM'?'good':'late',until:t+.9};command=null;nextAt=t+.15;return true;
    },
    update,
    snapshot(t=now()){const elapsed=t-countdownStart;return {phase,remaining:phase==='playing'?Math.max(0,roundStart+10-t):phase==='result'?0:10,score,best,combo:combo(),command,progress:command?Math.min(1,Math.max(0,(t-command.started)/command.window)):0,feedback,result,countdown:phase==='countdown'?(elapsed<3?String(3-Math.floor(elapsed)):'FARME AURA!'):null,busy:character.movements.busy};},
  };
}
