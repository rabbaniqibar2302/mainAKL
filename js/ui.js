// Utilitas UI kecil yang dipakai semua layar
import { sfx } from "./sfx.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const nf = new Intl.NumberFormat("id-ID");
export const num = (n) => nf.format(n);
export const rp = (n) => "Rp" + nf.format(n);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const rand = (min, max) => min + Math.random() * (max - min);

/** Pengambil acak tanpa pengulangan sampai semua item terpakai */
export function deck(items) {
  let pool = [];
  return {
    next() {
      if (!pool.length) pool = shuffle(items);
      return pool.pop();
    },
  };
}

/** Tampilan kamera di belakang: 'full' (jelas) | 'soft' | 'dim' (redup) */
export const setCam = (mode) => (document.body.dataset.cam = mode);
/** Sembunyikan bar atas (untuk mode LIVE layar penuh) */
export const setImmersive = (on) => document.body.toggleAttribute("data-immersive", !!on);

export function toast(msg, ms = 2600) {
  const root = $("#toast-root");
  const t = el(`<div class="toast">${msg}</div>`);
  root.appendChild(t);
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Modal sederhana. actions: [{label, kind:'primary'|'ghost'|'danger', onClick(close) → false utk tetap buka}] */
export function openModal({ title, body, actions = [], wide = false, onClose }) {
  const root = $("#modal-root");
  const back = el(`
    <div class="modal-back">
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-x title="Tutup">✕</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>
    </div>`);
  const bodyEl = $(".modal-body", back);
  if (typeof body === "string") bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  const foot = $(".modal-foot", back);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    removeEventListener("keydown", onKey, true);
    back.classList.add("out");
    setTimeout(() => back.remove(), 200);
    onClose?.();
  };
  actions.forEach((a) => {
    const b = el(`<button class="btn ${a.kind || "ghost"}">${a.label}</button>`);
    b.onclick = () => { if (a.onClick?.(close, bodyEl) !== false) close(); };
    foot.appendChild(b);
  });
  if (!actions.length) foot.remove();
  $("[data-x]", back).onclick = close;
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  addEventListener("keydown", onKey, true);
  root.appendChild(back);
  return { close, body: bodyEl };
}

export function confirmBox(title, message, yesLabel = "Ya", kind = "danger") {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title, body: `<p class="lead">${message}</p>`,
      actions: [
        { label: "Batal", kind: "ghost", onClick: () => { answered = true; resolve(false); } },
        { label: yesLabel, kind, onClick: () => { answered = true; resolve(true); } },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

/** Timer mundur. onTick(sisaMs), onEnd(). Bunyi tik di 5 detik terakhir. */
export function createTimer(ms, { onTick, onEnd, tick = true } = {}) {
  const end = performance.now() + ms;
  let lastSec = Math.ceil(ms / 1000);
  let stopped = false;
  const id = setInterval(() => {
    if (stopped) return;
    const left = Math.max(0, end - performance.now());
    const sec = Math.ceil(left / 1000);
    if (tick && sec !== lastSec && sec <= 5 && sec > 0) sfx.tick();
    lastSec = sec;
    onTick?.(left);
    if (left <= 0) { stop(); onEnd?.(); }
  }, 100);
  function stop() { stopped = true; clearInterval(id); }
  onTick?.(ms);
  return { stop };
}

/** Shortcut keyboard; return fungsi untuk melepas */
export function keys(map) {
  const h = (e) => {
    if (e.target.closest?.("input, select, textarea") || $("#modal-root").children.length) return;
    const fn = map[e.key] ?? map[e.code];
    if (fn) { e.preventDefault(); fn(e); }
  };
  addEventListener("keydown", h);
  return () => removeEventListener("keydown", h);
}

/** Hitung mundur besar 3-2-1 di tengah layar */
export function bigCountdown(from = 3, final = "MULAI!") {
  return new Promise((resolve) => {
    const ov = el(`<div class="countdown"><span></span></div>`);
    document.body.appendChild(ov);
    const span = ov.firstElementChild;
    let n = from;
    const step = () => {
      span.textContent = n > 0 ? n : final;
      span.classList.remove("pop"); void span.offsetWidth; span.classList.add("pop");
      n > 0 ? sfx.count() : sfx.go();
      if (n-- <= 0) { setTimeout(() => { ov.remove(); resolve(); }, 650); return; }
      setTimeout(step, 850);
    };
    step();
  });
}

/** Spanduk singkat di tengah layar */
export function banner(html, color = "var(--yellow)", ms = 1700) {
  const b = el(`<div class="banner" style="--c:${color}">${html}</div>`);
  document.body.appendChild(b);
  setTimeout(() => b.classList.add("out"), ms);
  setTimeout(() => b.remove(), ms + 400);
}

export function confetti(colors = ["#ffd23f", "#ff4d8d", "#22d3ee", "#22c55e", "#a855f7"], count = 90) {
  const wrap = el(`<div class="confetti"></div>`);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.left = rand(0, 100) + "vw";
    p.style.background = pick(colors);
    p.style.setProperty("--dx", rand(-18, 18) + "vw");
    p.style.setProperty("--rot", rand(-720, 720) + "deg");
    p.style.animationDuration = rand(1.6, 3.2) + "s";
    p.style.animationDelay = rand(0, 0.35) + "s";
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3800);
}

export function flash() {
  const f = el(`<div class="flash"></div>`);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

export const fmtClock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Hex → rgba */
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Tombol pilihan tunggal (segmented) */
export function segHTML(field, options, value) {
  return `<div class="seg" data-field="${field}">${options
    .map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(value)}">${label}</button>`)
    .join("")}</div>`;
}
