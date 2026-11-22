import { expect, test } from 'vitest'
import type { Answers } from './layer.js'
import { reproducingCommand } from './reproduce.js'

const answers: Answers = {
  projectType: 'vite-react',
  'package-manager': 'npm',
  observability: 'sentry',
  tracking: 'none',
  translations: 'none',
  linting: 'biome',
  'package-security': ['audit', 'osv-scanner'],
  ci: 'github-actions',
  versioning: 'none',
}

test('lists every flag, with -- for npm', () => {
  expect(reproducingCommand(answers, { dir: 'app', name: 'app', cliVersion: '1.0.0' })).toBe(
    'npm create stack-standards@1.0.0 -- app --project-type vite-react --package-manager npm --observability sentry --tracking none --translations none --linting biome --package-security audit,osv-scanner --ci github-actions --versioning none',
  )
})
