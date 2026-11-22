#!/usr/bin/env node
/*
 * One-command, safe release to Netlify:   npm run release
 *
 *  1. runs all tests
 *  2. builds with your site's origin (locks scripts to /assets/)
 *  3. deploys the site + the AI relay function
 *  4. checks the live site; if anything is wrong, it automatically
 *     restores the previous version, so installed users never get a broken app
 *
 * Site details are read from env vars or from .deploy.local.json (git-ignored):
 *   { "origin": "https://your-site.netlify.app", "siteId": "xxxxxxxx-..." }
 * Netlify CLI: uses $NETLIFY_CLI if set, otherwise a pinned npx version.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const CLI_VERSION = '27.16.2';

const local = fs.existsSync('.deploy.local.json') ? JSON.parse(fs.readFileSync('.deploy.local.json', 'utf8')) : {};
const origin = (process.env.LOCKEDIN_ORIGIN || local.origin || '').replace(/\/+$/, '');
const siteId = process.env.NETLIFY_SITE_ID || local.siteId || '';
if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin) || !/^[0-9a-f-]{36}$/i.test(siteId)) {
  console.error('Set LOCKEDIN_ORIGIN and NETLIFY_SITE_ID (or create .deploy.local.json). See scripts/release.mjs.');
  process.exit(1);
}

const env = { ...process.env, LOCKEDIN_ORIGIN: origin, NETLIFY_TELEMETRY_DISABLED: '1', NODE_NO_WARNINGS: '1' };
const isWin = process.platform === 'win32';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', env, shell: isWin, ...opts });
const netlify = (args, capture = false) => {
  const [cmd, pre] = process.env.NETLIFY_CLI ? [process.env.NETLIFY_CLI, []] : ['npx', ['--yes', `netlify-cli@${CLI_VERSION}`]];
  const r = spawnSync(cmd, [...pre, ...args], { env, shell: isWin, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  return r;
};
const step = (msg) => console.log(`\n▶ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

step('Running tests');
if (run('npm', ['test']).status !== 0) fail('Tests failed. Nothing was deployed.');

step(`Building for ${origin}`);
if (run('npm', ['run', 'build']).status !== 0) fail('Build failed. Nothing was deployed.');
const headers = fs.readFileSync('dist/_headers', 'utf8');
if (!headers.includes(`script-src ${origin}/assets/`)) fail('Generated _headers does not lock scripts to this origin. Nothing was deployed.');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
if (sw.includes('__BUILD_ID__')) fail('Service worker cache id was not stamped. Nothing was deployed.');
const builtJs = (fs.readFileSync('dist/index.html', 'utf8').match(/assets\/index-[\w-]+\.js/) ?? [])[0];

step('Remembering the current live version (for automatic rollback)');
const site = netlify(['api', 'getSite', '--data', JSON.stringify({ site_id: siteId })], true);
let previousDeploy = '';
try {
  previousDeploy = JSON.parse(site.stdout.slice(site.stdout.indexOf('{'))).published_deploy?.id ?? '';
} catch {
  /* first deploy */
}

step('Deploying site + AI relay');
const dep = netlify(['deploy', '--dir', 'dist', '--functions', 'netlify/functions', '--no-build', '--prod', '--site', siteId, '--json'], true);
if (dep.status !== 0) fail(`Deploy failed:\n${(dep.stderr || dep.stdout || '').slice(-1500)}`);

step('Verifying the live site');
const problems = [];
const bust = `?release=${Date.now()}`;
try {
  const home = await fetch(`${origin}/${bust}`, { redirect: 'follow' });
  const html = await home.text();
  if (home.status !== 200) problems.push(`home page returned ${home.status}`);
  if (builtJs && !html.includes(builtJs)) problems.push('live page is not serving the new build');
  const csp = home.headers.get('content-security-policy') ?? '';
  if (!csp.includes(`script-src ${origin}/assets/`)) problems.push('security policy header missing or wrong');
  if (/netlify\/scripts/.test(html)) problems.push('host-injected script found in the page');
  if (builtJs) {
    const js = await fetch(`${origin}/${builtJs}`);
    if (js.status !== 200) problems.push(`app script returned ${js.status}`);
  }
  const relay = await fetch(`${origin}/api/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (![400, 403].includes(relay.status)) problems.push(`AI relay returned ${relay.status} (expected 403 without origin)`);
} catch (e) {
  problems.push(`could not reach the site: ${e}`);
}

if (problems.length) {
  console.error(`\n✖ Live check failed:\n  - ${problems.join('\n  - ')}`);
  if (previousDeploy) {
    step(`Rolling back to the previous version (${previousDeploy.slice(0, 8)})`);
    const rb = netlify(['api', 'restoreSiteDeploy', '--data', JSON.stringify({ site_id: siteId, deploy_id: previousDeploy })], true);
    console.error(rb.status === 0 ? '↩ Previous version restored. Users are unaffected.' : '⚠ Rollback failed: restore it in the Netlify dashboard (Deploys → previous → Publish deploy).');
  }
  process.exit(1);
}

console.log(`\n✔ Released and verified: ${origin}`);
