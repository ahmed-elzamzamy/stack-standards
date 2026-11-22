# Working in this repo

`create-stack-standards` is a CLI that generates a Vite + React project once, with non-feature concerns built in. `SPEC.md` is the build brief; `CONTEXT.md` is the glossary. Read both before changing code. If the spec and the code disagree, the spec wins unless a PR deliberately changes it.

These standards apply to every change, by a person or an agent. When review feedback states a rule that should apply beyond the change at hand, add it to the right section here in the same PR.

## Definition of done

A change is done only when all of these hold:

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. CI runs the same three and must be green.
- Every ticket acceptance criterion is met, or the PR says which one isn't and why.
- New logic has tests (see Testing). Bug fixes start with a failing test.
- No new lint suppressions (`biome-ignore`, `@ts-expect-error`, `any`) without a comment saying why.
- Docs that describe the changed behaviour are updated: layer READMEs, `CONTRIBUTING.md`, and `SPEC.md` if the change departs from it.

## Architecture

The CLI is a **functional core with an imperative shell**.

- **Core** (`src/resolve.ts`, `src/compose.ts`, renderers in `layers/`): pure functions. Input is data (flags, answers, layer manifests); output is data (answers, a `Tree`). No `process`, no console, no writes, no prompts. Reading a layer's own `files/` folder is the one allowed read.
- **Shell** (`src/cli.ts` and anything it calls for IO): parses argv, prompts, checks the target directory, writes the tree, runs `git init`, prints. Keep it thin; push decisions down into the core so they can be unit-tested.
- **Layers own their files.** A layer never writes into a file another layer owns. Shared files are rendered by exactly one owning layer from contributions (SPEC §4.4). Add a contribution kind to `src/layer.ts` rather than letting one layer reach into another.
- **Toolchain layers never mention Vite.** Anything project-type specific reaches them as a base contribution.
- **Concerns never import each other**, in this repo's layers and in generated code.
- **The registry is static.** `layers/<type>/index.ts` imports every manifest; no folder scanning, no codegen.
- **Generated code obeys the generated project's rules**: vendor SDKs only under `src/platform/*/adapters/`, relative imports, no `@/` alias.

## Code

- Use the `CONTEXT.md` terms (concern, layer, contribution, adapter, interface, …) in names, messages and docs. Avoid the synonyms it lists (plugin, provider, template, overlay, variant).
- Small functions that do one thing, named for what they return or do. Prefer a plain function over a class; no classes unless something truly holds state.
- No speculative abstractions: no interface with one implementation, no option nobody passes, no config for a constant. Three similar lines beat a premature helper.
- No type casts (`as T`, `as string`). Narrow with a check, a type guard or a better type; where a cast is truly unavoidable, comment why.
- Types first: model the data in `src/layer.ts` types and let the compiler check the rest. No `any`; narrow `unknown` at the boundary.
- Errors are thrown as `Error` with a message that names the thing and says how to fix it (`--ci gitlab-ci doesn't support --versioning release-please`). The shell catches, prints the message and exits 1. No stack traces for user errors.
- Determinism: anything that reaches the output tree is sorted or in a fixed documented order. No dates, random ids or absolute paths in generated files.
- Dependencies: the CLI has `@clack/prompts` and nothing else at runtime (SPEC §3.1). A new runtime dependency needs a line in the PR saying why the platform can't do it.
- Comments explain _why_, not _what_. Mark a deliberate shortcut with `// ponytail: <ceiling and upgrade path>`.
- Formatting is Biome's; don't fight it.

## Testing

- Vitest. Tests sit next to the code as `*.test.ts`.
- Test behaviour through public functions (`resolve`, `compose`, a renderer), not internals.
- Fake layers for core tests; real layers for layer tests. Contract suites test adapter source directly (SPEC §3.6).
- Every throw path that a user or contributor can hit has a test asserting its message.
- Keep tests fast: the in-memory tiers must not touch the network or install anything.

## Pull requests

- One ticket per PR. Title: the ticket title. The body starts with `Closes #<n>`.
- Body sections, in order:
  - **What**: what was built, in a few bullets.
  - **Acceptance criteria**: each criterion from the ticket, checked off or explained.
  - **Decisions**: spec fill-ins and judgement calls, one line each with the reason.
  - **How to test**: steps a reviewer can copy and run on their machine to see the change work, each with the expected result. Start from `gh pr checkout <n> && pnpm install`, then the checks (`pnpm typecheck && pnpm lint && pnpm test`), then a hands-on step that exercises the feature itself: for example, build and run the CLI with a full flag set into a temp folder and say which files to open and what to look for. If nothing user-visible changed yet, say so and name the test file that covers it.
  - **Not done / follow-ups**: anything deferred, so it can become a ticket.
- Keep the diff to the ticket. Unrelated fixes go in their own PR or the follow-ups list.
- Commit messages: imperative mood, ≤ 72-character subject.
