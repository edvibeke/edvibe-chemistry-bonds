/* =========================================================
   QUANTUM BOND — CORE / UI
   Helpers for the readout panel and control dock that
   every phase reuses. Expects the markup IDs defined in
   each phase's index.html (#symbol, #chargeSup, etc.)

   If a future phase needs new panel widgets (timeline
   scrubber, sliders, quiz overlay), give those their own
   file (e.g. controls.js) rather than growing this one.
   ========================================================= */

import { SHELL_LABELS } from './atom.js';

/** Initialize lucide icons. Call after any DOM change that adds <i data-lucide>. */
export function initIcons() {
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Build the shell-configuration pills inside a wrapper element,
 * based on an element's neutral shell config.
 */
export function buildShellPills(element, wrapEl) {
  wrapEl.innerHTML = '';
  element.shells.forEach((count, i) => {
    const pill = document.createElement('div');
    pill.className = 'shell-pill';
    pill.dataset.shellIndex = i;
    pill.innerHTML = `${SHELL_LABELS[i]} <span class="count">${count}</span>`;
    wrapEl.appendChild(pill);
  });
}

/**
 * Update the readout panel to reflect an atom's current state.
 * refs: { symbol, chargeSup, configName, electronsValue, chargeValue, radiusValue, shellsWrap }
 */
export function updateReadout(atom, refs) {
  const el = atom.element;
  const { symbol, chargeSup, configName, electronsValue, chargeValue, radiusValue, shellsWrap } = refs;

  const totalElectrons = el.shells.reduce((a, b) => a + b, 0);

  if (atom.isIonized) {
    const ion = atom.ionDirection === 'cation' ? el.cation : el.anion;
    const delta = atom.ionDirection === 'cation' ? -1 : +1;

    symbol.classList.add('charged');
    chargeSup.classList.add('visible');
    chargeSup.textContent = ion.chargeLabel;

    configName.textContent = atom.ionDirection === 'cation'
      ? `${el.name} \u00b7 cation (lost 1 electron)`
      : `${el.name} \u00b7 anion (gained 1 electron)`;

    electronsValue.textContent = String(totalElectrons + delta);
    electronsValue.classList.toggle('electron', delta > 0);

    chargeValue.textContent = ion.chargeLabel;
    chargeValue.classList.add('charged');

    radiusValue.textContent = `${ion.ionicRadiusPm} pm`;
  } else {
    symbol.classList.remove('charged');
    chargeSup.classList.remove('visible');
    configName.textContent = `${el.name} \u00b7 neutral atom`;
    electronsValue.textContent = String(totalElectrons);
    electronsValue.classList.add('electron');
    chargeValue.textContent = '0';
    chargeValue.classList.remove('charged');
    radiusValue.textContent = `${el.atomicRadiusPm} pm`;
  }

  symbol.textContent = el.symbol;

  // shell pill counts
  if (shellsWrap) {
    el.shells.forEach((count, i) => {
      const pill = shellsWrap.querySelector(`[data-shell-index="${i}"]`);
      if (!pill) return;
      const shell = atom.shellGroups[i];
      const current = shell.electrons.length;
      const isDepleted = atom.isIonized && current < count;
      const isEnriched = atom.isIonized && current > count;
      pill.classList.toggle('depleted', isDepleted);
      pill.querySelector('.count').textContent = String(current);
      pill.querySelector('.count').style.color = isEnriched ? 'var(--accent)' : '';
    });
  }
}

/** Toggle the active state + icon/label on the Bohr/Cloud mode dock button. */
export function applyModeButton(cloudMode, btn) {
  btn.classList.toggle('active', !cloudMode);
  const label = btn.querySelector('.label');
  if (label) label.textContent = cloudMode ? 'Electron cloud' : 'Bohr shells';

  const icon = btn.querySelector('svg, i');
  if (icon) {
    icon.outerHTML = cloudMode
      ? '<i data-lucide="cloud"></i>'
      : '<i data-lucide="orbit"></i>';
  }
  initIcons();
}

export function setHintVisible(hintEl, visible) {
  hintEl.classList.toggle('hidden', !visible);
}
