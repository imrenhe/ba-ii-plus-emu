// display.js — renders the LCD: an indicator strip plus the main line showing
// the active field label (left) and its value (right), mirroring the device.

export function createDisplay(root, calc) {
  root.innerHTML = `
    <div class="lcd">
      <div class="lcd-flags">
        <span class="flag" data-f="second">2ND</span>
        <span class="flag" data-f="inverse">INV</span>
        <span class="flag" data-f="hyp">HYP</span>
        <span class="flag" data-f="compute">CPT</span>
        <span class="flag flag-ws" data-f="ws"></span>
        <span class="flag flag-spacer"></span>
        <span class="flag" data-f="enter">ENTER</span>
        <span class="flag" data-f="nav">↓↑</span>
        <span class="flag" data-f="set">SET</span>
        <span class="flag" data-f="begin">BGN</span>
        <span class="flag" data-f="rad">RAD</span>
      </div>
      <div class="lcd-line">
        <span class="lcd-label"></span>
        <span class="lcd-value" role="status" aria-live="polite"></span>
      </div>
    </div>`;

  const labelEl = root.querySelector('.lcd-label');
  const valueEl = root.querySelector('.lcd-value');
  const flagEls = [...root.querySelectorAll('.flag[data-f]')];

  function render() {
    const d = calc.getDisplay();
    labelEl.textContent = d.label ? d.label + (isSetting(d) ? '' : ' =') : '';
    valueEl.textContent = d.value;
    valueEl.classList.toggle('is-error', d.value === 'Error');
    for (const el of flagEls) {
      const f = el.dataset.f;
      if (f === 'ws') { el.textContent = d.flags.worksheet || ''; el.classList.toggle('on', !!d.flags.worksheet); }
      else el.classList.toggle('on', !!d.flags[f]);
    }
  }

  // A setting/label like "END/BGN" shouldn't show "= value"; heuristic: value is non-numeric.
  function isSetting(d) {
    return d.flags.set;
  }

  calc.onChange(render);
  render();
  return render;
}
