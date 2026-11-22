# create-stack-standards — v1 spec

A build brief for whoever implements v1 in this repo, whether a person or an agent. Every decision here was made in a wayfinder ticket under [`.wayfinder/tickets/`](.wayfinder/tickets/). The spec gives each non-obvious decision a one-line reason and links the ticket that holds the full reasoning. If this spec and a ticket disagree, the ticket's latest amendment wins; fix the spec.

Where this spec fills in a detail no ticket decided, such as an exact tool id, env key name or file name, it is marked _(spec fill-in)_. The implementer can change those freely.

---

## 1. Overview and standing decisions

`create-stack-standards` is an open-source CLI. It generates a Vite + React + TypeScript project **once**, with seven non-feature concerns built in:

| Kind | Concern | Skippable |
|---|---|---|
| Runtime | Observability and error handling | yes ("None") |
| Runtime | Event tracking | yes |
| Runtime | Translations | yes |
| Toolchain | Linting (including formatting) | no |
| Toolchain | Package security | no (pick at least one gate) |
| Toolchain | CI | no |
| Toolchain | Versioning | yes |

**Runtime concerns** are app-owned interfaces in `src/platform/<concern>/`. The chosen tool is a copied-source **adapter** in `src/platform/<concern>/adapters/<tool>/`. A lint rule bans vendor SDK imports everywhere outside `src/platform/*/adapters/`.

**Toolchain concerns** are tool choices, enforced through config files and CI. The generated project gets no git hooks.

Standing decisions, which hold everywhere ([map](.wayfinder/map.md)):

- **Generate once.** No `add`, `swap` or upgrade commands. Swapping a tool means editing one adapter folder by hand.
- **Copied source.** Generated projects never depend at runtime on anything we publish. This follows the shadcn model.
- **Opinion-neutral.** No house defaults and no "recommended" labels. "None" is never preselected or implied.
- **Open source.**
- **Scope test:** the CLI covers non-feature work that projects need but forget at creation time. v1 proves the concept; later versions extend it.

Prior art ([Prior art for template composition](.wayfinder/tickets/01-prior-art.md)): better-t-stack, create-t3-app, create-vite, shadcn and Nx all wire vendors in directly. None of them generates an app-owned interface. We borrow shadcn's per-item file list and an in-memory file tree. We avoid per-combination variants and patching across concerns.

## 2. Glossary

The terms are defined in [`CONTEXT.md`](CONTEXT.md): concern, runtime concern, toolchain concern, interface, adapter, project type, layer, contribution, entry contribution. Use them in code, prompts and docs. Avoid the synonyms that `CONTEXT.md` lists, such as plugin, driver, provider, template, overlay and variant.

---

## 3. The CLI

### 3.1 Package and runtime

- npm package `create-stack-standards`, unscoped. Its bin has the same name, so `pnpm create stack-standards`, `npm create stack-standards` and `npx create-stack-standards` all work. **Reserve the name on npm before v1 ships.** ([CLI name and npm scope](.wayfinder/tickets/21-cli-name.md))
- The CLI needs Node 22 or later. ([Base template contents](.wayfinder/tickets/08-base-template.md))
- It has two dependencies: `@clack/prompts` for prompts and `node:util` `parseArgs` for flags. It uses no EJS or Handlebars, no magicast, no ts-morph, and no giget or degit, because layers ship inside the package. ([CLI building blocks](.wayfinder/tickets/02-cli-building-blocks.md))
- The CLI works offline: it never installs dependencies or fetches anything.

### 3.2 Flags

Each prompt has exactly one flag, and its value is the layer's tool id. **The full set of flags is the preset**: there is no preset file. ([Prompt flow and presets](.wayfinder/tickets/15-prompt-flow.md))

| Flag | Values (tool ids, _spec fill-in_) | Notes |
|---|---|---|
| `<dir>` (positional) | path, or `.` | |
| `--project-type` | `vite-react` | No prompt. When omitted it falls back to `vite-react`. Always written into the reproducing command. ([Project-type extension model](.wayfinder/tickets/16-project-type-extension.md)) |
| `--package-manager` | `npm`, `pnpm` | When omitted it falls back to the invoking package manager, detected from `npm_config_user_agent` |
| `--observability` | `datadog`, `faro`, `opentelemetry`, `sentry`, `none` | |
| `--tracking` | `amplitude`, `ga4`, `mixpanel`, `posthog`, `segment`, `none` | |
| `--translations` | `formatjs`, `i18next`, `lingui`, `paraglide`, `none` | |
| `--linting` | `biome`, `eslint-prettier` | |
| `--package-security` | comma-separated subset of `audit`, `osv-scanner`, `socket-firewall-free` | At least one. `none` is not accepted |
| `--ci` | `github-actions`, `gitlab-ci` | |
| `--versioning` | `changesets`, `release-please`, `semantic-release`, `none` | `release-please` requires `github-actions` |

There is no `--yes`, `--interactive`, `--force`, `--no-git` or `--install`.

**Defaults.** Only the two exceptions in the table have defaults: `--project-type` and `--package-manager`. Every other value must come from a flag or a prompt.

**Errors.** All exit with code 1:
- An unknown tool id always errors, with or without a TTY.
- With no TTY, missing values fail fast with **one** error that lists every missing flag and its valid ids. A missing `<dir>` counts as a missing value.
- Conflicting pairs, such as `--ci gitlab-ci --versioning release-please`, error and name the conflict, with or without a TTY.
- A target directory that isn't empty (anything other than `.git`) is refused. The CLI checks this before the first prompt, or right after the directory prompt when the directory is asked for. It offers no override.
- The package name is the directory's basename, normalised to a valid npm name. If it can't be made valid, the CLI errors. There is no prompt or flag for the name.

### 3.3 Prompts

Prompts appear **only when stdin is a TTY, and only for values that are missing**. ([Prompt flow and presets](.wayfinder/tickets/15-prompt-flow.md), amended by [Toolchain option menus](.wayfinder/tickets/14-toolchain-menus.md))

Order:

1. Target directory
2. Package manager. The cursor starts on the invoking package manager.
3. Observability
4. Event tracking
5. Translations
6. Linting
7. Package security (multiselect, at least one)
8. CI
9. Versioning. CI comes first so that incompatible tools can be hidden.
10. Summary: the full reproducing command (§3.5)
11. Confirm
12. Write

Menu rules:
- Each concern gets one `select`, with "None" as an option where the concern is skippable. There is no multiselect of concerns, because that would allow a silent skip.
- Options are sorted alphabetically by display name, with "None" last. The cursor starts on the first option. There are no "recommended" labels.
- A hint appears only when it states a fact that affects the choice:
  - "OpenTelemetry — experimental in browsers"
  - "Paraglide — locale switch reloads the page"
  - "Socket Firewall Free — blocks confirmed malware only; licence is not open source"
- Options that are incompatible with an earlier answer are hidden. In v1 this is only release-please, which is hidden unless CI is GitHub Actions. Each layer declares the CI providers it supports.
- Prompt wording is plain and uses the `CONTEXT.md` terms. The wording is not part of this spec.
- Ctrl-C at any point prints "Cancelled, nothing written" and exits with code 1. Nothing has been written at that point, because the tree exists only in memory.

Menu ordering and hiding live in one pure function with unit tests (§3.6).

### 3.4 Generation steps

1. Parse the flags and validate the ids and conflicts.
2. Check the target directory.
3. Prompt for missing values (TTY), or fail fast listing them (no TTY).
4. Resolve the chosen layers from the registry (§4.2): the base, the package manager, and, for each runtime concern that isn't skipped, its interface and adapter. Then linting, each security gate, CI, and versioning unless it is `none`.
5. Compose in memory (§4): copy owned files, merge JSON, run the renderers.
6. TTY only: print the summary and ask for confirmation.
7. Write the tree to disk in a single pass.
8. Run `git init`, unless the target is already inside a git repo. If git is missing, warn and continue. Make no first commit.
9. Print the next steps: `cd <dir>`, install with the chosen package manager, then commit the lockfile.

The CLI doesn't install dependencies because pnpm build-script approval and release-age failures belong in the user's own terminal.

### 3.5 Reproducing command

Built from the resolved answers. It is printed in the summary and written into the generated README. It uses the chosen package manager, pins the CLI version, and includes every flag, `--project-type` among them. npm needs `--` before the arguments. ([CLI name and npm scope](.wayfinder/tickets/21-cli-name.md))

```sh
pnpm create stack-standards@1.0.0 my-app --project-type vite-react --package-manager pnpm --observability sentry --tracking posthog --translations i18next --linting biome --package-security audit,osv-scanner --ci github-actions --versioning changesets
npm create stack-standards@1.0.0 -- my-app --project-type vite-react --package-manager npm …
```

### 3.6 Testing the CLI

From [CLI testing strategy](.wayfinder/tickets/20-cli-testing.md):

- **Tier 1, composition (in memory).** Every combination runs through the real composer. That is 2 package managers × 5 observability options × 6 tracking options × 5 translations options × 2 linters × 7 non-empty gate subsets × 7 valid CI/versioning pairs = **29,400**. Each run asserts:
  - no contribution collision and no path clash;
  - deterministic output;
  - every tool id appears in at least one tier 2 row, so coverage can't drift.
- **Tier 2, real projects.** About 8 hand-written flag sets live in one test file. They cover every option at least once, plus these deliberate pairs:
  - Paraglide with Biome, and Paraglide with ESLint;
  - pnpm with Audit, and npm with Audit;
  - each versioning option under a valid CI;
  - GitLab CI with one versioning option, and GitLab CI with None.

  Each row is generated and then given a plain install with its own package-manager settings. That proves the release-age and build-script rules pass. The row then runs typecheck, lint and build through the generated scripts. GitHub workflows are checked with `actionlint`, and GitLab YAML against GitLab's JSON schema. The security gates are not run and the workflows are not executed.
- **Ban fixtures (part of tier 2).** After a clean lint, the test writes throwaway files to check the import ban under both linters:
  - vendor imports, `require` and dynamic `import()` fail outside `src/platform/*/adapters/` and pass inside it;
  - Paraglide's relative `generated/` import behaves the same way.

  The vendor lists come from layer contributions.
- **Contract suites.** One Vitest + happy-dom suite per concern, parameterised over the concern's adapters. Each suite imports adapter source directly from `layers/…/files/`, without generating a project, and uses each adapter's `contract.fixture.ts`. The checks for each concern are listed in §6. The suites are never shipped to generated projects.
- **CLI behaviour.** Spawn the built CLI without a TTY and test flags and errors: missing, unknown and conflicting flags, a non-empty directory, an invalid package name, the `--project-type` default, `git init` being skipped inside a repo, and exit codes. Prompts are not driven through a pty.
- **Snapshots and round-trip.** Each tier 2 row's file tree is a committed snapshot. The test also parses the README's reproducing command, reruns it in memory, and requires an identical tree.
- **Per-layer docs checks:**
  - every interface and adapter layer ships a README;
  - every adapter README has the headings Setup, Behaviour and Limits;
  - every env key has a non-empty description.
- **Schedule.**
  - Tier 2 runs on every PR as a parallel matrix.
  - It also runs nightly on `main` with fresh dependency resolution. A nightly failure opens or updates a single issue.
  - The tests run on the template's pinned Node.
  - Renovate or Dependabot on this repo bumps the dependency floors in layer manifests.
- **Generated dependencies use caret ranges.** Only the package manager itself is pinned exactly.

---

## 4. Composition model

From [Template composition model](.wayfinder/tickets/10-composition-model.md) and [Project-type extension model](.wayfinder/tickets/16-project-type-extension.md).

### 4.1 Layers

A **layer** is the unit of composition. It is one of three things:
- **the base**;
- **a runtime concern's interface**, added whenever a tool for that concern is picked;
- **one tool choice**, such as `observability/sentry`, `linting/biome` or `package-manager/pnpm`.

Package managers are modelled as toolchain layers _(spec fill-in)_. They own `pnpm-workspace.yaml` or `.npmrc` and the `packageManager` field.

Each layer has:
- `files/`: files the layer **owns**, copied verbatim to the same relative paths. Two layers owning the same path is an error.
- `layer.ts`: a typed manifest holding the tool id, display name, optional hint, supported CI providers (toolchain tools) and **contributions**.
- `contract.fixture.ts` (adapters only): kept outside `files/`, so it is never generated (§6).

The CLI repo is laid out like this:

```
layers/
  vite-react/                    # per project type: base + runtime concerns
    index.ts                     # registry: static imports of every layer manifest
    base/{layer.ts, files/, renderers/}
    observability/
      interface/{layer.ts, files/, renderers/}
      sentry/{layer.ts, contract.fixture.ts, files/src/platform/observability/adapters/sentry/{index.ts, README.md}}
      datadog/ faro/ opentelemetry/
    tracking/{interface, posthog, segment, ga4, amplitude, mixpanel}/
    translations/{interface, i18next, formatjs, lingui, paraglide}/
  toolchain/                     # shared across project types
    package-manager/{pnpm, npm}/
    linting/{biome, eslint-prettier}/
    package-security/{audit, osv-scanner, socket-firewall-free}/
    ci/{github-actions, gitlab-ci}/
    versioning/{changesets, release-please, semantic-release}/
```

Toolchain layers never hard-code Vite. Anything specific to a project type reaches them as a contribution from the base (§4.4).

### 4.2 Registry

There is one static registry file per project type, `layers/vite-react/index.ts`, which imports every layer manifest. The menus, flag validation, tier 1 coverage and contract-suite parameters all read from it. There is no folder discovery and no codegen: adding an adapter means adding one line. ([Adapter contributor path](.wayfinder/tickets/23-adapter-contributor-path.md))

### 4.3 Manifest shape

The field names below are a _spec fill-in_; the kinds of contribution are decided.

```ts
export interface Layer {
  concern: ConcernId            // 'observability' | … | 'base'
  id: string                    // tool id used as the flag value
  name: string                  // display name in menus
  hint?: string                 // only facts that affect the choice
  ci?: CiId[]                   // supported CI providers; omitted = all
  contribute?(ctx: Answers): Contributions   // may read other answers (e.g. the package manager)
}

export interface Contributions {
  packageJson?: object                                   // deep-merged; deps as caret ranges
  env?: { key: string; description: string; example?: string }[]
  importBans?: string[]                                  // vendor package patterns or path patterns
  entry?: EntryContribution[]                            // interface layers only (§4.5)
  ci?: CiStep[]                                          // steps placed in the CI owner's fixed order
  allowBuilds?: string[]                                 // pnpm build-script allowlist
  readme?: { platform?: PlatformRow; toolchain?: ToolchainRow }
  // base-only inputs to toolchain layers:
  lint?: LintEntries; platformRoot?: string
}
```

### 4.4 Shared files

| File | How it's produced | Owner |
|---|---|---|
| `package.json`, `tsconfig*.json`, other JSON | deep merge of every layer's JSON contributions | (merge) |
| `src/main.tsx` | rendered from entry contributions | base |
| `vite.config.ts` | rendered from contributions (e.g. Paraglide's plugin) | base |
| `README.md` | rendered from README contributions (§5.3) | base |
| `.env.example` | rendered from `env` contributions, with a comment line above each key; written only if there are keys | base _(spec fill-in)_ |
| `biome.json` / `eslint.config.js` + Prettier config | rendered from `importBans` and base lint entries | the chosen linting layer |
| `pnpm-workspace.yaml` / `.npmrc` | rendered from `allowBuilds` | the package-manager layer |
| CI workflow (`.github/workflows/ci.yml` / `.gitlab-ci.yml`) | rendered from `ci` steps | the CI layer |
| `src/platform/<concern>/index.ts` | rendered with the chosen adapter's import path, which is the only input | the interface layer |
| `src/platform/<concern>/README.md` | rendered with the chosen tool and the alternatives | the interface layer |

Rules:
- Each shared code file has **exactly one owning layer**, which renders it with a plain TS function `(contributions) => string`. There is no templating language and no filename substitution, and no layer writes into a file another layer owns.
- **Collisions.** The same key with the same value is deduplicated. The same key with a different value **throws**. Tier 1 catches these, so users never see them.
- **Lists.** Import bans and env keys are deduplicated and sorted. CI steps and entry wrappers keep their owner's fixed order.
- **Determinism.** Dependency keys are sorted, and the same answers always give byte-identical output.
- `.gitignore` comes from the base snapshot. A layer that needs extra ignores ships a nested `.gitignore` inside its own folder, for example `adapters/paraglide/.gitignore` containing `generated/`. _(Spec fill-in. It keeps the ignore with the folder it belongs to.)_

### 4.5 `main.tsx` wiring (Vite entry contributions)

Only **interface layers** contribute to `main.tsx`, never adapters, and `main.tsx` imports only `./platform/<concern>`. The Vite project type has four kinds of entry contribution:

1. `init`: a synchronous call, placed before `createRoot`
2. `awaitedInit`: an awaited call using top-level await, placed after every `init`
3. `wrapper`: wraps `<App/>`
4. `rootOptions`: the second argument to `createRoot`. Only one layer may contribute it; a second contribution throws.

The order is a CLI constant: observability, then tracking, then translations. In v1 the only wrapper is the observability `ErrorBoundary`; translations and tracking contribute none. ([Translation interface](.wayfinder/tickets/13-translation-interface.md) amends the composition model.)

---

## 5. Base template

From [Base template contents](.wayfinder/tickets/08-base-template.md).

### 5.1 Contents

- **Source.** A vendored snapshot of create-vite's `react-ts` template, kept in `layers/vite-react/base/files/`. It is refreshed for each CLI release by a script, followed by a diff check. Three things are removed from the snapshot:
  - create-vite's ESLint config and dependencies, because the linting concern supplies lint config;
  - `README.md`, which the base renders;
  - `src/main.tsx`, which the base renders, so the diff check treats it as ours.

  React and Vite run at whatever versions the snapshot pins. React must be 19 or later for the `createRoot` error hooks.
- **TypeScript** is required and there is no JS option, because the typed interfaces depend on it. create-vite's tsconfigs are used as they are, with no added flags.
- **No router** and no router prompt, so tracking's `page()` must not assume a router. **No test runner**.
- **Node.** The project pins the oldest supported LTS, currently `22`, in `.nvmrc` and in `engines.node` (`>=22`, _spec fill-in_). CI reads `.nvmrc`. The version is a CLI constant, bumped when a line reaches end of life (22 → 24 around April 2027).
- **Package manager.** pnpm or npm (§7.1). Yarn and Bun come later.
- **Layout:**
  - `src/platform/<concern>/index.ts` holds the interface and its instance;
  - `src/platform/<concern>/adapters/<tool>/` holds the one chosen adapter.

  Runtime concerns only; toolchain config lives at the root. Imports are relative, with no `@/` alias. App code imports from `src/platform/<concern>`, never from `adapters/`.

### 5.2 Base contributions to toolchain layers

- **Scripts:** `dev`, `build` (`tsc -b && vite build`) and `typecheck` (`tsc -b`) _(spec fill-in for `typecheck`)_.
- **CI steps:** typecheck and build.
- **Lint entries:** the React lint rules and globs used by ESLint.
- **The platform root** `src/platform`, which the linting layer turns into the exemption glob `src/platform/*/adapters/**`.

### 5.3 Generated docs

From [Generated-project docs](.wayfinder/tickets/22-generated-docs.md). Docs live next to the code they describe and belong to the layer that owns that code. There is no `PLATFORM.md`.

**Root `README.md`.** The base renders it, replacing create-vite's README. Its sections come in a fixed order:

1. **Title and getting started.** Install, `dev`, `build`, `typecheck` and `lint`, written for the chosen package manager.
2. **Platform.**
   - One row per runtime concern that isn't skipped: concern, tool, and a link to its folder.
   - One line explaining that a skipped concern can be added later by generating a scratch project with it and copying its folder in.
3. **Toolchain.** One row per toolchain concern, `{ concern, tool, files, note? }`. This is the only doc the toolchain concerns get. The notes cover, for example:
   - the commitlint squash-merge caveat;
   - why installs fail with `ENOVERSIONS` or a release-age error.
4. **Generated with.** The reproducing command and the CLI version.

**`src/platform/<concern>/README.md`** is owned by the interface layer. Its sections:
- **Usage:** an example of each call. For tracking, it also shows how to extend `events.ts`.
- **Rules:** import only from `src/platform/<concern>`, the vendor ban, and the lint rule that enforces it.
- **Swapping the tool**, as a recipe:
  1. Generate a scratch project with the reproducing command, changing only this concern's flag.
  2. Copy its `adapters/<tool>/` folder in and delete the old adapter folder.
  3. Change the adapter import in `index.ts`.
  4. Swap the dependencies, the `VITE_*` env keys and the lint-ban patterns.
- **Alternatives:** the other tools this CLI version offers for the concern.

**`adapters/<tool>/README.md`** is static, owned by the adapter, and has three required headings:
- **Setup:** account and dashboard steps, and where each value comes from.
- **Behaviour:** what happens when config is missing, and the consent defaults.
- **Limits:** anything the adapter supports only partly.

It doesn't repeat the env keys; it links to `.env.example` instead.

---

## 6. Runtime concerns

These rules apply to every runtime concern ([Skip policy for concerns](.wayfinder/tickets/09-skip-policy.md), [Adapter contributor path](.wayfinder/tickets/23-adapter-contributor-path.md)):

- **Skipping.** "None" is an explicit answer. A skipped concern generates **nothing**: no folder, no `main.tsx` call, no ban entries, no README row. There is no no-op adapter, because one would hide the concern as handled.
- **Adapter export.** An adapter's `index.ts` exports exactly one factory: `createObservability`, `createTracking` or `createTranslator`. Translations adapters also export the types `Locale` and `Messages` _(spec fill-in: the interface needs them for typed keys)_.
- **Env.** Adapters read their own `VITE_*` env keys. Each key is contributed with a description.
- **Missing config.** When config is missing, the adapter is **disabled**: it logs one `console.warn` and every call does nothing. Checking that production actually has the keys is left to a later concern, typed env/config validation.
- **Implementation.** An adapter implements the whole interface, with no no-op methods. Anything it supports only partly is documented under Limits.
- **Bans.** Each adapter contributes its vendor import patterns. Use the `@scope/**` form, plus both `pkg` and `pkg/**` for bare names. A pattern written as `@scope/*` misses deep subpaths ([Lint boundary enforcement](.wayfinder/tickets/03-lint-boundary.md)).
- **Imports between concerns.** None. Concerns never import each other.

### 6.1 Observability and error handling

From [Observability and error-handling interface](.wayfinder/tickets/11-observability-interface.md), with research in [Observability common ground](.wayfinder/tickets/04-observability-common-ground.md).

**Interface.** `src/platform/observability/` holds `index.ts` (rendered), `ErrorBoundary.tsx` and `README.md`.

```ts
// src/platform/observability/index.ts
import type { RootOptions } from 'react-dom/client'
import { createObservability } from './adapters/sentry'

export type Attributes = Record<string, unknown>
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Observability {
  captureException(error: unknown, attrs?: Attributes): void
  log(level: LogLevel, message: string, attrs?: Attributes): void
  addBreadcrumb(message: string, attrs?: Attributes): void
  /** Only a stable internal id: no email or name, to keep PII out of telemetry. */
  setUser(user: { id: string } | null): void
  setContext(key: string, value: Attributes | null): void
}

export let observability: Observability

/** Synchronous. Called in main.tsx before createRoot. */
export function initObservability(): void {
  observability = createObservability()
}

/** React 19 root hooks: the only path React errors take to observability. */
export const reactErrorHandlers: RootOptions = {
  onUncaughtError: (error, info) => observability.captureException(error, { componentStack: info.componentStack }),
  onCaughtError: (error, info) => observability.captureException(error, { componentStack: info.componentStack }),
  onRecoverableError: (error, info) => observability.captureException(error, { componentStack: info.componentStack }),
}

export { ErrorBoundary } from './ErrorBoundary'
```

- **No spans in v1**, required or optional, because Datadog's browser SDK has none. Trace propagation (`traceparent` on outgoing requests) is set up in each adapter's init. Teams that want spans can extend their own copy.
- **`log` must really deliver.** Each adapter turns its vendor's log product on:
  - Datadog adds `@datadog/browser-logs` and fans `setUser` and `setContext` out to both RUM and Logs;
  - Sentry pins version 10.71 or later, or sets `enableLogs`.

  There is no `console` fallback.
- **`ErrorBoundary` only renders a fallback**, a bare "Something went wrong" with a reload button, meant to be edited. It **never reports**. That leaves exactly one reporting path: the `createRoot` hooks.
- **Global errors** (`window.onerror`, `unhandledrejection`) are captured by each vendor's own instrumentation, which the adapter must enable. The interface registers no listeners.

**Entry contributions:**
- `init`: `initObservability()`
- `rootOptions`: `reactErrorHandlers`
- `wrapper`: `ErrorBoundary`, the outermost wrapper

**Adapters:**

| Tool id | Display name | Ban patterns | Env keys _(spec fill-in)_ | Notes |
|---|---|---|---|---|
| `datadog` | Datadog | `@datadog/**` | `VITE_DATADOG_APPLICATION_ID`, `VITE_DATADOG_CLIENT_TOKEN`, `VITE_DATADOG_SITE` | RUM + Logs |
| `faro` | Grafana Faro | `@grafana/**` | `VITE_FARO_URL` | |
| `opentelemetry` | OpenTelemetry | `@opentelemetry/**` | `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` | Uses the new `@opentelemetry/browser-sdk` and exports OTLP. Hint: experimental in browsers |
| `sentry` | Sentry | `@sentry/**` | `VITE_SENTRY_DSN` | Version 10.71 or later, or `enableLogs` |

There is no Honeycomb adapter, because its SDK sits on the deprecated OpenTelemetry JS 2.x stack. Honeycomb users pick OpenTelemetry and point it at Honeycomb's OTLP endpoint, as the OpenTelemetry README says.

**Contract suite**, mocking the vendor SDK:
- the five methods forward to the vendor;
- uncaught errors and unhandled rejections are captured;
- a missing env key warns once, and every call then does nothing.

### 6.2 Event tracking

From [Event tracking interface](.wayfinder/tickets/12-tracking-interface.md), with research in [Event tracking common ground](.wayfinder/tickets/05-tracking-common-ground.md).

**Interface.** `src/platform/tracking/` holds `index.ts` (rendered), `events.ts` and `README.md`.

```ts
// src/platform/tracking/events.ts — app-owned; add your events here.
// Event names: snake_case by convention.
export type Events = {
  signed_up: { plan?: string }
}

export type Traits = {
  plan?: string
}
```

```ts
// src/platform/tracking/index.ts
import { createTracking } from './adapters/posthog'
import type { Events, Traits } from './events'

export type Consent = 'granted' | 'denied'

export interface Tracking {
  /** userId is a stable internal id, never an email. */
  identify(userId: string, traits?: Traits): void
  track<E extends keyof Events>(event: E, props: Events[E]): void
  /** The only source of page views. Missing values come from location and document.title. */
  page(props?: { path?: string; title?: string }): void
  reset(): void
  setConsent(consent: Consent): void
}

export let tracking: Tracking

/** Synchronous. Every adapter starts with consent denied. */
export function initTracking(): void {
  tracking = createTracking()
}
```

- **Typed at compile time only.** There is no runtime validation and no schema library. There is no `group` call in v1, because GA4 lacks it and PostHog and Mixpanel charge for it.
- **Consent** is one analytics switch, and **every adapter starts with it denied**. The interface applies consent but doesn't remember it: the app persists the choice and calls `setConsent` on every load.
  - Calls made while consent is denied are dropped, not queued.
  - GA4 maps the switch to `analytics_storage` only; ad consent stays denied.
  - Segment defers `load()` until the first grant. If consent is later revoked, it stops forwarding calls and runs `analytics.reset()`. Device-mode destinations that were already injected may keep running until reload; its README documents this.
- **No automatic page views:**
  - GA4: `send_page_view: false`, plus a README note to turn off Enhanced Measurement's history page views;
  - PostHog: `capture_pageview: false`;
  - Amplitude: `autocapture.pageViews: false`;
  - Mixpanel: `track_pageview: false`.

  Other autocapture stays at the vendor defaults.
- **`reset()`** calls the vendor's reset, rotating the anonymous id where the vendor does. GA4 sets `user_id: null` and keeps its client id; its README documents this.
- **GA4 name checks.** In dev only, the GA4 adapter warns when:
  - an event name fails `^[A-Za-z][A-Za-z0-9_]{0,39}$`;
  - an event name is reserved;
  - traits exceed GA4's limits (25 properties, values of 36 characters or fewer).

  It never normalises names.

**Entry contribution.** `init` emits the following, which runs after `initObservability()`:

```ts
initTracking()
// Call tracking.setConsent('granted') from your consent UI, or here if no consent is needed.
tracking.page()
```

**Adapters:**

| Tool id | Display name | Ban patterns | Env keys _(spec fill-in)_ |
|---|---|---|---|
| `amplitude` | Amplitude | `@amplitude/**` | `VITE_AMPLITUDE_API_KEY` |
| `ga4` | Google Analytics 4 | none (gtag.js is loaded as a script, not an npm SDK) | `VITE_GA4_MEASUREMENT_ID` |
| `mixpanel` | Mixpanel | `mixpanel-browser`, `mixpanel-browser/**` | `VITE_MIXPANEL_TOKEN` |
| `posthog` | PostHog | `posthog-js`, `posthog-js/**` | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` |
| `segment` | Segment | `@segment/**` | `VITE_SEGMENT_WRITE_KEY` |

**Contract suite**, mocking the vendor SDK:
- the five methods forward to the vendor;
- nothing is sent before `setConsent('granted')`;
- nothing is sent after `setConsent('denied')`;
- no automatic page views;
- a missing env key warns once, and every call then does nothing.

### 6.3 Translations

From [Translation interface](.wayfinder/tickets/13-translation-interface.md), with research in [i18n common ground](.wayfinder/tickets/06-i18n-common-ground.md). The concern is named `translations` everywhere, including the prompt label "Translations", to avoid a clash with Lingui's `I18nProvider`.

**Interface.** `src/platform/translations/` holds `index.ts` (rendered) and `README.md`.

```ts
// src/platform/translations/index.ts
import { useSyncExternalStore } from 'react'
import { createTranslator, type Locale, type Messages } from './adapters/i18next'

export type { Locale }
type Params<K extends keyof Messages> = Messages[K] extends undefined ? [] : [params: Messages[K]]

export interface Translator {
  /** Call at render or use time, never at module scope. Plural param is always `count`. */
  t<K extends keyof Messages>(key: K, ...params: Params<K>): string
  locale(): Locale
  readonly locales: readonly Locale[]
  readonly baseLocale: Locale
  /** Persists the choice and sets <html lang>. May reload the document (Paraglide). */
  setLocale(locale: Locale): Promise<void>
  subscribe(listener: () => void): () => void
}

export let translator: Translator

/** Async. Awaited in main.tsx before createRoot, so no flash of base text or raw keys. */
export async function initTranslations(): Promise<void> {
  translator = await createTranslator()
}

/** For formatting, use Intl.* with translator.locale(). */
export function useTranslator(): Translator {
  useSyncExternalStore(translator.subscribe, translator.locale)
  return translator
}
```

- **Message format is native to each adapter:** i18next JSON v4, ICU for FormatJS and Lingui, inlang for Paraglide. Using ICU everywhere would break opinion-neutrality, and swapping a tool is a hand edit of one folder anyway.
- **Keys are always typed.** Params are typed where the library supports it. Lingui's params are loose (`Record<string, string | number>`), and its README documents this.
  - Each adapter contributes a type-generation script, plus a CI step that fails on stale types.
  - i18next keeps JSON catalogues and generates types with `i18next-resources-for-ts`, through an `i18n:types` script. It doesn't use `as const` `.ts` catalogues.
- **Catalogues** live in `adapters/<tool>/locales/<locale>.<ext>`.
  - Every project starts with `en` as the base locale and `fr`, each with one example message and one `count` plural.
  - The locale list and the base locale live in the tool's native config (`lingui.config.ts`, `project.inlang/settings.json`, or for i18next the adapter's own `config.ts` _(spec fill-in)_), and the adapter exports them from there.
  - There is no locale prompt.
- **Loading.** The base catalogue is bundled up front; other locales load lazily through dynamic `import()`. If a load fails, the adapter falls back to the base locale with one `console.warn`. The failure is not reported to observability, because concerns don't import each other.
- **Locale resolution:**
  1. the stored `localStorage` key;
  2. `navigator.languages`, matching the exact tag first and then the language subtag;
  3. the base locale.

  `setLocale` persists to that key and sets `<html lang>`. Every adapter follows the same order. Paraglide does it through `strategy: ["localStorage", "preferredLanguage", "baseLocale"]`; i18next does it in a few lines of its own, with no detector plugin.
- **Missing messages** fall back to the base locale. In dev, the adapter warns once per key and locale. A key missing from the base locale too returns the key itself.
- **No wrapper and no vendor provider.** The lint ban stops app code from using vendor hooks, so a native provider would serve no one.
- **Out of the interface:** rich text, number and date helpers, and namespaces.

**Entry contribution.** `awaitedInit`: `await initTranslations()`. It runs after the observability and tracking inits and before `createRoot`.

**Adapters** (none of them has env keys):

| Tool id | Display name | Ban patterns | Notes |
|---|---|---|---|
| `formatjs` | FormatJS (react-intl) | `react-intl`, `react-intl/**`, `@formatjs/**`, `intl-messageformat`, `intl-messageformat/**` | ICU |
| `i18next` | i18next | `i18next`, `i18next/**`, `react-i18next`, `react-i18next/**` | JSON v4 + `i18n:types` |
| `lingui` | Lingui | `@lingui/**` | ICU. Explicit message IDs, not its default hashed IDs |
| `paraglide` | Paraglide | `@inlang/paraglide-js`, `@inlang/paraglide-js/**`, path pattern `**/adapters/paraglide/generated/**` | Hint: locale switch reloads the page. Uses `m[key]` (no tree-shaking). Compiles to `adapters/paraglide/generated/`, which is gitignored. Contributes its Vite plugin to `vite.config.ts` _(spec fill-in: confirm plugin vs script)_ |

**Contract suite**, running the real libraries against each adapter's fixture catalogues:
- `t` fills params and selects `count` plurals;
- locale resolution follows the order above;
- `setLocale` persists the choice and notifies subscribers (for Paraglide, it reloads, through a stubbed `location.reload`);
- a message missing from `fr` falls back to `en`;
- a failed catalogue load falls back to the base locale and warns once.

---

## 7. Toolchain concerns

From [Toolchain option menus](.wayfinder/tickets/14-toolchain-menus.md), with research in [Package security tooling landscape](.wayfinder/tickets/07-package-security.md) and [Check scanners against a pnpm 11 lockfile](.wayfinder/tickets/18-scanner-lockfile-check.md).

**No git hooks in v1.** CI is the only enforcement point. That avoids shipping a hook manager as a hidden house default, and a gate that lives only in a hook can be bypassed.

### 7.1 Package manager

These pins are written for every package-security choice.

- `packageManager` pins the **exact** version the CLI release was tested with: pnpm 12 or npm 12. With the pin, pnpm 12 writes a two-document `pnpm-lock.yaml`. Every gate offered handles that format ([Check scanners against a pnpm 11 lockfile](.wayfinder/tickets/18-scanner-lockfile-check.md)).
- **pnpm.** `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` explicitly, plus the `allowBuilds` entries the template needs.
  - The explicit setting makes the age check strict: an install fails rather than falling back to an older version. `minimumReleaseAgeExclude` is the escape hatch.
  - It sets no `trustPolicy`.
  - pnpm 12's other defaults are relied on: `strictDepBuilds` fails on unreviewed build scripts, and `blockExoticSubdeps` is on.
  - With a version pin, pnpm 12 fails on unknown settings, so a misspelt policy is caught rather than silently dropped.
- **npm.** `.npmrc` sets `min-release-age=1` (days). This is also strict: an install fails with `ENOVERSIONS` when no version is old enough.
- The README Toolchain notes explain the release-age failure and its escape hatch.

### 7.2 Linting (required)

The menu offers `Biome` and `ESLint + Prettier`. The concern includes formatting. Both options render the adapter-boundary ban from the `importBans` contributions. When every runtime concern is skipped, the ban is left out but the linter stays. ([Lint boundary enforcement](.wayfinder/tickets/03-lint-boundary.md), [Skip policy for concerns](.wayfinder/tickets/09-skip-policy.md))

**Biome** is both linter and formatter. Its ban uses:
- `style/noRestrictedImports` with `patterns[].group`, turned off for `src/platform/*/adapters/**` through `overrides`. It catches static imports, `import type`, `export … from` and `import()`.
- `style/noCommonJs`, turned on everywhere, adapters included, to cover `require()`.

CI runs `biome ci .`.

**ESLint + Prettier** uses typescript-eslint, the React rules contributed by the base, and `eslint-config-prettier`. Its ban uses:
- core `no-restricted-imports` for static imports;
- `no-restricted-syntax` selectors for `import()` and `require()`. The regex writes `/` as `\x2F`.

A later flat-config entry turns both rules off in adapters. A comment there warns that this also turns off any other `no-restricted-syntax` checks the project adds in adapters. Don't use a boundary plugin, and **never use `import/no-restricted-paths`**: under pnpm it reports 0 errors without warning.

CI runs `eslint . && prettier --check .`.

**Both linters:**
- Vendor **type-only imports are banned too** outside adapters. Biome can't allow them, and the interfaces expose their own types.
- dependency-cruiser is not offered.

### 7.3 Package security (required: a multiselect, at least one gate)

| Id | Display name | CI command |
|---|---|---|
| `audit` | Audit | `pnpm audit`, or `npm audit && npm audit signatures` under npm. It is one option so the menu doesn't change with the package manager |
| `osv-scanner` | OSV-Scanner | `osv-scanner scan source -L <lockfile>` |
| `socket-firewall-free` | Socket Firewall Free | Wraps the CI install: `sfw pnpm install --frozen-lockfile` or `sfw npm ci`, with **no install cache**, because it only checks packages that are actually downloaded. Hint: blocks confirmed malware only; licence is not open source |

Not offered:
- GitHub dependency review: unverified on the two-document lockfile, free only on public repos, and GitHub-only;
- Snyk, the Socket app and `socket ci`: each needs an account;
- `trustPolicy: no-downgrade`: gives false positives when a maintainer changes legitimately;
- Renovate and Dependabot: they only report, and belong to a different concern.

### 7.4 CI (required)

The menu offers `GitHub Actions` and `GitLab CI`. CI hosts every check, because a gate that runs only in a hook can be bypassed.

Jobs, rendered in the CI layer's fixed order:
1. Install, with the pinned package manager and a frozen lockfile. Under Socket Firewall Free the install is wrapped and uncached.
2. Lint
3. Typecheck and build, contributed by the base
4. Translations type freshness, when contributed
5. The chosen security gates
6. The versioning PR check, when versioning is chosen
7. The release job, on `main` only

Further rules:
- Third-party steps are **pinned by full commit SHA with a version comment** on GitHub, or by image digest on GitLab.
- Node always comes from `.nvmrc` and is never hard-coded.
- Each toolchain layer lists the CI providers it supports, and only compatible options are shown.

### 7.5 Versioning (skippable)

The menu offers `Changesets`, `release-please`, `semantic-release` and `None`. **None of them publishes to npm.** A release is a version bump, a changelog and a tag. Choosing "None" means no release tool, no PR check and no release job.

| Id | PR check | Release job on `main` | CI providers |
|---|---|---|---|
| `changesets` | `changeset status --since=origin/main`. A PR that doesn't release adds `changeset add --empty`. Needs full fetch depth | Opens the "Version packages" PR. The package is `private`, so set `privatePackages: { version: true, tag: true }` _(spec fill-in)_ | both |
| `release-please` | `commitlint --from <base> --to <head>` with `@commitlint/config-conventional` | release-please | GitHub only |
| `semantic-release` | the same commitlint check | semantic-release, configured without npm publish | both |

- The release job needs a token with write access: `GITHUB_TOKEN` on GitHub Actions, and a project access token on GitLab.
- The commitlint options get a README note: with squash merges, the PR title becomes the commit message.
- `--ci gitlab-ci --versioning release-please` is a conflict error (§3.2).

---

## 8. Example output

Flag set:

```sh
pnpm create stack-standards@1.0.0 my-app --project-type vite-react --package-manager pnpm \
  --observability sentry --tracking posthog --translations i18next \
  --linting biome --package-security audit,osv-scanner --ci github-actions --versioning changesets
```

File tree. Files from the create-vite snapshot are abbreviated.

```
my-app/
├── .changeset/
│   ├── README.md
│   └── config.json
├── .env.example
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── .gitignore
├── .nvmrc
├── README.md
├── biome.json
├── index.html
├── package.json
├── pnpm-workspace.yaml
├── public/…
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── App.tsx, App.css, index.css, assets/…
    ├── main.tsx
    └── platform/
        ├── observability/
        │   ├── README.md
        │   ├── index.ts
        │   ├── ErrorBoundary.tsx
        │   └── adapters/sentry/
        │       ├── README.md
        │       └── index.ts
        ├── tracking/
        │   ├── README.md
        │   ├── index.ts
        │   ├── events.ts
        │   └── adapters/posthog/
        │       ├── README.md
        │       └── index.ts
        └── translations/
            ├── README.md
            ├── index.ts
            └── adapters/i18next/
                ├── README.md
                ├── config.ts
                ├── index.ts
                ├── resources.d.ts      # generated by `pnpm i18n:types`, committed
                └── locales/
                    ├── en.json
                    └── fr.json
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary, initObservability, reactErrorHandlers } from './platform/observability'
import { initTracking, tracking } from './platform/tracking'
import { initTranslations } from './platform/translations'

initObservability()
initTracking()
// Call tracking.setConsent('granted') from your consent UI, or here if no consent is needed.
tracking.page()
await initTranslations()

createRoot(document.getElementById('root')!, reactErrorHandlers).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

`biome.json` (the ban part):

```json
{
  "linter": {
    "rules": {
      "style": {
        "noCommonJs": "error",
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "patterns": [
              {
                "group": ["@sentry/**", "i18next", "i18next/**", "posthog-js", "posthog-js/**", "react-i18next", "react-i18next/**"],
                "message": "Vendor SDKs may only be imported in src/platform/*/adapters/. Import from src/platform/<concern> instead."
              }
            ]
          }
        }
      }
    }
  },
  "overrides": [
    {
      "includes": ["src/platform/*/adapters/**"],
      "linter": { "rules": { "style": { "noRestrictedImports": "off" } } }
    }
  ]
}
```

`pnpm-workspace.yaml`:

```yaml
# Installs fail rather than fall back when a version is younger than 1 day.
# Escape hatch: minimumReleaseAgeExclude.
minimumReleaseAge: 1440
allowBuilds:
  esbuild: true   # the real list comes from the vendored snapshot; tier 2 proves it
```

`package.json` (the merged parts; the dependency ranges are illustrative):

```json
{
  "name": "my-app",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.21.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "biome ci .",
    "format": "biome format --write .",
    "i18n:types": "i18next-resources-for-ts …",
    "preview": "vite preview"
  },
  "dependencies": {
    "@sentry/react": "^10.71.0",
    "i18next": "^25.0.0",
    "posthog-js": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`.env.example`:

```sh
# Public PostHog API host, e.g. https://eu.i.posthog.com
VITE_POSTHOG_HOST=
# PostHog project API key (Project settings → Project API key)
VITE_POSTHOG_KEY=
# Sentry DSN for this project (Settings → Client Keys)
VITE_SENTRY_DSN=
```

`.github/workflows/ci.yml` (the step order; SHAs are placeholders):

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # vX.Y.Z
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@<sha> # vX.Y.Z  (reads packageManager)
      - uses: actions/setup-node@<sha> # vX.Y.Z
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm i18n:types && git diff --exit-code
      - run: pnpm audit
      - uses: google/osv-scanner-action/osv-scanner-action@<sha> # vX.Y.Z
        with: { scan-args: "scan source -L pnpm-lock.yaml" }
      - if: github.event_name == 'pull_request'
        run: pnpm changeset status --since=origin/main
```

`README.md` (outline):

```md
# my-app

## Getting started
pnpm install · pnpm dev · pnpm build · pnpm typecheck · pnpm lint

## Platform
| Concern | Tool | Folder |
| Observability | Sentry | src/platform/observability |
| Event tracking | PostHog | src/platform/tracking |
| Translations | i18next | src/platform/translations |
To add a skipped concern later, generate a scratch project with it and copy its folder in.

## Toolchain
| Concern | Tool | Files | Note |
| Linting | Biome | biome.json | … |
| Package security | Audit, OSV-Scanner | .github/workflows/ci.yml, pnpm-workspace.yaml | Installs fail when a version is under 1 day old … |
| CI | GitHub Actions | .github/workflows/ | |
| Versioning | Changesets | .changeset/ | Add a changeset to every PR, or `changeset add --empty` |

## Generated with
pnpm create stack-standards@1.0.0 my-app --project-type vite-react … (create-stack-standards 1.0.0)
```

---

## 9. Extension model

### 9.1 Project types (designed, not built)

From [Project-type extension model](.wayfinder/tickets/16-project-type-extension.md).

- **Project type is a dimension above layers.** It owns its base layer, its entry renderers and its menu of concerns and tools. The CLI will ask for it first. Every project type stays in this one CLI, so the reproducing command and the test matrix aren't split.
- **Runtime-concern layers exist per type.** SDKs split by runtime (`@sentry/react`, `@sentry/nextjs`, `@sentry/node`), and contracts change shape on a server: `setUser` and `identify` are per request, and `page()`, `setConsent`, `ErrorBoundary` and `useTranslator()` have no server meaning.

  Shared across types:
  - the concern names;
  - the tool ids (`--observability sentry` means Sentry everywhere);
  - the contract rules;
  - the per-adapter check list, adapted to each runtime.

  Layers may share helper files inside this repo. There is no split into a shared core and per-type bindings, and no no-op methods.
- **Toolchain layers are shared**, fed by base contributions (§5.2).
- **Entry wiring is per type.** Next.js would use `instrumentation.ts`, `instrumentation-client.ts` and an `app/layout.tsx` wrapper; a Node API would init before the server starts and add middleware. The rules that hold for every type: only interface layers wire entries, entries import only platform interfaces, and conflicting contributions throw.

**v1 builds** only these:
- the `--project-type vite-react` flag;
- the split between `layers/vite-react/` and `layers/toolchain/`;
- the base-contributed CI and lint values.

**Deferred until a second project type exists:**
- a `projectTypes` field in layer manifests;
- the project-type prompt;
- entry-kind schemas for other types;
- a tier 1 matrix per type.

### 9.2 Contributor path (built in v1)

From [Adapter contributor path](.wayfinder/tickets/23-adapter-contributor-path.md).

- **Acceptance bar.** Contract fit only, with no popularity floor. An adapter must meet all of these:
  - implements the whole interface, with no no-op methods;
  - uses a public npm browser SDK that needs no build plugin outside the adapter folder. Paraglide's generated import is the existing exception;
  - disables itself when config is missing;
  - passes the contract suite, a tier 2 row (it may share an existing row) and the per-layer README and env checks.
- **Starting point.** Copy the nearest adapter folder. There is no generator script.
- **`CONTRIBUTING.md`** in this repo has two checklists, and a test enforces every step:
  - **Runtime adapter:**
    - the manifest: id, name, hint, caret dependency floors, vendor import patterns, and env keys with descriptions;
    - the `create<Concern>()` export;
    - the Setup/Behaviour/Limits README;
    - `contract.fixture.ts`;
    - the registry line and the tier 2 row;
    - running the tests.
  - **Toolchain tool:**
    - the manifest and the config files it owns;
    - its Toolchain README row, `{ concern, tool, files, note? }`;
    - it consumes base contributions rather than hard-coding Vite;
    - a renderer, if it owns a shared code file;
    - the registry line and the tier 2 row.

  New concerns and new project types are maintainer-led: open an issue first.
- **Upkeep.** Each layer folder has a CODEOWNERS entry, and the contributor is pinged on the nightly failure issue. An adapter that stays broken for two minor releases may be removed in the next minor release, with a changelog note. Generated projects are unaffected, because they hold copied source.

---

## 10. Out of scope and open items

### Out of scope for v1

- **`add` and `swap` commands.** The CLI generates once.
- **Remote or community adapters.** Layers ship only inside the package, so the layer format stays internal.
- **Pushing standard upgrades into projects that were already generated** (Nx-migrations style).
- **Project types other than `vite-react`.** Their model is designed (§9.1), not built.
- **A preset file.** It could be added later on top of the flags.
- **Yarn and Bun.**

### Open items (post-v1)

- **Translations:** a rich-text API across adapters, and a catalogue completeness check in CI.
- **Later concern candidates:**
  - a testing setup;
  - typed env and config validation, which would also make sure production has the adapter keys;
  - feature flags;
  - accessibility linting;
  - auth;
  - dependency updates, with the release age kept in sync with the package manager;
  - git hooks.
- **Later toolchain options:**
  - pnpm `trustPolicy: no-downgrade`;
  - GitHub dependency review, which first needs a smoke check on a real repo with the two-document lockfile;
  - scanners that need an account (Snyk, `socket ci`);
  - dependency-cruiser as a CI backstop;
  - more CI providers.
- **Tracking and observability tests:** a check with the real SDKs that opted-out tracking and observability send nothing over the network, using a browser with request interception ([CLI testing strategy](.wayfinder/tickets/20-cli-testing.md)).
- **Raised while writing this spec:**
  - GA4 doesn't fit the acceptance bar's wording, "a public npm browser SDK", because gtag.js is loaded as a script. Either reword the bar to accept official script-tag SDKs, or record GA4 as an exception.
  - How Paraglide compiles, through its Vite plugin (a `vite.config.ts` contribution) or a script, still needs confirming when its adapter is built.

### Build checklist

Before v1 ships, outside the code:
- Reserve `create-stack-standards` on npm.
- Add the snapshot refresh script and its diff check.
- Add `CONTRIBUTING.md` and `CODEOWNERS`.
- Set up Renovate or Dependabot on this repo.
- Add the nightly tier 2 workflow and its failure-issue automation.
- Commit this spec together with `.wayfinder/`, `research/` and `CONTEXT.md`, so its links resolve.
