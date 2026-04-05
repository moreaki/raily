# Segment-Based Railway Map Plan

This document turns the current editor into a concrete next-step plan for drawing the kinds of transport schematics collected in [`docs/specification`](./specification).

## Why We Need a New Model

The current app is a good foundation for experimentation, but it is intentionally minimal:

- A station is just a named point with `x`/`y`
- A line is just an ordered list of `stationIds`
- Rendering is one SVG path per line, built from those station points

That is enough for a simple corridor, but not for the maps in `docs/specification`, which include:

- shared corridors where several services run along the same geometry
- branching lines
- line splits and rejoins
- bends that should not be implied by station positions alone
- labels whose position is independent from node position
- station marks that depend on context, not just a single boolean

The next version should keep SVG rendering, but replace the line model with explicit drawable geometry.

## Product Direction

Raily should remain a native schematic editor, not become a general SVG editor.

That means:

- SVG stays the render and export format
- JSON stays the primary editable document format
- imported reference SVGs are treated as visual references, not as the canonical source of truth
- geometry is edited through domain concepts like stations, junctions, segments, and lines

## V1 Target

The first meaningful upgrade is:

- manually place stations and junctions
- connect them with editable segments
- assign one or more lines to those segments
- support branching and shared track
- render clean SVG output from the internal document model

This is enough to draw a large class of metro, tram, and suburban rail schematics without solving auto-layout yet.

## Proposed Document Model

### Core entities

```ts
export interface MapNode {
  id: string;
  kind: "station" | "junction" | "waypoint";
  x: number;
  y: number;
}

export interface Station {
  id: string;
  nodeId: string;
  name: string;
  marker: "stop" | "interchange" | "terminal";
  label?: {
    x: number;
    y: number;
    align?: "left" | "right" | "top" | "bottom";
  };
}

export interface Segment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  geometry:
    | { kind: "straight" }
    | { kind: "orthogonal"; elbow: { x: number; y: number } }
    | { kind: "polyline"; points: { x: number; y: number }[] };
}

export interface Line {
  id: string;
  name: string;
  color: string;
}

export interface LineRun {
  id: string;
  lineId: string;
  segmentIds: string[];
}

export interface RailwayMapV2 {
  nodes: MapNode[];
  stations: Station[];
  segments: Segment[];
  lines: Line[];
  lineRuns: LineRun[];
}
```

### Why this shape

- `nodes` hold geometry anchors
- `stations` hold naming and station-specific presentation
- `segments` hold actual drawable path pieces
- `lines` define service identity
- `lineRuns` let one line traverse many segments, including branches and shared trunks

This is more flexible than `Line.stationIds[]`, but still simple enough to edit in React state.

## Geometry Status

The editor now already uses this geometry direction in practice:

- `straight` is supported
- `orthogonal` is supported with a draggable elbow handle
- `polyline` is supported with add, drag, and remove bend-point workflows

So this plan is no longer purely aspirational. The current remaining geometry outlook is:

- add `spline` as a future geometry kind for smoother curved regional alignments
- keep `orthogonal` as the quick one-bend mode
- keep `polyline` as the explicit multi-bend mode

## Rendering Rules

Rendering should remain SVG-first.

### Base rules

- Draw each segment from its own geometry definition
- Resolve each `lineRun` into one or more SVG path fragments
- Merge adjacent fragments only when it simplifies export
- Draw line strokes before station markers and labels
- Draw labels separately from nodes so label placement can be edited independently

### Shared corridors

When multiple lines use the same segment:

- default to rendering them stacked in parallel with small perpendicular offsets
- derive deterministic offset order from line order in the document
- keep offset rendering a pure projection step, not stored geometry

This avoids duplicating segments just to draw parallel colored tracks.

### Branches

Branches should be represented as distinct segment chains that share a node or corridor segment.

Do not try to encode branching through repeated station IDs inside a single array. That becomes fragile quickly.

## Editor V1 Interaction Model

The current editor can move stations and toggle membership on a line. The next editor should add domain-specific tools instead of a generic freeform canvas.

### Modes

- `select`: inspect and edit current entity
- `move`: drag nodes and label anchors
- `segment`: create a segment from one node to another
- `station`: create a station attached to a node
- `line`: assign selected segments to a line

### Primary workflows

1. Create nodes
2. Connect nodes with segments
3. Attach station records to relevant nodes
4. Create lines
5. Assign segments to line runs
6. Adjust labels and markers

### Editing details

- A station should no longer be the thing that is dragged directly on the canvas; its underlying node should be
- Junctions and waypoints should be creatable without a visible station label
- Segment editing should support at least straight and orthogonal elbow segments in V1
- Polyline editing can come immediately after if needed

## Recommended Milestones

### Milestone 1: Model migration

Goal: introduce the new document model without finishing the UI.

Tasks:

- add `RailwayMapV2` types next to the current model
- add Zod schema for the new model
- add helpers for node, segment, station, line, and line-run creation
- add pure SVG path builders for segment geometry
- keep the existing editor running on the old model until the new renderer is ready

Deliverable:

- a stable domain model that can represent branches and shared corridors

### Milestone 2: New renderer

Goal: render V2 documents read-only.

Tasks:

- create a renderer that draws nodes, segments, line offsets, labels, and markers
- support straight segments first
- add orthogonal elbow segment rendering
- render line runs over shared segments with automatic offsets

Deliverable:

- static display of realistic multi-line schematics from V2 JSON

### Milestone 3: New canvas editing

Goal: make V2 editable.

Tasks:

- add node selection and dragging
- add node creation
- add segment creation between nodes
- add station creation and label placement
- add line creation and segment assignment

Deliverable:

- an editor that can build a branched schematic from scratch

### Milestone 4: Quality-of-life tools

Goal: reduce manual friction.

Tasks:

- snapping to grid or angle
- duplicate line-run branch from existing trunk
- reorder overlapping lines on shared segments
- better station marker presets
- undo/redo

Deliverable:

- a workable authoring tool for non-trivial maps

## Suggested Commit Sequence

### Commit 1

`feat(model): add segment-based railway map schema`

- add V2 types
- add V2 schema
- add constructors and path helpers
- keep existing model untouched

### Commit 2

`feat(renderer): render segment-based maps to svg`

- add segment geometry rendering
- add line-run rendering
- add shared-segment offset logic

### Commit 3

`feat(editor): support node and segment editing`

- add canvas tools for nodes and segments
- add selection model for V2 entities
- wire sidebar forms to V2 state

### Commit 4

`feat(editor): add station labels and line assignment workflow`

- attach stations to nodes
- edit label anchors
- create and assign line runs

### Commit 5

`chore(migration): retire stationIds line model`

- remove old line polyline renderer
- migrate sample data to V2
- simplify editor around one document model

## Migration Strategy

There should be a short overlap period where both models exist.

Recommended approach:

- keep current `RailwayMap` as V1
- add `RailwayMapV2`
- add a one-way migration helper from V1 to V2
- switch rendering to V2 once the new renderer is ready
- delete V1 only after the editor fully supports V2 editing

This lowers risk and keeps progress visible.

## Deliberately Not in V1

These are valuable, but they should not block the first usable branching editor:

- automatic layout generation
- arbitrary SVG import and round-trip editing
- timetable semantics
- geographic projection
- multi-user collaboration
- backend sync

## Immediate Next Step

The best next implementation slice is Milestone 1 plus the read-only part of Milestone 2:

- define `RailwayMapV2`
- add segment/path rendering helpers
- render one small sample map with shared and branched segments

That gives the project a better backbone before UI complexity expands.
