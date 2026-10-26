#!/usr/bin/env node
/**
 * Re-embed the bundled character layers into `client.js`.
 *
 * The pet is built from two images:
 *   assets/firefly.webp        base figure (legs cut away)
 *   assets/firefly-legs.webp   the legs, rotated for the idle swing
 *
 * They are the single source of truth; the Client module inlines them as data
 * URLs so the pet never depends on how (or whether) the plugin's sibling assets
 * are served.
 *
 *   node scripts/sync-sprite.mjs          rewrite the embedded copy
 *   node scripts/sync-sprite.mjs --check  fail when the copy is stale
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'client.js');
const START = '// #region sprite';
const END = '// #endregion sprite';

const ASSETS = [
  ['BUILTIN_SPRITE', 'assets/firefly.webp'],
  ['BUILTIN_LEGS', 'assets/firefly-legs.webp'],
];

const checkOnly = process.argv.includes('--check');

const source = readFileSync(CLIENT, 'utf8');
const start = source.indexOf(START);
const end = source.indexOf(END);
if (start < 0 || end < 0 || end < start) {
  console.error(`client.js is missing the "${START}" / "${END}" markers`);
  process.exit(1);
}

const lines = [
  START,
  '    // Generated from assets/*.webp by `npm run sync-sprite`; edit the assets',
  '    // and re-run it instead of editing these strings by hand.',
];

let total = 0;
for (const [name, relative] of ASSETS) {
  const asset = path.join(ROOT, relative);
  if (!existsSync(asset)) {
    console.error(`missing asset: ${relative}`);
    process.exit(1);
  }
  const bytes = readFileSync(asset);
  total += bytes.length;
  lines.push(`    const ${name} = 'data:image/webp;base64,${bytes.toString('base64')}';`);
}
lines.push('    ');

const next = `${source.slice(0, start)}${lines.join('\n')}${source.slice(end)}`;

if (checkOnly) {
  if (next !== source) {
    console.error('the embedded sprite layers are out of date: run `npm run sync-sprite`');
    process.exit(1);
  }
  console.log(`embedded sprite layers are up to date (${total} bytes across ${ASSETS.length} files)`);
  process.exit(0);
}

if (next === source) {
  console.log('embedded sprite layers already up to date');
} else {
  writeFileSync(CLIENT, next);
  console.log(`embedded sprite layers updated (${total} bytes across ${ASSETS.length} files)`);
}
