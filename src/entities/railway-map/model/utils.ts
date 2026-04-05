import type { LineRun, Line, MapNode, MapPoint, NodeLane, RailwayMap, Segment, Sheet, Station } from "./types";

let idCounter = 0;
const DEFAULT_PARALLEL_TRACK_SPACING = 22;
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
  preset: { id: string; color: string; strokeWidth: number; strokeStyle: Line["strokeStyle"] },
): Line {
  return {
    id: createLineId(),
    name: preset.id || `L${index + 1}`,
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

function reversePoints(points: MapPoint[]) {
  return [...points].reverse();
}

function pointsEqual(left: MapPoint, right: MapPoint) {
  return left.x === right.x && left.y === right.y;
}

export function buildLineRunPointChains(
  lineRun: LineRun,
  segmentsById: Map<string, Segment>,
  nodesById: Map<string, MapNode>,
) {
  const chains: MapPoint[][] = [];
  let currentChain: MapPoint[] = [];

  for (const segmentId of lineRun.segmentIds) {
    const segment = segmentsById.get(segmentId);
    if (!segment) continue;

    const points = buildSegmentPoints(segment, nodesById);
    if (points.length < 2) continue;

    if (currentChain.length === 0) {
      currentChain = [...points];
      continue;
    }

    const currentEnd = currentChain[currentChain.length - 1];
    const forwardStart = points[0];
    const forwardEnd = points[points.length - 1];

    if (pointsEqual(currentEnd, forwardStart)) {
      currentChain.push(...points.slice(1));
      continue;
    }

    if (pointsEqual(currentEnd, forwardEnd)) {
      currentChain.push(...reversePoints(points).slice(1));
      continue;
    }

    chains.push(currentChain);
    currentChain = [...points];
  }

  if (currentChain.length > 0) {
    chains.push(currentChain);
  }

  return chains;
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
  const segments = map.model.segments
    .filter(
    (segment) =>
      sheetIds.has(segment.sheetId) &&
      nodeIds.has(segment.fromNodeId) &&
      nodeIds.has(segment.toNodeId) &&
      segment.fromNodeId !== segment.toNodeId,
    )
    .map((segment) => ({ ...segment }));
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const lineIds = new Set(map.config.lines.map((line) => line.id));
  const claimedSegmentIds = new Set<string>();
  const sanitizedLineRuns = map.model.lineRuns
    .filter((lineRun) => lineIds.has(lineRun.lineId))
    .map((lineRun) => ({
      ...lineRun,
      segmentIds: lineRun.segmentIds.filter((segmentId) => {
        if (!segmentIds.has(segmentId) || claimedSegmentIds.has(segmentId)) return false;
        claimedSegmentIds.add(segmentId);
        return true;
      }),
    }));

  const lineRunIndexByLineId = new Map(sanitizedLineRuns.map((lineRun, index) => [lineRun.lineId, index]));
  const owningLineIdBySegmentId = new Map<string, string>();
  for (const lineRun of sanitizedLineRuns) {
    for (const segmentId of lineRun.segmentIds) {
      if (!owningLineIdBySegmentId.has(segmentId)) {
        owningLineIdBySegmentId.set(segmentId, lineRun.lineId);
      }
    }
  }

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
  const existingNodeLanes = (map.model.nodeLanes ?? []).filter((lane) => nodeIds.has(lane.nodeId));
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
