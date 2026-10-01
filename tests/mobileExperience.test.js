import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bindMovementInput } from '../src/ui/bindMovementInput.js';
import { CameraDirector } from '../src/core/CameraDirector.js';
import { createCharacter } from '../src/entities/character/createCharacter.js';
import { createMovementAnimations } from '../src/entities/character/movementAnimations.js';

test('touch submits once, ignores a second finger, handles cancel and keeps accessible clicks', () => {
  const handlers=new Map(), classes=new Set(), submitted=[];
  const button={disabled:false,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},
    addEventListener:(type,f)=>handlers.set(type,f),removeEventListener:type=>handlers.delete(type),
    setPointerCapture(){},getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:80})};
  const dispose=bindMovementInput([{button,movement:{key:'Q'}}],key=>submitted.push(key));
  const event=(id,primary=true)=>({pointerType:'touch',pointerId:id,isPrimary:primary,clientX:50,clientY:40,preventDefault(){}});
  handlers.get('pointerdown')(event(1));assert.ok(classes.has('touch-pressed'));
  handlers.get('pointerdown')(event(2,false));handlers.get('pointerup')(event(2,false));
  handlers.get('pointerup')(event(1));handlers.get('click')({detail:1});
  assert.deepEqual(submitted,['Q']);assert.equal(classes.size,0);
  handlers.get('pointerdown')(event(3));handlers.get('pointercancel')(event(3));
  handlers.get('pointerup')(event(3));assert.equal(submitted.length,1);
  handlers.get('click')({detail:0});assert.equal(submitted.length,2);
  button.disabled=true;handlers.get('pointerdown')(event(4));handlers.get('pointerup')(event(4));
  assert.equal(submitted.length,2);dispose();assert.equal(handlers.size,0);
});

test('six mobile sizes and desktop keep animated bounds within the usable frame across rotation', () => {
  globalThis.window={matchMedia:()=>({matches:false})};
  const character=createCharacter();
  for(const clip of createMovementAnimations()) character.registerAnimation(clip.name,clip);
  const camera=new THREE.PerspectiveCamera(45,1,.05,200), director=new CameraDirector(camera,character);
  for(const [width,height] of [[390,844],[844,390],[430,932],[932,430],[360,800],[800,360],[1440,900]]) {
    const mobile=width<1025,landscape=width>height;
    const controlsHeight=landscape?143:175;
    const viewport=mobile?{width,height,top:landscape?76:173,bottom:landscape?height-12:height-8-controlsHeight-28,...(landscape?{left:8,right:width*.55-12}:{})}:null;
    camera.aspect=width/height;director.resize(viewport);
    for(const name of ['idle','passinho','giro','moonwalk','pose-sigma','dab','breakdance']) {
      character.stopAnimation({fade:0});character.mixer.stopAllAction();
      assert.ok(character.playAnimation(name,{fade:0,loop:name==='idle'}));
      for(let frame=0;frame<160;frame++) {
        character.update(1/60);director.update(1/60,{phase:'demonstrate',lives:3,index:0});
        camera.updateMatrixWorld(true);
        const bounds=character.getBounds();
        for(const x of [bounds.min.x,bounds.max.x])
          for(const y of [bounds.min.y,bounds.max.y])
            for(const z of [bounds.min.z,bounds.max.z]) {
              const point=new THREE.Vector3(x,y,z).project(camera);
              assert.ok(Math.abs(point.x)<=1.001, width+' '+height+' '+name+' horizontal crop');
              const screenX=(1+point.x)*width/2;
              if(viewport?.left!==undefined)assert.ok(screenX>=viewport.left-1 && screenX<=viewport.right+1, width+' '+height+' '+name+' touches controls');
              const screenY=(1-point.y)*height/2;
              assert.ok(screenY>= (viewport?.top??0)-1 && screenY<= (viewport?.bottom??height)+1,
                width+' '+height+' '+name+' vertical crop '+screenY);
            }
      }
    }
  }
  director.resize(null);assert.equal(camera.projectionMatrix.elements[9],0);
  character.dispose();
});
