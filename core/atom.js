/* =========================================================
   QUANTUM BOND — CORE / ATOM
   buildAtom(element, opts) returns a self-contained atom:
   nucleus, electron shells (Bohr rings + electron-cloud
   spheres), and ionization behavior (lose/gain an outer
   electron with an animated transition).

   Scope discipline: this file handles ONE atom. Pairwise
   interactions (electron transfer between two atoms,
   covalent sharing) belong in bond.js (Phase 2+).
   Crystal/lattice rendering belongs in lattice.js (Phase 4+).
   Keep it that way so this file doesn't bloat.
   ========================================================= */

import * as THREE from 'three';
import { REFERENCE_PM } from './elements.js';

export const SHELL_RADII    = [2.0, 3.4, 4.7, 6.0, 7.2];
export const SHELL_LABELS   = ['K', 'L', 'M', 'N', 'O'];
export const SHELL_CAPACITY = [2,   8,   18,  32,  50 ]; // physical max electrons per shell
export const ELECTRON_COLOR = 0x5eead4;

const electronGeo = new THREE.SphereGeometry(0.16, 16, 16);

function makeRing(radius) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(96).map(p => new THREE.Vector3(p.x, 0, p.y));
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: ELECTRON_COLOR, transparent: true, opacity: 0.18 });
  return new THREE.LineLoop(geo, mat);
}

function makeElectron() {
  const mat = new THREE.MeshStandardMaterial({
    color: ELECTRON_COLOR,
    emissive: ELECTRON_COLOR,
    emissiveIntensity: 0.9,
    roughness: 0.3
  });
  return new THREE.Mesh(electronGeo, mat);
}

/**
 * Build a fully-formed atom group plus its behavior API.
 * @param {object} element - an entry from elements.js (ELEMENTS.Na, etc.)
 * @param {object} opts - { position: THREE.Vector3, ejectDistance: number }
 */
export function buildAtom(element, opts = {}) {
  const group = new THREE.Group();
  if (opts.position) group.position.copy(opts.position);

  // ---------- Nucleus ----------
  const nucleusGeo = new THREE.SphereGeometry(1, 48, 48);
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: element.color,
    roughness: 0.35,
    metalness: 0.15,
    emissive: element.color,
    emissiveIntensity: 0.15
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  nucleus.scale.setScalar(element.atomicRadiusPm / REFERENCE_PM);
  group.add(nucleus);

  const haloGeo = new THREE.SphereGeometry(1, 32, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: element.color,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.scale.setScalar(1.35);
  nucleus.add(halo);

  // ---------- Shells (rings, electrons, clouds) ----------
  const ringGroup = new THREE.Group();
  group.add(ringGroup);

  const shellGroups = [];

  element.shells.forEach((count, i) => {
    const radius = SHELL_RADII[i];

    const ring = makeRing(radius);
    ringGroup.add(ring);

    const pivot = new THREE.Group();
    pivot.rotation.x = i * 0.35;
    pivot.rotation.z = i * 0.2;
    group.add(pivot);

    const electrons = [];
    for (let e = 0; e < count; e++) {
      const angle = (e / count) * Math.PI * 2;
      const mesh = makeElectron();
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      mesh.userData.angle = angle;
      pivot.add(mesh);
      electrons.push(mesh);
    }

    const cloudGeo = new THREE.SphereGeometry(radius, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: ELECTRON_COLOR,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.visible = false;
    group.add(cloud);

    // slots = physical shell capacity, NOT the neutral atom's count.
    // This matters for gainElectron() — e.g. Cl M-shell has 7 electrons
    // but capacity 18 (or 8 in simple Bohr model), so it can accept one more.
    // We cap at 8 for shells 0-2 in the simplified Bohr model we're teaching,
    // since we're not modelling d-orbitals yet (Phase 3+ handles that).
    const bohrCap = i < 2 ? SHELL_CAPACITY[i] : 8;
    shellGroups.push({ pivot, electrons, cloud, ring, radius, count, slots: bohrCap });
  });

  const ejectDistance = opts.ejectDistance ?? 14;

  const atom = {
    element,
    group,
    nucleus,
    halo,
    shellGroups,
    isIonized: false,
    isAnimating: false,
    cloudMode: false,
    ionDirection: null, // 'cation' | 'anion' | null

    update(dt) {
      shellGroups.forEach((s, i) => {
        const speed = 0.6 - i * 0.12;
        s.pivot.rotation.y += dt * speed;
      });
    },

    /** Switch between Bohr-shell rendering and electron-cloud rendering. */
    setMode(cloudMode) {
      atom.cloudMode = cloudMode;
      shellGroups.forEach((s) => {
        const depleted = s.electrons.length === 0 && s.slots > 0 && atom.isIonized;
        if (depleted) {
          s.ring.material.opacity = 0;
          s.cloud.visible = false;
          return;
        }
        s.ring.material.opacity = cloudMode ? 0 : 0.18;
        s.cloud.visible = cloudMode;
        s.electrons.forEach(e => e.visible = !cloudMode);
      });
    },

    /** Animate nucleus size/color toward a target (used by ion transitions). */
    _animateNucleus(targetScale, targetColor, onDone) {
      const startScale = nucleus.scale.x;
      const startColor = new THREE.Color(nucleus.material.color.getHex());
      const endColor = new THREE.Color(targetColor);
      const duration = 700;
      const t0 = performance.now();

      function step() {
        const t = Math.min((performance.now() - t0) / duration, 1);
        const eased = t * t * (3 - 2 * t);
        nucleus.scale.setScalar(startScale + (targetScale - startScale) * eased);
        nucleus.material.color.copy(startColor).lerp(endColor, eased);
        nucleus.material.emissive.copy(nucleus.material.color);
        halo.material.color.copy(nucleus.material.color);
        if (t < 1) requestAnimationFrame(step);
        else if (onDone) onDone();
      }
      requestAnimationFrame(step);
    },

    /**
     * Remove one electron from the outermost occupied shell and
     * shrink the nucleus toward the element's cation size.
     * Returns false if the element has no cation defined, or an
     * ionization is already in progress / already ionized.
     */
    loseElectron(onDone) {
      if (atom.isAnimating || atom.isIonized || !element.cation) return false;
      atom.isAnimating = true;

      const outerShell = [...shellGroups].reverse().find(s => s.electrons.length > 0);
      const electron = outerShell.electrons.pop();

      const worldPos = new THREE.Vector3();
      electron.getWorldPosition(worldPos);
      outerShell.pivot.remove(electron);
      group.worldToLocal(worldPos);
      electron.position.copy(worldPos);
      group.add(electron);

      const start = worldPos.clone();
      const direction = start.clone().normalize();
      const end = start.clone().add(direction.multiplyScalar(ejectDistance));

      const duration = 900;
      const t0 = performance.now();

      function animateOut() {
        const t = Math.min((performance.now() - t0) / duration, 1);
        const eased = t * t * (3 - 2 * t);
        electron.position.lerpVectors(start, end, eased);
        electron.material.emissiveIntensity = 0.9 * (1 - eased) + 0.1;
        electron.scale.setScalar(1 - eased * 0.6);

        if (t < 1) {
          requestAnimationFrame(animateOut);
        } else {
          group.remove(electron);
          atom.isIonized = true;
          atom.ionDirection = 'cation';
          atom.isAnimating = false;
          atom.setMode(atom.cloudMode);
          if (onDone) onDone();
        }
      }
      requestAnimationFrame(animateOut);

      atom._animateNucleus(element.cation.ionicRadiusPm / REFERENCE_PM, element.cation.color, () => {});
      if (outerShell.electrons.length === 0) {
        outerShell.ring.material.opacity = 0;
        outerShell.cloud.visible = false;
      }
      return true;
    },

    /**
     * Like loseElectron(), but instead of ejecting the electron off
     * to infinity, detaches it into `sceneRoot` (world space) so a
     * caller (bond.js) can animate it toward another atom.
     * Returns the detached electron mesh, or null if not possible.
     */
    beginElectronLoss(sceneRoot) {
      if (atom.isAnimating || atom.isIonized || !element.cation) return null;
      atom.isAnimating = true;

      const outerShell = [...shellGroups].reverse().find(s => s.electrons.length > 0);
      const electron = outerShell.electrons.pop();

      const worldPos = new THREE.Vector3();
      electron.getWorldPosition(worldPos);
      outerShell.pivot.remove(electron);
      electron.position.copy(worldPos);
      sceneRoot.add(electron);

      atom.isIonized = true;
      atom.ionDirection = 'cation';

      if (outerShell.electrons.length === 0) {
        outerShell.ring.material.opacity = 0;
        outerShell.cloud.visible = false;
      }

      atom._animateNucleus(element.cation.ionicRadiusPm / REFERENCE_PM, element.cation.color, () => {
        atom.isAnimating = false;
      });

      return electron;
    },

    /** Reverse loseElectron(): restore the ejected electron and neutral size. */
    restoreFromCation(onDone) {
      if (atom.isAnimating || !atom.isIonized || atom.ionDirection !== 'cation') return false;
      atom.isAnimating = true;

      const outerShell = [...shellGroups].reverse().find(s => s.slots > s.electrons.length);
      const angle = (outerShell.electrons.length / outerShell.slots) * Math.PI * 2;
      const electron = makeElectron();
      electron.position.set(Math.cos(angle) * outerShell.radius, 0, Math.sin(angle) * outerShell.radius);
      electron.userData.angle = angle;
      outerShell.pivot.add(electron);
      outerShell.electrons.push(electron);

      outerShell.ring.material.opacity = atom.cloudMode ? 0 : 0.18;
      outerShell.cloud.visible = atom.cloudMode;
      electron.visible = !atom.cloudMode;

      atom._animateNucleus(element.atomicRadiusPm / REFERENCE_PM, element.color, () => {
        atom.isIonized = false;
        atom.ionDirection = null;
        atom.isAnimating = false;
        if (onDone) onDone();
      });
      return true;
    },

    /**
     * Add one electron to the outermost shell with capacity and
     * grow the nucleus toward the element's anion size.
     */
    gainElectron(onDone) {
      if (atom.isAnimating || atom.isIonized || !element.anion) return false;
      atom.isAnimating = true;

      const targetShell = [...shellGroups].reverse().find(s => s.electrons.length < s.slots)
        || shellGroups[shellGroups.length - 1];
      const angle = (targetShell.electrons.length / targetShell.slots) * Math.PI * 2;

      const electron = makeElectron();
      electron.userData.angle = angle;
      electron.position.set(Math.cos(angle) * targetShell.radius, 0, Math.sin(angle) * targetShell.radius);
      electron.scale.setScalar(0.1);
      electron.material.emissiveIntensity = 0.1;
      targetShell.pivot.add(electron);
      targetShell.electrons.push(electron);
      electron.visible = !atom.cloudMode;
      targetShell.ring.material.opacity = atom.cloudMode ? 0 : 0.18;

      const duration = 700;
      const t0 = performance.now();
      function growIn() {
        const t = Math.min((performance.now() - t0) / duration, 1);
        const eased = t * t * (3 - 2 * t);
        electron.scale.setScalar(0.1 + 0.9 * eased);
        electron.material.emissiveIntensity = 0.1 + 0.8 * eased;
        if (t < 1) requestAnimationFrame(growIn);
        else {
          atom.isIonized = true;
          atom.ionDirection = 'anion';
          atom.isAnimating = false;
          if (onDone) onDone();
        }
      }
      requestAnimationFrame(growIn);

      atom._animateNucleus(element.anion.ionicRadiusPm / REFERENCE_PM, element.anion.color, () => {});
      return true;
    },

    /** Reverse gainElectron(): remove the gained electron and restore neutral size. */
    restoreFromAnion(onDone) {
      if (atom.isAnimating || !atom.isIonized || atom.ionDirection !== 'anion') return false;
      atom.isAnimating = true;

      // the gained electron sits in the shell whose current count exceeds
      // the element's neutral configuration count for that shell index
      const shell = shellGroups.find((s, i) => s.electrons.length > element.shells[i]);
      const electron = shell ? shell.electrons.pop() : null;
      if (electron) shell.pivot.remove(electron);

      atom._animateNucleus(element.atomicRadiusPm / REFERENCE_PM, element.color, () => {
        atom.isIonized = false;
        atom.ionDirection = null;
        atom.isAnimating = false;
        if (onDone) onDone();
      });
      return true;
    }
  };

  // initialize visuals for default (Bohr shell) mode
  atom.setMode(false);

  return atom;
}
