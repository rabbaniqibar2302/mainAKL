// MODE 2 — Live Jualan (simulasi live selling di depan kamera)
import { store, teamColor } from "../store.js";
import { PRODUCTS, TARGET_MARKETS, PROMOS, LIVE_RUBRIC, LIVE_COMMENTS, VIEWER_NAMES } from "../data.js";
import { camera } from "../camera.js";
import { tracker, holdGesture } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { $, $$, esc, rp, num, pick, rand, deck, setCam, setImmersive, createTimer, keys, bigCountdown, confetti, segHTML, toast, flash, fmtClock, confirmBox } from "../ui.js";

const productDeck = deck(PRODUCTS);
const RUBRIC_POINTS = 40;
const MAX_BONUS = 50;
let lastCfg = { team: 0, prep: 60, live: 90 };

const priceOf = (p) => (p.hpp * (100 + p.margin)) / 100;

export default function live(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));

  const cfg = { ...lastCfg };
  if (cfg.team >= store.teams.length) cfg.team = 0;

  let phase = "setup";
  let mission = null;
  let timer = null;
  let loops = []; // interval/timeout id selama live
  let stats = null;
  let snapshot = null;
  let rubric = [];
  let bonus = 0;
  let measuring = false;
  let gest = null;
  let lastHeart = 0;

  const clearLoops = () => { loops.forEach((id) => { clearInterval(id); clearTimeout(id); }); loops = []; };
  b.add(() => timer?.stop());
  b.add(clearLoops);
  b.add(() => tracker.off());
  b.add(() => setImmersive(false));

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
          <span class="setup-emoji">🔴</span>
          <div><p class="eyebrow">Mode 2</p><h1>Live Jualan</h1></div>
        </header>
        <p class="lead">Tim jadi penjual online dan melakukan <b>live selling</b> di depan kamera kelas, lengkap dengan komentar penonton, like, dan hitungan harga jual.</p>
        <div class="setup-grid">
          <div class="field span2"><span class="label">Tim yang tampil</span>
            <div class="chips" data-field="team">${store.teams.map((t, i) => `<button type="button" class="chip" data-v="${i}" style="--c:${teamColor(i)}" aria-pressed="${i === cfg.team}"><i></i>${esc(t.name)}</button>`).join("")}</div>
          </div>
          <div class="field"><span class="label">Waktu persiapan tim</span>${segHTML("prep", [[30, "30 dtk"], [60, "1 menit"], [90, "1,5 menit"], [120, "2 menit"]], cfg.prep)}</div>
          <div class="field"><span class="label">Durasi LIVE</span>${segHTML("live", [[60, "1 menit"], [90, "1,5 menit"], [120, "2 menit"]], cfg.live)}</div>
        </div>
        <ul class="rules">
          <li><span>🎲</span><p>Tim mendapat <b>misi acak</b>: produk, target pembeli, promo wajib, dan data <b>HPP + target laba</b>.</p></li>
          <li><span>🧠</span><p>Saat persiapan, satu tim berdiskusi: hitung harga jual, susun kalimat pembuka & ajakan membeli.</p></li>
          <li><span>🎤</span><p>1–2 <b>host</b> tampil LIVE. Tim lain jadi <b>penonton</b>: boleh bertanya seperti komentar live!</p></li>
          <li><span>👍</span><p>Penonton tunjukkan <b>👍 ke kamera</b> untuk mengirim ❤. Host tunjukkan <b>✌️</b> untuk memotret produk.</p></li>
          <li><span>🏅</span><p>Dinilai dengan rubrik (${LIVE_RUBRIC.length} × ${RUBRIC_POINTS} poin) + bonus tepuk tangan kelas (maks ${MAX_BONUS}).</p></li>
        </ul>
        <div class="actions">
          <button class="btn ghost" data-act="home">← Menu</button>
          <button class="btn primary big" data-act="mission">🎲 Ambil Misi</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- MISI & PERSIAPAN
  function newMission() {
    const p = productDeck.next();
    mission = { p, market: pick(TARGET_MARKETS), promo: pick(PROMOS), price: priceOf(p) };
  }

  function missionCard() {
    const { p, market, promo } = mission;
    return `
      <div class="mission-card panel" style="--team:${color()}">
        <div class="mc-top">
          <span class="mc-emoji">${p.emoji}</span>
          <div>
            <p class="eyebrow">Misi Live Jualan · ${esc(team().name)}</p>
            <h1>${esc(p.name)}</h1>
            <p class="muted">${esc(p.desc)}</p>
          </div>
        </div>
        <div class="mc-grid">
          <div class="mc-item"><small>🎯 Target pembeli</small><b>${esc(market)}</b></div>
          <div class="mc-item"><small>🎁 Promo wajib disebut</small><b>${esc(promo)}</b></div>
          <div class="mc-item akl">
            <small>💰 Misi akuntansi</small>
            <b>HPP ${rp(p.hpp)} / pcs · target laba ${p.margin}% dari HPP</b>
            <span>➜ Hitung lalu sebutkan <u>harga jual</u> yang tepat saat LIVE!</span>
          </div>
        </div>
        <div class="mc-check">
          <small>Yang dinilai:</small>
          ${LIVE_RUBRIC.map((r) => `<span>${esc(r.hint)}</span>`).join("")}
        </div>
      </div>`;
  }

  function renderMission() {
    phase = "mission";
    setCam("dim");
    root.innerHTML = `
      <div class="mission-wrap">
        ${missionCard()}
        <div class="actions center">
          <button class="btn ghost" data-act="setup">← Kembali</button>
          <button class="btn" data-act="reroll">🎲 Acak ulang</button>
          <button class="btn primary big" data-act="prep">⏱️ Mulai persiapan (${fmtClock(cfg.prep * 1000)})</button>
        </div>
      </div>`;
  }

  function renderPrep() {
    phase = "prep";
    setCam("soft");
    root.innerHTML = `
      <div class="mission-wrap">
        ${missionCard()}
        <div class="prep-bar panel">
          <div><p class="eyebrow">Waktu persiapan</p><p class="prep-tip">Diskusikan: siapa host? Kalimat pembuka? Harga jual? Ajakan membeli?</p></div>
          <span class="prep-clock" id="pc">${fmtClock(cfg.prep * 1000)}</span>
          <button class="btn primary big" data-act="golive">🔴 Langsung LIVE</button>
        </div>
      </div>`;
    const pc = $("#pc", root);
    timer = createTimer(cfg.prep * 1000, {
      onTick: (ms) => { pc.textContent = fmtClock(ms); pc.classList.toggle("urgent", ms <= 10000); },
      onEnd: () => goLive(),
    });
  }

  // ---------------------------------------------------------------- LIVE
  async function goLive() {
    if (phase !== "prep") return;
    timer?.stop();
    phase = "countdown";
    setCam("full");
    await bigCountdown(3, "🔴 LIVE!");
    if (!alive) return;
    startLive();
  }

  function startLive() {
    phase = "live";
    stats = { viewers: Math.round(rand(8, 20)), peak: 0, likes: 0, comments: 0, photos: 0, started: performance.now() };
    snapshot = null;
    setImmersive(true);
    setCam("full");
    tracker.use({});
    const { p, promo } = mission;
    root.innerHTML = `
      <div class="live" style="--team:${color()}">
        <div class="live-top">
          <div class="live-host">
            <span class="avatar">${esc(team().name.trim().charAt(0).toUpperCase() || "T")}</span>
            <div class="host-name"><b>Toko ${esc(team().name)}</b><small>${esc(p.name)}</small></div>
            <span class="live-badge">LIVE</span>
            <span class="live-pill">👁 <b id="lv-viewers">0</b></span>
          </div>
          <div class="live-right">
            <span class="live-pill">❤ <b id="lv-likes">0</b></span>
            <span class="live-timer" id="lv-timer">${fmtClock(cfg.live * 1000)}</span>
            <button class="live-x" data-act="end-live" title="Akhiri live (Spasi)">✕</button>
          </div>
        </div>
        <div class="live-comments" id="lv-comments"></div>
        <div class="live-hearts" id="lv-hearts"></div>
        <div class="live-product">
          <div class="lp-thumb" id="lv-thumb">${p.emoji}</div>
          <div class="lp-info">
            <b>${esc(p.name)}</b>
            <span class="lp-price">Harga: <em>sebutkan, Kak!</em></span>
            <span class="lp-promo">🎁 ${esc(promo)}</span>
          </div>
          <span class="lp-buy">🛒 Beli</span>
        </div>
        <div class="live-hint">Penonton: 👍 ke kamera = kirim ❤ · Host: ✌️ = foto produk · <kbd>L</kbd> like · <kbd>P</kbd> foto · <kbd>Spasi</kbd> akhiri</div>
      </div>`;

    addComment({ sys: true, t: `🔴 Live dimulai! Selamat datang di Toko ${team().name}` });
    paintStats();

    // penonton bertambah
    loops.push(setInterval(() => {
      stats.viewers = Math.max(3, stats.viewers + Math.round(rand(-2, 7)));
      paintStats();
    }, 1000));

    // komentar penonton
    const commentLoop = () => {
      if (phase !== "live") return;
      spawnComment();
      loops.push(setTimeout(commentLoop, rand(1700, 3200)));
    };
    loops.push(setTimeout(commentLoop, 1200));

    gest = holdGesture({ Victory: takePhoto }, { holdMs: 600, cooldownMs: 2500, minScore: 0.6 });

    const lt = $("#lv-timer", root);
    timer = createTimer(cfg.live * 1000, {
      onTick: (ms) => { lt.textContent = fmtClock(ms); lt.classList.toggle("urgent", ms <= 10000); },
      onEnd: endLive,
    });
  }

  function paintStats() {
    if (!stats) return;
    stats.peak = Math.max(stats.peak, stats.viewers);
    const v = $("#lv-viewers", root), l = $("#lv-likes", root);
    if (v) v.textContent = num(stats.viewers);
    if (l) l.textContent = num(stats.likes);
  }

  function spawnComment() {
    const elapsed = (performance.now() - stats.started) / (cfg.live * 1000);
    const u = pick(VIEWER_NAMES);
    const pname = mission.p.name.toLowerCase();
    const r = Math.random();
    if (r < 0.14) return addComment({ sys: true, t: `${u} bergabung 👋` });
    if (r < 0.2) return addComment({ sys: true, t: `${u} membagikan live ini 🔁` });
    if (elapsed > 0.35 && r < 0.32) {
      stats.likes += 5;
      return addComment({ buy: true, t: `🛒 ${u} membeli ${mission.p.name}!` });
    }
    const c = pick(LIVE_COMMENTS);
    addComment({ u, t: c.t.replace("{p}", pname), q: !!c.q });
  }

  function addComment({ u, t, q, sys, buy }) {
    const box = $("#lv-comments", root);
    if (!box) return;
    if (!sys) stats.comments++;
    const div = document.createElement("div");
    div.className = "cmt" + (q ? " q" : "") + (sys ? " sys" : "") + (buy ? " buy" : "");
    div.innerHTML = u ? `<b>${esc(u)}</b> ${esc(t)}${q ? ' <span class="qtag">❓ jawab</span>' : ""}` : esc(t);
    box.appendChild(div);
    while (box.children.length > 7) box.firstElementChild.remove();
    if (q || buy) sfx.pop();
  }

  function hearts(n = 3) {
    const box = $("#lv-hearts", root);
    if (!box) return;
    for (let i = 0; i < n; i++) {
      const h = document.createElement("span");
      h.textContent = pick(["❤️", "💖", "💛", "💜", "🧡", "💙", "🔥", "👍"]);
      h.style.setProperty("--dx", rand(-5, 5) + "rem");
      h.style.setProperty("--s", rand(0.8, 1.6));
      h.style.animationDelay = i * 0.08 + "s";
      box.appendChild(h);
      setTimeout(() => h.remove(), 2600);
    }
    stats.likes += n;
    stats.viewers += 1;
    paintStats();
  }

  function takePhoto() {
    if (phase !== "live") return;
    flash();
    sfx.shutter();
    snapshot = camera.snapshot(420, 420).toDataURL("image/jpeg", 0.85);
    stats.photos++;
    const th = $("#lv-thumb", root);
    if (th) { th.textContent = ""; th.style.backgroundImage = `url(${snapshot})`; th.classList.add("has-photo"); }
    addComment({ sys: true, t: "📸 Foto produk baru dipasang di etalase!" });
  }

  b.add(tracker.onFrame((hands, dt) => {
    if (phase !== "live") return;
    const now = performance.now();
    if (hands.some((h) => h.gesture === "Thumb_Up" && h.score > 0.6) && now - lastHeart > 260) {
      lastHeart = now;
      hearts(2);
    }
    gest?.update(hands, dt);
  }));

  function endLive() {
    if (phase !== "live") return;
    phase = "score";
    timer?.stop();
    clearLoops();
    tracker.off();
    setImmersive(false);
    sfx.end();
    rubric = LIVE_RUBRIC.map(() => false);
    bonus = 0;
    renderScore();
  }

  // ---------------------------------------------------------------- PENILAIAN
  function total() { return rubric.filter(Boolean).length * RUBRIC_POINTS + bonus; }

  function renderScore() {
    setCam("dim");
    const { p, price } = mission;
    root.innerHTML = `
      <div class="panel score-card">
        <header>
          <p class="eyebrow">Live selesai · Toko ${esc(team().name)}</p>
          <h1>Penilaian Live Jualan</h1>
        </header>
        <div class="sc-col">
          <div class="live-stats">
            <div><b>${num(stats.peak)}</b><small>penonton puncak</small></div>
            <div><b>${num(stats.likes)}</b><small>❤ likes</small></div>
            <div><b>${num(stats.comments)}</b><small>komentar</small></div>
          </div>
          <div class="answer-key">
            <span>💰 Harga jual yang benar</span>
            <b>${rp(price)}</b>
            <small>HPP ${rp(p.hpp)} + laba ${p.margin}% × ${rp(p.hpp)} (${rp(price - p.hpp)})</small>
          </div>
          ${snapshot ? `<figure class="snap"><img src="${snapshot}" alt="Foto produk dari live"><figcaption>📸 Foto produk yang diambil host saat live</figcaption></figure>` : ""}
          <div class="applause">
            <div class="ap-head">
              <b>👏 Bonus tepuk tangan kelas</b>
              <small>Semakin meriah tepuk tangannya, semakin besar bonusnya (maks ${MAX_BONUS}). Ukur dengan mikrofon atau pilih manual.</small>
            </div>
            <div class="ap-meter"><i id="ap-fill"></i><span id="ap-label">0</span></div>
            <div class="ap-actions">
              <button class="btn" data-act="applause">🎤 Ukur 5 detik</button>
              ${segHTML("bonus", [0, 10, 20, 30, 40, 50].map((v) => [v, String(v)]), 0)}
            </div>
          </div>
        </div>
        <div class="sc-col">
          <p class="label">Rubrik — klik yang berhasil dilakukan host</p>
          <div class="rubric">
            ${LIVE_RUBRIC.map((r, i) => `
              <button class="rubric-item" data-rub="${i}" aria-pressed="false">
                <span class="check">✓</span>
                <span class="rb-text">${esc(r.label)}<small>${esc(r.hint)}</small></span>
                <b>+${RUBRIC_POINTS}</b>
              </button>`).join("")}
          </div>
          <div class="total-row"><span>Total poin</span><b id="sc-total">0</b></div>
          <div class="actions">
            <button class="btn ghost" data-act="discard">Batal (tanpa poin)</button>
            <button class="btn primary big" data-act="save">💾 Simpan skor</button>
          </div>
        </div>
      </div>`;
  }

  function paintTotal() {
    const t = $("#sc-total", root);
    if (t) t.textContent = total();
    $$('[data-field="bonus"] [data-v]', root).forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.v === bonus)));
    const lbl = $("#ap-label", root);
    if (lbl && !measuring) lbl.textContent = bonus ? `+${bonus}` : "0";
  }

  async function measureApplause(btn) {
    if (measuring) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      toast("🎤 Mikrofon tidak bisa dipakai. Pilih bonus secara manual ya.");
      return;
    }
    measuring = true;
    btn.disabled = true;
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(stream);
    const an = actx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const fill = $("#ap-fill", root), lbl = $("#ap-label", root);
    const DUR = 5000;
    const t0 = performance.now();
    let env = 0, sum = 0, n = 0;
    await new Promise((resolve) => {
      const frame = () => {
        if (!alive) return resolve();
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const rms = Math.sqrt(s / buf.length);
        const lvl = Math.min(1, Math.max(0, (rms - 0.01) / 0.22));
        env = lvl > env ? lvl : env * 0.93 + lvl * 0.07;
        sum += env; n++;
        const left = DUR - (performance.now() - t0);
        if (fill) fill.style.width = env * 100 + "%";
        if (lbl) lbl.textContent = `👏 ${Math.ceil(Math.max(0, left) / 1000)}`;
        if (left <= 0) return resolve();
        requestAnimationFrame(frame);
      };
      frame();
    });
    stream.getTracks().forEach((t) => t.stop());
    actx.close();
    measuring = false;
    if (!alive) return;
    btn.disabled = false;
    const avg = n ? sum / n : 0;
    bonus = Math.min(MAX_BONUS, Math.round(Math.min(1, avg * 1.5) * 5) * 10);
    if (fill) fill.style.width = (bonus / MAX_BONUS) * 100 + "%";
    sfx.correct();
    paintTotal();
  }

  function save() {
    const pts = total();
    store.addScore(cfg.team, pts);
    sfx.win();
    confetti([color(), "#ffd23f", "#ff4d8d"]);
    toast(`💾 ${esc(team().name)} mendapat <b>+${pts}</b> poin`);
    cfg.team = (cfg.team + 1) % store.teams.length;
    lastCfg = { ...cfg };
    renderSetup();
  }

  // ---------------------------------------------------------------- EVENT
  root.addEventListener("click", async (e) => {
    const opt = e.target.closest("[data-field] [data-v]");
    if (opt) {
      const f = opt.parentElement.dataset.field;
      if (phase === "setup") { cfg[f] = +opt.dataset.v; sfx.select(); return renderSetup(); }
      if (phase === "score" && f === "bonus" && !measuring) {
        bonus = +opt.dataset.v;
        const fill = $("#ap-fill", root);
        if (fill) fill.style.width = (bonus / MAX_BONUS) * 100 + "%";
        sfx.select();
        return paintTotal();
      }
    }
    const rub = e.target.closest("[data-rub]");
    if (rub && phase === "score") {
      const i = +rub.dataset.rub;
      rubric[i] = !rubric[i];
      rub.setAttribute("aria-pressed", String(rubric[i]));
      sfx.select();
      return paintTotal();
    }
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (act === "home") go("home");
    if (act === "setup") renderSetup();
    if (act === "mission") { lastCfg = { ...cfg }; newMission(); sfx.go(); renderMission(); }
    if (act === "reroll") { newMission(); sfx.select(); renderMission(); }
    if (act === "prep") { sfx.go(); renderPrep(); }
    if (act === "golive") goLive();
    if (act === "end-live") endLive();
    if (act === "applause") measureApplause(t);
    if (act === "save") save();
    if (act === "discard") {
      if (await confirmBox("Batalkan penilaian?", "Tim ini tidak mendapat poin dari live tadi.", "Ya, batalkan") && alive) renderSetup();
    }
  });

  b.add(keys({
    " ": () => {
      if (phase === "live") endLive();
      else if (phase === "prep") goLive();
    },
    l: () => phase === "live" && hearts(4),
    L: () => phase === "live" && hearts(4),
    p: () => takePhoto(),
    P: () => takePhoto(),
  }));

  renderSetup();
  return () => b.run();
}
