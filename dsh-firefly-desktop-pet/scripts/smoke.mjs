#!/usr/bin/env node
/**
 * Browser-free behavioural test for the dsh-firefly client module.
 *
 * Runs client.js in a Node `vm` sandbox with a tiny fake DOM, a fake React and a
 * fake module loader, then drives the real pet component: render, click,
 * double-click, drag, settings menu, hide/show, and the pure helpers (white
 * background removal, menu placement). No browser and no Harness required.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const PICTURE = 'data:image/png;base64,AAAA';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------------ fake DOM ---

function createClassList() {
  const values = new Set();
  return {
    add: (name) => values.add(name),
    remove: (name) => values.delete(name),
    contains: (name) => values.has(name),
    toString: () => [...values].join(' '),
  };
}

function createDocument(styles) {
  return {
    documentElement: { classList: createClassList(), lang: 'en' },
    head: {
      appendChild(element) {
        styles.push(element);
        return element;
      },
    },
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        dataset: {},
        style: {},
        textContent: '',
        remove() {
          const index = styles.indexOf(this);
          if (index >= 0) styles.splice(index, 1);
        },
      };
    },
    querySelector(selector) {
      const match = /data-plugin-css="([^"]+)"/.exec(String(selector));
      if (!match) return null;
      return styles.find((element) => element.dataset.pluginCss === match[1]) || null;
    },
  };
}

function createElement(type, props, ...children) {
  const nextProps = { ...(props || {}) };
  if (children.length === 1) nextProps.children = children[0];
  else if (children.length > 1) nextProps.children = children;
  return { type, props: nextProps };
}

const React = {
  createElement,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial === undefined ? null : initial }),
};

function createEnv(seed) {
  const styles = [];
  const document = createDocument(styles);
  const storage = new Map(Object.entries(seed || {}));
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };

  let loaded = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (module) => {
          loaded = module;
        },
      },
      localStorage,
      innerWidth: 1000,
      innerHeight: 800,
    },
    document,
    navigator: { language: 'en-US' },
    setTimeout,
    clearTimeout,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'client.js' });
  assert(loaded, 'client.js never called window.__ModuleLoader__.load');

  const clientModule = loaded.factory((id) => {
    if (id === 'react') return React;
    throw new Error(`unexpected module request: ${id}`);
  });

  const registered = [];
  const disposers = [];
  const registrations = [];
  const ctx = {
    effect(fn) {
      const dispose = fn();
      if (typeof dispose === 'function') disposers.push(dispose);
      return dispose;
    },
    locale: {
      register(namespace, dictionaries) {
        registrations.push({ namespace, dictionaries });
        return () => {};
      },
      bind: () => (key) => key,
    },
    slots: {
      inject(_name, register) {
        register();
      },
      register(meta, component) {
        registered.push({ meta, component });
        return () => {};
      },
    },
  };

  clientModule.apply(ctx, {});

  function expand(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === 'function') return expand(node.type(node.props));
    const { props } = node;
    return { type: node.type, props: { ...props, children: expand(props.children) } };
  }

  function findAll(node, predicate, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
      for (const item of node) findAll(item, predicate, out);
      return out;
    }
    if (predicate(node)) out.push(node);
    findAll(node.props && node.props.children, predicate, out);
    return out;
  }

  return {
    document,
    storage,
    styles,
    registered,
    disposers,
    registrations,
    clientModule,
    internals: clientModule.__internals,
    render: () => expand(registered[0].component({})),
    css: () => {
      const tag = styles.find((element) => element.dataset.pluginCss === 'dsh-firefly/pet.css');
      return tag ? tag.textContent : '';
    },
    findAll,
    byAction: (tree, id) => findAll(tree, (node) => node.props && node.props['data-dshf-action'] === id)[0],
  };
}

const env = createEnv({
  'dsh-firefly.state.v1': JSON.stringify({
    x: 0.5,
    y: 0.5,
    size: 180,
    opacity: 100,
    cutout: true,
    imageRaw: null,
    imageCut: null,
    hidden: false,
  }),
});

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

const petOf = (tree) => env.findAll(tree, (node) => node.props && node.props['data-dshf-pet'] !== undefined)[0];
const bubbleOf = (tree) => env.findAll(tree, (node) => node.props && node.props.className === 'dshf-bubble')[0];

function pointerEvent(x, y) {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    currentTarget: {
      setPointerCapture() {},
      releasePointerCapture() {},
      parentElement: null,
    },
  };
}

// ---------------------------------------------------------------------- tests ---

test('loader: module id and factory', () => {
  assert(env.clientModule && typeof env.clientModule.apply === 'function', 'apply is missing');
});

test('plugin: declares the slots and locale services', () => {
  const inject = env.clientModule.inject;
  assert(Array.isArray(inject), 'inject is not an array');
  assert(inject.includes('slots'), 'slots is not injected');
  assert(inject.includes('locale'), 'locale is not injected');
});

test('plugin: registers into the shell overlay', () => {
  assert(env.registered.length === 1, `expected 1 registration, got ${env.registered.length}`);
  assert(env.registered[0].meta.name === 'shell.overlay', 'wrong slot name');
  assert(env.registered[0].meta.id === 'firefly', 'wrong slot id');
});

test('plugin: registers both locales', () => {
  assert(env.registrations.length === 1, 'locale dictionary was not registered');
  const { namespace, dictionaries } = env.registrations[0];
  assert(namespace === 'dsh-firefly', 'wrong locale namespace');
  assert(dictionaries.en && dictionaries.zh, 'both en and zh dictionaries are required');
  assert(dictionaries.zh.name === '流萤', 'zh dictionary lost the pet name');
});

test('style: overlay root never swallows pointer events', () => {
  const css = env.css();
  assert(css.length > 0, 'the pet stylesheet was not injected');
  assert(css.includes('.dshf-root{'), 'the root rule is missing');
  assert(/\.dshf-root\{[^}]*pointer-events:none!important/.test(css), 'the root must disable pointer events');
  assert(/\.dshf-pet\{[^}]*pointer-events:auto!important/.test(css), 'the pet must re-enable pointer events');
  assert(css.includes('@keyframes dshf-bob'), 'the idle float animation is missing');
  assert(css.includes('prefers-reduced-motion'), 'reduced motion is not respected');
  let depth = 0;
  for (const character of css) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    assert(depth >= 0, 'the stylesheet closes a block that was never opened');
  }
  assert(depth === 0, 'the stylesheet has unclosed blocks');
});

test('ui: renders the layered figure at the stored position', () => {
  const pet = petOf(env.render());
  assert(pet, 'the pet was not rendered');
  assert(pet.props.style.left === '50%', `unexpected left: ${pet.props.style.left}`);
  assert(pet.props.style.top === '50%', `unexpected top: ${pet.props.style.top}`);
  assert(pet.props.style.width === '180px', 'the stored size was not applied');
  assert(pet.props.role === 'button', 'the pet is not exposed as a button');
  assert(typeof pet.props['aria-label'] === 'string' && pet.props['aria-label'].length > 0, 'the pet has no label');
  assert(pet.props.className.includes('dshf-idle'), 'the pet does not start in the idle state');

  const stage = env.findAll(pet, (node) => node.props && node.props['data-dshf-stage'] !== undefined)[0];
  assert(stage, 'the layered stage is missing');

  const images = env.findAll(stage, (node) => node.type === 'img');
  assert(images.length === 2, `expected base + legs, got ${images.length} images`);
  const byClass = {};
  for (const image of images) byClass[image.props.className] = image.props.src;
  assert(byClass['dshf-base'] === env.internals.BUILTIN_SPRITE, 'the base layer is not the bundled one');
  assert(byClass['dshf-legs'] === env.internals.BUILTIN_LEGS, 'the legs layer is not the bundled one');
  for (const src of Object.values(byClass)) {
    assert(typeof src === 'string' && src.startsWith('data:image/webp;base64,'), 'a layer is not inlined');
  }
});

test('style: the idle leg swing is wired', () => {
  const css = env.css();
  assert(css.includes('.dshf-pet.dshf-idle .dshf-legs{animation-play-state:running}'), 'the idle leg swing is not gated');
  assert(css.includes('animation:dshf-swing'), 'the swing keyframes are not used');
  assert(css.includes('@keyframes dshf-swing'), 'the swing keyframes are missing');
  assert(css.includes('rotate(-3.2deg)') && css.includes('rotate(3.2deg)'), 'unexpected swing amplitude');
  assert(css.includes('transform-origin:48.6301% 21.0526%'), 'the legs pivot is not at the hip');
  assert(!css.includes('dshf-blink'), 'the removed blink layer still has styles');
});

test('ui: clicking reacts with a bubble', () => {
  let tree = env.render();
  const pet = petOf(tree);
  pet.props.onPointerDown(pointerEvent(500, 400));
  pet.props.onPointerUp(pointerEvent(500, 400));
  tree = env.render();
  const bubble = bubbleOf(tree);
  assert(bubble, 'no speech bubble after a click');
  assert(typeof bubble.props.children === 'string' && bubble.props.children.length > 0, 'the bubble is empty');
  assert(petOf(tree).props.className.includes('dshf-pop'), 'the click animation class is missing');
});

test('ui: double-click plays the special reaction', () => {
  const tree = env.render();
  petOf(tree).props.onDoubleClick();
  const next = env.render();
  assert(petOf(next).props.className.includes('dshf-spin'), 'the special animation class is missing');
  assert(bubbleOf(next), 'the special reaction has no bubble');
});

test('ui: dragging moves and persists the pet', async () => {
  let tree = env.render();
  const pet = petOf(tree);
  pet.props.onPointerDown(pointerEvent(400, 400));
  pet.props.onPointerMove(pointerEvent(700, 560));
  pet.props.onPointerUp(pointerEvent(700, 560));
  tree = env.render();
  const moved = petOf(tree);
  assert(moved.props.style.left === '70%', `drag left should be 70%, got ${moved.props.style.left}`);
  assert(moved.props.style.top === '70%', `drag top should be 70%, got ${moved.props.style.top}`);
  assert(!moved.props.className.includes('dshf-dragging'), 'the pet is still marked as dragging');
  await sleep(400);
  const stored = JSON.parse(env.storage.get('dsh-firefly.state.v1'));
  assert(Math.abs(stored.x - 0.7) < 1e-6, `stored x should be 0.7, got ${stored.x}`);
  assert(Math.abs(stored.y - 0.7) < 1e-6, `stored y should be 0.7, got ${stored.y}`);
});

test('ui: the menu resizes the pet', () => {
  let tree = env.render();
  petOf(tree).props.onContextMenu({ preventDefault() {} });
  tree = env.render();
  const size = env.findAll(tree, (node) => node.props && node.props['data-dshf-range'] === 'size')[0];
  assert(size, 'the size slider is missing from the menu');
  size.props.onChange({ currentTarget: { value: '240' } });
  tree = env.render();
  assert(petOf(tree).props.style.width === '240px', 'the new size was not applied');
});

test('ui: the menu can hide and restore the pet', () => {
  let tree = env.render();
  env.byAction(tree, 'hide').props.onClick();
  tree = env.render();
  assert(!petOf(tree), 'the pet is still rendered after hiding');
  const show = env.byAction(tree, 'show');
  assert(show, 'the restore tab is missing');
  show.props.onClick();
  tree = env.render();
  assert(petOf(tree), 'the pet did not come back');
});

test('image: white background is cut from the borders only', () => {
  const width = 3;
  const height = 3;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const white = index === 4;
    pixels[index * 4] = white ? 200 : 255;
    pixels[index * 4 + 1] = white ? 40 : 255;
    pixels[index * 4 + 2] = white ? 40 : 255;
    pixels[index * 4 + 3] = 255;
  }
  const cleared = env.internals.removeWhiteBackground(pixels, width, height, 32);
  assert(cleared === 8, `expected 8 cleared border pixels, got ${cleared}`);
  assert(pixels[4 * 4 + 3] === 255, 'the centre pixel was wrongly cleared');
  for (const index of [0, 1, 2, 3, 5, 6, 7, 8]) {
    assert(pixels[index * 4 + 3] === 0, `border pixel ${index} is still opaque`);
  }
});

test('image: menu placement flips below the pet near the top', () => {
  const top = env.internals.menuPlacement(0.5, 0.1, 180, { width: 1000, height: 800 });
  assert(top.below === true, 'the menu should open below a pet near the top');
  assert(top.transform === 'translate(-50%, 0)', 'unexpected transform for the below placement');
  const bottom = env.internals.menuPlacement(0.5, 0.8, 180, { width: 1000, height: 800 });
  assert(bottom.below === false, 'the menu should open above a pet near the bottom');
  const right = env.internals.menuPlacement(0.99, 0.8, 180, { width: 1000, height: 800 });
  assert(parseFloat(right.left) <= 1000 - 118, 'the menu is not clamped away from the right edge');
});

test('ui: a custom picture replaces the layered figure', async () => {
  const custom = createEnv({
    'dsh-firefly.state.v1': JSON.stringify({
      x: 0.5,
      y: 0.5,
      size: 200,
      opacity: 80,
      cutout: true,
      imageRaw: PICTURE,
      imageCut: PICTURE,
      hidden: false,
    }),
  });
  const tree = custom.render();
  const pet = custom.findAll(tree, (node) => node.props && node.props['data-dshf-pet'] !== undefined)[0];
  assert(pet.props.style.opacity === 0.8, 'the stored opacity was not applied');
  const images = custom.findAll(pet, (node) => node.type === 'img');
  assert(images.length === 1 && images[0].props.src === PICTURE, 'the custom picture is not rendered');
  const stage = custom.findAll(pet, (node) => node.props && node.props['data-dshf-stage'] !== undefined);
  assert(stage.length === 0, 'the layered figure should be replaced by a single picture');
  assert(custom.internals.BUILTIN_SPRITE.length > 10000, 'the bundled base layer is missing as a fallback');
});

test('dispose: removes the stylesheet and its timers', () => {
  for (const dispose of env.disposers) dispose();
  assert(env.styles.length === 0, `styles left behind: ${env.styles.length}`);
});

// --------------------------------------------------------------------- runner ---

let failures = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`[ok]   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`[fail] ${name}\n       ${error && error.message ? error.message : error}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} checks passed`);
if (failures > 0) process.exitCode = 1;
