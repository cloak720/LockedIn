import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { askCoach, PROVIDERS } from '../lib/ai';
import { getState, setState, useAppState, type ChatMsg } from '../lib/store';
import { Btn, Page, Stamp } from './ui';

const QUICK = [
  "I'm having an urge rn",
  'I just relapsed',
  'Give me a plan for tonight',
  'Why is this so hard?',
  'I feel bored and lonely',
];

export default function Coach({ goSettings }: { goSettings: () => void }) {
  const s = useAppState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prov = PROVIDERS[s.settings.provider];
  const usingAI = s.settings.provider !== 'offline' && !!s.settings.apiKeys[s.settings.provider];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [s.chat.length, busy]);

  const send = async (content: string) => {
    const c = content.trim();
    if (!c || busy) return;
    setError(null);
    setText('');
    const userMsg: ChatMsg = { role: 'user', content: c, at: Date.now() };
    setState((st) => ({ chat: [...st.chat, userMsg].slice(-100) }));
    setBusy(true);
    try {
      const { text: reply } = await askCoach(getState(), getState().chat);
      setState((st) => ({ chat: [...st.chat, { role: 'assistant' as const, content: reply, at: Date.now() }].slice(-100) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 14 }}>
          <Stamp text="Coach" size={58} />
          <div>
            <h1 style={{ fontSize: 'clamp(30px, 9vw, 44px)', whiteSpace: 'nowrap' }}>Coach Lock</h1>
            <p className="small mono muted">
              {usingAI ? `Powered by ${prov.name}` : 'Offline mode'} ·{' '}
              <button onClick={goSettings} className="mono" style={{ background: 'none', border: 0, color: 'var(--shu)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                {usingAI ? 'change' : 'add free AI'}
              </button>
            </p>
          </div>
        </div>
        {s.chat.length > 0 && (
          <Btn variant="ghost sm" onClick={() => confirm('Clear the whole chat?') && setState({ chat: [] })} aria-label="Clear chat">
            Clear
          </Btn>
        )}
      </div>

      <div className="chat">
        {s.chat.length === 0 && (
          <div className="msg bot">
            Yo {s.profile?.nickname}. I'm Lock, your coach. I know your streak, your triggers and your danger hours, so this is
            not generic advice. Urge? Relapse? Just bored at 2am? Talk to me. Zero judgement, ever.
          </div>
        )}
        <AnimatePresence initial={false}>
          {s.chat.map((m) => (
            <motion.div
              key={m.at + m.role}
              className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
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
        {error && (
          <div className="banner red small">
            {error}
            <div className="row" style={{ marginTop: 8 }}>
              <Btn variant="sm" onClick={goSettings}>
                Check settings
              </Btn>
              <Btn
                variant="sm"
                onClick={() => {
                  setError(null);
                  const last = getState().chat.filter((m) => m.role === 'user').pop();
                  if (last) {
                    setState((st) => ({ chat: st.chat.filter((m) => m !== last) }));
                    void send(last.content);
                  }
                }}
              >
                Retry
              </Btn>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {s.chat.length < 2 && (
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
      <p className="dim small center mono">Lock is an AI, not a therapist. In a crisis: findahelpline.com</p>
    </Page>
  );
}
