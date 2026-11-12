// Efek suara sederhana dengan Web Audio (tanpa file audio)
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.15, { type = "sine", vol = 0.18, when = 0, slide } = {}) {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur = 0.12, vol = 0.25) {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const s = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(a.destination);
  s.start();
}

export const sfx = {
  get enabled() { return enabled; },
  set enabled(v) { enabled = !!v; },
  unlock() { ac(); },
  tick: () => tone(1046, 0.06, { type: "square", vol: 0.05 }),
  count: () => tone(660, 0.18, { type: "triangle", vol: 0.2 }),
  go: () => { tone(880, 0.12, { type: "triangle" }); tone(1320, 0.3, { type: "triangle", when: 0.1 }); },
  select: () => tone(740, 0.08, { type: "triangle", vol: 0.12 }),
  correct: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: "triangle", vol: 0.2, when: i * 0.08 })),
  wrong: () => { tone(220, 0.35, { type: "sawtooth", vol: 0.12, slide: 110 }); },
  skip: () => tone(420, 0.18, { type: "sine", vol: 0.15, slide: 260 }),
  pop: () => tone(900 + Math.random() * 500, 0.07, { type: "sine", vol: 0.07 }),
  shutter: () => { noise(0.09, 0.35); setTimeout(() => noise(0.06, 0.2), 90); },
  win: () => [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: "square", vol: 0.08, when: i * 0.13 })),
  end: () => { tone(784, 0.2, { type: "triangle" }); tone(523, 0.45, { type: "triangle", when: 0.18 }); },
};
