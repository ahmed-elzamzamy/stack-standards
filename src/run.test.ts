import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { base } from '../layers/vite-react/base/layer.js'
import type { Layer } from './layer.js'
import { generate, writeTree } from './run.js'

const stub = (concern: Layer['concern'], id: string): Layer => ({ concern, id, name: id })
const registry: Layer[] = [
  base,
  stub('package-manager', 'pnpm'),
  stub('linting', 'biome'),
  stub('package-security', 'audit'),
  stub('ci', 'github-actions'),
  stub('observability', 'interface'),
  stub('observability', 'sentry'),
  stub('tracking', 'interface'),
  stub('translations', 'interface'),
  stub('versioning', 'changesets'),
]
const flags = [
  '--package-manager pnpm --observability none --tracking none --translations none',
  '--linting biome --package-security audit --ci github-actions --versioning none',
]
  .join(' ')
  .split(' ')

test('generates a tree from a full flag set and writes it to the directory', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'out-')), 'my-app')
  const result = generate([dir, ...flags], registry, '1.2.3')
  expect(result.dir).toBe(dir)
  writeTree(dir, result.tree)
  expect(readFileSync(join(dir, '.nvmrc'), 'utf8')).toBe('22\n')
  expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('# my-app')
  expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('stack-standards@1.2.3')
  expect(existsSync(join(dir, '.gitignore'))).toBe(true)
})

test('a missing flag fails with the list of missing flags', () => {
  expect(() => generate(['app', '--package-manager', 'pnpm'], registry, '0.0.0')).toThrow(
    'Missing values for: --observability, --tracking, --translations, --linting, --package-security, --ci, --versioning',
  )
  expect(() => generate(flags, registry, '0.0.0')).toThrow(/Missing values for: <dir>/)
})

test('refuses a directory that holds anything but .git', () => {
  const { tree } = generate(['app', ...flags], registry, '0.0.0')
  const dir = mkdtempSync(join(tmpdir(), 'out-'))
  mkdirSync(join(dir, '.git'))
  expect(() => writeTree(dir, tree)).not.toThrow()
  const full = mkdtempSync(join(tmpdir(), 'out-'))
  writeFileSync(join(full, 'x'), '')
  expect(() => writeTree(full, tree)).toThrow(`${full} is not empty`)
})
