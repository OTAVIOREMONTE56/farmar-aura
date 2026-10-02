import * as THREE from 'three';
import { createWorld } from '../world/createWorld.js';
import { createCharacter } from '../entities/character/createCharacter.js';
import { CameraDirector } from './CameraDirector.js';
import { MOVEMENTS } from '../entities/character/createMovementController.js';
import { MOVEMENT_IDENTITY } from '../ui/movementIdentity.js';
import { bindMovementInput } from '../ui/bindMovementInput.js';
import { updateDuelAnimation } from '../online/duelAnimation.js';
import { playerView } from '../online/roundTimeline.js';

// Two visual stages; input always uses the authenticated local slot.
export function createOnlineApp(container,service,music,onExit) {
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Seu sapo e o adversário na partida online');
 container.append(renderer.domElement);
 const views=[0,1].map(()=>{const world=createWorld(),camera=new THREE.PerspectiveCamera(45,1,.05,200),character=createCharacter();world.scene.add(character.root);return {world,camera,character,director:new CameraDirector(camera,character),eventToken:'',animationToken:'',visual:{phase:'ready'}};});
 const character=views[0].character;
 const ui=document.createElement('div');ui.className='online-ui';
 ui.innerHTML='<header><button class="online-exit">SAIR DA SALA</button><b class="online-round"></b><button class="online-sound" aria-label="Silenciar música">🔊</button><small class="online-connection" role="status"></small><div class="online-cue" role="status"></div></header><div class="online-duel-huds"></div><div class="online-feedback" role="status"></div><div class="online-buttons" role="group" aria-label="Seus movimentos"></div><div class="online-overlay"><section></section></div>';
 document.body.append(ui);
 const find=s=>ui.querySelector(s);
 const huds=views.map(()=>{const panel=document.createElement('section');panel.className='online-duel-hud';panel.innerHTML='<b class="online-self"></b><span class="online-lives"></span><strong class="online-aura"></strong><span class="online-combo"></span><span class="online-progress"></span><span class="online-player-cue"></span>';find('.online-duel-huds').append(panel);return panel;});
 const buttons=MOVEMENTS.map(movement=>{
  const identity=MOVEMENT_IDENTITY[movement.key],button=document.createElement('button');button.type='button';
  button.dataset.movement=movement.key;button.style.setProperty('--move-color',identity.color);button.style.setProperty('--move-ink',identity.ink);
  button.innerHTML='<span>'+identity.symbol+'</span><b>'+identity.label+'</b><small>'+movement.key+'</small>';
  button.setAttribute('aria-label',movement.key+' — '+identity.label);find('.online-buttons').append(button);
  return {button,movement};
 });
 let previous=null,disposed=false,readySent=false,readyRetryAt=0,sending=false,animationToken='',eventToken='',matchToken='',overlayToken='',feedback='',feedbackUntil=0;
 let state=service.snapshot(),visual={phase:'ready'},replayPending=false;
 const loaded=()=>views.map(v=>v.character).every(c=>c.status!=='loading'&&MOVEMENTS.every(m=>c.animationNames.includes(m.name)));
 function resetAnimation(target=character){target.stopAnimation({fade:0});target.mixer.stopAllAction();target.playAnimation('idle',{fade:0,loop:true});}
 function animate(key,elapsed,target=character){resetAnimation(target);const movement=MOVEMENTS.find(m=>m.key===key);if(movement&&target.movements.play(movement.name))target.mixer.update(Math.max(0,elapsed)/1000);}
 async function submit(key){
  state=service.snapshot();const p=state.room&&playerView(state.room,state.slot,state.now);
  if(sending||!loaded()||!state.connected||!p?.canInput||character.movements.busy)return;
  sending=true;views[0].predictedKey=key;animate(key,0);feedback='ENVIANDO...';feedbackUntil=performance.now()+12000;
  try{await service.move(key);}catch(e){views[0].predictedKey=null;resetAnimation();feedback=e.message;feedbackUntil=performance.now()+5000;void service.sync();}
  finally{sending=false;}
 }
 const unbind=bindMovementInput(buttons,submit);
 function key(event){if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)||event.target?.isContentEditable)return;const m=MOVEMENTS.find(m=>event.code==='Key'+m.key);if(m){event.preventDefault();void submit(m.key);}}
 function resize(){
  const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
  const head=find('header').getBoundingClientRect(),hud=find('.online-duel-huds').getBoundingClientRect(),pad=find('.online-buttons').getBoundingClientRect();
  const laneWidth=width/2;
  views.forEach(v=>{v.camera.aspect=laneWidth/height;v.director.resize({width:laneWidth,height,top:hud.bottom+8,bottom:pad.top-32,left:4,right:laneWidth-4});});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25));renderer.setSize(width,height,false);
 }
 const observer=new ResizeObserver(resize);observer.observe(container);observer.observe(find('header'));observer.observe(find('.online-duel-huds'));observer.observe(find('.online-buttons'));
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('keydown',key);
 function render(time){
  state=service.snapshot();const r=state.room;if(!r)return;
  const p=playerView(r,state.slot,state.now),op=playerView(r,1-state.slot,state.now);visual={...p,level:r.round_no,length:r.sequence.length};
  find('.online-round').textContent='RODADA '+r.round_no+' / 5';
  views.forEach((view,i)=>{
   const slot=i===0?state.slot:1-state.slot,v=updateDuelAnimation(view,r,slot,state.now,(key,elapsed)=>animate(key,elapsed,view.character),()=>resetAnimation(view.character)),panel=huds[i];view.visual={...v,level:r.round_no,length:r.sequence.length};
   panel.querySelector('.online-self').textContent=(i===0?'VOCÊ':'ADVERSÁRIO')+' · J'+(slot+1);
   panel.querySelector('.online-lives').textContent='❤️'.repeat(v.lives??3)+'🖤'.repeat(3-(v.lives??3));
   panel.querySelector('.online-aura').textContent=(v.score??0)+' AURA';panel.querySelector('.online-combo').textContent='COMBO x'+(v.combo??1);
   panel.querySelector('.online-progress').textContent='PROGRESSO '+(v.index??0)+' / '+r.sequence.length;
   const demo=v.demonstration;
   panel.querySelector('.online-player-cue').textContent=demo?MOVEMENT_IDENTITY[demo.key].label:v.phase==='countdown'?String(v.countdown):v.phase==='out'?'SEM VIDAS':v.status==='finished'?'COMPLETO!':v.phase==='error'?'TENTE NOVAMENTE':'';

  });
  find('.online-connection').textContent=!state.connected?'RECONECTANDO...':state.status==='realtime'?'ONLINE':'SINCRONIZANDO...';
  const demo=p.demonstration;
  find('.online-cue').textContent=demo?MOVEMENT_IDENTITY[demo.key].symbol+' '+MOVEMENT_IDENTITY[demo.key].label+' '+demo.index+'/'+r.sequence.length:p.phase==='countdown'?String(p.countdown):({'memorize-intro':'👀 MEMORIZE!','demonstrate':'👀 MEMORIZE!','play':'REPITA A SEQUÊNCIA','error':'OPA! TENTE NOVAMENTE','complete':'COMPLETO! AGUARDE O ADVERSÁRIO','out':'SEM VIDAS — TORÇA PELO AMIGO!'})[p.phase]??'';
  if(matchToken!==r.match_no){matchToken=r.match_no;eventToken='';replayPending=false;}
  const event=r.players[state.slot]?.event;
  if(event&&event.id!==eventToken){eventToken=event.id;feedback=event.kind==='hit'?(p.first&&p.status==='finished'?'🔥 PRIMEIRO! +50 AURA':'BOA! ⭐ +25 AURA'):p.lives?'OPA! TENTE DE NOVO!':'SEM VIDAS';feedbackUntil=time+1600;}
  find('.online-feedback').textContent=time<feedbackUntil?feedback:state.error||'';
  buttons.forEach(({button,movement})=>{button.disabled=sending||!loaded()||!state.connected||!p.canInput||character.movements.busy;button.classList.toggle('demonstrating',demo?.key===movement.key);});
  const overlay=find('.online-overlay');const show=['waiting','loading','round-result','result','closed'].includes(r.phase);overlay.hidden=!show;
  const signature=r.phase+':'+r.match_no+':'+r.round_no+':'+r.replay.join(',')+':'+r.players.map(v=>v.score).join(',');
  if(show&&overlayToken!==signature){
   overlayToken=signature;const panel=overlay.querySelector('section');panel.replaceChildren();
   const heading=document.createElement('h1');heading.textContent=r.phase==='waiting'?'SUA SALA':r.phase==='loading'?'CARREGANDO OS SAPOS...':r.phase==='closed'?'SALA ENCERRADA':r.phase==='round-result'?'RESULTADO DA RODADA':r.players[0].score===r.players[1].score?'EMPATE!':'JOGADOR '+(r.players[0].score>r.players[1].score?1:2)+' VENCEU!';panel.append(heading);
   if(r.phase==='waiting'){const code=document.createElement('strong');code.className='online-code';code.textContent=r.code;panel.append(code);}
   if(r.phase==='waiting'||r.phase==='loading'){const text=document.createElement('p');text.textContent=r.phase==='waiting'?'Esperando o Jogador 2... Compartilhe o código.':'A partida começa automaticamente quando os dois aparelhos estiverem prontos.';panel.append(text);}
   else if(r.phase==='closed'){const text=document.createElement('p');text.textContent='Um jogador saiu, desconectou por mais de 90 segundos ou a sala expirou.';panel.append(text);}
   else{
    r.players.forEach((v,i)=>{const text=document.createElement('p');text.textContent='JOGADOR '+(i+1)+': '+(r.phase==='round-result'?v.score-v.roundStart:v.score)+' AURA';panel.append(text);});
    if(r.phase==='round-result'){const text=document.createElement('p');const a=r.players.map(v=>v.score-v.roundStart);text.textContent=a[0]===a[1]?'EMPATE NA RODADA!':'JOGADOR '+(a[0]>a[1]?1:2)+' GANHOU A RODADA!';panel.append(text);}
    if(r.phase==='result'){const button=document.createElement('button');button.className='online-replay';button.textContent=r.replay[state.slot]?'ESPERANDO O ADVERSÁRIO...':'JOGAR NOVAMENTE';button.disabled=r.replay[state.slot]||!state.connected;panel.append(button);}
   }
   const leave=document.createElement('button');leave.className='online-exit';leave.textContent='SAIR DA SALA';panel.append(leave);
  }
  if(!show)overlayToken='';
  const replayButton=find('.online-replay');if(replayButton)replayButton.disabled=!!r.replay[state.slot]||replayPending||!state.connected;
  if(r.phase==='loading'&&loaded()&&!readySent&&time>=readyRetryAt){readySent=true;void service.ready().catch(e=>{readySent=false;readyRetryAt=performance.now()+5000;feedback=e.message;feedbackUntil=performance.now()+5000;});}
  const sound=find('.online-sound');sound.textContent=music.muted?'🔇':'🔊';sound.setAttribute('aria-label',music.muted?'Ativar música':'Silenciar música');sound.setAttribute('aria-pressed',String(music.muted));
  music.update(r.phase==='result'?'result':'player',time);
 }
 ui.addEventListener('click',event=>{
  if(event.target.closest('.online-exit'))onExit();
  if(event.target.closest('.online-sound')){music.start();music.toggle();}
  if(event.target.closest('.online-replay')&&!replayPending){replayPending=true;music.start();void service.replay().catch(e=>{replayPending=false;feedback=e.message;feedbackUntil=performance.now()+5000;});}
 });
 views.forEach(v=>void v.character.load());resize();
 return {start(){renderer.setAnimationLoop(time=>{
  const delta=previous===null?0:Math.min(.1,(time-previous)/1000);previous=time;views.forEach(v=>v.character.update(delta));render(time);
  renderer.setScissorTest(true);const width=container.clientWidth,height=container.clientHeight,split=Math.floor(width/2);
  views.forEach((v,i)=>{const x=i?split:0,w=i?width-split:split;v.director.update(delta,v.visual);v.world.update(delta,v.visual.combo??1,time/1000,{dancing:v.character.movements.busy});renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.render(v.world.scene,v.camera);});
 });},dispose(){if(disposed)return;disposed=true;renderer.setAnimationLoop(null);observer.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.removeEventListener('keydown',key);unbind();views.forEach(v=>{v.character.dispose();v.world.dispose();});renderer.dispose();renderer.domElement.remove();ui.remove();}};
}
