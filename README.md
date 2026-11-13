# 🎮 Digipreneur Arena — Game Bisnis Digital XI AKL

Game kelas interaktif berbasis **kamera TV di depan kelas**. Siswa bermain dalam tim, maju ke depan kamera, dan berinteraksi langsung: menunjuk jawaban **di udara** dengan jari, menangkap & memilah kartu dengan **gerakan tangan**, dan menebak istilah bisnis digital dengan bantuan teman satu tim.

- ✅ Tanpa login, tanpa database, tanpa server — cukup di-deploy ke **Vercel**
- ✅ Pelacakan tangan & gestur berjalan **100% di browser** (MediaPipe, sudah disertakan di folder `vendor/`)
- ✅ Video kamera **tidak pernah diunggah** ke internet
- ✅ Tetap bisa dimainkan dengan mouse / keyboard / clicker presentasi kalau pelacak tangan bermasalah

## 🕹️ Mode permainan

| Mode | Cara main | Interaksi antar siswa |
|---|---|---|
| ⚔️ **Duel Cepat Tepat** | 2 wakil tim berdiri di kiri & kanan layar, menjawab soal dengan menunjuk huruf A–D di udara dan menahan jari ±1 detik. Pertama benar +100. | Adu cepat 1 lawan 1, tim menyemangati, pemain bergiliran |
| 🧺 **Tangkap & Pilah** | Kartu berjatuhan dari atas layar. Pemain menyentuh kartu dengan jari untuk menangkapnya, lalu menggerakkan tangan ke keranjang kiri/kanan yang benar. 8 topik: Pendapatan/Beban, Aset/Utang, Saldo Normal Debit/Kredit, Aset Lancar/Tetap, Laba Rugi/Neraca, Promosi Organik/Berbayar, Aman/Bahaya, Produk Fisik/Digital. | 2 pemain satu tim bekerja sama, anggota tim lain berteriak memberi arahan |
| 🗣️ **Tebak Istilah** | Penebak membelakangi layar, tim memberi petunjuk tanpa kata terlarang. Juri dari tim lawan menilai dengan 👍 (benar) / 👎 (lewati) ke kamera. | Kerja sama tim + tim lawan jadi juri |
| ⚖️ **Debit atau Kredit?** | Layar jadi **Akun T raksasa** (kiri = Debit, kanan = Kredit). Muncul transaksi + satu akun; pemain mengangkat tangan ke sisi yang benar. 35 transaksi: modal, pembelian/penjualan tunai & kredit, retur, utang/piutang, prive, hingga jurnal penyesuaian. | Estafet: setiap beberapa soal ganti pemain, waktu terus berjalan |
| 🏆 **Podium & Foto Juara** | Peringkat tim + foto bersama dengan bingkai, bisa diunduh. | Seluruh kelas |

Materi mencakup: model bisnis (dropship, reseller, B2C/C2C), marketplace, pembayaran digital (QRIS, COD, paylater), digital marketing (SEO, AIDA, CTA, influencer, retargeting), CRM & customer service, keamanan (OTP, phishing, hak cipta), serta **materi AKL**: persamaan dasar akuntansi, saldo normal, siklus akuntansi, jurnal & buku besar, penyesuaian & penutupan, aset lancar/tetap, perusahaan dagang (retur, syarat 2/10 n/30, FOB), bukti transaksi, kas kecil, rekonsiliasi bank, dan hitungan: penyusutan, HPP, laba kotor, PPN, harga jual, biaya admin marketplace, diskon, ROAS, CTR, conversion rate, laba bersih, dan jurnal penjualan online.

## 🚀 Deploy ke Vercel (sekali saja, ±2 menit)

1. Buka [vercel.com](https://vercel.com) → login dengan akun GitHub.
2. Klik **Add New… → Project** → pilih repo **mainAKL** → **Import**.
3. Biarkan semua pengaturan default (Framework Preset: **Other**, tanpa build command) → klik **Deploy**.
4. Selesai! Buka link `https://….vercel.app` di Google Chrome / Microsoft Edge di laptop yang tersambung ke TV.

Setiap kali repo GitHub diperbarui, Vercel otomatis men-deploy versi terbaru.

## 📺 Persiapan di kelas

1. Sambungkan laptop ke TV, pasang webcam di atas/bawah TV menghadap kelas.
2. Buka link game → klik **Izinkan** saat browser meminta akses kamera.
3. Tekan **F** untuk layar penuh.
4. Klik **✏️ Atur tim** untuk mengisi jumlah & nama tim (2–6 tim).
5. Tunggu status di kanan atas menjadi **🖐 Kamera & tangan siap** (pertama kali memuat ±17 MB, berikutnya lebih cepat).
6. Kalau laptop punya lebih dari satu kamera, pilih kamera TV lewat tombol **🎥**.

Tips: pemain berdiri ±1,5–2,5 m dari kamera, ruangan cukup terang, dan hindari jendela terang tepat di belakang pemain.

## ⌨️ Kontrol cadangan (guru)

| Mode | Tombol |
|---|---|
| Duel | Tim kiri `1` `2` `3` `4` · Tim kanan `7` `8` `9` `0` · Lanjut `Spasi` |
| Tebak Istilah | Benar `→` / `PageDown` · Lewati `←` / `PageUp` (bisa pakai clicker presentasi) |
| Tangkap & Pilah | Seret kartu dengan mouse, atau `←` / `→` memasukkan kartu paling bawah |
| Debit atau Kredit? | `D` / `←` debit · `K` / `→` kredit |
| Semua | Layar penuh `F` |

Semua tombol di layar juga bisa diklik dengan mouse.

## ✏️ Mengubah soal & materi

Semua soal (80), kartu tebak istilah (95), kartu tangkap & pilah (8 topik), dan transaksi jurnal (35) ada di **`js/data.js`**. Edit langsung di GitHub (ikon pensil) → **Commit** → Vercel otomatis memperbarui game.

- Soal duel: pilihan **pertama** selalu jawaban yang benar (urutan diacak otomatis saat main).
- Tangkap & Pilah: tiap kartu ditulis `["teks", "L"]` (keranjang kiri) atau `["teks", "R"]` (keranjang kanan). Topik baru bisa ditambah di `SORT_SETS`.
- Debit atau Kredit?: tiap transaksi di `JOURNAL` berisi akun yang di-debit (`d`) dan di-kredit (`k`).

## 🧪 Coba di komputer sendiri (opsional)

Kamera hanya bisa dipakai lewat `https://` atau `localhost`, jadi jangan buka `index.html` dengan klik dua kali. Jalankan server lokal:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## 📁 Struktur

```
index.html            halaman utama
css/style.css         tampilan
js/data.js            ← bank soal & materi (edit di sini)
js/app.js             titik masuk, bar atas
js/camera.js          akses webcam
js/tracker.js         pelacak tangan, kursor jari, gestur
js/screens/*.js       menu, duel, pilah, tebak, akun (debit/kredit), podium
vendor/mediapipe/     library MediaPipe Tasks Vision 0.10.14 + model gestur (Apache-2.0)
```
