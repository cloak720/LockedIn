import { describe, expect, it } from 'vitest';
import { defaultState, type AppState } from '../src/lib/store';
import { DAY, fmtDuration, nextRank, rankFor, RANKS, recoveryRate, split, streakMs, totalCleanMs } from '../src/lib/streak';

const NOW = new Date(2026, 10, 22, 12, 0, 0).getTime();

function state(patch: Partial<AppState>): AppState {
  return { ...defaultState(), ...patch };
}

describe('rank ladder', () => {
  it('runs from Gooner (tier 0) to Gigachad (tier 9), strictly increasing', () => {
    expect(RANKS).toHaveLength(10);
    expect(RANKS[0].name).toMatch(/Gooner/);
    expect(RANKS[RANKS.length - 1].name).toMatch(/Gigachad/);
    RANKS.forEach((r, i) => expect(r.tier).toBe(i));
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].days).toBeGreaterThan(RANKS[i - 1].days);
  });

  it('contains no Japanese characters', () => {
    for (const r of RANKS) expect(r.name + r.line).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
  });

  it.each([
    [0, 'Certified Gooner'],
    [1, 'Recovering Gooner'],
    [6, 'NPC'],
    [7, 'Grass Toucher'],
    [13, 'Grass Toucher'],
    [14, 'Bloomer'],
    [59, 'Main Character'],
    [89, 'Sigma'],
    [90, 'Chad'],
    [180, 'Gigachad'],
    [365, 'Ascended Gigachad'],
    [5000, 'Ascended Gigachad'],
  ])('day %i -> %s', (d, name) => expect(rankFor(d).name).toBe(name));

  it('nextRank', () => {
    expect(nextRank(0)?.days).toBe(1);
    expect(nextRank(7)?.days).toBe(14);
    expect(nextRank(364)?.days).toBe(365);
    expect(nextRank(365)).toBeNull();
  });
});

describe('time maths', () => {
  it('split', () => {
    expect(split(3 * DAY + 4 * 3600_000 + 5 * 60_000 + 6000)).toEqual({ d: 3, h: 4, m: 5, s: 6 });
    expect(split(0)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });

  it('fmtDuration', () => {
    expect(fmtDuration(30 * 60_000)).toBe('30m');
    expect(fmtDuration(2 * 3600_000 + 5 * 60_000)).toBe('2h 5m');
    expect(fmtDuration(8 * DAY + 3 * 3600_000)).toBe('8d 3h');
  });

  it('streakMs is 0 without a start and never negative', () => {
    expect(streakMs(state({}), NOW)).toBe(0);
    expect(streakMs(state({ streakStart: NOW + 5000 }), NOW)).toBe(0);
    expect(streakMs(state({ streakStart: NOW - DAY }), NOW)).toBe(DAY);
  });

  it('totalCleanMs keeps time from broken streaks', () => {
    const s = state({
      streakStart: NOW - 2 * DAY,
      relapses: [{ id: 'a', at: NOW - 2 * DAY, streakMs: 5 * DAY, triggers: [], emotions: [], place: '', story: '', plan: '', intensity: 3 }],
    });
    expect(totalCleanMs(s, NOW)).toBe(7 * DAY);
  });
});

describe('recoveryRate', () => {
  it('is 100% with no relapses', () => {
    expect(recoveryRate(state({ journeyStart: NOW - 10 * DAY }), NOW)).toBe(100);
  });

  it('counts distinct relapse days, not relapse count', () => {
    const r = (at: number) => ({ id: String(at), at, streakMs: 0, triggers: [], emotions: [], place: '', story: '', plan: '', intensity: 3 });
    const s = state({
      journeyStart: NOW - 10 * DAY,
      relapses: [r(NOW - 3 * DAY), r(NOW - 3 * DAY + 60_000), r(NOW - DAY)], // 2 distinct days
    });
    expect(recoveryRate(s, NOW)).toBe(80);
  });

  it('never goes below 0 or above 100', () => {
    const r = (at: number) => ({ id: String(at), at, streakMs: 0, triggers: [], emotions: [], place: '', story: '', plan: '', intensity: 3 });
    const s = state({ journeyStart: NOW - 1000, relapses: [r(NOW - 500), r(NOW - 400 - DAY * 2)] });
    const v = recoveryRate(s, NOW);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});
