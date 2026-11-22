import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { EMOTIONS, PLACES, pick, RELAPSE_LINES, TRIGGERS, labelOf } from '../lib/memes';
import { analyze } from '../lib/insights';
import { logRelapse, useAppState } from '../lib/store';
import { fmtDuration, recoveryRate, streakMs, totalCleanMs } from '../lib/streak';
import { Bar, Btn, Card, Chips, Stamp } from './ui';

const STEPS = ['breathe', 'when', 'triggers', 'feelings', 'story', 'plan', 'done'] as const;
type Step = (typeof STEPS)[number];

const PLAN_IDEAS = [
  'Phone charges outside my bedroom',
  'Install a blocker on every device',
  'Go for a walk when I feel bored',
  'Text a friend when I feel lonely',
  'No phone in the bathroom',
  'Hit the panic button sooner',
];

function toLocalInput(t: number) {
  const d = new Date(t - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function RelapseFlow({ onClose, onCoach }: { onClose: () => void; onCoach: () => void }) {
  const s = useAppState();
  const [step, setStep] = useState<Step>('breathe');
  const [when, setWhen] = useState<'now' | 'earlier'>('now');
  const [at, setAt] = useState(toLocalInput(Date.now()));
  const [triggers, setTriggers] = useState<string[]>([]);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [place, setPlace] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(3);
  const [story, setStory] = useState('');
  const [plan, setPlan] = useState('');
  const line = useMemo(() => pick(RELAPSE_LINES), []);
  const lostStreak = streakMs(s);
  const idx = STEPS.indexOf(step);
  const next = () => setStep(STEPS[idx + 1]);

  const submit = () => {
    const t = when === 'now' ? Date.now() : Math.min(Date.now(), new Date(at).getTime() || Date.now());
    logRelapse({ at: t, triggers, emotions, place: place[0] ?? '', story: story.trim(), plan: plan.trim(), intensity });
    next();
  };

  const ins = analyze(s);
  const repeatTrigger = triggers.find((t) => ins.triggers.slice(0, 3).some(([x]) => x === t));

  return (
    <div className="narrow col" style={{ gap: 16 }}>
      <div className="spread">
        <span className="small muted">{step !== 'done' ? `Step ${idx + 1} of ${STEPS.length - 1}` : 'Respawned'}</span>
        {step !== 'done' && (
          <Btn variant="ghost sm" onClick={onClose}>
            ✕ Cancel
          </Btn>
        )}
      </div>
      {step !== 'done' && <Bar value={((idx + 1) / (STEPS.length - 1)) * 100} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="col"
          style={{ gap: 14 }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
        >
          {step === 'breathe' && (
            <Card className="col">
              <p className="lbl">Fall seven times, stand up eight</p>
              <h2>{line}</h2>
              <p className="muted">
                Shame makes the next relapse more likely, not less. So no shame here. We're going to figure out what
                happened, so next time you see it coming.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <div className="stat">
                  <b>{fmtDuration(lostStreak)}</b>
                  <span>Streak that ended</span>
                </div>
                <div className="stat">
                  <b>{fmtDuration(totalCleanMs(s))}</b>
                  <span>Total clean (kept!)</span>
                </div>
              </div>
              <Btn variant="primary block" onClick={next}>
                Okay, let's break it down
              </Btn>
            </Card>
          )}

          {step === 'when' && (
            <>
              <h2>When did it happen?</h2>
              <button className={`option ${when === 'now' ? 'on' : ''}`} onClick={() => setWhen('now')}>
                <span className="emo">⏱️</span>Just now
              </button>
              <button className={`option ${when === 'earlier' ? 'on' : ''}`} onClick={() => setWhen('earlier')}>
                <span className="emo">📅</span>Earlier
              </button>
              {when === 'earlier' && (
                <input
                  className="input"
                  type="datetime-local"
                  value={at}
                  max={toLocalInput(Date.now())}
                  onChange={(e) => setAt(e.target.value)}
                />
              )}
              <label className="lbl" style={{ marginTop: 6 }}>
                How strong was the urge? {['', '🙂 mild', '😐 medium', '😬 strong', '😵 very strong', '🌋 overwhelming'][intensity]}
              </label>
              <input type="range" min={1} max={5} value={intensity} onChange={(e) => setIntensity(+e.target.value)} />
              <Btn variant="primary block" onClick={next}>
                Next →
              </Btn>
            </>
          )}

          {step === 'triggers' && (
            <>
              <h2>What set it off?</h2>
              <p className="muted small">Pick everything that was going on. This is how we find your patterns.</p>
              <Chips items={TRIGGERS} value={triggers} onChange={setTriggers} />
              <label className="lbl" style={{ marginTop: 8 }}>
                Where were you?
              </label>
              <Chips items={PLACES.map((p) => ({ id: p, label: p }))} value={place} onChange={setPlace} multi={false} />
              <Btn variant="primary block" onClick={next} disabled={triggers.length === 0}>
                Next →
              </Btn>
            </>
          )}

          {step === 'feelings' && (
            <>
              <h2>How were you feeling right before?</h2>
              <Chips items={EMOTIONS} value={emotions} onChange={setEmotions} />
              <Btn variant="primary block" onClick={next} disabled={emotions.length === 0}>
                Next →
              </Btn>
            </>
          )}

          {step === 'story' && (
            <>
              <h2>Walk through how it happened</h2>
              <p className="muted small">
                Relapses are a chain, not a single moment: situation → thought → feeling → action. What was the first
                link? ("I was in bed scrolling Reels, saw a post, thought 'just a quick look'…")
              </p>
              <textarea
                className="input"
                rows={5}
                spellCheck={false}
                maxLength={4000}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Be honest. Only you will read this."
              />
              <Btn variant="primary block" onClick={next}>
                {story.trim() ? 'Next →' : 'Skip →'}
              </Btn>
            </>
          )}

          {step === 'plan' && (
            <>
              <h2>What will you do differently next time?</h2>
              {repeatTrigger && (
                <div className="banner">
                  🔁 {labelOf(TRIGGERS, repeatTrigger)} is one of your repeat triggers. Your plan should target it
                  directly.
                </div>
              )}
              <div className="chips">
                {PLAN_IDEAS.map((p) => (
                  <button key={p} className={`chip ${plan === p ? 'on' : ''}`} onClick={() => setPlan(p)}>
                    {p}
                  </button>
                ))}
              </div>
              <textarea
                className="input"
                rows={3}
                spellCheck={false}
                maxLength={1000}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder='Try an if-then: "If I am in bed with my phone after 11pm, then I will put it across the room."'
              />
              <Btn variant="danger block" onClick={submit} disabled={!plan.trim()}>
                Reset streak & respawn
              </Btn>
            </>
          )}

          {step === 'done' && (
            <Card className="center col" style={{ alignItems: 'center' }}>
              <Stamp text="Back" size={110} stamp />
              <h1>We're so back.</h1>
              <p className="mono small">New streak started. Respawned with more XP.</p>
              <p className="muted">
                Your recovery rate is <b>{recoveryRate(s)}%</b>. Your plan: <i>"{plan}"</i>. You've got this.
              </p>
              <Btn variant="primary block" onClick={onCoach}>
                Talk it through with the coach
              </Btn>
              <Btn variant="block" onClick={onClose}>
                Back to home
              </Btn>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
