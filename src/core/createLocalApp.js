import * as THREE from 'three';
import { createWorld } from '../world/createWorld.js';
import { createCharacter } from '../entities/character/createCharacter.js';
import { CameraDirector } from './CameraDirector.js';
import { createLocalMultiplayerGame } from '../game/createLocalMultiplayerGame.js';
import { MOVEMENTS } from '../entities/character/createMovementController.js';
import { MOVEMENT_IDENTITY } from '../ui/movementIdentity.js';
import { bindMovementInput } from '../ui/bindMovementInput.js';

export function createLocalApp(container, onMenu) {
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping;
  container.append(renderer.domElement);
  const views=[0,1].map(()=>{const world=createWorld(),character=createCharacter(),camera=new THREE.PerspectiveCamera(45,1,.05,200);world.scene.add(character.root);return {world,character,camera,director:new CameraDirector(camera,character)};});
  const game=createLocalMultiplayerGame(views.map(v=>v.character));
  const ui=document.createElement('div');ui.className='local-ui';
  ui.innerHTML='<header><button class="menu">MENU</button><strong class="phase" role="status"></strong><span class="round"></span></header><div class="local-panels"></div><div class="local-overlay"><section></section></div>';
  document.body.append(ui);
  const panels=views.map((view,i)=>{
    const panel=document.createElement('section');panel.className='local-player';panel.dataset.player=i;
    panel.innerHTML='<div class="local-hud"><b>JOGADOR '+(i+1)+'</b><span class="lives"></span><span class="aura"></span><span class="combo"></span></div><div class="local-demo"></div><div class="local-feedback" role="status"></div><div class="local-progress"></div><div class="local-buttons" role="group" aria-label="Movimentos jogador '+(i+1)+'"></div>';
    ui.querySelector('.local-panels').append(panel);
    const buttons=MOVEMENTS.map((movement,j)=>{const identity=MOVEMENT_IDENTITY[movement.key],button=document.createElement('button');button.type='button';button.dataset.movement=movement.key;button.style.background=identity.color;button.style.color=identity.ink;button.innerHTML='<span>'+identity.symbol+'</span><b>'+identity.label+'</b><small>'+(i===0?movement.key:['U','I','O','J','K','L'][j])+'</small>';panel.querySelector('.local-buttons').append(button);return {button,movement};});
    return {panel,buttons,unbind:bindMovementInput(buttons,key=>game.input(i,key),{allowNonPrimary:true})};
  });
  let state=game.snapshot(),signature='',previous=null;
  const overlay=ui.querySelector('.local-overlay');
  function loaded(){return views.every(v=>v.character.status!=='loading'&&MOVEMENTS.every(m=>v.character.animationNames.includes(m.name)));}
  function update(time){game.update(time);state=game.snapshot(time);
    ui.querySelector('.round').textContent='RODADA '+state.level+' / '+state.rounds;
    ui.querySelector('.phase').textContent=state.phase==='countdown'?state.countdown:state.go?'VALENDO!':({'memorize-intro':'👀 MEMORIZEM',demonstrate:'👀 MEMORIZEM',play:'REPITAM A SEQUÊNCIA','round-result':state.duoPerfect?'🌟 OS DOIS ARRASARAM!':'RESULTADO DA RODADA'})[state.phase]??'';
    const show=['ready','result'].includes(state.phase);overlay.hidden=!show;
    if(show&&signature!==state.phase){signature=state.phase;overlay.querySelector('section').innerHTML=state.phase==='ready'?'<h1>2 JOGADORES</h1><p>Memorizem a mesma dança e repitam cada um no seu lado. 5 rodadas, 3 vidas por jogador. Quem terminar primeiro ganha +50 Aura!</p><p>J1: Q W E R T Y · J2: U I O J K L<br>No celular, usem os botões de cada lado. Virem para paisagem.</p><button class="local-start">JOGAR</button>':'<h1>'+(state.winner===null?'EMPATE!':'JOGADOR '+(state.winner+1)+' VENCEU!')+'</h1><p>'+state.players.map((p,i)=>'J'+(i+1)+': '+p.score+' AURA').join(' · ')+'</p><button class="local-start">JOGAR NOVAMENTE</button>';}
    if(!show)signature='';
    const start=ui.querySelector('.local-start');if(start)start.disabled=!loaded();
    panels.forEach(({panel,buttons},i)=>{const p=state.players[i];panel.querySelector('.lives').textContent=p?'❤️'.repeat(p.lives)+'🖤'.repeat(3-p.lives):'❤️❤️❤️';panel.querySelector('.aura').textContent=(p?.score??0)+' AURA';panel.querySelector('.combo').textContent='COMBO x'+(p?.combo??1);
      const demo=p?.demonstration;panel.querySelector('.local-demo').textContent=demo?MOVEMENT_IDENTITY[demo.key].symbol+' '+MOVEMENT_IDENTITY[demo.key].label+' '+demo.index+'/'+state.length:['retry-intro','retry-turn'].includes(p?.status)?'MEMORIZE E TENTE DE NOVO':'';
      panel.querySelector('.local-progress').textContent=p?'PROGRESSO '+p.index+'/'+state.length:'';
      panel.querySelector('.local-feedback').textContent=state.phase==='round-result'?'+ '+p.roundAura+' AURA NESTA RODADA':p?.feedback||(p?.status==='finished'?'COMPLETO! AGUARDE':p?.status==='out'?'SEM VIDAS — TORÇA PELO AMIGO!':'');
      buttons.forEach(({button,movement})=>{button.disabled=!p?.canInput;button.classList.toggle('demonstrating',demo?.key===movement.key);});
    });
  }
  function resize(){const width=container.clientWidth,height=container.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setSize(width,height,false);views.forEach(v=>{v.camera.aspect=(width/2)/height;v.director.resize({width:width/2,height,top:Math.min(115,height*.3),bottom:height-(height>=650?175:135)});});}
  function key(event){if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)||event.target?.isContentEditable)return;const keys=[['Q','W','E','R','T','Y'],['U','I','O','J','K','L']];keys.forEach((set,i)=>{const j=set.indexOf(event.code.replace('Key',''));if(j>=0){event.preventDefault();game.input(i,MOVEMENTS[j].key);}});}
  ui.addEventListener('click',e=>{if(e.target.closest('.menu'))onMenu();else if(e.target.closest('.local-start')&&loaded())game.start();});
  window.addEventListener('keydown',key);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
  const observer=new ResizeObserver(resize);observer.observe(container);resize();views.forEach(v=>void v.character.load());update(performance.now());
  return {start(){renderer.setAnimationLoop(time=>{const delta=previous===null?0:Math.min((time-previous)/1000,.1);previous=time;views.forEach(v=>v.character.update(delta));update(time);renderer.setScissorTest(true);const width=container.clientWidth,height=container.clientHeight,split=Math.floor(width/2);views.forEach((v,i)=>{const x=i?split:0,w=i?width-split:split;const p=state.players[i];v.director.update(delta,{...p,phase:p?.status==='moving'?'player-move':p?.status==='finished'?'complete':state.phase});v.world.update(delta,p?.combo??1,time/1000,{dancing:v.character.movements.busy});renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.render(v.world.scene,v.camera);});});},dispose(){renderer.setAnimationLoop(null);observer.disconnect();window.removeEventListener('keydown',key);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);panels.forEach(p=>p.unbind());views.forEach(v=>{v.character.dispose();v.world.dispose();});renderer.dispose();renderer.domElement.remove();ui.remove();}};
}
