import { expect, test } from 'vitest'
import { parseFlags } from './args.js'

test('parses dir, concern flags and the package-security list', () => {
  expect(
    parseFlags(['my-app', '--observability', 'sentry', '--package-security', 'audit, osv-scanner']),
  ).toEqual({
    dir: 'my-app',
    projectType: 'vite-react',
    answers: { observability: 'sentry', 'package-security': ['audit', 'osv-scanner'] },
  })
})

test('rejects unknown flags and extra positionals', () => {
  expect(() => parseFlags(['--yes'])).toThrow()
  expect(() => parseFlags(['a', 'b'])).toThrow(/one target directory/)
})
