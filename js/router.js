// Router layar sederhana: tiap layar = fungsi mount(root, params) yang mengembalikan fungsi cleanup
const registry = {};
const listeners = new Set();
let cleanup = null;
let currentName = null;

export function register(name, mountFn) {
  registry[name] = mountFn;
}

export function go(name, params = {}) {
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  const root = document.getElementById("screen");
  root.innerHTML = "";
  root.className = "screen-" + name;
  root.scrollTop = 0;
  document.body.dataset.screen = name;
  document.body.removeAttribute("data-immersive");
  currentName = name;
  cleanup = registry[name](root, params) || null;
  listeners.forEach((fn) => fn(name));
}

export const currentScreen = () => currentName;
export const onRoute = (fn) => listeners.add(fn);

/** Kumpulan fungsi pembersih untuk satu layar */
export function bag() {
  const fns = [];
  return {
    add(fn) { if (fn) fns.push(fn); return fn; },
    run() { while (fns.length) { try { fns.pop()(); } catch (e) { console.error(e); } } },
  };
}
