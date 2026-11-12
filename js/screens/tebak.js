// MODE 3 — Tebak Istilah (gaya "Taboo"), juri memakai gestur 👍 / 👎 ke kamera
import { store, teamColor } from "../store.js";
import { TABOO } from "../data.js";
import { camera } from "../camera.js";
import { tracker, holdGesture } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { $, esc, deck, setCam, createTimer, keys, bigCountdown, confetti, segHTML, confirmBox } from "../ui.js";

const cardDeck = deck(TABOO);
const POINTS = 50;
let lastCfg = { team: 0, seconds: 60, style: "talk" };

export default function tebak(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));

  const cfg = { ...lastCfg };
  if (cfg.team >= store.teams.length) cfg.team = 0;

  let phase = "setup";
  let timer = null;
  let card = null;
  let results = [];
  let gest = null;

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
          <span class="setup-emoji">🗣️</span>
          <div><p class="eyebrow">Mode 3</p><h1>Tebak Istilah</h1></div>
        </header>
        <div class="setup-split">
          <div>
            <div class="setup-grid one">
              <div class="field"><span class="label">Tim yang bermain</span>
                <div class="chips" data-field="team">${store.teams.map((t, i) => `<button type="button" class="chip" data-v="${i}" style="--c:${teamColor(i)}" aria-pressed="${i === cfg.team}"><i></i>${esc(t.name)}</button>`).join("")}</div>
              </div>
              <div class="field"><span class="label">Waktu</span>${segHTML("seconds", [[60, "60 dtk"], [90, "90 dtk"], [120, "120 dtk"]], cfg.seconds)}</div>
              <div class="field"><span class="label">Cara memberi petunjuk</span>${segHTML("style", [["talk", "🗣️ Bicara (tanpa kata terlarang)"], ["mime", "🤐 Pantomim (tanpa suara)"]], cfg.style)}</div>
            </div>
            <ul class="rules">
              <li><span>🙋</span><p><b>Penebak</b> (1 orang) berdiri di depan TV <b>membelakangi layar</b>. Dilarang menoleh!</p></li>
              <li><span>👥</span><p><b>Anggota tim</b> melihat layar dan memberi petunjuk tanpa menyebut kata di layar & kata terlarang.</p></li>
              <li><span>🧑‍⚖️</span><p><b>Juri dari tim lain</b> berdiri di samping TV menghadap kamera: <b>👍 = BENAR</b> (+${POINTS}), <b>👎 = LEWATI</b> / melanggar.</p></li>
              <li><span>⌨️</span><p>Guru juga bisa menilai: <kbd>→</kbd>/<kbd>PageDown</kbd> benar, <kbd>←</kbd>/<kbd>PageUp</kbd> lewati (bisa pakai clicker presentasi).</p></li>
            </ul>
          </div>
          <div class="stage-map" aria-hidden="true">
            <div class="sm-tv">📺 <b>TV + kamera</b></div>
            <div class="sm-row">
              <div class="sm-person"><span>🙋</span><b>Penebak</b><small>membelakangi layar</small></div>
              <div class="sm-person juri"><span>🧑‍⚖️</span><b>Juri</b><small>di samping TV,<br>menghadap kamera</small></div>
            </div>
            <div class="sm-team"><span>👥👥👥</span><b>Tim</b><small>melihat layar & memberi petunjuk</small></div>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="home">← Menu</button>
          <button class="btn primary big" data-act="start">Mulai ▶</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- MAIN
  function gestureNote() {
    if (camera.status === "on" && tracker.status === "ready") return "Juri: tunjukkan 👍 / 👎 ke kamera ±½ detik";
    return "Pelacak gestur tidak aktif — nilai pakai tombol / keyboard";
  }

  async function startPlay() {
    phase = "countdown";
    results = [];
    setCam("soft");
    tracker.use({ badges: true });
    root.innerHTML = `
      <div class="tebak" style="--team:${color()}">
        <div class="tebak-top">
          <span class="pill team-pill"><i></i>${esc(team().name)}</span>
          <span class="tebak-timer" id="tt">${cfg.seconds}</span>
          <span class="pill">✅ <b id="tc">0</b> benar</span>
          <button class="btn tiny ghost" data-act="stop" title="Akhiri sekarang">✕</button>
        </div>
        <div class="timer-bar"><i id="tbar"></i></div>
        <div class="word-card" id="card">
          <p class="eyebrow">Bersiap…</p>
          <h1 class="word">🙈</h1>
        </div>
        <div class="tebak-controls">
          <button class="gesture-btn skip" data-act="skip"><i class="hold" id="h-down"></i><span class="g-emoji">👎</span><b>LEWATI</b><small>← / PageUp</small></button>
          <p class="g-note">${gestureNote()}</p>
          <button class="gesture-btn ok" data-act="ok"><i class="hold" id="h-up"></i><span class="g-emoji">👍</span><b>BENAR</b><small>→ / PageDown</small></button>
        </div>
      </div>`;

    await bigCountdown(3, "MULAI!");
    if (!alive) return;
    phase = "play";
    nextCard();
    gest = holdGesture({ Thumb_Up: () => mark(true), Thumb_Down: () => mark(false) });

    const total = cfg.seconds * 1000;
    const tt = $("#tt", root), bar = $("#tbar", root);
    timer = createTimer(total, {
      bar,
      onTick: (ms) => {
        tt.textContent = Math.ceil(ms / 1000);
        tt.classList.toggle("urgent", ms <= 10000);
        bar.classList.toggle("urgent", ms <= 10000);
      },
      onEnd: endPlay,
    });
  }

  function nextCard() {
    card = cardDeck.next();
    const c = $("#card", root);
    if (!c) return;
    const len = card.word.length;
    const size = len <= 7 ? 8 : len <= 10 ? 6.6 : len <= 14 ? 5.4 : 4.4;
    c.innerHTML = `
      <p class="eyebrow">Jelaskan istilah ini ke penebak</p>
      <h1 class="word" style="font-size:${size}rem">${esc(card.word)}</h1>
      ${cfg.style === "mime"
        ? `<div class="taboo mime"><p>🤐 PANTOMIM — dilarang bersuara!</p></div>`
        : `<div class="taboo"><p>🚫 Kata terlarang</p><ul>${card.taboo.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`}`;
    c.classList.remove("enter"); void c.offsetWidth; c.classList.add("enter");
  }

  function mark(ok) {
    if (phase !== "play") return;
    results.push({ word: card.word, ok });
    const c = $("#card", root);
    c.classList.remove("flash-ok", "flash-skip"); void c.offsetWidth;
    c.classList.add(ok ? "flash-ok" : "flash-skip");
    ok ? sfx.correct() : sfx.skip();
    $("#tc", root).textContent = results.filter((r) => r.ok).length;
    nextCard();
  }

  function paintHold() {
    const up = $("#h-up", root), down = $("#h-down", root);
    if (up) up.style.setProperty("--p", gest.progress.Thumb_Up);
    if (down) down.style.setProperty("--p", gest.progress.Thumb_Down);
  }
  b.add(tracker.onFrame((hands, dt) => {
    if (phase === "play" && gest) { gest.update(hands, dt); paintHold(); }
  }));

  function endPlay() {
    if (phase !== "play") return;
    phase = "result";
    timer?.stop();
    tracker.off();
    setCam("dim");
    const correct = results.filter((r) => r.ok).length;
    const points = correct * POINTS;
    store.addScore(cfg.team, points);
    sfx.end();
    if (correct) setTimeout(() => { sfx.win(); confetti([color(), "#ffd23f", "#ffffff"]); }, 450);
    root.innerHTML = `
      <div class="result panel center-text">
        <p class="eyebrow">Waktu habis!</p>
        <h1><span style="color:${color()}">${esc(team().name)}</span> menebak <span class="hl">${correct}</span> istilah</h1>
        <p class="big-points">+${points} poin</p>
        ${results.length ? `<ul class="word-results">${results.map((r) => `<li class="${r.ok ? "ok" : "skip"}">${r.ok ? "✅" : "⏭️"} ${esc(r.word)}</li>`).join("")}</ul>` : `<p class="muted">Belum ada kata yang dinilai.</p>`}
        <p class="muted small">💬 Diskusi singkat: istilah mana yang paling susah dijelaskan? Apa artinya?</p>
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
      cfg[f] = f === "style" ? opt.dataset.v : +opt.dataset.v;
      sfx.select();
      return renderSetup();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "home") go("home");
    if (act === "setup") renderSetup();
    if (act === "start") { lastCfg = { ...cfg }; startPlay(); }
    if (act === "ok") mark(true);
    if (act === "skip") mark(false);
    if (act === "stop" && phase === "play") {
      if (await confirmBox("Akhiri giliran?", "Poin dihitung dari kata yang sudah benar.", "Akhiri") && alive) endPlay();
    }
    if (act === "next-team") {
      cfg.team = (cfg.team + 1) % store.teams.length;
      lastCfg = { ...cfg };
      renderSetup();
    }
  });

  b.add(keys({
    ArrowRight: () => mark(true),
    PageDown: () => mark(true),
    ArrowLeft: () => mark(false),
    PageUp: () => mark(false),
    " ": () => { if (phase === "setup") { lastCfg = { ...cfg }; startPlay(); } },
  }));

  renderSetup();
  return () => b.run();
}
