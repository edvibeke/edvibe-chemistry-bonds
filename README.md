# 🧪 EdVibe Quantum Bond

## Interactive 3D Chemistry Lab

Learn atomic bonding through real-time 3D visualization. Built for students, trusted by teachers, works on any device — even offline.

**[🌐 Live Demo](https://edvibeke.github.io/quantum-bond/)** · [📖 Documentation](#) · [🐛 Report Issue](https://github.com/edvibeke/edvibe-chemistry-bonds/issues)

---

## 🎯 Overview

Textbook diagrams fail to capture the dynamic, 3D reality of atoms. Quantum Bond bridges the gap between abstract atomic theory and tangible visual experience.

Students can:
- Drag electrons between atoms
- Slice through crystal lattices
- Build molecules in a sandbox environment
- Learn at their own pace with timeline scrubbers

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🧂 NaCl Crystal Lattice** | InstancedMesh renders 125 ions in 2 draw calls. Cross-section slider reveals alternating pattern. Click any ion to identify. |
| **⚡ Ionic Bonding** | Electron transfer animation with scrubber timeline. Watch Na⁺ and Cl⁻ form. |
| **💧 Covalent Bonding** | Orbital overlap visualization. VSEPR shapes for H₂O, CH₄, CO₂. Dipole moment arrows. |
| **🔗 Metallic Bonding** | Sea of electrons simulation with temperature and current controls. |
| **🎮 Sandbox Mode** | Drag any element from periodic table. Engine auto-classifies bond type. |
| **📱 Mobile First** | Touch-friendly controls. Pinch-to-zoom, two-finger pan. Works on phones and tablets. |
| **📴 Offline Capable** | PWA with service worker. Download once, use anywhere — no internet required. |

---

## 🧬 Phase Completion Status

| Phase | Topic | Status |
|:-----:|-------|:------:|
| 1 | Single atom + electron cloud toggle | ✅ Complete |
| 2 | Ionic bonding (NaCl) | ✅ Complete |
| 3 | Covalent bonding (H₂O, CH₄) | ✅ Complete |
| 4 | NaCl crystal lattice with cross-section | ✅ Complete |
| 5 | Metallic bonding (sea of electrons) | ✅ Complete |
| 6 | Sandbox mode + periodic table drag-drop | ✅ Complete |
| 7 | PWA offline + service worker | 🔄 Coming Soon |
| 8 | Guided lessons + gamified quiz | 🔄 Coming Soon |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| 3D Rendering | Three.js (InstancedMesh) |
| Physics/Calculations | Web Workers |
| State Management | Zustand |
| Offline Capability | PWA (manifest.json + service worker) |
| Styling | CSS3 + Space Grotesk / IBM Plex Mono |

---

## 📁 Project Structure
