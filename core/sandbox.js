/* =========================================================
   QUANTUM BOND — CORE / SANDBOX
   Free-exploration mode engine.

   Exports:
     ELEMENTS  — extended element table with electronegativity,
                 valence electrons, and bond energy data
     buildSandbox(scene, camera, renderer, opts) → sandbox API

   Scope: atom placement, bond detection, formula generation,
   drag interaction. Visual atom rendering delegates to atom.js.
   ========================================================= */

import * as THREE from 'three';
import { buildAtom } from './atom.js';

/* =========================================================
   EXTENDED ELEMENT DATA
   Adds χ (Pauling electronegativity), v (valence electrons),
   z (atomic number), and bondEnergies for bond classification.
   Color values mirror elements.js CPK standard.
   ========================================================= */
export const ELEMENTS = {
  H:  { symbol:'H',  name:'Hydrogen',   z:1,  color:0xffffff, χ:2.20, v:1, shells:[1],       atomicRadiusPm:53,  cation:null, anion:{ ionicRadiusPm:150, color:0xeaeaff, chargeLabel:'\u22121' } },
  He: { symbol:'He', name:'Helium',     z:2,  color:0xd9ffff, χ:0,    v:0, shells:[2],       atomicRadiusPm:31,  cation:null, anion:null },
  Li: { symbol:'Li', name:'Lithium',    z:3,  color:0xcc80ff, χ:0.98, v:1, shells:[2,1],     atomicRadiusPm:167, cation:{ ionicRadiusPm:76,  color:0xdd99ff, chargeLabel:'+1' }, anion:null },
  Be: { symbol:'Be', name:'Beryllium',  z:4,  color:0xc2ff00, χ:1.57, v:2, shells:[2,2],     atomicRadiusPm:112, cation:{ ionicRadiusPm:45,  color:0xd4ff33, chargeLabel:'+2' }, anion:null },
  B:  { symbol:'B',  name:'Boron',      z:5,  color:0xffb5b5, χ:2.04, v:3, shells:[2,3],     atomicRadiusPm:87,  cation:null, anion:null },
  C:  { symbol:'C',  name:'Carbon',     z:6,  color:0x909090, χ:2.55, v:4, shells:[2,4],     atomicRadiusPm:70,  cation:null, anion:null },
  N:  { symbol:'N',  name:'Nitrogen',   z:7,  color:0x3050f8, χ:3.04, v:5, shells:[2,5],     atomicRadiusPm:65,  cation:null, anion:{ ionicRadiusPm:146, color:0x6677ff, chargeLabel:'\u22123' } },
  O:  { symbol:'O',  name:'Oxygen',     z:8,  color:0xff3333, χ:3.44, v:6, shells:[2,6],     atomicRadiusPm:60,  cation:null, anion:{ ionicRadiusPm:140, color:0xff6666, chargeLabel:'\u22122' } },
  F:  { symbol:'F',  name:'Fluorine',   z:9,  color:0x90e050, χ:3.98, v:7, shells:[2,7],     atomicRadiusPm:50,  cation:null, anion:{ ionicRadiusPm:133, color:0xb0ff70, chargeLabel:'\u22121' } },
  Ne: { symbol:'Ne', name:'Neon',       z:10, color:0xb3e3f5, χ:0,    v:0, shells:[2,8],     atomicRadiusPm:38,  cation:null, anion:null },
  Na: { symbol:'Na', name:'Sodium',     z:11, color:0xab5cf2, χ:0.93, v:1, shells:[2,8,1],   atomicRadiusPm:186, cation:{ ionicRadiusPm:102, color:0xc792ff, chargeLabel:'+1' }, anion:null },
  Mg: { symbol:'Mg', name:'Magnesium',  z:12, color:0x33cc33, χ:1.31, v:2, shells:[2,8,2],   atomicRadiusPm:160, cation:{ ionicRadiusPm:72,  color:0x66ff66, chargeLabel:'+2' }, anion:null },
  Al: { symbol:'Al', name:'Aluminium',  z:13, color:0xbfa6a6, χ:1.61, v:3, shells:[2,8,3],   atomicRadiusPm:143, cation:{ ionicRadiusPm:53,  color:0xd4c0c0, chargeLabel:'+3' }, anion:null },
  Si: { symbol:'Si', name:'Silicon',    z:14, color:0xf0c8a0, χ:1.90, v:4, shells:[2,8,4],   atomicRadiusPm:111, cation:null, anion:null },
  P:  { symbol:'P',  name:'Phosphorus', z:15, color:0xff8000, χ:2.19, v:5, shells:[2,8,5],   atomicRadiusPm:98,  cation:null, anion:{ ionicRadiusPm:212, color:0xffaa44, chargeLabel:'\u22123' } },
  S:  { symbol:'S',  name:'Sulfur',     z:16, color:0xffff30, χ:2.58, v:6, shells:[2,8,6],   atomicRadiusPm:88,  cation:null, anion:{ ionicRadiusPm:184, color:0xffff77, chargeLabel:'\u22122' } },
  Cl: { symbol:'Cl', name:'Chlorine',   z:17, color:0x1ff01f, χ:3.16, v:7, shells:[2,8,7],   atomicRadiusPm:99,  cation:null, anion:{ ionicRadiusPm:181, color:0x6dff6d, chargeLabel:'\u22121' } },
  Ar: { symbol:'Ar', name:'Argon',      z:18, color:0x80d1e3, χ:0,    v:0, shells:[2,8,8],   atomicRadiusPm:71,  cation:null, anion:null },
  K:  { symbol:'K',  name:'Potassium',  z:19, color:0x8f40d4, χ:0.82, v:1, shells:[2,8,8,1], atomicRadiusPm:227, cation:{ ionicRadiusPm:138, color:0xaa66ee, chargeLabel:'+1' }, anion:null },
  Ca: { symbol:'Ca', name:'Calcium',    z:20, color:0x3dff00, χ:1.00, v:2, shells:[2,8,8,2], atomicRadiusPm:197, cation:{ ionicRadiusPm:100, color:0x77ff44, chargeLabel:'+2' }, anion:null },
};

/* ---- Bond classification thresholds (Pauling) ---- */
const BOND_THRESHOLDS = {
  nonpolar:  0.4,   // Δχ < 0.4 → nonpolar covalent
  polar:     1.7,   // 0.4–1.7 → polar covalent
                    // Δχ > 1.7 → ionic
};

/* ---- Typical bond energies (kJ/mol) — simplified single bond values ---- */
const BOND_ENERGIES = {
  'H-H':   436, 'H-C':  413, 'H-N':  391, 'H-O':  459, 'H-F':  565,
  'H-S':   363, 'H-Cl': 432, 'C-C':  347, 'C-N':  305, 'C-O':  360,
  'C-F':   485, 'C-Cl': 339, 'N-N':  163, 'N-O':  201, 'O-O':  146,
  'Na-Cl': 408, 'Mg-O': 394, 'K-Cl': 433, 'Ca-O': 402,
};

function getBondEnergy(symA, symB) {
  const key1 = `${symA}-${symB}`;
  const key2 = `${symB}-${symA}`;
  return BOND_ENERGIES[key1] || BOND_ENERGIES[key2] || 250;
}

/* ---- Classify bond from electronegativity difference ---- */
function classifyBond(elA, elB) {
  const delta = Math.abs(elA.χ - elB.χ);
  const energy = getBondEnergy(elA.symbol, elB.symbol);

  if (delta < BOND_THRESHOLDS.nonpolar) {
    return {
      type:   'covalent',
      label:  `${elA.symbol}\u2013${elB.symbol} Covalent`,
      desc:   `\u0394\u03c7 = ${delta.toFixed(2)} \u2014 equal sharing`,
      color:  0x5eead4,
      order:  1,
      energy,
    };
  } else if (delta < BOND_THRESHOLDS.polar) {
    return {
      type:   'polar',
      label:  `${elA.symbol}\u2013${elB.symbol} Polar Covalent`,
      desc:   `\u0394\u03c7 = ${delta.toFixed(2)} \u2014 unequal sharing`,
      color:  0xf59e0b,
      order:  1,
      energy,
    };
  } else {
    return {
      type:   'ionic',
      label:  `${elA.symbol}\u2013${elB.symbol} Ionic`,
      desc:   `\u0394\u03c7 = ${delta.toFixed(2)} \u2014 electron transfer`,
      color:  0xff6b35,
      order:  0,
      energy,
    };
  }
}

/* ---- Generate a simple molecular formula from atom list ---- */
function generateFormula(atoms) {
  if (atoms.length === 0) return '';
  const counts = {};
  atoms.forEach(a => {
    counts[a.element.symbol] = (counts[a.element.symbol] || 0) + 1;
  });
  // Hill order: C first, H second, then alphabetical
  const order = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1; if (b === 'C') return 1;
    if (a === 'H') return -1; if (b === 'H') return 1;
    return a.localeCompare(b);
  });
  return order.map(s => counts[s] > 1 ? `${s}${counts[s]}` : s).join('');
}

/* ---- Thin bond-stick mesh between two world positions ---- */
function makeBondStick(posA, posB, color) {
  const dir = posB.clone().sub(posA);
  const len = dir.length();
  const mid = posA.clone().lerp(posB, 0.5);

  const geo = new THREE.CylinderGeometry(0.06, 0.06, len, 10);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.25,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  return mesh;
}

/* =========================================================
   MAIN EXPORT
   ========================================================= */
export function buildSandbox(scene, camera, renderer, opts = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const MAX_ATOMS = 4;

  /* ---- state ---- */
  let atoms      = [];   // { element, atom3d, position: THREE.Vector3 }
  let bondMeshes = [];   // THREE.Mesh sticks
  let bondInfos  = [];   // classified bond data for readout
  let history    = [];   // for undo (snapshots of atom symbols)

  /* ---- raycaster ---- */
  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2();

  /* ---- drag state ---- */
  let dragging    = null; // { entry, plane, offset }

  /* ---- notify caller ---- */
  function notify() {
    if (opts.onUpdate) {
      opts.onUpdate({
        atoms:   atoms.map(a => ({ element: a.element })),
        bonds:   bondInfos,
        formula: generateFormula(atoms),
      });
    }
  }

  /* ---- rebuild all bond sticks from current atom positions ---- */
  function rebuildBonds() {
    bondMeshes.forEach(m => group.remove(m));
    bondMeshes = [];
    bondInfos  = [];

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const info = classifyBond(atoms[i].element, atoms[j].element);
        const stick = makeBondStick(
          atoms[i].atom3d.group.position,
          atoms[j].atom3d.group.position,
          info.color
        );
        group.add(stick);
        bondMeshes.push(stick);
        bondInfos.push(info);
      }
    }
  }

  /* ---- place a new atom at a screen position ---- */
  function addAtom(element, screenX, screenY) {
    if (atoms.length >= MAX_ATOMS) return;

    // save undo snapshot
    history.push(atoms.map(a => a.element.symbol));

    // unproject screen point to a world position at z=0
    pointer.x =  (screenX / window.innerWidth)  * 2 - 1;
    pointer.y = -(screenY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const worldPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldPos);

    // slight spread so atoms don't all spawn on top of each other
    worldPos.x += (Math.random() - 0.5) * 0.5;
    worldPos.y += (Math.random() - 0.5) * 0.5;

    const atom3d = buildAtom(element, { position: worldPos });
    // scale down so multiple atoms fit comfortably
    atom3d.group.scale.setScalar(0.55);
    group.add(atom3d.group);

    const entry = { element, atom3d, position: worldPos.clone() };
    atoms.push(entry);

    rebuildBonds();
    notify();
  }

  /* ---- remove atom by index ---- */
  function removeAtom(index) {
    if (index < 0 || index >= atoms.length) return;
    history.push(atoms.map(a => a.element.symbol));
    const entry = atoms.splice(index, 1)[0];
    group.remove(entry.atom3d.group);
    rebuildBonds();
    notify();
  }

  /* ---- undo ---- */
  function undo() {
    if (history.length === 0) return;
    const prev = history.pop();

    // remove all atoms
    atoms.forEach(a => group.remove(a.atom3d.group));
    atoms = [];
    rebuildBonds();

    // re-add previous set
    prev.forEach(sym => {
      const el = ELEMENTS[sym];
      if (el) {
        const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 200;
        const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
        addAtom(el, cx, cy);
      }
    });

    // undo pushes to history — pop that extra entry
    history.pop();
    notify();
  }

  /* ---- clear all ---- */
  function clear() {
    history.push(atoms.map(a => a.element.symbol));
    atoms.forEach(a => group.remove(a.atom3d.group));
    atoms = [];
    rebuildBonds();
    notify();
  }

  /* ---- pick atom at screen coords ---- */
  function pickAtom(screenX, screenY) {
    pointer.x =  (screenX / window.innerWidth)  * 2 - 1;
    pointer.y = -(screenY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    for (let i = 0; i < atoms.length; i++) {
      const hits = raycaster.intersectObject(atoms[i].atom3d.nucleus, false);
      if (hits.length > 0) return atoms[i];
    }
    return null;
  }

  /* ---- drag: start ---- */
  function startDrag(entry, pointerEvent) {
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    pointer.x =  (pointerEvent.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = -(pointerEvent.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hitPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, hitPoint);
    const offset = entry.atom3d.group.position.clone().sub(hitPoint);

    dragging = { entry, plane: dragPlane, offset };

    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      pointer.x =  (clientX / window.innerWidth)  * 2 - 1;
      pointer.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const wp = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragging.plane, wp);
      dragging.entry.atom3d.group.position.copy(wp.add(dragging.offset));
      dragging.entry.position.copy(dragging.entry.atom3d.group.position);
      rebuildBonds();
    };

    const onUp = () => {
      dragging = null;
      notify();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }

  /* ---- update (called each frame) ---- */
  function update(dt) {
    atoms.forEach(a => a.atom3d.update(dt));
  }

  return {
    group,
    get atoms()  { return atoms;     },
    get bonds()  { return bondInfos; },
    addAtom,
    removeAtom,
    pickAtom,
    startDrag,
    undo,
    clear,
    update,
  };
}
