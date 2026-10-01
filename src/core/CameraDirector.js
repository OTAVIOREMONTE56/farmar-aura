import * as THREE from 'three';

// Reads presentation state only; gameplay and animation timing remain independent.
export class CameraDirector {
  constructor(camera, character) {
    this.camera = camera; this.character = character;
    this.base = new THREE.Box3(); this.bounds = new THREE.Box3();
    this.smoothPosition = new THREE.Vector3(); this.aim = new THREE.Vector3(); this.target = new THREE.Vector3(); this.position = new THREE.Vector3();
    this.previous = {}; this.effectTime = 10; this.effect = ''; this.sample = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  resize(viewport = null) {
    this.viewport = viewport;
    this.camera.updateProjectionMatrix();
    if (viewport) {
      const centerY=(viewport.top+viewport.bottom)/(2*viewport.height);
      this.camera.projectionMatrix.elements[9]=2*centerY-1;
      if(viewport.left!==undefined) this.camera.projectionMatrix.elements[8]=1-(viewport.left+viewport.right)/viewport.width;
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }
    if (this.base.isEmpty() || this.status !== this.character.status) {
      this.base.copy(this.character.getBounds()); this.status = this.character.status;
    }
    this.bounds.copy(this.base);
    this.height = Math.max(this.base.max.y - this.base.min.y, .5);
    this.sample = 0; this.update(0, this.previous, true);
  }
  update(delta, state, immediate = false) {
    const dt = Math.min(Math.max(delta, 0), .1);
    this.effectTime += dt;
    if (state.lives < this.previous.lives) this.trigger('error');
    else if (state.phase === 'complete' && this.previous.phase !== 'complete') this.trigger('complete');
    else if (state.index > this.previous.index && state.phase === 'player-move') this.trigger('hit');
    this.previous = state;
    const movement = this.character.movements.currentMovement;
    this.sample -= dt;
    if (this.sample <= 0) { this.bounds.copy(this.character.getBounds()); this.sample = 0; }
    const h = this.height, tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const baseCenter = this.base.getCenter(new THREE.Vector3());
    const center = this.bounds.getCenter(new THREE.Vector3()), size = this.bounds.getSize(new THREE.Vector3());
    const memorize = ['memorize-intro', 'demonstrate'].includes(state.phase);
    const usefulWidth=this.viewport?.left!==undefined?(this.viewport.right-this.viewport.left)/this.viewport.width:1;
    const useful=this.viewport?Math.max(.18,(this.viewport.bottom-this.viewport.top)/this.viewport.height):1;
    const occupancy=this.viewport?(this.viewport.width>this.viewport.height?.65:.82)*useful:(memorize?.58:.56);
    let distance = h / (2 * tan * occupancy);
    if(this.viewport && memorize) distance *= .98;
    let y = baseCenter.y, x = 0, z = baseCenter.z;
    if (!this.reduced) {
      if (movement === 'passinho') x = center.x * .35;
      if (movement === 'moonwalk') z += (center.z - baseCenter.z) * .55;
      if (movement === 'giro') distance *= 1.045;
      if (movement === 'pose-sigma') distance *= .965;
      if (movement === 'dab') distance *= .97;
      if (movement === 'breakdance') { y = THREE.MathUtils.lerp(baseCenter.y, center.y, .65); distance *= 1.025; }
    }
    // Fit actual limbs in portrait, without a fixed, oversized breakdance pullback.
    distance = Math.max(distance, (size.x / 2 + Math.abs(center.x - x)) / (tan * this.camera.aspect * .86 * usefulWidth) + size.z / 2,
      (size.y / 2 + Math.abs(center.y - y)) / (tan * .72) + size.z / 2);
    let punch = 0;
    if (!this.reduced) {
      if (this.effect === 'hit' && this.effectTime < .14) punch = .018 * Math.sin(Math.PI * this.effectTime / .14);
      if (this.effect === 'complete' && this.effectTime < .85) punch = .035 * Math.sin(Math.PI * this.effectTime / .85);
      if (this.effect === 'error' && this.effectTime < .28) x += h * .018 * Math.sin(Math.PI * 2 * this.effectTime / .28);
    }
    this.target.set(x, y, z); this.position.set(x, y + h * .04, z + distance);
    const blend = immediate ? 1 : 1 - Math.exp(-dt * 9);
    this.smoothPosition.lerp(this.position, blend);
    this.camera.position.copy(this.smoothPosition);
    // Apply the transient punch after interpolation; it does not accumulate.
    this.camera.position.z -= distance * punch;
    this.aim.lerp(this.target, blend); this.camera.lookAt(this.aim);
    // Keep fast, extended limbs inside the portrait frame while easing catches up.
    this.camera.updateMatrixWorld(true);
    let retreat=0;const point=new THREE.Vector3();
    for(const px of [this.bounds.min.x,this.bounds.max.x])
      for(const py of [this.bounds.min.y,this.bounds.max.y])
        for(const pz of [this.bounds.min.z,this.bounds.max.z]){
          point.set(px,py,pz).applyMatrix4(this.camera.matrixWorldInverse);
          retreat=Math.max(retreat,Math.abs(point.x)/(tan*this.camera.aspect*.94*usefulWidth)+point.z,Math.abs(point.y)/(tan*.92*useful)+point.z);
        }
    if(retreat>0){const backwards=new THREE.Vector3(0,0,1).applyQuaternion(this.camera.quaternion);this.camera.position.addScaledVector(backwards,retreat);this.camera.updateMatrixWorld(true);}
  }
  trigger(effect) { this.effect = effect; this.effectTime = 0; }
  get visualFeedback() {
    if (this.reduced) return 0;
    if (this.effect === 'complete' && this.effectTime < .85) return .3 * Math.sin(Math.PI * this.effectTime / .85);
    if (this.effect === 'error' && this.effectTime < .35) return -.14 * Math.sin(Math.PI * this.effectTime / .35);
    return 0;
  }
}
