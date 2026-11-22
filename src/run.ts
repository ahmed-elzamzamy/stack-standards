import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve as resolvePath } from 'node:path'
import { parseFlags } from './args.js'
import { compose, type Tree } from './compose.js'
import type { Layer } from './layer.js'
import { resolve } from './resolve.js'

/** Parses the flags and builds the project in memory. Throws a user-facing Error on bad input. */
export function generate(argv: string[], registry: Layer[], cliVersion: string): { dir: string; tree: Tree } {
  const flags = parseFlags(argv)
  const { answers, layers } = resolve(registry, flags)
  const dir = flags.dir
  if (dir === undefined) throw new Error('Missing <dir>; pass the target directory')
  const project = { dir, name: basename(resolvePath(dir)), cliVersion }
  return { dir, tree: compose(layers, answers, project) }
}

/** Writes the tree in one pass, refusing a target that holds anything but `.git` (SPEC §3.2). */
export function writeTree(dir: string, tree: Tree): void {
  mkdirSync(dir, { recursive: true })
  const existing = readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== '.git')
  if (existing.length) throw new Error(`${dir} is not empty; choose an empty directory`)
  for (const [path, body] of tree) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), body)
  }
}
