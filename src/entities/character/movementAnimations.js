import * as THREE from 'three';

export const MOVEMENT_JOINTS = ['hips','torso','head','leftArm','rightArm','leftForearm','rightForearm','leftLeg','rightLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'];
const neutral = {leftArm:[0,0,-.08],rightArm:[0,0,.08],leftForearm:[-.12,0,0],rightForearm:[-.12,0,0]};
const crouch = {leftLeg:[-.65,0,-.12],rightLeg:[-.65,0,.12],leftLowerLeg:[1.3,0,0],rightLowerLeg:[1.3,0,0],leftFoot:[-.65,0,0],rightFoot:[-.65,0,0]};
function key(time, joints = {}, position = [0,1.05,0]) {
  return {time,position,joints:Object.fromEntries(MOVEMENT_JOINTS.map(n=>[n,joints[n] ?? neutral[n] ?? [0,0,0]]))};
}
function makeClip(name, keys) {
  const times=keys.map(k=>k.time);
  const tracks=MOVEMENT_JOINTS.flatMap(joint=>['x','y','z'].map((axis,i)=>new THREE.NumberKeyframeTrack(joint+'.rotation['+axis+']',times,keys.map(k=>k.joints[joint][i]))));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position',times,keys.flatMap(k=>k.position)));
  return new THREE.AnimationClip(name,keys.at(-1).time,tracks);
}

export function createGiro() {
  const open={...crouch,leftArm:[0,0,-1.6],rightArm:[0,0,1.6],leftForearm:[-.3,0,0],rightForearm:[-.3,0,0],torso:[.08,.12,0],head:[0,.15,0],rightLeg:[-.85,0,.2],rightLowerLeg:[1.45,0,0],rightFoot:[-.6,.5,0]};
  const keys=[key(0),key(.16,{...crouch,torso:[.18,-.3,0]},[0,.86,0])];
  // Unwrapped Euler yaw preserves the full turn; quaternions would choose the shortest arc.
  for(let i=0;i<=8;i++)keys.push(key(.25+i*.09,{...open,hips:[0,i/8*Math.PI*2,0]},[0,.88,0]));
  const brake={...crouch,hips:[0,Math.PI*2,0],torso:[0,-.35,-.22],head:[-.1,.3,.18],leftArm:[-.5,0,-1.9],rightArm:[-.8,0,-.5],rightForearm:[-1.5,0,.3]};
  keys.push(key(1.06,brake,[0,.92,0]),key(1.15,brake,[0,.92,0]),key(1.3,{hips:[0,Math.PI*2,0]}));
  return makeClip('giro',keys);
}

export function createMoonwalk() {
  const keys=[key(0)];
  // Six half-steps: toe support alternates while the other shoe slides flat backwards.
  for(let i=0;i<6;i++) {
    const side=i%2===0?1:-1, support=side===1?'right':'left', slide=side===1?'left':'right';
    const z=-.09-i*.085;
    const joints={hips:[0,side*.08,side*.055],torso:[.16,-side*.1,0],head:[-.12,side*.1,0],
      [support+'Leg']:[-.38,0,0],[support+'LowerLeg']:[.8,0,0],[support+'Foot']:[-.95,0,0],
      [slide+'Leg']:[.35,0,0],[slide+'LowerLeg']:[.12,0,0],[slide+'Foot']:[-.47,0,0],
      leftArm:[side*.6,0,-.4],rightArm:[-side*.6,0,.4],leftForearm:[-.65,0,0],rightForearm:[-.65,0,0]};
    keys.push(key(.16+i*.25,joints,[side*.035,.96,z]));
    keys.push(key(.29+i*.25,{...joints,[slide+'Leg']:[.58,0,0],[slide+'Foot']:[-.7,0,0]},[side*.035,.96,z-.05]));
  }
  keys.push(key(1.72,{...crouch,torso:[.12,0,0]},[0,.88,-.57]),key(2));
  return makeClip('moonwalk',keys);
}

export function createPoseSigma() {
  const sigma={hips:[0,-.18,-.12],torso:[-.22,.25,-.16],head:[-.28,-.2,.08],leftLeg:[0,-.18,-.27],rightLeg:[-.18,.15,.25],rightLowerLeg:[.36,0,0],rightFoot:[-.18,.2,0],leftFoot:[0,-.25,0],leftArm:[-.9,-.4,.75],leftForearm:[-1.65,0,-.8],rightArm:[-1.25,.15,.35],rightForearm:[-2.15,-.25,.15]};
  return makeClip('pose-sigma',[key(0),key(.35,sigma,[0,1.03,0]),key(1.05,sigma,[0,1.03,0]),key(1.5)]);
}

export function createDab() {
  const dab={...crouch,hips:[0,.1,-.1],torso:[.22,0,-.35],head:[.55,.35,-.4],rightArm:[-.2,0,2.3],rightForearm:[-.08,0,.08],leftArm:[-1.45,-.45,.7],leftForearm:[-1.9,0,-1.25]};
  return makeClip('dab',[key(0),key(.22,dab,[0,.86,0]),key(.58,dab,[0,.86,0]),key(1)]);
}

export function createBreakdance() {
  const keys=[key(0),key(.16,{...crouch,leftArm:[-.6,0,-.5],rightArm:[-.7,0,.5],torso:[.5,0,0]},[0,.74,0])];
  const floor={hips:[0,0,-1.2],torso:[.18,0,.08],head:[0,0,.2],leftArm:[0,0,1.08],leftForearm:[-.1,0,0],rightArm:[-.4,0,1.8],rightForearm:[-.5,0,0],leftLeg:[-1.5,0,-.6],rightLeg:[.8,0,.95],leftLowerLeg:[.3,0,0],rightLowerLeg:[.35,0,0],leftFoot:[-.25,-.3,0],rightFoot:[-.3,.35,0]};
  keys.push(key(.38,floor,[0,.83,0]));
  for(let i=0;i<=12;i++) {
    const angle=i/12*Math.PI*2;
    keys.push(key(.5+i*.095,{...floor,hips:[0,angle,-1.3],torso:[.15,0,.15],head:[0,-.12,.25],
      leftLeg:[-1.2*Math.cos(angle),.25,-.95-.35*Math.sin(angle)],rightLeg:[1.2*Math.cos(angle),-.25,1.05+.35*Math.sin(angle)],
      leftLowerLeg:[.25+.4*(1+Math.sin(angle)),0,0],rightLowerLeg:[.25+.4*(1-Math.sin(angle)),0,0],
      leftFoot:[-.25,-.4,0],rightFoot:[-.3,.4,0],rightArm:[-.4*Math.sin(angle),0,1.9]},[.05*Math.sin(angle),.83,.04*Math.cos(angle)]));
  }
  keys.push(key(1.82,{...crouch,hips:[0,Math.PI*2,-.35],torso:[.35,0,0],leftArm:[-.7,0,-.5],rightArm:[-.7,0,.5]},[0,.76,0]));
  const finish={hips:[0,Math.PI*2,0],torso:[-.12,.2,-.15],head:[-.18,-.15,.15],leftLeg:[-.1,0,-.3],rightLeg:[-.3,0,.3],rightLowerLeg:[.6,0,0],rightFoot:[-.3,.25,0],leftArm:[0,0,-1.8],rightArm:[-.8,0,-.5],rightForearm:[-1.5,0,0]};
  keys.push(key(2.04,finish,[0,1,0]),key(2.22,finish,[0,1,0]),key(2.5,{hips:[0,Math.PI*2,0]}));
  return makeClip('breakdance',keys);
}

// Bake ground clearance into the new clips, without a runtime pose override.
// Passinho V2 is never included here.
function keepAboveFloor(clip, rig) {
  const mixer=new THREE.AnimationMixer(rig);
  const action=mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true; action.play();
  const count=Math.ceil(clip.duration/.015);
  const times=Array.from({length:count+1},(_,i)=>i/count*clip.duration);
  const positions=[];
  const hips=rig.getObjectByName('hips');
  const bounds=new THREE.Box3();
  for(const time of times) {
    mixer.setTime(time); rig.updateMatrixWorld(true);
    bounds.setFromObject(rig);
    const scale=rig.getWorldScale(new THREE.Vector3()).y;
    positions.push(hips.position.x,hips.position.y+Math.max(0,-bounds.min.y)/scale,hips.position.z);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(rig);
  return new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.map(track=>track.name==='hips.position'?new THREE.VectorKeyframeTrack(track.name,times,positions):track));
}
export function createMovementAnimations(rig) {
  const clips=[createGiro(),createMoonwalk(),createPoseSigma(),createDab(),createBreakdance()];
  return rig ? clips.map(clip=>keepAboveFloor(clip,rig)) : clips;
}
