import type { MapNode, MapPoint, RailwayMap, Station, StationKind, StationLabelFontWeight } from "@/entities/railway-map/model/types";
import { buildSegmentPoints } from "@/entities/railway-map/model/utils";
import { clamp } from "@/features/railway-map-editor/lib/geometry";

export const LABEL_FONT_SIZE = 14;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 8;
export const DEFAULT_STATION_FONT_FAMILY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
export const DEFAULT_STATION_FONT_WEIGHT: StationLabelFontWeight = "600";
export const DEFAULT_STATION_FONT_SIZE = 14;
export const DEFAULT_STATION_SYMBOL_SIZE = 1;
export const STATION_FONT_WEIGHT_OPTIONS: StationLabelFontWeight[] = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
export const AUTO_LABEL_ROTATIONS = [0, 45, -45, 90, -90, 135, -135, 180] as const;
export const LABEL_AXIS_SNAP_THRESHOLD = 10;

export type LabelBox = {
  localMinX: number;
  localMaxX: number;
  localMinY: number;
  localMaxY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  center: MapPoint;
  corners: MapPoint[];
};

type ResolvedLabelPlacement = {
  stationId: string;
  nodeId: string;
  box: LabelBox;
  position: {
    x: number;
    y: number;
    align?: "left" | "right" | "top" | "bottom";
    rotation?: number;
  };
};

type CorridorOrientation = "horizontal" | "vertical" | "diag-pos" | "diag-neg" | "mixed";
type CorridorSide = "positive" | "negative";

type StationCorridorHint = {
  orientation: CorridorOrientation;
  preferredSide?: CorridorSide;
};

type StationSequenceHint = {
  previousStationIds: string[];
  nextStationIds: string[];
  order: number;
};

type AutoPlaceOptions = {
  preserveExisting?: boolean;
  bootstrapMode?: boolean;
  sheetId?: string;
};

type SegmentSpatialEntry = {
  id: string;
  points: MapPoint[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type LabelPlacementContext = {
  workingMap: RailwayMap;
  nodesById: Map<string, MapNode>;
  stationKindsById: Map<string, StationKind>;
  stationLineIdsByStationId: Map<string, Set<string>>;
  stationCorridorHintsByStationId: Map<string, StationCorridorHint>;
  stationSequenceHintsByStationId: Map<string, StationSequenceHint>;
  sheetSegmentEntriesBySheetId: Map<string, SegmentSpatialEntry[]>;
  sheetSegmentBucketsBySheetId: Map<string, Map<string, SegmentSpatialEntry[]>>;
};

const SEGMENT_BUCKET_SIZE = 180;

export function rotatePoint(point: MapPoint, center: MapPoint, rotation: number) {
  if (rotation === 0) return point;
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  return {
    x: center.x + deltaX * cos - deltaY * sin,
    y: center.y + deltaX * sin + deltaY * cos,
  };
}

function estimateTextWidth(label: string, fontSize: number) {
  const normalized = label.normalize("NFD").replace(/\p{Diacritic}+/gu, "");
  let width = 0;

  for (const char of normalized) {
    if (char === " ") {
      width += fontSize * 0.33;
      continue;
    }
    if (/[.,:;!'"`|]/.test(char)) {
      width += fontSize * 0.22;
      continue;
    }
    if (/[-_/()]/.test(char)) {
      width += fontSize * 0.3;
      continue;
    }
    if (/[iljftI]/.test(char)) {
      width += fontSize * 0.32;
      continue;
    }
    if (/[mwMW@#&%]/.test(char)) {
      width += fontSize * 0.82;
      continue;
    }
    if (/[A-ZÀ-Ý]/.test(char)) {
      width += fontSize * 0.62;
      continue;
    }
    if (/[0-9]/.test(char)) {
      width += fontSize * 0.56;
      continue;
    }

    width += fontSize * 0.5;
  }

  return Math.max(fontSize * 1.4, width);
}

export function estimateLabelBox(label: string, x: number, y: number, fontSize = LABEL_FONT_SIZE, rotation = 0): LabelBox {
  const width = estimateTextWidth(label, fontSize);
  const height = fontSize + 8;
  const localMinX = x - LABEL_PADDING_X / 2;
  const localMaxX = x + width + LABEL_PADDING_X / 2;
  const localMinY = y - height + LABEL_PADDING_Y / 2;
  const localMaxY = y + LABEL_PADDING_Y / 2;
  const center = {
    x: (localMinX + localMaxX) / 2,
    y: (localMinY + localMaxY) / 2,
  };
  const corners = [
    rotatePoint({ x: localMinX, y: localMinY }, center, rotation),
    rotatePoint({ x: localMaxX, y: localMinY }, center, rotation),
    rotatePoint({ x: localMaxX, y: localMaxY }, center, rotation),
    rotatePoint({ x: localMinX, y: localMaxY }, center, rotation),
  ];

  return {
    localMinX,
    localMaxX,
    localMinY,
    localMaxY,
    minX: Math.min(...corners.map((corner) => corner.x)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
    center,
    corners,
  };
}

export function boxesOverlap(left: LabelBox, right: LabelBox) {
  const polygons = [left.corners, right.corners];
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const axis = { x: -(next.y - current.y), y: next.x - current.x };
      const projections = [left.corners, right.corners].map((corners) =>
        corners.map((corner) => corner.x * axis.x + corner.y * axis.y),
      );
      const [leftMin, leftMax] = [Math.min(...projections[0]), Math.max(...projections[0])];
      const [rightMin, rightMax] = [Math.min(...projections[1]), Math.max(...projections[1])];
      if (leftMax < rightMin || rightMax < leftMin) {
        return false;
      }
    }
  }

  return true;
}

export function pointToSegmentDistance(point: MapPoint, start: MapPoint, end: MapPoint) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared, 0, 1);
  const projectedX = start.x + deltaX * t;
  const projectedY = start.y + deltaY * t;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

export function pointInBox(point: MapPoint, box: LabelBox, padding = 0) {
  return (
    point.x >= box.minX - padding &&
    point.x <= box.maxX + padding &&
    point.y >= box.minY - padding &&
    point.y <= box.maxY + padding
  );
}

function getBucketKey(x: number, y: number, bucketSize = SEGMENT_BUCKET_SIZE) {
  return `${Math.floor(x / bucketSize)}:${Math.floor(y / bucketSize)}`;
}

function addSegmentToBuckets(
  buckets: Map<string, SegmentSpatialEntry[]>,
  entry: SegmentSpatialEntry,
  bucketSize = SEGMENT_BUCKET_SIZE,
) {
  const minBucketX = Math.floor(entry.minX / bucketSize);
  const maxBucketX = Math.floor(entry.maxX / bucketSize);
  const minBucketY = Math.floor(entry.minY / bucketSize);
  const maxBucketY = Math.floor(entry.maxY / bucketSize);

  for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
    for (let bucketY = minBucketY; bucketY <= maxBucketY; bucketY += 1) {
      const key = `${bucketX}:${bucketY}`;
      const list = buckets.get(key) ?? [];
      list.push(entry);
      buckets.set(key, list);
    }
  }
}

function getNearbySegmentEntries(
  box: LabelBox,
  buckets: Map<string, SegmentSpatialEntry[]>,
  padding = 24,
  bucketSize = SEGMENT_BUCKET_SIZE,
) {
  const minBucketX = Math.floor((box.minX - padding) / bucketSize);
  const maxBucketX = Math.floor((box.maxX + padding) / bucketSize);
  const minBucketY = Math.floor((box.minY - padding) / bucketSize);
  const maxBucketY = Math.floor((box.maxY + padding) / bucketSize);
  const entries = new Map<string, SegmentSpatialEntry>();

  for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
    for (let bucketY = minBucketY; bucketY <= maxBucketY; bucketY += 1) {
      const key = `${bucketX}:${bucketY}`;
      for (const entry of buckets.get(key) ?? []) {
        entries.set(entry.id, entry);
      }
    }
  }

  return [...entries.values()];
}

function pointInPolygon(point: MapPoint, polygon: MapPoint[]) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = (next.x - current.x) * (point.y - current.y) - (next.y - current.y) * (point.x - current.x);
    if (Math.abs(cross) < 0.0001) continue;
    const nextSign = Math.sign(cross);
    if (sign === 0) {
      sign = nextSign;
      continue;
    }
    if (nextSign !== sign) return false;
  }
  return true;
}

function orientation(a: MapPoint, b: MapPoint, c: MapPoint) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.0001) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: MapPoint, b: MapPoint, c: MapPoint) {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

function segmentsIntersect(a1: MapPoint, a2: MapPoint, b1: MapPoint, b2: MapPoint) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

export function segmentIntersectsLabelBox(start: MapPoint, end: MapPoint, box: LabelBox, padding = 8) {
  if (pointInPolygon(start, box.corners) || pointInPolygon(end, box.corners)) {
    return true;
  }

  for (let index = 0; index < box.corners.length; index += 1) {
    const corner = box.corners[index];
    const nextCorner = box.corners[(index + 1) % box.corners.length];
    if (segmentsIntersect(start, end, corner, nextCorner)) {
      return true;
    }
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < box.corners.length; index += 1) {
    const corner = box.corners[index];
    const nextCorner = box.corners[(index + 1) % box.corners.length];
    minDistance = Math.min(minDistance, pointToSegmentDistance(corner, start, end));
    minDistance = Math.min(minDistance, pointToSegmentDistance(start, corner, nextCorner));
    minDistance = Math.min(minDistance, pointToSegmentDistance(end, corner, nextCorner));
  }

  return minDistance < padding;
}

export function getStationLabelPosition(station: Station, node: MapNode) {
  return {
    x: station.label?.x ?? node.x + 12,
    y: station.label?.y ?? node.y - 10,
    align: station.label?.align ?? "right",
    rotation: station.label?.rotation ?? 0,
  };
}

function inferLabelAlign(node: MapNode, position: { x: number; y: number; align?: "left" | "right" | "top" | "bottom" }) {
  if (position.align) return position.align;
  const deltaX = position.x - node.x;
  const deltaY = position.y - node.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }
  return deltaY >= 0 ? "bottom" : "top";
}

function getOrientationFromDelta(deltaX: number, deltaY: number): CorridorOrientation {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX === 0 && absY === 0) return "mixed";
  if (absX >= absY * 1.6) return "horizontal";
  if (absY >= absX * 1.6) return "vertical";
  return deltaX * deltaY >= 0 ? "diag-pos" : "diag-neg";
}

function buildStationCorridorHints(
  current: RailwayMap,
  stationLineIdsByStationId: Map<string, Set<string>>,
  nodesById: Map<string, MapNode>,
) {
  const lineIdsBySegmentId = new Map<string, Set<string>>();
  for (const lineRun of current.model.lineRuns) {
    for (const segmentId of lineRun.segmentIds) {
      const lineIds = lineIdsBySegmentId.get(segmentId) ?? new Set<string>();
      lineIds.add(lineRun.lineId);
      lineIdsBySegmentId.set(segmentId, lineIds);
    }
  }

  const segmentOrientationByStationId = new Map<string, CorridorOrientation[]>();
  for (const station of current.model.stations) {
    if (!station.nodeId) continue;
    const currentNode = nodesById.get(station.nodeId);
    if (!currentNode) continue;
    const stationLineIds = stationLineIdsByStationId.get(station.id) ?? new Set<string>();
    const orientations: CorridorOrientation[] = [];

    for (const segment of current.model.segments) {
      if (segment.fromNodeId !== station.nodeId && segment.toNodeId !== station.nodeId) continue;
      const segmentLineIds = lineIdsBySegmentId.get(segment.id) ?? new Set<string>();
      const sharesLine = [...segmentLineIds].some((lineId) => stationLineIds.has(lineId));
      if (!sharesLine) continue;
      const otherNodeId = segment.fromNodeId === station.nodeId ? segment.toNodeId : segment.fromNodeId;
      const otherNode = nodesById.get(otherNodeId);
      if (!otherNode) continue;
      orientations.push(getOrientationFromDelta(otherNode.x - currentNode.x, otherNode.y - currentNode.y));
    }

    segmentOrientationByStationId.set(station.id, orientations);
  }

  const corridorGroups = new Map<string, { orientation: CorridorOrientation; stationIds: Set<string> }>();
  for (const lineRun of current.model.lineRuns) {
    for (const segmentId of lineRun.segmentIds) {
      const segment = current.model.segments.find((candidate) => candidate.id === segmentId);
      if (!segment) continue;
      const fromNode = nodesById.get(segment.fromNodeId);
      const toNode = nodesById.get(segment.toNodeId);
      if (!fromNode || !toNode) continue;
      const orientation = getOrientationFromDelta(toNode.x - fromNode.x, toNode.y - fromNode.y);
      if (orientation === "mixed") continue;
      const key = `${segment.sheetId}:${lineRun.lineId}:${orientation}`;
      const group = corridorGroups.get(key) ?? { orientation, stationIds: new Set<string>() };
      for (const station of current.model.stations) {
        if (station.nodeId === segment.fromNodeId || station.nodeId === segment.toNodeId) {
          group.stationIds.add(station.id);
        }
      }
      corridorGroups.set(key, group);
    }
  }

  const preferredSideByStationId = new Map<string, CorridorSide>();
  for (const group of corridorGroups.values()) {
    const stations = [...group.stationIds]
      .map((stationId) => current.model.stations.find((station) => station.id === stationId))
      .filter((station): station is Station => Boolean(station?.nodeId))
      .map((station) => {
        const node = nodesById.get(station.nodeId!);
        return node ? { station, node } : null;
      })
      .filter((value): value is { station: Station; node: MapNode } => Boolean(value));
    if (stations.length < 2) continue;

    const sideScore = new Map<CorridorSide, number>([
      ["positive", 0],
      ["negative", 0],
    ]);

    for (const side of ["positive", "negative"] as const) {
      for (const { station, node } of stations) {
        const baseCandidate = buildCandidatePositions(node, { orientation: group.orientation, preferredSide: side })
          .find((candidate) => candidate.rotation === 0 && isLabelOnPositiveSide(candidate, node, group.orientation) === (side === "positive"));
        if (!baseCandidate) continue;
        const fontSize = getStationKindFontSize(current.config.stationKinds.find((kind) => kind.id === station.kindId));
        const box = estimateLabelBox(station.name, baseCandidate.x, baseCandidate.y, fontSize, 0);
        let score = Math.hypot(baseCandidate.x - node.x, baseCandidate.y - node.y) * 0.15;
        for (const segment of current.model.segments) {
          const points = buildSegmentPoints(segment, nodesById);
          for (let index = 0; index < points.length - 1; index += 1) {
            if (segmentIntersectsLabelBox(points[index], points[index + 1], box, 8)) {
              score += 250;
            }
          }
        }
        sideScore.set(side, (sideScore.get(side) ?? 0) + score);
      }
    }

    const preferredSide = (sideScore.get("positive") ?? 0) <= (sideScore.get("negative") ?? 0) ? "positive" : "negative";
    for (const stationId of group.stationIds) {
      preferredSideByStationId.set(stationId, preferredSide);
    }
  }

  const hints = new Map<string, StationCorridorHint>();
  for (const station of current.model.stations) {
    const orientations = segmentOrientationByStationId.get(station.id) ?? [];
    const counts = new Map<CorridorOrientation, number>();
    for (const orientation of orientations) {
      counts.set(orientation, (counts.get(orientation) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "mixed";
    hints.set(station.id, { orientation: dominant, preferredSide: preferredSideByStationId.get(station.id) });
  }

  return hints;
}

function buildStationSequenceHints(current: RailwayMap) {
  const stationsByNodeId = new Map<string, Station[]>();
  for (const station of current.model.stations) {
    if (!station.nodeId) continue;
    const list = stationsByNodeId.get(station.nodeId) ?? [];
    list.push(station);
    stationsByNodeId.set(station.nodeId, list);
  }

  const hints = new Map<string, StationSequenceHint>();
  for (const lineRun of current.model.lineRuns) {
    const orderedNodeIds: string[] = [];
    for (const segmentId of lineRun.segmentIds) {
      const segment = current.model.segments.find((candidate) => candidate.id === segmentId);
      if (!segment) continue;
      if (orderedNodeIds.length === 0) {
        orderedNodeIds.push(segment.fromNodeId, segment.toNodeId);
        continue;
      }
      const last = orderedNodeIds[orderedNodeIds.length - 1];
      if (last === segment.fromNodeId) {
        orderedNodeIds.push(segment.toNodeId);
      } else if (last === segment.toNodeId) {
        orderedNodeIds.push(segment.fromNodeId);
      } else {
        orderedNodeIds.push(segment.fromNodeId, segment.toNodeId);
      }
    }

    const orderedStationIds = orderedNodeIds
      .flatMap((nodeId) => (stationsByNodeId.get(nodeId) ?? []).map((station) => station.id))
      .filter((stationId, index, values) => stationId !== values[index - 1]);

    orderedStationIds.forEach((stationId, index) => {
      const currentHint = hints.get(stationId) ?? { previousStationIds: [], nextStationIds: [], order: index };
      if (index > 0) {
        currentHint.previousStationIds = [...new Set([...currentHint.previousStationIds, orderedStationIds[index - 1]])];
      }
      if (index < orderedStationIds.length - 1) {
        currentHint.nextStationIds = [...new Set([...currentHint.nextStationIds, orderedStationIds[index + 1]])];
      }
      currentHint.order = Math.min(currentHint.order, index);
      hints.set(stationId, currentHint);
    });
  }

  return hints;
}

function buildCandidatePositions(node: MapNode, hint: StationCorridorHint | null | undefined) {
  const rightCandidates = [
    { x: node.x + 14, y: node.y - 12, align: "right" as const, rotation: 0 },
    { x: node.x + 18, y: node.y - 4, align: "right" as const, rotation: 0 },
    { x: node.x + 20, y: node.y + 8, align: "right" as const, rotation: 0 },
    { x: node.x + 24, y: node.y + 20, align: "right" as const, rotation: 0 },
  ];
  const leftCandidates = [
    { x: node.x - 78, y: node.y - 12, align: "left" as const, rotation: 0 },
    { x: node.x - 82, y: node.y - 4, align: "left" as const, rotation: 0 },
    { x: node.x - 86, y: node.y + 8, align: "left" as const, rotation: 0 },
    { x: node.x - 92, y: node.y + 20, align: "left" as const, rotation: 0 },
  ];
  const topCandidates = [
    { x: node.x - 18, y: node.y - 22, align: "top" as const, rotation: 0 },
    { x: node.x - 36, y: node.y - 22, align: "top" as const, rotation: 0 },
    { x: node.x - 54, y: node.y - 22, align: "top" as const, rotation: 0 },
    { x: node.x - 72, y: node.y - 22, align: "top" as const, rotation: 0 },
  ];
  const bottomCandidates = [
    { x: node.x - 18, y: node.y + 34, align: "bottom" as const, rotation: 0 },
    { x: node.x - 36, y: node.y + 34, align: "bottom" as const, rotation: 0 },
    { x: node.x - 54, y: node.y + 34, align: "bottom" as const, rotation: 0 },
    { x: node.x - 72, y: node.y + 34, align: "bottom" as const, rotation: 0 },
  ];

  const sideOrder =
    hint?.orientation === "horizontal"
      ? hint.preferredSide === "negative"
        ? [topCandidates, bottomCandidates, rightCandidates, leftCandidates]
        : [bottomCandidates, topCandidates, rightCandidates, leftCandidates]
      : hint?.orientation === "vertical"
        ? hint.preferredSide === "negative"
          ? [leftCandidates, rightCandidates, topCandidates, bottomCandidates]
          : [rightCandidates, leftCandidates, topCandidates, bottomCandidates]
        : hint?.orientation === "diag-pos"
          ? hint.preferredSide === "negative"
            ? [rightCandidates, leftCandidates, topCandidates, bottomCandidates]
            : [leftCandidates, rightCandidates, topCandidates, bottomCandidates]
          : hint?.orientation === "diag-neg"
            ? hint.preferredSide === "negative"
              ? [leftCandidates, rightCandidates, topCandidates, bottomCandidates]
              : [rightCandidates, leftCandidates, topCandidates, bottomCandidates]
            : [rightCandidates, leftCandidates, topCandidates, bottomCandidates];

  const base = sideOrder.flat();
  const rotated = base
    .slice(0, 6)
    .flatMap((candidate) =>
      AUTO_LABEL_ROTATIONS.filter((rotation) => rotation !== 0).map((rotation) => ({
        ...candidate,
        rotation,
      })),
    );

  return [...base, ...rotated];
}

function candidateLabelPositions(node: MapNode, hint?: StationCorridorHint | null) {
  return buildCandidatePositions(node, hint);
}

function candidateBootstrapLabelPositions(station: Station, node: MapNode, hint?: StationCorridorHint | null) {
  const current = getStationLabelPosition(station, node);
  const localOffsets = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: -12, y: 0 },
    { x: 0, y: -12 },
    { x: 0, y: 12 },
    { x: 18, y: 0 },
    { x: -18, y: 0 },
    { x: 0, y: -18 },
    { x: 0, y: 18 },
    { x: 12, y: -12 },
    { x: 12, y: 12 },
    { x: -12, y: -12 },
    { x: -12, y: 12 },
    { x: 24, y: 0 },
    { x: -24, y: 0 },
    { x: 0, y: -24 },
    { x: 0, y: 24 },
  ];

  const localCandidates = localOffsets.map((offset) => {
    const next = {
      x: current.x + offset.x,
      y: current.y + offset.y,
      rotation: current.rotation ?? 0,
    };
    return {
      ...next,
      align: inferLabelAlign(node, next),
    };
  });

  const fallbackCandidates = candidateLabelPositions(node, hint).filter((candidate) => candidate.rotation === 0);
  const uniqueCandidates = new Map<string, (typeof localCandidates)[number]>();
  for (const candidate of [...localCandidates, ...fallbackCandidates]) {
    const key = `${Math.round(candidate.x)}:${Math.round(candidate.y)}:${candidate.align}:${candidate.rotation ?? 0}`;
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, candidate);
    }
  }

  return [...uniqueCandidates.values()];
}

export function buildStationLineIdsByStationId(map: RailwayMap) {
  const segmentIdsByNodeId = new Map<string, Set<string>>();

  for (const segment of map.model.segments) {
    const fromSet = segmentIdsByNodeId.get(segment.fromNodeId) ?? new Set<string>();
    fromSet.add(segment.id);
    segmentIdsByNodeId.set(segment.fromNodeId, fromSet);

    const toSet = segmentIdsByNodeId.get(segment.toNodeId) ?? new Set<string>();
    toSet.add(segment.id);
    segmentIdsByNodeId.set(segment.toNodeId, toSet);
  }

  const lineIdsBySegmentId = new Map<string, Set<string>>();
  for (const lineRun of map.model.lineRuns) {
    for (const segmentId of lineRun.segmentIds) {
      const lineIds = lineIdsBySegmentId.get(segmentId) ?? new Set<string>();
      lineIds.add(lineRun.lineId);
      lineIdsBySegmentId.set(segmentId, lineIds);
    }
  }

  const stationLineIdsByStationId = new Map<string, Set<string>>();
  for (const station of map.model.stations) {
    if (!station.nodeId) {
      stationLineIdsByStationId.set(station.id, new Set());
      continue;
    }

    const segmentIds = segmentIdsByNodeId.get(station.nodeId) ?? new Set<string>();
    const lineIds = new Set<string>();
    for (const segmentId of segmentIds) {
      for (const lineId of lineIdsBySegmentId.get(segmentId) ?? []) {
        lineIds.add(lineId);
      }
    }
    stationLineIdsByStationId.set(station.id, lineIds);
  }

  return stationLineIdsByStationId;
}

function buildWorkingMapForSheet(current: RailwayMap, sheetId?: string) {
  if (!sheetId) return current;

  const nodes = current.model.nodes.filter((node) => node.sheetId === sheetId);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const segments = current.model.segments.filter(
    (segment) => segment.sheetId === sheetId && nodeIds.has(segment.fromNodeId) && nodeIds.has(segment.toNodeId),
  );
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const stations = current.model.stations.filter((station) => !station.nodeId || nodeIds.has(station.nodeId));
  const lineRuns = current.model.lineRuns
    .map((lineRun) => ({
      ...lineRun,
      segmentIds: lineRun.segmentIds.filter((segmentId) => segmentIds.has(segmentId)),
    }))
    .filter((lineRun) => lineRun.segmentIds.length > 0);
  const nodeLanes = current.model.nodeLanes.filter((lane) => nodeIds.has(lane.nodeId));
  const sheets = current.model.sheets.filter((sheet) => sheet.id === sheetId);

  return {
    ...current,
    model: {
      ...current.model,
      sheets,
      nodes,
      nodeLanes,
      stations,
      segments,
      lineRuns,
    },
  };
}

function buildLabelPlacementContext(current: RailwayMap, options?: AutoPlaceOptions): LabelPlacementContext {
  const workingMap = buildWorkingMapForSheet(current, options?.sheetId);
  const nodesById = new Map(workingMap.model.nodes.map((node) => [node.id, node]));
  const stationKindsById = new Map(workingMap.config.stationKinds.map((kind) => [kind.id, kind]));
  const stationLineIdsByStationId = buildStationLineIdsByStationId(workingMap);
  const stationCorridorHintsByStationId = buildStationCorridorHints(workingMap, stationLineIdsByStationId, nodesById);
  const stationSequenceHintsByStationId = buildStationSequenceHints(workingMap);
  const sheetSegmentEntriesBySheetId = new Map<string, SegmentSpatialEntry[]>();
  const sheetSegmentBucketsBySheetId = new Map<string, Map<string, SegmentSpatialEntry[]>>();

  for (const segment of workingMap.model.segments) {
    const points = buildSegmentPoints(segment, nodesById);
    if (points.length < 2) continue;
    const entry: SegmentSpatialEntry = {
      id: segment.id,
      points,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
    const entries = sheetSegmentEntriesBySheetId.get(segment.sheetId) ?? [];
    entries.push(entry);
    sheetSegmentEntriesBySheetId.set(segment.sheetId, entries);

    const buckets = sheetSegmentBucketsBySheetId.get(segment.sheetId) ?? new Map<string, SegmentSpatialEntry[]>();
    addSegmentToBuckets(buckets, entry);
    sheetSegmentBucketsBySheetId.set(segment.sheetId, buckets);
  }

  return {
    workingMap,
    nodesById,
    stationKindsById,
    stationLineIdsByStationId,
    stationCorridorHintsByStationId,
    stationSequenceHintsByStationId,
    sheetSegmentEntriesBySheetId,
    sheetSegmentBucketsBySheetId,
  };
}

export function normalizeRotation(rotation: number) {
  let next = rotation % 360;
  if (next > 180) next -= 360;
  if (next <= -180) next += 360;
  return Math.round(next);
}

export function getStationKindFontSize(stationKind?: StationKind) {
  return stationKind?.fontSize ?? DEFAULT_STATION_FONT_SIZE;
}

function isLabelOnPositiveSide(
  position: { x: number; y: number; align?: "left" | "right" | "top" | "bottom" },
  node: MapNode,
  orientation: CorridorOrientation,
) {
  if (orientation === "horizontal") return position.y >= node.y;
  if (orientation === "vertical") return position.x >= node.x;
  if (orientation === "diag-pos") return position.x - node.x >= position.y - node.y;
  if (orientation === "diag-neg") return position.x - node.x >= -(position.y - node.y);
  return true;
}

export function computeLabelPenalty(
  current: RailwayMap,
  station: Station,
  position: { x: number; y: number; align?: "left" | "right" | "top" | "bottom"; rotation?: number },
  resolvedPlacements: ResolvedLabelPlacement[],
  nodesById: Map<string, MapNode>,
  stationKindsById: Map<string, StationKind>,
  stationLineIdsByStationId: Map<string, Set<string>>,
  stationCorridorHintsByStationId?: Map<string, StationCorridorHint>,
  stationSequenceHintsByStationId?: Map<string, StationSequenceHint>,
  fixedPlacementsByStationId?: Map<string, ResolvedLabelPlacement>,
  sheetSegmentBucketsBySheetId?: Map<string, Map<string, SegmentSpatialEntry[]>>,
) {
  if (!station.nodeId) {
    return {
      score: Number.POSITIVE_INFINITY,
      box: estimateLabelBox(station.name, position.x, position.y, getStationKindFontSize(stationKindsById.get(station.kindId)), position.rotation ?? 0),
      overlapPenalty: Number.POSITIVE_INFINITY,
      segmentPenalty: Number.POSITIVE_INFINITY,
      offsetPenalty: Number.POSITIVE_INFINITY,
      rotationPenalty: Number.POSITIVE_INFINITY,
      alignmentPenalty: Number.POSITIVE_INFINITY,
    };
  }

  const node = nodesById.get(station.nodeId);
  if (!node) {
    return {
      score: Number.POSITIVE_INFINITY,
      box: estimateLabelBox(station.name, position.x, position.y, getStationKindFontSize(stationKindsById.get(station.kindId)), position.rotation ?? 0),
      overlapPenalty: Number.POSITIVE_INFINITY,
      segmentPenalty: Number.POSITIVE_INFINITY,
      offsetPenalty: Number.POSITIVE_INFINITY,
      rotationPenalty: Number.POSITIVE_INFINITY,
      alignmentPenalty: Number.POSITIVE_INFINITY,
    };
  }

  const box = estimateLabelBox(
    station.name,
    position.x,
    position.y,
    getStationKindFontSize(stationKindsById.get(station.kindId)),
    position.rotation ?? 0,
  );
  const currentLineIds = stationLineIdsByStationId.get(station.id) ?? new Set<string>();
  const currentHint = stationCorridorHintsByStationId?.get(station.id);

  let overlapPenalty = 0;
  for (const placement of resolvedPlacements) {
    if (boxesOverlap(box, placement.box)) overlapPenalty += 300;
  }

  let segmentPenalty = 0;
  const nearbySegments = getNearbySegmentEntries(
    box,
    sheetSegmentBucketsBySheetId?.get(node.sheetId) ?? new Map<string, SegmentSpatialEntry[]>(),
  );
  for (const segment of nearbySegments) {
    const points = segment.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (segmentIntersectsLabelBox(start, end, box, 8)) {
        segmentPenalty += 500;
        continue;
      }

      const boxCorners = [...box.corners, box.center];
      const minDistance = Math.min(...boxCorners.map((corner) => pointToSegmentDistance(corner, start, end)));
      if (minDistance < 18) {
        segmentPenalty += 120;
      }
    }
  }

  const offsetPenalty = Math.hypot(position.x - node.x, position.y - node.y) * 0.2;
  const rotationPenalty = position.rotation && position.rotation !== 0 ? 8 : 0;
  let alignmentPenalty = 0;
  let sideConsistencyPenalty = 0;
  let sequencePenalty = 0;

  for (const placement of resolvedPlacements) {
    const otherNode = nodesById.get(placement.nodeId);
    if (!otherNode) continue;

    const otherLineIds = stationLineIdsByStationId.get(placement.stationId) ?? new Set<string>();
    const sharesLine = [...currentLineIds].some((lineId) => otherLineIds.has(lineId));
    if (!sharesLine) continue;

    const deltaX = Math.abs(node.x - otherNode.x);
    const deltaY = Math.abs(node.y - otherNode.y);

    if (deltaX >= 40 && deltaY <= 24) {
      const currentOffsetY = position.y - node.y;
      const otherOffsetY = placement.position.y - otherNode.y;
      alignmentPenalty += Math.min(48, Math.abs(currentOffsetY - otherOffsetY) * 1.4);
      if ((currentOffsetY >= 0) !== (otherOffsetY >= 0)) {
        sideConsistencyPenalty += 90;
      }
      if ((position.rotation ?? 0) !== (placement.position.rotation ?? 0)) {
        alignmentPenalty += 18;
      }
    } else if (deltaY >= 40 && deltaX <= 24) {
      const currentOffsetX = position.x - node.x;
      const otherOffsetX = placement.position.x - otherNode.x;
      alignmentPenalty += Math.min(48, Math.abs(currentOffsetX - otherOffsetX) * 1.4);
      if ((currentOffsetX >= 0) !== (otherOffsetX >= 0)) {
        sideConsistencyPenalty += 90;
      }
      if ((position.rotation ?? 0) !== (placement.position.rotation ?? 0)) {
        alignmentPenalty += 18;
      }
    }
  }

  if (currentHint && currentHint.orientation !== "mixed") {
    const nodeOffsetX = position.x - node.x;
    const nodeOffsetY = position.y - node.y;
    if (currentHint.orientation === "horizontal") {
      alignmentPenalty += Math.abs(nodeOffsetX) * 0.04;
    } else if (currentHint.orientation === "vertical") {
      alignmentPenalty += Math.abs(nodeOffsetY) * 0.04;
    }

    const sameOrientationPlacements = resolvedPlacements.filter((placement) => {
      const placementHint = stationCorridorHintsByStationId?.get(placement.stationId);
      return placementHint?.orientation === currentHint.orientation;
    });
    if (sameOrientationPlacements.length > 0) {
      const positives = sameOrientationPlacements.filter((placement) => {
        const otherNode = nodesById.get(placement.nodeId);
        return otherNode ? isLabelOnPositiveSide(placement.position, otherNode, currentHint.orientation) : false;
      }).length;
      const negatives = sameOrientationPlacements.length - positives;
      const prefersPositive = positives >= negatives;
      const currentPositive = isLabelOnPositiveSide(position, node, currentHint.orientation);
      if (currentPositive !== prefersPositive) {
        sideConsistencyPenalty += 55;
      }
    }
  }

  const sequenceHint = stationSequenceHintsByStationId?.get(station.id);
  if (sequenceHint) {
    const sequenceNeighborIds = [...sequenceHint.previousStationIds, ...sequenceHint.nextStationIds];
    for (const neighborStationId of sequenceNeighborIds) {
      const placement =
        fixedPlacementsByStationId?.get(neighborStationId) ??
        resolvedPlacements.find((candidate) => candidate.stationId === neighborStationId);
      if (!placement) continue;
      const neighborNode = nodesById.get(placement.nodeId);
      if (!neighborNode) continue;

      const deltaX = Math.abs(node.x - neighborNode.x);
      const deltaY = Math.abs(node.y - neighborNode.y);
      if (deltaX >= 40 && deltaY <= 24) {
        const currentOffsetY = position.y - node.y;
        const otherOffsetY = placement.position.y - neighborNode.y;
        sequencePenalty += Math.min(90, Math.abs(currentOffsetY - otherOffsetY) * 2.2);
        if ((currentOffsetY >= 0) !== (otherOffsetY >= 0)) {
          sequencePenalty += 140;
        }
      } else if (deltaY >= 40 && deltaX <= 24) {
        const currentOffsetX = position.x - node.x;
        const otherOffsetX = placement.position.x - neighborNode.x;
        sequencePenalty += Math.min(90, Math.abs(currentOffsetX - otherOffsetX) * 2.2);
        if ((currentOffsetX >= 0) !== (otherOffsetX >= 0)) {
          sequencePenalty += 140;
        }
      }

      const currentDistance = Math.hypot(position.x - node.x, position.y - node.y);
      const neighborDistance = Math.hypot(placement.position.x - neighborNode.x, placement.position.y - neighborNode.y);
      sequencePenalty += Math.min(80, Math.abs(currentDistance - neighborDistance) * 0.8);
    }
  }

  return {
    score: overlapPenalty + segmentPenalty + offsetPenalty + rotationPenalty + alignmentPenalty + sideConsistencyPenalty + sequencePenalty,
    box,
    overlapPenalty,
    segmentPenalty,
    offsetPenalty,
    rotationPenalty,
    alignmentPenalty,
    sideConsistencyPenalty,
    sequencePenalty,
  };
}

function buildResolvedPlacementsFromStations(
  stations: Station[],
  nodesById: Map<string, MapNode>,
  stationKindsById: Map<string, StationKind>,
) {
  const placements = new Map<string, ResolvedLabelPlacement>();
  for (const station of stations) {
    if (!station.nodeId) continue;
    const node = nodesById.get(station.nodeId);
    if (!node || !station.label) continue;
    placements.set(station.id, {
      stationId: station.id,
      nodeId: station.nodeId,
      position: {
        x: station.label.x,
        y: station.label.y,
        align: station.label.align,
        rotation: station.label.rotation ?? 0,
      },
      box: estimateLabelBox(
        station.name,
        station.label.x,
        station.label.y,
        getStationKindFontSize(stationKindsById.get(station.kindId)),
        station.label.rotation ?? 0,
      ),
    });
  }
  return placements;
}

function refineLabelsAlongLineRuns(
  current: RailwayMap,
  stations: Station[],
  options: AutoPlaceOptions | undefined,
  context: LabelPlacementContext,
) {
  const {
    workingMap,
    nodesById,
    stationKindsById,
    stationLineIdsByStationId,
    stationCorridorHintsByStationId,
    stationSequenceHintsByStationId,
    sheetSegmentBucketsBySheetId,
  } = context;
  const placementsByStationId = buildResolvedPlacementsFromStations(stations, nodesById, stationKindsById);
  const stationsById = new Map(stations.map((station) => [station.id, station]));
  const orderedStations = [...stations]
    .filter((station) => station.nodeId)
    .sort((left, right) => (stationSequenceHintsByStationId.get(left.id)?.order ?? Number.MAX_SAFE_INTEGER) - (stationSequenceHintsByStationId.get(right.id)?.order ?? Number.MAX_SAFE_INTEGER));

  for (const station of orderedStations) {
    if (!station.nodeId) continue;
    const node = nodesById.get(station.nodeId);
    if (!node) continue;
    const currentPosition = getStationLabelPosition(station, node);
    const otherPlacements = [...placementsByStationId.values()].filter((placement) => placement.stationId !== station.id);
    const candidates = options?.bootstrapMode
      ? candidateBootstrapLabelPositions(station, node, stationCorridorHintsByStationId.get(station.id))
      : candidateLabelPositions(node, stationCorridorHintsByStationId.get(station.id));

    const best = candidates
      .map((position) => {
        const analysis = computeLabelPenalty(
          workingMap,
          station,
          position,
          otherPlacements,
          nodesById,
          stationKindsById,
          stationLineIdsByStationId,
          stationCorridorHintsByStationId,
          stationSequenceHintsByStationId,
          placementsByStationId,
          sheetSegmentBucketsBySheetId,
        );
        const deltaPenalty =
          options?.bootstrapMode
            ? Math.hypot(position.x - currentPosition.x, position.y - currentPosition.y) * 0.25
            : 0;
        return { position, score: analysis.score + deltaPenalty, box: analysis.box };
      })
      .sort((left, right) => left.score - right.score)[0];

    if (!best) continue;
    const nextStation = {
      ...station,
      label: {
        x: best.position.x,
        y: best.position.y,
        align: best.position.align,
        rotation: best.position.rotation ?? 0,
      },
    };
    stationsById.set(station.id, nextStation);
    placementsByStationId.set(station.id, {
      stationId: station.id,
      nodeId: station.nodeId,
      position: {
        x: best.position.x,
        y: best.position.y,
        align: best.position.align,
        rotation: best.position.rotation ?? 0,
      },
      box: best.box,
    });
  }

  return stations.map((station) => stationsById.get(station.id) ?? station);
}

export function autoPlaceLabels(current: RailwayMap, options?: AutoPlaceOptions) {
  const context = buildLabelPlacementContext(current, options);
  const {
    workingMap,
    nodesById,
    stationKindsById,
    stationLineIdsByStationId,
    stationCorridorHintsByStationId,
    stationSequenceHintsByStationId,
    sheetSegmentBucketsBySheetId,
  } = context;
  const resolvedPlacements: ResolvedLabelPlacement[] = [];

  const placedStations = workingMap.model.stations.map((station) => {
    if (!station.nodeId) return station;
    const node = nodesById.get(station.nodeId);
    if (!node) return station;

    const currentPosition = getStationLabelPosition(station, node);
    const currentAnalysis = computeLabelPenalty(
      workingMap,
      station,
      currentPosition,
      resolvedPlacements,
      nodesById,
      stationKindsById,
      stationLineIdsByStationId,
      stationCorridorHintsByStationId,
      stationSequenceHintsByStationId,
      undefined,
      sheetSegmentBucketsBySheetId,
    );

    if (options?.preserveExisting && currentAnalysis.overlapPenalty === 0 && currentAnalysis.segmentPenalty === 0) {
      resolvedPlacements.push({
        stationId: station.id,
        nodeId: station.nodeId,
        box: currentAnalysis.box,
        position: currentPosition,
      });
      return {
        ...station,
        label: {
          x: currentPosition.x,
          y: currentPosition.y,
          align: currentPosition.align,
          rotation: currentPosition.rotation ?? 0,
        },
      };
    }

    const candidates = options?.bootstrapMode
      ? candidateBootstrapLabelPositions(station, node, stationCorridorHintsByStationId.get(station.id))
      : candidateLabelPositions(node, stationCorridorHintsByStationId.get(station.id));

    const candidate = candidates
      .map((position) => {
        const analysis = computeLabelPenalty(
          workingMap,
          station,
          position,
          resolvedPlacements,
          nodesById,
          stationKindsById,
          stationLineIdsByStationId,
          stationCorridorHintsByStationId,
          stationSequenceHintsByStationId,
          undefined,
          sheetSegmentBucketsBySheetId,
        );
        const currentDeltaPenalty =
          options?.bootstrapMode
            ? Math.hypot(position.x - currentPosition.x, position.y - currentPosition.y) * 0.35 +
              Math.abs((position.rotation ?? 0) - (currentPosition.rotation ?? 0)) * 1.5
            : 0;
        return { position, box: analysis.box, score: analysis.score + currentDeltaPenalty };
      })
      .sort((left, right) => left.score - right.score)[0];

    if (!candidate) return station;

    resolvedPlacements.push({
      stationId: station.id,
      nodeId: station.nodeId,
      box: candidate.box,
      position: candidate.position,
    });
    return {
      ...station,
      label: {
        x: candidate.position.x,
        y: candidate.position.y,
        align: candidate.position.align,
        rotation: candidate.position.rotation ?? 0,
      },
    };
  });

  const refinedStations = refineLabelsAlongLineRuns(workingMap, placedStations, options, context);
  if (!options?.sheetId) return refinedStations;

  const refinedById = new Map(refinedStations.map((station) => [station.id, station]));
  return current.model.stations.map((station) => refinedById.get(station.id) ?? station);
}

export function evaluateLabelLayout(map: RailwayMap) {
  const {
    workingMap,
    nodesById,
    stationKindsById,
    stationLineIdsByStationId,
    stationCorridorHintsByStationId,
    stationSequenceHintsByStationId,
    sheetSegmentBucketsBySheetId,
  } = buildLabelPlacementContext(map);
  const resolvedPlacements: ResolvedLabelPlacement[] = [];

  let overlapCount = 0;
  let segmentIntersectionCount = 0;
  let totalScore = 0;

  for (const station of workingMap.model.stations) {
    if (!station.nodeId) continue;
    const node = nodesById.get(station.nodeId);
    if (!node) continue;
    const position = getStationLabelPosition(station, node);
    const analysis = computeLabelPenalty(
      workingMap,
      station,
      position,
      resolvedPlacements,
      nodesById,
      stationKindsById,
      stationLineIdsByStationId,
      stationCorridorHintsByStationId,
      stationSequenceHintsByStationId,
      undefined,
      sheetSegmentBucketsBySheetId,
    );
    if (analysis.overlapPenalty > 0) {
      overlapCount += Math.round(analysis.overlapPenalty / 300);
    }
    if (analysis.segmentPenalty > 0) {
      segmentIntersectionCount += Math.ceil(analysis.segmentPenalty / 120);
    }
    totalScore += analysis.score;
    resolvedPlacements.push({
      stationId: station.id,
      nodeId: station.nodeId,
      box: analysis.box,
      position,
    });
  }

  return {
    overlapCount,
    segmentIntersectionCount,
    totalScore,
  };
}

export function findNearbyFreePoint(map: RailwayMap, sheetId: string, preferredCenter: MapPoint) {
  const sheetNodes = map.model.nodes.filter((node) => node.sheetId === sheetId);
  const sheetNodeIds = new Set(sheetNodes.map((node) => node.id));
  const nodesById = new Map(sheetNodes.map((node) => [node.id, node]));
  const stationKindsById = new Map(map.config.stationKinds.map((kind) => [kind.id, kind]));
  const sheetSegments = map.model.segments.filter((segment) => segment.sheetId === sheetId);
  const spacing = 56;
  const maxRadius = 8;

  function isClear(candidate: MapPoint) {
    for (const node of sheetNodes) {
      if (Math.hypot(node.x - candidate.x, node.y - candidate.y) < 52) {
        return false;
      }
    }

    for (const station of map.model.stations) {
      if (!station.nodeId || !sheetNodeIds.has(station.nodeId)) continue;
      const stationNode = nodesById.get(station.nodeId);
      if (!stationNode) continue;
      const position = getStationLabelPosition(station, stationNode);
      const labelBox = estimateLabelBox(
        station.name,
        position.x,
        position.y,
        getStationKindFontSize(stationKindsById.get(station.kindId)),
        position.rotation,
      );
      if (pointInBox(candidate, labelBox, 14)) {
        return false;
      }
    }

    for (const segment of sheetSegments) {
      const points = buildSegmentPoints(segment, nodesById);
      for (let index = 0; index < points.length - 1; index += 1) {
        if (pointToSegmentDistance(candidate, points[index], points[index + 1]) < 24) {
          return false;
        }
      }
    }

    return true;
  }

  const roundedCenter = {
    x: Math.round(preferredCenter.x / 8) * 8,
    y: Math.round(preferredCenter.y / 8) * 8,
  };

  if (isClear(roundedCenter)) {
    return roundedCenter;
  }

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      for (let y = -radius; y <= radius; y += 1) {
        if (Math.abs(x) !== radius && Math.abs(y) !== radius) continue;
        const candidate = {
          x: roundedCenter.x + x * spacing,
          y: roundedCenter.y + y * spacing,
        };
        if (isClear(candidate)) {
          return candidate;
        }
      }
    }
  }

  return {
    x: roundedCenter.x + spacing,
    y: roundedCenter.y + spacing,
  };
}
