import { describe, expect, it } from 'vitest';
import { fromB64, isSealed, passcodeStrength, sealWithPassword, toB64, unsealWithPassword } from '../src/lib/crypto';

describe('base64 helpers', () => {
  it('round-trips binary, including large buffers', () => {
    const big = new Uint8Array(200_000);
    for (let i = 0; i < big.length; i += 65_536) crypto.getRandomValues(big.subarray(i, i + 65_536)); // 64 KB per call max
    expect(fromB64(toB64(big))).toEqual(big);
  });
});

describe('seal / unseal', () => {
  it('round-trips unicode text', async () => {
    const text = JSON.stringify({ why: '禁欲 🔒 we are so back', n: 1 });
    const sealed = await sealWithPassword('Correct-Horse-42', text);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed.iter).toBe(600_000);
    expect(JSON.stringify(sealed)).not.toContain('so back');
    expect(await unsealWithPassword('Correct-Horse-42', sealed)).toBe(text);
  });

  it('uses a fresh salt and IV every time', async () => {
    const a = await sealWithPassword('pw-123456', 'same');
    const b = await sealWithPassword('pw-123456', 'same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('rejects the wrong passcode', async () => {
    const sealed = await sealWithPassword('right-pass', 'secret');
    await expect(unsealWithPassword('wrong-pass', sealed)).rejects.toThrow();
  });

  it('detects tampering (authenticated encryption)', async () => {
    const sealed = await sealWithPassword('right-pass', 'secret journal');
    const ct = fromB64(sealed.ct);
    ct[0] ^= 1;
    await expect(unsealWithPassword('right-pass', { ...sealed, ct: toB64(ct) })).rejects.toThrow();
  });

  it('isSealed rejects malformed / weakened envelopes', () => {
    const good = { lockedin: 'sealed', v: 1, kdf: 'PBKDF2-SHA256', iter: 600000, salt: 'a', iv: 'b', ct: 'c' };
    expect(isSealed(good)).toBe(true);
    expect(isSealed({ ...good, iter: 1000 })).toBe(false); // downgrade attack
    expect(isSealed({ ...good, iter: 1e9 })).toBe(false); // DoS via huge iteration count
    expect(isSealed({ ...good, kdf: 'MD5' })).toBe(false);
    expect(isSealed({ ...good, ct: 5 })).toBe(false);
    expect(isSealed(null)).toBe(false);
  });
});

describe('passcodeStrength', () => {
  it.each([
    ['12345', false],
    ['111111', false],
    ['123456', false],
    ['password1', false],
    ['qwerty12', false],
    ['482916', true],
    ['Correct-Horse-42', true],
    ['a long passphrase here', true],
  ])('%s -> ok=%s', (p, ok) => expect(passcodeStrength(p).ok).toBe(ok));
});
