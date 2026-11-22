# Security & Privacy

LockedIn handles some of the most sensitive data a person can have. The design goal is simple: **there is nothing to breach, because there is no server**, and what lives on the device is protected.

## Architecture

- **No backend, no accounts, no analytics, no trackers, no third-party scripts.** The app is static files.
- All user data lives in the browser's `localStorage` on the user's own device.
- The only outbound network calls are (a) loading the app itself and (b) the AI coach, which goes **directly** from the device to the provider the user chose (Google Gemini, Groq or OpenRouter) over HTTPS, with the user's own key.
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
| **Service worker** | Caches only same-origin static files with successful responses. Never touches user data or API traffic. |
| **Dev server** | Bound to `localhost` only. |
| **Dependencies** | 5 runtime dependencies, versions pinned exactly. `npm audit`: 0 known vulnerabilities at release. |

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
- **AI providers**: chats sent to the AI coach are processed by that provider under their privacy policy. The offline coach sends nothing.
- **Clearing browser data** deletes the app's data. Use encrypted backups.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report privately via GitHub's "Report a vulnerability" (Security Advisories) on the repository, with steps to reproduce. We aim to respond within 7 days.

## Maintainer checklist before each release

- [ ] `npm audit` shows 0 vulnerabilities
- [ ] `npm run build` and test the production build (`npm run preview`): no CSP errors in the console
- [ ] Bump `CACHE` in `public/sw.js`
- [ ] Any new data field is added to `src/lib/sanitize.ts`
- [ ] Any new outbound domain is added to the CSP in both `vite.config.ts` and `public/_headers`
