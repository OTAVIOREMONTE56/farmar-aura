import { createRoomClient, onlineConfig } from '../online/createRoomClient.js';
import { createOnlineApp } from '../core/createOnlineApp.js';
import { createBackgroundMusic } from '../audio/createBackgroundMusic.js';
export function createOnlineLobby(container,onMenu) {
 const ui=document.createElement('div');ui.className='mode-menu online-lobby';
 ui.innerHTML='<section><h1>2 JOGADORES ONLINE</h1><p>Cada jogador no seu aparelho. Mesma sequência, 5 rodadas!</p><button data-create>CRIAR SALA</button><button data-join>ENTRAR EM SALA</button><form hidden><label for="room-code">CÓDIGO DA SALA</label><input id="room-code" maxlength="6" minlength="6" pattern="[a-fA-F0-9]{6}" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="ABC123"><button type="submit">ENTRAR</button></form><p class="lobby-error" role="alert"></p><button data-back>VOLTAR</button></section>';
 document.body.append(ui);let service=null,game=null,music=null,disposed=false,busy=false;
 async function open(action,code){
  if(busy||disposed)return;
  try{onlineConfig();}catch(e){ui.querySelector('.lobby-error').textContent=e.message;return;}
  busy=true;ui.querySelector('.lobby-error').textContent='CONECTANDO...';ui.querySelectorAll('button:not([data-back])').forEach(b=>b.disabled=true);
  // Unlock audio within the originating touch/click, before authentication awaits.
  music=createBackgroundMusic();music.start();
  try{
   service=createRoomClient();await service.open(action,code);
   if(disposed)return;
   game=createOnlineApp(container,service,music,exit);game.start();ui.remove();
  }catch(e){
   if(disposed)return;
   service?.dispose();service=null;music?.dispose();music=null;
   ui.querySelector('.lobby-error').textContent=e.message;ui.querySelectorAll('button').forEach(b=>b.disabled=false);busy=false;
  }
 }
 function exit(){
  if(disposed)return;
  const current=service;
  // Keep authorization alive until the leave RPC completes; local cleanup is immediate.
  game?.dispose();game=null;music?.dispose();music=null;ui.remove();disposed=true;
  if(current)void current.leave().catch(()=>{});
  onMenu();
 }
 ui.addEventListener('click',event=>{
  if(event.target.closest('[data-create]'))void open('create');
  if(event.target.closest('[data-join]')){ui.querySelector('form').hidden=false;ui.querySelector('#room-code').focus();}
  if(event.target.closest('[data-back]'))exit();
 });
 ui.querySelector('form').addEventListener('submit',event=>{event.preventDefault();void open('join',ui.querySelector('input').value.trim().toUpperCase());});
 return {start(){},dispose(){if(disposed)return;disposed=true;game?.dispose();music?.dispose();service?.dispose();ui.remove();}};
}
