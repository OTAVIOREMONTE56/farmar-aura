import { createMovementAnimations } from './movementAnimations.js';
import { createPassinhoV2 } from './passinhoV2.js';

import * as THREE from 'three';


// Idle original preservado; Passinho V2 tem sua própria coreografia.
export function createFrogAnimations(rig) {
  const names = ['hips','torso','head','leftArm','rightArm','leftForearm','rightForearm','leftLeg','rightLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'];
  function pose(t) {
    const p = Object.fromEntries(names.map(name => [name, [0,0,0]]));
    const wave = Math.sin(t*Math.PI*2);
    p.hips = [0,0,.012*wave];
    p.torso = [.014*wave,.015*wave,0];
    p.head = [.012*Math.sin(t*Math.PI*2+.5),.025*wave,0];
    p.leftArm = [0,0,-.08]; p.rightArm = [0,0,.08];
    p.leftForearm = [-.12,0,0]; p.rightForearm = [-.12,0,0];
    let x = 0, y = 1.05 + .008*wave;
    return { p, x, y };
  }
  function clip(name, duration) {
    const times = Array.from({length:33},(_,i)=>i/32*duration);
    const poses = times.map(t=>pose(t/duration));
    const tracks=[];
    names.forEach(joint=>['x','y','z'].forEach((axis,index)=>{
      tracks.push(new THREE.NumberKeyframeTrack(joint+'.rotation['+axis+']',times,poses.map(p=>p.p[joint][index])));
    }));
    tracks.push(new THREE.NumberKeyframeTrack('hips.position[x]',times,poses.map(p=>p.x)));
    tracks.push(new THREE.NumberKeyframeTrack('hips.position[y]',times,poses.map(p=>p.y)));
    return new THREE.AnimationClip(name,duration,tracks);
  }
  return [clip('idle',3), createPassinhoV2(), ...createMovementAnimations(rig)];
}
