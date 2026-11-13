// Menu utama
import { store, teamColor } from "../store.js";
import { camera } from "../camera.js";
import { tracker } from "../tracker.js";
import { go, bag } from "../router.js";
import { $, esc, num, setCam } from "../ui.js";
import { openCameraModal, openTeamsModal, openHelpModal } from "../modals.js";

const MODES = [
  {
    id: "duel", n: 1, emoji: "⚔️", accent: "#22d3ee", title: "Duel Cepat Tepat",
    desc: "Dua wakil tim adu cepat menjawab soal dengan menyentuh jawaban di udara.",
    tags: ["🖐 Sentuh udara", "Kuis materi + hitungan"],
  },
  {
    id: "pilah", n: 2, emoji: "🧺", accent: "#ff4d8d", title: "Tangkap & Pilah",
    desc: "Kartu berjatuhan! Tangkap dengan tangan lalu bawa ke keranjang yang benar: pendapatan/beban, aset/utang, dll.",
    tags: ["🙌 Gerak tangan", "2 pemain + tim"],
  },
  {
    id: "tebak", n: 3, emoji: "🗣️", accent: "#ffd23f", title: "Tebak Istilah",
    desc: "Tim memberi petunjuk tanpa kata terlarang. Juri tim lawan menilai dengan 👍 / 👎.",
    tags: ["👍 Gestur", "Kerja sama tim"],
  },
  {
    id: "akun", n: 4, emoji: "⚖️", accent: "#22c55e", title: "Debit atau Kredit?",
    desc: "Layar jadi Akun T raksasa. Angkat tangan ke sisi DEBIT atau KREDIT — estafet bergantian!",
    tags: ["🙋 Angkat tangan", "📒 Jurnal AKL"],
  },
];

export default function home(root) {
  const b = bag();
  setCam("dim");
  tracker.off();

  root.innerHTML = `
    <div class="home">
      <section class="home-main">
        <p class="eyebrow">Bisnis Digital · Kelas XI AKL</p>
        <h1 class="hero-title">DIGIPRENEUR <span>ARENA</span></h1>
        <p class="lead">Bentuk tim, maju ke depan kamera, dan buktikan siapa calon pebisnis digital terbaik di kelas!</p>
        <div class="mode-grid">
          ${MODES.map((m) => `
            <button class="mode-card" data-go="${m.id}" style="--accent:${m.accent}">
              <span class="mode-num">MODE ${m.n}</span>
              <h3><span class="mode-emoji">${m.emoji}</span>${m.title}</h3>
              <p>${m.desc}</p>
              <span class="tags">${m.tags.map((t) => `<span>${t}</span>`).join("")}</span>
            </button>`).join("")}
        </div>
      </section>
      <aside class="home-side">
        <div class="panel score-panel">
          <div class="panel-head">
            <h2>🏅 Skor Tim</h2>
            <button class="btn small" data-act="teams">✏️ Atur tim</button>
          </div>
          <ol class="score-list"></ol>
          <button class="btn primary wide" data-go="podium">🏆 Podium & Foto Juara</button>
        </div>
        <div class="panel cam-panel"></div>
        <button class="btn ghost wide" data-act="help">📖 Petunjuk untuk guru</button>
      </aside>
    </div>`;

  const list = $(".score-list", root);
  function renderScores() {
    const max = Math.max(1, ...store.teams.map((t) => t.score));
    list.innerHTML = store.teams.map((t, i) => `
      <li style="--c:${teamColor(i)}; --w:${(t.score / max) * 100}%">
        <span class="bar"></span>
        <i></i><b class="name">${esc(t.name)}</b>
        <span class="pts">${num(t.score)}</span>
        <span class="adj">
          <button data-adj="-10" data-i="${i}" title="Kurangi 10">−</button>
          <button data-adj="10" data-i="${i}" title="Tambah 10">+</button>
        </span>
      </li>`).join("");
  }

  const camPanel = $(".cam-panel", root);
  function renderCam() {
    let html;
    if (camera.status === "on") {
      const trk = {
        loading: `<span class="dotload"></span> Memuat pelacak tangan…`,
        ready: `✅ Pelacak tangan siap`,
        error: `⚠️ Pelacak tangan gagal — pakai mouse/keyboard`,
        idle: `⚪ Pelacak tangan belum aktif`,
      }[tracker.status];
      html = `<div class="cam-ok"><b>🎥 Kamera aktif</b><span>${trk}</span></div>
              <button class="btn small" data-act="camera">Pengaturan</button>`;
    } else if (camera.status === "starting") {
      html = `<div class="cam-ok"><b>🎥 Membuka kamera…</b><span>Klik <b>Izinkan</b> jika browser bertanya.</span></div>`;
    } else {
      html = `<div class="cam-bad"><b>🎥 Kamera belum aktif</b><span>${esc(camera.error || "Game ini memakai kamera TV di depan kelas.")}</span></div>
              <button class="btn primary small" data-act="cam-start">Nyalakan kamera</button>`;
    }
    camPanel.innerHTML = html;
  }

  b.add(store.on(renderScores));
  b.add(camera.on(renderCam));
  b.add(tracker.onStatus(renderCam));
  renderScores();
  renderCam();

  root.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-go], [data-act], [data-adj]");
    if (!t) return;
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.adj) return store.addScore(+t.dataset.i, +t.dataset.adj);
    const act = t.dataset.act;
    if (act === "teams") openTeamsModal();
    if (act === "camera") openCameraModal();
    if (act === "help") openHelpModal();
    if (act === "cam-start") {
      const ok = await camera.start(store.settings.deviceId);
      if (ok && camera.deviceId) store.setSetting("deviceId", camera.deviceId);
    }
  });

  return () => b.run();
}
