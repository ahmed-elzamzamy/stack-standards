import type { Collected } from '../../../../src/layer.js'

/** `.env.example`, one commented key per contribution; `null` when there are no keys (SPEC §4.4). */
export function renderEnvExample({ env }: Collected): string | null {
  if (env.length === 0) return null
  return `${env.map((e) => `# ${e.description}\n${e.key}=${e.example ?? ''}`).join('\n')}\n`
}
