import { MOVE_MS, playerView } from './roundTimeline.js';
// Presentation only. A remote lane never sends actions or changes game state.
export function updateDuelAnimation(view,room,slot,now,animate,reset){
 const player=playerView(room,slot,now);view.visual={...player,level:room.round_no,length:room.sequence.length};
 if(view.matchToken!==room.match_no){view.matchToken=room.match_no;view.eventToken='';view.animationToken='';view.predictedKey=null;reset();}
 const demo=player.demonstration,token=demo?room.match_no+':'+room.round_no+':'+demo.start:'';
 if(demo&&token!==view.animationToken){view.animationToken=token;animate(demo.key,demo.elapsed);}
 const event=room.players[slot]?.event;
 if(event&&event.id!==view.eventToken){view.eventToken=event.id;
  if(event.kind==='hit'&&now-event.at<MOVE_MS[event.key]&&view.predictedKey!==event.key)animate(event.key,Math.max(0,now-event.at));
  else if(event.kind==='error')reset();
  view.predictedKey=null;
 }
 return player;
}
