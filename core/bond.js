/* =========================================================
   QUANTUM BOND — CORE / BOND
   Handles pairwise interactions between two atoms:
   - Animated electron transfer (donor -> acceptor)
   - Electrostatic attraction arc/pulse after transfer
   - Timeline scrubber support (progress 0 -> 1)

   Scope: TWO atoms and the space between them.
   Single-atom behaviour stays in atom.js.
   Crystal/lattice logic stays in lattice.js (Phase 4+).
   ========================================================= */

import * as THREE from 'three';
import { ELECTRON_COLOR, SHELL_RADII } from './atom.js';

const TRANSFER_DURATION = 1400;
const PULSE_DURATION    = 600;

export function buildBond(donor, acceptor, scene) {

  /* ---- travelling electron ---- */
  const travelGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const travelMat = new THREE.MeshStandardMaterial({
    color: ELECTRON_COLOR,
    emissive: ELECTRON_COLOR,
    emissiveIntensity: 1.2,
    roughness: 0.2
  });
  const travelElectron = new THREE.Mesh(travelGeo, travelMat);
  travelElectron.visible = false;
  scene.add(travelElectron);

  /* ---- trail line ---- */
  const trailMat = new THREE.LineBasicMaterial({
    color: ELECTRON_COLOR,
    transparent: true,
    opacity: 0
  });
  let trailLine = null;

  /* ---- attraction arc between nuclei ---- */
  const arcMat = new THREE.LineBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0
  });
  let arcLine = null;

  /* ---- state ---- */
  let transferProgress = 0;
  let isAnimating = false;
  let isComplete  = false;
  let animPhase   = 'idle';

  /* ---- bezier helpers ---- */
  function getBezierPath() {
    const startWorld = new THREE.Vector3();
    const endWorld   = new THREE.Vector3();
    donor.nucleus.getWorldPosition(startWorld);
    acceptor.nucleus.getWorldPosition(endWorld);
    const dir = endWorld.clone().sub(startWorld).normalize();
    const outerR = SHELL_RADII[donor.element.shells.length - 1] || 4.7;
    startWorld.add(dir.clone().multiplyScalar(outerR));
    const mid = startWorld.clone().lerp(endWorld, 0.5);
    mid.y += 3.2;
    return { start: startWorld, control: mid, end: endWorld };
  }

  function bezierPoint(t, s, c, e) {
    const mt = 1 - t;
    return new THREE.Vector3(
      mt*mt*s.x + 2*mt*t*c.x + t*t*e.x,
      mt*mt*s.y + 2*mt*t*c.y + t*t*e.y,
      mt*mt*s.z + 2*mt*t*c.z + t*t*e.z
    );
  }

  function buildTrail(s, c, e) {
    if (trailLine) scene.remove(trailLine);
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(bezierPoint(i/48, s, c, e));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    trailLine = new THREE.Line(geo, trailMat.clone());
    scene.add(trailLine);
  }

  function buildArc(s, e) {
    if (arcLine) scene.remove(arcLine);
    const geo = new THREE.BufferGeometry().setFromPoints([s.clone(), e.clone()]);
    arcLine = new THREE.Line(geo, arcMat.clone());
    scene.add(arcLine);
  }

  /* ---- commit transfer state to both atoms ---- */
  function _commitTransfer() {
    if (!donor.isIonized) {
      const outerShell = [...donor.shellGroups].reverse().find(s => s.electrons.length > 0);
      if (outerShell) {
        const e = outerShell.electrons.pop();
        outerShell.pivot.remove(e);
        if (outerShell.electrons.length === 0) {
          outerShell.ring.material.opacity = 0;
          outerShell.cloud.visible = false;
        }
      }
      donor.isIonized    = true;
      donor.ionDirection = 'cation';
      donor._animateNucleus(
        donor.element.cation.ionicRadiusPm / 186,
        donor.element.cation.color,
        () => {}
      );
    }

    if (!acceptor.isIonized) {
      const targetShell = acceptor.shellGroups[acceptor.shellGroups.length - 1];
      const angle = (targetShell.electrons.length / Math.max(targetShell.slots, 1)) * Math.PI * 2;
      const eMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 16, 16),
        new THREE.MeshStandardMaterial({
          color: ELECTRON_COLOR,
          emissive: ELECTRON_COLOR,
          emissiveIntensity: 0.9,
          roughness: 0.3
        })
      );
      eMesh.position.set(
        Math.cos(angle) * targetShell.radius,
        0,
        Math.sin(angle) * targetShell.radius
      );
      eMesh.userData.angle = angle;
      targetShell.pivot.add(eMesh);
      targetShell.electrons.push(eMesh);
      targetShell.ring.material.opacity = acceptor.cloudMode ? 0 : 0.18;

      acceptor.isIonized    = true;
      acceptor.ionDirection = 'anion';
      acceptor._animateNucleus(
        acceptor.element.anion.ionicRadiusPm / 186,
        acceptor.element.anion.color,
        () => {}
      );
    }
  }

  /* ---- attraction pulse ---- */
  function _animatePulse(onDone) {
    animPhase = 'pulse';
    const sp = new THREE.Vector3();
    const ep = new THREE.Vector3();
    donor.nucleus.getWorldPosition(sp);
    acceptor.nucleus.getWorldPosition(ep);
    buildArc(sp, ep);

    const t0 = performance.now();
    function step() {
      const t = Math.min((performance.now() - t0) / PULSE_DURATION, 1);
      if (arcLine) arcLine.material.opacity = 0.85 * Math.sin(t * Math.PI);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (arcLine) arcLine.material.opacity = 0;
        isAnimating = false;
        isComplete  = true;
        animPhase   = 'done';
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(step);
  }

  /* ---- public API ---- */

  function transfer(onDone) {
    if (isAnimating || isComplete) return;

    isAnimating = true;
    animPhase   = 'transfer';

    const { start, control, end } = getBezierPath();
    buildTrail(start, control, end);

    // hide the donor's outermost shell electron — travelElectron takes over
    const outerShell = [...donor.shellGroups].reverse().find(s => s.electrons.length > 0);
    if (outerShell && outerShell.electrons.length > 0) {
      outerShell.electrons[outerShell.electrons.length - 1].visible = false;
    }

    travelElectron.position.copy(start);
    travelElectron.visible = true;

    const t0 = performance.now();
    function animTransfer() {
      const t = Math.min((performance.now() - t0) / TRANSFER_DURATION, 1);
      const eased = t * t * (3 - 2 * t);

      transferProgress = t;
      travelElectron.position.copy(bezierPoint(eased, start, control, end));
      travelElectron.material.emissiveIntensity = 1.2 - 0.4 * t;
      if (trailLine) trailLine.material.opacity = 0.35 * (1 - t * 0.6);

      if (t < 1) {
        requestAnimationFrame(animTransfer);
      } else {
        travelElectron.visible = false;
        if (trailLine) trailLine.material.opacity = 0;
        _commitTransfer();
        _animatePulse(onDone);
      }
    }
    requestAnimationFrame(animTransfer);
  }

  function scrub(t) {
    if (isAnimating) return;
    t = Math.max(0, Math.min(1, t));
    transferProgress = t;

    if (t === 0) { reset(); return; }

    const { start, control, end } = getBezierPath();
    if (!trailLine) buildTrail(start, control, end);

    if (t < 1) {
      travelElectron.visible = true;
      travelElectron.position.copy(bezierPoint(t * t * (3 - 2 * t), start, control, end));
      if (trailLine) trailLine.material.opacity = 0.35 * t;
    } else {
      travelElectron.visible = false;
      if (trailLine) trailLine.material.opacity = 0;
      _commitTransfer();
      isComplete = true;
    }
  }

  function reset() {
    travelElectron.visible = false;
    if (trailLine) trailLine.material.opacity = 0;
    if (arcLine)   arcLine.material.opacity   = 0;
    transferProgress = 0;
    isAnimating = false;
    isComplete  = false;
    animPhase   = 'idle';

    if (donor.isIonized)    donor.restoreFromCation();
    if (acceptor.isIonized) acceptor.restoreFromAnion();
  }

  return {
    get isComplete()  { return isComplete;  },
    get isAnimating() { return isAnimating; },
    get progress()    { return transferProgress; },
    transfer,
    scrub,
    reset
  };
}

/* =========================================================
   COVALENT BOND
   Builds a shared-orbital overlap region between two atoms
   and animates the bond forming sequentially.

   Usage (Phase 3):
     const bond1 = buildCovalentBond(oxygen, hydrogen1, scene)
     const bond2 = buildCovalentBond(oxygen, hydrogen2, scene)
     bond1.form(() => bond2.form(onBothDone))
   ========================================================= */

const COVALENT_COLOR    = 0x5eead4;
const FORM_DURATION     = 1100; // ms per bond
const PAUSE_BETWEEN     = 500;  // ms pause between O-H1 and O-H2

/**
 * Build the shared orbital overlap visual between two atoms
 * and expose form() / dissolve() / reset() methods.
 */
export function buildCovalentBond(atomA, atomB, scene) {

  /* ---- shared orbital region (lens shape = two offset spheres) ---- */
  const overlapMat = new THREE.MeshBasicMaterial({
    color: COVALENT_COLOR,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  // We approximate the lens with two slightly offset low-opacity spheres
  // centred on the bond midpoint — cheap, looks great, no custom geometry needed.
  const lensGeoA = new THREE.SphereGeometry(0.55, 24, 24);
  const lensGeoB = new THREE.SphereGeometry(0.55, 24, 24);
  const lensA = new THREE.Mesh(lensGeoA, overlapMat.clone());
  const lensB = new THREE.Mesh(lensGeoB, overlapMat.clone());
  scene.add(lensA);
  scene.add(lensB);

  /* ---- bond stick (thin cylinder between nuclei) ---- */
  const stickMat = new THREE.MeshBasicMaterial({
    color: COVALENT_COLOR,
    transparent: true,
    opacity: 0
  });
  const stickGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 12);
  const stick = new THREE.Mesh(stickGeo, stickMat);
  scene.add(stick);

  /* ---- travelling shared electrons (two, moving toward midpoint) ---- */
  function makeTravelDot() {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({
        color: COVALENT_COLOR,
        emissive: COVALENT_COLOR,
        emissiveIntensity: 1.0,
        roughness: 0.2
      })
    );
    m.visible = false;
    scene.add(m);
    return m;
  }
  const dotA = makeTravelDot(); // comes from atomA side
  const dotB = makeTravelDot(); // comes from atomB side

  /* ---- state ---- */
  let isFormed    = false;
  let isAnimating = false;

  /* ---- helpers ---- */
  function getMidpoint() {
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    atomA.nucleus.getWorldPosition(pa);
    atomB.nucleus.getWorldPosition(pb);
    return { pa, pb, mid: pa.clone().lerp(pb, 0.5) };
  }

  function positionLenses(mid, pa, pb) {
    const dir = pb.clone().sub(pa).normalize();
    const offset = 0.18;
    lensA.position.copy(mid).addScaledVector(dir,  offset);
    lensB.position.copy(mid).addScaledVector(dir, -offset);
  }

  function positionStick(pa, pb) {
    const mid = pa.clone().lerp(pb, 0.5);
    stick.position.copy(mid);
    const dir = pb.clone().sub(pa);
    const len = dir.length();
    stick.scale.y = len;
    // orient cylinder along bond axis
    const axis = new THREE.Vector3(0, 1, 0);
    stick.quaternion.setFromUnitVectors(axis, dir.normalize());
  }

  /* ---- form one covalent bond (sequential call from phase) ---- */
  function form(onDone) {
    if (isAnimating || isFormed) return;
    isAnimating = true;

    const { pa, pb, mid } = getMidpoint();

    // position static geometry
    positionLenses(mid, pa, pb);
    positionStick(pa, pb);

    // start travel dots from each nucleus toward midpoint
    dotA.position.copy(pa);
    dotB.position.copy(pb);
    dotA.visible = true;
    dotB.visible = true;

    const t0 = performance.now();

    function animForm() {
      const t     = Math.min((performance.now() - t0) / FORM_DURATION, 1);
      const eased = t * t * (3 - 2 * t);

      // dots travel toward midpoint
      dotA.position.lerpVectors(pa, mid, eased);
      dotB.position.lerpVectors(pb, mid, eased);
      dotA.material.emissiveIntensity = 1.0 - 0.3 * t;
      dotB.material.emissiveIntensity = 1.0 - 0.3 * t;

      // overlap region fades in
      const targetOpacity = 0.22;
      lensA.material.opacity = targetOpacity * eased;
      lensB.material.opacity = targetOpacity * eased;
      stick.material.opacity = 0.55 * eased;

      if (t < 1) {
        requestAnimationFrame(animForm);
      } else {
        // hide travel dots — overlap region takes over visually
        dotA.visible = false;
        dotB.visible = false;
        isFormed    = true;
        isAnimating = false;
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(animForm);
  }

  /* ---- dissolve: reverse the bond for reset ---- */
  function dissolve(onDone) {
    if (isAnimating || !isFormed) { if (onDone) onDone(); return; }
    isAnimating = true;

    const startOpA = lensA.material.opacity;
    const startOpB = lensB.material.opacity;
    const startOpS = stick.material.opacity;
    const t0 = performance.now();
    const dur = 500;

    function animDissolve() {
      const t     = Math.min((performance.now() - t0) / dur, 1);
      const eased = t * t * (3 - 2 * t);
      lensA.material.opacity = startOpA * (1 - eased);
      lensB.material.opacity = startOpB * (1 - eased);
      stick.material.opacity = startOpS * (1 - eased);

      if (t < 1) {
        requestAnimationFrame(animDissolve);
      } else {
        isFormed    = false;
        isAnimating = false;
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(animDissolve);
  }

  function reset() {
    dotA.visible = false;
    dotB.visible = false;
    lensA.material.opacity = 0;
    lensB.material.opacity = 0;
    stick.material.opacity = 0;
    isFormed    = false;
    isAnimating = false;
  }

  return {
    get isFormed()    { return isFormed;    },
    get isAnimating() { return isAnimating; },
    form,
    dissolve,
    reset,
    PAUSE_BETWEEN  // expose so phase3 can use the same constant
  };
}

export { PAUSE_BETWEEN };
