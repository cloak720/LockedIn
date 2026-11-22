import { useRef, useState } from 'react';
import { askCoach, PROVIDERS } from '../lib/ai';
import { passcodeStrength } from '../lib/crypto';
import { MODEL_RE } from '../lib/sanitize';
import {
  disableVault,
  enableVault,
  exportData,
  getState,
  importData,
  lockNow,
  MAX_IMPORT_BYTES,
  resetAll,
  setState,
  useAppState,
  useLock,
  type Provider,
  type Settings as SettingsT,
} from '../lib/store';
import { Btn, Card, Page, Sec } from './ui';

const AUTOLOCK = [
  { v: 0, label: 'Immediately' },
  { v: 60, label: '1 min' },
  { v: 300, label: '5 min' },
  { v: 900, label: '15 min' },
  { v: -1, label: 'Never' },
];

function PasscodeCard() {
  const s = useAppState();
  const lock = useLock();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [off, setOff] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const strength = passcodeStrength(a);

  if (lock.encrypted) {
    return (
      <Card>
        <Sec no="03" title="Encryption: on" />
        <p className="small muted" style={{ marginBottom: 10 }}>
          All your data (journal, relapses, chat, API keys) is encrypted on this device with AES-256. Without your passcode
          it is unreadable, even to someone with full access to the device's storage.
        </p>
        <label className="lbl">Auto-lock when the app is in the background for</label>
        <div className="chips" style={{ marginBottom: 12 }}>
          {AUTOLOCK.map((o) => (
            <button
              key={o.v}
              className={`chip ${s.settings.autoLockSec === o.v ? 'on' : ''}`}
              onClick={() => setState((st) => ({ settings: { ...st.settings, autoLockSec: o.v } }))}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Btn variant="primary sm" onClick={() => void lockNow()}>
          🔒 Lock now
        </Btn>
        <hr className="sep" style={{ margin: '14px 0' }} />
        <label className="lbl">Turn off encryption (enter current passcode)</label>
        <div className="row">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            spellCheck={false}
            maxLength={128}
            value={off}
            onChange={(e) => setOff(e.target.value)}
          />
          <Btn
            variant="sm"
            disabled={!off || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await disableVault(off);
                setMsg('Encryption turned off. Data is now stored unencrypted.');
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e));
              } finally {
                setOff('');
                setBusy(false);
              }
            }}
          >
            Turn off
          </Btn>
        </div>
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </Card>
    );
  }

  return (
    <Card>
      <Sec no="03" title="Passcode & encryption" />
      <div className="banner small" style={{ marginBottom: 12 }}>
        ⚠️ Encryption is OFF. Anyone who can open this browser or device could read your journal
        {Object.keys(s.settings.apiKeys).length ? ' and your AI keys' : ''}. Set a passcode to encrypt everything.
      </div>
      <form
        className="col"
        style={{ gap: 10 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!strength.ok || a !== b) return;
          setBusy(true);
          setMsg(null);
          try {
            await enableVault(a);
            setA('');
            setB('');
            setMsg('🔐 Encrypted. You will need this passcode to open the app. It cannot be recovered if you forget it.');
          } catch (err) {
            setMsg(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={128}
          placeholder="New passcode (6+ characters)"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        {a && <p className="small" style={{ color: strength.ok ? 'var(--mint)' : 'var(--orange)' }}>{strength.label}</p>}
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={128}
          placeholder="Repeat passcode"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
        {b && a !== b && <p className="small" style={{ color: 'var(--orange)' }}>Passcodes don't match</p>}
        <Btn variant="primary" type="submit" disabled={!strength.ok || a !== b || busy}>
          {busy ? 'Encrypting…' : 'Encrypt & enable lock'}
        </Btn>
      </form>
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </Card>
  );
}

export default function Settings({ onRetake }: { onRetake: () => void }) {
  const s = useAppState();
  const lock = useLock();
  const fileRef = useRef<HTMLInputElement>(null);
  const [test, setTest] = useState<string | null>(null);
  const [backupPw, setBackupPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const p = s.settings.provider;
  const prov = PROVIDERS[p];
  const model = s.settings.models[p] ?? '';

  const setSettings = (patch: Partial<SettingsT>) => setState((st) => ({ settings: { ...st.settings, ...patch } }));
  const setProfile = (patch: Partial<NonNullable<typeof s.profile>>) =>
    setState((st) => (st.profile ? { profile: { ...st.profile, ...patch } } : {}));

  const download = async () => {
    const text = await exportData(backupPw || undefined);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lockedin-backup-${new Date().toISOString().slice(0, 10)}${backupPw ? '-encrypted' : ''}.json`;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(backupPw ? 'Encrypted backup saved 🔐' : 'Backup saved. ⚠️ It is NOT encrypted: store it somewhere private.');
  };

  return (
    <Page>
      <h1>Settings</h1>
      <div className="grid2">
        <div className="col" style={{ gap: 16 }}>
          <Card>
            <Sec no="01" title="AI coach" />
            <p className="small muted" style={{ marginBottom: 10 }}>
              Bring your own free API key. Requests go straight from your device to the provider over HTTPS. LockedIn has
              no server and never sees your chats.
            </p>
            <label className="lbl">Provider</label>
            <select className="input" value={p} onChange={(e) => setSettings({ provider: e.target.value as Provider })}>
              {(Object.keys(PROVIDERS) as Provider[]).map((k) => (
                <option key={k} value={k}>
                  {PROVIDERS[k].name}
                </option>
              ))}
            </select>
            <p className="small dim" style={{ marginTop: 6 }}>
              {prov.note}
            </p>
            {p !== 'offline' && (
              <div className="col" style={{ gap: 10, marginTop: 10 }}>
                <div>
                  <label className="lbl">
                    API key ·{' '}
                    <a href={prov.keyUrl} target="_blank" rel="noopener noreferrer">
                      get a free one →
                    </a>
                  </label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={300}
                    placeholder="Paste your key"
                    value={s.settings.apiKeys[p] ?? ''}
                    onChange={(e) =>
                      // printable ASCII only, so a pasted key can never inject into HTTP headers
                      setSettings({ apiKeys: { ...s.settings.apiKeys, [p]: e.target.value.replace(/[^\x21-\x7e]/g, '') } })
                    }
                  />
                </div>
                <div>
                  <label className="lbl">Model (optional)</label>
                  <input
                    className="input"
                    spellCheck={false}
                    maxLength={100}
                    placeholder={prov.defaultModel}
                    value={model}
                    onChange={(e) => setSettings({ models: { ...s.settings.models, [p]: e.target.value } })}
                  />
                  {model && !MODEL_RE.test(model) && (
                    <p className="small" style={{ color: 'var(--orange)' }}>
                      Invalid model name: the default will be used.
                    </p>
                  )}
                </div>
                <Btn
                  variant="sm"
                  onClick={async () => {
                    setTest('Testing…');
                    try {
                      const r = await askCoach(getState(), [{ role: 'user', content: 'Say hi in 8 words or fewer.', at: Date.now() }]);
                      setTest(r.offline ? '⚠️ No key set, using offline coach.' : `✅ Works! "${r.text.slice(0, 80)}"`);
                    } catch (e) {
                      setTest(`❌ ${e instanceof Error ? e.message : e}`);
                    }
                  }}
                >
                  Test connection
                </Btn>
                {test && <p className="small">{test}</p>}
                <p className="small dim">
                  🔐 Keys stay on this device, are never put in backups, and are {lock.encrypted ? 'encrypted with your passcode.' : 'NOT encrypted until you set a passcode.'}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <Sec no="02" title="Profile" />
            <div className="col" style={{ gap: 10 }}>
              <div>
                <label className="lbl">Nickname</label>
                <input
                  className="input"
                  spellCheck={false}
                  value={s.profile?.nickname ?? ''}
                  maxLength={24}
                  onChange={(e) => setProfile({ nickname: e.target.value })}
                />
              </div>
              <div>
                <label className="lbl">Your why</label>
                <textarea
                  className="input"
                  rows={3}
                  spellCheck={false}
                  value={s.profile?.why ?? ''}
                  maxLength={300}
                  onChange={(e) => setProfile({ why: e.target.value })}
                />
              </div>
              <div>
                <label className="lbl">Goal: {s.profile?.goalDays} days</label>
                <div className="chips">
                  {[7, 30, 60, 90, 180, 365].map((d) => (
                    <button key={d} className={`chip ${s.profile?.goalDays === d ? 'on' : ''}`} onClick={() => setProfile({ goalDays: d })}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <Btn onClick={onRetake}>🧪 Retake the assessment</Btn>
            </div>
          </Card>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <PasscodeCard />

          <Card>
            <Sec no="04" title="Display" />
            <label className="row small" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={s.settings.reduceMotion} onChange={(e) => setSettings({ reduceMotion: e.target.checked })} />
              Reduce animations
            </label>
          </Card>

          <Card>
            <Sec no="05" title="Your data" />
            <p className="small muted" style={{ marginBottom: 10 }}>
              Everything lives on this device. Back it up to move to a new phone. Set a backup password to encrypt the file
              (strongly recommended).
            </p>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              maxLength={128}
              placeholder="Backup password (optional, recommended)"
              value={backupPw}
              onChange={(e) => setBackupPw(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <div className="row wrap">
              <Btn variant="sm" onClick={() => void download()}>
                ⬇️ Export backup
              </Btn>
              <Btn variant="sm" onClick={() => fileRef.current?.click()}>
                ⬆️ Import backup
              </Btn>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > MAX_IMPORT_BYTES) {
                    setMsg('Import failed: file is too large to be a LockedIn backup.');
                    return;
                  }
                  if (!confirm('Importing replaces ALL current data on this device with the backup. Continue?')) return;
                  try {
                    await importData(await f.text(), backupPw || undefined);
                    setMsg('Backup restored ✅');
                  } catch (err) {
                    setMsg(`Import failed: ${err instanceof Error ? err.message : err}`);
                  }
                }}
              />
            </div>
            <hr className="sep" style={{ margin: '14px 0' }} />
            <Btn
              variant="danger sm"
              onClick={() => {
                if (confirm('Delete ALL LockedIn data on this device? This cannot be undone.')) resetAll();
              }}
            >
              🗑️ Delete everything
            </Btn>
          </Card>

          {msg && <div className="banner small">{msg}</div>}

          <Card>
            <Sec no="06" title="Need more help?" />
            <p className="small muted">
              If you're struggling with your mental health or feel unsafe, find a free helpline in your country at{' '}
              <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
                findahelpline.com
              </a>
              . Support groups like SAA, SMART Recovery or a therapist who works with compulsive sexual behaviour can make a
              huge difference.
            </p>
          </Card>

          <p className="small dim center">LockedIn v0.2 · free & open source · no servers, no tracking</p>
        </div>
      </div>
    </Page>
  );
}
