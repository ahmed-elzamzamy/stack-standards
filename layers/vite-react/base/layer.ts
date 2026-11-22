import type { Answers, CiStep, Layer, LintEntries } from '../../../src/layer.js'
import { layerDir } from '../../layerDir.js'
import { renderEnvExample } from './renderers/envExample.js'
import { renderMainTsx } from './renderers/mainTsx.js'
import { renderReadme } from './renderers/readme.js'
import { renderViteConfig } from './renderers/viteConfig.js'

/** Oldest supported LTS; bump when it reaches end of life (SPEC §5.1). */
const NODE_MAJOR = 22

const LINT: LintEntries = {
  files: ['**/*.{ts,tsx}'],
  ignores: ['dist'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
}

// The CI owner places these in its fixed order (SPEC §4.4).
const ciSteps = (answers: Answers): CiStep[] => {
  const run = (script: string) => (answers['package-manager'] === 'npm' ? `npm run ${script}` : `pnpm ${script}`)
  return [
    { id: 'typecheck', name: 'Typecheck', run: run('typecheck') },
    { id: 'build', name: 'Build', run: run('build') },
  ]
}

export const base: Layer = {
  concern: 'base',
  id: 'base',
  name: 'Vite + React',
  dir: layerDir(import.meta.url),
  contribute: (answers) => ({
    json: {
      'package.json': {
        engines: { node: `>=${NODE_MAJOR}` },
        scripts: { dev: 'vite', build: 'tsc -b && vite build', typecheck: 'tsc -b' },
      },
    },
    ci: ciSteps(answers),
    lint: LINT,
    platformRoot: 'src/platform',
  }),
  render: {
    '.env.example': renderEnvExample,
    '.nvmrc': () => `${NODE_MAJOR}\n`,
    'README.md': renderReadme,
    'src/main.tsx': renderMainTsx,
    'vite.config.ts': renderViteConfig,
  },
}
