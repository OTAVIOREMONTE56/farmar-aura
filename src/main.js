import './styles.css';
import { createApp } from './core/createApp.js';
import { createLocalApp } from './core/createLocalApp.js';
import { createOnlineLobby } from './ui/createOnlineLobby.js';
let app;
function showError(error){console.error(error);const message=document.querySelector('#message');message.textContent='Não foi possível iniciar o jogo. '+error.message;message.hidden=false;}
function showModeMenu(){
 app?.dispose();app=null;document.querySelector('.solo-menu')?.remove();document.querySelector('#message').hidden=true;
 const menu=document.createElement('div');menu.className='mode-menu';
 menu.innerHTML='<section><h1>FARMAR AURA</h1><p>ESCOLHA COMO JOGAR</p><button data-mode="solo">1 JOGADOR</button><button data-mode="duo">2 JOGADORES</button><small>Joguem juntos, cada um no seu aparelho</small></section>';
 document.body.append(menu);
 menu.addEventListener('click',event=>{
  const mode=event.target.closest('[data-mode]')?.dataset.mode;if(!mode)return;
  if(mode==='duo'){menu.querySelector('section').innerHTML='<h1>2 JOGADORES</h1><p>ESCOLHA COMO JOGAR</p><button data-mode="local">LOCAL</button><button data-mode="online">ONLINE</button><button data-mode="back">VOLTAR</button>';return;}
  if(mode==='back'){showModeMenu();return;}
  menu.remove();
  try{
   app=mode==='online'?createOnlineLobby(document.querySelector('#app'),showModeMenu):mode==='local'?createLocalApp(document.querySelector('#app'),showModeMenu):createApp(document.querySelector('#app'));app.start();
   if(mode==='solo'){const back=document.createElement('button');back.className='solo-menu';back.textContent='MENU';back.onclick=showModeMenu;document.body.append(back);}
  }catch(error){app?.dispose();app=null;showModeMenu();showError(error);}
 });
}
try{showModeMenu();}catch(error){showError(error);}
if(import.meta.hot){import.meta.hot.accept(()=>window.location.reload());import.meta.hot.dispose(()=>app?.dispose());}
