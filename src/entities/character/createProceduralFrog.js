import * as THREE from 'three';
import { createFrogAnimations } from './frogAnimations.js';

// Personagem temporário: geometrias e rig independentes do futuro GLB.
export function createProceduralFrog(height = 1.8) {
  const frogRoot = new THREE.Group();
  frogRoot.name = 'frogRoot';
  frogRoot.userData.temporary = true;
  const joints = {};
  const skin = new THREE.MeshStandardMaterial({ color: '#62b93b', roughness: 0.65 });
  const lip = new THREE.MeshStandardMaterial({ color: '#326a27', roughness: 0.8 });
  const orange = new THREE.MeshStandardMaterial({ color: '#ff730c', roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#20252b', roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: '#f6f2dd', roughness: 0.7 });
  const lens = new THREE.MeshStandardMaterial({ color: '#0c1620', roughness: 0.2, metalness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e9b629', metalness: 0.8, roughness: 0.25 });
  function pivot(name, parent, x, y, z = 0) {
    const joint = new THREE.Group(); joint.name = name; joint.position.set(x,y,z);
    parent.add(joint); joints[name] = joint; return joint;
  }
  function mesh(parent, geometry, material, position, scale = [1,1,1]) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.scale.set(...scale);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function ball(parent, material, position, scale) {
    return mesh(parent, new THREE.SphereGeometry(1, 32, 20), material, position, scale);
  }
  function capsule(parent, material, radius, length, position, scale = [1,1,1]) {
    return mesh(parent, new THREE.CapsuleGeometry(radius, length, 6, 16), material, position, scale);
  }
  function tube(parent, material, points, radius) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(parent, new THREE.TubeGeometry(curve, 32, radius, 8, false), material, [0,0,0]);
  }
  const hips = pivot('hips', frogRoot, 0, 1.05);
  ball(hips, dark, [0,0,0], [.38,.22,.27]);
  const torso = pivot('torso', hips, 0,.1);
  ball(torso, orange, [0,.35,0], [.42,.49,.29]);
  // Camiseta visível na abertura da jaqueta, com dois painéis arredondados.
  ball(torso, white, [0,.38,.257], [.19,.38,.065]);
  for (const side of [-1,1]) {
    capsule(torso, orange, .1,.49, [side*.245,.36,.24], [1.25,1,.8]);
    tube(torso, dark, [[side*.12,.64,.32],[side*.1,.42,.33]], .012);
  }
  const hood = mesh(torso, new THREE.TorusGeometry(.23,.085,10,32), orange, [0,.73,-.04]);
  hood.rotation.x = Math.PI/2;
  const head = pivot('head', torso, 0,.82);
  ball(head, skin, [0,.23,0], [.59,.34,.36]);
  ball(head, skin, [0,.105,.19], [.53,.17,.25]);
  ball(head, white, [0,.055,.12], [.39,.075,.22]);
  tube(head, lip, [[-.46,.15,.36],[-.28,.085,.426],[0,.065,.45],[.28,.085,.426],[.46,.15,.36]], .018);
  for (const side of [-1,1]) {
    ball(head, skin, [side*.32,.49,.06], [.235,.245,.22]);
    ball(head, white, [side*.32,.51,.21], [.175,.18,.12]);
    ball(head, lens, [side*.32,.49,.313], [.203,.13,.035]);
    const rim = mesh(head, new THREE.TorusGeometry(.155,.018,8,28), dark, [side*.32,.49,.325], [1.3,.83,1]);
    rim.rotation.z = side*.03;
    tube(head, dark, [[side*.49,.5,.3],[side*.54,.48,.02]], .018);
    ball(head, lip, [side*.13,.235,.356], [.025,.015,.012]);
  }
  tube(head, dark, [[-.13,.5,.33],[0,.515,.345],[.13,.5,.33]], .018);
  // Corrente simples de elos dourados sem marca ou logotipo.
  for (let i=0; i<19; i++) {
    const angle = i / 18 * Math.PI;
    const link = mesh(torso, new THREE.TorusGeometry(.028,.008,6,12), gold,
      [Math.cos(angle)*.245,.68-Math.sin(angle)*.255,.305+Math.sin(angle)*.055]);
    link.rotation.y = i%2 ? .7 : -.25;
  }
  for (const [side,label] of [[-1,'left'],[1,'right']]) {
    const arm = pivot(label+'Arm', torso, side*.43,.61);
    capsule(arm, orange, .145,.27, [side*.025,-.22,0]);
    const forearm = pivot(label+'Forearm', arm, side*.035,-.43);
    capsule(forearm, orange, .12,.24, [0,-.19,0]);
    capsule(forearm, dark, .125,.035, [0,-.34,0]);
    ball(forearm, skin, [0,-.43,.025], [.13,.14,.105]);
    for (let f=0; f<3; f++) capsule(forearm, skin, .033,.075, [(f-1)*.07,-.54,.04]);
    ball(forearm, skin, [-side*.115,-.435,.045], [.06,.09,.055]);
    const leg = pivot(label+'Leg', hips, side*.215,-.015);
    capsule(leg, dark, .205,.25, [0,-.235,0], [1,1,1.1]);
    capsule(leg, dark, .095,.12, [side*.175,-.235,.055], [.6,1,1]);
    const lower = pivot(label+'LowerLeg', leg, 0,-.47);
    capsule(lower, dark, .17,.22, [0,-.215,0]);
    const foot = pivot(label+'Foot', lower, 0,-.435);
    ball(foot, white, [0,-.065,.12], [.245,.065,.37]);
    ball(foot, dark, [0,-.012,.12], [.23,.082,.355]);
    ball(foot, orange, [0,.035,.065], [.212,.105,.27]);
    ball(foot, orange, [0,.022,.34], [.2,.055,.115]);
    for(let l=0;l<3;l++) tube(foot, white, [[-.085,.13,.04+l*.05],[0,.145,.06+l*.05],[.085,.13,.04+l*.05]], .009);
  }
  frogRoot.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(frogRoot);
  const scale = height / (bounds.max.y-bounds.min.y);
  frogRoot.scale.setScalar(scale);
  frogRoot.position.y = -bounds.min.y*scale;
  return { root: frogRoot, joints, clips: createFrogAnimations(frogRoot) };
}
