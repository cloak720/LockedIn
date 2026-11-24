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
import { Btn, Fold, Page } from './ui';

const AUTOLOCK = [
  { v: 0, label: 'Immediately' },
  { v: 60, label: '1 min' },
  { v: 300, label: '5 min' },
  { v: 900, label: '15 min' },
  { v: -1, label: 'Never' },
];

const setSettings = (patch: Partial<SettingsT>) => setState((st) => ({ settings: { ...st.settings, ...patch } }));

/* ------------------------------------------------------------------ */
function CoachSettings() {
  const s = useAppState();
  const lock = useLock();
  const [test, setTest] = useState<string | null>(null);
  const p = s.settings.provider;
  const prov = PROVIDERS[p];
  const model = s.settings.models[p] ?? '';
  const byok = p === 'gemini' || p === 'groq' || p === 'openrouter';

  return (
    <div className="col">
      <select id="provider" aria-label="Coach type" className="input" value={p} onChange={(e) => setSettings({ provider: e.target.value as Provider })}>
        {(Object.keys(PROVIDERS) as Provider[]).map((k) => (
          <option key={k} value={k}>
            {PROVIDERS[k].name}
          </option>
        ))}
      </select>
      <p className="small muted">{prov.note}</p>

      {p === 'lockedin' && (
        <div className="setting-row">
          <div>
            <b>Share chats with the AI</b>
            <p className="small muted">
              {s.settings.aiConsent
                ? 'On. Messages + a short summary go to Google Gemini via LockedIn’s relay. Nothing is stored by LockedIn.'
                : 'Off. The offline coach answers until you turn this on.'}
            </p>
          </div>
          <Btn variant={s.settings.aiConsent ? 'sm' : 'primary sm'} onClick={() => setSettings({ aiConsent: !s.settings.aiConsent })}>
            {s.settings.aiConsent ? 'Turn off' : 'Turn on'}
          </Btn>
        </div>
      )}

      {byok && (
        <>
          <div>
            <div className="spread" style={{ marginBottom: 8 }}>
              <label className="lbl" htmlFor="apikey" style={{ margin: 0 }}>
                API key
              </label>
              <a className="btn ghost sm" href={prov.keyUrl} target="_blank" rel="noopener noreferrer">
                Get a free key ↗
              </a>
            </div>
            <input
              id="apikey"
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={300}
              placeholder="Paste your key"
              value={s.settings.apiKeys[p] ?? ''}
              // printable ASCII only, so a pasted key can never inject into HTTP headers
              onChange={(e) => setSettings({ apiKeys: { ...s.settings.apiKeys, [p]: e.target.value.replace(/[^\x21-\x7e]/g, '') } })}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="model">
              Model (optional)
            </label>
            <input
              id="model"
              className="input"
              spellCheck={false}
              maxLength={100}
              placeholder={prov.defaultModel}
              value={model}
              onChange={(e) => setSettings({ models: { ...s.settings.models, [p]: e.target.value } })}
            />
            {model && !MODEL_RE.test(model) && <p className="small shu">Invalid model name: the default will be used.</p>}
          </div>
          <p className="small dim">
            Your key stays on this device, is never put in backups, and is{' '}
            {lock.encrypted ? 'encrypted with your passcode.' : 'not encrypted until you set a passcode.'}
          </p>
        </>
      )}

      {p !== 'offline' && (
        <div className="row wrap">
          <Btn
            variant="sm"
            onClick={async () => {
              setTest('Testing…');
              try {
                const r = await askCoach(getState(), [{ role: 'user', content: 'Say hi in 8 words or fewer.', at: Date.now() }]);
                setTest(r.offline ? r.notice ?? 'Using the offline coach.' : `Works: "${r.text.slice(0, 80)}"`);
              } catch (e) {
                setTest(`Failed: ${e instanceof Error ? e.message : e}`);
              }
            }}
          >
            Test coach
          </Btn>
          {test && <span className="small">{test}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function PasscodeSettings() {
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
      <div className="col">
        <p className="small muted">
          Everything (journal, slips, chat, keys) is encrypted on this device with AES-256. Without your passcode it's
          unreadable, even to someone with full access to the phone's storage.
        </p>
        <label className="lbl">Auto-lock after the app is in the background for</label>
        <div className="chips">
          {AUTOLOCK.map((o) => (
            <button key={o.v} className={`chip ${s.settings.autoLockSec === o.v ? 'on' : ''}`} onClick={() => setSettings({ autoLockSec: o.v })}>
              {o.label}
            </button>
          ))}
        </div>
        <div>
          <Btn variant="primary sm" onClick={() => void lockNow()}>
            Lock now
          </Btn>
        </div>
        <hr className="sep" />
        <label className="lbl" htmlFor="offpass">
          Turn off encryption (enter current passcode)
        </label>
        <div className="row">
          <input
            id="offpass"
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
        {msg && <p className="small">{msg}</p>}
      </div>
    );
  }

  return (
    <form
      className="col"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!strength.ok || a !== b) return;
        setBusy(true);
        setMsg(null);
        try {
          await enableVault(a);
          setA('');
          setB('');
          setMsg('Encrypted. You will need this passcode to open the app. It cannot be recovered if you forget it.');
        } catch (err) {
          setMsg(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="small muted">
        Encryption is off. Anyone who can open this phone's browser could read your journal
        {Object.keys(s.settings.apiKeys).length ? ' and your AI keys' : ''}. A passcode encrypts everything.
      </p>
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        maxLength={128}
        placeholder="New passcode (6+ characters)"
        aria-label="New passcode"
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      {a && <p className={`small ${strength.ok ? '' : 'shu'}`}>{strength.label}</p>}
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        maxLength={128}
        placeholder="Repeat passcode"
        aria-label="Repeat passcode"
        value={b}
        onChange={(e) => setB(e.target.value)}
      />
      {b && a !== b && <p className="small shu">Passcodes don't match</p>}
      <Btn variant="primary" type="submit" disabled={!strength.ok || a !== b || busy}>
        {busy ? 'Encrypting…' : 'Encrypt & enable lock'}
      </Btn>
      {msg && <p className="small">{msg}</p>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
function DataSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupPw, setBackupPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const download = async () => {
    const text = await exportData(backupPw || undefined);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lockedin-backup-${new Date().toISOString().slice(0, 10)}${backupPw ? '-encrypted' : ''}.json`;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(backupPw ? 'Encrypted backup saved.' : 'Backup saved. It is NOT encrypted: keep it somewhere private.');
  };

  return (
    <div className="col">
      <p className="small muted">Everything lives on this phone. Back it up before switching phones or clearing your browser.</p>
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        maxLength={128}
        placeholder="Backup password (recommended)"
        aria-label="Backup password"
        value={backupPw}
        onChange={(e) => setBackupPw(e.target.value)}
      />
      <div className="row wrap">
        <Btn variant="sm" onClick={() => void download()}>
          Export backup
        </Btn>
        <Btn variant="sm" onClick={() => fileRef.current?.click()}>
          Import backup
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
              setMsg('Backup restored.');
            } catch (err) {
              setMsg(`Import failed: ${err instanceof Error ? err.message : err}`);
            }
          }}
        />
      </div>
      {msg && <p className="small">{msg}</p>}
      <hr className="sep" />
      <div>
        <Btn
          variant="danger sm"
          onClick={() => {
            if (confirm('Delete ALL LockedIn data on this device? This cannot be undone.')) resetAll();
          }}
        >
          Delete everything
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function Settings({ onRetake }: { onRetake: () => void }) {
  const s = useAppState();
  const lock = useLock();
  const setProfile = (patch: Partial<NonNullable<typeof s.profile>>) =>
    setState((st) => (st.profile ? { profile: { ...st.profile, ...patch } } : {}));

  return (
    <Page className="settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <div className="folds">
        <Fold no="01" title="AI coach" hint={PROVIDERS[s.settings.provider].name.replace(/ \(.*\)$/, '')} open>
          <CoachSettings />
        </Fold>

        <Fold no="02" title="Passcode & encryption" hint={lock.encrypted ? 'On' : 'Off'} open={!lock.encrypted}>
          <PasscodeSettings />
        </Fold>

        <Fold no="03" title="Profile & goal" hint={`${s.profile?.goalDays ?? 90}-day goal`}>
          <div className="col">
            <div>
              <label className="lbl" htmlFor="nick">
                Nickname
              </label>
              <input id="nick" className="input" spellCheck={false} value={s.profile?.nickname ?? ''} maxLength={24} onChange={(e) => setProfile({ nickname: e.target.value })} />
            </div>
            <div>
              <label className="lbl" htmlFor="why">
                Your why
              </label>
              <textarea id="why" className="input" rows={3} spellCheck={false} value={s.profile?.why ?? ''} maxLength={300} onChange={(e) => setProfile({ why: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Goal</label>
              <div className="chips">
                {[7, 30, 60, 90, 180, 365].map((d) => (
                  <button key={d} className={`chip ${s.profile?.goalDays === d ? 'on' : ''}`} onClick={() => setProfile({ goalDays: d })}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Btn variant="sm" onClick={onRetake}>
                Retake the assessment
              </Btn>
            </div>
          </div>
        </Fold>

        <Fold no="04" title="Backup & data">
          <DataSettings />
        </Fold>

        <Fold no="05" title="Display" hint={s.settings.reduceMotion ? 'Reduced motion' : undefined}>
          <label className="row small" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={s.settings.reduceMotion} onChange={(e) => setSettings({ reduceMotion: e.target.checked })} />
            Reduce animations
          </label>
        </Fold>

        <Fold no="06" title="Help & privacy">
          <div className="col">
            <p className="small muted">
              Struggling with your mental health or feeling unsafe? Find a free helpline in your country. Groups like SMART
              Recovery or SAA, or a therapist who works with compulsive sexual behaviour, can make a huge difference.
            </p>
            <p className="small muted">Everything stays on your phone, except chats you choose to send to the AI coach.</p>
            <div className="btn-row">
              <a className="btn sm" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
                Find a helpline ↗
              </a>
              <a className="btn ghost sm" href="./privacy.html" target="_blank" rel="noopener">
                Privacy policy ↗
              </a>
            </div>
          </div>
        </Fold>
      </div>

      <p className="small dim center mono">LockedIn v0.4 · free forever · open source</p>
    </Page>
  );
}
