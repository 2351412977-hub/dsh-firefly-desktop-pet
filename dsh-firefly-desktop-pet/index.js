/**
 * Host half of the dsh-firefly bundle.
 *
 * The pet is a browser-only overlay: it renders in the `shell.overlay` slot,
 * animates with CSS, and keeps its own state in `localStorage`. Nothing on the
 * Host side needs to run, so this module intentionally registers nothing — it
 * exists so the bundle has a package-root plugin that `cordis.patch.yml` can
 * insert.
 *
 * @see client.js for the Client half (`dsh.client` entry).
 */
export function apply() {}
