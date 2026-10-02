import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoLength, demonstrationAt, playerView, MOVE_MS } from '../src/online/roundTimeline.js';
import * as THREE from 'three';
import { createCharacter } from '../src/entities/character/createCharacter.js';
import { CameraDirector } from '../src/core/CameraDirector.js';
import { createRoomClient, onlineConfig, movementRequestId } from '../src/online/createRoomClient.js';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];

test('timeline preserves all six animation durations and synchronized countdown',()=>{
 const sequence=['Q','W','E','R','T','Y'];
 const end=demoLength(sequence,1);
 assert.equal(demonstrationAt(sequence,1,0,1099).phase,'memorize-intro');
 assert.equal(demonstrationAt(sequence,1,0,1100).demonstration.key,'Q');
 assert.equal(demonstrationAt(sequence,1,0,1100+MOVE_MS.Q).demonstration,null);
 assert.equal(demonstrationAt(sequence,1,0,end-1).countdown,1);
 assert.equal(demonstrationAt(sequence,1,0,end).phase,'play');
 const r={phase:'round',round_at:0,round_no:1,sequence,players:[{status:'player',retryAt:100000,availableAt:100000+end}]};
 assert.equal(playerView(r,0,100000+1100).demonstration.key,'Q');
 assert.equal(playerView(r,0,100000+end).canInput,true);
});
test('configuration fails clearly without credentials and accepts project URL',()=>{
 assert.throws(()=>onlineConfig({}),/env.local/);
 assert.throws(()=>onlineConfig({VITE_SUPABASE_URL:'invalid',VITE_SUPABASE_PUBLISHABLE_KEY:'key'}),/URL/);
 assert.equal(onlineConfig({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-key'}).key,'public-key');
});

test('actual PostgreSQL migration: authentication, RLS, rooms, authoritative moves, five rounds, replay and leave',async t=>{
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create publication supabase_realtime;");
 for(const id of ids)await db.query('insert into auth.users values ($1)',[id]);
 await db.exec(await readFile(new URL('../supabase/multiplayer.sql',import.meta.url),'utf8'));
 // The setup is safe to run again from the Supabase SQL Editor.
 await db.exec(await readFile(new URL('../supabase/multiplayer.sql',import.meta.url),'utf8'));
 async function as(user,sql,args=[]){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);
  await db.exec('set role '+(user?'authenticated':'anon'));
  try{return await db.query(sql,args);}finally{await db.exec('reset role');}
 }
 async function call(user,action,room=null,code=null,key=null,match=null,round=null,request=null){
  const result=await as(user,'select public.aura_room_action($1,$2,$3,$4,$5,$6,$7) as result',[action,room,code,key,match,round,request]);
  return result.rows[0].result.room;
 }
 let room=await call(ids[0],'create');const roomId=room.id;
 await t.test('short code; room visible only to members; no direct writes or anonymous RPC',async()=>{
  assert.match(room.code,/^[A-F0-9]{6}$/);assert.equal(room.phase,'waiting');
  assert.equal((await as(ids[2],'select * from public.aura_rooms')).rows.length,0);
  await assert.rejects(as(ids[0],"update public.aura_rooms set players='[]'"),/permission denied/);
  await assert.rejects(call(null,'create'),/permission denied/);
  await assert.rejects(call(ids[2],'sync',roomId),/pertence/);
  await assert.rejects(call(ids[0],'join',null,room.code),/outro aparelho/);
  await assert.rejects(call(ids[1],'join',null,'ZZZZZZ'),/não encontrada/);
 });
 room=await call(ids[1],'join',null,room.code.toLowerCase());
 await t.test('guest joins by code; third player denied; both ready before starting',async()=>{
  assert.equal(room.phase,'loading');assert.equal(room.guest_id,ids[1]);
  await assert.rejects(call(ids[2],'join',null,room.code),/cheia/);
  room=await call(ids[0],'ready',roomId);assert.equal(room.phase,'loading');
  room=await call(ids[1],'ready',roomId);assert.equal(room.phase,'round');assert.equal(room.sequence.length,2);
  const req=crypto.randomUUID();const before=room.players[0].score;
  room=await call(ids[0],'move',roomId,null,room.sequence[0],1,1,req);assert.equal(room.players[0].score,before);
  assert.equal(room.play_at-room.round_at,demoLength(room.sequence,room.round_no));
 });
 const unlock=async()=>{
  await db.query("update public.aura_rooms set play_at=0, players=jsonb_set(jsonb_set(players,'{0,availableAt}','0'),'{1,availableAt}','0') where id=$1",[roomId]);
 };
 await t.test('independent actions, deduplication, cooldown and stale-round rejection',async()=>{
  await unlock();const request=crypto.randomUUID();
  room=await call(ids[0],'move',roomId,null,room.sequence[0],1,1,request);
  assert.equal(room.players[0].score,25);assert.equal(room.players[1].score,0);
  room=await call(ids[0],'move',roomId,null,room.sequence[1],1,1,crypto.randomUUID());assert.equal(room.players[0].index,1);
  await unlock();room=await call(ids[0],'move',roomId,null,room.sequence[0],1,1,request);assert.equal(room.players[0].index,1);
  room=await call(ids[0],'move',roomId,null,room.sequence[1],1,2,crypto.randomUUID());assert.equal(room.players[0].index,1);
 });
 await t.test('same growing sequence, five synchronized round results, independent Aura and combos',async()=>{
  for(let round=1;round<=5;round++){
   const sequence=[...room.sequence];
   for(let player=0;player<2;player++){
    let index=room.players[player].index;
    for(;index<sequence.length;index++){
     await unlock();room=await call(ids[player],'move',roomId,null,sequence[index],1,round,crypto.randomUUID());
    }
   }
   assert.equal(room.phase,'round-result');assert.equal(room.players[0].status,'finished');assert.equal(room.players[1].status,'finished');
   assert.equal(room.players[0].lives,3);assert.equal(room.players[1].lives,3);assert.equal(room.players[0].combo,round);
   await db.query('update public.aura_rooms set next_at=0 where id=$1',[roomId]);room=await call(ids[1],'sync',roomId);
   if(round<5){assert.equal(room.round_no,round+1);assert.deepEqual(room.sequence.slice(0,-1),sequence);}else assert.equal(room.phase,'result');
  }
  assert(room.players[0].score>=2250);assert(room.players[1].score>=2250);
 });
 await t.test('replay requires both votes, resets independently and rejects previous match input',async()=>{
  room=await call(ids[0],'replay',roomId);assert.equal(room.phase,'result');
  room=await call(ids[1],'replay',roomId);assert.equal(room.phase,'round');assert.equal(room.match_no,2);assert.equal(room.round_no,1);
  assert.equal(room.players[0].score,0);assert.equal(room.players[1].lives,3);
  await unlock();room=await call(ids[0],'move',roomId,null,room.sequence[0],1,1,crypto.randomUUID());assert.equal(room.players[0].score,0);
 });
 await t.test('wrong moves retry same sequence; elimination does not block remaining player',async()=>{
  const sequence=[...room.sequence],wrong=['Q','W','E','R','T','Y'].find(k=>k!==sequence[0]);
  for(let life=2;life>=0;life--){
   await unlock();room=await call(ids[0],'move',roomId,null,wrong,2,1,crypto.randomUUID());
   assert.equal(room.players[0].lives,life);assert.equal(room.players[1].lives,3);assert.deepEqual(room.sequence,sequence);
   if(life){const retry=room.players[0];assert.equal(retry.availableAt-retry.retryAt,demoLength(sequence,1));}
  }
  assert.equal(room.players[0].status,'out');
  assert.equal(room.players[0].retryAt,0);assert(room.players[0].availableAt<=Date.now()+1000);
  for(const key of sequence){await unlock();room=await call(ids[1],'move',roomId,null,key,2,1,crypto.randomUUID());}
  assert.equal(room.phase,'round-result');assert.equal(room.players[1].status,'finished');
 });
 await t.test('leave is visible to both members and prevents further actions',async()=>{
  room=await call(ids[1],'leave',roomId);assert.equal(room.phase,'closed');
  const host=await call(ids[0],'sync',roomId);assert.equal(host.phase,'closed');
  assert.equal((await as(ids[0],'select * from public.aura_rooms where id=$1',[roomId])).rows[0].phase,'closed');
 });
 await t.test('disconnect timeout closes a match',async()=>{
  let other=await call(ids[0],'create');other=await call(ids[1],'join',null,other.code);
  await db.query('update public.aura_rooms set seen_at=array[0::bigint,0::bigint] where id=$1',[other.id]);
  other=await call(ids[0],'sync',other.id);assert.equal(other.phase,'closed');
 });
 await db.close();
});

test('client keeps newer realtime state when an older RPC arrives; subscribes only to its room and cleans up',async()=>{
 let handler,statusHandler,removed=false,t=1000;
 const base={id:'room-id',host_id:'host',guest_id:'guest',revision:0,phase:'waiting'};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'host'}}}})},
  rpc:(name,args)=>({abortSignal:async()=>({data:{room:base,server_now:5000}})}),
  channel:()=>({on:(event,filter,cb)=>{assert.equal(filter.filter,'id=eq.room-id');handler=cb;return {subscribe:cb=>{statusHandler=cb;return {};}};}}),
  removeChannel:async()=>{removed=true;}};
 const service=createRoomClient({client,clock:()=>t});await service.open('create');
 statusHandler('SUBSCRIBED');handler({new:{...base,revision:5,phase:'round'}});
 await service.sync();assert.equal(service.snapshot().room.revision,5);
 assert.equal(service.snapshot().slot,0);assert.equal(service.snapshot().connected,true);
 t+=8000;assert.equal(service.snapshot().connected,false);service.dispose();assert.equal(removed,true);
});


test('online camera keeps animated frog inside usable space in six mobile sizes and desktop',()=>{
 globalThis.window={matchMedia:()=>({matches:false})};
 const character=createCharacter(),camera=new THREE.PerspectiveCamera(45,1,.05,200),director=new CameraDirector(camera,character);
 for(const [width,height] of [[360,800],[390,844],[430,932],[800,360],[844,390],[932,430],[1440,900]]){
  const side=width>height&&width<=1100;
  const top=190,bottom=side?height-12:height-(width<=600?218:156);
  const right=side?width*.55-12:width;
  camera.aspect=width/height;director.resize({width,height,top,bottom,left:8,right});
  for(const name of ['passinho','giro','moonwalk','pose-sigma','dab','breakdance']){
   character.stopAnimation({fade:0});character.mixer.stopAllAction();
   assert(character.playAnimation(name,{fade:0,loop:false}));
   for(let frame=0;frame<160;frame++){
    character.update(1/60);director.update(1/60,{phase:'demonstrate',lives:3,index:0});camera.updateMatrixWorld(true);
    const box=character.getBounds();
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const point=new THREE.Vector3(x,y,z).project(camera),sx=(point.x+1)*width/2,sy=(1-point.y)*height/2;
     assert(sx>=7&&sx<=right+1,'online horizontal '+width+'x'+height+' '+name);
     assert(sy>=top-1&&sy<=bottom+1,'online vertical '+width+'x'+height+' '+name);
    }
   }
  }
 }
 character.dispose();
});
test('mobile HTTP fallback generates valid distinct UUIDs without randomUUID',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const nativeCrypto=globalThis.crypto;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:array=>nativeCrypto.getRandomValues(array)}});
 try{const a=movementRequestId(),b=movementRequestId();assert.match(a,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.notEqual(a,b);}finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
