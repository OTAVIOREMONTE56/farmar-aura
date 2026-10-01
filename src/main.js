import './styles.css';
import { createApp } from './core/createApp.js';

let app;
try {
  app = createApp(document.querySelector('#app'));
  app.start();
} catch (error) {
  console.error(error);
  const message = document.querySelector('#message');
  message.textContent = 'Não foi possível iniciar a cena 3D. Verifique se o navegador tem WebGL habilitado.';
  message.hidden = false;
}

if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
  import.meta.hot.dispose(() => app?.dispose());
}


// Mudanças de animação substituem integralmente a instância e os clips do mixer.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
