#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { registry } from '../layers/vite-react/index.js'
import { generate, writeTree } from './run.js'

try {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  // ponytail: one project type, so one registry; a second type adds a lookup keyed by --project-type.
  const { dir, tree } = generate(process.argv.slice(2), registry, version)
  writeTree(dir, tree)
  console.log(`Generated ${tree.size} files in ${dir}`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
