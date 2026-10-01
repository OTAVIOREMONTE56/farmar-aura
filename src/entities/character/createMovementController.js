export const MOVEMENTS = Object.freeze([
  {key:'Q',name:'passinho',label:'PASSINHO',method:'playPassinhoV2'},
  {key:'W',name:'giro',label:'GIRO',method:'playGiro'},
  {key:'E',name:'moonwalk',label:'MOONWALK',method:'playMoonwalk'},
  {key:'R',name:'pose-sigma',label:'POSE SIGMA',method:'playPoseSigma'},
  {key:'T',name:'dab',label:'DAB',method:'playDab'},
  {key:'Y',name:'breakdance',label:'BREAKDANCE',method:'playBreakdance'},
]);

// UI and future gameplay share this entry point; requests during a move are ignored.
export function createMovementController(character) {
  const controller={
    get busy() { const name=character.currentAnimation; return !!name && name!=='idle'; },
    get currentMovement() { return controller.busy ? character.currentAnimation : null; },
    play(name) {
      if(controller.busy || !MOVEMENTS.some(m=>m.name===name))return false;
      return name==='passinho' ? character.playPassinhoV2() : character.playAnimation(name,{fade:0,loop:false});
    },
  };
  for(const {name,method} of MOVEMENTS)controller[method]=()=>controller.play(name);
  return controller;
}
