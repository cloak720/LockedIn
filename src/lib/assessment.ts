/*
 * LockedIn self-assessment.
 *
 * Original questions loosely modelled on the "components model" of behavioural
 * addiction (salience, mood modification, tolerance, withdrawal, conflict, relapse)
 * plus factual behaviour questions. It is a self-reflection tool, NOT a diagnosis.
 *
 * What makes it different from most apps' "quiz":
 *  1. Cross-check items — the same thing is asked twice from opposite angles. When
 *     the answers contradict each other we flag it and trust the behaviour answers
 *     over the self-image answers (minimising is itself a classic sign).
 *  2. Speed check — answering faster than you can read lowers the reliability score.
 *  3. A separate safety screen that is never scored but routes to real help.
 */

export type DimKey = 'frequency' | 'control' | 'salience' | 'escape' | 'tolerance' | 'withdrawal' | 'impact';
export type LevelKey = 'low' | 'moderate' | 'high' | 'severe';

export interface Option {
  label: string;
  value: number;
  emoji?: string;
}

export interface Question {
  id: string;
  text: string;
  hint?: string;
  dim: DimKey | 'cross' | 'safety';
  options: Option[];
  /** for cross-check items: which dims this reverse-claim is checked against */
  checks?: DimKey[];
  checkLabel?: string;
}

const LIKERT: Option[] = [
  { label: 'Never', value: 0, emoji: '😇' },
  { label: 'Rarely', value: 1, emoji: '🙂' },
  { label: 'Sometimes', value: 2, emoji: '😐' },
  { label: 'Often', value: 3, emoji: '😬' },
  { label: 'Almost always', value: 4, emoji: '💀' },
];

const AGREE: Option[] = [
  { label: 'Totally false', value: 0, emoji: '🙅' },
  { label: 'Mostly false', value: 1, emoji: '🤏' },
  { label: 'Kinda', value: 2, emoji: '🤷' },
  { label: 'Mostly true', value: 3, emoji: '👍' },
  { label: '100% true', value: 4, emoji: '💯' },
];

export const QUESTIONS: Question[] = [
  {
    id: 'f_freq',
    dim: 'frequency',
    text: 'How often do you watch porn and/or fap?',
    options: [
      { label: 'Less than once a week', value: 0, emoji: '🐢' },
      { label: '1–2 times a week', value: 1, emoji: '🚶' },
      { label: '3–5 times a week', value: 2, emoji: '🏃' },
      { label: 'Every day', value: 3, emoji: '🚗' },
      { label: 'Multiple times a day', value: 4, emoji: '🚀' },
    ],
  },
  {
    id: 'f_len',
    dim: 'frequency',
    text: 'How long does a typical session last (including scrolling/searching)?',
    options: [
      { label: 'Under 10 min', value: 0, emoji: '⏱️' },
      { label: '10–30 min', value: 1, emoji: '🕐' },
      { label: '30–60 min', value: 2, emoji: '🕑' },
      { label: '1–2 hours', value: 3, emoji: '🕒' },
      { label: '2+ hours', value: 4, emoji: '🫠' },
    ],
  },
  {
    id: 'f_long',
    dim: 'control',
    text: "What's the longest you've gone without it in the past year?",
    options: [
      { label: '3+ months', value: 0, emoji: '🏔️' },
      { label: '1–3 months', value: 1, emoji: '⛰️' },
      { label: '2–4 weeks', value: 2, emoji: '🏕️' },
      { label: '1–2 weeks', value: 3, emoji: '⛺' },
      { label: 'Less than a week', value: 4, emoji: '🕳️' },
    ],
  },
  { id: 'c_more', dim: 'control', text: 'I end up watching longer or more often than I planned.', options: LIKERT },
  { id: 'c_relapse', dim: 'control', text: "I've tried to quit or cut down and ended up going back.", options: LIKERT },
  { id: 's_think', dim: 'salience', text: 'I think about porn or fapping even when I am not doing it.', options: LIKERT },
  {
    id: 'cc_control',
    dim: 'cross',
    checks: ['control'],
    checkLabel: 'You said you can stop anytime, but your other answers show it keeps pulling you back.',
    text: 'Honestly, I could stop any time I wanted to.',
    options: AGREE,
  },
  {
    id: 'e_escape',
    dim: 'escape',
    text: 'I use it to escape stress, boredom, loneliness or sadness.',
    options: LIKERT,
  },
  {
    id: 'e_sleep',
    dim: 'escape',
    text: 'I use it to fall asleep or to "reset" after a bad day.',
    options: LIKERT,
  },
  {
    id: 't_extreme',
    dim: 'tolerance',
    text: 'I have needed more extreme, novel or specific content to feel the same thing.',
    hint: 'Escalation is one of the most common patterns. No judgement here.',
    options: LIKERT,
  },
  { id: 't_more', dim: 'tolerance', text: 'My sessions have been getting longer or more frequent over time.', options: LIKERT },
  {
    id: 'cc_time',
    dim: 'cross',
    checks: ['frequency'],
    checkLabel: 'You said it takes very little of your time, but your frequency/session answers say otherwise.',
    text: 'It barely takes up any of my time.',
    options: AGREE,
  },
  {
    id: 'w_restless',
    dim: 'withdrawal',
    text: "I feel restless, irritable or anxious when I can't watch.",
    options: LIKERT,
  },
  { id: 's_secret', dim: 'salience', text: 'I hide it or lie about it to people close to me.', options: LIKERT },
  {
    id: 'i_life',
    dim: 'impact',
    text: 'It has hurt my sleep, studies, work, gym or relationships.',
    options: LIKERT,
  },
  {
    id: 'i_body',
    dim: 'impact',
    text: 'I notice brain fog, low motivation, or changes in real-life attraction/arousal.',
    options: LIKERT,
  },
  { id: 'i_shame', dim: 'impact', text: 'I feel guilty, empty or ashamed afterwards.', options: LIKERT },
  {
    id: 'c_risky',
    dim: 'control',
    text: "I've watched at risky times or places (school, work, in public, when I should be sleeping).",
    options: LIKERT,
  },
  {
    id: 'cc_impact',
    dim: 'cross',
    checks: ['impact'],
    checkLabel: "You said it doesn't affect your life, but you also reported real costs to sleep, energy or mood.",
    text: "Porn doesn't really affect my life.",
    options: AGREE,
  },
  {
    id: 'w_mood',
    dim: 'withdrawal',
    text: 'When I try to stop, my mood crashes or the cravings get really intense.',
    options: LIKERT,
  },
  {
    id: 'safety',
    dim: 'safety',
    text: 'Last one, and it matters: lately, have you had thoughts of hurting yourself or that life is not worth living?',
    hint: 'This is never scored. It only decides whether we show you support options.',
    options: [
      { label: 'No', value: 0, emoji: '🙂' },
      { label: 'Sometimes', value: 1, emoji: '😔' },
      { label: 'Yes', value: 2, emoji: '🫂' },
    ],
  },
];

export const DIM_INFO: Record<DimKey, { label: string; emoji: string; weight: number; tip: string }> = {
  frequency: {
    label: 'Frequency',
    emoji: '01',
    weight: 0.18,
    tip: 'Cut access first: phone out of the bedroom at night and a content blocker on every device. Fewer chances = fewer decisions.',
  },
  control: {
    label: 'Loss of control',
    emoji: '02',
    weight: 0.2,
    tip: 'Willpower alone keeps failing because it is a finite battery. Make a plan for your top trigger in advance: "If X, then I will Y."',
  },
  salience: {
    label: 'Brain space',
    emoji: '03',
    weight: 0.12,
    tip: 'Fill the empty slots: the habit lives in idle time. Schedule your evenings, even with tiny things.',
  },
  escape: {
    label: 'Escape habit',
    emoji: '04',
    weight: 0.12,
    tip: 'It is your stress valve. Build 2 new valves: a 10-min walk and messaging someone. Use them before urges, not during.',
  },
  tolerance: {
    label: 'Escalation',
    emoji: '05',
    weight: 0.14,
    tip: 'Escalation means your reward system is overstimulated. A reboot of 60–90 days lets it recalibrate. Expect a flatline; it passes.',
  },
  withdrawal: {
    label: 'Withdrawal',
    emoji: '06',
    weight: 0.1,
    tip: 'Urges peak and fall within ~15–20 minutes. Use the Panic button and ride the wave instead of fighting it.',
  },
  impact: {
    label: 'Life impact',
    emoji: '07',
    weight: 0.14,
    tip: 'Write down what it is costing you and read it during urges. Your "why" is stronger than any rule.',
  },
};

export const LEVELS: Record<
  LevelKey,
  { name: string; tag: string; emoji: string; color: string; summary: string; goalDays: number }
> = {
  // Categories run from Gigachad-adjacent (low risk) down to Gooner Final Boss (severe).
  low: {
    name: 'Chad-Adjacent',
    tag: 'Low risk',
    emoji: '😎',
    color: 'var(--mint)',
    summary:
      "It's a habit, but it hasn't taken the wheel. Perfect time to lock in before it grows. A 30-day challenge will tell you a lot.",
    goalDays: 30,
  },
  moderate: {
    name: 'Part-Time Gooner',
    tag: 'Moderate',
    emoji: '🤨',
    color: 'var(--yellow)',
    summary:
      'There are clear signs of a compulsive loop forming. Not doomed, not fine. Structure + tracking triggers will move the needle fast.',
    goalDays: 60,
  },
  high: {
    name: 'Certified Gooner',
    tag: 'High',
    emoji: '😵‍💫',
    color: 'var(--orange)',
    summary:
      "This is affecting your control and your life. That's real, and it's also very fixable. Aim for a 90-day reboot and don't do it alone.",
    goalDays: 90,
  },
  severe: {
    name: 'Gooner Final Boss',
    tag: 'Severe',
    emoji: '💀',
    color: 'var(--red)',
    summary:
      'This looks like a serious compulsion. You absolutely can beat it, but bring backup: a therapist or support group alongside this app massively improves the odds.',
    goalDays: 90,
  },
};

export interface AssessmentResult {
  at: number;
  answers: Record<string, number>;
  score: number; // 0..100 crisis score
  level: LevelKey;
  dims: Record<DimKey, number>; // 0..100 each
  consistency: number; // 0..100 reliability of answers
  flags: string[];
  safety: number; // 0 none, 1 sometimes, 2 yes
  topDims: DimKey[];
}

export function levelFor(score: number): LevelKey {
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'high';
  return 'severe';
}

export function scoreAssessment(answers: Record<string, number>, msPerQuestion: number): AssessmentResult {
  const dimVals: Record<DimKey, number[]> = {
    frequency: [],
    control: [],
    salience: [],
    escape: [],
    tolerance: [],
    withdrawal: [],
    impact: [],
  };

  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (v === undefined) continue;
    if (q.dim !== 'cross' && q.dim !== 'safety') dimVals[q.dim].push(v);
  }

  const dims = {} as Record<DimKey, number>;
  (Object.keys(dimVals) as DimKey[]).forEach((k) => {
    const arr = dimVals[k];
    dims[k] = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length / 4) * 100) : 0;
  });

  // --- Cross-check contradictions -------------------------------------------
  const flags: string[] = [];
  let mismatchTotal = 0;
  let checks = 0;
  for (const q of QUESTIONS.filter((x) => x.dim === 'cross')) {
    const v = answers[q.id];
    if (v === undefined || !q.checks) continue;
    const implied = 4 - v; // "I could stop anytime: 100% true" implies control-problems ~ 0
    const actual = q.checks.reduce((a, d) => a + (dims[d] / 100) * 4, 0) / q.checks.length;
    const diff = Math.abs(implied - actual);
    mismatchTotal += diff;
    checks++;
    // Only flag when the claim is rosier than the behaviour (minimising).
    if (actual - implied >= 1.75 && q.checkLabel) flags.push(q.checkLabel);
  }
  let consistency = checks ? Math.round(100 - (mismatchTotal / checks / 4) * 100) : 100;

  // --- Speed check ----------------------------------------------------------
  if (msPerQuestion > 0 && msPerQuestion < 1500) {
    consistency = Math.max(0, consistency - 25);
    flags.push('You speedran this quiz. Any% honesty? Answers given in under 1.5s each are less reliable.');
  }

  // --- Weighted crisis score --------------------------------------------------
  let score = (Object.keys(DIM_INFO) as DimKey[]).reduce((acc, k) => acc + dims[k] * DIM_INFO[k].weight, 0);

  // Minimising is a sign in itself: nudge the score up a little when answers contradict.
  const minimising = flags.filter((f) => !f.startsWith('You speedran')).length;
  score += minimising * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const topDims = (Object.keys(dims) as DimKey[]).sort((a, b) => dims[b] - dims[a]).slice(0, 3);

  return {
    at: Date.now(),
    answers,
    score,
    level: levelFor(score),
    dims,
    consistency: Math.max(0, Math.min(100, consistency)),
    flags,
    safety: answers['safety'] ?? 0,
    topDims,
  };
}
