import type { Layer } from '../../src/layer.js'
import { base } from './base/layer.js'

/** Every layer the vite-react project type offers (SPEC §4.2). Adding one is one line. */
export const registry: Layer[] = [base]
