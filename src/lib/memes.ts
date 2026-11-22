/* All the copy with personality. Keep it funny, never cruel. */

export const DAILY_LINES = [
  'Bro is NOT going back to the goon arc.',
  'The goon cave has been decommissioned.',
  'Mewing is optional. Locking in is mandatory.',
  'Every ignored urge: +1000 aura.',
  'Delulu is not the solulu. Discipline is.',
  'The algorithm is not your friend. It is your opp.',
  'Brainrot detox in progress… please do not unplug.',
  "Main characters don't skip the character development.",
  'Rejected the brainrot. Accepted the gainrot.',
  'Touch grass. Literally.',
  'Your phone has a bedtime now. Respect it.',
  'You are not your urges. You are the one watching them.',
  'One day at a time. Gooner to Gigachad is a staircase, not an elevator.',
  'Locked in. Not locked up.',
  'Sigma rule #1: drink water and go to sleep.',
  "It's not over. It was never over. We're so back.",
  'Stay hard (at discipline, you degenerate).',
  'Nah, you’d win.',
];

/** Station-board ticker copy. */
export const TICKER = [
  'LOCKEDIN DAILY',
  'GOON CAVE CLOSED UNTIL FURTHER NOTICE',
  'AURA MARKETS UP 12%',
  'LOCAL MAN TOUCHES GRASS, REPORTS "IT WAS FINE"',
  'ALGORITHM SEETHES',
  'GIGACHAD SIGHTED IN LOCAL GYM',
  'GOONERS IN SHAMBLES',
  'DOPAMINE RECEPTORS HEALING',
  'BRAINROT FUTURES CRASH',
  'NPCs IN SHAMBLES',
  'WE ARE SO BACK',
];

export const WIN_LINES = [
  'W. Certified Gigachad behaviour.',
  'Urge said "come here". You said "nah, I\'d win."',
  '+1000 aura. Farmed honestly.',
  'Mogged the urge. It never stood a chance.',
  'Urge got ratio\'d + L + touch grass.',
  'Caught the urge in 4K. Reported. Blocked.',
];

export const RELAPSE_LINES = [
  'Fall seven times, stand up eight.',
  "It's over. (It's not over.) We're so back starting now.",
  'Every main character has a fall arc. This is yours. Next scene: the comeback.',
  'An L is just data. We log it, we learn, we level up.',
  'Respawning at the last bonfire… with more XP than before.',
];

export const PANIC_LINES = [
  'The urge peaks in ~15 minutes, then fades. You only need to outlast one wave.',
  'Your brain is running a scam. It promises relief, it delivers regret.',
  'Leave the room. Change the map. Urges hate new environments.',
  "You've beaten this exact boss before. Same moveset. You know the pattern.",
];

/** Mood check-in scale: it's over → we're so back. */
export const MOOD_SCALE = [
  { label: "It's over", short: 'Over' },
  { label: 'Cooked', short: 'Cooked' },
  { label: 'Mid', short: 'Mid' },
  { label: 'Locked in', short: 'Locked' },
  { label: "We're so back", short: 'Back' },
];

export function urgeLabel(u: number) {
  if (u <= 2) return 'Calm as a koi';
  if (u <= 5) return 'Slightly sus';
  if (u <= 7) return 'Goblin mode loading…';
  return 'Code red. Hit Horny Jail now.';
}

export function pick<T>(arr: T[], seed?: number): T {
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : Math.abs(seed) % arr.length;
  return arr[i];
}

/** Stable-per-day pick so the daily quote doesn't change on every render. */
export function dailyPick<T>(arr: T[]): T {
  const d = new Date();
  const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  return pick(arr, seed);
}

export const TRIGGERS = [
  { id: 'bored', label: 'Bored', emoji: '🥱' },
  { id: 'stress', label: 'Stressed', emoji: '😤' },
  { id: 'lonely', label: 'Lonely', emoji: '🥀' },
  { id: 'late', label: 'Late night / tired', emoji: '🌙' },
  { id: 'scroll', label: 'Doomscrolling / socials', emoji: '📱' },
  { id: 'saw', label: 'Saw something triggering', emoji: '👀' },
  { id: 'horny', label: 'Random horniness', emoji: '🔥' },
  { id: 'alone', label: 'Home alone', emoji: '🏠' },
  { id: 'sad', label: 'Sad / rejected', emoji: '😢' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'substance', label: 'Alcohol / weed', emoji: '🍺' },
  { id: 'reward', label: '"I deserve it"', emoji: '🎁' },
  { id: 'bed', label: 'In bed with phone', emoji: '🛏️' },
  { id: 'procrast', label: 'Procrastinating', emoji: '📚' },
];

export const EMOTIONS = [
  { id: 'empty', label: 'Empty', emoji: '🕳️' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'bored', label: 'Bored', emoji: '😑' },
  { id: 'excited', label: 'Excited', emoji: '🤩' },
  { id: 'tired', label: 'Exhausted', emoji: '😴' },
  { id: 'fine', label: 'Honestly fine', emoji: '🙂' },
];

export const PLACES = ['Bedroom', 'Bathroom', 'Living room', 'Work / school', 'Somewhere else'];

export const labelOf = (list: { id: string; label: string; emoji: string }[], id: string) => {
  const x = list.find((l) => l.id === id);
  return x ? `${x.emoji} ${x.label}` : id;
};
