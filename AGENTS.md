# AGENTS

This file is a handoff document for future agents working on `Raily`.

It captures the practical context, design intent, and model evolution that emerged during a very dense iteration cycle. Read this before making structural changes.

## Project intent

Raily is not meant to become a generic SVG editor.

It is a domain editor for schematic railway maps:

- stations and track points are domain objects
- segments are authored connections between nodes
- lines are services rendered over segments
- labels are editable authored objects
- grouped station topology is explicit and becoming more authored over time

The app should feel like a clean, deliberate transport-map editor, not like a drawing toy.

## Runtime and tooling

Expected runtime:

- Node 24.x
- Yarn 4
- PnP

Useful verification commands:

```bash
npx -y -p node@24 node .yarn/releases/yarn-4.13.0.cjs exec tsc --noEmit -p tsconfig.app.json
npx -y -p node@24 node .yarn/releases/yarn-4.13.0.cjs exec vitest run src/features/railway-map-editor/lib/commands.test.ts src/features/railway-map-editor/lib/labels.test.ts
npx -y -p node@24 node .yarn/releases/yarn-4.13.0.cjs build
```

## Current stack

Current application stack:

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zod
- Vitest
- Yarn 4 + PnP

This stack is still a good fit for the current and near-future scope.

There is no immediate need to move to another frontend stack just because the editor has grown in capability. The current constraints are mostly architectural and organizational, not framework limits.

## Do we need to move stacks?

Short answer: no, not yet.

Reasons:

- the app is still fundamentally a client-side SVG/canvas-heavy editor
- React + TypeScript is still a sensible fit for that
- Vite is still fast enough
- the complexity pressure is inside editor state, topology modeling, and UI composition, not in the bundler or framework choice

When a stack change would make sense:

- if multi-user collaboration, server persistence, or backend workflows become first-class
- if the app needs a stronger local-database/offline document architecture than the current single-document-in-memory flow
- if performance problems emerge from rendering scale that require a different rendering substrate

Right now, none of those justify a framework migration.

## Cleanup round recommendation

Yes, a cleanup round would be useful before layering too many more major features on top.

This is not because the app is unstable in a broad sense. It is because the editor has accumulated a lot of successful functionality quickly, and several files are now large enough that future changes will become riskier without another consolidation pass.

Current file sizes that matter:

- `RailwayMapEditor.tsx`: about 2164 lines
- `RailwayMapCanvasPane.tsx`: about 1226 lines
- `RailwayMapInspector.tsx`: about 993 lines
- `commands.ts`: about 1117 lines
- `useRailwayMapInteractions.ts`: about 1029 lines

These numbers are not automatically a problem, but they are a good signal that another decomposition pass would pay off.

## What should be tackled in a cleanup round

### 1. Split command domains

`commands.ts` is doing too many different jobs.

Recommended split:

- station/node commands
- segment geometry commands
- line ownership commands
- nodegroup/grid commands
- sheet/bootstrap commands

This would reduce risk when touching topology, since those edits currently live in one very broad command file.

### 2. Split inspector subpanels

`RailwayMapInspector.tsx` now mixes:

- selected node
- nodegroup editor
- selected station
- selected segment
- selected line

Recommended split:

- `NodeInspectorSection`
- `NodeGroupEditor`
- `StationInspectorSection`
- `SegmentInspectorSection`
- `LineInspectorSection`

The nodegroup editor in particular is now substantial enough to deserve its own file.

### 3. Split canvas rendering layers

`RailwayMapCanvasPane.tsx` is carrying:

- segment rendering
- node rendering
- label rendering
- overlay rendering
- context menus
- drawer chrome

Recommended split:

- segment layer
- node/station layer
- label layer
- overlay/guides layer
- canvas chrome / drawers

This would make future visual changes much safer.

### 4. Separate topology helpers from render helpers

Some topology-oriented layout logic is still living close to render assembly in `RailwayMapEditor.tsx`.

Recommended direction:

- move nodegroup lane layout / slot layout helpers into a dedicated topology/layout helper module
- keep `RailwayMapEditor.tsx` focused on orchestration

### 5. Add more model-level tests

The command and label tests are a good start, but the topology model is now rich enough that more tests would help a lot.

Recommended coverage additions:

- nodegroup grid placement
- port reassignment and sibling continuity
- hub outline defaults and overrides
- follow-cells outline shape expectations for simple patterns
- import/bootstrap compatibility with evolving config

### 6. Consider a versioned document schema soon

This is not mandatory right now, but the model has evolved enough that it is becoming a practical next step.

Recommended future addition:

- top-level document version field
- migration helpers for older exports

That will matter more once import becomes first-class.

## Safe base goal

The next safe base should look like this:

- current features preserved
- topology semantics clearer
- nodegroup editor isolated enough to evolve safely
- canvas rendering layers easier to reason about
- command surface less monolithic
- tests covering the new topology rules

That is a much better investment than switching frameworks right now.

## Main architectural split

The editor used to live almost entirely inside one giant component. It has been deliberately split.

Key files:

- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapEditor.tsx`
  - top-level coordinator
  - hook composition
  - model mutations and prop wiring
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapCanvasPane.tsx`
  - canvas rendering
  - overlays
  - drawers
  - visual interaction surfaces
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapInspector.tsx`
  - contextual inspector UI
  - nodegroup editor
  - segment inspector
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapManagement.tsx`
  - lines
  - stations
  - station kinds
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapSettings.tsx`
  - global editor/map settings
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/commands.ts`
  - mutation-heavy domain commands
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/geometry.ts`
  - geometry helpers
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/labels.ts`
  - label placement logic
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/useRailwayMapInteractions.ts`
  - drag, rotate, marquee, long-press, segment drawing

Do not casually collapse this split again.

## The most important mental model shift

### Old mental model

- a node was mostly a single visible point
- grouped rendering was a heuristic artifact
- duplicate segments were a shortcut for parallel lines

### Current mental model

- every `MapNode` is a nodegroup anchor
- a visually simple node is just the one-port case
- `NodeLane` is effectively a port/slot inside the nodegroup
- grouped station structure is increasingly authored, not guessed
- multiple lines through one station should be represented by multiple ports, not by stuffing multiple lines onto one port

This is the single most important conceptual shift in the app.

## Current domain model

Look at:

- `/Users/moreaki/Dev/raily/src/entities/railway-map/model/types.ts`
- `/Users/moreaki/Dev/raily/docs/current-model-and-topology.md`

Important objects:

- `RailwayMap`
  - top-level `config` + `model`
- `MapNode`
  - geometry anchor
  - now also carries nodegroup display preferences like hub outline settings
- `NodeLane`
  - port/slot inside a nodegroup
  - can now carry:
    - line identity
    - explicit grid position
- `Station`
  - one station per node
  - can exist unassigned
- `Segment`
  - one authored connection
  - one practical owning line
- `Line`
  - visual/service identity
- `LineRun`
  - segment ownership/order carrier for a line

## Geometry model

Current segment geometry kinds:

- `straight`
- `orthogonal`
- `polyline`

Why both `orthogonal` and `polyline` still exist:

- `orthogonal` is the lightweight one-elbow mode
- `polyline` is the more flexible bend-point mode

Planned future geometry:

- `spline`

Do not add `spline` by hacking curve rendering into `polyline`. Add it as a real fourth kind when the time comes.

## Bootstrap philosophy

The committed bootstrap is important.

It is not just demo data. It is a golden reference for:

- map complexity
- label quality
- line continuity
- nodegroup topology
- hub rendering

Current source:

- `/Users/moreaki/Dev/raily/src/entities/railway-map/model/constants.ts`
  - `DEVELOPMENT_BOOTSTRAP_MAP`

The bootstrap is based on a hand-refined Valencia-style commuter network and has repeatedly been replaced with exported JSON from the live editor when the model improved.

When the user provides a newer exported JSON and says it is a better refined bootstrap, prefer using that as the new committed default, as long as it is structurally consistent with the current schema.

## Label philosophy

Labels are authored objects.

Auto-placement is a helper, not the source of truth.

Key facts:

- label position is explicit
- rotation exists and is persisted
- interactive drag has axis snapping
- rotation soft-snaps to 45°
- the current auto-placer is corridor-aware, but still heuristic

Reference files:

- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/labels.ts`
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/labels.test.ts`

Important design decision:

- bootstrap should remain the golden example
- label heuristics should move toward it generically
- do not hardcode Valencia-specific one-off hacks unless they generalize cleanly

## Port and line semantics

This matters a lot now.

### Current intended rule

- one port = one line
- one nodegroup = potentially many ports
- therefore one station/hub can represent many lines, but through multiple ports

### Current implementation direction

Assigning a line to a port now:

- sets the port’s explicit `lineId`
- updates the UI immediately
- re-homes same-line continuity from sibling ports on the same nodegroup
- updates connected segment ownership in `lineRuns`

This was added because otherwise the topology editor and the segment model drift apart.

### Practical implication

Do not reintroduce the older ambiguous behavior where one visual slot implicitly carried multiple lines.

## Nodegroup grid editor

This is one of the most important new capabilities.

The nodegroup editor in the inspector is now the primary place to author grouped station topology.

Current abilities:

- add/remove node from group
- assign a port to a grid cell like `A1`, `B3`, etc.
- drag and drop ports between cells
- swap occupied cells
- grow/shrink rows and columns
- drag across outer edges to expand the grid
- assign a line to a port
- wire segment endpoints to ports from the segment inspector

Important file:

- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapInspector.tsx`

### UX decisions already made

- the old lane-order up/down/left/right UI is no longer the main topology tool
- the grid editor is the main tool now
- ports above the grid should be clearly draggable
- auto-placement inside the grid must be legible
- removable empty ports should have a direct trash action

### Current pain point to keep in mind

The nodegroup editor is powerful, but it is still the area most likely to need further refinement. Treat it as an authored topology workspace, not as a cosmetic add-on.

## Hub outline rendering

This is another major recent feature.

Nodegroups with multiple ports now default to showing a hub outline on the canvas.

Two main modes:

- `box`
  - simple bounding frame
- `cells`
  - follows the occupied cells more closely

There are now:

- global hub-outline defaults in settings
- optional per-node overrides

Current hub-related config:

- `hubOutlineMode`
- `hubOutlineColor`
- `hubOutlineStrokeStyle`
- `hubOutlineScale`
- `hubOutlineCornerRadius`
- `hubOutlineStrokeWidth`
- `hubOutlineConcaveFactor`

There are also now global defaults for:

- mode
- color
- stroke style

and per-node overrides for those when needed.

Per-node overrides exist for:

- mode
- color
- stroke style
- stroke width
- visibility

### Important recent nuance

`Follow cells` originally only worked as a naïve bounding/cell-union shape and failed for some patterns.

Current behavior:

- irregular occupied cells use a hull-based silhouette
- single-row or single-column runs such as `{A1, B1}` or `{A1, A2}` use a special compressed-run profile
- the concavity factor is meant to influence those inward “pinched” shapes

If you work on hub outlines again, preserve these principles:

- all occupied ports must remain inside the silhouette
- `Follow cells` should feel intentionally shaped, not like a lazy rectangle

## Visual style direction

The user explicitly prefers:

- flatter UI
- less rounded UI overall
- lighter selection treatment
- more stylish, less heavy active states

Recent progress:

- selection states in lists/panels are now lighter and more neutral
- rows try to preserve semantic color rather than flooding the background
- canvas should remain the main surface
- low-frequency controls moved into drawers

Do not backslide into:

- black heavy selected fills
- over-rounded bubble UI everywhere
- noisy canvas chrome

## Interaction model decisions already made

These were learned through iteration and should not be casually undone.

### Segment creation

- long-press on a node can start segment drawing
- but this is disabled for multi-selection because it conflicts with moving groups

### Label movement

- label dragging snaps to axis families
- breakout exists
- `Alt/Option` is used to enforce snap, not disable it
- diagonal snap needed special work to behave like cardinal snap along the full axis

### Geometry editing

- right-click and inspector both expose geometry mode changes
- orthogonal elbow is draggable
- polyline bend points are draggable/selectable/removable
- bend points have stronger selected visuals

## What was explicitly removed or superseded

These are not accidents:

- `Duplicate segment` was removed
  - explicit group widening + explicit segment creation is the preferred topology flow now
- “assign line to node” as a fuzzy node-level action was removed
  - line semantics are moving to ports and segments
- lane-order arrows are no longer the main topology editor
  - the grid editor replaced that conceptual role

## Known structural tensions

These still exist and future agents should keep them in mind.

### 1. `LineRun` still does too much

It is both:

- line ownership store
- traversal/order carrier

That may need a future split if topology gets richer.

### 2. `NodeLane` is port-like, but still named like a renderer helper

The concept has evolved.

It is now closer to:

- `port`
- `slot`
- `sub-node inside a nodegroup`

Renaming it may eventually make the code clearer, but do not do that lightly without a migration plan.

### 3. Import/migration is still intentionally not first-class

The model has been changing too quickly.

Export exists and committed bootstrap replacement from exported JSON is normal.

If import is added later, it needs deliberate versioning/migration support.

## Recommended way to work from here

When making future changes:

1. Preserve authored data over heuristic regeneration whenever possible.
2. Prefer explicit topology over hidden inference.
3. Keep one port = one line.
4. Keep the canvas visually calm.
5. Use the bootstrap as a quality benchmark.
6. Add tests when changing commands or label heuristics.

## Files to read first for future topology work

If you continue evolving the editor, read these first:

- `/Users/moreaki/Dev/raily/src/entities/railway-map/model/types.ts`
- `/Users/moreaki/Dev/raily/src/entities/railway-map/model/utils.ts`
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/lib/commands.ts`
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapEditor.tsx`
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapCanvasPane.tsx`
- `/Users/moreaki/Dev/raily/src/features/railway-map-editor/ui/RailwayMapInspector.tsx`
- `/Users/moreaki/Dev/raily/docs/current-model-and-topology.md`

## Package setup

The intended package setup is:

- Yarn 4
- PnP
- Node 24

## What “good” looks like in this app

A good change in Raily usually has these qualities:

- topology becomes more explicit
- editing becomes more direct
- the canvas gets cleaner, not noisier
- the model gets more authored, less guessed
- the bootstrap either improves or at least does not regress
- the feature feels like part of a schematic map editor, not a generic drawing app
