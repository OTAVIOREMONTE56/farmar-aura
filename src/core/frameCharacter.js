import * as THREE from 'three';

export function frameCharacter(camera, bounds, { occupancy = .5, centerY = .52 } = {}) {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Fit by body height, with lateral room for outstretched dance poses.
  const height = Math.max(size.y, .5);
  const width = Math.max(size.x * 1.35, height * 1.15);
  const distance = Math.max(height / (2 * vertical * occupancy), width / (2 * vertical * camera.aspect * .88)) + size.z / 2;
  const target = center.clone();
  target.y += (centerY - .5) * 2 * distance * vertical;
  camera.position.copy(target).add(new THREE.Vector3(0, .08, 1).normalize().multiplyScalar(distance));
  camera.near = .05;
  camera.far = Math.max(200, distance + height * 4);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return { target, distance };
}
