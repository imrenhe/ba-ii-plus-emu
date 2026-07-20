// display.js — renders the two-line LCD from calculator state.

export function createDisplay(root, calc) {
  root.innerHTML = `
    <div class="lcd">
      <div class="lcd-flags">
        <span class="flag flag-2nd">2ND</span>
        <span class="flag flag-bgn">BGN</span>
        <span class="flag flag-cpt">CPT</span>
        <span class="flag flag-msg"></span>
      </div>
      <div class="lcd-label" aria-hidden="true"></div>
      <div class="lcd-value" role="status" aria-live="polite"></div>
    </div>`;

  const labelEl = root.querySelector('.lcd-label');
  const valueEl = root.querySelector('.lcd-value');
  const flag2nd = root.querySelector('.flag-2nd');
  const flagBgn = root.querySelector('.flag-bgn');
  const flagCpt = root.querySelector('.flag-cpt');
  const flagMsg = root.querySelector('.flag-msg');

  function render() {
    const d = calc.getDisplay();
    labelEl.textContent = d.label || ' ';
    valueEl.textContent = d.value;
    valueEl.classList.toggle('is-error', d.value === 'Error');
    flag2nd.classList.toggle('on', d.flags.second);
    flagBgn.classList.toggle('on', d.flags.begin);
    flagCpt.classList.toggle('on', d.flags.compute);
    flagMsg.textContent = d.flags.message || '';
  }

  calc.onChange(render);
  render();
  return render;
}
