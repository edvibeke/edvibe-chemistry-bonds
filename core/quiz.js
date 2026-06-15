/* =========================================================
   QUANTUM BOND — CORE / QUIZ
   Challenge definitions, geometry evaluator, scoring engine,
   and feedback animations for Phase 8.

   Exports:
     CHALLENGES         — full pool split by level
     pickChallenge()    — random from pool, no repeats until exhausted
     evaluateAttempt()  — checks atoms + bond type + geometry
     buildQuizFeedback()— celebration / explosion / shake animations
     QuizSession        — score tracker with localStorage persistence
   ========================================================= */

import * as THREE from 'three';

/* =========================================================
   CHALLENGE POOL
   Each challenge has:
     id        — unique string
     level     — 1 | 2 | 3
     target    — display name shown to student
     formula   — e.g. "NaCl"
     atoms     — array of element symbols required
     bondType  — 'ionic' | 'polar' | 'covalent'
     bondAngle — expected angle in degrees (null if linear/diatomic)
     angleTolerance — degrees of allowed error
     clues     — array of hint strings shown progressively
     fact      — interesting real-world fact shown on success
   ========================================================= */
export const CHALLENGES = {

  /* ---- Level 1: Ionic bonds ---- */
  level1: [
    {
      id: 'nacl',
      level: 1,
      target: 'Sodium Chloride',
      formula: 'NaCl',
      atoms: ['Na', 'Cl'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'This compound makes your food taste good',
        'One atom needs to lose an electron, one needs to gain one',
        'Look for a metal and a non-metal — they form ionic bonds'
      ],
      fact: 'Table salt (NaCl) is essential for life — your nerves use Na⁺ and Cl⁻ to send electrical signals.'
    },
    {
      id: 'mgo',
      level: 1,
      target: 'Magnesium Oxide',
      formula: 'MgO',
      atoms: ['Mg', 'O'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'This white powder is used in antacids and fire-resistant materials',
        'Magnesium loses 2 electrons — oxygen gains 2',
        'The electronegativity difference is very large — think ionic'
      ],
      fact: 'MgO has a melting point of 2852°C — one of the highest of any oxide — because of its strong ionic bonds.'
    },
    {
      id: 'kcl',
      level: 1,
      target: 'Potassium Chloride',
      formula: 'KCl',
      atoms: ['K', 'Cl'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'Used as a salt substitute for people avoiding sodium',
        'Potassium is in Group 1 — it readily loses one electron',
        'The bond type is the same as NaCl'
      ],
      fact: 'KCl is used in lethal injections — at high doses it stops the heart by disrupting K⁺ ion channels.'
    },
    {
      id: 'cao',
      level: 1,
      target: 'Calcium Oxide',
      formula: 'CaO',
      atoms: ['Ca', 'O'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'Known as quicklime — used in cement and steel making',
        'Calcium is in Group 2, oxygen is in Group 6',
        'Both atoms reach a full outer shell through electron transfer'
      ],
      fact: 'CaO reacts violently with water to produce Ca(OH)₂ and enough heat to ignite paper.'
    },
  ],

  /* ---- Level 2: Covalent bonds ---- */
  level2: [
    {
      id: 'h2o',
      level: 2,
      target: 'Water',
      formula: 'H₂O',
      atoms: ['O', 'H', 'H'],
      bondType: 'polar',
      bondAngle: 104.5,
      angleTolerance: 15,
      clues: [
        'The most abundant compound on Earth\'s surface',
        'Oxygen goes in the middle — it bonds to both hydrogens',
        'The molecule is bent, not linear — lone pairs push the bonds together'
      ],
      fact: 'Water\'s bent shape (104.5°) makes it polar, which is why it can dissolve so many substances — the "universal solvent".'
    },
    {
      id: 'hcl',
      level: 2,
      target: 'Hydrochloric Acid',
      formula: 'HCl',
      atoms: ['H', 'Cl'],
      bondType: 'polar',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'Your stomach produces this to digest food',
        'Only two atoms needed — one hydrogen, one chlorine',
        'The electronegativity difference is 0.96 — polar covalent'
      ],
      fact: 'Stomach acid (HCl) has a pH of 1–2, strong enough to dissolve metals, but your stomach lining regenerates every few days.'
    },
    {
      id: 'h2',
      level: 2,
      target: 'Hydrogen Gas',
      formula: 'H₂',
      atoms: ['H', 'H'],
      bondType: 'covalent',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'The lightest and most abundant element in the universe',
        'Two identical atoms — the electronegativity difference is zero',
        'They share electrons equally — pure covalent bond'
      ],
      fact: 'H₂ is the fuel of stars. The Sun converts 620 million tonnes of hydrogen into helium every second via nuclear fusion.'
    },
    {
      id: 'nacl_identify',
      level: 2,
      target: 'Identify the Bond in NaCl',
      formula: 'NaCl',
      atoms: ['Na', 'Cl'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      mode: 'identify',
      clues: [
        'Look at the electronegativity values: Na = 0.93, Cl = 3.16',
        'The difference is 2.23 — well above the ionic threshold of 1.7',
        'Which bond type involves electron transfer rather than sharing?'
      ],
      fact: 'The electronegativity difference in NaCl (2.23) is so large that the electron is essentially fully transferred — making it a true ionic compound.'
    },
  ],

  /* ---- Level 3: Mixed / harder ---- */
  level3: [
    {
      id: 'co2',
      level: 3,
      target: 'Carbon Dioxide',
      formula: 'CO₂',
      atoms: ['C', 'O', 'O'],
      bondType: 'polar',
      bondAngle: 180,
      angleTolerance: 12,
      clues: [
        'What you breathe out — responsible for the greenhouse effect',
        'Carbon goes in the middle, oxygen on each side',
        'The shape is perfectly linear — 180 degrees'
      ],
      fact: 'CO₂ is linear and nonpolar overall despite having polar C=O bonds — the dipoles cancel because the molecule is symmetric.'
    },
    {
      id: 'mgo_identify',
      level: 3,
      target: 'Build AND Identify: MgO',
      formula: 'MgO',
      atoms: ['Mg', 'O'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'Magnesium has electronegativity 1.31, oxygen has 3.44',
        'The difference is 2.13 — what does that tell you?',
        'Both the bond type AND the atom selection matter here'
      ],
      fact: 'MgO is used to line furnaces and kilns because its ionic bonds require enormous energy to break — 3795 kJ/mol lattice energy.'
    },
    {
      id: 'cacl2',
      level: 3,
      target: 'Calcium Chloride',
      formula: 'CaCl₂',
      atoms: ['Ca', 'Cl', 'Cl'],
      bondType: 'ionic',
      bondAngle: null,
      angleTolerance: null,
      clues: [
        'Used to de-ice roads in winter',
        'Calcium is in Group 2 — it loses 2 electrons total',
        'Each chlorine gains one electron from calcium'
      ],
      fact: 'CaCl₂ dissolves so readily in water (and releases so much heat) that it\'s used as a desiccant — it pulls moisture from the air.'
    },
  ]
};

/* ---- Flatten all challenges into one pool per level ---- */
const ALL_CHALLENGES = [
  ...CHALLENGES.level1,
  ...CHALLENGES.level2,
  ...CHALLENGES.level3,
];

/* =========================================================
   RANDOM POOL PICKER
   Exhausts the pool before repeating — like a shuffled deck.
   ========================================================= */
export function createPicker(levelFilter = null) {
  let pool = levelFilter
    ? ALL_CHALLENGES.filter(c => c.level === levelFilter)
    : ALL_CHALLENGES;

  let remaining = [];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function next() {
    if (remaining.length === 0) remaining = shuffle([...pool]);
    return remaining.pop();
  }

  return { next };
}

/* =========================================================
   EVALUATOR
   Checks a student's placed atoms against a challenge.
   Returns { pass, errors[] }
   ========================================================= */
export function evaluateAttempt(challenge, placedAtoms, bondInfos) {
  const errors = [];

  /* ---- 1. Correct atom set ---- */
  const required = [...challenge.atoms].sort();
  const placed   = placedAtoms.map(a => a.element.symbol).sort();

  if (required.join(',') !== placed.join(',')) {
    const missing = required.filter(s => !placed.includes(s));
    const extra   = placed.filter(s => !required.includes(s));
    if (missing.length) errors.push(`Missing atom${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
    if (extra.length)   errors.push(`Wrong atom${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}`);
    return { pass: false, errors };
  }

  /* ---- 2. Correct bond type ---- */
  if (bondInfos.length === 0) {
    errors.push('No bonds formed — place atoms closer together');
    return { pass: false, errors };
  }

  const detectedType = bondInfos[0].type; // 'covalent' | 'polar' | 'ionic'
  const targetType   = challenge.bondType;

  const typeMatch =
    detectedType === targetType ||
    (targetType === 'polar' && detectedType === 'polar') ||
    (targetType === 'covalent' && (detectedType === 'covalent' || detectedType === 'polar'));

  if (!typeMatch) {
    errors.push(
      `Bond type incorrect — detected ${detectedType}, expected ${targetType}. ` +
      `Check electronegativity difference (Δχ).`
    );
    return { pass: false, errors };
  }

  /* ---- 3. Geometry check (only for polyatomic molecules) ---- */
  if (challenge.bondAngle !== null && placedAtoms.length === 3) {
    const positions = placedAtoms.map(a => a.atom3d.group.position.clone());

    // find the central atom (first one in atoms array)
    const centralSym   = challenge.atoms[0];
    const centralIdx   = placedAtoms.findIndex(a => a.element.symbol === centralSym);
    const otherIndices = placedAtoms.map((_, i) => i).filter(i => i !== centralIdx);

    if (otherIndices.length === 2) {
      const centre = positions[centralIdx];
      const v1     = positions[otherIndices[0]].clone().sub(centre).normalize();
      const v2     = positions[otherIndices[1]].clone().sub(centre).normalize();
      const angle  = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))));
      const diff   = Math.abs(angle - challenge.bondAngle);

      if (diff > challenge.angleTolerance) {
        errors.push(
          `Bond angle is ${angle.toFixed(1)}° — target is ${challenge.bondAngle}°. ` +
          `${angle < challenge.bondAngle ? 'Spread the atoms further apart.' : 'Bring the atoms closer together.'}`
        );
        return { pass: false, errors };
      }
    }
  }

  return { pass: true, errors: [] };
}

/* =========================================================
   FEEDBACK ANIMATIONS
   celebrateSuccess(scene, position) — particle burst
   shakeGroup(group)                 — wrong geometry shake
   explodeAtoms(atoms, scene)        — wrong atoms red flash + bounce
   ========================================================= */

export function celebrateSuccess(scene, centrePosition) {
  const particles = [];
  const colors    = [0x5eead4, 0xfbbf24, 0xab5cf2, 0x1ff01f, 0xff3333, 0xffffff];
  const count     = 48;

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.1 + Math.random() * 0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true,
      opacity: 1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(centrePosition);

    // random outward velocity
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );
    scene.add(mesh);
    particles.push({ mesh, vel, life: 1.0 });
  }

  const clock = { last: performance.now() };

  function animParticles() {
    const now = performance.now();
    const dt  = Math.min((now - clock.last) / 1000, 0.05);
    clock.last = now;

    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.life -= dt * 0.9;
      p.vel.y     -= dt * 6; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life);
      p.mesh.scale.setScalar(Math.max(0.1, p.life));
    });

    if (alive) {
      requestAnimationFrame(animParticles);
    } else {
      particles.forEach(p => scene.remove(p.mesh));
    }
  }
  requestAnimationFrame(animParticles);
}

export function shakeGroup(group, onDone) {
  const origin = group.position.clone();
  const duration = 500;
  const t0 = performance.now();
  const intensity = 0.3;

  function step() {
    const t = Math.min((performance.now() - t0) / duration, 1);
    if (t < 1) {
      const decay = 1 - t;
      group.position.x = origin.x + Math.sin(t * Math.PI * 8) * intensity * decay;
      group.position.y = origin.y + Math.sin(t * Math.PI * 6) * intensity * decay * 0.5;
      requestAnimationFrame(step);
    } else {
      group.position.copy(origin);
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(step);
}

export function flashRed(atoms, scene, onDone) {
  const origColors = atoms.map(a => ({
    mesh: a.atom3d.nucleus,
    color: a.atom3d.nucleus.material.color.clone()
  }));

  const red = new THREE.Color(0xff2222);
  origColors.forEach(o => o.mesh.material.color.copy(red));
  origColors.forEach(o => o.mesh.material.emissive.copy(red));

  setTimeout(() => {
    origColors.forEach(o => {
      o.mesh.material.color.copy(o.color);
      o.mesh.material.emissive.copy(o.color);
    });
    if (onDone) onDone();
  }, 420);
}

/* =========================================================
   QUIZ SESSION
   Tracks score, attempts, and streak. Persists to localStorage.
   ========================================================= */
export class QuizSession {
  constructor() {
    this.sessionScore  = 0;
    this.totalAnswered = 0;
    this.streak        = 0;
    this.bestStreak    = 0;
    this.attempts      = 0; // attempts on current question
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('qb-session') || '{}');
      this.bestStreak = saved.bestStreak ?? 0;
    } catch {}
  }

  save() {
    try {
      localStorage.setItem('qb-session', JSON.stringify({ bestStreak: this.bestStreak }));
    } catch {}
  }

  /* Call when a question is answered correctly */
  correct() {
    const stars = this.attempts === 0 ? 3 : this.attempts === 1 ? 2 : 1;
    this.sessionScore  += stars;
    this.totalAnswered += 1;
    this.streak        += 1;
    this.attempts       = 0;
    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
      this.save();
    }
    return stars;
  }

  /* Call on each wrong attempt */
  wrong() {
    this.attempts += 1;
    this.streak    = 0;
    return this.attempts;
  }

  /* Reset for a new question */
  nextQuestion() {
    this.attempts = 0;
  }

  get accuracy() {
    if (this.totalAnswered === 0) return 100;
    return Math.round((this.totalAnswered / (this.totalAnswered + this.attempts)) * 100);
  }
}
