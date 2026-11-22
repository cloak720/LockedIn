/*
 * LockedIn AI relay: the only server-side code in the project.
 *
 * Why it exists: so people can use the AI coach with zero setup, without the
 * Gemini API key ever being shipped to phones (anything in the app bundle is public).
 *
 * What it guarantees:
 *  - Only accepts requests from the app's own origin.
 *  - Builds the system prompt HERE from validated facts, so it can't be abused as a
 *    general-purpose Gemini proxy with a custom prompt.
 *  - Fair use: a per-person daily limit plus a global daily cap (protects the free
 *    tier and your wallet). People are identified only by a salted, daily-rotating
 *    hash of their IP address; raw IPs are never stored.
 *  - Stores NOTHING about conversations and logs nothing.
 *  - Never paywalls: when a limit is hit the app falls back to the offline coach.
 */
import { buildSystemPrompt, sanitizeFacts } from '../lib/coachPrompt';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface RelayEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  COACH_DAILY_LIMIT?: string;
  COACH_GLOBAL_DAILY_CAP?: string;
}

export interface RelayDeps {
  env: RelayEnv;
  store: KV;
  fetch: typeof fetch;
  now: () => number;
  ip: string;
  allowedOrigins: string[];
}

export const MAX_BODY_BYTES = 32_000;
export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 2_000;
const UPSTREAM_TIMEOUT_MS = 9_000; // Netlify sync functions have a 10 s budget
// Free-tier, fast (thinking is near-off by default). If a model is retired (404),
// the relay tries the next one, so a Google deprecation can't silently break the coach.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const MODEL_RE = /^[a-z0-9.-]{3,60}$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const intEnv = (v: string | undefined, fb: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function getSalt(store: KV) {
  const existing = await store.get('salt');
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing;
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
  await store.set('salt', salt);
  return salt;
}

type Msg = { role: 'user' | 'assistant'; content: string };

export function validateMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const out: Msg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const c = content.trim();
    if (!c || c.length > MAX_MESSAGE_CHARS) return null;
    out.push({ role, content: c });
  }
  return out[out.length - 1].role === 'user' ? out : null;
}

export async function handleCoach(req: Request, deps: RelayDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method' });

  // 1. Same-app only.
  const origin = req.headers.get('origin') ?? '';
  if (!origin || !deps.allowedOrigins.includes(origin)) return json(403, { error: 'origin' });

  // 2. Bounded, well-formed body.
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad_request' });
  }
  const messages = validateMessages(body?.messages);
  if (!messages) return json(400, { error: 'bad_request' });
  const facts = sanitizeFacts(body?.facts);

  // 3. Configured?
  const key = deps.env.GEMINI_API_KEY?.trim();
  if (!key) return json(503, { error: 'unavailable' });

  // 4. Fair use.
  const limit = intEnv(deps.env.COACH_DAILY_LIMIT, 20, 1, 500);
  const cap = intEnv(deps.env.COACH_GLOBAL_DAILY_CAP, 800, 1, 1_000_000);
  const day = new Date(deps.now()).toISOString().slice(0, 10);
  const salt = await getSalt(deps.store);
  const who = (await sha256Hex(`${salt}|${day}|${deps.ip || 'unknown'}`)).slice(0, 32);
  const userKey = `u/${day}/${who}`;
  const globalKey = `g/${day}`;
  const used = Number((await deps.store.get(userKey)) ?? '0') || 0;
  const total = Number((await deps.store.get(globalKey)) ?? '0') || 0;
  if (used >= limit) return json(429, { error: 'limit', remaining: 0 });
  if (total >= cap) return json(429, { error: 'busy', remaining: Math.max(0, limit - used) });
  await deps.store.set(userKey, String(used + 1));
  await deps.store.set(globalKey, String(total + 1));
  const remaining = Math.max(0, limit - used - 1);

  // 5. Ask Gemini (prompt built here, never taken from the client).
  const preferred = deps.env.GEMINI_MODEL && MODEL_RE.test(deps.env.GEMINI_MODEL) ? deps.env.GEMINI_MODEL : DEFAULT_MODEL;
  const models = [...new Set([preferred, DEFAULT_MODEL, ...FALLBACK_MODELS])];
  const systemPrompt = buildSystemPrompt(facts);
  const contents = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let res!: Response;
    for (const model of models) {
      res = await deps.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 600,
            ...(model.startsWith('gemini-2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });
      if (res.status !== 404) break; // only a retired/unknown model moves on to the next one
    }
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    };
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim() : '';
    if (!res.ok || !text) {
      await deps.store.set(userKey, String(used)); // don't charge the user for our failure
      // `code` is only the upstream HTTP status (never the key or any content), for diagnosis.
      return json(502, { error: res.status === 429 ? 'busy' : 'upstream', code: res.status, remaining: remaining + 1 });
    }
    return json(200, { text: text.slice(0, 4000), remaining });
  } catch (e) {
    await deps.store.set(userKey, String(used));
    const code = e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network';
    return json(502, { error: 'upstream', code, remaining: remaining + 1 });
  } finally {
    clearTimeout(timer);
  }
}
