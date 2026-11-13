// MODE 2 — Tangkap & Pilah: tangkap kartu yang jatuh dengan tangan, bawa ke keranjang yang benar
import { store, teamColor } from "../store.js";
import { SORT_SETS } from "../data.js";
import { tracker } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { $, esc, shuffle, pick, rand, setCam, createTimer, keys, bigCountdown, confetti, segHTML, confirmBox } from "../ui.js";

const PTS_OK = 20;      // kartu benar
const PTS_STREAK = 10;  // bonus kalau benar 3× berturut-turut atau lebih
const PTS_BAD = -10;    // kartu salah keranjang
const GRAB_MS = 140;    // lama jari menyentuh kartu sebelum tertangkap
const LOST_MS = 450;    // tangan hilang selama ini → kartu terlepas
let lastCfg = { team: 0, set: "acak", seconds: 60 };

export default function pilah(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));

  const cfg = { ...lastCfg };
  if (cfg.team >= store.teams.length) cfg.team = 0;

  let phase = "setup";
  let timer = null;
  let set = null;
  let pool = [];
  let cards = [];
  let st = null; // statistik ronde
  let stage = null, geo = null;
  let elapsed = 0, totalMs = 0, spawnIn = 0;
  let mouse = null; // titik mouse saat tombol ditekan (cadangan tanpa kamera)

  b.add(() => timer?.stop());
  b.add(() => tracker.off());

  const team = () => store.teams[cfg.team];
  const color = () => teamColor(cfg.team);

  // ---------------------------------------------------------------- SETUP
  function renderSetup() {
    phase = "setup";
    setCam("dim");
    tracker.off();
    root.innerHTML = `
      <div class="setup panel">
        <header class="setup-head">
          <span class="setup-emoji">🧺</span>
          <div><p class="eyebrow">Mode 2</p><h1>Tangkap & Pilah</h1></div>
        </header>
        <p class="lead">Kartu berjatuhan dari atas layar. <b>Tangkap dengan tangan</b>, lalu bawa ke <b>keranjang kiri atau kanan</b> sesuai kategorinya — secepat mungkin!</p>
        <div class="setup-grid">
          <div class="field span2"><span class="label">Tim yang bermain</span>
            <div class="chips" data-field="team">${store.teams.map((t, i) => `<button type="button" class="chip" data-v="${i}" style="--c:${teamColor(i)}" aria-pressed="${i === cfg.team}"><i></i>${esc(t.name)}</button>`).join("")}</div>
          </div>
          <div class="field span2"><span class="label">Topik (keranjang kiri / kanan)</span>
            ${segHTML("set", [["acak", "🎲 Acak"], ...SORT_SETS.map((s) => [s.id, `${s.left.emoji} ${s.left.label}/${s.right.label}`])], cfg.set)}
          </div>
          <div class="field"><span class="label">Waktu</span>${segHTML("seconds", [[45, "45 dtk"], [60, "60 dtk"], [90, "90 dtk"]], cfg.seconds)}</div>
        </div>
        <ul class="rules">
          <li><span>🧍🧍</span><p><b>2 pemain</b> dari tim yang sama berdiri di depan kamera (kiri & kanan). Anggota tim lain boleh <b>berteriak memberi arahan</b>!</p></li>
          <li><span>✋</span><p><b>Sentuh kartu</b> yang jatuh dengan jari telunjuk → kartu menempel di jari → <b>gerakkan tangan</b> ke keranjang yang benar.</p></li>
          <li><span>⭐</span><p>Benar <b>+${PTS_OK}</b>, 3× berturut-turut dapat bonus <b>+${PTS_STREAK}</b>. Salah keranjang <b>${PTS_BAD}</b>. Kartu yang jatuh ke bawah hangus.</p></li>
        </ul>
        <div class="actions">
          <button class="btn ghost" data-act="home">← Menu</button>
          <span class="muted small">Tanpa kamera: seret kartu dengan mouse, atau <kbd>←</kbd>/<kbd>→</kbd></span>
          <button class="btn primary big" data-act="start">Mulai ▶</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- MAIN
  async function startPlay() {
    phase = "countdown";
    set = cfg.set === "acak" ? pick(SORT_SETS) : SORT_SETS.find((s) => s.id === cfg.set) || SORT_SETS[0];
    pool = [];
    cards = [];
    st = { score: 0, streak: 0, best: 0, results: [], missed: 0 };
    elapsed = 0;
    totalMs = cfg.seconds * 1000;
    spawnIn = 0;
    setCam("full");
    tracker.use({ pointers: true });

    root.innerHTML = `
      <div class="pilah" style="--team:${color()}">
        <div class="pilah-top">
          <span class="pill team-pill"><i></i>${esc(team().name)}</span>
          <span class="pilah-title">${esc(set.title)}</span>
          <span class="pill streak" id="pk" hidden>🔥 x<b>0</b></span>
          <span class="pill">⭐ <b id="ps">0</b></span>
          <span class="tebak-timer" id="pt">${cfg.seconds}</span>
          <button class="btn tiny ghost" data-act="stop" title="Akhiri sekarang">✕</button>
        </div>
        <div class="timer-bar"><i id="pbar"></i></div>
        <div class="pilah-stage" id="stage">
          <div class="bin" data-bin="L"><span class="bin-emoji">${set.left.emoji}</span><b>${esc(set.left.label)}</b><small>⬅ bawa ke sini</small></div>
          <div class="bin" data-bin="R"><span class="bin-emoji">${set.right.emoji}</span><b>${esc(set.right.label)}</b><small>bawa ke sini ➡</small></div>
          <p class="pilah-hint">Sentuh kartu yang jatuh, lalu bawa ke keranjang yang tepat!</p>
        </div>
      </div>`;
    stage = $("#stage", root);
    measure();

    await bigCountdown(3, "MULAI!");
    if (!alive) return;
    phase = "play";
    timer = createTimer(totalMs, {
      bar: $("#pbar", root),
      onTick: (ms) => {
        const t = $("#pt", root);
        if (!t) return;
        t.textContent = Math.ceil(ms / 1000);
        t.classList.toggle("urgent", ms <= 10000);
      },
      onEnd: endPlay,
    });
  }

  /** Simpan posisi panggung & keranjang (koordinat relatif panggung) */
  function measure() {
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const rel = (el) => { const x = el.getBoundingClientRect(); return { l: x.left - r.left, t: x.top - r.top, r: x.right - r.left, b: x.bottom - r.top, el }; };
    geo = { left: r.left, top: r.top, w: r.width, h: r.height, L: rel($('[data-bin="L"]', stage)), R: rel($('[data-bin="R"]', stage)) };
  }
  const onResize = () => measure();
  addEventListener("resize", onResize);
  b.add(() => removeEventListener("resize", onResize));

  const progress = () => Math.min(1, elapsed / totalMs);
  const maxActive = () => (progress() < 0.3 ? 1 : progress() < 0.7 ? 2 : 3);

  function spawn() {
    if (!pool.length) pool = shuffle(set.items);
    const [text, ans] = pool.pop();
    const el = document.createElement("div");
    el.className = "fcard";
    el.innerHTML = `<span>${esc(text)}</span>`;
    stage.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    const minX = geo.L.r + 16;
    const maxX = Math.max(minX, geo.R.l - 16 - w);
    const c = {
      el, text, ans, w, h,
      x: rand(minX, maxX), y: -h,
      vy: geo.h * (0.11 + 0.09 * progress()), // makin lama makin cepat
      grab: false, hover: 0, lost: 0, ax: 0, ay: 0, done: false,
    };
    cards.push(c);
    paint(c);
  }

  const paint = (c) => { c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`; };

  function binAt(x, y) {
    for (const side of ["L", "R"]) {
      const g = geo[side];
      if (x >= g.l - 10 && x <= g.r + 10 && y >= g.t - 10 && y <= g.b + 10) return side;
    }
    return null;
  }

  function grab(c, p) {
    c.grab = true; c.ax = p.x; c.ay = p.y; c.lost = 0; c.byMouse = !!p.m;
    c.el.classList.add("held");
    sfx.pop();
  }
  function release(c) {
    c.grab = false; c.hover = 0;
    c.el.classList.remove("held");
  }

  // Loop permainan (dipanggil tiap frame oleh pelacak)
  b.add(tracker.onFrame((hands, dt) => {
    if (phase !== "play" || !geo) return;
    elapsed += dt;
    spawnIn -= dt;
    if (spawnIn <= 0 && cards.filter((c) => !c.done).length < maxActive()) {
      spawn();
      spawnIn = rand(1500, 2500) * (1 - progress() * 0.4);
    }

    const pts = hands.map((h) => ({ x: h.x - geo.left, y: h.y - geo.top }));
    if (mouse) pts.push({ x: mouse.x - geo.left, y: mouse.y - geo.top, m: true });
    const held = cards.filter((c) => c.grab && !c.done);

    for (const c of cards) {
      if (c.done) continue;
      if (c.grab) {
        // ikuti tangan terdekat dari posisi terakhir
        let best = null, bd = Infinity;
        if (c.byMouse) { best = pts.find((p) => p.m); bd = 0; } // kartu yang dipegang mouse selalu ikut mouse
        else for (const p of pts) { if (p.m) continue; const d = Math.hypot(p.x - c.ax, p.y - c.ay); if (d < bd) { bd = d; best = p; } }
        if (best && bd < 400) { c.ax = best.x; c.ay = best.y; c.lost = 0; }
        else if (c.byMouse || (c.lost += dt) > LOST_MS) release(c);
        if (c.grab) {
          c.x = c.ax - c.w / 2;
          c.y = c.ay - c.h / 2;
          const side = binAt(c.ax, c.ay);
          if (side) { judge(c, side); continue; }
        }
      } else {
        c.y += (c.vy * dt) / 1000;
        // satu tangan hanya memegang satu kartu
        const free = pts.filter((p) => !held.some((h) => Math.hypot(h.ax - p.x, h.ay - p.y) < 80));
        const touch = free.find((p) => p.x >= c.x - 24 && p.x <= c.x + c.w + 24 && p.y >= c.y - 24 && p.y <= c.y + c.h + 24);
        c.hover = touch ? c.hover + dt : Math.max(0, c.hover - dt);
        if (touch && c.hover >= GRAB_MS) { grab(c, touch); held.push(c); }
        else if (c.y > geo.h) { miss(c); continue; }
      }
      paint(c);
    }
    if (cards.length > 12) cards = cards.filter((c) => !c.done);
  }));

  function finish(c, cls) {
    c.done = true;
    c.el.classList.remove("held");
    c.el.classList.add(cls);
    setTimeout(() => c.el.remove(), 450);
  }

  function judge(c, side) {
    const ok = side === c.ans;
    finish(c, ok ? "in-ok" : "in-bad");
    st.results.push({ text: c.text, ans: c.ans, ok });
    let pts;
    if (ok) {
      st.streak++;
      st.best = Math.max(st.best, st.streak);
      pts = PTS_OK + (st.streak >= 3 ? PTS_STREAK : 0);
      sfx.correct();
    } else {
      st.streak = 0;
      pts = PTS_BAD;
      sfx.wrong();
    }
    st.score = Math.max(0, st.score + pts);
    const bin = geo[side].el;
    bin.classList.remove("flash-ok", "flash-bad"); void bin.offsetWidth;
    bin.classList.add(ok ? "flash-ok" : "flash-bad");
    const correctLabel = (c.ans === "L" ? set.left : set.right).label;
    floatText(bin, ok ? `+${pts}` : `❌ Harusnya: ${esc(correctLabel)}`, ok);
    paintScore();
  }

  function miss(c) {
    finish(c, "missed");
    st.missed++;
    st.streak = 0;
    sfx.skip();
    paintScore();
  }

  function floatText(bin, html, ok) {
    const f = document.createElement("div");
    f.className = "float-pts " + (ok ? "ok" : "bad");
    f.innerHTML = html;
    bin.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  function paintScore() {
    const s = $("#ps", root), k = $("#pk", root);
    if (s) s.textContent = st.score;
    if (k) { k.hidden = st.streak < 2; k.querySelector("b").textContent = st.streak; }
  }

  // ---- cadangan mouse & keyboard
  function onDown(e) {
    if (phase !== "play" || !e.target.closest?.(".fcard")) return;
    mouse = { x: e.clientX, y: e.clientY };
  }
  function onMove(e) { if (mouse) mouse = { x: e.clientX, y: e.clientY }; }
  function onUp() {
    if (!mouse) return;
    cards.forEach((c) => { if (c.grab && !c.done && c.byMouse) release(c); });
    mouse = null;
  }
  addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  b.add(() => { removeEventListener("pointerdown", onDown); removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); });

  function keySort(side) {
    if (phase !== "play") return;
    const live = cards.filter((c) => !c.done);
    if (!live.length) return;
    const c = live.reduce((a, x) => (x.y > a.y ? x : a));
    judge(c, side);
  }

  function endPlay() {
    if (phase !== "play") return;
    phase = "result";
    timer?.stop();
    tracker.off();
    setCam("dim");
    const ok = st.results.filter((r) => r.ok).length;
    const bad = st.results.filter((r) => !r.ok);
    store.addScore(cfg.team, st.score);
    sfx.end();
    if (st.score) setTimeout(() => { sfx.win(); confetti([color(), "#ffd23f", "#ffffff"]); }, 450);
    const lbl = (a) => (a === "L" ? set.left : set.right);
    root.innerHTML = `
      <div class="result panel center-text">
        <p class="eyebrow">Waktu habis! · ${esc(set.title)}</p>
        <h1><span style="color:${color()}">${esc(team().name)}</span> memilah <span class="hl">${ok}</span> kartu dengan benar</h1>
        <p class="big-points">+${st.score} poin</p>
        <div class="pilah-stats">
          <span>✅ Benar <b>${ok}</b></span>
          <span>❌ Salah <b>${bad.length}</b></span>
          <span>💨 Terlewat <b>${st.missed}</b></span>
          <span>🔥 Beruntun terbaik <b>${st.best}</b></span>
        </div>
        ${bad.length ? `
          <div class="pilah-review">
            <p class="label">Yang masih salah — yuk bahas!</p>
            <ul class="word-results">${bad.map((r) => `<li class="skip">${esc(r.text)} → <b>${lbl(r.ans).emoji} ${esc(lbl(r.ans).label)}</b></li>`).join("")}</ul>
          </div>` : `<p class="muted">Sempurna, tidak ada yang salah! 🎉</p>`}
        <div class="actions center">
          <button class="btn ghost" data-act="home">🏠 Menu</button>
          <button class="btn" data-act="setup">⚙️ Pengaturan</button>
          <button class="btn primary big" data-act="next-team">Tim berikutnya ▶</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- EVENT
  root.addEventListener("click", async (e) => {
    const opt = e.target.closest("[data-field] [data-v]");
    if (opt && phase === "setup") {
      const f = opt.parentElement.dataset.field;
      cfg[f] = f === "set" ? opt.dataset.v : +opt.dataset.v;
      sfx.select();
      return renderSetup();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "home") go("home");
    if (act === "setup") renderSetup();
    if (act === "start") { lastCfg = { ...cfg }; startPlay(); }
    if (act === "stop" && phase === "play") {
      if (await confirmBox("Akhiri giliran?", "Poin dihitung dari kartu yang sudah dipilah.", "Akhiri") && alive) endPlay();
    }
    if (act === "next-team") {
      cfg.team = (cfg.team + 1) % store.teams.length;
      lastCfg = { ...cfg };
      renderSetup();
    }
  });

  b.add(keys({
    ArrowLeft: () => keySort("L"),
    ArrowRight: () => keySort("R"),
    " ": () => { if (phase === "setup") { lastCfg = { ...cfg }; startPlay(); } },
  }));

  renderSetup();
  return () => b.run();
}
