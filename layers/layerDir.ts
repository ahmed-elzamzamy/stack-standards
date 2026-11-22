import { fileURLToPath } from 'node:url'

export function layerDir(layerUrl: string): string {
  return fileURLToPath(new URL('files', layerUrl)).replace(/([/\\])dist\1layers\1/, '$1layers$1')
}
