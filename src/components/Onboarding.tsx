import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { LEVELS, type AssessmentResult } from '../lib/assessment';
import { setState } from '../lib/store';
import Assessment from './Assessment';
import Results from './Results';
import { Btn, Card, Page } from './ui';

type Step = 'welcome' | 'name' | 'quiz' | 'results' | 'start';

const FEATURES = [
  ['Private', 'No account, no cloud, optional encryption. Your business stays yours.'],
  ['Honest test', 'Cross-checked questions that catch your brain lying to you.'],
  ['Gooner → Gigachad', 'Ten tiers. Every clean day climbs the ladder.'],
  ['Horny jail', 'Breathing, urge surfing, and a game where you bonk the urge.'],
  ['Pattern radar + AI coach', 'Learns your danger hours. Free AI that knows your triggers.'],
];

function toLocalInput(t: number) {
  const d = new Date(t - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [nickname, setNickname] = useState('');
  const [why, setWhy] = useState('');
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [startMode, setStartMode] = useState<'now' | 'past'>('now');
  const [past, setPast] = useState(toLocalInput(Date.now() - 86_400_000));

  const finish = () => {
    if (!result) return;
    const now = Date.now();
    const pastT = new Date(past).getTime();
    const start = startMode === 'past' && pastT < now ? pastT : now;
    setState({
      profile: { nickname: nickname.trim() || 'Legend', why: why.trim(), goalDays: LEVELS[result.level].goalDays, createdAt: now },
      assessments: [result],
      journeyStart: start,
      streakStart: start,
      bestStreakMs: 0,
      milestonesSeen: [],
    });
  };

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <Page key="w" className="narrow">
            <div className="spread meta small">
              <span>Vol.01 · Anti-brainrot program</span>
              <span>Free forever</span>
            </div>
            <div className="hero">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                style={{ position: 'absolute', top: 0, left: 0, width: '58%', aspectRatio: '1', borderRadius: '50%', background: 'var(--shu)' }}
              />
              <div className="hero-tag">
                <span>From</span>
                <b>Gooner</b>
                <span>to</span>
                <b className="shu">Gigachad</b>
              </div>
              <motion.h1
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ position: 'absolute', left: 0, bottom: 0, fontSize: '27cqw', lineHeight: 0.85 }}
              >
                Locked
                <br />
                In.
              </motion.h1>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700 }}>
              The free, private, slightly unhinged app that helps you quit porn for real. No cap. No account. No goon.
            </p>
            <div className="plist">
              {FEATURES.map(([t, d], idx) => (
                <motion.div key={t} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + idx * 0.07 }} style={{ cursor: 'default' }}>
                  <span className="n">0{idx + 1}</span>
                  <span className="txt">
                    <b>{t}</b>
                    <span className="small muted">{d}</span>
                  </span>
                  <span />
                </motion.div>
              ))}
            </div>
            <Btn variant="primary big block" onClick={() => setStep('name')}>
              Lock in →
            </Btn>
            <p className="center dim small mono">Open source · one tiny ad a day · that's it</p>
          </Page>
        )}

        {step === 'name' && (
          <Page key="n" className="narrow">
            <p className="lbl">Step 01 / 03</p>
            <h2>First, what should we call you?</h2>
            <input
              className="input"
              placeholder="Nickname (no real name needed)"
              spellCheck={false}
              autoComplete="off"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
            <h2 style={{ marginTop: 10 }}>Why do you want to quit?</h2>
            <p className="muted small">We'll show you this when an urge hits. Make it hit hard.</p>
            <textarea
              className="input"
              rows={3}
              spellCheck={false}
              placeholder="e.g. I want my energy, confidence and focus back. I want real relationships."
              value={why}
              maxLength={300}
              onChange={(e) => setWhy(e.target.value)}
            />
            <Card className="tight">
              <p className="small muted">
                Next: <b>21 quick questions</b> about your habits. Be brutally honest. Nobody sees this but you, and the
                quiz checks itself for contradictions.
              </p>
            </Card>
            <Btn variant="primary big block" onClick={() => setStep('quiz')}>
              Start the assessment →
            </Btn>
          </Page>
        )}

        {step === 'quiz' && (
          <Page key="q">
            <Assessment
              onCancel={() => setStep('name')}
              onDone={(r) => {
                setResult(r);
                setStep('results');
              }}
            />
          </Page>
        )}

        {step === 'results' && result && (
          <Page key="r">
            <Results result={result} onContinue={() => setStep('start')} cta="Continue →" />
          </Page>
        )}

        {step === 'start' && result && (
          <Page key="s" className="narrow">
            <p className="lbl">Step 03 / 03</p>
            <h2>When does your streak start?</h2>
            <p className="muted small">Already clean for a few days? Don't lose that progress.</p>
            <div className="col" style={{ gap: 10 }}>
              <button className={`option ${startMode === 'now' ? 'on' : ''}`} onClick={() => setStartMode('now')}>
                <span>Starting right now</span>
              </button>
              <button className={`option ${startMode === 'past' ? 'on' : ''}`} onClick={() => setStartMode('past')}>
                <span>I've already been clean since…</span>
              </button>
              {startMode === 'past' && (
                <input
                  className="input"
                  type="datetime-local"
                  value={past}
                  max={toLocalInput(Date.now())}
                  onChange={(e) => setPast(e.target.value)}
                />
              )}
            </div>
            <Btn variant="primary big block" onClick={finish}>
              Lock in
            </Btn>
          </Page>
        )}
      </AnimatePresence>
    </div>
  );
}
