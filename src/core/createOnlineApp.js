import * as THREE from 'three';
import { createWorld } from '../world/createWorld.js';
import { createCharacter } from '../entities/character/createCharacter.js';
import { CameraDirector } from './CameraDirector.js';
import { MOVEMENTS } from '../entities/character/createMovementController.js';
import { MOVEMENT_IDENTITY } from '../ui/movementIdentity.js';
import { bindMovementInput } from '../ui/bindMovementInput.js';
import { playerView, MOVE_MS } from '../online/roundTimeline.js';

// One scene, camera and character: every device controls only its own authenticated slot.
export function createOnlineApp(container,service,music,onExit) {
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Seu sapo 3D na partida online');
 container.append(renderer.domElement);
 const world=createWorld(),camera=new THREE.PerspectiveCamera(45,1,.05,200);
 const character=createCharacter();world.scene.add(character.root);
 const director=new CameraDirector(camera,character);
 const ui=document.createElement('div');ui.className='online-ui';
 ui.innerHTML='<header><button class="online-exit">SAIR DA SALA</button><b class="online-round"></b><button class="online-sound" aria-label="Silenciar música">🔊</button><small class="online-connection" role="status"></small><div class="online-opponent"></div><div class="online-hud"><b class="online-self"></b><span class="online-lives"></span><strong class="online-aura"></strong><span class="online-combo"></span></div></header><div class="online-cue" role="status"></div><div class="online-feedback" role="status"></div><div class="online-progress"></div><div class="online-buttons" role="group" aria-label="Seus movimentos"></div><div class="online-overlay"><section></section></div>';
 document.body.append(ui);
 const find=s=>ui.querySelector(s);
 const buttons=MOVEMENTS.map(movement=>{
  const identity=MOVEMENT_IDENTITY[movement.key],button=document.createElement('button');button.type='button';
  button.dataset.movement=movement.key;button.style.setProperty('--move-color',identity.color);button.style.setProperty('--move-ink',identity.ink);
  button.innerHTML='<span>'+identity.symbol+'</span><b>'+identity.label+'</b><small>'+movement.key+'</small>';
  button.setAttribute('aria-label',movement.key+' — '+identity.label);find('.online-buttons').append(button);
  return {button,movement};
 });
 let previous=null,disposed=false,readySent=false,readyRetryAt=0,sending=false,animationToken='',eventToken='',matchToken='',overlayToken='',feedback='',feedbackUntil=0;
 let state=service.snapshot(),visual={phase:'ready'},replayPending=false;
 const loaded=()=>character.status!=='loading'&&MOVEMENTS.every(m=>character.animationNames.includes(m.name));
 function resetAnimation(){character.stopAnimation({fade:0});character.mixer.stopAllAction();character.playAnimation('idle',{fade:0,loop:true});}
 function animate(key,elapsed){resetAnimation();const movement=MOVEMENTS.find(m=>m.key===key);if(movement&&character.movements.play(movement.name))character.mixer.update(Math.max(0,elapsed)/1000);}
 async function submit(key){
  state=service.snapshot();const p=state.room&&playerView(state.room,state.slot,state.now);
  if(sending||!loaded()||!state.connected||!p?.canInput||character.movements.busy)return;
  sending=true;feedback='ENVIANDO...';feedbackUntil=performance.now()+12000;
  try{await service.move(key);}catch(e){feedback=e.message;feedbackUntil=performance.now()+5000;void service.sync();}
  finally{sending=false;}
 }
 const unbind=bindMovementInput(buttons,submit);
 function key(event){if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)||event.target?.isContentEditable)return;const m=MOVEMENTS.find(m=>event.code==='Key'+m.key);if(m){event.preventDefault();void submit(m.key);}}
 function resize(){
  const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
  const head=find('header').getBoundingClientRect(),pad=find('.online-buttons').getBoundingClientRect();
  const side=width>height&&width<=1100;
  camera.aspect=width/height;
  director.resize({width,height,top:head.bottom+48,bottom:side?height-12:pad.top-28,...(side?{left:8,right:pad.left-12}:{})});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25));renderer.setSize(width,height,false);
 }
 const observer=new ResizeObserver(resize);observer.observe(container);observer.observe(find('header'));observer.observe(find('.online-buttons'));
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('keydown',key);
 function render(time){
  state=service.snapshot();const r=state.room;if(!r)return;
  const p=playerView(r,state.slot,state.now),op=r.players[1-state.slot];visual={...p,level:r.round_no,length:r.sequence.length};
  find('.online-round').textContent='RODADA '+r.round_no+' / 5';
  find('.online-self').textContent='VOCÊ · JOGADOR '+(state.slot+1);
  find('.online-lives').textContent='❤️'.repeat(p.lives??3)+'🖤'.repeat(3-(p.lives??3));
  find('.online-aura').textContent=(p.score??0)+' AURA';find('.online-combo').textContent='COMBO x'+(p.combo??1);
  find('.online-opponent').textContent=op?'JOGADOR '+(2-state.slot)+' · '+op.score+' AURA · '+'❤️'.repeat(op.lives)+'🖤'.repeat(3-op.lives)+' · '+op.index+'/'+r.sequence.length+' '+(op.status==='finished'?'COMPLETO':op.status==='out'?'SEM VIDAS':''):'Esperando o Jogador 2...';
  find('.online-connection').textContent=!state.connected?'RECONECTANDO...':state.status==='realtime'?'ONLINE':'SINCRONIZANDO...';
  find('.online-progress').textContent='PROGRESSO '+(p.index??0)+' / '+r.sequence.length+' · SEQUÊNCIA '+r.sequence.length;
  const demo=p.demonstration;
  find('.online-cue').textContent=demo?MOVEMENT_IDENTITY[demo.key].symbol+' '+MOVEMENT_IDENTITY[demo.key].label+' '+demo.index+'/'+r.sequence.length:p.phase==='countdown'?String(p.countdown):({'memorize-intro':'👀 MEMORIZE!','demonstrate':'👀 MEMORIZE!','play':'REPITA A SEQUÊNCIA','error':'OPA! TENTE NOVAMENTE','complete':'COMPLETO! AGUARDE O ADVERSÁRIO','out':'SEM VIDAS — TORÇA PELO AMIGO!'})[p.phase]??'';
  if(matchToken!==r.match_no){matchToken=r.match_no;eventToken='';animationToken='';resetAnimation();replayPending=false;}
  const demoToken=demo?r.match_no+':'+r.round_no+':'+demo.start:'';
  if(demo&&demoToken!==animationToken){animationToken=demoToken;animate(demo.key,demo.elapsed);}
  const event=r.players[state.slot]?.event;
  if(event&&event.id!==eventToken){
   eventToken=event.id;
   if(event.kind==='hit'){
    if(state.now-event.at<MOVE_MS[event.key])animate(event.key,state.now-event.at);
    feedback=p.first&&p.status==='finished'?'🔥 PRIMEIRO! +50 AURA':'BOA! ⭐ +25 AURA';
   }else feedback=p.lives?'OPA! 🐸 TENTE DE NOVO!':'SEM VIDAS — TORÇA PELO AMIGO!';
   feedbackUntil=time+1600;
  }
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
 void character.load();resize();
 return {start(){renderer.setAnimationLoop(time=>{
  const delta=previous===null?0:Math.min(.1,(time-previous)/1000);previous=time;character.update(delta);render(time);
  director.update(delta,visual);world.update(delta,visual.combo??1,time/1000,{dancing:character.movements.busy});renderer.render(world.scene,camera);
 });},dispose(){if(disposed)return;disposed=true;renderer.setAnimationLoop(null);observer.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.removeEventListener('keydown',key);unbind();character.dispose();world.dispose();renderer.dispose();renderer.domElement.remove();ui.remove();}};
}
