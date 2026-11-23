// This demo is local: no network or hardware access.
const toggle = document.querySelector('#toggle');
toggle.onclick = () => {
  const visible = document.body.classList.toggle('show-limit');
  toggle.textContent = visible ? 'Hide threshold' : 'Show threshold';
  toggle.setAttribute('aria-pressed', String(visible));
};
