# Raily

Raily is a web-rendered application foundation for railway schematic editing.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zod
- Yarn 4 (Plug'n'Play)

## Run

```bash
yarn
yarn dev
```

## Runtime

- Use Node 24.x.
- This repo uses Yarn 4 Plug'n'Play, so it does not use `node_modules`.
- On unsupported Node versions, the scripts fail fast with a version check.

Install Node 24 with whichever tool you use, for example:

```bash
# Homebrew
brew install node@24

# nvm
nvm install 24
nvm use 24

# fnm
fnm install 24
fnm use 24

# Volta
volta install node@24
```

If you use Homebrew and already have another `node` version linked, switch locally like this:

```bash
brew unlink node
brew link --force --overwrite node@24
node -v
```

If Homebrew keeps `node@24` keg-only on your machine, add it to `PATH` instead:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
node -v
```

On Intel Macs, replace `/opt/homebrew` with `/usr/local` if needed.

## Editor SDKs

If your editor needs Yarn Plug'n'Play SDK files, generate them locally:

```bash
yarn dlx @yarnpkg/sdks base
```

These generated files live under `.yarn/sdks/` and are local editor helpers. They are not required in Git for this repository and should stay untracked.

## Source layout

```text
src/
  app/                  app entry and global styles
  entities/             railway domain model and validation
  features/             interactive editor UI
  pages/                screen-level composition
  shared/               reusable UI and utilities
```

## Why this structure

- `entities` keeps the railway document model independent from rendering concerns.
- `features` holds interactive workflows that can later be reused across pages or app modes.
- `shared` prevents UI primitives and utilities from leaking domain assumptions.
- This layout adapts cleanly to web, desktop-shell, and backend-connected versions of the app.

## Segment geometry

Segments currently support three geometry modes in the document model:

- `straight`
  - direct node-to-node segment with no internal control points
- `orthogonal`
  - one editable elbow point
  - useful for quick schematic bends without the extra handle clutter of a full polyline
- `polyline`
  - one or more editable bend points
  - useful for manual detours, trunk shaping, and more complex routing

The editor treats these as domain-aware routing modes, not generic SVG paths:

- `Orthogonal` is the lightweight one-bend tool
- `Polyline` is the flexible multi-bend tool
- parallel track offsets are still rendered as a projection step over the stored geometry

### Future outlook

The next planned geometry mode is `spline`.

That is intended for smoother regional or suburban curves where elbows and polylines feel too mechanical. It is not part of the current persisted schema yet, but the editor is being structured so `spline` can be added later without replacing the existing segment model.

## Current model and topology

For the current object model, topology approach, and the known structural inconsistencies, see:

- [Current model and topology](./docs/current-model-and-topology.md)
- [Segment-based map plan](./docs/segment-based-map-plan.md)

## Long-term direction

- Keep the editor web-based for rendering and interaction.
- If you want an installable desktop app, add Tauri around this frontend rather than rewriting the UI stack.
- Add a backend only when you need accounts, sync, collaboration, or background processing.
