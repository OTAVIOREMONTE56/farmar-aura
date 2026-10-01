import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacter } from '../src/entities/character/createCharacter.js';
import { frameCharacter } from '../src/core/frameCharacter.js';

const missing = createCharacter({ loader: { loadAsync: async () => { throw new Error('Arquivo ausente no teste'); } } });
assert.equal(await missing.load(), false);
assert.equal(missing.status, 'procedural');
assert.equal(missing.root.children[0].userData.temporary, true);
for (const name of ['hips', 'head', 'torso', 'leftArm', 'rightArm', 'leftForearm', 'rightForearm', 'leftLeg', 'rightLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) assert.ok(missing.root.getObjectByName(name));
assert.equal(missing.playAnimation('idle'), true);
const bounds = missing.getBounds();
assert.ok(Math.abs(bounds.min.y) < 1e-6);
assert.ok(Math.abs(bounds.max.y - 1.8) < 1e-6);
for (const aspect of [16/9, 9/16, 0.3]) {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 200);
  frameCharacter(camera, bounds);
  camera.updateMatrixWorld(true);
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95, 'Corpo inteiro com margem');
  }
}
const rig = missing.root.getObjectByName('frogRoot');
assert.equal(rig.getObjectByName('leftLowerLeg').parent.name, 'leftLeg');
assert.equal(rig.getObjectByName('leftForearm').parent.name, 'leftArm');
assert.equal(missing.playAnimation('passinho'), true);
for (let i=0; i<4; i++) missing.update(0.1);
assert.ok(Math.abs(rig.getObjectByName('leftLowerLeg').rotation.x) > 0.2);
assert.ok(Math.abs(rig.getObjectByName('leftForearm').rotation.x) > 0.15);
for (let i=0; i<24; i++) missing.update(0.1);
assert.ok(Math.abs(rig.getObjectByName('leftLowerLeg').rotation.x) < 0.01, 'Voltou suavemente ao Idle');
missing.dispose();

const model = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
body.name = 'Body'; body.position.set(5, 7, 2); model.add(body);
const idle = new THREE.AnimationClip('idle', 1, [new THREE.NumberKeyframeTrack('Body.rotation[y]', [0,1], [0,0.2])]);
const character = createCharacter({ loader: { loadAsync: async () => ({ scene: model, animations: [idle] }) } });
assert.equal(await character.load(), true);
assert.equal(character.status, 'ready');
assert.ok(character.mixer instanceof THREE.AnimationMixer);
assert.equal(character.root.getObjectByName('frogRoot'), undefined);
const normalized = character.getBounds();
assert.ok(Math.abs(normalized.min.y) < 1e-6);
assert.ok(Math.abs(normalized.max.y - 1.8) < 1e-6);
assert.ok(Math.abs(normalized.getCenter(new THREE.Vector3()).x) < 1e-6);
assert.equal(character.registerAnimationAlias('passinho', 'idle'), true);
assert.equal(character.playAnimation('passinho', { fade: 0 }), true);
character.update(0.1);
assert.ok(body.rotation.y > 0);
assert.equal(character.playAnimation('unknown'), false);
assert.equal(character.registerAnimation('dab', {}), false);
character.stopAnimation({ fade: 0 });
character.dispose(); character.dispose();
assert.equal(character.status, 'disposed');

let resolveLoad;
const pending = createCharacter({ loader: { loadAsync: () => new Promise((resolve) => { resolveLoad = resolve; }) } });
const task = pending.load(); pending.dispose();
resolveLoad({ scene: new THREE.Group(), animations: [] });
assert.equal(await task, false);
assert.equal(pending.status, 'disposed');
console.log('OK: fallback, escala, câmera responsiva, mixer, aliases, animação e descarte assíncrono.');
