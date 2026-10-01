import * as THREE from 'three';
import { createWorld } from '../world/createWorld.js';
import { createCharacter } from '../entities/character/createCharacter.js';
import { CameraDirector } from './CameraDirector.js';
import { createAnimationControls } from '../ui/createAnimationControls.js';

export function createApp(container) {
  const mobileQuery = window.matchMedia('(pointer:coarse) and (max-width:1024px), (max-width:600px)');
  const world = createWorld();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Personagem 3D centralizado sobre o chão');
  container.appendChild(renderer.domElement);

  const character = createCharacter({ onChange() { resize(); controls.refresh(); } });
  const controls = createAnimationControls(character);
  world.scene.add(character.root);
  const director = new CameraDirector(camera, character);
  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const ui=document.querySelector('.memory-ui');
    const hud=ui?.querySelector('.hud')?.getBoundingClientRect();
    const buttons=ui?.querySelector('.animation-controls')?.getBoundingClientRect();
    ui?.style.setProperty('--message-top', (height<=500&&width>600?8:(hud?.top??12)+34)+'px');
    if(buttons)ui?.style.setProperty('--progress-bottom',(height-buttons.top+8)+'px');
    camera.clearViewOffset();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const mobile=mobileQuery.matches;
    const safeTop=mobile?Math.max((hud?.top??8)+ (width>height?68:165), 0):0;
    const landscape=mobile&&width>height;
    const safeBottom=mobile?(landscape?height-12:(buttons?.top??height)-28):height;
    director.resize(mobile?{width,height,top:safeTop,bottom:safeBottom,...(landscape?{left:8,right:(buttons?.left??width*.55)-12}:{})}:null);
    ui?.style.setProperty("--mobile-feedback-top",Math.max(safeTop-24,60)+"px");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  mobileQuery.addEventListener('change', resize);
  resize();
  const viewportObserver = new ResizeObserver(resize);
  viewportObserver.observe(container);
  const layoutObserver = new ResizeObserver(resize);
  document.querySelectorAll('.memory-ui .hud, .memory-ui .animation-controls').forEach(element => layoutObserver.observe(element));
  void character.load();
  let previousTime = null;
  function frame(time) {
    const delta = previousTime === null ? 0 : (time - previousTime) / 1000;
    previousTime = time;
    character.update(delta);
    controls.update();
    director.update(delta, controls.getVisualState());
    const strength=director.visualFeedback;
    const visual={dancing:character.movements.busy,celebrate:Math.max(0,strength)/.3,error:Math.max(0,-strength)/.14};
    world.update(delta, controls.getVisualCombo(), time / 1000, visual);
    renderer.render(world.scene, camera);
  }

  return {
    scene: world.scene, camera, renderer, character,
    start() { previousTime = null; renderer.setAnimationLoop(frame); },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      mobileQuery.removeEventListener('change', resize);
      viewportObserver.disconnect();
      layoutObserver.disconnect();
      controls.dispose();
      character.dispose();
      world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
