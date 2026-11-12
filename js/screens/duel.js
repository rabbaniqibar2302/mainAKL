// MODE 1 — Duel Cepat Tepat (sentuh jawaban di udara)
import { store, teamColor } from "../store.js";
import { QUESTIONS } from "../data.js";
import { camera } from "../camera.js";
import { tracker } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { $, $$, esc, shuffle, deck, setCam, createTimer, keys, bigCountdown, banner, confetti, segHTML, confirmBox } from "../ui.js";

const qDeck = deck(QUESTIONS);
const LETTERS = ["A", "B", "C", "D"];
const POINTS = 100;
let lastCfg = { left: 0, right: 1, count: 5, seconds: 20 };

export default function duel(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));

  const n = store.teams.length;
  const cfg = { ...lastCfg };
  if (cfg.left >= n) cfg.left = 0;
  if (cfg.right >= n || cfg.right === cfg.left) cfg.right = cfg.left === 0 ? 1 : 0;

  let phase = "setup";
  let timer = null;
  let qi = 0;
  let cur = null;
  let locked = { L: false, R: false };
  let gained = { L: 0, R: 0 };
  let ready = { L: false, R: false };

  b.add(() => timer?.stop());
  b.add(() => tracker.off());

  const tIdx = (s) => (s === "L" ? cfg.left : cfg.right);
  const team = (s) => store.teams[tIdx(s)];
  const tColor = (s) => teamColor(tIdx(s));

  // ---------------------------------------------------------------- SETUP
  function teamChips(field, value) {
    return `<div class="chips" data-field="${field}">${store.teams
      .map((t, i) => `<button type="button" class="chip" data-v="${i}" style="--c:${teamColor(i)}" aria-pressed="${i === value}"><i></i>${esc(t.name)}</button>`)
      .join("")}</div>`;
  }

  function renderSetup() {
    phase = "setup";
    setCam("dim");
    tracker.off();
    root.innerHTML = `
      <div class="setup panel">
        <header class="setup-head">
          <span class="setup-emoji">⚔️</span>
          <div><p class="eyebrow">Mode 1</p><h1>Duel Cepat Tepat</h1></div>
        </header>
        <p class="lead">Dua wakil tim berdiri di depan kamera dan adu cepat <b>menyentuh jawaban di udara</b> dengan jari telunjuk.</p>
        <div class="setup-grid">
          <div class="field"><span class="label">Tim KIRI</span>${teamChips("left", cfg.left)}</div>
          <div class="field"><span class="label">Tim KANAN</span>${teamChips("right", cfg.right)}</div>
          <div class="field"><span class="label">Jumlah soal</span>${segHTML("count", [[3, "3"], [5, "5"], [8, "8"], [10, "10"]], cfg.count)}</div>
          <div class="field"><span class="label">Waktu per soal</span>${segHTML("seconds", [[15, "15 dtk"], [20, "20 dtk"], [30, "30 dtk"]], cfg.seconds)}</div>
        </div>
        <ul class="rules">
          <li><span>🧍</span><p>Wakil tim kiri berdiri di <b>sisi kiri</b> layar, tim kanan di <b>sisi kanan</b>. Anggota tim lain menyemangati dari tempat duduk.</p></li>
          <li><span>☝️</span><p>Arahkan <b>jari telunjuk</b> ke huruf jawaban lalu <b>tahan ±1 detik</b> sampai tombolnya terisi penuh.</p></li>
          <li><span>✅</span><p>Yang pertama benar dapat <b>+${POINTS}</b>. Salah = terkunci di soal itu, lawan masih boleh menjawab.</p></li>
          <li><span>🔁</span><p>Ganti pemain setiap duel supaya semua anggota tim kebagian maju!</p></li>
        </ul>
        <div class="actions">
          <button class="btn ghost" data-act="home">← Menu</button>
          <button class="btn primary big" data-act="start">Mulai Duel ▶</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- UJI TANGAN
  function trackerNote() {
    if (camera.status !== "on") return `<p class="note warn">⚠️ Kamera belum aktif. Nyalakan lewat tombol 🎥 di kanan atas, atau main pakai keyboard: <kbd>1</kbd>–<kbd>4</kbd> tim kiri, <kbd>7</kbd>–<kbd>0</kbd> tim kanan.</p>`;
    if (tracker.status === "loading") return `<p class="note">⏳ Pelacak tangan sedang dimuat… tunggu sebentar.</p>`;
    if (tracker.status !== "ready") return `<p class="note warn">⚠️ Pelacak tangan tidak aktif. Tetap bisa main pakai mouse atau keyboard: <kbd>1</kbd>–<kbd>4</kbd> tim kiri, <kbd>7</kbd>–<kbd>0</kbd> tim kanan.</p>`;
    return "";
  }

  function readySide(s) {
    return `
      <aside class="duel-side" data-side="${s}" style="--team:${tColor(s)}">
        <div class="side-head"><i></i><span>${esc(team(s).name)}</span></div>
        <button class="air-target ready-btn" data-air data-ready="${s}"><span>✋</span><b>SIAP</b></button>
        <p class="side-status">${s === "L" ? "⬅ berdiri di kiri" : "berdiri di kanan ➡"}</p>
      </aside>`;
  }

  function renderReady() {
    phase = "ready";
    ready = { L: false, R: false };
    qi = 0;
    gained = { L: 0, R: 0 };
    setCam("full");
    tracker.use({ pointers: true });
    root.innerHTML = `
      <div class="duel">
        ${readySide("L")}
        <section class="duel-center panel center-text">
          <p class="eyebrow">Uji tangan</p>
          <h2 class="q-text">Arahkan jari telunjuk ke tombol <span class="hl">SIAP</span> di sisimu</h2>
          <p class="muted">Tahan sampai tombol terisi penuh. Setelah kedua tim siap, duel dimulai otomatis.</p>
          <div class="trk-note">${trackerNote()}</div>
          <div class="actions center">
            <button class="btn ghost" data-act="setup">← Ubah</button>
            <button class="btn primary" data-act="go">Mulai sekarang <kbd>Spasi</kbd></button>
          </div>
        </section>
        ${readySide("R")}
      </div>`;
  }
  b.add(tracker.onStatus(() => { const t = $(".trk-note", root); if (t) t.innerHTML = trackerNote(); }));

  async function startGame() {
    if (phase !== "ready") return;
    phase = "countdown";
    await bigCountdown(3, "MULAI!");
    if (!alive) return;
    nextQuestion();
  }

  // ---------------------------------------------------------------- SOAL
  function padSide(s) {
    return `
      <aside class="duel-side" data-side="${s}" style="--team:${tColor(s)}">
        <div class="side-head"><i></i><span>${esc(team(s).name)}</span><b class="side-gain">${gained[s] ? "+" + gained[s] : "0"}</b></div>
        <div class="pad">
          ${LETTERS.map((l, i) => `<button class="air-target pad-btn" data-air data-side="${s}" data-i="${i}">${l}</button>`).join("")}
        </div>
        <p class="side-status">&nbsp;</p>
      </aside>`;
  }

  function nextQuestion() {
    if (qi >= cfg.count) return renderDone();
    const raw = qDeck.next();
    const order = shuffle([0, 1, 2, 3]);
    cur = { q: raw.q, options: order.map((i) => raw.options[i]), answer: order.indexOf(0), explain: raw.explain };
    locked = { L: false, R: false };
    phase = "question";
    setCam("full");
    tracker.use({ pointers: true });

    root.innerHTML = `
      <div class="duel">
        ${padSide("L")}
        <section class="duel-center panel">
          <div class="q-meta">
            <span class="pill">Soal ${qi + 1} / ${cfg.count}</span>
            <span class="q-timer" id="qt">${cfg.seconds}</span>
            <button class="btn tiny ghost" data-act="quit" title="Hentikan duel">✕</button>
          </div>
          <div class="timer-bar"><i id="qbar"></i></div>
          <h2 class="q-text">${esc(cur.q)}</h2>
          <ol class="q-options">
            ${cur.options.map((o, i) => `<li data-i="${i}"><span class="letter">${LETTERS[i]}</span><span class="opt-text">${esc(o)}</span><span class="opt-tags"></span></li>`).join("")}
          </ol>
          <div class="q-explain" hidden></div>
          <div class="q-next" hidden>
            <button class="air-target next-btn" data-air data-act="next">${qi + 1 >= cfg.count ? "LIHAT HASIL" : "LANJUT"} ▶</button>
            <small class="muted">tunjuk & tahan, klik, atau tekan <kbd>Spasi</kbd></small>
          </div>
        </section>
        ${padSide("R")}
      </div>`;

    const total = cfg.seconds * 1000;
    const qt = $("#qt", root), bar = $("#qbar", root);
    timer = createTimer(total, {
      onTick: (ms) => {
        qt.textContent = Math.ceil(ms / 1000);
        bar.style.transform = `scaleX(${ms / total})`;
        qt.classList.toggle("urgent", ms <= 5000);
        bar.classList.toggle("urgent", ms <= 5000);
      },
      onEnd: () => reveal(null, "timeout"),
    });
  }

  function answer(s, i) {
    if (phase !== "question" || locked[s]) return;
    const side = $(`.duel-side[data-side="${s}"]`, root);
    const btn = $(`.pad-btn[data-i="${i}"]`, side);
    const li = $(`.q-options li[data-i="${i}"]`, root);
    $(".opt-tags", li).insertAdjacentHTML("beforeend", `<span class="tag" style="--c:${tColor(s)}">${esc(team(s).name)}</span>`);

    if (i === cur.answer) {
      btn.classList.add("is-right");
      gained[s] += POINTS;
      store.addScore(tIdx(s), POINTS);
      $(".side-gain", side).textContent = "+" + gained[s];
      sfx.correct();
      confetti([tColor(s), "#ffd23f", "#ffffff"], 70);
      banner(`✅ ${esc(team(s).name)} <b>+${POINTS}</b>`, tColor(s));
      reveal(s);
    } else {
      locked[s] = true;
      btn.classList.add("is-wrong");
      side.classList.add("is-locked");
      $$(".pad-btn", side).forEach((x) => x.classList.add("is-locked"));
      $(".side-status", side).textContent = "❌ Salah! Terkunci";
      sfx.wrong();
      if (locked.L && locked.R) reveal(null, "both");
    }
  }

  function reveal(winner, reason) {
    if (phase !== "question") return;
    phase = "reveal";
    timer?.stop();
    $$(".pad-btn", root).forEach((x) => x.classList.add("is-locked"));
    $$(".q-options li", root).forEach((li) => li.classList.add(+li.dataset.i === cur.answer ? "correct" : "dim"));
    const head = winner
      ? `✅ ${esc(team(winner).name)} benar!`
      : reason === "both" ? "😅 Dua-duanya salah." : "⏰ Waktu habis!";
    const ex = $(".q-explain", root);
    ex.innerHTML = `<p><b>${head}</b> Jawaban: <b>${LETTERS[cur.answer]}. ${esc(cur.options[cur.answer])}</b></p><p>💡 ${esc(cur.explain)}</p>`;
    ex.hidden = false;
    $(".q-next", root).hidden = false;
    if (reason === "timeout") sfx.end();
    qi++;
  }

  // ---------------------------------------------------------------- HASIL
  function renderDone() {
    phase = "done";
    tracker.off();
    setCam("soft");
    const w = gained.L === gained.R ? null : gained.L > gained.R ? "L" : "R";
    if (w) { sfx.win(); confetti([tColor(w), "#ffd23f", "#ffffff"]); }
    root.innerHTML = `
      <div class="result panel center-text">
        <p class="eyebrow">Hasil Duel</p>
        <h1>${w ? `🏆 ${esc(team(w).name)} menang!` : "🤝 Seri!"}</h1>
        <div class="vs">
          <div class="vs-team" style="--c:${tColor("L")}"><span>${esc(team("L").name)}</span><b>+${gained.L}</b></div>
          <span class="vs-x">VS</span>
          <div class="vs-team" style="--c:${tColor("R")}"><span>${esc(team("R").name)}</span><b>+${gained.R}</b></div>
        </div>
        <p class="muted">Poin sudah otomatis masuk ke papan skor.</p>
        <div class="actions center">
          <button class="btn ghost" data-act="home">🏠 Menu</button>
          <button class="btn" data-act="setup">⚙️ Ganti tim</button>
          <button class="btn primary big" data-act="again">🔁 Duel lagi (pemain baru)</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- EVENT
  root.addEventListener("click", async (e) => {
    const opt = e.target.closest("[data-field] [data-v]");
    if (opt && phase === "setup") {
      const field = opt.parentElement.dataset.field;
      const v = +opt.dataset.v;
      if (field === "left" || field === "right") {
        const other = field === "left" ? "right" : "left";
        if (cfg[other] === v) cfg[other] = cfg[field]; // tukar posisi
        cfg[field] = v;
      } else cfg[field] = v;
      sfx.select();
      return renderSetup();
    }
    const t = e.target.closest("[data-act]");
    if (!t || t.hasAttribute("data-air")) return;
    const act = t.dataset.act;
    if (act === "home") go("home");
    if (act === "setup") renderSetup();
    if (act === "start") { lastCfg = { ...cfg }; renderReady(); }
    if (act === "go") startGame();
    if (act === "again") renderReady();
    if (act === "quit") {
      if (await confirmBox("Hentikan duel?", "Poin yang sudah didapat tetap tersimpan.", "Hentikan") && alive) {
        timer?.stop();
        renderDone();
      }
    }
  });

  root.addEventListener("air", (e) => {
    const t = e.target;
    if (phase === "ready" && t.dataset.ready) {
      const s = t.dataset.ready;
      if (ready[s]) return;
      ready[s] = true;
      t.classList.add("is-done");
      t.innerHTML = `<span>✅</span><b>SIAP!</b>`;
      sfx.select();
      if (ready.L && ready.R) startGame();
      return;
    }
    if (phase === "question" && t.dataset.side) return answer(t.dataset.side, +t.dataset.i);
    if (phase === "reveal" && t.dataset.act === "next") { sfx.select(); nextQuestion(); }
  });

  const keyAns = (s, i) => () => phase === "question" && answer(s, i);
  b.add(keys({
    1: keyAns("L", 0), 2: keyAns("L", 1), 3: keyAns("L", 2), 4: keyAns("L", 3),
    7: keyAns("R", 0), 8: keyAns("R", 1), 9: keyAns("R", 2), 0: keyAns("R", 3),
    " ": () => {
      if (phase === "ready") startGame();
      else if (phase === "reveal") nextQuestion();
      else if (phase === "done") renderReady();
    },
  }));

  renderSetup();
  return () => b.run();
}
