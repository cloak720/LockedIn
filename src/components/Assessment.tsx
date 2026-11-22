import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { QUESTIONS, scoreAssessment, type AssessmentResult } from '../lib/assessment';
import { buzz } from '../lib/store';
import { Bar, Btn } from './ui';

const REACTIONS = ['noted 📝', 'real 💯', 'respect for the honesty 🫡', 'we move 🚶', 'say less 🤐', 'valid 👌'];

export default function Assessment({ onDone, onCancel }: { onDone: (r: AssessmentResult) => void; onCancel?: () => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [reaction, setReaction] = useState<string | null>(null);
  const started = useRef(Date.now());
  const q = QUESTIONS[i];

  const choose = (v: number) => {
    buzz(12);
    const next = { ...answers, [q.id]: v };
    setAnswers(next);
    if (Math.random() < 0.3) setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    setTimeout(() => {
      setReaction(null);
      if (i < QUESTIONS.length - 1) setI(i + 1);
      else {
        const msPer = (Date.now() - started.current) / QUESTIONS.length;
        onDone(scoreAssessment(next, msPer));
      }
    }, 280);
  };

  return (
    <div className="narrow col" style={{ gap: 18 }}>
      <div className="spread">
        <Btn variant="ghost sm" onClick={() => (i > 0 ? setI(i - 1) : onCancel?.())} disabled={i === 0 && !onCancel}>
          ← Back
        </Btn>
        <span className="small muted">
          {i + 1} / {QUESTIONS.length}
        </span>
      </div>
      <Bar value={((i + 1) / QUESTIONS.length) * 100} />

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          className="col"
          style={{ gap: 14 }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <h2>{q.text}</h2>
          {q.hint && <p className="muted small">{q.hint}</p>}
          <div className="col" style={{ gap: 10, marginTop: 6 }}>
            {q.options.map((o, idx) => (
              <motion.button
                key={o.label}
                className={`option ${answers[q.id] === o.value ? 'on' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ x: 4 }}
                onClick={() => choose(o.value)}
              >
                <span className="emo">{o.emoji}</span>
                <span>{o.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div style={{ height: 24 }} className="center">
        <AnimatePresence>
          {reaction && (
            <motion.span
              className="badge"
              initial={{ opacity: 0, scale: 0.6, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {reaction}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="center dim small">🔒 Your answers never leave this device.</p>
    </div>
  );
}
