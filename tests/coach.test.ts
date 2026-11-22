import { describe, expect, it } from 'vitest';
import { askCoach, buildFacts, isCrisis, offlineReply } from '../src/lib/ai';
import { buildSystemPrompt, PLAYBOOK, RULES, sanitizeFacts } from '../src/lib/coachPrompt';
import { defaultState, type AppState } from '../src/lib/store';
import { SCENARIOS } from './coach-scenarios';

const st = (p: Partial<AppState> = {}): AppState => ({
  ...defaultState(),
  profile: { nickname: 'Tester', why: 'focus and energy', goalDays: 90, createdAt: Date.now() },
  streakStart: Date.now() - 3 * 86_400_000,
  journeyStart: Date.now() - 10 * 86_400_000,
  ...p,
});

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe('coach test set: offline coach', () => {
  for (const sc of SCENARIOS.filter((x) => !x.liveOnly)) {
    it(sc.id, () => {
      const reply = offlineReply(sc.input, st());
      for (const re of sc.must ?? []) expect(reply, `${sc.id} must match ${re}`).toMatch(re);
      for (const re of sc.mustNot ?? []) expect(reply, `${sc.id} must not match ${re}`).not.toMatch(re);
      if (sc.maxWords) expect(words(reply)).toBeLessThanOrEqual(sc.maxWords);
    });
  }
});

describe('crisis routing', () => {
  it('detects crisis phrasing, and not ordinary words', () => {
    for (const t of ['kms', 'better off dead', 'no reason to live', 'unalive myself', 'I want to die']) expect(isCrisis(t)).toBe(true);
    for (const t of ['dead tired lol', 'this flatline is dead boring', 'kill the urge', 'skills']) expect(isCrisis(t)).toBe(false);
  });

  it('crisis messages never reach the cloud, whatever the provider', async () => {
    const s = st({ settings: { ...defaultState().settings, provider: 'lockedin', aiConsent: true } });
    const r = await askCoach(s, [{ role: 'user', content: 'i want to kill myself', at: 0 }]);
    expect(r.offline).toBe(true);
    expect(r.text).toMatch(/findahelpline/);
  });
});

describe('built-in coach consent', () => {
  it('sends nothing until the user opts in', async () => {
    const s = st(); // default provider 'lockedin', aiConsent false
    const r = await askCoach(s, [{ role: 'user', content: 'hey', at: 0 }]);
    expect(r.offline).toBe(true);
  });
});

describe('coach prompt', () => {
  it('contains the rules, playbook and examples', () => {
    const p = buildSystemPrompt(sanitizeFacts({ nickname: 'x' }));
    expect(p).toContain(RULES);
    expect(p).toContain(PLAYBOOK);
    expect(p).toContain('Examples of ideal replies');
    expect(p).toMatch(/SAFETY FIRST[\s\S]*NO SEXUAL CONTENT[\s\S]*STAY ON TOPIC/);
  });

  it('facts sent to the AI exclude journal text', () => {
    const s = st({
      relapses: [
        { id: 'a', at: Date.now() - 86_400_000, streakMs: 86_400_000, triggers: ['late'], emotions: ['tired'], place: 'Bedroom', story: 'PRIVATE-STORY-TEXT', plan: 'phone out of bedroom', intensity: 3 },
      ],
      checkins: [{ day: '2026-11-21', at: Date.now(), mood: 2, urge: 5, note: 'PRIVATE-NOTE' }],
    });
    const f = JSON.stringify(buildFacts(s));
    expect(f).not.toContain('PRIVATE-STORY-TEXT');
    expect(f).not.toContain('PRIVATE-NOTE');
    expect(f).toContain('phone out of bedroom');
  });

  it('sanitizeFacts strips tags and caps sizes', () => {
    const f = sanitizeFacts({ nickname: '<script>x</script>' + 'a'.repeat(100), topTriggers: ['a', 'b', 'c', 'd'], recoveryRate: 9999 });
    expect(f.nickname).not.toMatch(/[<>]/);
    expect(f.nickname.length).toBeLessThanOrEqual(24);
    expect(f.topTriggers).toHaveLength(3);
    expect(f.recoveryRate).toBe(100);
  });
});
