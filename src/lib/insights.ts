import type { AppState } from './store';
import { DAY, streakMs } from './streak';

export const BLOCKS = ['00–04', '04–08', '08–12', '12–16', '16–20', '20–24'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface Insights {
  relapseCount: number;
  triggers: [string, number][];
  emotions: [string, number][];
  grid: number[][]; // [weekday][block]
  maxCell: number;
  avgStreakDays: number;
  trend: 'up' | 'down' | 'flat' | 'none';
  dangerNow: string | null;
  urgesWon: number;
  urgesLost: number;
  avgMood7: number | null;
  avgUrge7: number | null;
  worstBlock: number | null;
  worstDay: number | null;
}

function countBy(list: string[]) {
  const m = new Map<string, number>();
  list.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function analyze(s: AppState, now = Date.now()): Insights {
  const rel = s.relapses;
  const grid = Array.from({ length: 7 }, () => Array(6).fill(0) as number[]);
  rel.forEach((r) => {
    const d = new Date(r.at);
    grid[d.getDay()][Math.floor(d.getHours() / 4)]++;
  });
  const maxCell = Math.max(0, ...grid.flat());

  const blockTotals = BLOCKS.map((_, b) => grid.reduce((a, row) => a + row[b], 0));
  const dayTotals = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const worstBlock = rel.length ? blockTotals.indexOf(Math.max(...blockTotals)) : null;
  const worstDay = rel.length ? dayTotals.indexOf(Math.max(...dayTotals)) : null;

  const lengths = rel.map((r) => r.streakMs / DAY);
  const avgStreakDays = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

  let trend: Insights['trend'] = 'none';
  if (lengths.length >= 4) {
    const half = Math.floor(lengths.length / 2);
    const early = lengths.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const late = lengths.slice(half).reduce((a, b) => a + b, 0) / (lengths.length - half);
    trend = late > early * 1.15 ? 'up' : late < early * 0.85 ? 'down' : 'flat';
  }

  // --- Danger prediction: something most apps never do -----------------------
  let dangerNow: string | null = null;
  const nowD = new Date(now);
  const curBlock = Math.floor(nowD.getHours() / 4);
  const curDays = streakMs(s, now) / DAY;
  if (rel.length >= 2) {
    const inBlock = blockTotals[curBlock];
    if (inBlock / rel.length >= 0.34) {
      dangerNow = `Heads up: ${Math.round((inBlock / rel.length) * 100)}% of your relapses happened between ${BLOCKS[curBlock]}h. You're in the danger window right now.`;
    } else if (avgStreakDays >= 1 && curDays >= avgStreakDays * 0.8 && curDays <= avgStreakDays * 1.2) {
      dangerNow = `You're close to where your streaks usually break (~${avgStreakDays.toFixed(1)} days). This is where you level up. Stay sharp.`;
    } else if (worstDay !== null && worstDay === nowD.getDay() && dayTotals[worstDay] / rel.length >= 0.3) {
      dangerNow = `${WEEKDAYS[worstDay]} is statistically your toughest day. Have a plan for tonight.`;
    }
  }

  const last7 = s.checkins.filter((c) => now - c.at < 7 * DAY);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  return {
    relapseCount: rel.length,
    triggers: countBy(rel.flatMap((r) => r.triggers)),
    emotions: countBy(rel.flatMap((r) => r.emotions)),
    grid,
    maxCell,
    avgStreakDays,
    trend,
    dangerNow,
    urgesWon: s.urges.filter((u) => u.won).length,
    urgesLost: s.urges.filter((u) => !u.won).length,
    avgMood7: avg(last7.map((c) => c.mood)),
    avgUrge7: avg(last7.map((c) => c.urge)),
    worstBlock,
    worstDay,
  };
}
