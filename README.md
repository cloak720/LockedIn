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
  <img alt="Tests" src="https://img.shields.io/badge/tests-133%20passing-171513" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Android%20%7C%20iOS%20%7C%20Desktop-171513" />
  <img alt="No backend" src="https://img.shields.io/badge/backend-none-171513" />
</p>

No account. No cloud. No subscription. Your data never leaves your device. One tiny ad a day, and that's it.

---

## Why another quitting app?

Most apps in this space are good at one or two things but share the same gaps. LockedIn is built to close them:

| Common problem | What LockedIn does instead |
| --- | --- |
| Paywalled after a trial ($30–$100/yr) | 100% free and open source, one skippable ad per day |
| Requires an account; sensitive data on their servers | **Local-first.** No backend exists. Optional AES-256 encryption on the device. |
| Shallow intake quiz you can lie your way through | **Cross-checked assessment**: key questions are asked twice from opposite angles. Contradictions are flagged, and speed-running lowers the honesty score. |
| A relapse wipes your counter | The streak resets, but **total clean time** and **recovery rate** are kept. The slip flow is shame-free and structured. |
| Relapse logging is a single button | **Slip breakdown**: time, intensity, triggers, place, feelings, the chain of events, and an if-then plan |
| Stats are just a counter | **Pattern radar**: danger-hour heatmap, top triggers, streak trend, and **live warnings** when you enter your personal risk window |
| Generic chatbot or none | **AI coach** that knows your streak, triggers and danger hours, on free APIs with your own key. Works offline too. |
| Dry, clinical UI | Meme-culture tier ladder, "Horny Jail" panic mode, a bonk-the-urge mini-game, confetti, rubber stamps |

## Features

- **Gooner → Gigachad tier ladder.** Ten tiers: Certified Gooner (day 0) → Recovering Gooner (1) → NPC (3) → Grass Toucher (7) → Bloomer (14) → Main Character (30) → Sigma (60) → Chad (90) → Gigachad (180) → Ascended Gigachad (365). Each new tier gets a celebration.
- **Assessment.** 21 questions across 7 dimensions (frequency, loss of control, brain space, escape habit, escalation, withdrawal, life impact), plus 3 cross-check items and an unscored safety screen.
  - Gives a 0–100 crisis score and a category: **Chad-Adjacent**, **Part-Time Gooner**, **Certified Gooner** or **Gooner Final Boss**.
  - Also shows a per-dimension breakdown, an honesty score, a game plan and a 30/60/90-day goal.
  - Retake it anytime to track progress.
- **Send me to Horny Jail** (panic mode): bonk-the-urge game, 4-7-8 breathing, a 10-minute urge-surfing timer, a push-up counter, "remember your why", and the AI coach. Every urge you beat is logged.
- **Daily check-in**: a vibe check (*It's over → We're so back*), urge level and a note, stamped DONE.
- **Slip log**: six compassionate steps, then "We're so back".
- **Pattern radar**: streak history, weekday × hour heatmap, triggers, feelings, urge win rate, assessment history and a relapse journal.
- **AI coach "Lock"**: Google Gemini, Groq or OpenRouter (all have free tiers), or a built-in offline coach.
- **Security & privacy**: see the next section.
- **Safety**: crisis resources appear automatically if self-harm comes up in the assessment or in chat.
- **Installable PWA**: Android, iOS, Windows, macOS, Linux. Works fully offline. Light and dark themes.

## Security & privacy

- **No server, no accounts, no analytics, no third-party scripts.** Fonts are bundled locally.
- **Optional passcode encryption**: all data is encrypted at rest with AES-256-GCM, using a key derived by PBKDF2-SHA256 (600k iterations). Includes auto-lock, a brute-force lockout, and a blur that hides the app in the app switcher.
- **Strict Content Security Policy**: no inline or third-party scripts. On Netlify or Cloudflare Pages, scripts are locked to `/assets/`, so even code the host injects is refused.
- **Imports are sanitized**: every backup or stored value is validated and size-capped. Tests cover XSS payloads and prototype pollution.
- **Backups never contain API keys**, and can be password-encrypted.

Full threat model and limitations: **[SECURITY.md](SECURITY.md)**. To report a vulnerability, please use GitHub's private *Report a vulnerability* rather than a public issue.

## Quick start

Requires Node.js 20+ (22 recommended).

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 133 unit tests
npm run build     # production build in dist/
npm run preview   # serve the production build (service worker on)
```

## Deploy for free (and install on your phone)

Any static host works. For **Netlify** or **Cloudflare Pages** (they apply the generated security headers):

```bash
# build with your site's address so scripts are locked to /assets/
LOCKEDIN_ORIGIN=https://your-site.netlify.app npm run build      # macOS / Linux
$env:LOCKEDIN_ORIGIN='https://your-site.netlify.app'; npm run build   # Windows PowerShell
```

Then upload the `dist/` folder (Netlify: drag it onto *Deploys*, or `netlify deploy --dir dist --prod`). On Netlify, also turn off the "built with" badge injection.

On your phone, open the site and:

- **Android (Chrome)**: ⋮ → **Install app**
- **iPhone (Safari)**: Share → **Add to Home Screen**

## Set up the AI coach (free)

In the app: Settings → AI coach → pick a provider → paste a key → **Test connection**.

- **Google Gemini** (recommended): https://aistudio.google.com/apikey
- **Groq**: https://console.groq.com/keys
- **OpenRouter**: https://openrouter.ai/keys (use models ending in `:free`)

The key stays on the device, and requests go straight from the device to the provider.

## Project structure

```
src/
  lib/
    store.ts        state, persistence, encrypted vault, backups
    crypto.ts       AES-GCM + PBKDF2 (WebCrypto)
    sanitize.ts     validation of everything loaded or imported
    assessment.ts   questions, scoring, cross-checks, categories
    streak.ts       Gooner → Gigachad tiers, time maths, recovery rate
    insights.ts     pattern analysis + danger prediction
    ai.ts           AI providers, system prompt, offline coach
    memes.ts        all the copy with personality
  components/       one file per screen / flow
public/             icons, manifest, offline service worker
tests/              Vitest unit tests
vite.config.ts      build + Content Security Policy + generated _headers
```

## The one daily ad

`src/components/DailyAd.tsx` renders a placeholder into `#lockedin-ad-slot`. Swap in AdSense (web) or AdMob (via Capacitor) there. The rules live in `App.tsx`: never on day one, never during Horny Jail or a slip log, only after 20 seconds in the app, and at most once per day.

## Roadmap

- [ ] Native store builds via **Capacitor** (Android/iOS) or **Tauri** (desktop), with local notifications for danger windows
- [ ] Optional end-to-end encrypted sync between devices
- [ ] Accountability partner: share a streak-only link
- [ ] Built-in content-blocker setup guides per OS
- [ ] 90-day education track and journaling prompts
- [ ] Translations
- [ ] Anonymous community challenges

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run build` before opening a PR. If you add a stored field, add it to `src/lib/sanitize.ts`. If you add an outbound domain, add it to the CSP in `vite.config.ts`.

## Disclaimer

LockedIn is a self-help tool, not medical care. The assessment is for self-reflection and is not a diagnosis. If you are in crisis, find a free helpline at https://findahelpline.com or contact your local emergency services.

## License

[MIT](LICENSE) © 2026 cloak720
