<p align="center">
  <img src="public/icon-192.png" width="96" height="96" alt="LockedIn icon" />
</p>

<h1 align="center">LockedIn</h1>

<p align="center">
  <b>From Gooner to Gigachad.</b><br />
  A free, private, open-source companion for quitting porn and compulsive masturbation.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-d4372a" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-181%20passing-171513" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Android%20%7C%20iOS%20%7C%20Desktop-171513" />
  <img alt="Your data stays on your device" src="https://img.shields.io/badge/data-on%20your%20device-171513" />
</p>

No account. No subscription. No paywall, ever. Your data lives on your device. One tiny ad a day, and that's it.

---

## Principles

1. **Free forever.** No feature is ever paywalled, and help is never locked behind payment, least of all in a moment of crisis.
2. **Private by design.** No accounts, no database, no analytics. Everything stays on the phone unless you explicitly choose the AI coach.
3. **Fun, never shame.** Meme culture to make discipline feel like a game, never at the user's expense.

## Why another quitting app?

| Common problem | What LockedIn does instead |
| --- | --- |
| Paywalled after a trial ($30–$100/yr) | 100% free and open source, one skippable ad per day |
| Requires an account; sensitive data on their servers | **Local-first.** No accounts, no database. Optional AES-256 encryption on the device. |
| Shallow intake quiz you can lie your way through | **Cross-checked assessment**: key questions asked twice from opposite angles. Contradictions are flagged; speed-running lowers the honesty score. |
| A relapse wipes your counter | The streak resets, but **total clean time** and **recovery rate** are kept. Shame-free slip flow. |
| Relapse logging is a single button | **Slip breakdown**: time, intensity, triggers, place, feelings, the chain of events, and an if-then plan |
| Stats are just a counter | **Pattern radar**: danger-hour heatmap, top triggers, streak trend, and **live warnings** in your personal risk window |
| AI behind a subscription, or none | **Built-in AI coach, free** with a fair daily limit, opt-in. Or bring your own key, or stay fully offline. |
| Dry, clinical UI | Gooner → Gigachad tier ladder, "Horny Jail" urge tools, a bonk-the-urge mini-game |

## Features

- **Gooner → Gigachad tier ladder.** Certified Gooner (day 0) → Recovering Gooner (1) → NPC (3) → Grass Toucher (7) → Bloomer (14) → Main Character (30) → Sigma (60) → Chad (90) → Gigachad (180) → Ascended Gigachad (365).
- **Assessment.** 21 questions across 7 dimensions plus cross-checks and an unscored safety screen.
  - Gives a 0–100 crisis score and a category: **Chad-Adjacent**, **Part-Time Gooner**, **Certified Gooner** or **Gooner Final Boss**.
  - Also gives a game plan and a goal.
- **Send me to Horny Jail** (always one tap from Home): bonk-the-urge game, 4-7-8 breathing, a 10-minute urge-surfing timer, a push-up counter, "remember your why", and the coach.
- **Daily check-in**: a vibe check (*It's over → We're so back*), urge level and a note.
- **Slip log**: six compassionate steps, ending in "We're so back".
- **Pattern radar**: streak history, a weekday × hour heatmap, triggers, feelings and urge win rate.
- **Coach "Lock"**: built-in AI, your own key, or offline (see below).
- **Safety**: crisis phrases always get helpline information immediately, before any AI is involved.
- **Installable PWA**: Android, iOS and desktop. Works offline. Light and dark themes.

## The AI coach

| Mode | Setup | Cost to user | What leaves the phone |
| --- | --- | --- | --- |
| **LockedIn AI** (default, opt-in) | None | Free, ~20 messages/day | Chat messages + a short summary (nickname, streak, tier, top triggers, danger hours) → LockedIn relay → Google Gemini. **Never** journal text, notes or slip stories. |
| **Your own key** (Gemini / Groq / OpenRouter) | Paste a free key | Free, unlimited | Same data, sent straight from the phone to that provider |
| **Offline coach** | None | Free, unlimited | Nothing |

- **Never a paywall:** when the daily limit is reached, or the AI is unavailable, the offline coach answers instead.
- **Same brain everywhere:** the coach's playbook, rules and examples live in `src/lib/coachPrompt.ts`.
- **Tested:** it's checked against a test set of 40-plus situations in `tests/coach-scenarios.ts` (urges, slips, crisis, explicit requests, off-topic, prompt injection).
  - The offline coach runs on every `npm test`.
  - Run `npm run eval:coach` with `GEMINI_API_KEY` set to grade the live model.

## Security & privacy

- **No accounts, no database, no analytics, no third-party scripts.** Fonts are bundled.
- **The only server code** is a small AI relay (`src/server/relay.ts`). It:
  - accepts requests only from the app
  - builds the prompt itself, so it can't be used as a general AI proxy
  - enforces fair daily limits using a salted, daily-rotating hash of the IP (raw IPs are never stored)
  - **stores and logs no messages**
- **Optional passcode encryption** with AES-256-GCM, a key derived by PBKDF2-SHA256 (600k iterations), auto-lock, and brute-force lockout.
- **Strict Content Security Policy**: scripts are locked to `/assets/`, so even code the host injects is refused.
- **Every stored or imported value is validated** and size-capped.

Details: **[SECURITY.md](SECURITY.md)** · Privacy policy: [`public/privacy.html`](public/privacy.html). To report a vulnerability, please use GitHub's private *Report a vulnerability*.

## Quick start

Requires Node.js 20+ (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 181 unit tests (+ live AI eval, skipped without a key)
npm run build        # production build in dist/
npm run preview      # serve the production build
```

## Deploy (Netlify, free)

1. Create a Netlify site, and in **Site configuration → Environment variables** add `GEMINI_API_KEY` (a free key from https://aistudio.google.com/apikey). Optional: `COACH_DAILY_LIMIT` (default 20), `COACH_GLOBAL_DAILY_CAP` (default 800), `GEMINI_MODEL`.
2. Turn off the "built with" badge injection in the site settings.
3. Create `.deploy.local.json` (git-ignored):
   ```json
   { "origin": "https://your-site.netlify.app", "siteId": "your-netlify-site-id" }
   ```
4. Release:
   ```bash
   npm run release
   ```
   This tests, builds (scripts locked to your origin), deploys the site and the AI relay, then checks the live site. **If anything is wrong it automatically restores the previous version**, so installed users never get a broken app.

On your phone, open the site → **Install app** (Android Chrome) or **Share → Add to Home Screen** (iPhone Safari). Installed apps update themselves.

## Project structure

```
src/
  lib/
    store.ts         state, persistence, encrypted vault, backups
    crypto.ts        AES-GCM + PBKDF2 (WebCrypto)
    sanitize.ts      validation of everything loaded or imported
    coachPrompt.ts   the coach's rules, playbook, examples, crisis phrases
    ai.ts            coach modes, fallbacks, offline coach
    assessment.ts    questions, scoring, cross-checks, categories
    streak.ts        Gooner → Gigachad tiers, recovery rate
    insights.ts      pattern analysis + danger prediction
    memes.ts         all the copy with personality
  server/relay.ts    the AI relay (the only server-side code)
  components/        one file per screen / flow
netlify/functions/   thin Netlify wrapper for the relay
public/              icons, manifest, service worker, privacy policy
scripts/             release (with auto-rollback), service-worker stamping
tests/               unit tests + the coach test set
vite.config.ts       build + Content Security Policy + generated _headers
```

## Sustainability

LockedIn stays free. Costs (mainly the AI) are covered by the one daily ad and, in future, an optional pay-what-you-want supporter program. Supporters get a thank-you and a higher AI limit, never core features. Supporter money would also go towards a paid AI tier, which keeps everyone's chats out of model training.

## Roadmap

- [ ] Optional supporter program (pay what you want; nothing essential behind it)
- [ ] Google Play release (Trusted Web Activity), then the App Store (Capacitor)
- [ ] Local notifications for danger windows
- [ ] On-device AI model (fully private coach)
- [ ] Optional end-to-end encrypted sync; accountability partner link
- [ ] Content-blocker setup guides; 90-day education track; translations

## Contributing

Issues and pull requests are welcome.
- Run `npm test` and `npm run build` before opening a PR.
- New stored field? Add it to `src/lib/sanitize.ts`.
- New outbound domain? Add it to the CSP in `vite.config.ts`.
- Changed the coach? Run `npm run eval:coach`.

## Disclaimer

LockedIn is a self-help tool, not medical care. The assessment is for self-reflection and is not a diagnosis. If you are in crisis, find a free helpline at https://findahelpline.com or contact your local emergency services.

## License

[MIT](LICENSE) © 2026 cloak720
