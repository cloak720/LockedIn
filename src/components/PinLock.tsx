import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { buzz, getGuard, resetAll, unlock } from '../lib/store';
import { Btn, Stamp } from './ui';

export default function PinLock() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [show, setShow] = useState(false);
  const shake = useAnimation();
  const guard = getGuard();
  const waitSec = Math.max(0, Math.ceil((guard.until - now) / 1000));

  useEffect(() => {
    if (waitSec <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitSec]);

  const submit = async () => {
    if (!code || busy || waitSec > 0) return;
    setBusy(true);
    setErr(null);
    try {
      await unlock(code); // on success the whole app re-renders unlocked
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      buzz([60, 40, 60]);
      void shake.start({ x: [0, -14, 14, -10, 10, 0], transition: { duration: 0.4 } });
      setErr(m === 'wrong' ? 'Wrong passcode.' : m === 'locked-out' ? 'Too many attempts.' : m);
      setCode('');
      setNow(Date.now());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="narrow col center" style={{ alignItems: 'center', gap: 18, paddingTop: 50 }}>
        <Stamp text="Locked" size={84} />
        <h2>LockedIn is locked</h2>
        <p className="muted small">Your data is encrypted on this device. Enter your passcode to decrypt it.</p>
        <motion.form
          animate={shake}
          className="col"
          style={{ width: '100%', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="row">
            <input
              className="input grow"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              maxLength={128}
              placeholder="Passcode"
              aria-label="Passcode"
              value={code}
              disabled={busy || waitSec > 0}
              onChange={(e) => setCode(e.target.value)}
            />
            <Btn type="button" variant="ghost sm" onClick={() => setShow(!show)} aria-label={show ? 'Hide passcode' : 'Show passcode'}>
              {show ? '🙈' : '👁️'}
            </Btn>
          </div>
          <Btn variant="primary block" type="submit" disabled={!code || busy || waitSec > 0}>
            {busy ? 'Decrypting…' : waitSec > 0 ? `Try again in ${waitSec}s` : 'Unlock'}
          </Btn>
        </motion.form>
        {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
        {guard.fails > 0 && guard.fails < 5 && (
          <p className="small dim">{5 - guard.fails} attempts left before a timed lockout.</p>
        )}
        <hr className="sep" style={{ marginTop: 20 }} />
        <p className="small dim">
          Forgot it? Your data is encrypted, so nobody (not even us) can recover it. You can only start over.
        </p>
        <Btn
          variant="ghost sm"
          onClick={() => {
            if (
              confirm('Erase ALL LockedIn data on this device and start over? This cannot be undone.') &&
              confirm('Are you absolutely sure? Your streak, history and journal will be permanently deleted.')
            )
              resetAll();
          }}
        >
          Erase & start over
        </Btn>
      </div>
    </div>
  );
}
