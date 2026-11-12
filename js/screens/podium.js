// Podium juara + foto bersama dengan bingkai, bisa diunduh
import { store, teamColor } from "../store.js";
import { camera } from "../camera.js";
import { tracker } from "../tracker.js";
import { sfx } from "../sfx.js";
import { go, bag } from "../router.js";
import { esc, num, setCam, bigCountdown, confetti, flash, openModal, confirmBox, toast } from "../ui.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function podium(root) {
  const b = bag();
  let alive = true;
  b.add(() => (alive = false));
  b.add(() => document.body.classList.remove("photo-mode"));
  setCam("soft");
  tracker.off();

  function ranked() {
    const list = store.teams.map((t, i) => ({ ...t, i }));
    list.sort((a, c) => c.score - a.score);
    // peringkat sama jika skor sama
    list.forEach((t) => (t.rank = 1 + list.filter((x) => x.score > t.score).length));
    return list;
  }

  function render() {
    const list = ranked();
    const anyScore = list.some((t) => t.score > 0);
    const top = list.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const H = { 1: 15, 2: 11, 3: 8 };
    root.innerHTML = `
      <div class="podium-wrap">
        <header class="center-text">
          <p class="eyebrow">Papan Juara · Bisnis Digital XI AKL</p>
          <h1 class="hero-title small">🏆 Digipreneur Terbaik</h1>
          ${anyScore ? "" : `<p class="muted">Belum ada skor — mainkan dulu salah satu mode game!</p>`}
        </header>
        <div class="podium">
          ${order.map((t) => `
            <div class="step r${Math.min(t.rank, 3)}" style="--c:${teamColor(t.i)}; --h:${H[Math.min(t.rank, 3)]}rem">
              <div class="step-top">
                <span class="medal">${MEDALS[Math.min(t.rank, 3) - 1]}</span>
                <b>${esc(t.name)}</b>
                <span class="pts">${num(t.score)} poin</span>
              </div>
              <div class="step-block">${t.rank}</div>
            </div>`).join("")}
        </div>
        ${list.length > 3 ? `<ol class="rest">${list.slice(3).map((t) => `<li style="--c:${teamColor(t.i)}"><span>#${t.rank}</span><i></i><b>${esc(t.name)}</b><em>${num(t.score)} poin</em></li>`).join("")}</ol>` : ""}
        <div class="actions center">
          <button class="btn ghost" data-act="home">← Menu</button>
          <button class="btn" data-act="reset">🔄 Game baru (reset skor)</button>
          <button class="btn primary big" data-act="photo">📸 Foto Juara</button>
        </div>
      </div>`;
    if (anyScore) { sfx.win(); confetti(); }
  }

  // ---------------- Foto ----------------
  function compose() {
    const W = 1600, H = 900;
    const c = camera.snapshot(W, H);
    const g = c.getContext("2d");
    const list = ranked();
    const font = (w, s) => `${w} ${s}px "Plus Jakarta Sans", system-ui, sans-serif`;

    // gradasi atas & bawah supaya teks terbaca
    let gr = g.createLinearGradient(0, 0, 0, 200);
    gr.addColorStop(0, "rgba(7,11,22,.85)"); gr.addColorStop(1, "rgba(7,11,22,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, 200);
    gr = g.createLinearGradient(0, H - 260, 0, H);
    gr.addColorStop(0, "rgba(7,11,22,0)"); gr.addColorStop(1, "rgba(7,11,22,.92)");
    g.fillStyle = gr; g.fillRect(0, H - 260, W, 260);

    // bingkai
    gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#ffd23f"); gr.addColorStop(0.5, "#ff4d8d"); gr.addColorStop(1, "#22d3ee");
    g.strokeStyle = gr; g.lineWidth = 22; g.strokeRect(11, 11, W - 22, H - 22);

    g.textBaseline = "alphabetic";
    g.fillStyle = "#ffffff";
    g.font = font(800, 46); g.fillText("🎮 DIGIPRENEUR ARENA", 52, 88);
    g.fillStyle = "rgba(255,255,255,.8)";
    g.font = font(700, 26); g.fillText("Bisnis Digital · Kelas XI AKL", 54, 128);

    const date = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    g.textAlign = "right"; g.font = font(700, 24); g.fillText(date, W - 52, 88);
    g.textAlign = "left";

    const first = list[0];
    if (first) {
      g.fillStyle = "#ffd23f";
      g.font = font(800, 64);
      g.fillText(`🏆 JUARA 1 · ${first.name}`, 52, H - 108);
      g.fillStyle = "#ffffff";
      g.font = font(700, 30);
      const others = list.slice(1, 3).map((t, k) => `${MEDALS[k + 1]} ${t.name} (${num(t.score)})`).join("     ");
      g.fillText(`${num(first.score)} poin${others ? "     " + others : ""}`, 56, H - 56);
    }
    return c;
  }

  async function takePhoto() {
    if (!camera.ready) { toast("🎥 Kamera belum aktif. Nyalakan lewat tombol 🎥 di kanan atas."); return; }
    document.body.classList.add("photo-mode");
    setCam("full");
    toast("📸 Semua berkumpul di depan kamera! Bersiap…", 2200);
    await new Promise((r) => setTimeout(r, 1200));
    if (!alive) return;
    await bigCountdown(3, "😁");
    if (!alive) return;
    flash();
    sfx.shutter();
    const url = compose().toDataURL("image/jpeg", 0.92);
    document.body.classList.remove("photo-mode");
    setCam("soft");
    openModal({
      title: "📸 Foto Juara",
      wide: true,
      body: `<img class="photo-preview" src="${url}" alt="Foto juara kelas">`,
      actions: [
        { label: "🔁 Foto ulang", kind: "ghost", onClick: () => { setTimeout(takePhoto, 250); } },
        {
          label: "⬇️ Unduh foto", kind: "primary",
          onClick: () => {
            const a = document.createElement("a");
            const d = new Date();
            const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
            a.href = url;
            a.download = `foto-juara-xi-akl-${stamp}.jpg`;
            a.click();
            toast("⬇️ Foto diunduh");
            return false;
          },
        },
      ],
    });
  }

  root.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "home") go("home");
    if (act === "photo") takePhoto();
    if (act === "reset") {
      if (await confirmBox("Mulai game baru?", "Semua skor tim akan kembali ke 0. Nama tim tetap.", "Ya, reset")) {
        store.resetScores();
        if (alive) render();
      }
    }
  });

  render();
  return () => b.run();
}
