import { CONCERN_FLAGS, type ConcernFlag, type Flags } from './args.js'
import { type Answers, INTERFACE, type Layer, NONE, RUNTIME_CONCERNS, SKIPPABLE } from './layer.js'

export interface Option {
  id: string
  name: string
  hint?: string
}

/**
 * Menu for one concern (SPEC §3.3): alphabetical by name, "None" last for skippable concerns,
 * tools that don't support the chosen CI hidden. Also the source of truth for flag validation.
 */
export function options(registry: Layer[], concern: ConcernFlag, ci?: string): Option[] {
  const tools = registry
    .filter((l) => l.concern === concern && l.id !== INTERFACE)
    .filter((l) => !ci || !l.ci || l.ci.includes(ci))
    .map(({ id, name, hint }) => ({ id, name, ...(hint && { hint }) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return SKIPPABLE.includes(concern) ? [...tools, { id: NONE, name: 'None' }] : tools
}

/** Validates complete flags and returns the answers plus the layers to compose, in composition order. */
export function resolve(registry: Layer[], flags: Flags): { answers: Answers; layers: Layer[] } {
  const missing = CONCERN_FLAGS.filter((f) => flags.answers[f] === undefined)
  if (missing.length) throw new Error(`Missing values for: ${missing.map((f) => `--${f}`).join(', ')}`)

  const errors: string[] = []
  const ci = flags.answers.ci as string
  for (const flag of CONCERN_FLAGS) {
    const value = flags.answers[flag] ?? []
    const picked = Array.isArray(value) ? value : [value]
    if (flag === 'package-security' && picked.length === 0) errors.push('--package-security needs at least one gate')
    const valid = options(registry, flag, flag === 'versioning' ? ci : undefined).map((o) => o.id)
    for (const id of picked) {
      if (valid.includes(id)) continue
      const all = options(registry, flag).map((o) => o.id)
      errors.push(
        all.includes(id)
          ? `--${flag} ${id} doesn't support --ci ${ci}`
          : `--${flag} ${id} is not one of: ${all.join(', ')}`,
      )
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))

  const answers = { projectType: flags.projectType, ...flags.answers } as Answers
  const pick = (concern: string, id: string) => {
    const layer = registry.find((l) => l.concern === concern && l.id === id)
    if (!layer) throw new Error(`Registry has no ${concern}/${id} layer`)
    return layer
  }

  const layers = [pick('base', 'base'), pick('package-manager', answers['package-manager'])]
  for (const concern of RUNTIME_CONCERNS) {
    if (answers[concern] !== NONE) layers.push(pick(concern, INTERFACE), pick(concern, answers[concern]))
  }
  layers.push(pick('linting', answers.linting))
  for (const gate of answers['package-security']) layers.push(pick('package-security', gate))
  layers.push(pick('ci', answers.ci))
  if (answers.versioning !== NONE) layers.push(pick('versioning', answers.versioning))
  return { answers, layers }
}
