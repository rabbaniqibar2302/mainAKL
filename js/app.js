// Titik masuk aplikasi
import { store, teamColor } from "./store.js";
import { camera } from "./camera.js";
import { tracker } from "./tracker.js";
import { sfx } from "./sfx.js";
import { register, go, currentScreen } from "./router.js";
import { $, esc, num } from "./ui.js";
import { openCameraModal, openHelpModal } from "./modals.js";
import home from "./screens/home.js";
import duel from "./screens/duel.js";
import live from "./screens/live.js";
import tebak from "./screens/tebak.js";
import podium from "./screens/podium.js";

camera.init($("#cam"));
sfx.enabled = store.settings.sound;

register("home", home);
register("duel", duel);
register("live", live);
register("tebak", tebak);
register("podium", podium);

// ---------- Bar atas ----------
const mini = $("#mini-scores");
function renderMiniScores() {
  const bump = store.lastBump && Date.now() - store.lastBump.at < 800 ? store.lastBump.i : -1;
  mini.innerHTML = store.teams
    .map((t, i) => `<span class="mini ${i === bump ? "bump" : ""}" style="--c:${teamColor(i)}"><i></i>${esc(t.name)} <b>${num(t.score)}</b></span>`)
    .join("");
}
store.on(renderMiniScores);
renderMiniScores();

const chip = $("#trk-status");
function renderStatus() {
  let state = "idle", text = "🖐 Pelacak tangan";
  if (camera.status === "error") { state = "error"; text = "🎥 Kamera bermasalah"; }
  else if (camera.status === "starting") { state = "loading"; text = "🎥 Membuka kamera…"; }
  else if (camera.status === "off") { state = "idle"; text = "🎥 Kamera mati"; }
  else if (tracker.status === "loading") { state = "loading"; text = "🖐 Memuat pelacak tangan…"; }
  else if (tracker.status === "ready") { state = "ok"; text = "🖐 Kamera & tangan siap"; }
  else if (tracker.status === "error") { state = "warn"; text = "🖐 Mode mouse/keyboard"; }
  chip.dataset.state = state;
  chip.textContent = text;
}
camera.on(renderStatus);
tracker.onStatus(renderStatus);
chip.addEventListener("click", openCameraModal);

const soundBtn = $('[data-top="sound"]');
const paintSound = () => (soundBtn.textContent = sfx.enabled ? "🔊" : "🔇");
paintSound();

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

$("#topbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-top]");
  if (!b) return;
  const act = b.dataset.top;
  if (act === "home") go("home");
  if (act === "camera") openCameraModal();
  if (act === "help") openHelpModal();
  if (act === "fullscreen") toggleFullscreen();
  if (act === "sound") {
    sfx.enabled = !sfx.enabled;
    store.setSetting("sound", sfx.enabled);
    paintSound();
    sfx.select();
  }
});

addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, select, textarea")) return;
  if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey) toggleFullscreen();
});

// Audio di browser baru boleh bunyi setelah ada interaksi pertama
addEventListener("pointerdown", () => sfx.unlock(), { once: true });
addEventListener("keydown", () => sfx.unlock(), { once: true });

// ---------- Mulai ----------
go("home");
tracker.load();
camera.start(store.settings.deviceId).then((ok) => {
  if (ok && camera.deviceId && camera.deviceId !== store.settings.deviceId) store.setSetting("deviceId", camera.deviceId);
});

// Untuk debug di console
window.__arena = { store, camera, tracker, go, currentScreen };
