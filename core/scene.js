/* =========================================================
   QUANTUM BOND — CORE / SCENE
   Reusable Three.js scene setup. Every phase calls
   initScene() once and gets back the standard rig:
   camera, renderer, OrbitControls, lighting, starfield,
   plus automatic resize handling.

   This file should rarely need edits — it's boilerplate,
   not feature logic. Phase-specific cameras/lighting tweaks
   should happen by adjusting the returned objects, not by
   forking this file.
   ========================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initScene(container, opts = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b14, opts.fogDensity ?? 0.018);

  const camera = new THREE.PerspectiveCamera(
    opts.fov ?? 45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const camStart = opts.cameraPosition ?? [0, 4, 13];
  camera.position.set(...camStart);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance ?? 4;
  controls.maxDistance = opts.maxDistance ?? 24;
  controls.enablePan = false;

  // ---------- Lighting ----------
  scene.add(new THREE.AmbientLight(0x405070, 1.1));
  const key = new THREE.PointLight(0xffffff, 2.4, 50);
  key.position.set(8, 10, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0x5eead4, 1.2, 50);
  rim.position.set(-10, -4, -6);
  scene.add(rim);

  // ---------- Starfield (cheap depth cue) ----------
  addStarfield(scene);

  // ---------- Resize ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, key, rim };
}

function addStarfield(scene) {
  const starGeo = new THREE.BufferGeometry();
  const count = 600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x39456b, size: 0.6, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));
}

/* ---------- Standard render loop helper ----------
   Pass an array of objects with .update(dt) (e.g. atoms),
   plus the scene/camera/controls/renderer. Call once. */
export function startLoop({ scene, camera, controls, renderer }, updatables = []) {
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = clock.getDelta();
    updatables.forEach(u => u.update && u.update(dt));
    controls.update();
    renderer.render(scene, camera);
  }
  frame();
}
