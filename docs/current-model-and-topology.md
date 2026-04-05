# Current Model And Topology

This document describes the objects and topology model that the editor currently uses today.

It is intentionally about the current state of the application, not the ideal future state.

## Main objects

### `RailwayMap`

The persisted document has two top-level sections:

- `config`
- `model`

`config` contains reusable visual and interaction settings.

`model` contains the actual authored map content.

## Config objects

### `StationKind`

Defined in [`src/entities/railway-map/model/types.ts`](/Users/moreaki/Dev/raily/src/entities/railway-map/model/types.ts).

A station kind describes how a station should look and how its label should be rendered.

Current fields:

- `id`
- `name`
- `shape`
  - `circle`
  - `interchange`
  - `terminal`
- `symbolSize`
- `fontFamily`
- `fontWeight`
- `fontSize`

This is presentation metadata, not topology.

### `Line`

Also defined in [`src/entities/railway-map/model/types.ts`](/Users/moreaki/Dev/raily/src/entities/railway-map/model/types.ts).

A line defines the identity and visual style of a service.

Current fields:

- `id`
- `name`
- `color`
- `strokeWidth`
- `strokeStyle`

This is also configuration, not geometry by itself.

### Global editor settings

Saved in `config`:

- `parallelTrackSpacing`
- `segmentIndicatorWidth`
- `selectedSegmentIndicatorBoost`
- `gridLineOpacity`
- `labelAxisSnapSensitivity`

These are rendering and interaction settings that affect how the authored model is displayed and edited.

## Model objects

### `Sheet`

A sheet is a named drawing surface / map page.

Current fields:

- `id`
- `name`

Nodes and segments are sheet-scoped.

### `MapNode`

A node is the fundamental geometry anchor of the map.

Current fields:

- `id`
- `sheetId`
- `x`
- `y`

Important current meaning:

- nodes are not typed as station vs junction anymore
- a node becomes a station only if a `Station` is attached to it
- otherwise it is just a track point / geometry anchor
- every node should now be understood as a node-group anchor
- the visually single-node case is just the one-slot version of that group

### `Station`

A station is passenger-facing metadata attached to a node, or temporarily unassigned.

Current fields:

- `id`
- `nodeId | null`
- `name`
- `kindId`
- `label`

Important current meaning:

- a station may exist without being assigned to the map yet
- only one station is allowed per node
- label position is stored independently from node position

### `StationLabel`

Stored inside a station as optional label metadata.

Current fields:

- `x`
- `y`
- `align`
- `rotation`

Important current meaning:

- label placement is explicit authored data
- auto-placement is only a helper, not the source of truth

### `Segment`

A segment is the authored connection between two nodes.

Current fields:

- `id`
- `sheetId`
- `fromNodeId`
- `toNodeId`
- `fromLaneId?`
- `toLaneId?`
- `geometry`

Current geometry kinds:

- `straight`
- `orthogonal`
- `polyline`

Important current meaning:

- one segment belongs to at most one line in practice
- multiple lines between the same pair of nodes are represented by multiple segments
- segments are the main topology carrier for routing

### `SegmentGeometry`

This is the authored path shape of a segment.

Current kinds:

- `straight`
  - no internal control points
- `orthogonal`
  - one elbow point
- `polyline`
  - one or more bend points

This is stored geometry, not derived geometry.

### `LineRun`

A line run links a line definition to actual segment ownership.

Current fields:

- `id`
- `lineId`
- `segmentIds[]`

Important current meaning:

- line style lives in `config.lines`
- line usage on the map lives in `model.lineRuns`
- the sanitizer enforces exclusive segment ownership, so in practice one segment ends up in one line run only

### `NodeLane`

A node lane is the current model’s way of describing parallel-track slots inside a grouped station / node marker.

Current fields:

- `id`
- `nodeId`
- `order`

Important current meaning:

- node lanes are derived / normalized topology aids
- segment endpoints reference them through `fromLaneId` and `toLaneId`
- they define how grouped station markers are rendered and ordered
- they can now also be added explicitly by the user to widen a station / node group before all connecting segments exist

Practical interpretation:

- a node is the logical station / track-point anchor
- `nodeLanes` are the individual slots inside that node group

## Current topology approach

## 1. Topology is node-segment based

The current graph is:

- nodes are anchors
- segments connect nodes
- stations decorate nodes
- lines claim segments through line runs

This is already much closer to a real schematic editor than the older "one line = one station list" model.

## 2. Line ownership is segment-based

The current intended rule is:

- one segment = one line ownership at a time

Parallel services are represented by parallel segments, not by stacking multiple line ids onto one segment.

That rule is currently enforced by sanitization of `lineRuns`.

## 3. Parallel track rendering is lane-based at nodes

When several segments meet at a node:

- the editor computes `nodeLanes`
- segment endpoints are assigned to those lanes
- grouped station / track-point markers are rendered from those lanes

This is how the editor currently handles:

- multiple parallel segments
- trunk corridors that narrow or widen
- shared node groups like large terminals

The intended mental model is now:

- every node is a node group
- sometimes that group only has one lane, so it renders like a single node
- larger stops and hubs simply expose more lanes inside the same logical node

## 4. Geometry and topology are separated, but only partially

The topology says which nodes connect to which nodes.

The geometry says how the segment visually travels between them.

That separation is good, but today it is only at the segment level. There is not yet a richer topology object for:

- explicit switches
- track continuity inside a station throat
- platform groups
- direction-specific track routing

## 5. Lanes are partly derived, not fully authored

This is one of the key current characteristics.

`nodeLanes` are stored in the model, and the sanitizer also rebuilds and normalizes them from connected segments and line ownership while preserving explicitly added empty lanes.

That means:

- they are not fully freeform authored objects yet
- they are more explicit than a pure render heuristic
- but they are not yet fully first-class topology objects either

This has improved because empty lanes can now be authored explicitly, but continuity through those lanes is still not a fully explicit authored topology layer.

## Current strengths of this approach

- It supports real segment geometry instead of fake bend nodes.
- It supports unassigned stations as data-first objects.
- It supports explicit label placement.
- It supports parallel lines between the same node pair.
- It supports grouped node rendering through lanes.
- It is flexible enough for commuter-rail schematic maps already.

## Current topological inconsistencies and weak spots

This is the most important section for future structural work.

### 1. `LineRun` still behaves partly like ordering and partly like ownership

Right now a `LineRun` is carrying at least two different responsibilities:

- segment ownership
- sequence / ordering of those segments for line rendering

That is convenient, but it mixes two concerns:

- "does this line use this segment?"
- "in what order should those segments be traversed?"

This is workable for now, but it becomes fragile when:

- lines branch
- lines rejoin
- the same service has multiple disconnected chains on a sheet

### 2. `NodeLane` is still not fully authored topology

The current lane system is strong enough for rendering grouped nodes, but still weak as a true track-topology model.

Known limitation:

- lane membership and order are partly inferred by the sanitizer from nearby segment ownership

That means a lane is not yet a fully independent authored object with stable meaning such as:

- platform track 1
- through track 2
- branch track 3

### 3. Segment continuity through a node is still implicit

We know which lane a segment endpoint uses at a node.

But we still do not have a richer explicit statement of:

- which incoming track continues into which outgoing track inside the node

That means complex junction behavior is still represented indirectly.

For simple commuter maps this is often enough.
For more advanced throat / branching logic it will become limiting.

### 4. Line assignment and topology cleanup are still partly sanitizer-driven

The sanitizer currently does useful repair work:

- removes invalid node references
- removes duplicate segment claims across line runs
- rebuilds lane assignments
- clears invalid station placements

That is good for safety, but it also means some topology behavior is still expressed as repair logic instead of primary authored intent.

This is a sign that the model is still settling.

### 5. Segment geometry can imply continuity that topology does not explicitly express

A beautiful polyline or orthogonal route can visually suggest:

- this is a continuous corridor
- this branch clearly goes here

But those are visual cues, not yet explicit topological objects.

So today:

- geometry is strong visually
- topology is good but still thinner than the visuals imply

### 6. Track-point removal is currently safe-case only

The editor can now remove an unassigned pass-through track point by merging two adjacent segments, but only when the case is topologically simple.

That is the right product behavior for now, but it also reveals that:

- segment merge semantics are not yet a fully general topology operation

### 7. There is no import/migration contract yet

This is not a visual inconsistency, but it matters structurally.

The current model is still evolving enough that:

- import is intentionally postponed
- schema stability is not yet promised
- migration policy is not yet formalized

That means we should still treat the topology model as actively maturing.

## Practical summary

The current editor already has a real authored topology model:

- node-based
- segment-based
- line ownership through line runs
- lane-aware grouped node rendering
- explicit label placement
- explicit segment geometry

But the model is not yet at the "fully explicit railway topology" stage.

The biggest remaining structural gaps are:

- separating line ownership from line ordering more cleanly
- making lane continuity inside a node more explicit
- deciding how much of lane topology is authored vs sanitized
- deciding whether complex junction continuity needs its own object model

Those are exactly the kinds of questions worth settling before adding too many more features on top.
