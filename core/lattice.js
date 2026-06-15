/* =========================================================
   QUANTUM BOND — CORE / LATTICE
   NaCl crystal using InstancedMesh — one draw call per ion type.
   
   Architecture:
   - Na⁺ and Cl⁻ each get their own InstancedMesh
   - Positions generated on-the-fly for any cube size (3..7)
   - Assembly animates ions appearing from centre outward
   - Cross-section uses THREE.ClippingPlanes
   - Raycaster returns which ion was clicked
   - Highlight uses a second glowing mesh overlay
   ========================================================= */

import * as THREE from 'three';

// CPK-inspired colors
const COLORS = {
  NA: 0xab5cf2,  // purple for Na⁺
  CL: 0x1ff01f   // bright green for Cl⁻
};

// Ion radii (visual size, not scientific scale — for clarity)
const RADII = {
  NA: 0.32,
  CL: 0.38
};

// NaCl lattice constant (visual spacing)
const LATTICE_STEP = 1.05;

/**
 * Generate all ion positions for a cubic NaCl lattice
 * Returns: { naPositions: Vector3[], clPositions: Vector3[] }
 * 
 * NaCl structure:
 * - Na⁺ at integer coordinates where (x+y+z) is EVEN
 * - Cl⁻ at integer coordinates where (x+y+z) is ODD
 * Range: from -half to +half (centred at origin)
 */
function generateLatticePositions(size) {
  const naPositions = [];
  const clPositions = [];
  const offset = (size - 1) / 2;  // centre the cube
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        const x = (i - offset) * LATTICE_STEP;
        const y = (j - offset) * LATTICE_STEP;
        const z = (k - offset) * LATTICE_STEP;
        const parity = (i + j + k) & 1;
        
        if (parity === 0) {
          naPositions.push(new THREE.Vector3(x, y, z));
        } else {
          clPositions.push(new THREE.Vector3(x, y, z));
        }
      }
    }
  }
  
  return { naPositions, clPositions };
}

/**
 * Create an InstancedMesh for a set of positions
 */
function createInstancedMesh(positions, color, radius, scene) {
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  
  const count = positions.length;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  
  const dummyMatrix = new THREE.Matrix4();
  const dummyPosition = new THREE.Vector3();
  
  for (let i = 0; i < count; i++) {
    dummyPosition.copy(positions[i]);
    dummyMatrix.compose(dummyPosition, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, dummyMatrix);
  }
  
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  scene.add(mesh);
  
  return mesh;
}

/**
 * Create highlight overlay mesh for a picked ion
 */
function createHighlightMesh(scene) {
  const geometry = new THREE.SphereGeometry(0.45, 32, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    transparent: true,
    opacity: 0.6,
    side: THREE.BackSide
  });
  const highlight = new THREE.Mesh(geometry, material);
  highlight.visible = false;
  scene.add(highlight);
  return highlight;
}

/**
 * Main Lattice class
 */
export class IonicLattice {
  constructor(scene, renderer, options = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.currentSize = options.size || 3;
    this.isAssembled = false;
    this.isAssembling = false;
    this.currentHighlight = null;
    this.clipPlanes = [];
    
    // Will hold our InstancedMeshes
    this.naMesh = null;
    this.clMesh = null;
    this.naPositions = [];
    this.clPositions = [];
    
    // Highlight overlay
this.highlightMesh = createHighlightMesh(this.group);
    
    // Group for rotation (whole lattice rotates together)
    this.group = new THREE.Group();
    scene.add(this.group);
    
    // Callback when assembly finishes
    this.onAssembledCallback = options.onAssembled || (() => {});
    
    // Build the lattice
    this.build();
  }
  
  /**
   * Build or rebuild the entire lattice
   */
  build() {
    this.isAssembling = true;
    this.isAssembled = false;
    
    // Clear existing meshes from group
    if (this.naMesh) this.group.remove(this.naMesh);
    if (this.clMesh) this.group.remove(this.clMesh);
    
    // Generate positions for current size
    const { naPositions, clPositions } = generateLatticePositions(this.currentSize);
    this.naPositions = naPositions;
    this.clPositions = clPositions;
    
    // Create InstancedMeshes
    this.naMesh = createInstancedMesh(naPositions, COLORS.NA, RADII.NA, this.group);
    this.clMesh = createInstancedMesh(clPositions, COLORS.CL, RADII.CL, this.group);
    
    // Store instance counts for raycasting
    this.naCount = naPositions.length;
    this.clCount = clPositions.length;
    
    // Initially hide all (for assembly animation)
    this.naMesh.visible = false;
    this.clMesh.visible = false;
    
    // Start centre-out assembly animation
    this.startAssemblyAnimation();
  }
  
  /**
   * Animate ions appearing from centre outward
   */
  startAssemblyAnimation() {
    const allPositions = [
      ...this.naPositions.map((p, idx) => ({ isNa: true, idx, pos: p })),
      ...this.clPositions.map((p, idx) => ({ isNa: false, idx, pos: p }))
    ];
    
    // Calculate distance from origin for each ion
    allPositions.forEach(ion => {
      ion.distSq = ion.pos.x * ion.pos.x + ion.pos.y * ion.pos.y + ion.pos.z * ion.pos.z;
    });
    
    // Sort by distance (nearest first)
    allPositions.sort((a, b) => a.distSq - b.distSq);
    
    let visibleCount = 0;
    const total = allPositions.length;
    const duration = 1800; // ms
    const startTime = performance.now();
    
    // Initially make meshes visible (they're empty, no instances visible yet)
    this.naMesh.visible = true;
    this.clMesh.visible = true;
    
    // Hide all instances first
    for (let i = 0; i < this.naCount; i++) {
      this.naMesh.setMatrixAt(i, new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0)));
    }
    for (let i = 0; i < this.clCount; i++) {
      this.clMesh.setMatrixAt(i, new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0)));
    }
    this.naMesh.instanceMatrix.needsUpdate = true;
    this.clMesh.instanceMatrix.needsUpdate = true;
    
    const animateAssembly = (now) => {
      const elapsed = now - startTime;
      let progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      progress = 1 - Math.pow(1 - progress, 3);
      
      const targetVisible = Math.floor(progress * total);
      
      for (let i = visibleCount; i < targetVisible && i < total; i++) {
        const ion = allPositions[i];
        const matrix = new THREE.Matrix4();
        const pos = ion.pos;
        matrix.compose(pos, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        
        if (ion.isNa) {
          this.naMesh.setMatrixAt(ion.idx, matrix);
        } else {
          this.clMesh.setMatrixAt(ion.idx, matrix);
        }
      }
      
      visibleCount = targetVisible;
      this.naMesh.instanceMatrix.needsUpdate = true;
      this.clMesh.instanceMatrix.needsUpdate = true;
      
      if (progress < 1) {
        requestAnimationFrame(animateAssembly);
      } else {
        // Ensure all matrices are set
        for (let i = 0; i < this.naCount; i++) {
          const matrix = new THREE.Matrix4();
          matrix.compose(this.naPositions[i], new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
          this.naMesh.setMatrixAt(i, matrix);
        }
        for (let i = 0; i < this.clCount; i++) {
          const matrix = new THREE.Matrix4();
          matrix.compose(this.clPositions[i], new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
          this.clMesh.setMatrixAt(i, matrix);
        }
        this.naMesh.instanceMatrix.needsUpdate = true;
        this.clMesh.instanceMatrix.needsUpdate = true;
        
        this.isAssembling = false;
        this.isAssembled = true;
        this.onAssembledCallback();
      }
    };
    
    requestAnimationFrame(animateAssembly);
  }
  
  /**
   * Set cross-section clipping plane (0 = none, 1 = full cut)
   * Uses THREE.ClippingPlanes with animation
   */
  setCrossSection(t) {
    // Remove existing clipping planes
    if (this.clipPlanes.length) {
      this.naMesh.material.clippingPlanes = null;
      this.clMesh.material.clippingPlanes = null;
      this.clipPlanes = [];
    }
    
    if (t <= 0.01) return;
    
    // Calculate plane position from centre outward
    // t=0.1 starts cutting from edge, t=1 cuts through centre
    const range = 4.5; // max extent of lattice (~5 steps * 1.05 / 2)
    const planeZ = -range + (t * range * 2);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), planeZ);
    this.clipPlanes = [plane];
    
    this.naMesh.material.clippingPlanes = this.clipPlanes;
    this.clMesh.material.clippingPlanes = this.clipPlanes;
    
    // Need to recompile material to enable clipping
    this.naMesh.material.needsUpdate = true;
    this.clMesh.material.needsUpdate = true;
  }
  
  /**
   * Raycast to find which ion was clicked
   * Returns: { isNa, index, position } or null
   */
  pickIon(raycaster) {
    if (!this.isAssembled) return null;
    
    const intersectsNa = [];
    const intersectsCl = [];
    
    if (this.naMesh.visible) {
      raycaster.intersectObject(this.naMesh, true, intersectsNa);
    }
    if (this.clMesh.visible) {
      raycaster.intersectObject(this.clMesh, true, intersectsCl);
    }
    
    const allIntersects = [...intersectsNa, ...intersectsCl];
    if (allIntersects.length === 0) return null;
    
    // Find closest intersection
    allIntersects.sort((a, b) => a.distance - b.distance);
    const hit = allIntersects[0];
    
    // Need to get instance index from the intersected object
    const isNa = hit.object === this.naMesh;
    let instanceIndex = -1;
    
    if (hit.instanceId !== undefined) {
      instanceIndex = hit.instanceId;
    } else if (hit.instanceIndex !== undefined) {
      instanceIndex = hit.instanceIndex;
    }
    
    if (instanceIndex === -1) return null;
    
    const position = isNa 
      ? this.naPositions[instanceIndex]?.clone()
      : this.clPositions[instanceIndex]?.clone();
    
    if (!position) return null;
    
    // Transform by group rotation

    
    return {
      isNa: isNa,
      index: instanceIndex,
      position: position,
      worldPosition: hit.point
    };
  }
  
  /**
   * Highlight a specific ion (or remove highlight if null)
   */
  highlight(ion) {
    if (!ion) {
      this.highlightMesh.visible = false;
      this.currentHighlight = null;
      return;
    }
    
    this.currentHighlight = ion;
    this.highlightMesh.position.copy(ion.position);
    this.highlightMesh.visible = true;
  }
  
  /**
   * Resize the lattice to a new cube size (odd number recommended)
   */
  resize(newSize, callback) {
    if (this.isAssembling) return;
    if (newSize === this.currentSize) {
      if (callback) callback();
      return;
    }
    
    this.currentSize = newSize;
    this.onAssembledCallback = callback || (() => {});
    this.build();
  }
  
  /**
   * Clean up resources (call when destroying component)
   */
  dispose() {
    if (this.naMesh) {
      this.naMesh.geometry.dispose();
      this.naMesh.material.dispose();
      this.group.remove(this.naMesh);
    }
    if (this.clMesh) {
      this.clMesh.geometry.dispose();
      this.clMesh.material.dispose();
      this.group.remove(this.clMesh);
    }
    if (this.highlightMesh) {
      this.highlightMesh.geometry.dispose();
      this.highlightMesh.material.dispose();
      this.scene.remove(this.highlightMesh);
    }
    this.scene.remove(this.group);
  }
}

/**
 * Factory function for simpler usage (matches your HTML pattern)
 */
export function buildLattice(scene, renderer, options) {
  return new IonicLattice(scene, renderer, options);
}
