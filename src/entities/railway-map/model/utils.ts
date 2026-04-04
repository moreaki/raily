import type { LineRun, Line, MapNode, MapPoint, RailwayMap, Segment, Sheet, Station } from "./types";

function nextId(prefix: string) {
  return `${prefix}${Date.now()}`;
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
  const sheetId = map.sheets[0]?.id ?? "";
  return {
    id: createNodeId(),
    sheetId,
    x: 160 + (map.nodes.length % 5) * 90,
    y: 520,
  };
}

export function createDefaultNodeForSheet(map: RailwayMap, sheetId: string): MapNode {
  return {
    ...createDefaultNode(map),
    sheetId,
  };
}

export function createDefaultStation(map: RailwayMap, nodeId: string, name: string): Station {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return {
    id: createStationId(),
    nodeId,
    name: name.trim() || `Station ${map.stations.length + 1}`,
    kindId: map.stationKinds[0]?.id ?? "",
    label: {
      x: node?.x ?? 160,
      y: (node?.y ?? 520) - 24,
      align: "top",
    },
  };
}

export function createDefaultStationAtNode(map: RailwayMap, node: MapNode, name: string): Station {
  return {
    id: createStationId(),
    nodeId: node.id,
    name: name.trim() || `Station ${map.stations.length + 1}`,
    kindId: map.stationKinds[0]?.id ?? "",
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
    name: name.trim() || `Sheet ${map.sheets.length + 1}`,
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
