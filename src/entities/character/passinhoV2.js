import * as THREE from 'three';

export const PASSINHO_VERSION = 'PASSINHO V2';
const names = ['leftArm','rightArm','leftForearm','rightForearm','leftLeg','rightLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','torso','hips','head'];
const normal = { leftArm:[0,0,-.08], rightArm:[0,0,.08], leftForearm:[-.12,0,0], rightForearm:[-.12,0,0] };
function pose(time, y, joints = {}, x = 0) {
  return {time, y, x, joints:Object.fromEntries(names.map(n=>[n,joints[n] ?? normal[n] ?? [0,0,0]]))};
}
function step(time, side, deep = false) {
  const front = side === 1 ? 'right' : 'left';
  const back = side === 1 ? 'left' : 'right';
  return pose(time, deep ? .76 : .85, {
    [front+'Leg']:[-1.05,side*.38,side*.32], [back+'Leg']:[-.52,-side*.2,-side*.12],
    [front+'LowerLeg']:[1.25,0,0], [back+'LowerLeg']:[1.35,0,0],
    [front+'Foot']:[-.3,side*.65,side*.18], [back+'Foot']:[-.8,-side*.4,-side*.15],
    hips:[0,-side*.4,-side*.15], torso:[.12,side*.3,side*.32], head:[-.1,-side*.25,-side*.2],
    [back+'Arm']:[-1.15,-side*.6,side*1.05], [back+'Forearm']:[-1.5,side*.3,side*.65],
    [front+'Arm']:[.85,side*.45,side*1.7], [front+'Forearm']:[-1.1,-side*.35,-side*.3],
  }, side*.06);
}
export function createPassinhoV2() {
  const crouch = {leftLeg:[-.85,0,-.18],rightLeg:[-.85,0,.18],leftLowerLeg:[1.7,0,0],rightLowerLeg:[1.7,0,0],leftFoot:[-.85,-.2,0],rightFoot:[-.85,.2,0],leftArm:[-.35,0,-1.2],rightArm:[-.35,0,1.2],leftForearm:[-1.5,0,-.2],rightForearm:[-1.5,0,.2],torso:[.2,0,0],head:[-.15,0,0]};
  const final = {leftLeg:[-.2,-.3,-.65],rightLeg:[-1,0,.12],leftLowerLeg:[.4,0,0],rightLowerLeg:[1.8,0,0],leftFoot:[-.2,-.5,-.15],rightFoot:[-.8,.35,.1],hips:[0,.25,-.2],torso:[.15,-.25,-.35],head:[-.12,.3,.4],rightArm:[-.35,.2,2.4],rightForearm:[-.25,0,.15],leftArm:[-1.1,-.5,.75],leftForearm:[-1.6,0,-.9]};
  const keys = [pose(0,1.05),pose(.2,.65,crouch),step(.45,1),step(.7,-1),step(.9,1,true),step(1.12,-1,true),step(1.35,1,true),pose(1.4,1.24,{...crouch,leftLeg:[-.25,0,-.2],rightLeg:[-.25,0,.2],leftLowerLeg:[.5,0,0],rightLowerLeg:[.5,0,0],leftArm:[-.3,0,-1.9],rightArm:[-.3,0,1.9]}),pose(1.55,.65,crouch),pose(1.7,.88,final),pose(1.9,.88,final),pose(2.1,1.05)];
  const tracks = [];
  // Quaternion tracks bind each pivot independently; no shared sine-wave controller.
  for (const name of names) {
    const values = keys.flatMap(k=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...k.joints[name])).toArray());
    tracks.push(new THREE.QuaternionKeyframeTrack(name+'.quaternion',keys.map(k=>k.time),values));
  }
  tracks.push(new THREE.VectorKeyframeTrack('hips.position',keys.map(k=>k.time),keys.flatMap(k=>[k.x,k.y,0])));
  return new THREE.AnimationClip('passinho',2.1,tracks);
}
