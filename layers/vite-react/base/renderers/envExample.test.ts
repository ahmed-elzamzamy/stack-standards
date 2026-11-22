import { expect, test } from 'vitest'
import { collect } from '../../../../src/compose.js'
import type { Answers, Layer } from '../../../../src/layer.js'
import { renderEnvExample } from './envExample.js'

const withEnv = (env: NonNullable<ReturnType<NonNullable<Layer['contribute']>>['env']>) =>
  collect([{ concern: 'base', id: 'x', name: 'x', contribute: () => ({ env }) }], {} as Answers)

test('is not written when there are no env keys', () => {
  expect(renderEnvExample(withEnv([]))).toBeNull()
})

test('puts a description comment above each key, sorted by key', () => {
  expect(
    renderEnvExample(
      withEnv([
        { key: 'VITE_SENTRY_DSN', description: 'Sentry DSN' },
        { key: 'VITE_POSTHOG_HOST', description: 'PostHog host', example: 'https://eu.i.posthog.com' },
      ]),
    ),
  ).toBe('# PostHog host\nVITE_POSTHOG_HOST=https://eu.i.posthog.com\n# Sentry DSN\nVITE_SENTRY_DSN=\n')
})
