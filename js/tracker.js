// Pelacak tangan & gestur memakai MediaPipe Gesture Recognizer (berjalan 100% di browser).
// - Ujung jari telunjuk = "kursor" untuk menyentuh tombol di udara (elemen dengan atribut data-air)
// - Gestur 👍 👎 dikenali untuk mode Tebak Istilah
import { camera } from "./camera.js";
import { store } from "./store.js";

const BUNDLE = new URL("../vendor/mediapipe/vision_bundle.js", import.meta.url).href;
const WASM_DIR = new URL("../vendor/mediapipe/wasm", import.meta.url).href;
const MODEL = new URL("../vendor/mediapipe/gesture_recognizer.task", import.meta.url).href;

export const DWELL_MS = 1000; // lama jari harus menahan di tombol
export const GESTURE_EMOJI = {
  Thumb_Up: "👍", Thumb_Down: "👎", Victory: "✌️", Open_Palm: "✋",
  Closed_Fist: "✊", Pointing_Up: "☝️", ILoveYou: "🤟",
};

const statusListeners = new Set();
const frameListeners = new Set();

export const tracker = {
  status: "idle", // idle | loading | ready | error
  error: "",
  hands: [],
  recognizer: null,
  opts: { active: false, pointers: false, badges: false },
  suspended: 0, // > 0 = deteksi dijeda sementara (mis. saat hitung mundur 3-2-1)

  onStatus(fn) { statusListeners.add(fn); fn(this); return () => statusListeners.delete(fn); },
  /** fn(hands, dt) dipanggil tiap frame */
  onFrame(fn) { frameListeners.add(fn); return () => frameListeners.delete(fn); },
  /** Aktifkan pelacakan. pointers: tampilkan & pakai kursor jari. badges: tampilkan emoji gestur */
  use(opts = {}) { this.opts = { active: true, pointers: false, badges: false, ...opts }; },
  off() { this.opts = { active: false, pointers: false, badges: false }; this.hands = []; },

  setStatus(s, err = "") {
    this.status = s; this.error = err;
    statusListeners.forEach((fn) => fn(this));
  },

  async load() {
    if (this.status === "loading" || this.status === "ready") return;
    this.setStatus("loading");
    try {
      const { FilesetResolver, GestureRecognizer } = await import(BUNDLE);
      const vision = await FilesetResolver.forVisionTasks(WASM_DIR);
      const make = (delegate) => GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 4,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        this.recognizer = await make("GPU");
      } catch (e) {
        console.warn("GPU tidak tersedia, memakai CPU:", e);
        this.recognizer = await make("CPU");
      }
      this.setStatus("ready");
    } catch (e) {
      console.error("Pelacak tangan gagal dimuat:", e);
      this.setStatus("error", e?.message || String(e));
    }
  },
};

// ---------- Pemetaan koordinat video → layar (video tampil object-fit: cover & dicerminkan) ----------
let prevHands = [];
function mapResult(res) {
  const v = camera.video;
  const W = innerWidth, H = innerHeight;
  const vw = v.videoWidth, vh = v.videoHeight;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  const ox = (W - dw) / 2, oy = (H - dh) / 2;
  const map = (p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });

  const out = [];
  (res.landmarks || []).forEach((lm, i) => {
    // ukuran tangan relatif tinggi frame (pergelangan → pangkal jari tengah)
    const size = Math.hypot((lm[0].x - lm[9].x) * vw, (lm[0].y - lm[9].y) * vh) / vh;
    if (store.settings.nearOnly && size < 0.045) return;
    const g = res.gestures?.[i]?.[0];
    const tip = map(lm[8]);
    const c = map(lm[9]);
    // haluskan gerakan kursor (cocokkan dengan tangan terdekat di frame sebelumnya)
    const prev = prevHands.find((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 140);
    const k = 0.6;
    out.push({
      x: prev ? prev.x + (tip.x - prev.x) * k : tip.x,
      y: prev ? prev.y + (tip.y - prev.y) * k : tip.y,
      cx: c.x, cy: c.y, size,
      gesture: g?.categoryName || "None",
      score: g?.score || 0,
    });
  });
  prevHands = out;
  return out;
}

// ---------- Sentuh di udara (dwell) ----------
const airState = new WeakMap();
let airBusy = false; // ada tombol yang sedang di-hover / terisi?
function airUpdate(points, dt) {
  if (!points.length && !airBusy) return; // tidak ada tangan & tidak ada yang perlu dikosongkan → hemat
  let busy = false;
  const targets = document.querySelectorAll("[data-air]");
  for (const el of targets) {
    let s = airState.get(el);
    if (!s) { s = { v: 0, armed: true, p: -1, hover: false }; airState.set(el, s); }
    const off = el.disabled || el.classList.contains("is-locked") || !el.getClientRects().length;
    let over = false;
    if (!off && points.length) {
      const r = el.getBoundingClientRect();
      const pad = 8;
      over = points.some((p) => p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad);
    }
    const need = +el.dataset.dwell || DWELL_MS; // data-dwell="600" untuk tombol yang lebih cepat
    if (over && s.armed) {
      s.v += dt;
      if (s.v >= need) {
        s.v = 0;
        s.armed = false; // harus keluar dulu sebelum bisa memilih lagi
        el.dispatchEvent(new CustomEvent("air", { bubbles: true, detail: { source: "hand" } }));
      }
    } else {
      s.v = Math.max(0, s.v - dt * 2.5);
      if (!over) s.armed = true;
    }
    const p = Math.round((s.v / need) * 100) / 100;
    if (p !== s.p) { el.style.setProperty("--p", p); s.p = p; }
    if (over !== s.hover) { el.classList.toggle("is-hover", over && !off); s.hover = over; }
    if (over || s.v > 0) busy = true;
  }
  airBusy = busy;
}
// Klik mouse pada elemen data-air dianggap sama dengan "sentuhan" tangan
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-air]");
  if (t && !t.disabled && !t.classList.contains("is-locked")) {
    t.dispatchEvent(new CustomEvent("air", { bubbles: true, detail: { source: "mouse" } }));
  }
});

// ---------- Gambar kursor jari & emoji gestur ----------
const fx = document.getElementById("fx");
const g = fx.getContext("2d");
let dpr = 1, rem = 16, drew = false;
function resize() {
  dpr = 1; // cukup untuk lingkaran kursor; kanvas besar di TV 4K jadi berat
  fx.width = innerWidth * dpr;
  fx.height = innerHeight * dpr;
  rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}
addEventListener("resize", resize);
resize();

function draw(hands) {
  const o = tracker.opts;
  const showPointer = o.pointers && store.settings.pointer;
  if (!o.active || !hands.length || (!showPointer && !o.badges)) {
    if (drew) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.width, fx.height); drew = false; }
    return;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (const h of hands) {
    if (showPointer) {
      const r = rem * 1.35;
      // cahaya luar tanpa shadowBlur (shadowBlur di kanvas itu berat)
      g.lineWidth = rem * 0.9;
      g.strokeStyle = "rgba(255, 210, 63, .28)";
      g.beginPath(); g.arc(h.x, h.y, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = rem * 0.28;
      g.strokeStyle = "rgba(255,255,255,.95)";
      g.beginPath(); g.arc(h.x, h.y, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#ffd23f";
      g.beginPath(); g.arc(h.x, h.y, rem * 0.42, 0, Math.PI * 2); g.fill();
    }
    if (o.badges) {
      const e = GESTURE_EMOJI[h.gesture];
      if (e && h.score > 0.55) {
        g.font = `${rem * 3}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(e, h.cx, h.cy - rem * 4.2);
      }
    }
  }
  drew = true;
}

// ---------- Loop utama ----------
let lastT = performance.now();
let lastVideoTime = -1;
let lastRun = 0;
let cost = 16; // rata-rata waktu deteksi (ms) — di laptop lambat deteksi otomatis dijarangkan
const MIN_INTERVAL = 50; // maks ±20 deteksi/detik, sisa waktu untuk animasi & timer
let view = []; // posisi kursor yang dihaluskan tiap frame (deteksi lebih jarang dari layar)

function smooth(hands, dt) {
  const k = Math.min(1, dt / 60);
  view = hands.map((h, i) => {
    const p = view[i];
    if (!p || Math.hypot(p.x - h.x, p.y - h.y) > 220) return { ...h };
    return { ...h, x: p.x + (h.x - p.x) * k, y: p.y + (h.y - p.y) * k };
  });
  return view;
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(100, now - lastT);
  lastT = now;
  const o = tracker.opts;
  if (o.active && !tracker.suspended && tracker.recognizer && camera.ready) {
    const v = camera.video;
    // deteksi memakan ≤ ±40% waktu: laptop cepat ±20×/detik, laptop lambat otomatis lebih jarang
    if (v.currentTime !== lastVideoTime && now - lastRun >= Math.max(MIN_INTERVAL, Math.min(200, cost * 2.5))) {
      lastVideoTime = v.currentTime;
      lastRun = now;
      const t0 = performance.now();
      try {
        tracker.hands = mapResult(tracker.recognizer.recognizeForVideo(v, now));
      } catch (e) {
        console.warn(e);
      }
      cost = cost * 0.9 + (performance.now() - t0) * 0.1;
    }
  } else if (tracker.hands.length) {
    tracker.hands = [];
    prevHands = [];
  }
  const hands = o.active && !tracker.suspended ? tracker.hands : [];
  const shown = smooth(hands, dt);
  frameListeners.forEach((fn) => fn(shown, dt));
  airUpdate(o.active && o.pointers ? shown : [], dt);
  draw(shown);
}
requestAnimationFrame(loop);

/** Helper deteksi gestur "ditahan" untuk mode game.
 *  const g = holdGesture({ Thumb_Up: onYes, Thumb_Down: onNo }) → g.update(hands, dt) tiap frame, g.progress[name] 0..1 */
export function holdGesture(handlers, { holdMs = 550, minScore = 0.6, cooldownMs = 900 } = {}) {
  const prog = {};
  const needRelease = {};
  let coolUntil = 0;
  Object.keys(handlers).forEach((k) => { prog[k] = 0; needRelease[k] = false; });
  return {
    progress: prog,
    update(hands, dt) {
      const now = performance.now();
      for (const name of Object.keys(handlers)) {
        const seen = hands.some((h) => h.gesture === name && h.score >= minScore);
        if (!seen) { needRelease[name] = false; prog[name] = Math.max(0, prog[name] - dt / holdMs * 2); continue; }
        if (needRelease[name] || now < coolUntil) continue;
        prog[name] = Math.min(1, prog[name] + dt / holdMs);
        if (prog[name] >= 1) {
          prog[name] = 0;
          needRelease[name] = true;
          coolUntil = now + cooldownMs;
          handlers[name]();
        }
      }
    },
  };
}
