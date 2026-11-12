// Akses kamera (webcam TV / laptop)
const listeners = new Set();

export const camera = {
  video: null,
  stream: null,
  status: "off", // off | starting | on | error
  error: "",
  devices: [],
  deviceId: null,

  init(videoEl) { this.video = videoEl; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn(this)); },

  async start(deviceId = null) {
    this.stop();
    this.status = "starting";
    this.error = "";
    this.emit();

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return this.fail("Kamera hanya bisa dipakai lewat alamat https:// (misalnya link Vercel) atau localhost.");
    }

    const base = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    const tryGet = (video) => navigator.mediaDevices.getUserMedia({ audio: false, video });
    try {
      try {
        this.stream = await tryGet(deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: "user" });
      } catch (e) {
        // kamera yang tersimpan sudah dicabut → pakai kamera apa saja
        if (deviceId && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) this.stream = await tryGet(base);
        else throw e;
      }
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      if (!this.video.videoWidth) {
        await new Promise((r) => this.video.addEventListener("loadedmetadata", r, { once: true }));
      }
      const track = this.stream.getVideoTracks()[0];
      this.deviceId = track?.getSettings?.().deviceId || deviceId;
      this.status = "on";
      document.body.classList.add("cam-on");
      await this.listDevices();
      this.emit();
      return true;
    } catch (e) {
      console.warn("Kamera gagal:", e);
      const msg = {
        NotAllowedError: "Izin kamera ditolak. Klik ikon 🔒/kamera di address bar → Izinkan kamera, lalu muat ulang halaman.",
        NotFoundError: "Kamera tidak ditemukan. Pastikan webcam sudah terpasang.",
        NotReadableError: "Kamera sedang dipakai aplikasi lain (Zoom/Meet/OBS?). Tutup dulu aplikasinya, lalu coba lagi.",
        OverconstrainedError: "Kamera yang dipilih tidak tersedia.",
      }[e.name] || "Kamera tidak bisa dibuka: " + (e.message || e.name);
      return this.fail(msg);
    }
  },

  fail(msg) {
    this.status = "error";
    this.error = msg;
    document.body.classList.remove("cam-on");
    this.emit();
    return false;
  },

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.status = "off";
    document.body.classList.remove("cam-on");
  },

  async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = all.filter((d) => d.kind === "videoinput");
    } catch (_) { this.devices = []; }
    return this.devices;
  },

  get ready() { return this.status === "on" && this.video?.readyState >= 2; },

  /** Ambil gambar dari kamera (tercermin seperti di layar), dipotong menyesuaikan ukuran w×h */
  snapshot(w, h) {
    const v = this.video;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (!this.ready) {
      g.fillStyle = "#11182d"; g.fillRect(0, 0, w, h);
      return c;
    }
    const vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(w / vw, h / vh);
    const dw = vw * s, dh = vh * s;
    g.save();
    g.translate(w, 0); g.scale(-1, 1);
    g.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
    g.restore();
    return c;
  },
};
