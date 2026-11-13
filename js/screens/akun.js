// MODE 4 — Debit atau Kredit? (Akun T Estafet)
// Layar jadi Akun T raksasa: angkat tangan ke sisi kiri (DEBIT) atau kanan (KREDIT).
import { store, teamColor } from "../store.js";
import { JOURNAL } from "../data.js";
import { tracker } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { $, $$, esc, deck, setCam, createTimer, keys, bigCountdown, confetti, segHTML, confirmBox } from "../ui.js";

const jDeck = deck(JOURNAL);
const PTS = 20;   // benar
const BONUS = 10; // bonus jika benar 3× berturut-turut atau lebih
let lastCfg = { team: 0, seconds: 90, swap: 3 };

export default function akun(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));

  const cfg = { ...lastCfg };
  if (cfg.team >= store.teams.length) cfg.team = 0;

  let phase = "setup";
  let timer = null;
  let cur = null;
  let st = null;
  let busy = false;
  let pending = null;

  b.add(() => timer?.stop());
  b.add(() => clearTimeout(pending));
  b.add(() => tracker.off());

  const team = () => store.teams[cfg.team];
  const color = () => teamColor(cfg.team);
  const later = (ms, fn) => { clearTimeout(pending); pending = setTimeout(() => alive && fn(), ms); };

  // ---------------------------------------------------------------- SETUP
  function renderSetup() {
    phase = "setup";
    setCam("dim");
    tracker.off();
    root.innerHTML = `
      <div class="setup panel">
        <header class="setup-head">
          <span class="setup-emoji">⚖️</span>
          <div><p class="eyebrow">Mode 4 · Akun T Estafet</p><h1>Debit atau Kredit?</h1></div>
        </header>
        <p class="lead">Layar berubah jadi <b>Akun T raksasa</b>. Baca transaksinya, lalu <b>angkat tangan</b> ke sisi <b>DEBIT (kiri)</b> atau <b>KREDIT (kanan)</b>.</p>
        <div class="setup-grid">
          <div class="field span2"><span class="label">Tim yang bermain</span>
            <div class="chips" data-field="team">${store.teams.map((t, i) => `<button type="button" class="chip" data-v="${i}" style="--c:${teamColor(i)}" aria-pressed="${i === cfg.team}"><i></i>${esc(t.name)}</button>`).join("")}</div>
          </div>
          <div class="field"><span class="label">Waktu</span>${segHTML("seconds", [[60, "60 dtk"], [90, "90 dtk"], [120, "120 dtk"]], cfg.seconds)}</div>
          <div class="field"><span class="label">Ganti pemain setiap</span>${segHTML("swap", [[3, "3 soal"], [5, "5 soal"], [0, "Tidak"]], cfg.swap)}</div>
        </div>
        <ul class="rules">
          <li><span>🧍</span><p><b>1 pemain</b> berdiri di tengah, tepat di bawah garis tegak huruf T. Anggota tim lain antre di samping.</p></li>
          <li><span>🙋</span><p>Angkat tangan <b>tinggi</b> ke kotak DEBIT atau KREDIT dan tahan sebentar sampai terisi.</p></li>
          <li><span>🔁</span><p><b>Estafet:</b> saat muncul “GANTI PEMAIN!”, anggota berikutnya langsung maju — waktu terus berjalan!</p></li>
          <li><span>⭐</span><p>Benar <b>+${PTS}</b>, 3× beruntun bonus <b>+${BONUS}</b>. Salah tidak dikurangi, tapi jurnal yang benar ditampilkan.</p></li>
        </ul>
        <div class="actions">
          <button class="btn ghost" data-act="home">← Menu</button>
          <span class="muted small">Tanpa kamera: klik kotaknya, atau tombol <kbd>D</kbd>/<kbd>←</kbd> debit · <kbd>K</kbd>/<kbd>→</kbd> kredit</span>
          <button class="btn primary big" data-act="start">Mulai ▶</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- MAIN
  async function startPlay() {
    phase = "countdown";
    st = { score: 0, streak: 0, best: 0, results: [], answered: 0 };
    setCam("full");
    tracker.use({ pointers: true });
    root.innerHTML = `
      <div class="akun" style="--team:${color()}">
        <div class="pilah-top">
          <span class="pill team-pill"><i></i>${esc(team().name)}</span>
          <span class="pilah-title">Debit atau Kredit?</span>
          <span class="pill streak" id="ak" hidden>🔥 x<b>0</b></span>
          <span class="pill">⭐ <b id="as">0</b></span>
          <span class="tebak-timer" id="at">${cfg.seconds}</span>
          <button class="btn tiny ghost" data-act="stop" title="Akhiri sekarang">✕</button>
        </div>
        <div class="timer-bar"><i id="abar"></i></div>
        <div class="akun-stage">
          <div class="t-card" id="tcard"><p class="eyebrow">Bersiap…</p></div>
          <div class="t-bar"></div>
          <div class="t-stem"></div>
          <button class="air-target tzone" data-air data-dwell="650" data-side="D"><b>DEBIT</b><small>⬅ angkat tangan ke sini</small></button>
          <button class="air-target tzone" data-air data-dwell="650" data-side="K"><b>KREDIT</b><small>angkat tangan ke sini ➡</small></button>
          <div class="swap-ov" id="swap" hidden><span>🔁</span><b>GANTI PEMAIN!</b><small>Anggota berikutnya, maju!</small></div>
        </div>
      </div>`;

    await bigCountdown(3, "MULAI!");
    if (!alive) return;
    phase = "play";
    next();
    timer = createTimer(cfg.seconds * 1000, {
      bar: $("#abar", root),
      onTick: (ms) => {
        const t = $("#at", root);
        if (!t) return;
        t.textContent = Math.ceil(ms / 1000);
        t.classList.toggle("urgent", ms <= 10000);
      },
      onEnd: endPlay,
    });
  }

  function next() {
    if (phase !== "play") return;
    const j = jDeck.next();
    const side = Math.random() < 0.5 ? "D" : "K";
    cur = { ...j, side, akun: side === "D" ? j.d : j.k };
    $$(".tzone", root).forEach((z) => z.classList.remove("z-ok", "z-bad", "z-answer"));
    const c = $("#tcard", root);
    c.innerHTML = `
      <p class="eyebrow">Transaksi</p>
      <h2 class="t-trx">${esc(j.t)}</h2>
      <p class="t-ask">Akun <span class="t-akun">${esc(cur.akun)}</span> dicatat di sisi…?</p>`;
    c.classList.remove("enter"); void c.offsetWidth; c.classList.add("enter");
    busy = false;
  }

  function answer(side) {
    if (phase !== "play" || busy || !cur) return;
    busy = true;
    const ok = side === cur.side;
    st.results.push({ ...cur, ok });
    st.answered++;
    const zone = $(`.tzone[data-side="${side}"]`, root);
    zone.classList.add(ok ? "z-ok" : "z-bad");
    if (!ok) $(`.tzone[data-side="${cur.side}"]`, root).classList.add("z-answer");
    let pts = 0;
    if (ok) {
      st.streak++;
      st.best = Math.max(st.best, st.streak);
      pts = PTS + (st.streak >= 3 ? BONUS : 0);
      st.score += pts;
      sfx.correct();
    } else {
      st.streak = 0;
      sfx.wrong();
    }
    const c = $("#tcard", root);
    c.insertAdjacentHTML("beforeend", `
      <div class="t-feedback ${ok ? "ok" : "bad"}">
        <p><b>${ok ? `✅ Benar! +${pts}` : `❌ Kurang tepat — ${esc(cur.akun)} di sisi ${cur.side === "D" ? "DEBIT" : "KREDIT"}`}</b></p>
        <p>Jurnal: <b>${esc(cur.d)}</b> (D) — <b>${esc(cur.k)}</b> (K)</p>
        <p class="t-why">💡 ${esc(cur.why)}</p>
      </div>`);
    paintScore();
    later(ok ? 1300 : 2600, () => {
      if (phase !== "play") return;
      if (cfg.swap && st.answered % cfg.swap === 0) doSwap();
      else next();
    });
  }

  function doSwap() {
    const ov = $("#swap", root);
    ov.hidden = false;
    sfx.go();
    later(2200, () => { ov.hidden = true; next(); });
  }

  function paintScore() {
    const s = $("#as", root), k = $("#ak", root);
    if (s) s.textContent = st.score;
    if (k) { k.hidden = st.streak < 2; k.querySelector("b").textContent = st.streak; }
  }

  function endPlay() {
    if (phase !== "play") return;
    phase = "result";
    timer?.stop();
    clearTimeout(pending);
    tracker.off();
    setCam("dim");
    const ok = st.results.filter((r) => r.ok).length;
    const bad = st.results.filter((r) => !r.ok);
    store.addScore(cfg.team, st.score);
    sfx.end();
    if (st.score) setTimeout(() => { sfx.win(); confetti([color(), "#ffd23f", "#ffffff"]); }, 450);
    root.innerHTML = `
      <div class="result panel center-text">
        <p class="eyebrow">Waktu habis! · Debit atau Kredit?</p>
        <h1><span style="color:${color()}">${esc(team().name)}</span> benar <span class="hl">${ok}</span> dari ${st.results.length} akun</h1>
        <p class="big-points">+${st.score} poin</p>
        <div class="pilah-stats">
          <span>✅ Benar <b>${ok}</b></span>
          <span>❌ Salah <b>${bad.length}</b></span>
          <span>🔥 Beruntun terbaik <b>${st.best}</b></span>
        </div>
        ${bad.length ? `
          <div class="pilah-review">
            <p class="label">Yuk bahas jurnalnya!</p>
            <ul class="jurnal-review">${bad.map((r) => `<li><span>${esc(r.t)}</span><b>${esc(r.d)} (D) — ${esc(r.k)} (K)</b></li>`).join("")}</ul>
          </div>` : st.results.length ? `<p class="muted">Sempurna, semua benar! 🎉</p>` : ""}
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
      cfg[opt.parentElement.dataset.field] = +opt.dataset.v;
      sfx.select();
      return renderSetup();
    }
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (act === "home") go("home");
    if (act === "setup") renderSetup();
    if (act === "start") { lastCfg = { ...cfg }; startPlay(); }
    if (act === "stop" && phase === "play") {
      if (await confirmBox("Akhiri giliran?", "Poin dihitung dari jawaban yang sudah benar.", "Akhiri") && alive) endPlay();
    }
    if (act === "next-team") {
      cfg.team = (cfg.team + 1) % store.teams.length;
      lastCfg = { ...cfg };
      renderSetup();
    }
  });

  root.addEventListener("air", (e) => {
    const side = e.target.dataset.side;
    if (side) answer(side);
  });

  b.add(keys({
    d: () => answer("D"), D: () => answer("D"), ArrowLeft: () => answer("D"),
    k: () => answer("K"), K: () => answer("K"), ArrowRight: () => answer("K"),
    " ": () => { if (phase === "setup") { lastCfg = { ...cfg }; startPlay(); } },
  }));

  renderSetup();
  return () => b.run();
}
