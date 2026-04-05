import type { MapNode, MapPoint, Segment } from "@/entities/railway-map/model/types";

const WHEEL_LINE_HEIGHT = 16;
const WHEEL_PAGE_HEIGHT = 120;

export type NodeSide = "left" | "right" | "up" | "down";

export function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  return point.matrixTransform(ctm.inverse());
}

export function pathFromPoints(points: MapPoint[]) {
  if (points.length < 2) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function offsetPoints(points: MapPoint[], offset: number) {
  if (points.length < 2 || offset === 0) return points;
  const start = points[0];
  const end = points[points.length - 1];
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return points;

  const normalX = -deltaY / length;
  const normalY = deltaX / length;

  return points.map((point) => ({
    x: point.x + normalX * offset,
    y: point.y + normalY * offset,
  }));
}

export function getNodeSide(from: MapPoint, to: MapPoint): NodeSide {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }

  return deltaY >= 0 ? "down" : "up";
}

export function sortPointsForSide(points: MapPoint[], side: NodeSide) {
  return [...points].sort((left, right) => {
    if (side === "left" || side === "right") {
      if (Math.abs(left.y - right.y) > 2) return left.y - right.y;
      return left.x - right.x;
    }

    if (Math.abs(left.x - right.x) > 2) return left.x - right.x;
    return left.y - right.y;
  });
}

export function chooseSlotIndices(
  rawPoints: MapPoint[],
  slotPoints: MapPoint[],
  availableIndices: number[],
  side: NodeSide,
) {
  if (rawPoints.length === 0 || slotPoints.length === 0 || availableIndices.length === 0) return [];

  const combinations: number[][] = [];

  function buildCombination(start: number, remaining: number, current: number[]) {
    if (remaining === 0) {
      combinations.push(current);
      return;
    }

    for (let index = start; index <= availableIndices.length - remaining; index += 1) {
      buildCombination(index + 1, remaining - 1, [...current, availableIndices[index]]);
    }
  }

  buildCombination(0, Math.min(rawPoints.length, availableIndices.length), []);

  const slotCenter = (slotPoints.length - 1) / 2;
  const directionBias = side === "right" || side === "down" ? -1 : 1;
  let best = combinations[0] ?? [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of combinations) {
    let score = 0;
    for (let index = 0; index < candidate.length; index += 1) {
      const rawPoint = rawPoints[index];
      const slotPoint = slotPoints[candidate[index]];
      score += Math.hypot(rawPoint.x - slotPoint.x, rawPoint.y - slotPoint.y) ** 2;
    }

    const candidateCenter = candidate.reduce((sum, index) => sum + index, 0) / candidate.length;
    score += Math.abs(candidateCenter - slotCenter) * 0.01;
    score += directionBias * candidateCenter * 0.1;

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function withAnchoredSegmentEndpoints(
  segment: Segment,
  points: MapPoint[],
  anchoredEndpointBySegmentNodeKey: Map<string, MapPoint>,
) {
  if (points.length < 2) return points;

  const nextPoints = [...points];
  nextPoints[0] = anchoredEndpointBySegmentNodeKey.get(`${segment.fromNodeId}:${segment.id}`) ?? nextPoints[0];
  nextPoints[nextPoints.length - 1] =
    anchoredEndpointBySegmentNodeKey.get(`${segment.toNodeId}:${segment.id}`) ?? nextPoints[nextPoints.length - 1];
  return nextPoints;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeWheelDelta(delta: number, deltaMode: number) {
  if (deltaMode === 1) return delta * WHEEL_LINE_HEIGHT;
  if (deltaMode === 2) return delta * WHEEL_PAGE_HEIGHT;
  return delta;
}

export function snapCoordinate(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function getClampedMenuPosition(x: number, y: number, menuWidth: number, menuHeight: number) {
  if (typeof window === "undefined") {
    return { left: x, top: y };
  }

  const padding = 12;
  return {
    left: clamp(x, padding, window.innerWidth - menuWidth - padding),
    top: clamp(y, padding, window.innerHeight - menuHeight - padding),
  };
}

export function pointOnPathAtHalf(points: MapPoint[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) {
    return {
      x: (points[0].x + points[points.length - 1].x) / 2,
      y: (points[0].y + points[points.length - 1].y) / 2,
    };
  }

  let traversed = 0;
  const targetLength = totalLength / 2;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index];
    if (traversed + length < targetLength) {
      traversed += length;
      continue;
    }

    const start = points[index];
    const end = points[index + 1];
    const ratio = length === 0 ? 0 : (targetLength - traversed) / length;
    return {
      x: Math.round(start.x + (end.x - start.x) * ratio),
      y: Math.round(start.y + (end.y - start.y) * ratio),
    };
  }

  return points[points.length - 1];
}

export function normalizeRect(start: MapPoint, end: MapPoint) {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function normalizeSearchValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

export function getSheetContentCenter(nodes: MapNode[], canvasWidth: number, canvasHeight: number) {
  if (nodes.length === 0) {
    return { x: canvasWidth / 2, y: canvasHeight / 2 };
  }

  const bounds = nodes.reduce(
    (current, node) => ({
      minX: Math.min(current.minX, node.x),
      maxX: Math.max(current.maxX, node.x),
      minY: Math.min(current.minY, node.y),
      maxY: Math.max(current.maxY, node.y),
    }),
    {
      minX: nodes[0].x,
      maxX: nodes[0].x,
      minY: nodes[0].y,
      maxY: nodes[0].y,
    },
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}
