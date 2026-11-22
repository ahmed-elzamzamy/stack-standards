// Vendors create-vite's react-ts template into layers/vite-react/base/files/ (SPEC §5.1).
//   node scripts/snapshot.ts          re-vendor the snapshot from the latest create-vite
//   node scripts/snapshot.ts --check  exit 1 when the snapshot differs from upstream
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGET = fileURLToPath(new URL('../layers/vite-react/base/files', import.meta.url))

// Files the base renders itself, or that the linting concern replaces (the template's linter config).
const REMOVED = ['README.md', 'src/main.tsx', 'vite.config.ts', '_oxlintrc.json']

const list = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort()

/** The template's package.json without its linter: the linting layer owns the `lint` script and deps. */
function withoutLinter(json: string): string {
  const pkg = JSON.parse(json)
  delete pkg.scripts.lint
  delete pkg.devDependencies.oxlint
  return `${JSON.stringify(pkg, null, 2)}\n`
}

function upstream(): Map<string, Buffer> {
  const work = mkdtempSync(join(tmpdir(), 'create-vite-'))
  try {
    execFileSync('npm', ['pack', 'create-vite@latest', '--pack-destination', work, '--silent'], { stdio: 'pipe' })
    const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'))
    if (!tarball) throw new Error('npm pack produced no create-vite tarball')
    const out = join(work, 'unpacked')
    mkdirSync(out)
    execFileSync('tar', ['xzf', join(work, tarball), '-C', out])
    const template = join(out, 'package', 'template-react-ts')
    const files = new Map<string, Buffer>()
    for (const path of list(template)) {
      if (REMOVED.includes(path)) continue
      const body = readFileSync(join(template, path))
      files.set(path, path === 'package.json' ? Buffer.from(withoutLinter(body.toString('utf8'))) : body)
    }
    return files
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

const expected = upstream()

if (process.argv.includes('--check')) {
  const actual = new Map(list(TARGET).map((p) => [p, readFileSync(join(TARGET, p))] as const))
  const differs = [...new Set([...expected.keys(), ...actual.keys()])]
    .filter((p) => {
      const [a, b] = [expected.get(p), actual.get(p)]
      return !a || !b || !a.equals(b)
    })
    .sort()
  if (differs.length) {
    console.error(`The snapshot differs from create-vite. Run \`pnpm snapshot\` and review:\n${differs.join('\n')}`)
    process.exit(1)
  }
  console.log('The snapshot matches create-vite.')
} else {
  rmSync(TARGET, { recursive: true, force: true })
  for (const [path, body] of expected) {
    mkdirSync(dirname(join(TARGET, path)), { recursive: true })
    writeFileSync(join(TARGET, path), body)
  }
  console.log(`Vendored ${expected.size} files into layers/vite-react/base/files/`)
}
