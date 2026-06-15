/* =========================================================
   QUANTUM BOND — CORE / ELEMENTS
   Pure data table. Adding a new element = adding an entry
   here. Nothing else needs to change for an element to be
   usable by buildAtom() in atom.js.

   shells:        electron configuration per shell (K, L, M, N...)
   atomicRadiusPm: neutral-atom radius, used to scale the nucleus
   color:         CPK standard color (hex)
   cation / anion: optional ion data for elements that commonly
                   form that ion in the bonds we're modeling.
                   chargeLabel is the display string (e.g. '+1').
   ========================================================= */

export const ELEMENTS = {
  H: {
    symbol: 'H', name: 'Hydrogen', protons: 1,
    shells: [1],
    atomicRadiusPm: 53,
    color: 0xffffff, // CPK white
    anion: {
      shells: [2],
      ionicRadiusPm: 150,
      color: 0xeaeaff,
      chargeLabel: '\u22121' // minus 1
    }
  },

  C: {
    symbol: 'C', name: 'Carbon', protons: 6,
    shells: [2, 4],
    atomicRadiusPm: 70,
    color: 0x909090 // CPK gray
  },

  O: {
    symbol: 'O', name: 'Oxygen', protons: 8,
    shells: [2, 6],
    atomicRadiusPm: 60,
    color: 0xff3333, // CPK red
    anion: {
      shells: [2, 8],
      ionicRadiusPm: 140,
      color: 0xff6666,
      chargeLabel: '\u22122'
    }
  },

  Na: {
    symbol: 'Na', name: 'Sodium', protons: 11,
    shells: [2, 8, 1],
    atomicRadiusPm: 186,
    color: 0xab5cf2, // CPK violet
    cation: {
      shells: [2, 8],
      ionicRadiusPm: 102,
      color: 0xc792ff,
      chargeLabel: '+1'
    }
  },

  Mg: {
    symbol: 'Mg', name: 'Magnesium', protons: 12,
    shells: [2, 8, 2],
    atomicRadiusPm: 160,
    color: 0x33cc33, // CPK dark green
    cation: {
      shells: [2, 8],
      ionicRadiusPm: 72,
      color: 0x66ff66,
      chargeLabel: '+2'
    }
  },

  Cl: {
    symbol: 'Cl', name: 'Chlorine', protons: 17,
    shells: [2, 8, 7],
    atomicRadiusPm: 99,
    color: 0x1ff01f, // CPK green
    anion: {
      shells: [2, 8, 8],
      ionicRadiusPm: 181,
      color: 0x6dff6d,
      chargeLabel: '\u22121'
    }
  },

  Fe: {
    symbol: 'Fe', name: 'Iron', protons: 26,
    shells: [2, 8, 14, 2],
    atomicRadiusPm: 126,
    color: 0xe06633, // CPK orange-brown
    cation: {
      shells: [2, 8, 14],
      ionicRadiusPm: 78,
      color: 0xff9966,
      chargeLabel: '+2'
    }
  },

  Cu: {
    symbol: 'Cu', name: 'Copper', protons: 29,
    shells: [2, 8, 18, 1],
    atomicRadiusPm: 128,
    color: 0xc88033, // CPK copper
    cation: {
      shells: [2, 8, 18],
      ionicRadiusPm: 96,
      color: 0xffa552,
      chargeLabel: '+1'
    }
  }
};

// Reference radius: an atom with atomicRadiusPm == REFERENCE_PM
// renders at scale 1.0. Sodium (186pm) is the largest atom we
// currently model, so it sets the reference.
export const REFERENCE_PM = 186;
