import assert from 'node:assert/strict';
import {createGame,classifyTiming,auraCategory,AURA_VALUES} from '../src/game/createGame.js';
import {createCharacter} from '../src/entities/character/createCharacter.js';
const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
let t=0,busy=false,played=[];const character={animationNames:Object.keys(AURA_VALUES),mixer:{timeScale:1},movements:{get busy(){return busy},play(name){played.push(name);busy=true;return true}}};
const g=createGame(character,{now:()=>t,random:()=>0,storage});
assert.equal(g.snapshot().phase,'ready');assert(!g.input('passinho'));assert(g.start());assert(!g.start());
for(const [at,text] of [[0,'3'],[1,'2'],[2,'1'],[3,'FARME AURA!']]){t=at;g.update();assert.equal(g.snapshot().countdown,text);assert(!g.input('passinho'));}
t=3.55;g.update();assert.equal(g.snapshot().remaining,10);assert.equal(g.snapshot().command.name,'passinho');
t+=.336;assert(g.input('passinho'));assert.equal(g.snapshot().score,90);assert.equal(g.snapshot().combo,1.5);assert(!g.input('giro'));g.update();assert.equal(g.snapshot().command,null);
busy=false;t+=.3;g.update();const next=g.snapshot().command;assert(next);t+=.336;assert(g.input(next.name));assert.equal(g.snapshot().score,315);assert.equal(g.snapshot().combo,2);
busy=false;t+=.3;g.update();assert(!g.input('unknown'));assert.equal(g.snapshot().combo,1);assert.equal(g.snapshot().feedback.text,'ERRO!');
t+=.23;g.update();t=g.snapshot().command.deadline;g.update();assert.equal(g.snapshot().feedback.text,'PERDEU!');assert.equal(g.snapshot().combo,1);
t=10.56;g.update();assert.equal(g.snapshot().command.window,.95);assert(!['passinho','moonwalk','breakdance'].includes(g.snapshot().command.name));
t=13.549;g.update();assert.equal(g.snapshot().phase,'playing');t=13.55;g.update();assert.equal(g.snapshot().phase,'result');assert.equal(g.snapshot().remaining,0);assert(!g.input('giro'));assert.equal(g.snapshot().result.best,315);assert.equal(g.snapshot().result.message,'NOVO RECORDE!');assert.equal(memory.get('farmar-aura.best'),'315');assert(g.start());
assert.equal(classifyTiming(.336,1.2),'PERFEITO');assert.equal(classifyTiming(.05,1.2),'BOM');assert.equal(classifyTiming(1.1,1.2),'ATRASADO');
for(const [value,label] of [[0,'AURA EM TREINAMENTO'],[400,'AURA RESPEITÁVEL'],[800,'AURA ABSURDA'],[1300,'AURA MONSTRUOSA'],[2000,'AURA LENDÁRIA']])assert.equal(auraCategory(value),label);
// Exercise the real animation controller: scoring once, lock, long-move speed and Idle recovery.
for(const [name,random] of [['passinho',0],['moonwalk',.34],['breakdance',.99]]){
 const c=createCharacter();let clock=0;const game=createGame(c,{now:()=>clock,random:()=>random,storage});game.start();clock=3.55;game.update();assert.equal(game.snapshot().command.name,name);clock+=.336;assert(game.input(name));assert(!game.input(name));for(let i=0;i<160;i++){c.update(.02);clock+=.02;game.update();}assert.equal(c.currentAnimation,'idle');assert.equal(c.mixer.timeScale,1);c.dispose();
}
// Reach the combo cap and verify that the current combo affects earned Aura.
busy=false;t=0;const capped=createGame(character,{now:()=>t,random:()=>0,storage});capped.start();t=3.55;capped.update();let total=0;const factors=[1,1.5,2,2.5,3,4,4];for(const factor of factors){const command=capped.snapshot().command;t=command.started+.336;total+=Math.round(AURA_VALUES[command.name]*1.5*factor);assert(capped.input(command.name));assert.equal(capped.snapshot().score,total);busy=false;t+=.16;capped.update();}assert.equal(capped.snapshot().combo,4);
const unavailable=createGame(character,{storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});assert.equal(unavailable.snapshot().best,0);
console.log('PASS: countdown, exact 10-second round, scoring, timing, combo cap/reset, misses, end lock, replay, record persistence, final acceleration, real animations and storage failure');
