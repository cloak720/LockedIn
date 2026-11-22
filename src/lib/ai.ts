import type { AppState, ChatMsg, Provider } from './store';
import { DIM_INFO, LEVELS } from './assessment';
import { analyze, BLOCKS } from './insights';
import { DAY, fmtDuration, rankFor, recoveryRate, streakMs } from './streak';
import { labelOf, TRIGGERS } from './memes';
import { MODEL_RE } from './sanitize';
import { buildSystemPrompt as buildPromptFromFacts, CRISIS_PHRASES, type CoachFacts } from './coachPrompt';

/*
 * AI coach.
 *  - 'lockedin': built-in, free, no setup. Goes through LockedIn's relay (/api/coach), which
 *    holds the Gemini key server-side and applies a fair daily limit. Only used after the
 *    user explicitly opts in (settings.aiConsent).
 *  - 'gemini' | 'groq' | 'openrouter': bring your own key, called straight from the device.
 *  - 'offline': rule-based coach, never leaves the phone.
 * Whatever happens, the user is never paywalled: failures fall back to the offline coach.
 */

export const PROVIDERS: Record<Provider, { name: string; defaultModel: string; keyUrl: string; note: string }> = {
  lockedin: {
    name: 'LockedIn AI (free, no setup)',
    defaultModel: '',
    keyUrl: '',
    note: 'Free for everyone with a fair daily limit. Powered by Google Gemini through LockedIn’s relay.',
  },
  gemini: {
    name: 'Your own Google Gemini key',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Unlimited, using your own free key. Requests go straight from your device to Google.',
  },
  groq: {
    name: 'Your own Groq key (Llama)',
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Unlimited with your own free key. Very fast.',
  },
  openrouter: {
    name: 'Your own OpenRouter key',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Use any model ending in ":free".',
  },
  offline: {
    name: 'Offline coach (no AI)',
    defaultModel: '',
    keyUrl: '',
    note: 'Built-in rule-based coach. Nothing ever leaves your phone.',
  },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Summarise the user's situation for the coach. Deliberately excludes journal text. */
export function buildFacts(s: AppState, now = Date.now()): CoachFacts {
  const days = streakMs(s, now) / DAY;
  const rank = rankFor(Math.floor(days));
  const ins = analyze(s, now);
  const a = s.assessments[s.assessments.length - 1];
  const last = s.relapses[s.relapses.length - 1];
  const d = new Date(now);
  return {
    nickname: s.profile?.nickname || 'friend',
    why: s.profile?.why ?? '',
    localTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${WEEKDAYS[d.getDay()]}`,
    streak: fmtDuration(streakMs(s, now)),
    tier: `${rank.name} (tier ${rank.tier} of 9)`,
    bestStreak: fmtDuration(Math.max(s.bestStreakMs, streakMs(s, now))),
    goalDays: s.profile?.goalDays ?? 90,
    recoveryRate: recoveryRate(s, now),
    relapseCount: ins.relapseCount,
    avgStreakDays: Math.round(ins.avgStreakDays * 10) / 10,
    topTriggers: ins.triggers.slice(0, 3).map(([t]) => labelOf(TRIGGERS, t).replace(/^\S+\s/, '')),
    dangerWindow: ins.worstBlock !== null ? `${BLOCKS[ins.worstBlock]}h` : '',
    urgesWon: ins.urgesWon,
    urgesLost: ins.urgesLost,
    assessment: a ? `${a.score}/100 (${LEVELS[a.level].name}); hardest areas: ${a.topDims.map((x) => DIM_INFO[x].label).join(', ')}` : '',
    lastSlip: last
      ? `${fmtDuration(now - last.at)} ago; triggers: ${last.triggers.map((t) => labelOf(TRIGGERS, t).replace(/^\S+\s/, '')).join(', ') || 'not given'}; their plan: "${last.plan.slice(0, 160)}"`
      : '',
    dangerNow: ins.dangerNow ?? '',
  };
}

export function buildSystemPrompt(s: AppState) {
  return buildPromptFromFacts(buildFacts(s));
}

/* ------------------------------------------------------------------ */
/*  Network                                                            */
/* ------------------------------------------------------------------ */
const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 200_000;

async function secureFetch(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      redirect: 'error',
    });
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('Response too large.');
    let data: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON error page */
    }
    return { res, data };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('The AI took too long to answer. Try again.');
    if (e instanceof TypeError) throw new Error('Network error: check your connection.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const cleanErr = (m: unknown, fb: string) => (typeof m === 'string' && m ? m.slice(0, 300) : fb);

async function callGemini(key: string, model: string, system: string, history: ChatMsg[]) {
  const { res, data } = await secureFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
      }),
    },
  );
  if (!res.ok) throw new Error(cleanErr(data?.error?.message, `Gemini error ${res.status}`));
  const parts: unknown = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('') : '';
  if (!text) throw new Error('Gemini returned an empty reply (it may have been filtered). Try rephrasing.');
  return text.trim().slice(0, 8000);
}

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  system: string,
  history: ChatMsg[],
  extraHeaders: Record<string, string> = {},
) {
  const { res, data } = await secureFetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 700,
      messages: [{ role: 'system', content: system }, ...history.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error(cleanErr(data?.error?.message, `API error ${res.status}`));
  const text: unknown = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error('The model returned an empty reply. Try again.');
  return text.trim().slice(0, 8000);
}

export interface CoachReply {
  text: string;
  offline: boolean;
  /** Short status for the UI, e.g. why we fell back to the offline coach. */
  notice?: string;
  /** Messages left today on the built-in coach. */
  remaining?: number;
}

export const RELAY_URL = '/api/coach';

async function callRelay(s: AppState, history: ChatMsg[]): Promise<CoachReply> {
  const last = history[history.length - 1]?.content ?? '';
  const fallback = (notice: string, remaining?: number): CoachReply => ({ text: offlineReply(last, s), offline: true, notice, remaining });
  try {
    const { res, data } = await secureFetch(
      RELAY_URL,
      {
        method: 'POST',
        mode: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts: buildFacts(s), messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      },
      20_000,
    );
    const remaining = typeof data?.remaining === 'number' ? data.remaining : undefined;
    if (res.ok && typeof data?.text === 'string' && data.text) return { text: data.text.slice(0, 4000), offline: false, remaining };
    if (data?.error === 'limit') return fallback("You've used today's free AI messages. The offline coach has your back until tomorrow.", 0);
    if (data?.error === 'busy') return fallback('The free AI is busy right now. Offline coach for now; try again later.', remaining);
    return fallback('AI is unavailable right now, so the offline coach answered.', remaining);
  } catch {
    return fallback('No connection to the AI, so the offline coach answered.');
  }
}

export async function askCoach(s: AppState, history: ChatMsg[]): Promise<CoachReply> {
  const provider = s.settings.provider;
  // Cap what we send: last 20 messages, each at most 2,000 chars.
  const recent = history.slice(-20).map((m) => ({ ...m, content: m.content.slice(0, 2000) }));
  const last = recent[recent.length - 1]?.content ?? '';

  // Crisis messages always get the safety reply immediately, whatever the provider.
  if (isCrisis(last)) return { text: offlineReply(last, s), offline: true };

  if (provider === 'offline') return { text: offlineReply(last, s), offline: true };
  if (provider === 'lockedin') {
    if (!s.settings.aiConsent) return { text: offlineReply(last, s), offline: true };
    return callRelay(s, recent);
  }

  const key = s.settings.apiKeys[provider]?.trim();
  if (!key) return { text: offlineReply(last, s), offline: true, notice: 'No API key set for this provider, so the offline coach answered.' };
  if (!/^[\x21-\x7e]{8,300}$/.test(key)) throw new Error('That API key looks invalid. Paste it again in Settings.');
  const custom = s.settings.models[provider]?.trim();
  const model = custom && MODEL_RE.test(custom) ? custom : PROVIDERS[provider].defaultModel;
  const system = buildSystemPrompt(s);
  let text: string;
  if (provider === 'gemini') text = await callGemini(key, model, system, recent);
  else if (provider === 'groq') text = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', key, model, system, recent);
  else text = await callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', key, model, system, recent, { 'X-Title': 'LockedIn' });
  return { text, offline: false };
}

/* ------------------------------------------------------------------ */
/*  Offline coach: useful even with no key and no internet             */
/* ------------------------------------------------------------------ */

// Match at word starts so "rn" doesn't fire on "learn" and "relapse" still matches "relapsed".
const has = (t: string, words: string[]) =>
  words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));

export const isCrisis = (input: string) => has(input.toLowerCase(), CRISIS_PHRASES);

export function offlineReply(input: string, s: AppState): string {
  const t = input.toLowerCase();
  const name = s.profile?.nickname || 'king';
  const why = s.profile?.why;
  const ins = analyze(s);
  const top = ins.triggers[0]?.[0];

  if (has(t, CRISIS_PHRASES)) {
    return `${name}, I'm really glad you said that out loud. That's bigger than any streak, and you deserve real support right now. Please contact a crisis line or emergency services now. You can find a free one for your country at findahelpline.com. If you can, message someone you trust and tell them you're having a hard time. You don't have to carry this alone.`;
  }
  if (has(t, ['urge', 'tempt', 'horny', 'craving', 'about to', 'rn', 'right now', 'help'])) {
    return [
      `Okay ${name}, urge spawned. Here's the play:`,
      '1. Stand up and leave the room you are in. Now.',
      '2. Cold water on your face or 20 push-ups. Shock the system.',
      '3. Put the phone in another room for 15 min.',
      'Urges peak and fade in ~15–20 minutes. You only need to outlast this one wave.',
      why ? `\nRemember why you started: "${why}"` : '',
      '\nStill loud? Tap "Send me to horny jail" on Home for breathing, urge surfing and the bonk game.',
    ].join('\n');
  }
  if (has(t, ['relapse', 'relapsed', 'failed', 'messed up', 'i did it', 'broke', 'fapped', 'watched', 'slipped'])) {
    return `It happened. That's an L, not a life sentence. Your total clean time and recovery rate (${recoveryRate(s)}%) are still yours. Let's turn this into data: what were you doing 30 minutes before it started? Where were you, and what were you feeling? Log it with "Fell off? Log a slip" on Home so the Radar can spot your patterns.${top ? ` So far your #1 trigger is ${labelOf(TRIGGERS, top)}. Make an if-then plan for it: "If I feel that, then I will ___".` : ''}`;
  }
  if (has(t, ['bored', 'boring', 'nothing to do'])) {
    return 'Boredom is the #1 boss for most people. Make a "boredom menu" of 5 things that take under 2 minutes to start: walk, shower, call someone, gym, a game with friends, cook something. When boredom hits, pick from the menu, no thinking allowed.';
  }
  if (has(t, ['lonely', 'alone', 'sad', 'depress', 'rejected'])) {
    return "That's heavy, and porn is a fake fix for a real need: connection. Text one person right now, even just a meme. Get around people today, even at a café or gym. You deserve real connection, not a screen pretending to be it.";
  }
  if (has(t, ['stress', 'anxious', 'anxiety', 'exam', 'work', 'pressure'])) {
    return 'Stress loves to sell you a quick escape. Try box breathing: in 4, hold 4, out 4, hold 4, repeat 4 times. Then do the smallest next step of the thing stressing you out. Momentum beats escape.';
  }
  if (has(t, ['flatline', 'no libido', 'numb', 'no motivation'])) {
    return 'Sounds like the flatline. Low libido and low mood are common in weeks 2–8 while your reward system recalibrates. It is a sign of change, not damage. Keep going, prioritise sleep, sunlight and exercise. It passes.';
  }
  if (has(t, ['night', 'sleep', 'bed', 'late'])) {
    return 'Late night = low willpower. Set a phone bedtime: charge it outside your bedroom, or at least across the room. Get a cheap alarm clock. That one change kills a huge share of relapses.';
  }
  if (has(t, ['why', 'hard', 'impossible', "can't", 'cant'])) {
    return "It's hard because porn is a supernormal stimulus: endless novelty your brain was never built for. That's not weakness, that's biology. The fix is not infinite willpower, it's fewer triggers + better replacements + time. You're already doing it by being here.";
  }
  if (has(t, ['plan', 'tonight', 'today', 'tips'])) {
    return `Tonight's game plan, ${name}:\n• Phone out of the bedroom by 11pm\n• Blocker on every device\n• One physical thing (walk, push-ups, shower)\n• Text a friend\n• Check in on the app before bed${ins.worstBlock !== null ? `\n• Extra careful around ${BLOCKS[ins.worstBlock]}h, that's your danger window` : ''}`;
  }
  return `I hear you, ${name}. I'm the offline coach, so I'm a bit simple. Tell me if you have an urge, slipped, feel bored, lonely or stressed, or want a plan for tonight. For the smarter coach, turn on LockedIn AI (free) in the Coach tab.`;
}
