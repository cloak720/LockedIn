import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from '../lib/confetti';
import { useNow } from '../lib/hooks';
import { analyze } from '../lib/insights';
import { DAILY_LINES, dailyPick, MOOD_SCALE, pick, urgeLabel } from '../lib/memes';
import { buzz, dayKey, saveCheckIn, setState, useAppState } from '../lib/store';
import { DAY, fmtDuration, nextRank, rankFor, recoveryRate, split, streakMs, totalCleanMs, type Rank } from '../lib/streak';
import { Btn, Overlay, Page, Sec, Stamp, TierLadder, TierMeter } from './ui';

const AURA_LINES = ['+1000 aura', 'aura farming detected', 'mogging the sun', 'W', '+∞ aura', 'built different', 'locked in', 'gigachad energy'];

/* ------------------------------------------------------------------ */
/*  The poster card: red sun, giant day count, tier, live clock         */
/* ------------------------------------------------------------------ */
function Poster({ ms, badge }: { ms: number; badge?: string }) {
  const days = Math.floor(ms / DAY);
  const rank = rankFor(days);
  const nxt = nextRank(days);
  const { d, h, m, s } = split(ms);
  const [taps, setTaps] = useState(0);
  const [pops, setPops] = useState<{ id: number; text: string; x: number }[]>([]);
  const id = useRef(0);
  const sun = useAnimation();

  const tapSun = () => {
    buzz(15);
    const n = taps + 1;
    setTaps(n);
    void sun.start({ scale: [1, 0.93, 1.03, 1], transition: { duration: 0.45 } });
    const text =
      n === 10 ? 'ok you can stop farming now' : n === 25 ? '−5000 aura for aura farming' : n === 50 ? 'go touch grass' : pick(AURA_LINES);
    const pid = id.current++;
    setPops((p) => [...p, { id: pid, text, x: 25 + Math.random() * 50 }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== pid)), 1100);
  };

  return (
    <section className="card poster">
      <div className="poster-head">
        <span className="badge shu">Tier {String(rank.tier).padStart(2, '0')} / 09</span>
        {badge && <span className="badge">{badge}</span>}
      </div>

      <div className="poster-art">
        <motion.button className="sun" onClick={tapSun} animate={sun} aria-label="Tap the sun to farm aura">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                className="sun-pop"
                style={{ left: `${p.x}%` }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: -60 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.button>
        <motion.div
          className={`poster-num len${Math.min(4, String(d).length)}`}
          key={d}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          {d}
        </motion.div>
      </div>

      <div className="poster-meta">
        <span>
          {d === 1 ? 'Day' : 'Days'} + {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
        <span className="shu">{taps > 0 ? `Aura ${(taps * 1000).toLocaleString()}` : 'Tap the sun'}</span>
      </div>

      <h1 className="poster-title">{rank.name}</h1>
      <p className="muted">{rank.line}</p>

      <TierMeter tier={rank.tier} />
      <p className="small mono">
        {nxt ? (
          <>
            Next: <b>{nxt.name}</b> in {fmtDuration(nxt.days * DAY - ms)}
          </>
        ) : (
          'Max tier. Ascended. Nothing left to unlock but your potential.'
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Daily check-in: "it's over" → "we're so back", stamped DONE          */
/* ------------------------------------------------------------------ */
function CheckInCard() {
  const s = useAppState();
  const today = s.checkins.find((c) => c.day === dayKey());
  const [mood, setMood] = useState(3);
  const [urge, setUrge] = useState(3);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [justStamped, setJustStamped] = useState(false);
  const shake = useAnimation();

  if (today && !editing) {
    return (
      <motion.div className="card" animate={shake}>
        <Sec no="01" title="Daily check-in" />
        <div className="checked">
          <Stamp text="Done" size={64} stamp={justStamped} />
          <div>
            <p className="checked-title">{MOOD_SCALE[today.mood - 1].label}</p>
            <p className="small mono muted">
              Urge {today.urge}/10 · {urgeLabel(today.urge)}
            </p>
            {today.note && <p className="small" style={{ marginTop: 4 }}>“{today.note}”</p>}
          </div>
          <Btn
            variant="ghost sm"
            onClick={() => {
              setMood(today.mood);
              setUrge(today.urge);
              setNote(today.note);
              setEditing(true);
            }}
          >
            Edit
          </Btn>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="card" animate={shake}>
      <Sec no="01" title="Daily check-in" />
      <p className="lbl">Vibe check</p>
      <div className="mood-row" role="radiogroup" aria-label="Mood">
        {MOOD_SCALE.map((x, i) => (
          <motion.button
            key={x.label}
            role="radio"
            aria-checked={mood === i + 1}
            aria-label={x.label}
            className={`mood ${mood === i + 1 ? 'on' : ''}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              buzz(8);
              setMood(i + 1);
            }}
          >
            {x.short}
          </motion.button>
        ))}
      </div>
      <div className="mood-scale mono small">
        <span>It's over</span>
        <motion.b key={mood} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="shu">
          {MOOD_SCALE[mood - 1].label}
        </motion.b>
        <span>So back</span>
      </div>

      <label className="lbl" style={{ marginTop: 18 }} htmlFor="urge">
        Urge level {urge}/10 · <span className={urge >= 8 ? 'shu' : ''}>{urgeLabel(urge)}</span>
      </label>
      <input id="urge" type="range" min={0} max={10} value={urge} onChange={(e) => setUrge(+e.target.value)} />
      <input
        className="input"
        style={{ marginTop: 12 }}
        placeholder="Anything on your mind? (optional)"
        aria-label="Note"
        spellCheck={false}
        autoComplete="off"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Btn
        variant="primary block"
        style={{ marginTop: 12 }}
        onClick={() => {
          saveCheckIn({ mood, urge, note: note.trim() });
          setEditing(false);
          setJustStamped(true);
          buzz([30, 40, 80]);
          void shake.start({ x: [0, -6, 6, -3, 0], y: [0, 3, 0], transition: { duration: 0.3, delay: 0.12 } });
        }}
      >
        Stamp it
      </Btn>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function Home({ onPanic, onRelapse }: { onPanic: () => void; onRelapse: () => void }) {
  const s = useAppState();
  const now = useNow(1000);
  const ms = streakMs(s, now);
  const days = Math.floor(ms / DAY);
  const rank = rankFor(days);
  const minute = Math.floor(now / 60000);
  const ins = useMemo(() => analyze(s, now), [s, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rankUp, setRankUp] = useState<Rank | null>(null);
  const line = useMemo(() => dailyPick(DAILY_LINES), []);

  // Celebrate tier-ups exactly once per streak.
  useEffect(() => {
    if (rank.days > 0 && !s.milestonesSeen.includes(rank.days)) {
      setState((st) => ({ milestonesSeen: [...st.milestonesSeen, rank.days] }));
      setRankUp(rank);
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 } });
    }
  }, [rank, s.milestonesSeen]);

  const date = new Date(now);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

  // No Nut November, for the culture.
  const nnn = useMemo(() => {
    if (date.getMonth() !== 10 || !s.streakStart) return null;
    const nov1 = new Date(date.getFullYear(), 10, 1).getTime();
    return { day: date.getDate(), undefeated: s.streakStart <= nov1 };
  }, [date.getMonth(), date.getDate(), s.streakStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showAllTiers, setShowAllTiers] = useState(false);

  return (
    <Page>
      <header className="topbar">
        <span className="brand">LockedIn</span>
        <span className="mono small">
          No.{String(days).padStart(4, '0')} · {dateStr} {weekday}
        </span>
      </header>

      <div className="greet">
        <p className="mono small muted">yo, {s.profile?.nickname}</p>
        <h2>{line}</h2>
      </div>

      {ins.dangerNow && (
        <motion.div className="strip red" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="mono small">Danger window</span>
          <span>{ins.dangerNow}</span>
        </motion.div>
      )}

      <div className="grid2">
        <div className="col">
          {/* Emergency button first: it must be reachable the moment the app opens. */}
          <motion.button className="jail" onClick={onPanic} whileTap={{ scale: 0.98 }} aria-label="Horny jail: get help with an urge right now">
            <Stamp text="Bonk" size={52} rotate={-6} />
            <span className="jail-text">
              <b>Send me to horny jail</b>
              <small>Tempted? Tap before you goon.</small>
            </span>
            <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="arrow" aria-hidden="true">
              →
            </motion.span>
          </motion.button>

          <Poster ms={ms} badge={nnn ? `NNN ${nnn.day}/30${nnn.undefeated ? ' · undefeated' : ''}` : undefined} />
        </div>

        <div className="col">
          <CheckInCard />

          <section className="section">
            <Sec no="02" title="Stats" />
            <div className="stat-grid">
              <div className="stat">
                <span>Best streak</span>
                <b>{fmtDuration(Math.max(s.bestStreakMs, ms))}</b>
              </div>
              <div className="stat">
                <span>Total clean</span>
                <b>{fmtDuration(totalCleanMs(s, now))}</b>
              </div>
              <div className="stat">
                <span>Days w/o relapse</span>
                <b>{recoveryRate(s, now)}%</b>
              </div>
              <div className="stat">
                <span>Urges bonked</span>
                <b>{ins.urgesWon}</b>
              </div>
            </div>
          </section>

          <section className="section">
            <Sec no="03" title="The ladder" aside={<span className="mono small muted">Gooner → Gigachad</span>} />
            <TierLadder tier={rank.tier} days={ms / DAY} compact={!showAllTiers} />
            <Btn variant="ghost sm" aria-expanded={showAllTiers} onClick={() => setShowAllTiers(!showAllTiers)}>
              {showAllTiers ? 'Show less ↑' : 'See all 10 tiers ↓'}
            </Btn>
          </section>

          {s.profile?.why && (
            <section className="section">
              <Sec no="04" title="Your why" />
              <p className="why">“{s.profile.why}”</p>
            </section>
          )}

          <button className="slip" onClick={onRelapse}>
            <span>
              <b>Fell off? Log a slip</b>
              <small>Your total progress stays.</small>
            </span>
            <span className="go-dot" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {rankUp && (
          <Overlay>
            <div className="card col center" style={{ alignItems: 'center', padding: 28 }}>
              <span className="badge shu">Tier up</span>
              <motion.div
                className="tierup-num"
                initial={{ scale: 0.2, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 11 }}
              >
                T{rankUp.tier}
              </motion.div>
              <h1>{rankUp.name}</h1>
              <p className="muted">{rankUp.line}</p>
              <div style={{ width: '100%' }}>
                <TierMeter tier={rankUp.tier} />
              </div>
              <Btn variant="primary block" onClick={() => setRankUp(null)}>
                Let's gooo
              </Btn>
            </div>
          </Overlay>
        )}
      </AnimatePresence>
    </Page>
  );
}
