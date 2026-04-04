import type { LineRun, Line, MapNode, MapPoint, RailwayMap, Segment, Sheet, Station } from "./types";

let idCounter = 0;

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
  const segments = map.model.segments.filter(
    (segment) =>
      sheetIds.has(segment.sheetId) &&
      nodeIds.has(segment.fromNodeId) &&
      nodeIds.has(segment.toNodeId) &&
      segment.fromNodeId !== segment.toNodeId,
  );
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

  function assignSegmentToLine(segmentId: string, lineId: string) {
    const targetIndex = lineRunIndexByLineId.get(lineId);
    if (targetIndex === undefined) return;

    for (const lineRun of sanitizedLineRuns) {
      lineRun.segmentIds = lineRun.segmentIds.filter((candidateId) => candidateId !== segmentId);
    }

    const targetRun = sanitizedLineRuns[targetIndex];
    if (!targetRun.segmentIds.includes(segmentId)) {
      targetRun.segmentIds.push(segmentId);
    }
    owningLineIdBySegmentId.set(segmentId, lineId);
  }

  for (const connectedSegments of segmentsByNodeId.values()) {
    if (connectedSegments.length !== 2) continue;

    const [firstSegment, secondSegment] = connectedSegments;
    const firstLineId = owningLineIdBySegmentId.get(firstSegment.id) ?? null;
    const secondLineId = owningLineIdBySegmentId.get(secondSegment.id) ?? null;
    const preferredLineId = firstLineId ?? secondLineId;

    if (!preferredLineId) continue;
    if (firstLineId === preferredLineId && secondLineId === preferredLineId) continue;

    assignSegmentToLine(firstSegment.id, preferredLineId);
    assignSegmentToLine(secondSegment.id, preferredLineId);
  }

  return {
    ...map,
    model: {
      ...map.model,
      nodes,
      stations: map.model.stations.map((station) => {
        if (!station.nodeId || nodeIds.has(station.nodeId)) return station;
        return {
          ...station,
          nodeId: null,
          label: undefined,
        };
      }),
      segments,
      lineRuns: sanitizedLineRuns,
    },
  };
}
