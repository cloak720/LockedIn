import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from '../lib/confetti';
import { PANIC_LINES, pick, WIN_LINES } from '../lib/memes';
import { buzz, logUrge, useAppState } from '../lib/store';
import { Btn, Stamp } from './ui';

type Tool = 'menu' | 'breathe' | 'surf' | 'bonk' | 'pushups' | 'why' | 'end' | 'won';

const TOOLS: { id: Tool; name: string; desc: string }[] = [
  { id: 'bonk', name: 'Bonk the urge', desc: 'Go to horny jail. Not you. The urge.' },
  { id: 'breathe', name: 'Breathe', desc: '4-7-8 breathing · 1 minute' },
  { id: 'surf', name: 'Urge surf', desc: 'Ride the wave · it always breaks' },
  { id: 'pushups', name: 'Drop & give 20', desc: 'Convert horny into gains' },
  { id: 'why', name: 'Remember why', desc: 'Play the tape forward' },
];

function Breathe({ onDone }: { onDone: () => void }) {
  const phases = [
    { label: 'Breathe in', word: 'In', secs: 4, scale: 1.35 },
    { label: 'Hold', word: 'Hold', secs: 7, scale: 1.35 },
    { label: 'Breathe out', word: 'Out', secs: 8, scale: 0.7 },
  ];
  const [p, setP] = useState(0);
  const [round, setRound] = useState(1);
  const ROUNDS = 3;
  useEffect(() => {
    const t = setTimeout(() => {
      buzz(20);
      if (p < 2) setP(p + 1);
      else if (round < ROUNDS) {
        setP(0);
        setRound(round + 1);
      } else onDone();
    }, phases[p].secs * 1000);
    return () => clearTimeout(t);
  }, [p, round]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="col center" style={{ alignItems: 'center', gap: 28, padding: '40px 0' }}>
      <motion.div
        animate={{ scale: phases[p].scale }}
        transition={{ duration: phases[p].secs, ease: 'easeInOut' }}
        className="breath"
      >
        {phases[p].word}
      </motion.div>
      <h1>{phases[p].label}</h1>
      <p className="mono small muted">
        Round {round}/{ROUNDS} · {phases[p].secs}s
      </p>
    </div>
  );
}

function Surf({ onDone }: { onDone: () => void }) {
  const TOTAL = 600;
  const [left, setLeft] = useState(TOTAL);
  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const elapsed = TOTAL - left;
  const msgs = [
    'Notice the urge. Where do you feel it in your body? Just observe. No action required.',
    "It's building. That's the wave. You are the surfer, not the wave.",
    "This is the peak. It can't get much higher. Breathe through it.",
    "Feel that? It's already fading. The wave is breaking.",
    'The wave went back out. You rode it.',
  ];
  const msg = msgs[Math.min(msgs.length - 1, Math.floor((elapsed / TOTAL) * msgs.length))];
  const x = elapsed / TOTAL;
  const intensity = x < 0.35 ? x / 0.35 : 1 - (x - 0.35) / 0.65;
  return (
    <div className="col" style={{ gap: 18, padding: '20px 0' }}>
      <p className="lbl">Urge surf · 10 minutes</p>
      <div className="big-timer">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </div>
      <div>
        <p className="lbl">Urge intensity (typical curve)</p>
        <div className="bar" style={{ height: 14 }}>
          <motion.i animate={{ width: `${Math.max(4, intensity * 100)}%` }} style={{ background: 'var(--shu)' }} />
        </div>
      </div>
      <p style={{ fontSize: 18 }}>{msg}</p>
      <Btn variant="primary" onClick={onDone}>
        The urge passed
      </Btn>
    </div>
  );
}

function Bonk({ onDone }: { onDone: () => void }) {
  const GOAL = 15;
  const [hits, setHits] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [pop, setPop] = useState<{ id: number; x: number; y: number; t: string }[]>([]);
  const id = useRef(0);
  const SFX = ['BONK', 'horny jail', "nah I'd win", 'L + ratio', 'begone', 'skill issue', 'caught in 4K', '-1 urge', 'gigachad move'];
  useEffect(() => {
    const t = setInterval(() => setPos({ x: 14 + Math.random() * 72, y: 14 + Math.random() * 70 }), Math.max(450, 1100 - hits * 40));
    return () => clearInterval(t);
  }, [hits]);
  const hit = () => {
    buzz(25);
    const n = hits + 1;
    setHits(n);
    const pid = id.current++;
    setPop((p) => [...p, { id: pid, x: pos.x, y: pos.y, t: pick(SFX) }]);
    setTimeout(() => setPop((p) => p.filter((q) => q.id !== pid)), 700);
    setPos({ x: 14 + Math.random() * 72, y: 14 + Math.random() * 70 });
    if (n >= GOAL) setTimeout(onDone, 400);
  };
  const size = Math.max(48, 76 - hits * 1.6);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="spread">
        <h2>Bonk the urge</h2>
        <span className="badge shu">
          {hits}/{GOAL}
        </span>
      </div>
      <p className="small muted">Tap the urge before it escapes. It gets faster.</p>
      <div className="arena">
        <motion.button
          onPointerDown={hit}
          animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          whileTap={{ scale: 0.6, rotate: 30 }}
          className="target"
          style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, fontSize: Math.max(12, size * 0.24) }}
          aria-label="Bonk the urge"
        >
          Urge
        </motion.button>
        <AnimatePresence>
          {pop.map((p) => (
            <motion.span
              key={p.id}
              className="arena-pop"
              initial={{ opacity: 1, y: 0, scale: 0.7 }}
              animate={{ opacity: 0, y: -50, scale: 1.2 }}
              exit={{ opacity: 0 }}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {p.t}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <p className="small muted center mono">Every bonk is a vote for who you're becoming.</p>
    </div>
  );
}

function Pushups({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  return (
    <div className="col center" style={{ alignItems: 'center', gap: 16, padding: '20px 0' }}>
      <p className="lbl">Drop & give 20</p>
      <motion.div key={n} initial={{ scale: 1.5, color: 'var(--shu)' }} animate={{ scale: 1, color: 'var(--ink)' }} className="big-timer">
        {n}
      </motion.div>
      <p className="muted">Hit the floor. Tap after each rep. Squats and jumping jacks count. Convert the energy.</p>
      <Btn
        variant="primary big"
        onClick={() => {
          buzz(20);
          const v = n + 1;
          setN(v);
          if (v >= 20) onDone();
        }}
      >
        +1 rep
      </Btn>
      <Btn variant="ghost sm" onClick={onDone}>
        Did them, skip counting
      </Btn>
    </div>
  );
}

function Why({ onDone }: { onDone: () => void }) {
  const s = useAppState();
  return (
    <div className="col" style={{ gap: 16 }}>
      <p className="lbl">You told us why you started</p>
      <p className="why" style={{ fontSize: 26 }}>
        “{s.profile?.why || 'To be the best version of myself.'}”
      </p>
      <hr className="sep" />
      <p className="lbl">Play the tape forward</p>
      <p>
        20 minutes from now, version A gave in: tired, empty, streak gone, scrolling for something to fill the hole. Version
        B didn't: proud, energy intact, aura untouched. Pick which one shows up.
      </p>
      <Btn variant="primary block" onClick={onDone}>
        Version B. Obviously.
      </Btn>
    </div>
  );
}

export default function PanicMode({ onClose, onRelapse, onCoach }: { onClose: () => void; onRelapse: () => void; onCoach: () => void }) {
  const [tool, setTool] = useState<Tool>('menu');
  const [used, setUsed] = useState<string>('menu');
  const line = useMemo(() => pick(PANIC_LINES), []);
  const winLine = useMemo(() => pick(WIN_LINES), []);

  useEffect(() => {
    buzz([40, 60, 40]);
  }, []);

  const finishTool = () => setTool('end');
  const open = (t: Tool) => {
    setUsed(t);
    setTool(t);
  };

  return (
    <div className="narrow col" style={{ gap: 18 }}>
      <div className="spread">
        <span className="badge shu">Horny jail</span>
        <Btn variant="ghost sm" onClick={() => (tool === 'menu' || tool === 'won' ? onClose() : setTool('menu'))}>
          {tool === 'menu' || tool === 'won' ? '✕ Close' : '← Tools'}
        </Btn>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
          {tool === 'menu' && (
            <div className="col" style={{ gap: 16 }}>
              <motion.h1 className="jail-title" animate={{ rotate: [0, -2, 2, -1, 0] }} transition={{ duration: 0.5 }}>
                Hold up.
              </motion.h1>
              <p className="muted" style={{ fontSize: 17 }}>
                {line}
              </p>
              <div className="strip red">
                <span className="mono small">Step zero</span>
                <span>Stand up and walk into a different room. Right now. Then pick a weapon.</span>
              </div>
              <div className="plist">
                {TOOLS.map((t, i) => (
                  <motion.button key={t.id} onClick={() => open(t.id)} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <span className="n">0{i + 1}</span>
                    <span className="txt">
                      <b>{t.name}</b>
                      <span className="small muted">{t.desc}</span>
                    </span>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </motion.button>
                ))}
                <motion.button onClick={onCoach} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <span className="n">06</span>
                  <span className="txt">
                    <b>Ask the coach</b>
                    <span className="small muted">AI coach that knows your triggers</span>
                  </span>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </motion.button>
              </div>
            </div>
          )}
          {tool === 'breathe' && <Breathe onDone={finishTool} />}
          {tool === 'surf' && <Surf onDone={finishTool} />}
          {tool === 'bonk' && <Bonk onDone={finishTool} />}
          {tool === 'pushups' && <Pushups onDone={finishTool} />}
          {tool === 'why' && <Why onDone={finishTool} />}

          {tool === 'end' && (
            <div className="card col">
              <p className="lbl">Status check</p>
              <h2>How's the urge now?</h2>
              <Btn
                variant="mint big block"
                onClick={() => {
                  logUrge(true, used);
                  confetti({ particleCount: 160, spread: 110, origin: { y: 0.6 } });
                  setTool('won');
                }}
              >
                Gone. I won.
              </Btn>
              <Btn variant="block" onClick={() => setTool('menu')}>
                Still there. Another tool.
              </Btn>
              <Btn
                variant="ghost block"
                onClick={() => {
                  logUrge(false, used);
                  onRelapse();
                }}
              >
                I gave in
              </Btn>
            </div>
          )}

          {tool === 'won' && (
            <div className="col center" style={{ alignItems: 'center', gap: 16, paddingTop: 20 }}>
              <Stamp text="W" size={120} stamp rotate={-10} />
              <h1>{winLine}</h1>
              <p className="muted">Logged. Every urge you beat makes the next one weaker. That's literally how rewiring works.</p>
              <Btn variant="primary block" onClick={onClose}>
                Back to the grind
              </Btn>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
