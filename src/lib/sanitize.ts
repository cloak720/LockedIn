/*
 * Every piece of data that enters the app from storage or from an imported
 * backup goes through here. Nothing is trusted: unknown fields are dropped,
 * types are checked, strings and arrays are length-capped, numbers clamped,
 * and enums validated. A malicious or corrupted backup can therefore never
 * crash the app, bloat storage, or smuggle in unexpected structure.
 */
import { DIM_INFO, LEVELS, levelFor, QUESTIONS, type AssessmentResult, type DimKey } from './assessment';
import type { AppState, ChatMsg, CheckIn, Provider, Relapse, Settings, UrgeLog } from './store';

const PROVIDERS: Provider[] = ['lockedin', 'gemini', 'groq', 'openrouter', 'offline'];
const MIN_T = 946684800000; // 2000-01-01
const MAX_T = 4102444800000; // 2100-01-01
export const MODEL_RE = /^[A-Za-z0-9._:/-]{1,100}$/;

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {});
const str = (x: unknown, max: number, fb = '') => (typeof x === 'string' ? x.slice(0, max) : fb);
const num = (x: unknown, min: number, max: number, fb: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fb;
const int = (x: unknown, min: number, max: number, fb: number) => Math.round(num(x, min, max, fb));
const time = (x: unknown, fb: number) => num(x, MIN_T, MAX_T, fb);
const optTime = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= MIN_T && x <= MAX_T ? x : null);
const arr = (x: unknown, max: number): unknown[] => (Array.isArray(x) ? x.slice(-max) : []);
const strArr = (x: unknown, maxItems: number, maxLen: number) =>
  arr(x, maxItems)
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.slice(0, maxLen));
const ID_RE = /^[a-z0-9]{1,40}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DIMS = Object.keys(DIM_INFO) as DimKey[];
const QIDS = new Set(QUESTIONS.map((q) => q.id));

function assessment(x: unknown): AssessmentResult | null {
  const o = obj(x);
  // Own-property check, not `in`: `'__proto__' in LEVELS` is true via the prototype chain.
  if (typeof o.level !== 'string' || !Object.prototype.hasOwnProperty.call(LEVELS, o.level)) return null;
  const answers: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(o.answers))) if (QIDS.has(k)) answers[k] = int(v, 0, 4, 0);
  const dimsIn = obj(o.dims);
  const dims = {} as Record<DimKey, number>;
  DIMS.forEach((d) => (dims[d] = int(dimsIn[d], 0, 100, 0)));
  const score = int(o.score, 0, 100, 0);
  return {
    at: time(o.at, Date.now()),
    answers,
    score,
    level: levelFor(score), // always derived, so a forged file can't show a mismatched level
    dims,
    consistency: int(o.consistency, 0, 100, 100),
    flags: strArr(o.flags, 10, 300),
    safety: int(o.safety, 0, 2, 0),
    topDims: strArr(o.topDims, 3, 20).filter((d): d is DimKey => (DIMS as string[]).includes(d)),
  };
}

function relapse(x: unknown): Relapse | null {
  const o = obj(x);
  const at = optTime(o.at);
  if (at === null) return null;
  const id = str(o.id, 40);
  return {
    id: ID_RE.test(id) ? id : Math.random().toString(36).slice(2, 12),
    at,
    streakMs: num(o.streakMs, 0, MAX_T - MIN_T, 0),
    triggers: strArr(o.triggers, 20, 40),
    emotions: strArr(o.emotions, 20, 40),
    place: str(o.place, 60),
    story: str(o.story, 4000),
    plan: str(o.plan, 1000),
    intensity: int(o.intensity, 1, 5, 3),
  };
}

function checkin(x: unknown): CheckIn | null {
  const o = obj(x);
  const day = str(o.day, 10);
  const at = optTime(o.at);
  if (!DAY_RE.test(day) || at === null) return null;
  return { day, at, mood: int(o.mood, 1, 5, 3), urge: int(o.urge, 0, 10, 0), note: str(o.note, 500) };
}

function urge(x: unknown): UrgeLog | null {
  const o = obj(x);
  const at = optTime(o.at);
  if (at === null || typeof o.won !== 'boolean') return null;
  return { at, won: o.won, tool: str(o.tool, 20) };
}

function chat(x: unknown): ChatMsg | null {
  const o = obj(x);
  if (o.role !== 'user' && o.role !== 'assistant') return null;
  const content = str(o.content, 8000);
  if (!content) return null;
  return { role: o.role, content, at: time(o.at, Date.now()) };
}

const keep = <T>(x: T | null): x is T => x !== null;

export function sanitizeSettings(x: unknown, base: Settings): Settings {
  const o = obj(x);
  const apiKeys: Settings['apiKeys'] = {};
  const models: Settings['models'] = {};
  const ak = obj(o.apiKeys);
  const md = obj(o.models);
  for (const p of PROVIDERS) {
    const k = str(ak[p], 300).trim();
    if (k && /^[\x21-\x7e]+$/.test(k)) apiKeys[p] = k; // printable ASCII only: no header injection
    const m = str(md[p], 100).trim();
    if (m && MODEL_RE.test(m)) models[p] = m;
  }
  let provider: Provider = PROVIDERS.includes(o.provider as Provider) ? (o.provider as Provider) : base.provider;
  // Migration: data from before the built-in coach existed defaulted to 'offline'. Move those users to
  // the built-in coach; it still sends nothing until they explicitly opt in (aiConsent).
  if (o.aiConsent === undefined && provider === 'offline' && Object.keys(apiKeys).length === 0) provider = 'lockedin';
  return {
    provider,
    aiConsent: o.aiConsent === true,
    apiKeys,
    models,
    reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : base.reduceMotion,
    autoLockSec: [0, 60, 300, 900, -1].includes(o.autoLockSec as number) ? (o.autoLockSec as number) : base.autoLockSec,
  };
}

export function sanitizeState(raw: unknown, base: AppState): AppState {
  const o = obj(raw);
  const p = obj(o.profile);
  const profile =
    typeof p.nickname === 'string'
      ? {
          nickname: str(p.nickname, 24),
          why: str(p.why, 300),
          goalDays: int(p.goalDays, 1, 3650, 90),
          createdAt: time(p.createdAt, Date.now()),
        }
      : null;

  return {
    v: 1,
    profile,
    assessments: arr(o.assessments, 200).map(assessment).filter(keep),
    journeyStart: optTime(o.journeyStart),
    streakStart: optTime(o.streakStart),
    bestStreakMs: num(o.bestStreakMs, 0, MAX_T - MIN_T, 0),
    relapses: arr(o.relapses, 5000).map(relapse).filter(keep),
    checkins: arr(o.checkins, 5000).map(checkin).filter(keep),
    urges: arr(o.urges, 20000).map(urge).filter(keep),
    chat: arr(o.chat, 100).map(chat).filter(keep),
    settings: sanitizeSettings(o.settings, base.settings),
    lastAdDay: typeof o.lastAdDay === 'string' && DAY_RE.test(o.lastAdDay) ? o.lastAdDay : null,
    milestonesSeen: arr(o.milestonesSeen, 20)
      .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100000),
  };
}
