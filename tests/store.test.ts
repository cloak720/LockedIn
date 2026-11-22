import { beforeEach, describe, expect, it, vi } from 'vitest';

type Store = typeof import('../src/lib/store');

/** Fresh module instance per test, as if the app was just opened. */
async function boot(): Promise<Store> {
  vi.resetModules();
  return import('../src/lib/store');
}

async function onboard(st: Store) {
  const now = Date.now();
  st.setState({
    profile: { nickname: 'Tester', why: 'SECRET-WHY', goalDays: 90, createdAt: now },
    journeyStart: now - 10 * 86_400_000,
    streakStart: now - 3 * 86_400_000,
  });
  st.setState((s) => ({ settings: { ...s.settings, provider: 'groq', apiKeys: { groq: 'gsk_DEVICE_KEY_123' } } }));
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('plaintext persistence', () => {
  it('persists and reloads', async () => {
    let st = await boot();
    await onboard(st);
    st = await boot();
    expect(st.getState().profile?.nickname).toBe('Tester');
  });

  it('survives corrupted storage', async () => {
    localStorage.setItem('lockedin.v1', '{not json');
    const st = await boot();
    expect(st.getState().profile).toBeNull();
  });
});

describe('vault', () => {
  it('encrypts everything and removes the plaintext copy', async () => {
    const st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    expect(localStorage.getItem('lockedin.v1')).toBeNull();
    const raw = localStorage.getItem('lockedin.vault')!;
    expect(raw).not.toMatch(/SECRET-WHY|Tester|gsk_DEVICE/);
    expect(st.hasVault()).toBe(true);
  });

  it('starts locked after reload, with no data in memory, and ignores writes', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st = await boot();
    expect(st.getState().profile).toBeNull();
    st.setState({ lastAdDay: '2026-01-01' }); // must be a no-op
    const before = localStorage.getItem('lockedin.vault');
    expect(localStorage.getItem('lockedin.v1')).toBeNull();
    expect(localStorage.getItem('lockedin.vault')).toBe(before);
  });

  it('unlocks with the right passcode and restores everything', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st = await boot();
    await st.unlock('Correct-Horse-42');
    expect(st.getState().profile?.why).toBe('SECRET-WHY');
    expect(st.getState().settings.apiKeys.groq).toBe('gsk_DEVICE_KEY_123');
  });

  it('changes made while unlocked are encrypted and survive a reload', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st.setState((s) => ({ profile: { ...s.profile!, why: 'NEW-WHY' } }));
    await st.lockNow();
    expect(localStorage.getItem('lockedin.vault')).not.toContain('NEW-WHY');
    st = await boot();
    await st.unlock('Correct-Horse-42');
    expect(st.getState().profile?.why).toBe('NEW-WHY');
  });

  it('lockNow wipes decrypted data from memory', async () => {
    const st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    await st.lockNow();
    expect(st.getState().profile).toBeNull();
    expect(st.getState().settings.apiKeys).toEqual({});
  });

  it('wrong passcodes: 5 free attempts, then a timed lockout', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st = await boot();
    for (let i = 0; i < 5; i++) await expect(st.unlock('nope' + i)).rejects.toThrow('wrong');
    expect(st.getGuard().fails).toBe(5);
    expect(st.getGuard().until).toBeGreaterThan(Date.now());
    // even the right passcode is refused during lockout
    await expect(st.unlock('Correct-Horse-42')).rejects.toThrow('locked-out');
  });

  it('lockout grows exponentially and caps at 1h', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st = await boot();
    localStorage.setItem('lockedin.guard', JSON.stringify({ fails: 20, until: 0 }));
    await expect(st.unlock('nope')).rejects.toThrow('wrong');
    const g = st.getGuard();
    expect(g.until - Date.now()).toBeLessThanOrEqual(3_600_000);
    expect(g.until - Date.now()).toBeGreaterThan(3_500_000);
  });

  it('successful unlock resets the guard', async () => {
    let st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    st = await boot();
    await expect(st.unlock('nope')).rejects.toThrow();
    await st.unlock('Correct-Horse-42');
    expect(st.getGuard().fails).toBe(0);
  });

  it('disableVault requires the passcode and restores plaintext', async () => {
    const st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    await expect(st.disableVault('wrong')).rejects.toThrow('Wrong passcode');
    expect(st.hasVault()).toBe(true);
    await st.disableVault('Correct-Horse-42');
    expect(st.hasVault()).toBe(false);
    expect(localStorage.getItem('lockedin.v1')).toContain('Tester');
  });

  it('resetAll erases vault, guard and data', async () => {
    const st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    localStorage.setItem('lockedin.guard', '{"fails":3,"until":0}');
    st.resetAll();
    expect(localStorage.length).toBe(0);
    expect(st.getState().profile).toBeNull();
    expect(st.useLock).toBeTypeOf('function');
  });
});

describe('backup export / import', () => {
  it('never exports API keys', async () => {
    const st = await boot();
    await onboard(st);
    const out = await st.exportData();
    expect(out).toContain('Tester');
    expect(out).not.toContain('gsk_DEVICE');
  });

  it('password-encrypted backup round-trips and needs the password', async () => {
    const st = await boot();
    await onboard(st);
    const out = await st.exportData('backup-pass-99');
    expect(out).not.toContain('Tester');
    st.resetAll();
    await expect(st.importData(out)).rejects.toThrow(/encrypted/);
    await expect(st.importData(out, 'wrong-pass')).rejects.toThrow(/Wrong backup password/);
    await st.importData(out, 'backup-pass-99');
    expect(st.getState().profile?.nickname).toBe('Tester');
  });

  it('import keeps this device’s API keys and ignores keys in the file', async () => {
    const st = await boot();
    await onboard(st);
    const evil = JSON.stringify({ v: 1, profile: { nickname: 'Evil' }, settings: { apiKeys: { groq: 'attacker-key-123' } } });
    await st.importData(evil);
    expect(st.getState().profile?.nickname).toBe('Evil');
    expect(st.getState().settings.apiKeys.groq).toBe('gsk_DEVICE_KEY_123');
  });

  it('rejects files that are not LockedIn backups or are too large', async () => {
    const st = await boot();
    await expect(st.importData('{"hello":1}')).rejects.toThrow(/not a LockedIn backup/);
    await expect(st.importData('nonsense')).rejects.toThrow(/not a LockedIn backup/);
    await expect(st.importData('x'.repeat(st.MAX_IMPORT_BYTES + 1))).rejects.toThrow(/too large/);
  });

  it('import into an encrypted app stays encrypted', async () => {
    const st = await boot();
    await onboard(st);
    await st.enableVault('Correct-Horse-42');
    await st.importData(JSON.stringify({ v: 1, profile: { nickname: 'Imported', why: 'IMPORTED-WHY' } }));
    await st.lockNow();
    expect(localStorage.getItem('lockedin.v1')).toBeNull();
    expect(localStorage.getItem('lockedin.vault')).not.toContain('IMPORTED-WHY');
  });
});

describe('actions', () => {
  it('logRelapse resets the streak from the relapse time and keeps the best streak', async () => {
    const st = await boot();
    await onboard(st);
    const twoHoursAgo = Date.now() - 2 * 3600_000;
    st.logRelapse({ at: twoHoursAgo, triggers: ['late'], emotions: ['tired'], place: 'Bedroom', story: '', plan: 'phone out', intensity: 4 });
    const s = st.getState();
    expect(s.streakStart).toBe(twoHoursAgo);
    expect(s.relapses).toHaveLength(1);
    expect(s.relapses[0].streakMs).toBeGreaterThan(2.9 * 86_400_000);
    expect(s.bestStreakMs).toBe(s.relapses[0].streakMs);
    expect(s.milestonesSeen).toEqual([]);
  });

  it('logRelapse clamps future times to now', async () => {
    const st = await boot();
    await onboard(st);
    st.logRelapse({ at: Date.now() + 86_400_000, triggers: [], emotions: [], place: '', story: '', plan: 'x', intensity: 1 });
    expect(st.getState().relapses[0].at).toBeLessThanOrEqual(Date.now());
  });

  it('saveCheckIn keeps one check-in per day', async () => {
    const st = await boot();
    await onboard(st);
    st.saveCheckIn({ mood: 2, urge: 5, note: 'a' });
    st.saveCheckIn({ mood: 5, urge: 1, note: 'b' });
    expect(st.getState().checkins).toHaveLength(1);
    expect(st.getState().checkins[0].mood).toBe(5);
  });

  it('uid is random hex', async () => {
    const st = await boot();
    const ids = new Set(Array.from({ length: 200 }, () => st.uid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});
