import test from 'node:test';import assert from 'node:assert/strict';
import {updateDuelAnimation} from '../src/online/duelAnimation.js';
import {createRoomClient} from '../src/online/createRoomClient.js';
const room={id:'room',host_id:'host',guest_id:'guest',match_no:1,round_no:1,round_at:0,sequence:['E','Q'],phase:'round',revision:1,players:[{status:'player',index:1,availableAt:12000,event:{id:'host-move',kind:'hit',key:'E',at:10000}},{status:'player',index:0,availableAt:0,event:null}]};
test('remote move reproduces animation with latency compensation once, independently of local player',()=>{
 const remote={},local={},events=[];const animate=(key,elapsed)=>events.push({key,elapsed});
 updateDuelAnimation(remote,room,0,10300,animate,()=>{});updateDuelAnimation(local,room,1,10300,animate,()=>{});
 assert.deepEqual(events,[{key:'E',elapsed:300}]);updateDuelAnimation(remote,room,0,10400,animate,()=>{});assert.equal(events.length,1);
 updateDuelAnimation(remote,{...room,players:[{...room.players[0],event:{id:'next',kind:'hit',key:'Q',at:13000}},room.players[1]]},0,13100,animate,()=>{});assert.deepEqual(events[1],{key:'Q',elapsed:100});
});
test('local prediction is not restarted by acknowledgement and stale moves are not replayed',()=>{const view={matchToken:1,predictedKey:'E'},events=[];updateDuelAnimation(view,room,0,10300,(...args)=>events.push(args),()=>{});assert.equal(events.length,0);updateDuelAnimation({},room,0,15000,(...args)=>events.push(args),()=>{});assert.equal(events.length,0);});
test('each authenticated client sends only a key for its own player, never an opponent slot',async()=>{
 for(const user of ['host','guest']){let calls=[];const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}}})},rpc:(name,args)=>({abortSignal:async()=>{calls.push(args);return {data:{room,server_now:10300}}}}),channel:()=>({on(){return this},subscribe(){return {}}}),removeChannel:async()=>{}};const service=createRoomClient({client});try{await service.open(user==='host'?'create':'join','ABC123');assert.equal(service.snapshot().slot,user==='host'?0:1);await service.move('E','request');const args=calls.at(-1);assert.deepEqual(args,{p_action:'move',p_room:'room',p_key:'E',p_request:'request',p_match:1,p_round:1});}finally{service.dispose();}}
});
