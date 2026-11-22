import { CONCERN_FLAGS } from './args.js'
import type { Answers, Project } from './layer.js'

/** The command that regenerates this project (SPEC §3.5): every flag, the CLI version pinned. */
export function reproducingCommand(answers: Answers, project: Project): string {
  const npm = answers['package-manager'] === 'npm'
  const flags = [
    `--project-type ${answers.projectType}`,
    ...CONCERN_FLAGS.map((flag) => {
      const value = answers[flag]
      return `--${flag} ${Array.isArray(value) ? value.join(',') : value}`
    }),
  ]
  const head = `${answers['package-manager']} create stack-standards@${project.cliVersion}${npm ? ' --' : ''}`
  return [head, project.dir, ...flags].join(' ')
}
