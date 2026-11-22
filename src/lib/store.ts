import { useSyncExternalStore } from 'react';
import type { AssessmentResult } from './assessment';
import {
  deriveKey,
  fromB64,
  isSealed,
  KDF_ITERATIONS,
  randomBytes,
  seal,
  sealWithPassword,
  unseal,
  unsealWithPassword,
} from './crypto';
import { sanitizeState } from './sanitize';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Provider = 'lockedin' | 'gemini' | 'groq' | 'openrouter' | 'offline';

export interface Profile {
  nickname: string;
  why: string; // the user's personal reason, shown during urges
  goalDays: number;
  createdAt: number;
}

export interface Relapse {
  id: string;
  at: number;
  streakMs: number;
  triggers: string[];
  emotions: string[];
  place: string;
  story: string;
  plan: string;
  intensity: number; // 1..5
}

export interface CheckIn {
  day: string; // YYYY-MM-DD local
  at: number;
  mood: number; // 1..5
  urge: number; // 0..10
  note: string;
}

export interface UrgeLog {
  at: number;
  won: boolean;
  tool: string;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export interface Settings {
  provider: Provider;
  apiKeys: Partial<Record<Provider, string>>;
  models: Partial<Record<Provider, string>>;
  reduceMotion: boolean;
  /** User explicitly agreed to send coach messages to the cloud AI (LockedIn relay). */
  aiConsent: boolean;
  /** seconds in background before auto-lock (0 = immediately, -1 = never). Only used with a passcode. */
  autoLockSec: number;
}

export interface AppState {
  v: 1;
  profile: Profile | null;
  assessments: AssessmentResult[];
  journeyStart: number | null;
  streakStart: number | null;
  bestStreakMs: number;
  relapses: Relapse[];
  checkins: CheckIn[];
  urges: UrgeLog[];
  chat: ChatMsg[];
  settings: Settings;
  lastAdDay: string | null;
  milestonesSeen: number[];
}

/* ------------------------------------------------------------------ */
/*  Storage layout                                                     */
/*   lockedin.v1    -> plaintext state (only when NO passcode is set)  */
/*   lockedin.vault -> AES-GCM encrypted state (when a passcode is set)*/
/*   lockedin.guard -> failed-unlock counter (no secrets)              */
/* ------------------------------------------------------------------ */

const KEY = 'lockedin.v1';
const VAULT = 'lockedin.vault';
const GUARD = 'lockedin.guard';

export const defaultState = (): AppState => ({
  v: 1,
  profile: null,
  assessments: [],
  journeyStart: null,
  streakStart: null,
  bestStreakMs: 0,
  relapses: [],
  checkins: [],
  urges: [],
  chat: [],
  settings: { provider: 'lockedin', apiKeys: {}, models: {}, reduceMotion: false, aiConsent: false, autoLockSec: 60 },
  lastAdDay: null,
  milestonesSeen: [],
});

const ls = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function parse(raw: string | null): unknown {
  if (!raw || raw.length > 20_000_000) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadPlain(): AppState {
  const parsed = parse(ls.get(KEY));
  return parsed ? sanitizeState(parsed, defaultState()) : defaultState();
}

export const hasVault = () => isSealed(parse(ls.get(VAULT)));

/* ------------------------------------------------------------------ */
/*  In-memory state                                                    */
/* ------------------------------------------------------------------ */

let vaultKey: CryptoKey | null = null;
let vaultSalt: Uint8Array | null = null;
let vaultIter = KDF_ITERATIONS;
let locked = hasVault();
let state: AppState = locked ? defaultState() : loadPlain();
let writeChain: Promise<void> = Promise.resolve();

export interface LockInfo {
  locked: boolean;
  encrypted: boolean;
}
let lockSnap: LockInfo = { locked, encrypted: locked };

const listeners = new Set<() => void>();
function emit() {
  lockSnap = { locked, encrypted: !!vaultKey || locked };
  listeners.forEach((l) => l());
}

/** Encrypted writes are queued so they always land in order. */
function flush(): Promise<void> {
  if (!vaultKey || !vaultSalt) return writeChain;
  const key = vaultKey;
  const salt = vaultSalt;
  const iter = vaultIter;
  const snapshot = JSON.stringify(state);
  writeChain = writeChain
    .then(async () => {
      ls.set(VAULT, JSON.stringify(await seal(key, salt, iter, snapshot)));
    })
    .catch(() => {});
  return writeChain;
}

function persist() {
  if (locked) return; // never touch storage while locked: can't clobber the vault
  if (vaultKey) void flush();
  else ls.set(KEY, JSON.stringify(state));
}

export function getState() {
  return state;
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  if (locked) return;
  const patch = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  emit();
}

export function replaceState(next: AppState) {
  if (locked) return;
  state = next;
  persist();
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useLock(): LockInfo {
  return useSyncExternalStore(subscribe, () => lockSnap);
}

/* ------------------------------------------------------------------ */
/*  Passcode vault                                                     */
/* ------------------------------------------------------------------ */

interface Guard {
  fails: number;
  until: number;
}

export function getGuard(): Guard {
  const g = parse(ls.get(GUARD)) as Partial<Guard> | null;
  return {
    fails: typeof g?.fails === 'number' ? g.fails : 0,
    until: typeof g?.until === 'number' ? g.until : 0,
  };
}

/** Lock the app and encrypt everything with a passcode. */
export async function enableVault(passcode: string) {
  if (locked) throw new Error('App is locked');
  const salt = randomBytes(16);
  vaultKey = await deriveKey(passcode, salt, KDF_ITERATIONS);
  vaultSalt = salt;
  vaultIter = KDF_ITERATIONS;
  await flush();
  if (!hasVault()) {
    vaultKey = null;
    vaultSalt = null;
    throw new Error('Could not save encrypted data (storage full or blocked).');
  }
  ls.del(KEY); // remove the plaintext copy only once the encrypted one is safely written
  emit();
}

export async function unlock(passcode: string) {
  const g = getGuard();
  if (Date.now() < g.until) throw new Error('locked-out');
  const sealed = parse(ls.get(VAULT));
  if (!isSealed(sealed)) throw new Error('No encrypted data found.');
  const salt = fromB64(sealed.salt);
  const key = await deriveKey(passcode, salt, sealed.iter);
  let plain: string;
  try {
    plain = await unseal(key, sealed);
  } catch {
    const fails = g.fails + 1;
    // 5 free attempts, then exponential lockout: 30s, 1m, 2m … capped at 1h
    const until = fails >= 5 ? Date.now() + Math.min(3_600_000, 30_000 * 2 ** (fails - 5)) : 0;
    ls.set(GUARD, JSON.stringify({ fails, until }));
    throw new Error('wrong');
  }
  ls.del(GUARD);
  vaultKey = key;
  vaultSalt = salt;
  vaultIter = sealed.iter;
  state = sanitizeState(parse(plain), defaultState());
  locked = false;
  // Upgrade old vaults to the current iteration count on next write.
  if (sealed.iter < KDF_ITERATIONS) {
    vaultKey = await deriveKey(passcode, salt, KDF_ITERATIONS);
    vaultIter = KDF_ITERATIONS;
    void flush();
  }
  emit();
}

/** Wipe decrypted data + key from memory. */
export async function lockNow() {
  if (!vaultKey || locked) return;
  await flush();
  vaultKey = null;
  vaultSalt = null;
  state = defaultState();
  locked = true;
  emit();
}

/** Turn encryption off (requires the current passcode). */
export async function disableVault(passcode: string) {
  const sealed = parse(ls.get(VAULT));
  if (!isSealed(sealed)) throw new Error('No encrypted data found.');
  try {
    await unsealWithPassword(passcode, sealed);
  } catch {
    throw new Error('Wrong passcode.');
  }
  await flush();
  vaultKey = null;
  vaultSalt = null;
  if (!ls.set(KEY, JSON.stringify(state))) throw new Error('Could not save data.');
  ls.del(VAULT);
  emit();
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export const uid = () => {
  const b = randomBytes(8);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

export function dayKey(t: number = Date.now()) {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function logRelapse(r: Omit<Relapse, 'id' | 'streakMs'>) {
  setState((s) => {
    const at = Math.min(r.at, Date.now());
    const start = s.streakStart ?? at;
    const streakMs = Math.max(0, at - start);
    return {
      relapses: [...s.relapses, { ...r, at, id: uid(), streakMs }],
      bestStreakMs: Math.max(s.bestStreakMs, streakMs),
      // The new streak starts at the relapse: if it was a few hours ago, those clean hours count.
      streakStart: Math.max(at, start),
      milestonesSeen: [],
    };
  });
}

export function logUrge(won: boolean, tool: string) {
  setState((s) => ({ urges: [...s.urges, { at: Date.now(), won, tool }] }));
}

export function saveCheckIn(c: Omit<CheckIn, 'day' | 'at'>) {
  const day = dayKey();
  setState((s) => ({
    checkins: [...s.checkins.filter((x) => x.day !== day), { ...c, day, at: Date.now() }],
  }));
}

/** Backup file. API keys are never included. Optionally password-encrypted. */
export async function exportData(password?: string): Promise<string> {
  const { settings, ...rest } = state;
  const plain = JSON.stringify({ ...rest, settings: { ...settings, apiKeys: {} } });
  if (password) return JSON.stringify(await sealWithPassword(password, plain));
  return plain;
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function importData(text: string, password?: string) {
  if (text.length > MAX_IMPORT_BYTES) throw new Error('File is too large to be a LockedIn backup.');
  let parsed = parse(text);
  if (isSealed(parsed)) {
    if (!password) throw new Error('This backup is encrypted. Enter its backup password first.');
    try {
      parsed = parse(await unsealWithPassword(password, parsed));
    } catch {
      throw new Error('Wrong backup password, or the file was modified.');
    }
  }
  const o = parsed as { v?: unknown } | null;
  if (!o || o.v !== 1) throw new Error('This file is not a LockedIn backup.');
  const clean = sanitizeState(parsed, defaultState());
  // Keep this device's AI keys; never accept keys from a file.
  clean.settings.apiKeys = state.settings.apiKeys;
  replaceState(clean);
}

export function resetAll() {
  [KEY, VAULT, GUARD].forEach(ls.del);
  vaultKey = null;
  vaultSalt = null;
  locked = false;
  state = defaultState();
  emit();
}

export const buzz = (p: number | number[] = 12) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* unsupported */
  }
};
