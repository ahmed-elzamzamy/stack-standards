import { expect, test } from 'vitest'
import { compose } from '../../../src/compose.js'
import type { Answers } from '../../../src/layer.js'
import { registry } from '../index.js'
import { base } from './layer.js'

const answers: Answers = {
  projectType: 'vite-react',
  'package-manager': 'npm',
  observability: 'none',
  tracking: 'none',
  translations: 'none',
  linting: 'biome',
  'package-security': ['audit'],
  ci: 'github-actions',
  versioning: 'none',
}
const project = { dir: 'app', name: 'app', cliVersion: '0.0.0' }

test('the registry lists the base', () => {
  expect(registry).toEqual([base])
})

test('contributes scripts, engines, CI steps, lint entries and the platform root', () => {
  const c = base.contribute?.(answers)
  expect(c?.json?.['package.json']).toEqual({
    engines: { node: '>=22' },
    scripts: { dev: 'vite', build: 'tsc -b && vite build', typecheck: 'tsc -b' },
  })
  expect(c?.ci).toEqual([
    { id: 'typecheck', name: 'Typecheck', run: 'npm run typecheck' },
    { id: 'build', name: 'Build', run: 'npm run build' },
  ])
  expect(c?.platformRoot).toBe('src/platform')
  expect(c?.lint?.rules).toHaveProperty('react-hooks/rules-of-hooks')
  expect(base.contribute?.({ ...answers, 'package-manager': 'pnpm' }).ci?.[0]?.run).toBe('pnpm typecheck')
})

test('composes the snapshot plus rendered files, without .env.example when there are no keys', () => {
  const tree = compose([base], answers, project)
  expect([...tree.keys()]).toEqual([
    '.gitignore',
    '.nvmrc',
    'README.md',
    'index.html',
    'package.json',
    'public/favicon.svg',
    'public/icons.svg',
    'src/App.css',
    'src/App.tsx',
    'src/assets/hero.png',
    'src/assets/react.svg',
    'src/assets/vite.svg',
    'src/index.css',
    'src/main.tsx',
    'tsconfig.app.json',
    'tsconfig.json',
    'tsconfig.node.json',
    'vite.config.ts',
  ])
  expect(tree.get('.nvmrc')).toBe('22\n')
  const pkg = JSON.parse(tree.get('package.json') ?? '{}')
  expect(pkg.engines).toEqual({ node: '>=22' })
  expect(Object.keys(pkg.scripts)).toEqual(['dev', 'build', 'preview', 'typecheck'])
  expect(Number.parseInt(pkg.dependencies.react.replace(/^\D+/, ''), 10)).toBeGreaterThanOrEqual(19)
})
