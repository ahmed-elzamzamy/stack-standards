import { expect, test } from 'vitest'
import { collect } from '../../../../src/compose.js'
import type { Answers, Layer } from '../../../../src/layer.js'
import { renderMainTsx } from './mainTsx.js'

const answers = {} as Answers
const iface = (concern: 'observability' | 'tracking' | 'translations', entry: NonNullable<Layer['contribute']>) =>
  ({ concern, id: 'interface', name: concern, contribute: entry }) satisfies Layer

test('with no runtime concerns it renders a plain createRoot', () => {
  expect(renderMainTsx(collect([], answers))).toBe(`import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`)
})

test('renders init, awaited init, then createRoot with options and nested wrappers', () => {
  const layers = [
    // listed out of order on purpose: collect() sorts by concern
    iface('translations', () => ({
      entry: [
        { kind: 'awaitedInit', imports: [`import { i18n } from './platform/translations'`], code: 'i18n.init()' },
      ],
    })),
    iface('observability', () => ({
      entry: [
        {
          kind: 'init',
          imports: [`import { observability } from './platform/observability'`],
          code: 'observability.init()',
        },
        {
          kind: 'wrapper',
          imports: [`import { ErrorBoundary } from './platform/observability'`],
          code: 'ErrorBoundary',
        },
        { kind: 'rootOptions', imports: [], code: 'observability.rootOptions' },
      ],
    })),
    iface('tracking', () => ({
      entry: [{ kind: 'init', imports: [`import { tracking } from './platform/tracking'`], code: 'tracking.init()' }],
    })),
  ]
  expect(renderMainTsx(collect(layers, answers))).toBe(`import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './platform/observability'
import { i18n } from './platform/translations'
import { observability } from './platform/observability'
import { tracking } from './platform/tracking'

observability.init()
tracking.init()
await i18n.init()

createRoot(document.getElementById('root')!, observability.rootOptions).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
`)
})
