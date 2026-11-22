// Post-build: give the service worker a unique cache name, so every release
// cleanly replaces the previous offline cache on users' phones.
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const file = 'dist/sw.js';
const PLACEHOLDER = "const CACHE = 'lockedin-__BUILD_ID__';";
const src = fs.readFileSync(file, 'utf8');
if (src.split(PLACEHOLDER).length !== 2) throw new Error(`dist/sw.js must contain exactly one: ${PLACEHOLDER}`);
const id = `${pkg.version}-${Date.now().toString(36)}`;
fs.writeFileSync(file, src.replace(PLACEHOLDER, `const CACHE = 'lockedin-${id}';`));
console.log(`service worker cache: lockedin-${id}`);
