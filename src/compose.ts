import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { type Answers, type Collected, type Layer, type Project, RUNTIME_CONCERNS } from './layer.js'

/** A generated project: output path -> contents, sorted by path. */
export type Tree = Map<string, string>

const label = (l: Layer) => `${l.concern}/${l.id}`

/**
 * Builds the project in memory (SPEC §4): owned files copied verbatim, JSON deep-merged,
 * shared files rendered by their one owning layer. Any clash throws.
 */
export function compose(layers: Layer[], answers: Answers, project: Project): Tree {
  const owner = new Map<string, string>()
  const claim = (path: string, layer: Layer) => {
    const prev = owner.get(path)
    if (prev) throw new Error(`${path} is owned by both ${prev} and ${label(layer)}`)
    owner.set(path, label(layer))
  }

  const files = new Map<string, string>()
  for (const layer of layers) {
    if (!layer.dir) continue
    for (const entry of readdirSync(layer.dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      // npm drops `.gitignore` from packages, so layers ship it as `_gitignore`.
      const path = relative(layer.dir, join(entry.parentPath, entry.name))
        .split(sep)
        .join('/')
        .replace(/(^|\/)_gitignore$/, '$1.gitignore')
      claim(path, layer)
      files.set(path, readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    }
  }

  const collected = collect(layers, answers)

  for (const [path, patch] of Object.entries(collected.json)) {
    const owned = files.get(path)
    const base = owned === undefined ? {} : JSON.parse(owned)
    files.set(path, `${JSON.stringify(sortDeps(merge(base, patch, path, 'owned file')), null, 2)}\n`)
  }

  for (const layer of layers) {
    for (const [path, render] of Object.entries(layer.render ?? {})) {
      claim(path, layer)
      const body = render(collected, answers, project)
      if (body !== null) files.set(path, body)
    }
  }

  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/** Gathers every layer's contributions: deduped, collision-checked, ordered (SPEC §4.4, §4.5). */
export function collect(layers: Layer[], answers: Answers): Collected {
  const out: Collected = {
    json: {},
    env: [],
    importBans: [],
    entry: [],
    ci: [],
    allowBuilds: [],
    readme: { platform: [], toolchain: [] },
  }
  const single: Partial<Record<'lint' | 'platformRoot' | 'rootOptions', string>> = {}
  const once = (key: keyof typeof single, layer: Layer) => {
    if (single[key]) throw new Error(`${key} contributed by both ${single[key]} and ${label(layer)}`)
    single[key] = label(layer)
  }

  for (const layer of layers) {
    const c = layer.contribute?.(answers) ?? {}
    const who = label(layer)
    for (const [path, patch] of Object.entries(c.json ?? {}))
      out.json[path] = merge(out.json[path] ?? {}, patch, path, who)
    for (const e of c.env ?? []) pushUnique(out.env, e, 'key', 'env key', who)
    for (const s of c.ci ?? []) pushUnique(out.ci, s, 'id', 'CI step', who)
    out.importBans.push(...(c.importBans ?? []))
    out.allowBuilds.push(...(c.allowBuilds ?? []))
    for (const e of c.entry ?? []) {
      if (e.kind === 'rootOptions') once('rootOptions', layer)
      out.entry.push({ ...e, concern: layer.concern })
    }
    if (c.readme?.platform) out.readme.platform.push(c.readme.platform)
    if (c.readme?.toolchain) out.readme.toolchain.push(c.readme.toolchain)
    if (c.lint !== undefined) {
      once('lint', layer)
      out.lint = c.lint
    }
    if (c.platformRoot !== undefined) {
      once('platformRoot', layer)
      out.platformRoot = c.platformRoot
    }
  }

  const order = (concern: string) => RUNTIME_CONCERNS.indexOf(concern as never)
  out.entry.sort((a, b) => order(a.concern) - order(b.concern)) // stable: keeps each layer's own order
  out.env.sort((a, b) => (a.key < b.key ? -1 : 1))
  out.importBans = [...new Set(out.importBans)].sort()
  out.allowBuilds = [...new Set(out.allowBuilds)].sort()
  return out
}

/** Same key + same value dedupes; same key + different value throws. */
function pushUnique<T extends object>(list: T[], item: T, key: keyof T, what: string, who: string) {
  const prev = list.find((x) => x[key] === item[key])
  if (!prev) return void list.push(item)
  if (JSON.stringify(prev) !== JSON.stringify(item)) throw new Error(`${what} ${String(item[key])} differs in ${who}`)
}

function merge<T>(a: T, b: unknown, path: string, who: string): T {
  if (isObject(a) && isObject(b)) {
    const out: Record<string, unknown> = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = k in a ? merge(a[k], v, `${path} > ${k}`, who) : v
    return out as T
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return a
  throw new Error(`${path}: ${who} sets ${JSON.stringify(b)}, already ${JSON.stringify(a)}`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
function sortDeps(json: Record<string, unknown>) {
  for (const k of DEP_KEYS) {
    const deps = json[k]
    if (isObject(deps)) json[k] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1)))
  }
  return json
}
