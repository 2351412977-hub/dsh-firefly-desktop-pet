# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] — 2026-10-26

### Changed

- The idle leg swing is a little wider: ±3.2° instead of ±1.8°, on a slightly
  quicker 3.4 s cycle.

### Removed

- The blink effect, together with `assets/firefly-blink.webp`, the closed-eye
  layer, its timer loop and the `blinking` UI state. The figure is back to two
  layers (base + legs).

## [1.2.0] — 2026-10-26

### Added

- **Idle leg swing.** The figure is now split into a base image with the legs
  cut away and a separate legs layer, positioned over that hole and rotated
  around the hip. The swing runs only while the pet is idle (no drag, no
  reaction) and is disabled by `prefers-reduced-motion`.
- **Blinking.** A closed-eye patch of the same artwork sits over the face and is
  cross-faded for ~110 ms every 2.4–6 s, driven by a small timer loop.

### Changed

- The bundled art is now three aligned assets (`firefly.webp`,
  `firefly-legs.webp`, `firefly-blink.webp`) inlined together by
  `npm run sync-sprite`; the validator checks all three.
- `LAYERED_FIGURE` in `client.js` turns the layered figure off, for anyone who
  replaces the artwork with a single image.
- Uploaded pictures still render as one image, so they get the float, bounce and
  spin but not the leg swing or blink.

## [1.1.0] — 2026-10-26

### Changed

- The bundled character art is now the supplied Firefly sprite instead of the
  original vector mascot. It is cut out of its white background, trimmed to
  392×531, stored as `assets/firefly.webp` and inlined into the Client module.
- The plugin icon is a head crop of the sprite (`icon.png`), and the preview
  image is rendered from the same asset.
- Blink and wing animations were removed together with the vector artwork; the
  pet keeps the float, bounce and spin around the picture.

### Added

- `npm run sync-sprite` re-embeds the asset into `client.js`, and the validator
  fails when the embedded copy is stale.
- `NOTICE.md`, recording that the character art is fan work and stays outside
  the MIT licence.

## [1.0.0] — 2026-10-26

### Added

- Desk pet in the `shell.overlay` slot: an original inline-SVG chibi mascot with
  CSS-driven float, wing pulse and blink, rendered above the interface without
  blocking pointer events elsewhere.
- Interactions: click / <kbd>Enter</kbd> for a bounce and a speech bubble,
  double-click for a special reaction, drag to move with the position stored as
  a window fraction, and an idle sleep state after 45 seconds.
- Right-click settings menu: size (120–320 px), opacity (35–100 %), white
  background removal, reset, and hide with a restore tab at the screen edge.
- Custom pictures: uploaded images are downscaled in the browser, optionally cut
  out of their white background with an edge flood fill, and stored locally.
- English and Chinese copy for every line and label, following the UI language.
- Zero-dependency validation (`scripts/validate.mjs`) and a browser-free
  behavioural test (`scripts/smoke.mjs`).
- GitHub Actions: CI on push/pull request, release workflow on `v*` tags that
  builds a zip and an npm tarball.

[Unreleased]: https://github.com/OWNER/dsh-firefly/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/OWNER/dsh-firefly/releases/tag/v1.3.0
[1.2.0]: https://github.com/OWNER/dsh-firefly/releases/tag/v1.2.0
[1.1.0]: https://github.com/OWNER/dsh-firefly/releases/tag/v1.1.0
[1.0.0]: https://github.com/OWNER/dsh-firefly/releases/tag/v1.0.0
