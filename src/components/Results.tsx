import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { DIM_INFO, LEVELS, type AssessmentResult, type DimKey } from '../lib/assessment';
import { Bar, Btn, Card, Sec } from './ui';
import CrisisCard from './CrisisCard';

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

/** Where your score lands on the Gigachad ⟷ Gooner spectrum. */
function CategoryScale({ score }: { score: number }) {
  const bands = (['low', 'moderate', 'high', 'severe'] as const).map((k) => LEVELS[k]);
  return (
    <div className="cat-scale" aria-label={`Score ${score} of 100`}>
      <div className="cat-bands">
        {bands.map((b, i) => (
          <div key={b.name} className={`band b${i}`}>
            <span>{b.name}</span>
          </div>
        ))}
        <motion.i
          className="cat-marker"
          initial={{ left: '0%' }}
          animate={{ left: `${Math.min(99, Math.max(1, score))}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.3 }}
        />
      </div>
      <div className="cat-ends mono small">
        <span>← Gigachad</span>
        <span>Gooner →</span>
      </div>
    </div>
  );
}

export default function Results({
  result,
  previous,
  onContinue,
  cta = "Let's lock in",
}: {
  result: AssessmentResult;
  previous?: AssessmentResult;
  onContinue: () => void;
  cta?: string;
}) {
  const lvl = LEVELS[result.level];
  const delta = previous ? result.score - previous.score : null;

  return (
    <div className="narrow col" style={{ gap: 16 }}>
      {result.safety > 0 && <CrisisCard />}

      <Card className="center">
        <p className="lbl">Your crisis score</p>
        <motion.div
          initial={{ scale: 0.4, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
          style={{ fontFamily: 'var(--f-display)', fontSize: 96, color: lvl.color, lineHeight: 1 }}
        >
          <CountUp to={result.score} />
          <span style={{ fontSize: 28, color: 'var(--dim)' }}>/100</span>
        </motion.div>
        <p className="lbl" style={{ marginTop: 10 }}>Category · {lvl.tag}</p>
        <h1 style={{ color: lvl.color }}>{lvl.name}</h1>
        <CategoryScale score={result.score} />
        <p className="muted" style={{ marginTop: 8 }}>
          {lvl.summary}
        </p>
        {delta !== null && (
          <p className="small" style={{ marginTop: 10, color: delta <= 0 ? 'var(--mint)' : 'var(--orange)' }}>
            {delta <= 0 ? `${Math.abs(delta)} points lower than last time. That's growth.` : `${delta} points higher than last time. Let's look at why.`}
          </p>
        )}
      </Card>

      <Card delay={0.1}>
        <Sec no="01" title="Where it hits hardest" />
        <div className="col" style={{ gap: 12 }}>
          {(Object.keys(DIM_INFO) as DimKey[])
            .sort((a, b) => result.dims[b] - result.dims[a])
            .map((k) => (
              <div key={k}>
                <div className="spread small" style={{ marginBottom: 4 }}>
                  <span>
                    <span className="mono shu">{DIM_INFO[k].emoji}</span> {DIM_INFO[k].label}
                  </span>
                  <span className="muted">{result.dims[k]}%</span>
                </div>
                <Bar
                  value={result.dims[k]}
                  color={result.dims[k] >= 75 ? 'var(--red)' : result.dims[k] >= 50 ? 'var(--orange)' : undefined}
                />
              </div>
            ))}
        </div>
      </Card>

      <Card delay={0.2}>
        <Sec no="02" title="Honesty check" aside={<span className="badge">{result.consistency}% consistent</span>} />
        {result.flags.length === 0 ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            Your answers lined up with each other. Respect. That honesty is the first real step.
          </p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            <p className="muted small">
              We asked a few things twice from different angles. Some answers didn't match. That's super common: the brain
              protects its habits. We trusted your <b>behaviour</b> answers over your self-image answers.
            </p>
            {result.flags.map((f) => (
              <div key={f} className="list-item small">
                {f}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card delay={0.3}>
        <Sec no="03" title="Your game plan" />
        <div className="col" style={{ gap: 10 }}>
          <div className="list-item small">
            <b>Goal:</b> {lvl.goalDays}-day reboot, from wherever you are to Gigachad
          </div>
          {result.topDims.map((d) => (
            <div key={d} className="list-item small">
              <b>{DIM_INFO[d].label}:</b> {DIM_INFO[d].tip}
            </div>
          ))}
        </div>
      </Card>

      <p className="dim small center">
        This is a self-reflection tool, not a medical diagnosis. If this is seriously affecting your life, talking to a
        professional is a power move, not a weakness.
      </p>

      <Btn variant="primary big block" onClick={onContinue}>
        {cta}
      </Btn>
    </div>
  );
}
