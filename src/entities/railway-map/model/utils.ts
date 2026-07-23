import type { LineRun, Line, MapNode, MapPoint, NodeLane, RailwayMap, Segment, Sheet, Station } from "./types";

let idCounter = 0;
const DEFAULT_PARALLEL_TRACK_SPACING = 22;
const DEFAULT_NODE_GROUP_CELL_WIDTH = 22;
const DEFAULT_NODE_GROUP_CELL_HEIGHT = 22;
const DEFAULT_HUB_OUTLINE_MODE = "box" as const;
const DEFAULT_HUB_OUTLINE_COLOR = "#111827";
const DEFAULT_HUB_OUTLINE_STROKE_STYLE = "solid" as const;
const DEFAULT_HUB_OUTLINE_SCALE = 1;
const DEFAULT_HUB_OUTLINE_CORNER_RADIUS = 10;
const DEFAULT_HUB_OUTLINE_STROKE_WIDTH = 3.25;
const DEFAULT_HUB_OUTLINE_CONCAVE_FACTOR = 0.45;
const DEFAULT_SEGMENT_INDICATOR_WIDTH = 16;
const DEFAULT_SELECTED_SEGMENT_INDICATOR_BOOST = 4;
const DEFAULT_GRID_LINE_OPACITY = 0.45;
const DEFAULT_LABEL_AXIS_SNAP_SENSITIVITY = 10;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}${Date.now()}-${idCounter}`;
}

export function createNodeId() {
  return nextId("n");
}

export function createSheetId() {
  return nextId("sh");
}

export function createStationId() {
  return nextId("s");
}

export function createStationKindId() {
  return nextId("sk");
}

export function createSegmentId() {
  return nextId("sg");
}

export function createLineId() {
  return nextId("l");
}

export function createLineRunId() {
  return nextId("lr");
}

export function pathFromPoints(points: MapPoint[]) {
  if (points.length < 2) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function createDefaultNode(map: RailwayMap): MapNode {
  const sheetId = map.model.sheets[0]?.id ?? "";
  return {
    id: createNodeId(),
    sheetId,
    x: 160 + (map.model.nodes.length % 5) * 90,
    y: 520,
  };
}

export function createDefaultNodeForSheet(map: RailwayMap, sheetId: string): MapNode {
  return {
    ...createDefaultNode(map),
    sheetId,
  };
}

export function createDefaultStation(map: RailwayMap, nodeId: string | null, name: string): Station {
  const node = nodeId ? map.model.nodes.find((candidate) => candidate.id === nodeId) : null;
  return {
    id: createStationId(),
    nodeId,
    name: name.trim() || `Station ${map.model.stations.length + 1}`,
    kindId: map.config.stationKinds[0]?.id ?? "",
    label: node
      ? {
          x: node.x,
          y: node.y - 24,
          align: "top",
        }
      : undefined,
  };
}

export function createDefaultStationAtNode(map: RailwayMap, node: MapNode, name: string): Station {
  return {
    id: createStationId(),
    nodeId: node.id,
    name: name.trim() || `Station ${map.model.stations.length + 1}`,
    kindId: map.config.stationKinds[0]?.id ?? "",
    label: {
      x: node.x + 12,
      y: node.y - 10,
      align: "right",
    },
  };
}

export function createDefaultLine(
  index: number,
  preset: { name: string; color: string; strokeWidth: number; strokeStyle: Line["strokeStyle"] },
): Line {
  return {
    id: createLineId(),
    name: preset.name.trim() || `L${index + 1}`,
    color: preset.color,
    strokeWidth: preset.strokeWidth,
    strokeStyle: preset.strokeStyle,
  };
}

export function lineStrokeDasharray(line: Line) {
  if (line.strokeStyle === "dashed") {
    return `${Math.max(8, line.strokeWidth * 1.8)} ${Math.max(6, line.strokeWidth * 1.2)}`;
  }

  if (line.strokeStyle === "dotted") {
    return `1 ${Math.max(6, line.strokeWidth * 1.4)}`;
  }

  return undefined;
}

export function createStraightSegment(fromNodeId: string, toNodeId: string): Segment {
  return {
    id: createSegmentId(),
    sheetId: "",
    fromNodeId,
    toNodeId,
    geometry: { kind: "straight" },
  };
}

export function createStraightSegmentForSheet(sheetId: string, fromNodeId: string, toNodeId: string): Segment {
  return {
    ...createStraightSegment(fromNodeId, toNodeId),
    sheetId,
  };
}

export function createDefaultSheet(map: RailwayMap, name: string): Sheet {
  return {
    id: createSheetId(),
    name: name.trim() || `Sheet ${map.model.sheets.length + 1}`,
  };
}

export function buildSegmentPoints(segment: Segment, nodesById: Map<string, MapNode>) {
  const from = nodesById.get(segment.fromNodeId);
  const to = nodesById.get(segment.toNodeId);

  if (!from || !to) return [];

  switch (segment.geometry.kind) {
    case "straight":
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
    case "orthogonal":
      return [
        { x: from.x, y: from.y },
        segment.geometry.elbow,
        { x: to.x, y: to.y },
      ];
    case "polyline":
      return [
        { x: from.x, y: from.y },
        ...segment.geometry.points,
        { x: to.x, y: to.y },
      ];
  }
}

export function buildSegmentPath(segment: Segment, nodesById: Map<string, MapNode>) {
  return pathFromPoints(buildSegmentPoints(segment, nodesById));
}

export type OrientedLineRunSegment = {
  segment: Segment;
  fromNodeId: string;
  toNodeId: string;
};

function orientSegmentsInStoredOrder(segments: Segment[]) {
  const seed = segments[0];
  if (!seed) return null;

  for (const reverseSeed of [false, true]) {
    const chain: OrientedLineRunSegment[] = [{
      segment: seed,
      fromNodeId: reverseSeed ? seed.toNodeId : seed.fromNodeId,
      toNodeId: reverseSeed ? seed.fromNodeId : seed.toNodeId,
    }];

    for (const segment of segments.slice(1)) {
      const endNodeId = chain[chain.length - 1].toNodeId;
      if (segment.fromNodeId === endNodeId) {
        chain.push({ segment, fromNodeId: segment.fromNodeId, toNodeId: segment.toNodeId });
      } else if (segment.toNodeId === endNodeId) {
        chain.push({ segment, fromNodeId: segment.toNodeId, toNodeId: segment.fromNodeId });
      } else {
        break;
      }
    }

    if (chain.length === segments.length) return chain;
  }

  return null;
}

export function buildLineRunSegmentChains(
  lineRun: LineRun,
  segmentsById: Map<string, Segment>,
) {
  const seenSegmentIds = new Set<string>();
  const remaining = lineRun.segmentIds
    .map((segmentId) => segmentsById.get(segmentId))
    .filter((segment): segment is Segment => {
      if (!segment || seenSegmentIds.has(segment.id)) return false;
      seenSegmentIds.add(segment.id);
      return true;
    });
  const storedOrderChain = orientSegmentsInStoredOrder(remaining);
  if (storedOrderChain) return [storedOrderChain];
  const chains: OrientedLineRunSegment[][] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift();
    if (!seed) break;
    const chain: OrientedLineRunSegment[] = [{
      segment: seed,
      fromNodeId: seed.fromNodeId,
      toNodeId: seed.toNodeId,
    }];

    while (remaining.length > 0) {
      const startNodeId = chain[0].fromNodeId;
      const endNodeId = chain[chain.length - 1].toNodeId;
      const appendIndex = remaining.findIndex(
        (segment) => segment.fromNodeId === endNodeId || segment.toNodeId === endNodeId,
      );
      if (appendIndex >= 0) {
        const [segment] = remaining.splice(appendIndex, 1);
        chain.push({
          segment,
          fromNodeId: endNodeId,
          toNodeId: segment.fromNodeId === endNodeId ? segment.toNodeId : segment.fromNodeId,
        });
        continue;
      }

      const prependIndex = remaining.findIndex(
        (segment) => segment.fromNodeId === startNodeId || segment.toNodeId === startNodeId,
      );
      if (prependIndex < 0) break;
      const [segment] = remaining.splice(prependIndex, 1);
      chain.unshift({
        segment,
        fromNodeId: segment.fromNodeId === startNodeId ? segment.toNodeId : segment.fromNodeId,
        toNodeId: startNodeId,
      });
    }

    chains.push(chain);
  }

  return chains;
}

export function orderLineRunSegmentIds(lineRun: LineRun, segmentsById: Map<string, Segment>) {
  return buildLineRunSegmentChains(lineRun, segmentsById).flatMap((chain) =>
    chain.map(({ segment }) => segment.id),
  );
}

export function getLineRunEndpointNodeIds(lineRun: LineRun, segmentsById: Map<string, Segment>) {
  const chains = buildLineRunSegmentChains(lineRun, segmentsById);
  const firstChain = chains[0];
  const lastChain = chains[chains.length - 1];
  if (!firstChain || !lastChain) return null;

  return {
    fromNodeId: firstChain[0].fromNodeId,
    toNodeId: lastChain[lastChain.length - 1].toNodeId,
  };
}

export function buildLineRunPointChains(
  lineRun: LineRun,
  segmentsById: Map<string, Segment>,
  nodesById: Map<string, MapNode>,
) {
  return buildLineRunSegmentChains(lineRun, segmentsById)
    .map((chain) =>
      chain.reduce<MapPoint[]>((points, orientedSegment) => {
        const segmentPoints = buildSegmentPoints(orientedSegment.segment, nodesById);
        if (segmentPoints.length < 2) return points;
        const orientedPoints =
          orientedSegment.segment.fromNodeId === orientedSegment.fromNodeId
            ? segmentPoints
            : [...segmentPoints].reverse();
        return points.length === 0 ? orientedPoints : [...points, ...orientedPoints.slice(1)];
      }, []),
    )
    .filter((points) => points.length > 1);
}

export function buildLineRunPath(
  lineRun: LineRun,
  segmentsById: Map<string, Segment>,
  nodesById: Map<string, MapNode>,
) {
  return buildLineRunPointChains(lineRun, segmentsById, nodesById)
    .map((points) => pathFromPoints(points))
    .filter(Boolean)
    .join(" ");
}

export function sanitizeRailwayMap(map: RailwayMap): RailwayMap {
  const sheetIds = new Set(map.model.sheets.map((sheet) => sheet.id));
  const nodes = map.model.nodes.filter((node) => sheetIds.has(node.sheetId));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const lineIds = new Set(map.config.lines.map((line) => line.id));
  const existingNodeLanes = (map.model.nodeLanes ?? [])
    .filter((lane) => nodeIds.has(lane.nodeId))
    .map((lane) => lineIds.has(lane.lineId ?? "") ? { ...lane } : { ...lane, lineId: undefined });
  const existingNodeLanesById = new Map(existingNodeLanes.map((lane) => [lane.id, lane]));
  const segments = map.model.segments
    .filter(
      (segment) =>
        sheetIds.has(segment.sheetId) &&
        nodesById.get(segment.fromNodeId)?.sheetId === segment.sheetId &&
        nodesById.get(segment.toNodeId)?.sheetId === segment.sheetId &&
        segment.fromNodeId !== segment.toNodeId,
    )
    .map((segment) => {
      const nextSegment = { ...segment };
      const fromLane = segment.fromLaneId ? existingNodeLanesById.get(segment.fromLaneId) : null;
      const toLane = segment.toLaneId ? existingNodeLanesById.get(segment.toLaneId) : null;
      if (!fromLane || fromLane.nodeId !== segment.fromNodeId) delete nextSegment.fromLaneId;
      if (!toLane || toLane.nodeId !== segment.toNodeId) delete nextSegment.toLaneId;
      return nextSegment;
    });
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));
  const sourceLineRunsByLineId = new Map<string, LineRun[]>();
  const claimingLineIdsBySegmentId = new Map<string, Set<string>>();
  for (const lineRun of map.model.lineRuns) {
    if (!lineIds.has(lineRun.lineId)) continue;
    const runsForLine = sourceLineRunsByLineId.get(lineRun.lineId) ?? [];
    runsForLine.push(lineRun);
    sourceLineRunsByLineId.set(lineRun.lineId, runsForLine);
    for (const segmentId of lineRun.segmentIds) {
      if (!segmentIds.has(segmentId)) continue;
      const claimingLineIds = claimingLineIdsBySegmentId.get(segmentId) ?? new Set<string>();
      claimingLineIds.add(lineRun.lineId);
      claimingLineIdsBySegmentId.set(segmentId, claimingLineIds);
    }
  }

  const owningLineIdBySegmentId = new Map<string, string>();
  for (const segment of segments) {
    const claimingLineIds = [...(claimingLineIdsBySegmentId.get(segment.id) ?? [])].sort();
    if (claimingLineIds.length === 0) continue;
    const endpointLineIds = [segment.fromLaneId, segment.toLaneId]
      .map((laneId) => laneId ? existingNodeLanesById.get(laneId)?.lineId : undefined)
      .filter((lineId): lineId is string => typeof lineId === "string" && claimingLineIds.includes(lineId))
      .sort();
    owningLineIdBySegmentId.set(segment.id, endpointLineIds[0] ?? claimingLineIds[0]);
  }

  const sanitizedLineRuns = map.config.lines.flatMap((line) => {
    const sourceRuns = [...(sourceLineRunsByLineId.get(line.id) ?? [])].sort((left, right) => left.id.localeCompare(right.id));
    if (sourceRuns.length === 0) return [];
    const seenIds = new Set<string>();
    const ownedSegmentIds = sourceRuns
      .flatMap((lineRun) => lineRun.segmentIds)
      .filter((segmentId) => {
        if (seenIds.has(segmentId) || owningLineIdBySegmentId.get(segmentId) !== line.id) return false;
        seenIds.add(segmentId);
        return true;
      });
    const mergedLineRun = {
      id: sourceRuns[0].id,
      lineId: line.id,
      segmentIds: ownedSegmentIds,
    };
    return [{
      ...mergedLineRun,
      segmentIds: orderLineRunSegmentIds(mergedLineRun, segmentsById),
    }];
  });

  const segmentsByNodeId = new Map<string, Segment[]>();
  for (const segment of segments) {
    const fromSegments = segmentsByNodeId.get(segment.fromNodeId) ?? [];
    fromSegments.push(segment);
    segmentsByNodeId.set(segment.fromNodeId, fromSegments);

    const toSegments = segmentsByNodeId.get(segment.toNodeId) ?? [];
    toSegments.push(segment);
    segmentsByNodeId.set(segment.toNodeId, toSegments);
  }

  const lineOrderById = new Map(map.config.lines.map((line, index) => [line.id, index]));
  const existingNodeLanesByNodeId = new Map<string, NodeLane[]>();
  for (const lane of existingNodeLanes) {
    const current = existingNodeLanesByNodeId.get(lane.nodeId) ?? [];
    current.push(lane);
    existingNodeLanesByNodeId.set(lane.nodeId, current);
  }

  const nextNodeLanes: NodeLane[] = [];
  const laneIdsByNodeIdAndKey = new Map<string, string>();

  for (const node of nodes) {
    const connectedSegments = segmentsByNodeId.get(node.id) ?? [];
    const existingForNode = [...(existingNodeLanesByNodeId.get(node.id) ?? [])].sort((left, right) => left.order - right.order);
    const isSimplePassThroughNode = connectedSegments.length === 2;

    const laneGroups = new Map<
      string,
      {
        existingLaneId: string | null;
        lineId: string | null;
      }
    >();

    for (const segment of connectedSegments) {
      const existingLaneId =
        segment.fromNodeId === node.id
          ? existingForNode.some((lane) => lane.id === segment.fromLaneId)
            ? segment.fromLaneId ?? null
            : null
          : existingForNode.some((lane) => lane.id === segment.toLaneId)
            ? segment.toLaneId ?? null
            : null;
      const lineId = owningLineIdBySegmentId.get(segment.id) ?? null;
      const groupKey = isSimplePassThroughNode
        ? existingLaneId ?? `through:${lineId ?? "unassigned"}`
        : existingLaneId ?? `auto:${lineId ?? `segment:${segment.id}`}`;

      if (!laneGroups.has(groupKey)) {
        laneGroups.set(groupKey, {
          existingLaneId,
          lineId,
        });
      }
    }

    for (const existingLane of existingForNode) {
      if (!laneGroups.has(existingLane.id)) {
        laneGroups.set(existingLane.id, {
          existingLaneId: existingLane.id,
          lineId: null,
        });
      }
    }

    const orderedLaneGroups = [...laneGroups.entries()].sort((left, right) => {
      const leftExistingIndex = left[1].existingLaneId ? existingForNode.findIndex((lane) => lane.id === left[1].existingLaneId) : -1;
      const rightExistingIndex = right[1].existingLaneId ? existingForNode.findIndex((lane) => lane.id === right[1].existingLaneId) : -1;

      if (leftExistingIndex >= 0 || rightExistingIndex >= 0) {
        if (leftExistingIndex < 0) return 1;
        if (rightExistingIndex < 0) return -1;
        return leftExistingIndex - rightExistingIndex;
      }

      const leftLineOrder = left[1].lineId ? (lineOrderById.get(left[1].lineId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const rightLineOrder = right[1].lineId ? (lineOrderById.get(right[1].lineId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (leftLineOrder !== rightLineOrder) return leftLineOrder - rightLineOrder;
      return left[0].localeCompare(right[0]);
    });

    for (let index = 0; index < orderedLaneGroups.length; index += 1) {
      const [groupKey, group] = orderedLaneGroups[index];
      const safeSuffix = (group.lineId ?? groupKey)
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || `lane-${index + 1}`;
      const laneId = group.existingLaneId ?? `nl-${node.id}-${safeSuffix}`;

      nextNodeLanes.push({
        id: laneId,
        nodeId: node.id,
        order: index,
        lineId: existingForNode.find((lane) => lane.id === laneId)?.lineId ?? group.lineId ?? undefined,
        gridColumn: existingForNode.find((lane) => lane.id === laneId)?.gridColumn,
        gridRow: existingForNode.find((lane) => lane.id === laneId)?.gridRow,
      });
      laneIdsByNodeIdAndKey.set(`${node.id}:${groupKey}`, laneId);
    }

    for (const segment of connectedSegments) {
      const groupKeyBase =
        node.id === segment.fromNodeId
          ? segment.fromLaneId && existingForNode.some((lane) => lane.id === segment.fromLaneId)
            ? segment.fromLaneId
            : null
          : segment.toLaneId && existingForNode.some((lane) => lane.id === segment.toLaneId)
            ? segment.toLaneId
            : null;
      const lineId = owningLineIdBySegmentId.get(segment.id) ?? null;
      const groupKey = isSimplePassThroughNode
        ? groupKeyBase ?? `through:${lineId ?? "unassigned"}`
        : groupKeyBase ?? `auto:${lineId ?? `segment:${segment.id}`}`;
      const laneId = laneIdsByNodeIdAndKey.get(`${node.id}:${groupKey}`);
      if (!laneId) continue;

      if (segment.fromNodeId === node.id) {
        segment.fromLaneId = laneId;
      } else if (segment.toNodeId === node.id) {
        segment.toLaneId = laneId;
      }
    }
  }

  return {
    ...map,
    config: {
      ...map.config,
      parallelTrackSpacing: map.config.parallelTrackSpacing ?? DEFAULT_PARALLEL_TRACK_SPACING,
      nodeGroupCellWidth: map.config.nodeGroupCellWidth ?? DEFAULT_NODE_GROUP_CELL_WIDTH,
      nodeGroupCellHeight: map.config.nodeGroupCellHeight ?? DEFAULT_NODE_GROUP_CELL_HEIGHT,
      hubOutlineMode: map.config.hubOutlineMode ?? DEFAULT_HUB_OUTLINE_MODE,
      hubOutlineColor: map.config.hubOutlineColor ?? DEFAULT_HUB_OUTLINE_COLOR,
      hubOutlineStrokeStyle: map.config.hubOutlineStrokeStyle ?? DEFAULT_HUB_OUTLINE_STROKE_STYLE,
      hubOutlineScale: map.config.hubOutlineScale ?? DEFAULT_HUB_OUTLINE_SCALE,
      hubOutlineCornerRadius: map.config.hubOutlineCornerRadius ?? DEFAULT_HUB_OUTLINE_CORNER_RADIUS,
      hubOutlineStrokeWidth: map.config.hubOutlineStrokeWidth ?? DEFAULT_HUB_OUTLINE_STROKE_WIDTH,
      hubOutlineConcaveFactor: map.config.hubOutlineConcaveFactor ?? DEFAULT_HUB_OUTLINE_CONCAVE_FACTOR,
      segmentIndicatorWidth: map.config.segmentIndicatorWidth ?? DEFAULT_SEGMENT_INDICATOR_WIDTH,
      selectedSegmentIndicatorBoost: map.config.selectedSegmentIndicatorBoost ?? DEFAULT_SELECTED_SEGMENT_INDICATOR_BOOST,
      gridLineOpacity: map.config.gridLineOpacity ?? DEFAULT_GRID_LINE_OPACITY,
      labelAxisSnapSensitivity: map.config.labelAxisSnapSensitivity ?? DEFAULT_LABEL_AXIS_SNAP_SENSITIVITY,
    },
    model: {
      ...map.model,
      nodes,
      nodeLanes: nextNodeLanes,
      stations: (() => {
        const claimedNodeIds = new Set<string>();

        return map.model.stations.map((station) => {
          if (!station.nodeId || !nodeIds.has(station.nodeId)) {
            return station.nodeId
              ? {
                  ...station,
                  nodeId: null,
                  label: undefined,
                }
              : station;
          }

          if (claimedNodeIds.has(station.nodeId)) {
            return {
              ...station,
              nodeId: null,
              label: undefined,
            };
          }

          claimedNodeIds.add(station.nodeId);
          return station;
        });
      })(),
      segments,
      lineRuns: sanitizedLineRuns,
    },
  };
}
