import confettiLib from 'canvas-confetti';

// The library's default instance spawns a Web Worker from a blob: URL, which our
// strict CSP (worker-src 'self') blocks. Run it on the main thread instead of
// loosening the policy.
const fire = confettiLib.create(undefined, { resize: true, useWorker: false, disableForReducedMotion: true });

// Poster palette: vermilion, ink, paper, plus a little gold leaf.
const COLORS = ['#d4372a', '#171513', '#efe8da', '#b07d22'];

export default function confetti(opts: confettiLib.Options) {
  try {
    void fire({ colors: COLORS, shapes: ['square'], ...opts });
  } catch {
    /* purely cosmetic */
  }
}
