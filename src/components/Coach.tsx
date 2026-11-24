import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { askCoach, PROVIDERS } from '../lib/ai';
import { getState, setState, useAppState, type ChatMsg } from '../lib/store';
import { Btn, Page } from './ui';

const QUICK = ["I'm having an urge rn", 'I just slipped', 'Plan for tonight', 'I feel bored and lonely'];

function ConsentCard() {
  return (
    <div className="card consent">
      <p className="lbl">Before you chat</p>
      <h2>Turn on the free AI coach?</h2>
      <ul className="facts">
        <li>
          <b>Free for everyone</b>, with a fair daily limit. No account, no payment, ever.
        </li>
        <li>
          Your <b>messages</b> and a <b>short summary</b> (nickname, streak, tier, top triggers, danger hours) go through
          LockedIn's relay to <b>Google Gemini</b>. Your journal, check-ins and slip stories stay on your phone.
        </li>
        <li>LockedIn stores nothing about your chats. Google's free tier may use chats to improve its products.</li>
        <li>Prefer full privacy? The offline coach never sends anything anywhere.</li>
      </ul>
      <div className="consent-actions">
        <Btn variant="primary" onClick={() => setState((st) => ({ settings: { ...st.settings, provider: 'lockedin', aiConsent: true } }))}>
          Turn on AI coach
        </Btn>
        <Btn onClick={() => setState((st) => ({ settings: { ...st.settings, provider: 'offline', aiConsent: false } }))}>
          Stay offline
        </Btn>
      </div>
    </div>
  );
}

export default function Coach({ goSettings }: { goSettings: () => void }) {
  const s = useAppState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const p = s.settings.provider;
  const needsConsent = p === 'lockedin' && !s.settings.aiConsent;
  const usingCloud = (p === 'lockedin' && s.settings.aiConsent) || (p !== 'lockedin' && p !== 'offline' && !!s.settings.apiKeys[p]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [s.chat.length, busy]);

  const send = async (content: string) => {
    const c = content.trim();
    if (!c || busy) return;
    setError(null);
    setNotice(null);
    setText('');
    const userMsg: ChatMsg = { role: 'user', content: c, at: Date.now() };
    setState((st) => ({ chat: [...st.chat, userMsg].slice(-100) }));
    setBusy(true);
    try {
      const r = await askCoach(getState(), getState().chat);
      setState((st) => ({ chat: [...st.chat, { role: 'assistant' as const, content: r.text, at: Date.now() }].slice(-100) }));
      if (r.notice) setNotice(r.notice);
      if (typeof r.remaining === 'number') setRemaining(r.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const status =
    p === 'lockedin'
      ? s.settings.aiConsent
        ? `LockedIn AI${remaining !== null ? ` · ${remaining} left today` : ''}`
        : 'Offline coach until you turn AI on'
      : p === 'offline'
        ? 'Offline coach · nothing leaves your phone'
        : usingCloud
          ? PROVIDERS[p].name
          : 'Offline coach (no key set)';

  return (
    <Page>
      <header className="page-head">
        <div>
          <h1>Coach</h1>
          <p className="small mono muted">{status}</p>
        </div>
        <div className="row">
          <Btn variant="ghost sm" onClick={goSettings}>
            Options
          </Btn>
          {s.chat.length > 0 && (
            <Btn variant="ghost sm" onClick={() => confirm('Clear the whole chat?') && setState({ chat: [] })} aria-label="Clear chat">
              Clear
            </Btn>
          )}
        </div>
      </header>

      {needsConsent && <ConsentCard />}

      <div className="chat">
        {s.chat.length === 0 && (
          <div className="msg bot">
            Yo {s.profile?.nickname}. I'm Lock. I know your streak, your triggers and your danger hours, so this isn't
            generic advice. Urge? Slip? Just bored at 2am? Talk to me. Zero judgement, ever.
          </div>
        )}
        <AnimatePresence initial={false}>
          {s.chat.map((m) => (
            <motion.div key={m.at + m.role} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="msg bot dots" aria-label="Coach is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {notice && <p className="small mono muted center">{notice}</p>}
        {error && (
          <div className="banner red small">
            {error}
            <div className="row" style={{ marginTop: 8 }}>
              <Btn variant="sm" onClick={goSettings}>
                Check settings
              </Btn>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {s.chat.length === 0 && (
        <div className="chips">
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => void send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          className="input grow"
          spellCheck={false}
          autoComplete="off"
          maxLength={2000}
          placeholder="Talk to Lock…"
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Btn variant="primary" type="submit" disabled={busy || !text.trim()} aria-label="Send">
          Send
        </Btn>
      </form>
      <div className="row wrap" style={{ justifyContent: 'center', gap: 10 }}>
        <span className="dim small">Lock is an AI, not a therapist.</span>
        <a className="btn ghost sm" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
          In a crisis? Find a helpline ↗
        </a>
      </div>
    </Page>
  );
}
