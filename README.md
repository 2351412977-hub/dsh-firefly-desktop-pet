# dsh-firefly

An interactive desk pet for the **DeepSeek Harness Web UI** — a little firefly
girl who floats over the interface, reacts when you click her, says something
now and then, and can be dragged anywhere.

![The bundled sprite on the light and dark themes](docs/preview.png)

`dsh-firefly` is a normal DSH plugin bundle: no build step, no runtime
dependencies, no network access, and no patching of the Harness source. It
renders into the `shell.overlay` slot, so it sits above the interface without
blocking clicks anywhere else.

> Status: v1.3.0. The manifest, the overlay contract, the interaction state
> machine, the image pipeline, the sprite/asset sync and the teardown path are
> covered by the repository's tests. See [Verification](#verification) for what
> still needs a pair of eyes.

---

## Features

| | |
|---|---|
| **Bundled sprite** | The character art is bundled as transparent WebPs and inlined into the Client module, so she renders at any size without a network request. She bobs, bounces and spins with CSS around the picture. |
| **Idle leg swing** | When nothing is happening, her legs swing gently from the hip (±3.2°) — a separate layer, so the rest of the drawing never warps. Dragging or a reaction pauses it. |
| **Click to interact** | Click (or press Enter/Space) → bounce + a speech bubble with one of the pet's lines. Double-click → a special reaction. |
| **Drag anywhere** | Drag her around; the position is remembered as a fraction of the window, so it survives resizes and restarts. |
| **Speaks your language** | Lines follow the Harness UI language (English / 中文). |
| **Falls asleep** | After 45 s without interaction she dozes off and dims. Any click wakes her. |
| **Right-click settings** | Size (120–320 px), opacity (35–100 %), white-background removal, reset, and hide (leaves a small restore tab at the screen edge). |
| **Bring your own picture** | Upload any image: it is downscaled in the browser and can be cut out of a white background, so sticker-style art drops cleanly onto light and dark themes. |
| **Stays out of the way** | The overlay root keeps `pointer-events: none`; only the pet, its bubble and its menu are interactive. Respects `prefers-reduced-motion`. |
| **All local** | Position and pictures live in `localStorage`. Nothing is uploaded anywhere. |

![The idle swing, left to right](docs/effects.png)

---

## Install

1. Open **Plugins** in the sidebar.
2. Press the arrow next to **Add plugin** and choose **Install a third-party plugin**.
3. Enter one of:
   - **Local directory** — the folder you cloned/downloaded this repository into.
   - **Git repository** — `https://github.com/OWNER/dsh-firefly.git` (replace `OWNER`; see [`docs/PUBLISHING.md`](docs/PUBLISHING.md)).
4. Make sure the **dsh-firefly** bundle is switched **on**.

She appears in the lower-right corner of the interface. If nothing shows up,
restart DeepSeek Harness once so the new Client module is loaded.

To remove: **Plugins → dsh-firefly → Remove**, then restart.

### Requirements

- A DeepSeek Harness build with the Web UI (`0.2.x` client packages).
- Any Chromium-based WebView; the desktop app is enough.

---

## Use

| Action | What happens |
|---|---|
| Click / <kbd>Enter</kbd> / <kbd>Space</kbd> | She bounces and says something. |
| Double-click | Special reaction (a spin and one of her rarer lines). |
| Drag | Moves her; the spot is remembered. |
| Right-click | Opens the settings menu. |
| <kbd>Esc</kbd> | Closes the menu. |

### Settings menu

| Control | Default | Range | Notes |
|---|---|---|---|
| Size | 180 px | 120–320 | Rendered width; the height follows the artwork. |
| Opacity | 100 % | 35–100 | Useful when she should stay subtle. |
| Cut out white background | On | On / Off | Applied to the **next** picture you upload. |
| Choose / Replace picture | — | — | Any `image/*` file. Downscaled to ≤640 px and stored as PNG. |
| Use the built-in mascot | — | — | Drops the uploaded picture. |
| Reset | — | — | Restores position, size, opacity and mascot. |
| Hide pet | — | — | Leaves a small tab on the right edge; click it to bring her back. |

### Using your own picture

Press **Choose picture** and pick an image. The pet keeps the same float, bounce
and drag behaviour; only the artwork changes.

Anime-style sticker art usually has a white background. With **Cut out white
background** enabled, the plugin flood-fills the connected white area from the
picture's edges and makes it transparent — only the border-connected background
goes away, so white details inside the character (sleeves, shoes) survive.

The picture is resized to at most 640 px, converted to PNG, and kept in this
browser's `localStorage`. Official game art is copyrighted: the repository ships
none of it, and anything you upload stays on your machine.

---

## How it works

```
cordis.patch.yml        bundle patch: inserts the `dsh-firefly` plugin row
index.js                Host half — intentionally empty (the pet is browser-only)
client.js               Client half — overlay pet, interactions, image pipeline
assets/firefly.webp     base figure, legs cut away (392×531)
assets/firefly-legs.webp  the legs, rotated for the idle swing (146×95)
scripts/sync-sprite.mjs inlines those two assets into client.js
locale/{en,zh}.json     display metadata read by the plugin manager without activating
icon.png                plugin icon (head crop of the sprite)
docs/preview.png        the sprite rendered on both themes
```

The Client half registers one `shell.overlay` entry and owns a single
`<style>` element. Four details make it behave:

1. **The overlay stays click-through.** The layout renders the overlay layer with
   `pointer-events: none` but forces `pointer-events: auto` on its direct
   children, so the plugin's root re-disables them and only the pet, bubble and
   menu opt back in.
2. **The figure is layered.** The base image has the legs erased; the legs layer
   is absolutely positioned over that hole and rotates around the hip
   (`transform-origin: 48.63% 21.05%` of its own box), so the swing never warps
   the rest of the drawing and the seam stays under the coat.
3. **Everything is inlined, nothing is fetched.** `scripts/sync-sprite.mjs`
   turns both assets into data URLs inside `client.js`, so the pet renders
   even if the plugin's sibling files are not served to the browser.
4. **Position is a fraction, not pixels.** `x`/`y` are stored in `0..1` and
   applied as percentages, so the pet keeps its corner when the window is
   resized. Dragging clamps them to `0.04..0.96`.

State is kept in one module-level store. The component subscribes to it, the
pointer handlers commit into it, and everything the plugin creates — styles,
timers, listeners, drag state — is created inside `ctx.effect`, so disabling the
bundle leaves nothing behind.

`localStorage` key: `dsh-firefly.state.v1`.

---

## Verification

`node scripts/validate.mjs` checks the bundle contract (patch, `dsh.client`
entry, exports, `files`, icon, locale metadata) and the JavaScript syntax.

`node scripts/smoke.mjs` runs the real `client.js` in a Node `vm` sandbox with a
fake DOM, fake React and fake module loader, then:

- asserts the overlay slot registration and both locale dictionaries;
- asserts the stylesheet keeps the root click-through, gates the leg swing on the
  idle class, pivots it at the hip, respects reduced motion, and has balanced
  blocks;
- renders the layered figure (base + legs) at the stored position;
- clicks it and checks the bubble and bounce class;
- double-clicks and checks the special reaction;
- drags it and checks the persisted fraction;
- opens the menu, resizes the pet, hides and restores it;
- renders a custom picture instead of the layered figure;
- unit-tests the border flood fill (background cleared, interior kept) and the
  menu placement clamps;
- disposes and confirms the stylesheet and timers are gone.

What the tests cannot cover: how the pet actually looks and feels on a running
client — the swing amplitude, bubble placement, contrast on both themes. That
needs a Harness instance with the bundle installed; the manual checklist is in
[`docs/PUBLISHING.md`](docs/PUBLISHING.md), section 6.

---

## Development

```bash
node scripts/validate.mjs   # manifest + syntax checks
node scripts/smoke.mjs      # behaviour in a fake DOM
npm run check               # both
```

Node 18+ is enough; there is nothing to install and nothing to build. Edit
`client.js`, reinstall the bundle (or restart Harness) and the new client module
loads.

### Replacing the bundled art

The figure is two aligned images. Replacing only `assets/firefly.webp` would
leave the old legs floating in the wrong place, so pick one:

**Option A — keep the layers.** Replace both files and keep the same geometry
(the percentages in the CSS assume the 392×531 base and the legs box noted
above):

```bash
npm run sync-sprite   # re-embed both into client.js
npm run check         # validate that the embedded copies match the assets
```

**Option B — drop the layers.** Replace `assets/firefly.webp` with any
transparent PNG/WebP and set `LAYERED_FIGURE = false` in `client.js`. The pet
then draws the single image; the float, bounce, spin and drag still work, but the
leg swing is off.

The sprite is drawn to the pet's width, so any aspect ratio works; a transparent
background is expected (the menu's automatic cut-out only applies to pictures you
upload at runtime).

### Release

See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) (Chinese) for repository setup,
tagging and what the release workflow produces.

---

## License and fan-work notice

The **code** is [MIT](LICENSE).

The **character sprite** (`assets/*.webp`, `icon.png`, `docs/preview.png`)
is fan work based on Firefly from *Honkai: Star Rail*; the character and the
original artwork belong to HoYoverse / miHoYo. It is bundled here at the
repository owner's request for personal, non-commercial fan use and is **not**
covered by the MIT licence. See [NOTICE.md](NOTICE.md).

This is an unofficial fan plugin, not affiliated with or endorsed by HoYoverse or
the DeepSeek Harness project. Before publishing your own fork, either confirm you
have the rights to redistribute the artwork, or swap in art you own (see
[Replacing the bundled art](#replacing-the-bundled-art)).

Pictures you upload through the pet's menu never leave your browser; they are
stored in `localStorage` and are not part of this repository.
