import type { Answers, Collected, Project } from '../../../../src/layer.js'
import { reproducingCommand } from '../../../../src/reproduce.js'

const table = (header: string[], rows: string[][]) =>
  [header, header.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n')

/** Root `README.md`; sections in the SPEC §5.3 order. */
export function renderReadme({ readme }: Collected, answers: Answers, project: Project): string {
  const npm = answers['package-manager'] === 'npm'
  const run = (script: string) => (npm ? `npm run ${script}` : `${answers['package-manager']} ${script}`)
  const platform = readme.platform.length
    ? `${table(
        ['Concern', 'Tool', 'Folder'],
        readme.platform.map((r) => [r.concern, r.tool, `[${r.path}](${r.path})`]),
      )}\n\n`
    : ''
  const toolchain = readme.toolchain.length
    ? `\n${table(
        ['Concern', 'Tool', 'Files', 'Note'],
        readme.toolchain.map((r) => [r.concern, r.tool, r.files.map((f) => `\`${f}\``).join(', '), r.note ?? '']),
      )}\n`
    : ''

  return `# ${project.name}

## Getting started

\`\`\`sh
${npm ? 'npm install' : `${answers['package-manager']} install`}
${run('dev')}
${run('build')}
${run('typecheck')}
${run('lint')}
\`\`\`

## Platform

${platform}To add a skipped concern later, generate a scratch project with it and copy its folder in.

## Toolchain
${toolchain}
## Generated with

\`\`\`sh
${reproducingCommand(answers, project)}
\`\`\`

create-stack-standards ${project.cliVersion}
`
}
