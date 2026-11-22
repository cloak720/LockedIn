import type { AppState } from './store';

export const DAY = 86_400_000;

export interface Rank {
  tier: number; // 0 = Certified Gooner … 9 = Ascended Gigachad
  days: number;
  name: string;
  emoji: string;
  line: string;
}

/** The ladder: from Gooner to Gigachad. Thresholds in clean days. */
export const RANKS: Rank[] = [
  { tier: 0, days: 0, name: 'Certified Gooner', emoji: '🕳️', line: 'Rock bottom has a basement. You are walking out of it, starting now.' },
  { tier: 1, days: 1, name: 'Recovering Gooner', emoji: '🩹', line: 'Day one done. The goon cave misses you. Leave it on read.' },
  { tier: 2, days: 3, name: 'NPC', emoji: '🧍', line: 'Still on default settings, but the dialogue options are loading.' },
  { tier: 3, days: 7, name: 'Grass Toucher', emoji: '🌱', line: 'One week. Grass has been touched. Reports say it was fine.' },
  { tier: 4, days: 14, name: 'Bloomer', emoji: '🌸', line: 'Two weeks. Doomer → bloomer pipeline confirmed. Flatline may hit: keep walking.' },
  { tier: 5, days: 30, name: 'Main Character', emoji: '🎬', line: 'A whole month. The OST plays when you walk into a room now.' },
  { tier: 6, days: 60, name: 'Sigma', emoji: '🐺', line: 'Sixty days. Grindset unlocked. You still text your mom back. Balance.' },
  { tier: 7, days: 90, name: 'Chad', emoji: '💪', line: '90 days. Brain rebooted. Posture improved. Probably.' },
  { tier: 8, days: 180, name: 'Gigachad', emoji: '🗿', line: 'Half a year. Jawline is now a state of mind.' },
  { tier: 9, days: 365, name: 'Ascended Gigachad', emoji: '👑', line: 'One year. Urges need a full raid party to even fight you.' },
];

export function streakMs(s: AppState, now = Date.now()) {
  return s.streakStart ? Math.max(0, now - s.streakStart) : 0;
}

export function rankFor(days: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (days >= x.days) r = x;
  return r;
}

export function nextRank(days: number): Rank | null {
  return RANKS.find((x) => x.days > days) ?? null;
}

export function split(ms: number) {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return { d, h, m, s: sec };
}

export function fmtDuration(ms: number) {
  const { d, h, m } = split(ms);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Total clean time across the whole journey — relapses don't erase this. */
export function totalCleanMs(s: AppState, now = Date.now()) {
  return s.relapses.reduce((a, r) => a + r.streakMs, 0) + streakMs(s, now);
}

/** Share of days on the journey with no relapse. The streak resets; this number doesn't. */
export function recoveryRate(s: AppState, now = Date.now()) {
  if (!s.journeyStart) return 100;
  const days = Math.max(1, Math.ceil((now - s.journeyStart) / DAY));
  const relapseDays = new Set(s.relapses.map((r) => new Date(r.at).toDateString())).size;
  return Math.max(0, Math.min(100, Math.round(((days - relapseDays) / days) * 100)));
}
