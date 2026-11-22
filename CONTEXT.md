# Stack standards CLI

An opinion-neutral CLI that generates a project once, with non-feature concerns built in.

## Language

**Concern**:
A piece of non-feature work every project needs, such as observability or package security.
_Avoid_: Feature, module, plugin

**Runtime concern**:
A concern the app calls at runtime through an app-owned interface (observability, event tracking, translations).

**Toolchain concern**:
A concern satisfied by a tool choice enforced through config, hooks and CI (linting, package security, versioning, CI).

**Interface**:
The app-owned API for a runtime concern that app code imports, independent of any vendor.

**Adapter**:
The copied-source implementation of an interface for one chosen tool; the only code allowed to import that tool's SDK.
_Avoid_: Plugin, driver, provider

**Project type**:
The kind of project the CLI generates. It owns its base layer, its entry-point renderers and the concerns and tools it offers; runtime-concern layers exist per project type, toolchain layers are shared. v1 has one, `vite-react`.

**Layer**:
A unit the CLI composes into a project: the base, a runtime concern's interface, or one tool choice. It owns its files and declares contributions.
_Avoid_: Template, overlay, variant

**Contribution**:
A layer's declared addition to a file shared across layers, such as a dependency, an env key or a lint ban entry.

**Entry contribution**:
A contribution an interface layer makes to its project type's entry-point files (for Vite: an init call, an awaited init, an `<App/>` wrapper, `createRoot` options). Each project type defines its own kinds and order.
