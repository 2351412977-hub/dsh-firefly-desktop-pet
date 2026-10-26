# Contributing

Thanks for taking a look. This is a small, dependency-free plugin; the bar is
"works in the real Web UI and is genuinely cute."

## Ground rules

- **No build step, no runtime dependencies.** `client.js` is served to the
  browser as-is and must stay a single classic script that calls
  `window.__ModuleLoader__.load`. Do not add imports, bundlers, or npm packages
  to the runtime files.
- **Never block the interface.** The overlay root keeps
  `pointer-events: none !important`; only the pet, its bubble and its menu may
  opt back in. A regression here makes the whole app unclickable.
- **Own everything you create.** Styles, timers, document listeners and drag
  state are created inside `ctx.effect` and removed by the returned disposer.
- **Artwork stays opt-in and documented.** `assets/firefly.webp` is fan art
  bundled by the repository owner; it is not MIT-licensed and is recorded in
  `NOTICE.md`. Do not add further game assets, models, audio or rips, and never
  commit pictures a user uploaded at runtime (those live in `localStorage`).
- **Only documented contracts.** Use `ctx.slots`, `ctx.locale`, `ctx.effect` and
  the `--dsw-alias-*` tokens. Do not import Harness client packages or read
  another plugin's DOM.

## Before opening a pull request

```bash
npm run check
```

Both scripts must pass. If you change the manifest, the patch, the locales or
the icon, re-read the checks in `scripts/validate.mjs` — they encode the
contract the DSH plugin loader relies on.

If you touched the artwork or the layout, describe what you checked on a running
client: light and dark theme, a small and a large size, dragging to every
corner, and the bubble near the top edge.

## Style

- 2-space indentation, single quotes, semicolons.
- Keep user-facing copy in the `TEXT` / `LINES` dictionaries; do not hard-code
  strings in components.
- Keep SVG animation in CSS and React out of the per-frame path: the component
  should toggle classes, not re-render on every blink.
- Prefer `--dsw-*` tokens over literal colours; literal colours are only for
  the mascot artwork.

## Reporting bugs

Include the Harness version, the bundle version, the platform, and what you
expected. A screen recording helps a lot for a motion-heavy plugin.

## Release flow

Maintainers bump `version` in `package.json`, add a `CHANGELOG.md` entry, tag
`vX.Y.Z`, and push the tag; the release workflow publishes the assets. See
[`docs/PUBLISHING.md`](docs/PUBLISHING.md).
