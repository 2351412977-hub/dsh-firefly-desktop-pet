#!/usr/bin/env node
/**
 * Zero-dependency manifest checks for the dsh-firefly bundle.
 *
 * Verifies the package contract the DSH plugin loader relies on, the display
 * metadata the plugin manager reads, and the JavaScript syntax. No Harness and
 * no browser required.
 */
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passed = [];

function check(name, fn) {
  try {
    fn();
    passed.push(name);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  const absolute = path.join(ROOT, relPath);
  assert(existsSync(absolute), `${relPath} does not exist`);
  return readFileSync(absolute, 'utf8');
}

function expand(pattern) {
  const absolute = path.join(ROOT, pattern);
  if (!pattern.includes('*')) return [absolute];
  const directory = path.dirname(absolute);
  if (!existsSync(directory)) return [];
  const matcher = new RegExp(`^${path.basename(absolute).replace(/\*/g, '.*')}$`);
  return readdirSync(directory)
    .filter((entry) => matcher.test(entry))
    .map((entry) => path.join(directory, entry));
}

const manifest = JSON.parse(read('package.json'));

check('manifest: identity', () => {
  assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'name is required');
  assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version), 'version must be semver');
  assert(manifest.type === 'module', 'type must be "module"');
  assert(typeof manifest.license === 'string' && manifest.license.length > 0, 'license is required');
  assert(typeof manifest.description === 'string' && manifest.description.length > 0, 'description is required');
});

check('manifest: bundle patch', () => {
  const patch = manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch;
  assert(typeof patch === 'string', 'dsh.bundle.patch is required');
  assert(existsSync(path.join(ROOT, patch)), `${patch} does not exist`);
});

check('manifest: client entry', () => {
  const client = manifest.dsh && manifest.dsh.client;
  assert(client && typeof client === 'object', 'dsh.client is required');
  assert(client.platform === 'web', 'dsh.client.platform must be "web"');
  assert(client.immediately === true, 'dsh.client.immediately must be true so the pet mounts at boot');
  assert(Array.isArray(client.inject), 'dsh.client.inject must be an array');
  assert(manifest.exports && manifest.exports['./client'], 'exports["./client"] is required');
});

check('manifest: exported display resources', () => {
  assert(manifest.exports['./icon'], 'exports["./icon"] is required');
  assert(manifest.exports['./locale/*.json'], 'exports["./locale/*.json"] is required');
  assert(manifest.exports['.'], 'exports["."] is required');
});

check('patch: inserts this package', () => {
  const patch = read(manifest.dsh.bundle.patch);
  assert(/^\s*-\s*insert:/m.test(patch), 'patch must contain an insert list');
  assert(new RegExp(`id:\\s*${manifest.name}\\b`).test(patch), `patch must insert the row id "${manifest.name}"`);
  assert(
    new RegExp(`name:\\s*['"]?${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?`).test(patch),
    `patch must point name at "${manifest.name}"`,
  );
});

check('supported locales', () => {
  const localeDir = path.join(ROOT, 'locale');
  assert(existsSync(localeDir), 'locale directory is required');
  const files = readdirSync(localeDir).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(localeDir, file), 'utf8'));
    assert(data.meta && typeof data.meta.title === 'string' && data.meta.title.length > 0, `${file}: meta.title is required`);
    assert(
      data.meta && typeof data.meta.description === 'string' && data.meta.description.length > 0,
      `${file}: meta.description is required`,
    );
  }
  for (const required of ['en.json', 'zh.json']) {
    assert(files.includes(required), `locale/${required} is required`);
  }
});

check('icon: valid and within limits', () => {
  const iconExport = manifest.exports['./icon'];
  assert(typeof iconExport === 'string', 'exports["./icon"] must be a path');
  const iconPath = path.join(ROOT, iconExport);
  assert(existsSync(iconPath), `${iconExport} does not exist`);
  const size = statSync(iconPath).size;
  assert(size <= 256 * 1024, `icon is ${size} bytes, the loader limit is 262144`);
  const bytes = readFileSync(iconPath);
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isSvg = bytes.subarray(0, 64).toString('utf8').trimStart().startsWith('<svg');
  assert(isPng || isSvg, 'icon must be a PNG or an SVG document');
});

check('sprite: bundled assets match the embedded copies', () => {
  const layers = [
    ['BUILTIN_SPRITE', 'assets/firefly.webp'],
    ['BUILTIN_LEGS', 'assets/firefly-legs.webp'],
  ];
  const source = read('client.js');
  assert(source.includes('// #region sprite'), 'client.js is missing the sprite region marker');
  assert(source.includes('// #endregion sprite'), 'client.js is missing the sprite end marker');
  for (const [name, relative] of layers) {
    const assetPath = path.join(ROOT, relative);
    assert(existsSync(assetPath), `${relative} is missing`);
    const expected = `const ${name} = 'data:image/webp;base64,${readFileSync(assetPath).toString('base64')}'`;
    assert(source.includes(expected), `${name} is stale: run \`npm run sync-sprite\``);
  }
});

check('files: runtime files are shipped', () => {
  const files = manifest.files;
  assert(Array.isArray(files) && files.length > 0, 'files is required');
  const expanded = files.flatMap(expand);
  for (const required of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.png']) {
    assert(
      expanded.some((entry) => path.basename(entry) === required),
      `${required} must be listed in files`,
    );
  }
  assert(
    expanded.some((entry) => entry.endsWith('.json') && entry.includes('locale')),
    'locale JSON files must be listed in files',
  );
  for (const asset of ['firefly.webp', 'firefly-legs.webp']) {
    assert(
      expanded.some((entry) => entry.includes(asset)),
      `assets/${asset} must be listed in files`,
    );
  }
});

check('client: module loader contract', () => {
  const source = read('client.js');
  assert(source.includes('__ModuleLoader__.load'), 'client.js must call window.__ModuleLoader__.load');
  assert(source.includes(`id: '${manifest.name}'`), `client module id must be "${manifest.name}"`);
  assert(/factory\s*\(/.test(source), 'client module must expose a factory');
  assert(/shell\.overlay/.test(source), 'client must register into the shell.overlay slot');
  assert(/pointer-events:none!important/.test(source), 'the overlay root must not swallow pointer events');
});

check('syntax: JavaScript parses', () => {
  for (const file of ['index.js', 'client.js', ...listScripts('scripts')]) {
    syntaxCheck(file);
  }
});

function listScripts(directory) {
  const absolute = path.join(ROOT, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter((entry) => entry.endsWith('.mjs') || entry.endsWith('.js'))
    .map((entry) => path.join(directory, entry));
}

/**
 * `node --check` without capturing pipes: some sandboxes refuse to spawn a
 * child with piped stdio, so stderr goes through a temporary file instead.
 */
function syntaxCheck(relPath) {
  const absolute = path.join(ROOT, relPath);
  const logPath = path.join(os.tmpdir(), `dsh-firefly-check-${process.pid}-${Date.now()}.log`);
  let descriptor;
  try {
    descriptor = openSync(logPath, 'w');
  } catch {
    descriptor = undefined;
  }
  try {
    execFileSync(process.execPath, ['--check', absolute], {
      stdio: ['ignore', 'ignore', descriptor === undefined ? 'ignore' : descriptor],
    });
  } catch (error) {
    let detail = '';
    try {
      detail = readFileSync(logPath, 'utf8').trim();
    } catch {
      detail = String(error.message || error);
    }
    throw new Error(`${relPath} failed to parse: ${detail.split('\n').slice(0, 3).join(' ')}`);
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* already closed */
      }
    }
    try {
      unlinkSync(logPath);
    } catch {
      /* nothing to clean up */
    }
  }
}

for (const line of passed) console.log(`[ok]   ${line}`);
for (const line of failures) console.log(`[fail] ${line}`);
console.log(`\n${passed.length} passed, ${failures.length} failed`);

if (failures.length > 0) process.exitCode = 1;
