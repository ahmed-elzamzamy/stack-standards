import { parseArgs } from 'node:util'

// One flag per prompt (SPEC §3.2). Value validation against the registry lands with the composer.
export const CONCERN_FLAGS = [
  'package-manager',
  'observability',
  'tracking',
  'translations',
  'linting',
  'package-security',
  'ci',
  'versioning',
] as const

export type ConcernFlag = (typeof CONCERN_FLAGS)[number]

export interface Flags {
  dir?: string
  projectType: string
  answers: Partial<Record<ConcernFlag, string | string[]>>
}

export function parseFlags(argv: string[]): Flags {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: Object.fromEntries(
      ['project-type', ...CONCERN_FLAGS].map((name) => [name, { type: 'string' as const }]),
    ),
  })
  if (positionals.length > 1) throw new Error(`Expected one target directory, got: ${positionals.join(' ')}`)

  const answers: Flags['answers'] = {}
  for (const flag of CONCERN_FLAGS) {
    const value = values[flag]
    if (typeof value !== 'string') continue
    // package-security is the one multiselect: a comma-separated list of gates.
    answers[flag] = flag === 'package-security' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value
  }

  return {
    dir: positionals[0],
    projectType: (values['project-type'] as string | undefined) ?? 'vite-react',
    answers,
  }
}
