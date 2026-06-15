/* =========================================================
   QUANTUM BOND — CORE / METALLIC
   Copper metallic bond simulation.

   Architecture:
   - Cu+ fixed ions via InstancedMesh (one draw call)
   - Electron sea via THREE.Points (particle drift)
   - Shader glow mode via custom ShaderMaterial sphere
   - Toggle between particle and shader mode smoothly
   - Temperature slider -> controls drift speed
   - Current flow toggle -> adds directional bias
   - Cross-section clipping plane (same pattern as lattice.js)
   - Raycaster ion picking + highlight overlay
   ========================================================= */

import * as THREE from 'three';

const CU_COLOR       = 0xe8840a;
const CU_RADIUS      = 0.38;
const LATTICE_STEP   = 1.15;
const ELECTRON_COLOR = 0x5eead4;
const ELECTRON_COUNT = 1800;

const VERT_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_SHADER = `
  uniform float uTime;
  uniform float uTemperature;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    float rim   = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float pulse = 0.5 + 0.5 * sin(uTime * (1.5 + uTemperature * 2.0) + vPosition.x * 2.0);
    vec3  cold  = vec3(0.12, 0.60, 0.80);
    vec3  hot   = vec3(0.95, 0.55, 0.05);
    vec3  col   = mix(cold, hot, uTemperature * 0.6);
    float alpha = rim * rim * (0.35 + 0.25 * pulse);
    gl_FragColor = vec4(col, alpha);
  }
`;

function generateCopperPositions(size) {
  const positions = [];
  const offset    = (size - 1) / 2;
  const basis     = [[0,0,0],[0.5,0.5,0],[0.5,0,0.5],[0,0.5,0.5]];

  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++)
      for (let k = 0; k < size; k++)
        basis.forEach(([bx,by,bz]) => positions.push(new THREE.Vector3(
          (i+bx-offset)*LATTICE_STEP,
          (j+by-offset)*LATTICE_STEP,
          (k+bz-offset)*LATTICE_STEP
        )));

  const unique = [], seen = new Set();
  positions.forEach(p => {
    const key = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    if (!seen.has(key)) { seen.add(key); unique.push(p); }
  });
  return unique;
}

function createCopperMesh(positions, parent) {
  const geo  = new THREE.SphereGeometry(CU_RADIUS, 28, 28);
  const mat  = new THREE.MeshStandardMaterial({
    color: CU_COLOR, roughness: 0.25, metalness: 0.92,
    emissive: new THREE.Color(0x3a1800), emissiveIntensity: 0.3,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  const zero = new THREE.Matrix4().scale(new THREE.Vector3(0,0,0));
  for (let i = 0; i < positions.length; i++) mesh.setMatrixAt(i, zero);
  mesh.instanceMatrix.needsUpdate = true;
  parent.add(mesh);
  return mesh;
}

function createElectronParticles(latticeRadius, parent) {
  const geo        = new THREE.BufferGeometry();
  const positions  = new Float32Array(ELECTRON_COUNT * 3);
  const velocities = [];
  const r          = latticeRadius * 0.92;

  for (let i = 0; i < ELECTRON_COUNT; i++) {
    let x, y, z, d;
    do {
      x = (Math.random()-0.5)*2*r;
      y = (Math.random()-0.5)*2*r;
      z = (Math.random()-0.5)*2*r;
      d = Math.sqrt(x*x+y*y+z*z);
    } while (d > r);
    positions[i*3]=x; positions[i*3+1]=y; positions[i*3+2]=z;
    velocities.push((Math.random()-0.5)*0.012,(Math.random()-0.5)*0.012,(Math.random()-0.5)*0.012);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: ELECTRON_COLOR, size: 0.055, sizeAttenuation: true,
    transparent: true, opacity: 0.85, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  parent.add(points);
  return { points, velocities, radius: r };
}

function createElectronShader(latticeRadius, parent) {
  const geo = new THREE.SphereGeometry(latticeRadius*0.95, 64, 64);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT_SHADER, fragmentShader: FRAG_SHADER,
    uniforms: { uTime: { value:0 }, uTemperature: { value:0.2 } },
    transparent: true, side: THREE.FrontSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

function createHighlight(parent) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(CU_RADIUS+0.12, 28, 28),
    new THREE.MeshBasicMaterial({ color:0xffcc44, transparent:true, opacity:0.55, side:THREE.BackSide })
  );
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

export class MetallicLattice {
  constructor(scene, renderer, options = {}) {
    this.scene       = scene;
    this.renderer    = renderer;
    this.currentSize = options.size || 3;
    this.isAssembled  = false;
    this.isAssembling = false;
    this.temperature  = 0.2;
    this.currentFlow  = false;
    this.shaderMode   = false;
    this.onAssembledCallback = options.onAssembled || (() => {});

    this.group = new THREE.Group();
    scene.add(this.group);

    this.cuMesh       = null;
    this.cuPositions  = [];
    this.electronData = null;
    this.shaderMesh   = null;
    this.highlightMesh = createHighlight(this.group);

    this.renderer.localClippingEnabled = true;
    this.build();
  }

  build() {
    this.isAssembling = true;
    this.isAssembled  = false;

    if (this.cuMesh)      { this.group.remove(this.cuMesh);   this.cuMesh.geometry.dispose();   this.cuMesh.material.dispose(); }
    if (this.electronData){ this.group.remove(this.electronData.points); this.electronData.points.geometry.dispose(); this.electronData.points.material.dispose(); }
    if (this.shaderMesh)  { this.group.remove(this.shaderMesh); this.shaderMesh.geometry.dispose(); this.shaderMesh.material.dispose(); }

    this.cuPositions = generateCopperPositions(this.currentSize);

    let maxR = 0;
    this.cuPositions.forEach(p => { const r = p.length(); if (r > maxR) maxR = r; });
    const latticeRadius = maxR + LATTICE_STEP;

    this.cuMesh       = createCopperMesh(this.cuPositions, this.group);
    this.electronData = createElectronParticles(latticeRadius, this.group);
    this.shaderMesh   = createElectronShader(latticeRadius, this.group);

    this.electronData.points.visible = !this.shaderMode;
    this.shaderMesh.visible          =  this.shaderMode;

    this._startAssembly();
  }

  _startAssembly() {
    const sorted = this.cuPositions
      .map((p, i) => ({ idx:i, pos:p, distSq:p.lengthSq() }))
      .sort((a,b) => a.distSq - b.distSq);

    const total     = sorted.length;
    const duration  = 1600;
    const startTime = performance.now();
    let   visible   = 0;

    const zero = new THREE.Matrix4().scale(new THREE.Vector3(0,0,0));
    for (let i = 0; i < total; i++) this.cuMesh.setMatrixAt(i, zero);
    this.cuMesh.instanceMatrix.needsUpdate = true;

    const tick = (now) => {
      let progress = Math.min(1, (now - startTime) / duration);
      progress = 1 - Math.pow(1 - progress, 3);
      const target = Math.floor(progress * total);

      for (let i = visible; i < target; i++) {
        const m = new THREE.Matrix4();
        m.compose(sorted[i].pos, new THREE.Quaternion(), new THREE.Vector3(1,1,1));
        this.cuMesh.setMatrixAt(sorted[i].idx, m);
      }
      visible = target;
      this.cuMesh.instanceMatrix.needsUpdate = true;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        for (let i = 0; i < total; i++) {
          const m = new THREE.Matrix4();
          m.compose(this.cuPositions[i], new THREE.Quaternion(), new THREE.Vector3(1,1,1));
          this.cuMesh.setMatrixAt(i, m);
        }
        this.cuMesh.instanceMatrix.needsUpdate = true;
        this.isAssembling = false;
        this.isAssembled  = true;
        this.onAssembledCallback();
      }
    };
    requestAnimationFrame(tick);
  }

  update(dt) {
    if (!this.isAssembled) return;

    const speed    = 0.008 + this.temperature * 0.04;
    const flowBias = this.currentFlow ? 0.006 : 0;

    if (this.shaderMesh.visible) {
      this.shaderMesh.material.uniforms.uTime.value        += dt;
      this.shaderMesh.material.uniforms.uTemperature.value  = this.temperature;
    }

    if (this.electronData.points.visible) {
      const posAttr = this.electronData.points.geometry.attributes.position;
      const vel     = this.electronData.velocities;
      const r       = this.electronData.radius;

      for (let i = 0; i < ELECTRON_COUNT; i++) {
        const i3 = i * 3;
        let x=posAttr.array[i3], y=posAttr.array[i3+1], z=posAttr.array[i3+2];
        let vx=vel[i3], vy=vel[i3+1], vz=vel[i3+2];

        vx += (Math.random()-0.5)*speed*0.1;
        vy += (Math.random()-0.5)*speed*0.1;
        vz += (Math.random()-0.5)*speed*0.1;
        vx -= flowBias;

        const vMag = Math.sqrt(vx*vx+vy*vy+vz*vz);
        if (vMag > speed) { vx=(vx/vMag)*speed; vy=(vy/vMag)*speed; vz=(vz/vMag)*speed; }

        x+=vx; y+=vy; z+=vz;
        const dist = Math.sqrt(x*x+y*y+z*z);
        if (dist > r) {
          const nx=x/dist, ny=y/dist, nz=z/dist;
          x=-nx*r*0.85+(Math.random()-0.5)*0.5;
          y=-ny*r*0.85+(Math.random()-0.5)*0.5;
          z=-nz*r*0.85+(Math.random()-0.5)*0.5;
          vx*=-0.5; vy*=-0.5; vz*=-0.5;
        }

        posAttr.array[i3]=x; posAttr.array[i3+1]=y; posAttr.array[i3+2]=z;
        vel[i3]=vx; vel[i3+1]=vy; vel[i3+2]=vz;
      }
      posAttr.needsUpdate = true;
    }

    if (this.temperature > 0.05) {
      const amp   = this.temperature * 0.018;
      const dummy = new THREE.Matrix4();
      for (let i = 0; i < this.cuPositions.length; i++) {
        const base = this.cuPositions[i];
        dummy.compose(
          new THREE.Vector3(
            base.x+(Math.random()-0.5)*amp,
            base.y+(Math.random()-0.5)*amp,
            base.z+(Math.random()-0.5)*amp
          ),
          new THREE.Quaternion(),
          new THREE.Vector3(1,1,1)
        );
        this.cuMesh.setMatrixAt(i, dummy);
      }
      this.cuMesh.instanceMatrix.needsUpdate = true;
    }
  }

  toggleMode() {
    this.shaderMode = !this.shaderMode;
    this.electronData.points.visible = !this.shaderMode;
    this.shaderMesh.visible          =  this.shaderMode;
    return this.shaderMode;
  }

  setTemperature(t) { this.temperature = t; }

  toggleCurrentFlow() {
    this.currentFlow = !this.currentFlow;
    return this.currentFlow;
  }

  setCrossSection(t) {
    const mats = [
      this.cuMesh.material,
      this.electronData.points.material,
      this.shaderMesh.material
    ];
    if (t <= 0.01) {
      mats.forEach(m => { m.clippingPlanes = []; m.needsUpdate = true; });
      return;
    }
    const range  = this.electronData.radius;
    const plane  = new THREE.Plane(new THREE.Vector3(0,0,1), -range + t * range * 2);
    mats.forEach(m => { m.clippingPlanes = [plane]; m.needsUpdate = true; });
  }

  pickIon(raycaster) {
    if (!this.isAssembled) return null;
    const hits = [];
    raycaster.intersectObject(this.cuMesh, true, hits);
    if (!hits.length) return null;
    hits.sort((a,b) => a.distance - b.distance);
    const idx = hits[0].instanceId ?? -1;
    if (idx === -1) return null;
    const pos = this.cuPositions[idx]?.clone();
    if (!pos) return null;
    return { index:idx, position:pos, worldPosition:hits[0].point };
  }

  highlight(ion) {
    if (!ion) { this.highlightMesh.visible = false; return; }
    this.highlightMesh.position.copy(ion.position);
    this.highlightMesh.visible = true;
  }

  resize(newSize, callback) {
    if (this.isAssembling) return;
    this.currentSize         = newSize;
    this.onAssembledCallback = callback || (() => {});
    this.build();
  }

  dispose() {
    [this.cuMesh, this.shaderMesh, this.highlightMesh].forEach(m => {
      if (!m) return;
      m.geometry?.dispose(); m.material?.dispose(); this.group.remove(m);
    });
    if (this.electronData) {
      this.electronData.points.geometry.dispose();
      this.electronData.points.material.dispose();
      this.group.remove(this.electronData.points);
    }
    this.scene.remove(this.group);
  }
}

export function buildMetallic(scene, renderer, options) {
  return new MetallicLattice(scene, renderer, options);
}
