// Layer manifest and contribution types (SPEC §4.3). Field names are a spec fill-in.
import type { ConcernFlag } from './args.js'

export type ConcernId = ConcernFlag | 'base'
export const RUNTIME_CONCERNS = ['observability', 'tracking', 'translations'] as const
export type RuntimeConcern = (typeof RUNTIME_CONCERNS)[number]
export const SKIPPABLE: readonly ConcernFlag[] = [...RUNTIME_CONCERNS, 'versioning']
export const NONE = 'none'
/** Id of a runtime concern's interface layer; never a flag value. */
export const INTERFACE = 'interface'

/** Fully resolved answers: every concern set, `none` for a skipped one. */
export type Answers = { projectType: string; 'package-security': string[] } & Record<
  Exclude<ConcernFlag, 'package-security'>,
  string
>

export interface EntryContribution {
  kind: 'init' | 'awaitedInit' | 'wrapper' | 'rootOptions'
  /** import line(s) main.tsx needs, e.g. `import { observability } from './platform/observability'` */
  imports: string[]
  /** init: a statement; awaitedInit: a call expression, rendered after `await`; wrapper: the component name; rootOptions: an object expression */
  code: string
}

export interface CiStep {
  id: string
  name: string
  run: string
}

export interface EnvKey {
  key: string
  description: string
  example?: string
}

export interface PlatformRow {
  concern: string
  tool: string
  path: string
}

export interface ToolchainRow {
  concern: string
  tool: string
  files: string[]
  note?: string
}

/** The base's React lint rules and globs, in ESLint's shape; every linting layer translates them (SPEC §5.2). */
export interface LintEntries {
  files: string[]
  ignores: string[]
  rules: Record<string, unknown>
}

/** Who and what is being generated; the base's README needs it, nothing else does. */
export interface Project {
  /** the target directory as the user typed it, for the reproducing command */
  dir: string
  /** the directory's basename, used as the README title */
  name: string
  cliVersion: string
}

export interface Contributions {
  /** deep-merged into the JSON file at each path (package.json, tsconfig*.json, …) */
  json?: Record<string, object>
  env?: EnvKey[]
  importBans?: string[]
  entry?: EntryContribution[]
  ci?: CiStep[]
  allowBuilds?: string[]
  readme?: { platform?: PlatformRow; toolchain?: ToolchainRow }
  // base-only inputs to toolchain layers:
  lint?: LintEntries
  platformRoot?: string
}

/** Everything every layer contributed, merged and ordered. Renderers read this. */
export interface Collected {
  json: Record<string, object>
  env: EnvKey[]
  importBans: string[]
  entry: (EntryContribution & { concern: ConcernId })[]
  ci: CiStep[]
  allowBuilds: string[]
  readme: { platform: PlatformRow[]; toolchain: ToolchainRow[] }
  lint?: LintEntries
  platformRoot?: string
}

/** Returns the file's contents, or `null` when the file shouldn't be written. */
export type Renderer = (collected: Collected, answers: Answers, project: Project) => string | null

export interface Layer {
  concern: ConcernId
  id: string
  name: string
  hint?: string
  /** supported CI providers; omitted = all */
  ci?: string[]
  /** absolute path of the layer's `files/` folder, copied verbatim */
  dir?: string
  contribute?(answers: Answers): Contributions
  /** shared files this layer owns and renders, by output path */
  render?: Record<string, Renderer>
}
