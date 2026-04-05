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

function candidateLabelPositions(node: MapNode) {
  const basePositions = [
    { x: node.x + 14, y: node.y - 12, align: "right" as const },
    { x: node.x + 14, y: node.y + 22, align: "right" as const },
    { x: node.x - 78, y: node.y - 12, align: "left" as const },
    { x: node.x - 78, y: node.y + 22, align: "left" as const },
    { x: node.x - 18, y: node.y - 22, align: "top" as const },
    { x: node.x - 18, y: node.y + 34, align: "bottom" as const },
  ];

  return basePositions.flatMap((position) =>
    AUTO_LABEL_ROTATIONS.map((rotation) => ({
      ...position,
      rotation,
    })),
  );
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

function candidateBootstrapLabelPositions(station: Station, node: MapNode) {
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

  const fallbackCandidates = candidateLabelPositions(node).filter((candidate) => candidate.rotation === 0);
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

export function normalizeRotation(rotation: number) {
  let next = rotation % 360;
  if (next > 180) next -= 360;
  if (next <= -180) next += 360;
  return Math.round(next);
}

export function getStationKindFontSize(stationKind?: StationKind) {
  return stationKind?.fontSize ?? DEFAULT_STATION_FONT_SIZE;
}

export function computeLabelPenalty(
  current: RailwayMap,
  station: Station,
  position: { x: number; y: number; align?: "left" | "right" | "top" | "bottom"; rotation?: number },
  resolvedPlacements: ResolvedLabelPlacement[],
  nodesById: Map<string, MapNode>,
  stationKindsById: Map<string, StationKind>,
  stationLineIdsByStationId: Map<string, Set<string>>,
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
  const sheetSegments = current.model.segments.filter((segment) => segment.sheetId === node.sheetId);
  const currentLineIds = stationLineIdsByStationId.get(station.id) ?? new Set<string>();

  let overlapPenalty = 0;
  for (const placement of resolvedPlacements) {
    if (boxesOverlap(box, placement.box)) overlapPenalty += 300;
  }

  let segmentPenalty = 0;
  for (const segment of sheetSegments) {
    const points = buildSegmentPoints(segment, nodesById);
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
      if ((position.rotation ?? 0) !== (placement.position.rotation ?? 0)) {
        alignmentPenalty += 18;
      }
    } else if (deltaY >= 40 && deltaX <= 24) {
      const currentOffsetX = position.x - node.x;
      const otherOffsetX = placement.position.x - otherNode.x;
      alignmentPenalty += Math.min(48, Math.abs(currentOffsetX - otherOffsetX) * 1.4);
      if ((position.rotation ?? 0) !== (placement.position.rotation ?? 0)) {
        alignmentPenalty += 18;
      }
    }
  }

  return {
    score: overlapPenalty + segmentPenalty + offsetPenalty + rotationPenalty + alignmentPenalty,
    box,
    overlapPenalty,
    segmentPenalty,
    offsetPenalty,
    rotationPenalty,
    alignmentPenalty,
  };
}

export function autoPlaceLabels(current: RailwayMap, options?: { preserveExisting?: boolean; bootstrapMode?: boolean }) {
  const nodesById = new Map(current.model.nodes.map((node) => [node.id, node]));
  const stationKindsById = new Map(current.config.stationKinds.map((kind) => [kind.id, kind]));
  const stationLineIdsByStationId = buildStationLineIdsByStationId(current);
  const resolvedPlacements: ResolvedLabelPlacement[] = [];

  return current.model.stations.map((station) => {
    if (!station.nodeId) return station;
    const node = nodesById.get(station.nodeId);
    if (!node) return station;

    const currentPosition = getStationLabelPosition(station, node);
    const currentAnalysis = computeLabelPenalty(
      current,
      station,
      currentPosition,
      resolvedPlacements,
      nodesById,
      stationKindsById,
      stationLineIdsByStationId,
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

    const candidates = options?.bootstrapMode ? candidateBootstrapLabelPositions(station, node) : candidateLabelPositions(node);

    const candidate = candidates
      .map((position) => {
        const analysis = computeLabelPenalty(
          current,
          station,
          position,
          resolvedPlacements,
          nodesById,
          stationKindsById,
          stationLineIdsByStationId,
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
