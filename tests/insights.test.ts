import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/insights';
import { defaultState, type AppState, type Relapse } from '../src/lib/store';
import { DAY } from '../src/lib/streak';

const rel = (at: Date, days: number, triggers: string[] = ['bored'], emotions: string[] = ['empty']): Relapse => ({
  id: String(at.getTime()),
  at: at.getTime(),
  streakMs: days * DAY,
  triggers,
  emotions,
  place: '',
  story: '',
  plan: '',
  intensity: 3,
});

const st = (p: Partial<AppState>): AppState => ({ ...defaultState(), ...p });

describe('analyze', () => {
  it('empty state', () => {
    const i = analyze(st({}), Date.now());
    expect(i.relapseCount).toBe(0);
    expect(i.dangerNow).toBeNull();
    expect(i.trend).toBe('none');
    expect(i.worstBlock).toBeNull();
  });

  it('builds the weekday x 4h-block heatmap and finds the worst slot', () => {
    // Sunday 22 Nov 2026, 01:30 and 02:00 (block 0) + Tuesday 14:00 (block 3)
    const s = st({
      relapses: [rel(new Date(2026, 10, 22, 1, 30), 2), rel(new Date(2026, 10, 15, 2, 0), 3), rel(new Date(2026, 10, 17, 14, 0), 4)],
    });
    const i = analyze(s, new Date(2026, 10, 22, 12).getTime());
    expect(i.grid[0][0]).toBe(2);
    expect(i.grid[2][3]).toBe(1);
    expect(i.maxCell).toBe(2);
    expect(i.worstBlock).toBe(0);
    expect(i.worstDay).toBe(0);
    expect(i.avgStreakDays).toBe(3);
  });

  it('ranks triggers and emotions by frequency', () => {
    const d = new Date(2026, 10, 10, 12);
    const s = st({ relapses: [rel(d, 1, ['late', 'bed']), rel(d, 1, ['late']), rel(d, 1, ['bored'], ['sad'])] });
    const i = analyze(s);
    expect(i.triggers[0]).toEqual(['late', 2]);
    expect(i.emotions[0]).toEqual(['empty', 2]);
  });

  it('detects improving and worsening trends', () => {
    const d = new Date(2026, 10, 10, 12);
    expect(analyze(st({ relapses: [1, 1, 5, 6].map((n) => rel(d, n)) })).trend).toBe('up');
    expect(analyze(st({ relapses: [6, 5, 1, 1].map((n) => rel(d, n)) })).trend).toBe('down');
    expect(analyze(st({ relapses: [3, 3, 3, 3].map((n) => rel(d, n)) })).trend).toBe('flat');
  });

  it('warns when you are inside your danger window', () => {
    const s = st({
      streakStart: new Date(2026, 10, 20).getTime(),
      relapses: [rel(new Date(2026, 10, 1, 23, 0), 1), rel(new Date(2026, 10, 5, 22, 0), 2), rel(new Date(2026, 10, 9, 21, 0), 9)],
    });
    const at11pm = new Date(2026, 10, 22, 23, 0).getTime();
    const atNoon = new Date(2026, 10, 22, 12, 0).getTime();
    expect(analyze(s, at11pm).dangerNow).toMatch(/danger window/);
    expect(analyze(s, atNoon).dangerNow ?? '').not.toMatch(/danger window/);
  });

  it('warns when near your usual breaking point', () => {
    const now = new Date(2026, 10, 22, 12).getTime();
    const s = st({
      streakStart: now - 5 * DAY,
      // relapses at 08:00 and 20:00 (Thu/Tue) so "now" (Sun 12:00) is not in a danger window or worst day
      relapses: [rel(new Date(2026, 9, 1, 8), 5), rel(new Date(2026, 9, 20, 20), 5)],
    });
    expect(analyze(s, now).dangerNow).toMatch(/usually break/);
  });

  it('counts urges and 7-day check-in averages', () => {
    const now = Date.now();
    const s = st({
      urges: [
        { at: now, won: true, tool: 'bonk' },
        { at: now, won: true, tool: 'breathe' },
        { at: now, won: false, tool: 'surf' },
      ],
      checkins: [
        { day: '2026-11-20', at: now - DAY, mood: 4, urge: 2, note: '' },
        { day: '2026-11-21', at: now - 2 * DAY, mood: 2, urge: 6, note: '' },
        { day: '2026-10-01', at: now - 30 * DAY, mood: 1, urge: 10, note: '' },
      ],
    });
    const i = analyze(s, now);
    expect(i.urgesWon).toBe(2);
    expect(i.urgesLost).toBe(1);
    expect(i.avgMood7).toBe(3);
    expect(i.avgUrge7).toBe(4);
  });
});
