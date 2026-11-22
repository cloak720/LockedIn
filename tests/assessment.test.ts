import { describe, expect, it } from 'vitest';
import { DIM_INFO, LEVELS, levelFor, QUESTIONS, scoreAssessment } from '../src/lib/assessment';

const SLOW = 5000; // ms per question: a thoughtful answerer

function answersWith(fn: (id: string, dim: string) => number) {
  const a: Record<string, number> = {};
  for (const q of QUESTIONS) a[q.id] = fn(q.id, q.dim);
  return a;
}

describe('assessment content', () => {
  it('has unique question ids and every option is in range', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(1);
      for (const o of q.options) expect(o.value).toBeGreaterThanOrEqual(0);
      if (q.dim !== 'safety') for (const o of q.options) expect(o.value).toBeLessThanOrEqual(4);
    }
  });

  it('dimension weights sum to 1', () => {
    const sum = Object.values(DIM_INFO).reduce((a, d) => a + d.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('categories run from Chad-Adjacent to Gooner Final Boss', () => {
    expect(LEVELS.low.name).toBe('Chad-Adjacent');
    expect(LEVELS.moderate.name).toBe('Part-Time Gooner');
    expect(LEVELS.high.name).toBe('Certified Gooner');
    expect(LEVELS.severe.name).toBe('Gooner Final Boss');
    for (const l of Object.values(LEVELS)) {
      expect(l.tag.length).toBeGreaterThan(2);
      expect(l.goalDays).toBeGreaterThan(0);
    }
  });
});

describe('levelFor boundaries', () => {
  it.each([
    [0, 'low'],
    [24, 'low'],
    [25, 'moderate'],
    [49, 'moderate'],
    [50, 'high'],
    [74, 'high'],
    [75, 'severe'],
    [100, 'severe'],
  ])('%i -> %s', (score, level) => expect(levelFor(score)).toBe(level));
});

describe('scoreAssessment', () => {
  it('all zeros (and honest cross-checks) = 0, low, fully consistent', () => {
    const r = scoreAssessment(answersWith((_, dim) => (dim === 'cross' ? 4 : 0)), SLOW);
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
    expect(r.flags).toEqual([]);
    expect(r.consistency).toBe(100);
  });

  it('max behaviour with honest cross-checks = 100, severe, no flags', () => {
    const r = scoreAssessment(answersWith((id, dim) => (dim === 'cross' ? 0 : id === 'safety' ? 0 : 4)), SLOW);
    expect(r.score).toBe(100);
    expect(r.level).toBe('severe');
    expect(r.flags).toEqual([]);
    expect(r.consistency).toBe(100);
  });

  it('flags minimising contradictions and nudges the score up', () => {
    // behaviour = "often" (3) everywhere, but claims "I could stop anytime" etc. (4)
    const r = scoreAssessment(answersWith((id, dim) => (dim === 'cross' ? 4 : id === 'safety' ? 0 : 3)), SLOW);
    expect(r.flags).toHaveLength(3);
    expect(r.score).toBe(75 + 9); // 3 per contradiction
    expect(r.consistency).toBeLessThan(50);
  });

  it('does NOT flag when the self-image is harsher than behaviour', () => {
    const r = scoreAssessment(answersWith((id, dim) => (dim === 'cross' ? 0 : 0)), SLOW);
    expect(r.flags).toEqual([]);
  });

  it('penalises speed-running', () => {
    const honest = answersWith((_, dim) => (dim === 'cross' ? 4 : 0));
    const fast = scoreAssessment(honest, 400);
    expect(fast.flags.some((f) => f.includes('speedran'))).toBe(true);
    expect(fast.consistency).toBe(75);
    expect(fast.score).toBe(0); // speed alone never changes the crisis score
  });

  it('safety answer is recorded but never scored', () => {
    const base = answersWith((_, dim) => (dim === 'cross' ? 4 : 1));
    const a = scoreAssessment({ ...base, safety: 0 }, SLOW);
    const b = scoreAssessment({ ...base, safety: 2 }, SLOW);
    expect(a.score).toBe(b.score);
    expect(b.safety).toBe(2);
  });

  it('returns top 3 dims sorted by severity', () => {
    const r = scoreAssessment(answersWith((id, dim) => (dim === 'tolerance' ? 4 : dim === 'cross' ? 4 : 0)), SLOW);
    expect(r.topDims[0]).toBe('tolerance');
    expect(r.topDims).toHaveLength(3);
  });

  it('clamps score to 0..100', () => {
    const r = scoreAssessment(answersWith(() => 4), SLOW);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
