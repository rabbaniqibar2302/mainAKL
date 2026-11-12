// Jendela pengaturan: kamera, tim, petunjuk
import { store, teamColor } from "./store.js";
import { camera } from "./camera.js";
import { tracker } from "./tracker.js";
import { $, $$, el, esc, openModal, confirmBox, toast } from "./ui.js";

// ---------------- Kamera ----------------
export function openCameraModal() {
  const body = el(`<div class="stack"></div>`);
  const off = [];

  function render() {
    const devs = camera.devices;
    const camText = {
      on: "✅ Kamera aktif",
      starting: "⏳ Membuka kamera…",
      off: "⚪ Kamera belum menyala",
      error: "❌ " + esc(camera.error),
    }[camera.status];
    const trkText = {
      idle: "⚪ Belum dimuat",
      loading: "⏳ Sedang memuat model (±17 MB, hanya sekali)…",
      ready: "✅ Siap — jari telunjuk bisa dipakai sebagai kursor",
      error: "❌ Gagal dimuat — game tetap bisa dimainkan dengan mouse/keyboard. (" + esc(tracker.error) + ")",
    }[tracker.status];

    body.innerHTML = `
      <div class="status-box ${camera.status}"><b>Kamera</b><span>${camText}</span></div>
      <label class="field">
        <span class="label">Pilih kamera (pakai kamera TV / webcam USB)</span>
        <select id="cam-select">
          ${devs.length ? devs.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === camera.deviceId ? "selected" : ""}>${esc(d.label || "Kamera " + (i + 1))}</option>`).join("") : `<option value="">(belum ada daftar kamera)</option>`}
        </select>
      </label>
      <div class="row"><button class="btn" data-act="restart">🔄 Nyalakan ulang kamera</button></div>
      <div class="status-box ${tracker.status === "ready" ? "on" : tracker.status === "error" ? "error" : ""}"><b>Pelacak tangan</b><span>${trkText}</span></div>
      ${tracker.status === "error" ? `<div class="row"><button class="btn" data-act="reload-trk">🔄 Coba muat ulang pelacak</button></div>` : ""}
      <label class="switch"><input type="checkbox" id="opt-pointer" ${store.settings.pointer ? "checked" : ""}><span>Tampilkan lingkaran kursor di ujung jari</span></label>
      <label class="switch"><input type="checkbox" id="opt-near" ${store.settings.nearOnly ? "checked" : ""}><span>Abaikan tangan yang jauh (siswa yang duduk di belakang tidak ikut terbaca)</span></label>
      <div class="tips">
        <b>Tips posisi kamera</b>
        <ul>
          <li>Pemain berdiri ±1,5–2,5 meter dari kamera, seluruh badan atas terlihat.</li>
          <li>Ruangan cukup terang; hindari jendela terang tepat di belakang pemain.</li>
          <li>Kalau kursor jari “loncat-loncat”, turunkan jumlah orang yang mengangkat tangan di belakang atau aktifkan opsi “Abaikan tangan yang jauh”.</li>
        </ul>
      </div>`;
  }

  body.addEventListener("change", async (e) => {
    if (e.target.id === "cam-select" && e.target.value) {
      store.setSetting("deviceId", e.target.value);
      await camera.start(e.target.value);
    }
    if (e.target.id === "opt-pointer") store.setSetting("pointer", e.target.checked);
    if (e.target.id === "opt-near") store.setSetting("nearOnly", e.target.checked);
  });
  body.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "restart") {
      const ok = await camera.start(store.settings.deviceId);
      if (ok && camera.deviceId) store.setSetting("deviceId", camera.deviceId);
    }
    if (act === "reload-trk") { tracker.status = "idle"; tracker.load(); }
  });

  off.push(camera.on(render));
  off.push(tracker.onStatus(render));
  render();
  openModal({ title: "🎥 Kamera & Pelacak Tangan", body, actions: [{ label: "Selesai", kind: "primary" }], onClose: () => off.forEach((f) => f()) });
}

// ---------------- Tim ----------------
export function openTeamsModal() {
  let names = store.teams.map((t) => t.name);
  const body = el(`<div class="stack"></div>`);

  function render() {
    body.innerHTML = `
      <div class="field">
        <span class="label">Jumlah tim</span>
        <div class="seg" data-field="count">${[2, 3, 4, 5, 6].map((n) => `<button type="button" data-v="${n}" aria-pressed="${n === names.length}">${n} tim</button>`).join("")}</div>
      </div>
      <div class="team-inputs">
        ${names.map((n, i) => `
          <label class="team-input" style="--c:${teamColor(i)}">
            <i></i><input type="text" maxlength="18" data-i="${i}" value="${esc(n)}" placeholder="${esc(store.defaultName(i))}">
          </label>`).join("")}
      </div>
      <p class="muted small">Tips: kelas ±36 siswa → 4 tim berisi 9 orang. Nama boleh kreatif, misalnya nama “brand” tiap tim 😉</p>`;
  }
  body.addEventListener("input", (e) => {
    if (e.target.matches("input[data-i]")) names[+e.target.dataset.i] = e.target.value;
  });
  body.addEventListener("click", (e) => {
    const b = e.target.closest('[data-field="count"] [data-v]');
    if (!b) return;
    const n = +b.dataset.v;
    names = Array.from({ length: n }, (_, i) => names[i] ?? store.defaultName(i));
    render();
  });
  render();

  openModal({
    title: "✏️ Atur Tim",
    body,
    actions: [
      {
        label: "Reset semua skor", kind: "danger",
        onClick: () => {
          confirmBox("Reset skor?", "Semua skor tim akan kembali ke 0.", "Ya, reset").then((ok) => {
            if (ok) { store.resetScores(); toast("Skor direset ke 0"); }
          });
          return false;
        },
      },
      { label: "Simpan", kind: "primary", onClick: () => { store.setTeams(names); toast("Tim disimpan ✔"); } },
    ],
  });
}

// ---------------- Petunjuk ----------------
export function openHelpModal() {
  openModal({
    title: "📖 Petunjuk untuk Guru",
    wide: true,
    body: `
      <div class="help">
        <section>
          <h3>Persiapan (sekali saja)</h3>
          <ol>
            <li>Sambungkan laptop ke TV, pasang webcam di atas/bawah TV menghadap kelas.</li>
            <li>Buka link game (Vercel) di Google Chrome / Edge → izinkan <b>Kamera</b>.</li>
            <li>Tekan <kbd>F</kbd> untuk layar penuh. Atur tim lewat <b>✏️ Atur tim</b>.</li>
            <li>Tunggu status pojok kanan atas menjadi <b>🖐 Kamera & tangan siap</b>.</li>
          </ol>
        </section>
        <section>
          <h3>⚔️ Duel Cepat Tepat</h3>
          <p>2 wakil tim berdiri di kiri & kanan layar. Jawab dengan menunjuk huruf A–D <b>di udara</b> dan menahan jari ±1 detik. Pertama benar +100. Salah = terkunci.</p>
          <p class="small muted">Keyboard: tim kiri <kbd>1</kbd>–<kbd>4</kbd>, tim kanan <kbd>7</kbd> <kbd>8</kbd> <kbd>9</kbd> <kbd>0</kbd>, lanjut <kbd>Spasi</kbd>.</p>
        </section>
        <section>
          <h3>🔴 Live Jualan</h3>
          <p>Tim dapat misi acak (produk, target pembeli, promo, HPP). Setelah waktu persiapan, 1–2 host berjualan LIVE di depan kamera. Tim lain menjadi penonton yang bertanya. Penonton menunjukkan 👍 ke kamera untuk mengirim ❤. Host ✌️ untuk memotret produk. Guru menilai dengan rubrik + bonus tepuk tangan.</p>
          <p class="small muted">Keyboard saat live: <kbd>L</kbd> like, <kbd>P</kbd> foto, <kbd>Spasi</kbd> akhiri live.</p>
        </section>
        <section>
          <h3>🗣️ Tebak Istilah</h3>
          <p>Penebak berdiri membelakangi layar. Timnya memberi petunjuk tanpa menyebut kata terlarang. Juri dari tim lain berdiri di samping TV menghadap kamera: 👍 = benar (+50), 👎 = lewati/melanggar.</p>
          <p class="small muted">Keyboard / clicker presentasi: <kbd>→</kbd> atau <kbd>PageDown</kbd> = benar, <kbd>←</kbd> atau <kbd>PageUp</kbd> = lewati.</p>
        </section>
        <section>
          <h3>Lain-lain</h3>
          <ul>
            <li>Skor tersimpan otomatis di browser ini (tidak hilang saat refresh).</li>
            <li>Tombol <b>−/+</b> di panel skor untuk bonus/penalti manual.</li>
            <li>Soal, kartu istilah, dan produk bisa diubah di file <code>js/data.js</code>.</li>
            <li>Semua pemrosesan kamera terjadi di laptop ini — tidak ada video yang diunggah ke internet.</li>
          </ul>
        </section>
      </div>`,
    actions: [{ label: "Mengerti 👍", kind: "primary" }],
  });
}
