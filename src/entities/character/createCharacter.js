import { createMovementController } from './createMovementController.js';
import { createMovementAnimations } from './movementAnimations.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createProceduralFrog } from './createProceduralFrog.js';
import { createPassinhoV2 } from './passinhoV2.js';
import { disposeObject } from './disposeObject.js';

export const ANIMATION_NAMES = Object.freeze(['idle', 'passinho', 'giro', 'moonwalk', 'pose-sigma', 'dab', 'breakdance']);
export const CHARACTER_URL = (import.meta.env?.BASE_URL ?? '/') + 'models/character/frog.glb';

export function createCharacter({ url = CHARACTER_URL, height = 1.8, facingRotation = 0, loader = new GLTFLoader(), onChange = () => {} } = {}) {
  // Transformações de apresentação ficam fora da hierarquia animada do GLB.
  const root = new THREE.Group();
  root.name = 'character';
  const procedural = createProceduralFrog(height);
  let visual = procedural.root;
  root.add(visual);
  let mixer = new THREE.AnimationMixer(visual);
  let activeAction = null;
  let disposed = false;
  let loadPromise = null;
  let status = 'procedural';
  const clips = new Map();
  function onFinished(event) {
    if (event.action === activeAction && event.action.getClip().name !== 'idle' && clips.has('idle')) {
      activeAction.stop();
      activeAction = null;
      playAnimation('idle', { fade: 0.18, loop: true });
    }
  }
  mixer.addEventListener('finished', onFinished);
  for (const clip of procedural.clips) registerAnimation(clip.name, clip);
  playAnimation('idle');

  function registerAnimation(name, clip) {
    if (disposed || !mixer || !(clip instanceof THREE.AnimationClip)) return false;
    const previous = clips.get(name);
    if (previous && previous !== clip) {
      const action = mixer.existingAction(previous);
      if (action === activeAction) { action.stop(); activeAction = null; }
      mixer.uncacheAction(previous);
    }
    clips.set(name, clip);
    return true;
  }

  function playAnimation(name, { fade = 0.2, loop = name === 'idle' } = {}) {
    const clip = clips.get(name);
    if (disposed || !mixer || !clip) return false;
    if (activeAction?.isRunning() && activeAction.getClip().name !== 'idle') return false;
    if (name !== 'idle') { mixer.stopAllAction(); activeAction = null; fade = 0; }
    const next = mixer.clipAction(clip);
    if (next === activeAction && next.isRunning()) return true;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.play();
    if (activeAction && activeAction !== next) {
      if (fade > 0) next.crossFadeFrom(activeAction, fade, false);
      else activeAction.stop();
    } else if (fade > 0) next.fadeIn(fade);
    activeAction = next;
    return true;
  }

  async function load() {
    if (disposed) return false;
    if (loadPromise) return loadPromise;
    status = 'loading';
    loadPromise = (async () => {
      let gltf;
      try {
        gltf = await loader.loadAsync(url);
        if (disposed) { disposeObject(gltf.scene); return false; }
        const model = gltf.scene;
        const presentation = new THREE.Group();
        presentation.add(model);
        presentation.rotation.y = facingRotation;
        presentation.updateMatrixWorld(true);
        let bounds = new THREE.Box3().setFromObject(presentation);
        const size = bounds.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('GLB sem geometria válida.');
        presentation.scale.setScalar(height / size.y);
        presentation.updateMatrixWorld(true);
        bounds = new THREE.Box3().setFromObject(presentation);
        const center = bounds.getCenter(new THREE.Vector3());
        presentation.position.set(-center.x, -bounds.min.y, -center.z);
        model.traverse((object) => {
          if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
        });
        mixer.removeEventListener('finished', onFinished);
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
        clips.clear();
        activeAction = null;
        root.remove(visual);
        disposeObject(visual);
        visual = presentation;
        root.add(visual);
        mixer = new THREE.AnimationMixer(model);
        mixer.addEventListener('finished', onFinished);
        for (const clip of gltf.animations ?? []) {
          registerAnimation(clip.name, clip);
          const alias = clip.name.trim().toLowerCase();
          if (ANIMATION_NAMES.includes(alias)) registerAnimation(alias, clip);
        }
        // Never let an embedded legacy dance replace V2 on a compatible rig.
        if (['hips','torso','head','leftArm','rightArm','leftForearm','rightForearm','leftLeg','rightLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'].every(name => model.getObjectByName(name))) {
          registerAnimation('passinho', createPassinhoV2());
          for (const clip of createMovementAnimations()) registerAnimation(clip.name, clip);
        } else {
          for (const name of ANIMATION_NAMES.filter(name => name !== 'idle')) clips.delete(name);
          console.warn('PASSINHO V2: GLB sem as articulações necessárias.');
        }
        status = 'ready';
      } catch (error) {
        if (gltf?.scene && status !== 'ready') disposeObject(gltf.scene);
        if (!disposed) {
          status = 'procedural';
          console.info('frog.glb indisponível ou inválido; mantendo sapo procedural temporário.', error.message);
        }
        return false;
      }
      if (clips.has('idle')) playAnimation('idle');
      onChange();
      return true;
    })();
    return loadPromise;
  }

  const character = {
    root,
    get status() { return status; },
    get mixer() { return mixer; },
    get currentAnimation() { return activeAction?.isRunning() ? activeAction.getClip().name : null; },
    playPassinhoV2() { return playAnimation('passinho', { fade: 0.06, loop: false }); },
    get animationNames() { return [...clips.keys()]; },
    load, registerAnimation, playAnimation,
    get isPassinhoPlaying() { return activeAction?.getClip() === clips.get('passinho') && activeAction.isRunning(); },
    registerAnimationAlias(name, sourceName) { return registerAnimation(name, clips.get(sourceName)); },
    stopAnimation({ fade = 0.2 } = {}) {
      if (activeAction) fade > 0 ? activeAction.fadeOut(fade) : activeAction.stop();
      activeAction = null;
    },
    update(delta) { if (!disposed) mixer?.update(Math.min(Math.max(delta, 0), 0.1)); },
    getBounds() { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); },
    dispose() {
      if (disposed) return;
      disposed = true;
      status = 'disposed';
      mixer?.removeEventListener('finished', onFinished);
      mixer?.stopAllAction();
      if (mixer) mixer.uncacheRoot(mixer.getRoot());
      clips.clear();
      disposeObject(visual);
      root.removeFromParent();
    },
  };
  character.movements = createMovementController(character);
  return character;
}
