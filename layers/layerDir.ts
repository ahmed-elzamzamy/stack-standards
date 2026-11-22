import { fileURLToPath } from 'node:url'

/**
 * Absolute path of a layer's `files/` folder. `files/` is never compiled, so from the built
 * `dist/layers/…` it resolves to the copy that ships at the package root.
 */
export function layerDir(layerUrl: string): string {
  return fileURLToPath(new URL('files', layerUrl)).replace(/([/\\])dist\1layers\1/, '$1layers$1')
}
