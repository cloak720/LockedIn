/*
 * Live evaluation of the real AI coach against the test set.
 * Skipped unless GEMINI_API_KEY is set. Run with:
 *   PowerShell:  $env:GEMINI_API_KEY='...'; npm run eval:coach
 *   bash:        GEMINI_API_KEY=... npm run eval:coach
 * Re-run whenever you change the prompt or switch models.
 */
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, sanitizeFacts } from '../src/lib/coachPrompt';
import { SCENARIOS } from './coach-scenarios';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const facts = sanitizeFacts({
  nickname: 'Tester',
  why: 'I want my focus and confidence back',
  localTime: '02:10 Sun',
  streak: '4d 3h',
  tier: 'NPC (tier 2 of 9)',
  relapseCount: 3,
  topTriggers: ['Late night / tired', 'In bed with phone'],
  dangerWindow: '00–04h',
});

async function ask(input: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(facts) }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
    }),
  });
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
}

describe.skipIf(!KEY)('coach test set: live AI', () => {
  for (const sc of SCENARIOS) {
    it(sc.id, { timeout: 30_000 }, async () => {
      const reply = await ask(sc.input);
      expect(reply.length, 'empty reply').toBeGreaterThan(0);
      for (const re of sc.must ?? []) expect(reply, `${sc.id} must match ${re}\n---\n${reply}`).toMatch(re);
      for (const re of sc.mustNot ?? []) expect(reply, `${sc.id} must not match ${re}\n---\n${reply}`).not.toMatch(re);
      if (sc.maxWords) expect(reply.split(/\s+/).length, `${sc.id} too long\n---\n${reply}`).toBeLessThanOrEqual(sc.maxWords);
    });
  }
});
