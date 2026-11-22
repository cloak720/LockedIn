# Security & Privacy

LockedIn handles some of the most sensitive data a person can have. The design goal is simple: **there is no database to breach**, nothing personal is stored server-side, and what lives on the device is protected.

## Architecture

- **No accounts, no database, no analytics, no trackers, no third-party scripts.** The app is static files plus one small serverless function (the AI relay).
- All user data lives in the browser's `localStorage` on the user's own device.
- The only outbound network calls are (a) loading the app itself and (b) the AI coach, **only if the user opts in**:
  - **LockedIn AI**: chat messages + a short summary go to the relay (`/api/coach`), which forwards them to Google Gemini with the server-held key. Journal text, notes and slip stories are never sent.
  - **Own key**: messages go directly from the device to the chosen provider (Gemini, Groq or OpenRouter).
  - Messages that match crisis phrases are answered on-device with helpline information and are never sent to any AI.
- Fonts are bundled locally. No requests to Google Fonts or any CDN.

## Protections

| Area | Protection |
| --- | --- |
| **Data at rest** | Optional passcode encrypts *everything* (journal, relapses, chat, assessment, API keys) with **AES-256-GCM**. The key is derived with **PBKDF2-SHA256, 600,000 iterations**, 16-byte random salt, fresh 12-byte IV per write, authenticated with associated data. The key is a non-extractable WebCrypto key held only in memory. The plaintext copy is deleted once the encrypted copy is written. |
| **Locking** | Reloading or relaunching the app always starts locked. Auto-lock after a chosen time in the background (immediately / 1 / 5 / 15 min). "Lock now" wipes decrypted data and the key from memory. |
| **Brute force** | 5 free attempts, then exponential lockout (30 s → 1 h max). Real protection against an offline attacker comes from PBKDF2 cost + passcode strength, so the app enforces 6+ characters, rejects trivial codes, and recommends a passphrase. |
| **Privacy screen** | The UI blurs whenever the app is backgrounded (app-switcher thumbnails, shoulder surfing). |
| **XSS** | React escapes all output. There is no `dangerouslySetInnerHTML`, `eval` or `innerHTML` anywhere. AI replies are rendered as plain text. |
| **Content Security Policy** | Injected into every production build: `script-src 'self'` (no inline or third-party scripts), `connect-src` limited to the app + the 3 AI APIs, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`. Verified: injected inline scripts are blocked. |
| **Untrusted input** | Everything loaded from storage or an imported backup passes through `src/lib/sanitize.ts`: unknown fields dropped, types checked, enums validated, strings/arrays length-capped, numbers clamped, 10 MB file limit. Tested against XSS payloads, prototype pollution and out-of-range values. |
| **Backups** | API keys are never exported. Backups can be password-encrypted (same AES-GCM/PBKDF2 scheme). Imports can never replace the device's API keys. |
| **AI calls** | Hard-coded HTTPS endpoints, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, redirects refused, 30 s timeout, response size cap, model names validated against a strict pattern, keys restricted to printable ASCII (no header injection). User-written text in the AI prompt is fenced off as data to reduce prompt injection. |
| **Spellcheck leakage** | Cloud spellcheck is disabled on private text fields (some browsers send typed text to their servers). |
| **AI relay** | `src/server/relay.ts`. Same-origin requests only (Origin allow-list); POST only; 32 KB body cap; max 20 messages × 2,000 chars; roles validated. The system prompt is built server-side from validated facts, so the relay cannot be used as a general-purpose Gemini proxy. Fair use: per-person daily limit plus a global daily cap; people are identified only by a salted, daily-rotating SHA-256 hash of their IP (raw IPs never stored); counters are refunded when the upstream AI fails. The Gemini key lives only in a Netlify environment variable. **No message content is stored or logged.** Over the limit, the app falls back to the offline coach (never a paywall). Covered by `tests/relay.test.ts`. |
| **Service worker** | Caches only same-origin static files with successful responses. Never touches user data or API traffic. |
| **Dev server** | Bound to `localhost` only. |
| **Dependencies** | Runtime dependencies pinned to exact versions; new versions are only adopted once they are at least 2 weeks old. `npm audit`: 0 known vulnerabilities at release. |
| **Releases** | `npm run release` runs all tests, builds with the origin-locked CSP, deploys, verifies the live site (status, new build served, CSP header, no injected scripts, relay reachable) and **automatically restores the previous deploy** if any check fails. |

## Deployment headers

Some protections can only be sent as HTTP headers. The build generates `dist/_headers` (see `vite.config.ts`), which Netlify and Cloudflare Pages apply automatically.

**Always build with your site's origin** so scripts, styles and fonts are locked to `/assets/`. That also blocks code the host itself injects from its own domain (Netlify's free tier injects a "HUD" script from `/.netlify/scripts/`):

```powershell
$env:LOCKEDIN_ORIGIN = 'https://your-site.netlify.app'; npm run build
```

Without `LOCKEDIN_ORIGIN` the header falls back to `'self'`. On Netlify, also turn off the "built with" badge injection (site setting `built_with_badge_enabled: false`).

On other hosts, configure the same headers:

```
Content-Security-Policy: (see public/_headers) + frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

Always serve over **HTTPS**. GitHub Pages cannot set custom headers; the in-page CSP still applies there, but clickjacking protection (`frame-ancestors`) will not.

## Honest limitations (threat model)

No app is "unbreachable". LockedIn defends well against: server breaches (there is no server), data brokers and trackers (none), casual access to an unlocked or stolen device, other websites, and malicious backup files. It **cannot** fully protect against:

- **A compromised device or browser**: malware, a malicious browser extension or a keylogger can read whatever the user can see or type, including the passcode.
- **Weak passcodes**: an attacker who copies the encrypted data can try guesses offline, bypassing the in-app lockout. A 6-digit PIN can be cracked by a determined attacker; a long passphrase cannot in practice.
- **Forgotten passcodes**: data is unrecoverable by design.
- **Without a passcode**, data is stored unencrypted in the browser.
- **AI providers**: chats sent to the AI coach are processed by that provider under their privacy policy. On Google's free tier, prompts may be used to improve Google's products and may be read by human reviewers; moving the relay to a paid tier avoids this. The offline coach sends nothing.
- **Relay limits are IP-based**: people sharing one network (e.g. a college Wi-Fi) share a daily limit; a determined attacker rotating IPs can consume the global cap (which bounds cost) but cannot read anyone's data.
- **Clearing browser data** deletes the app's data. Use encrypted backups.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report privately via GitHub's "Report a vulnerability" (Security Advisories) on the repository, with steps to reproduce. We aim to respond within 7 days.

## Maintainer checklist before each release

- [ ] `npm audit` shows 0 vulnerabilities
- [ ] `npm run build` and test the production build (`npm run preview`): no CSP errors in the console
- [ ] Bump `CACHE` in `public/sw.js`
- [ ] Any new data field is added to `src/lib/sanitize.ts`
- [ ] Any new outbound domain is added to the CSP in both `vite.config.ts` and `public/_headers`
