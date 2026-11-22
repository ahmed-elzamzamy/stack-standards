#!/usr/bin/env node
import { parseFlags } from './args.js'

try {
  const flags = parseFlags(process.argv.slice(2))
  // ponytail: prints the parsed flags until the composer (step 2) and prompts (step 6) exist.
  console.log(JSON.stringify(flags, null, 2))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
