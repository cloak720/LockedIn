import { motion } from 'framer-motion';
import { Fragment, useState } from 'react';
import { LEVELS } from '../lib/assessment';
import { analyze, BLOCKS, WEEKDAYS } from '../lib/insights';
import { EMOTIONS, labelOf, TRIGGERS } from '../lib/memes';
import { useAppState } from '../lib/store';
import { DAY, fmtDuration, streakMs } from '../lib/streak';
import { Bar, Card, Page, Sec } from './ui';

function StreakHistory() {
  const s = useAppState();
  const items = [...s.relapses.map((r) => ({ ms: r.streakMs, cur: false })), { ms: streakMs(s), cur: true }].slice(-14);
  const max = Math.max(DAY, ...items.map((i) => i.ms));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '8px 0' }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span className="dim" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
            {(it.ms / DAY).toFixed(it.ms < DAY * 10 ? 1 : 0)}d
          </span>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, (it.ms / max) * 100)}px` }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 120, damping: 16 }}
            style={{
              width: '100%',
              background: it.cur ? 'var(--shu)' : 'var(--ink)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const s = useAppState();
  const ins = analyze(s);
  const [open, setOpen] = useState<string | null>(null);
  const maxT = ins.triggers[0]?.[1] ?? 1;
  const maxE = ins.emotions[0]?.[1] ?? 1;

  return (
    <Page>
      <div>
        <h1>Pattern radar</h1>
        <p className="muted">Know your enemy. The more honestly you log, the smarter this gets.</p>
      </div>

      {ins.relapseCount === 0 && (
        <Card className="center col">
          <div style={{ alignSelf: 'center' }}>
            <span className="badge shu" style={{ alignSelf: 'center' }}>No data yet</span>
          </div>
          <h3>No relapse data yet</h3>
          <p className="muted small">
            Clean record so far. 🔥 If you ever slip, log it with "I slipped up" and this page will show your danger
            hours, top triggers and whether your streaks are getting longer.
          </p>
        </Card>
      )}

      <div className="grid2">
        <div className="col" style={{ gap: 16 }}>
          <Card>
            <Sec no="01" title="Streak history" />
            <StreakHistory />
            <p className="small muted">
              {ins.trend === 'up' && '📈 Your streaks are getting longer. That is what recovery actually looks like.'}
              {ins.trend === 'down' && '📉 Streaks have been shorter lately. Check your triggers below and tighten your plan.'}
              {ins.trend === 'flat' && '➡️ Streaks are steady. Try one new defence against your #1 trigger to break through.'}
              {ins.trend === 'none' && 'Your current streak is the highlighted bar. Trends appear after a few streaks.'}
            </p>
            {ins.relapseCount > 0 && (
              <p className="small dim" style={{ marginTop: 6 }}>
                Average streak: {ins.avgStreakDays.toFixed(1)} days · {ins.relapseCount} relapse{ins.relapseCount > 1 ? 's' : ''} logged
              </p>
            )}
          </Card>

          {ins.relapseCount > 0 && (
            <Card>
              <Sec no="02" title="Danger hours" />
              <div className="heat">
                <span />
                {BLOCKS.map((b) => (
                  <span key={b} className="lab">
                    {b.slice(0, 2)}h
                  </span>
                ))}
                {WEEKDAYS.map((d, wi) => (
                  <Fragment key={d}>
                    <span className="lab">
                      {d}
                    </span>
                    {ins.grid[wi].map((v, bi) => (
                      <motion.span
                        key={`${wi}-${bi}`}
                        className="cell"
                        title={`${d} ${BLOCKS[bi]}: ${v}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (wi * 6 + bi) * 0.008 }}
                        style={
                          v
                            ? { background: 'var(--shu)', opacity: 0.3 + (v / Math.max(1, ins.maxCell)) * 0.7 }
                            : undefined
                        }
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
              {ins.worstBlock !== null && ins.worstDay !== null && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Most dangerous time: <b>{BLOCKS[ins.worstBlock]}h</b>. Toughest day: <b>{WEEKDAYS[ins.worstDay]}</b>. Plan
                  something for those slots in advance.
                </p>
              )}
            </Card>
          )}

          <Card>
            <Sec no="03" title="Urge battles" />
            <div className="row" style={{ gap: 8 }}>
              <div className="stat">
                <b style={{ color: 'var(--mint)' }}>{ins.urgesWon}</b>
                <span>Won</span>
              </div>
              <div className="stat">
                <b style={{ color: 'var(--red)' }}>{ins.urgesLost}</b>
                <span>Lost</span>
              </div>
              <div className="stat">
                <b>{ins.urgesWon + ins.urgesLost ? Math.round((ins.urgesWon / (ins.urgesWon + ins.urgesLost)) * 100) : 0}%</b>
                <span>Win rate</span>
              </div>
            </div>
            {(ins.avgMood7 !== null || ins.avgUrge7 !== null) && (
              <p className="small muted" style={{ marginTop: 10 }}>
                Last 7 days: average mood {ins.avgMood7?.toFixed(1) ?? '-'}/5, average urges {ins.avgUrge7?.toFixed(1) ?? '-'}/10
              </p>
            )}
          </Card>
        </div>

        <div className="col" style={{ gap: 16 }}>
          {ins.triggers.length > 0 && (
            <Card>
              <Sec no="04" title="Top triggers" />
              <div className="col" style={{ gap: 10 }}>
                {ins.triggers.slice(0, 6).map(([t, n]) => (
                  <div key={t}>
                    <div className="spread small" style={{ marginBottom: 4 }}>
                      <span>{labelOf(TRIGGERS, t)}</span>
                      <span className="muted">{n}×</span>
                    </div>
                    <Bar value={(n / maxT) * 100} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {ins.emotions.length > 0 && (
            <Card>
              <Sec no="05" title="Feelings before relapse" />
              <div className="col" style={{ gap: 10 }}>
                {ins.emotions.slice(0, 5).map(([t, n]) => (
                  <div key={t}>
                    <div className="spread small" style={{ marginBottom: 4 }}>
                      <span>{labelOf(EMOTIONS, t)}</span>
                      <span className="muted">{n}×</span>
                    </div>
                    <Bar value={(n / maxE) * 100} color="var(--shu)" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {s.assessments.length > 0 && (
            <Card>
              <Sec no="06" title="Assessment history" />
              <div className="col" style={{ gap: 8 }}>
                {[...s.assessments].reverse().map((a) => (
                  <div key={a.at} className="list-item spread small">
                    <span>{new Date(a.at).toLocaleDateString()}</span>
                    <span>
                      {LEVELS[a.level].emoji} <b style={{ color: LEVELS[a.level].color }}>{a.score}</b>/100 {LEVELS[a.level].name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="small dim" style={{ marginTop: 8 }}>
                Retake it every few weeks in Settings to see your score drop.
              </p>
            </Card>
          )}

          {s.relapses.length > 0 && (
            <Card>
              <Sec no="07" title="Relapse log" />
              <div className="col" style={{ gap: 8 }}>
                {[...s.relapses].reverse().map((r) => (
                  <button
                    key={r.id}
                    className="log-row"
                    aria-expanded={open === r.id}
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    <div className="spread small">
                      <b>{new Date(r.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</b>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="muted">after {fmtDuration(r.streakMs)}</span>
                        <span className="go-dot" style={{ width: 26, height: 26, fontSize: 14 }} aria-hidden="true">
                          {open === r.id ? '−' : '+'}
                        </span>
                      </span>
                    </div>
                    <p className="small muted">{r.triggers.map((t) => labelOf(TRIGGERS, t)).join(' · ')}</p>
                    {open === r.id && (
                      <div className="small" style={{ marginTop: 8 }}>
                        {r.place && <p>📍 {r.place}</p>}
                        {r.story && <p style={{ marginTop: 4 }}>🎞️ {r.story}</p>}
                        {r.plan && <p style={{ marginTop: 4, color: 'var(--mint)' }}>🛡️ {r.plan}</p>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
