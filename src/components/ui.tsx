import { motion, type HTMLMotionProps, type MotionStyle } from 'framer-motion';
import type { ReactNode } from 'react';
import { buzz } from '../lib/store';
import { RANKS } from '../lib/streak';

export const pageAnim = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { type: 'spring', stiffness: 260, damping: 26 },
} as const;

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={`screen ${className}`} {...pageAnim}>
      {children}
    </motion.div>
  );
}

type BtnProps = HTMLMotionProps<'button'> & { variant?: string; haptic?: boolean };

/** Button with a haptic tick on phones. */
export function Btn({ variant = '', className = '', haptic = true, onClick, children, ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`btn ${variant} ${className}`}
      onClick={(e) => {
        if (haptic) buzz(10);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Card({
  children,
  className = '',
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: MotionStyle;
}) {
  return (
    <motion.div
      className={`card ${className}`}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

/** Red rubber stamp with a word on it. `stamp` plays the thunk-down animation. */
export function Stamp({ text, size = 64, stamp = false, rotate = -8 }: { text: string; size?: number; stamp?: boolean; rotate?: number }) {
  const fs = Math.min(size * 0.42, (size * 1.5) / Math.max(1, text.length));
  return (
    <motion.span
      className="stamp"
      style={{ width: size, height: size, fontSize: fs }}
      initial={stamp ? { scale: 2.4, opacity: 0, rotate: rotate - 20 } : false}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
      aria-hidden="true"
    >
      {text}
    </motion.span>
  );
}

/** Section header: "01  TITLE ─────────── aside" */
export function Sec({ no, title, aside }: { no: string; title: string; aside?: ReactNode }) {
  return (
    <div className="sec">
      <span className="no">{no}</span>
      <span>{title}</span>
      <span className="rule" />
      {aside && <span className="aside">{aside}</span>}
    </div>
  );
}

/** Minimal line icons for the tab bar. */
export function Icon({ name }: { name: 'home' | 'radar' | 'coach' | 'settings' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {name === 'home' && (
        <>
          <path {...p} d="M3 11 12 4l9 7" />
          <path {...p} d="M5 10v10h14V10" />
          <path {...p} d="M10 20v-6h4v6" />
        </>
      )}
      {name === 'radar' && (
        <>
          <path {...p} d="M4 20V4" />
          <path {...p} d="M4 20h16" />
          <path {...p} d="M8 16v-4M12 16V8M16 16v-6" />
        </>
      )}
      {name === 'coach' && (
        <>
          <path {...p} d="M4 5h16v11H9l-5 4z" />
          <path {...p} d="M8 10h8M8 13h5" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path {...p} d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle {...p} cx="16" cy="7" r="2" />
          <circle {...p} cx="8" cy="17" r="2" />
        </>
      )}
    </svg>
  );
}

/** Gooner → Gigachad meter: 10 segments, current tier highlighted. */
export function TierMeter({ tier }: { tier: number }) {
  return (
    <div className="tier-meter" role="img" aria-label={`Tier ${tier} of ${RANKS.length - 1}: ${RANKS[tier].name}`}>
      <span className="end">Gooner</span>
      <div className="segs">
        {RANKS.map((r) => (
          <motion.i
            key={r.tier}
            className={r.tier < tier ? 'on' : r.tier === tier ? 'now' : ''}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.1 + r.tier * 0.04 }}
          />
        ))}
      </div>
      <span className="end">Gigachad</span>
    </div>
  );
}

/** Full ladder list: every tier, what it takes, and where you are. */
export function TierLadder({ tier, days }: { tier: number; days: number }) {
  return (
    <ol className="ladder">
      {[...RANKS].reverse().map((r) => {
        const state = r.tier < tier ? 'done' : r.tier === tier ? 'now' : 'locked';
        return (
          <li key={r.tier} className={state}>
            <span className="t">T{r.tier}</span>
            <span className="nm">{r.name}</span>
            <span className="d">
              {state === 'now' ? 'You are here' : state === 'done' ? 'Cleared' : `${r.days - days > 0 ? `in ${Math.ceil(r.days - days)}d` : ''}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Chips<T extends string>({
  items,
  value,
  onChange,
  multi = true,
}: {
  items: { id: T; label: string; emoji?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="chips">
      {items.map((it) => {
        const on = value.includes(it.id);
        return (
          <motion.button
            key={it.id}
            type="button"
            whileTap={{ scale: 0.92 }}
            className={`chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => {
              buzz(8);
              if (!multi) onChange([it.id]);
              else onChange(on ? value.filter((v) => v !== it.id) : [...value, it.id]);
            }}
          >
            {it.emoji ? `${it.emoji} ` : ''}
            {it.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <motion.i
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 18 }}
        style={color ? { background: color } : undefined}
      />
    </div>
  );
}

export function Overlay({ children, full = false }: { children: ReactNode; full?: boolean }) {
  return (
    <motion.div className={`overlay ${full ? 'full' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
