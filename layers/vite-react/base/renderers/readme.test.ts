import { expect, test } from 'vitest'
import { collect } from '../../../../src/compose.js'
import type { Answers, Project } from '../../../../src/layer.js'
import { renderReadme } from './readme.js'

const answers: Answers = {
  projectType: 'vite-react',
  'package-manager': 'pnpm',
  observability: 'sentry',
  tracking: 'none',
  translations: 'none',
  linting: 'biome',
  'package-security': ['audit', 'osv-scanner'],
  ci: 'github-actions',
  versioning: 'none',
}
const project: Project = { dir: 'my-app', name: 'my-app', cliVersion: '1.0.0' }
const command =
  'pnpm create stack-standards@1.0.0 my-app --project-type vite-react --package-manager pnpm --observability sentry --tracking none --translations none --linting biome --package-security audit,osv-scanner --ci github-actions --versioning none'

test('with no rows it renders the sections in order without tables', () => {
  const readme = renderReadme(collect([], answers), answers, project)
  expect(readme).toBe(`# my-app

## Getting started

\`\`\`sh
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
\`\`\`

## Platform

To add a skipped concern later, generate a scratch project with it and copy its folder in.

## Toolchain

## Generated with

\`\`\`sh
${command}
\`\`\`

create-stack-standards 1.0.0
`)
})

test('renders rows from readme contributions, with npm commands for npm', () => {
  const npm = { ...answers, 'package-manager': 'npm' }
  const collected = collect(
    [
      {
        concern: 'observability',
        id: 'sentry',
        name: 'Sentry',
        contribute: () => ({
          readme: { platform: { concern: 'Observability', tool: 'Sentry', path: 'src/platform/observability' } },
        }),
      },
      {
        concern: 'linting',
        id: 'biome',
        name: 'Biome',
        contribute: () => ({
          readme: { toolchain: { concern: 'Linting', tool: 'Biome', files: ['biome.json'], note: 'Formats too' } },
        }),
      },
    ],
    npm,
  )
  const readme = renderReadme(collected, npm, project)
  expect(readme).toContain('npm install\nnpm run dev\nnpm run build\nnpm run typecheck\nnpm run lint')
  expect(readme).toContain(
    '| Concern | Tool | Folder |\n| --- | --- | --- |\n| Observability | Sentry | [src/platform/observability](src/platform/observability) |',
  )
  expect(readme).toContain('| Linting | Biome | `biome.json` | Formats too |')
  expect(readme).toContain('npm create stack-standards@1.0.0 -- my-app --project-type vite-react --package-manager npm')
  expect(readme.indexOf('## Platform')).toBeLessThan(readme.indexOf('## Toolchain'))
  expect(readme.indexOf('## Toolchain')).toBeLessThan(readme.indexOf('## Generated with'))
})
