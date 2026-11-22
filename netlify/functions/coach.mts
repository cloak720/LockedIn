// Netlify Function wrapper for the LockedIn AI relay. All logic lives in src/server/relay.ts.
// Configure in Netlify: Site configuration → Environment variables → GEMINI_API_KEY (secret).
// Optional: GEMINI_MODEL, COACH_DAILY_LIMIT (default 20), COACH_GLOBAL_DAILY_CAP (default 800).
import { getStore } from '@netlify/blobs';
import { handleCoach } from '../../src/server/relay';

export default async (req: Request, context: { ip?: string }) => {
  const blobs = getStore('coach-limits');
  const env = process.env;
  const allowedOrigins = [env.URL, env.DEPLOY_PRIME_URL].filter((o): o is string => !!o).map((o) => o.replace(/\/+$/, ''));
  return handleCoach(req, {
    env: {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
      COACH_DAILY_LIMIT: env.COACH_DAILY_LIMIT,
      COACH_GLOBAL_DAILY_CAP: env.COACH_GLOBAL_DAILY_CAP,
    },
    store: {
      get: async (k) => ((await blobs.get(k)) as string | null) ?? null,
      set: async (k, v) => {
        await blobs.set(k, v);
      },
    },
    fetch,
    now: Date.now,
    ip: context?.ip ?? req.headers.get('x-nf-client-connection-ip') ?? '',
    allowedOrigins,
  });
};

export const config = { path: '/api/coach' };
