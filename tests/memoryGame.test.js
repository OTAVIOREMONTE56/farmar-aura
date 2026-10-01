import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGame } from '../src/game/createMemoryGame.js';

function fixture() {
  let time=0, busy=false; const played=[], values=new Map();
  const character={stopAnimation(){busy=false;},mixer:{stopAllAction(){}},playAnimation(){},movements:{get busy(){return busy;},play(name){if(busy)return false;busy=true;played.push(name);return true;}}};
  let choice=0;
  const game=createMemoryGame(character,{now:()=>time,random:()=>[0,.7,.35,.2][choice++%4],storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
  const tick=(ms=1000)=>{time+=ms;game.update(time);};
  const finish=()=>{busy=false;tick(1);};
  function demo() {
    const keys=[];
    for(let guard=0;guard<100&&game.snapshot().phase!=='player';guard++) {
      tick(); const s=game.snapshot();
      if(s.phase==='demonstrate'&&busy){assert.equal(game.input('Q'),false);keys.push(s.demonstration.key);finish();}
    }
    assert.equal(game.snapshot().phase,'player'); return keys;
  }
  return {game,tick,finish,demo,played,values};
}

test('accumulates sequence, demonstrates every move, hides answers and awards bonuses',()=>{
  const f=fixture(); f.game.start(); assert.equal(f.game.snapshot().length,2);
  assert.equal(f.game.input('Q'),false); const first=f.demo(); assert.equal(first.length,2); assert.equal(f.played.length,2);
  assert.equal(f.game.snapshot().demonstration,null);
  for(const key of first){assert.equal(f.game.input(key),true);assert.equal(f.game.input(key),false);f.finish();}
  assert.equal(f.game.snapshot().score,200); assert.equal(f.game.snapshot().phase,'complete');
  const next=f.demo(); assert.equal(next.length,3); assert.deepEqual(next.slice(0,2),first); assert.equal(f.game.snapshot().level,2);
  for(const key of next){f.game.input(key);f.finish();} assert.equal(f.game.snapshot().combo,2);
});

test('each error costs one life, retries same sequence, ends at zero and resets cleanly',()=>{
  const f=fixture(); f.game.start(); const first=f.demo(); const wrong=first[0]==='Q'?'W':'Q';
  for(let life=2;life>=0;life--){
    f.game.input(wrong); assert.equal(f.game.snapshot().lives,life); f.game.input(wrong); assert.equal(f.game.snapshot().lives,life); assert.equal(f.game.snapshot().combo,1);
    if(life)assert.deepEqual(f.demo(),first);
  }
  assert.equal(f.game.snapshot().phase,'result'); assert.equal(f.values.get('farmar-aura-memory-best-sequence'),'2');
  assert.equal(f.game.start(),true); const s=f.game.snapshot(); assert.equal(s.lives,3); assert.equal(s.score,0); assert.equal(s.level,1); assert.equal(s.index,0); assert.equal(s.length,2); assert.equal(s.feedback,'');
});

test('keeps clean-round bonus off after retry and persists aura, including unavailable storage',()=>{
  const f=fixture(); f.game.start();const keys=f.demo();f.game.input(keys[0]);f.finish();f.game.input(keys[1]==='Q'?'W':'Q');f.demo();
  for(const key of keys){f.game.input(key);f.finish();}assert.equal(f.game.snapshot().score,175);assert.equal(f.values.get('farmar-aura-best'),'175');
  const game=createMemoryGame({},{storage:{getItem(){throw Error();}}}); assert.equal(game.snapshot().bestAura,0);
});
