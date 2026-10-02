import { MOVEMENTS } from '../entities/character/createMovementController.js';
export const MOVE_MS = Object.freeze({ Q:2100, W:1300, E:2000, R:1500, T:1000, Y:2500 });
export const roundPause = round => Math.max(260,750-(round-1)*45);
export function demoLength(sequence,round) {
 return 1100+sequence.reduce((total,key)=>total+MOVE_MS[key]+roundPause(round),0)+3000;
}
export function demonstrationAt(sequence,round,start,now) {
 let cursor=start+1100;
 if(now<cursor)return {phase:'memorize-intro',demonstration:null};
 for(let i=0;i<sequence.length;i++) {
  const end=cursor+MOVE_MS[sequence[i]];
  if(now<end)return {phase:'demonstrate',demonstration:{...MOVEMENTS.find(m=>m.key===sequence[i]),index:i+1,start:cursor,elapsed:Math.max(0,now-cursor)}};
  cursor=end+roundPause(round);
  if(now<cursor)return {phase:'demonstrate',demonstration:null};
 }
 if(now<cursor+3000)return {phase:'countdown',countdown:Math.max(1,Math.ceil((cursor+3000-now)/1000)),demonstration:null};
 return {phase:'play',demonstration:null};
}
export function playerView(room,slot,now) {
 const player=room.players[slot];
 if(!player)return {phase:room.phase,demonstration:null};
 if(room.phase!=='round')return {...player,phase:room.phase,demonstration:null};
 const start=player.retryAt||room.round_at;
 const timeline=demonstrationAt(room.sequence,room.round_no,start,now);
 if(player.status==='out')return {...player,phase:'out',demonstration:null};
 if(player.status==='finished')return {...player,phase:now<player.availableAt?'player-move':'complete',demonstration:null};
 if(player.retryAt && now<player.retryAt)return {...player,phase:'error',demonstration:null};
 return {...player,...timeline,canInput:timeline.phase==='play'&&now>=player.availableAt};
}
