import type { Collected } from '../../../../src/layer.js'

const BASE_IMPORTS = [
  `import { StrictMode } from 'react'`,
  `import { createRoot } from 'react-dom/client'`,
  `import './index.css'`,
  `import App from './App.tsx'`,
]

/** `src/main.tsx` from entry contributions, in the SPEC §4.5 order. */
export function renderMainTsx({ entry }: Collected): string {
  const ofKind = (kind: string) => entry.filter((e) => e.kind === kind)
  const imports = [...BASE_IMPORTS, ...[...new Set(entry.flatMap((e) => e.imports))].sort()]
  const rootOptions = ofKind('rootOptions')[0]?.code
  const wrappers = ofKind('wrapper').map((w) => w.code)

  const calls = [...ofKind('init').map((e) => e.code), ...ofKind('awaitedInit').map((e) => `await ${e.code}`)]

  // StrictMode stays outermost, as in create-vite; wrappers nest inside it in concern order.
  const tags = ['StrictMode', ...wrappers]
  const open = tags.map((tag, i) => `${'  '.repeat(i + 1)}<${tag}>`)
  const close = tags.map((tag, i) => `${'  '.repeat(i + 1)}</${tag}>`).reverse()
  const app = `${'  '.repeat(tags.length + 1)}<App />`

  return [
    `${imports.join('\n')}\n`,
    ...(calls.length ? [`${calls.join('\n')}\n`] : []),
    `createRoot(document.getElementById('root')!${rootOptions ? `, ${rootOptions}` : ''}).render(`,
    `${[...open, app, ...close].join('\n')},`,
    `)\n`,
  ].join('\n')
}
