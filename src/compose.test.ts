import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import { compose } from './compose.js'
import type { Answers, Layer } from './layer.js'
import { options, resolve } from './resolve.js'

const answers: Answers = {
  projectType: 'vite-react',
  'package-manager': 'pnpm',
  observability: 'sentry',
  tracking: 'none',
  translations: 'none',
  linting: 'biome',
  'package-security': ['audit'],
  ci: 'github-actions',
  versioning: 'none',
}

function dirWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'layer-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), body)
  }
  return dir
}

const layer = (concern: Layer['concern'], id: string, extra: Partial<Layer> = {}): Layer => ({
  concern,
  id,
  name: id,
  ...extra,
})

test('copies owned files, merges JSON with sorted deps, renders shared files', () => {
  const base = layer('base', 'base', {
    dir: dirWith({ 'package.json': '{"name":"app","dependencies":{"react":"^19.0.0"}}', 'src/App.tsx': 'app' }),
    contribute: () => ({ platformRoot: 'src/platform' }),
    render: { 'src/main.tsx': (c) => c.entry.map((e) => `${e.concern}:${e.code}`).join('\n') },
  })
  const tracking = layer('tracking', 'interface', {
    contribute: () => ({ entry: [{ kind: 'init', imports: [], code: 't()' }] }),
  })
  const sentry = layer('observability', 'sentry', {
    contribute: () => ({
      json: { 'package.json': { dependencies: { '@sentry/react': '^10.0.0' } } },
      importBans: ['@sentry/**', '@sentry/**'],
    }),
  })
  const obs = layer('observability', 'interface', {
    contribute: () => ({ entry: [{ kind: 'wrapper', imports: [], code: 'ErrorBoundary' }] }),
  })
  const linter = layer('linting', 'biome', { render: { 'biome.json': (c) => c.importBans.join(',') } })

  const tree = compose([base, tracking, sentry, obs, linter], answers)

  expect([...tree.keys()]).toEqual(['biome.json', 'package.json', 'src/App.tsx', 'src/main.tsx'])
  expect(JSON.parse(tree.get('package.json')!).dependencies).toEqual({ '@sentry/react': '^10.0.0', react: '^19.0.0' })
  expect(Object.keys(JSON.parse(tree.get('package.json')!).dependencies)).toEqual(['@sentry/react', 'react'])
  expect(tree.get('src/main.tsx')).toBe('observability:ErrorBoundary\ntracking:t()') // fixed concern order
  expect(tree.get('biome.json')).toBe('@sentry/**') // deduped
  expect(compose([base, tracking, sentry, obs, linter], answers)).toEqual(tree) // deterministic
})

test('collisions throw', () => {
  const a = layer('base', 'base', { dir: dirWith({ 'x.txt': 'a' }) })
  const b = layer('linting', 'biome', { dir: dirWith({ 'x.txt': 'b' }) })
  expect(() => compose([a, b], answers)).toThrow(/x.txt is owned by both base\/base and linting\/biome/)

  const json = (v: string) => layer('base', v, { contribute: () => ({ json: { 'package.json': { engines: { node: v } } } }) })
  expect(() => compose([json('>=22'), json('>=22')], answers)).not.toThrow()
  expect(() => compose([json('>=22'), json('>=24')], answers)).toThrow(/package.json > engines > node/)

  const env = (description: string) => layer('base', description, { contribute: () => ({ env: [{ key: 'VITE_X', description }] }) })
  expect(() => compose([env('a'), env('b')], answers)).toThrow(/env key VITE_X/)

  const root = (id: string) => layer('observability', id, { contribute: () => ({ entry: [{ kind: 'rootOptions', imports: [], code: '{}' }] }) })
  expect(() => compose([root('a'), root('b')], answers)).toThrow(/rootOptions/)

  const renders = (id: string) => layer('linting', id, { render: { 'biome.json': () => '' } })
  expect(() => compose([renders('a'), renders('b')], answers)).toThrow(/biome.json is owned by both/)
})

const registry: Layer[] = [
  layer('base', 'base'),
  layer('package-manager', 'pnpm'),
  layer('observability', 'interface'),
  layer('observability', 'sentry', { name: 'Sentry' }),
  layer('observability', 'datadog', { name: 'Datadog' }),
  layer('tracking', 'interface'),
  layer('translations', 'interface'),
  layer('linting', 'biome'),
  layer('package-security', 'audit'),
  layer('package-security', 'osv-scanner'),
  layer('ci', 'github-actions'),
  layer('ci', 'gitlab-ci'),
  layer('versioning', 'release-please', { ci: ['github-actions'] }),
]

test('options: alphabetical, None last, incompatible tools hidden', () => {
  expect(options(registry, 'observability').map((o) => o.id)).toEqual(['datadog', 'sentry', 'none'])
  expect(options(registry, 'linting').map((o) => o.id)).toEqual(['biome'])
  expect(options(registry, 'versioning', 'gitlab-ci').map((o) => o.id)).toEqual(['none'])
})

test('resolve picks layers in order and rejects bad answers', () => {
  const flags = { projectType: 'vite-react', answers: { ...answers, 'package-security': ['audit', 'osv-scanner'] } }
  expect(resolve(registry, flags).layers.map((l) => `${l.concern}/${l.id}`)).toEqual([
    'base/base',
    'package-manager/pnpm',
    'observability/interface',
    'observability/sentry',
    'linting/biome',
    'package-security/audit',
    'package-security/osv-scanner',
    'ci/github-actions',
  ])

  const bad = (patch: object) => () => resolve(registry, { projectType: 'vite-react', answers: { ...answers, ...patch } })
  expect(bad({ observability: 'nope' })).toThrow(/--observability nope is not one of: datadog, sentry, none/)
  expect(bad({ observability: 'interface' })).toThrow(/is not one of/)
  expect(bad({ 'package-security': [] })).toThrow(/at least one gate/)
  expect(bad({ ci: 'gitlab-ci', versioning: 'release-please' })).toThrow(/doesn't support --ci gitlab-ci/)
  expect(bad({ linting: undefined })).toThrow(/Missing values for: --linting/)
})
