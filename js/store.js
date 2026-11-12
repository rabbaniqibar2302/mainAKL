// Penyimpanan skor & pengaturan (otomatis tersimpan di browser lewat localStorage)
const KEY = "digipreneur-arena:v1";

export const TEAM_COLORS = ["#ff4d6d", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6"];
const DEFAULT_NAMES = ["Tim Merah", "Tim Biru", "Tim Hijau", "Tim Kuning", "Tim Ungu", "Tim Tosca"];

export const teamColor = (i) => TEAM_COLORS[i % TEAM_COLORS.length];

function defaults() {
  return {
    teams: [0, 1, 2, 3].map((i) => ({ name: DEFAULT_NAMES[i], score: 0 })),
    settings: { sound: true, deviceId: null, pointer: true, nearOnly: false },
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.teams) && s.teams.length >= 2) {
      const d = defaults();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
    }
  } catch (_) { /* abaikan */ }
  return defaults();
}

const listeners = new Set();

export const store = {
  state: load(),
  lastBump: null,
  get teams() { return this.state.teams; },
  get settings() { return this.state.settings; },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (_) { /* mode privat */ }
    listeners.forEach((fn) => fn(this.state));
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  addScore(i, n) {
    const t = this.state.teams[i];
    if (!t || !n) return;
    t.score = Math.max(0, t.score + n);
    this.lastBump = { i, n, at: Date.now() };
    this.save();
  },
  resetScores() {
    this.state.teams.forEach((t) => (t.score = 0));
    this.save();
  },
  setTeams(names) {
    const old = this.state.teams;
    this.state.teams = names.map((name, i) => ({
      name: name.trim() || DEFAULT_NAMES[i] || `Tim ${i + 1}`,
      score: old[i]?.score || 0,
    }));
    this.save();
  },
  defaultName: (i) => DEFAULT_NAMES[i] || `Tim ${i + 1}`,
  setSetting(k, v) { this.state.settings[k] = v; this.save(); },
};
