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

type GridOutlineCell = { column: number; row: number };

function areContiguous(values: number[]) {
  if (values.length === 0) return false;
  const sorted = [...values].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] !== sorted[index - 1] + 1) return false;
  }
  return true;
}

function buildCompressedRunPath(
  cells: GridOutlineCell[],
  center: MapPoint,
  cellWidth: number,
  cellHeight: number,
  cornerRadius: number,
  concavityFactor: number,
) {
  const rows = [...new Set(cells.map((cell) => cell.row))];
  const columns = [...new Set(cells.map((cell) => cell.column))];
  const horizontal = rows.length === 1 && areContiguous(columns);
  const vertical = columns.length === 1 && areContiguous(rows);
  if (!horizontal && !vertical) return "";

  const concavity = Math.min(0.95, Math.max(0, concavityFactor));
  const radius = cornerRadius;

  if (horizontal) {
    const sortedColumns = [...columns].sort((left, right) => left - right);
    const left = center.x + (sortedColumns[0] - 0.5) * cellWidth;
    const right = center.x + (sortedColumns[sortedColumns.length - 1] + 0.5) * cellWidth;
    const row = rows[0];
    const cy = center.y + row * cellHeight;
    const top = cy - cellHeight / 2;
    const bottom = cy + cellHeight / 2;
    const seamX = center.x + ((sortedColumns[0] + sortedColumns[sortedColumns.length - 1]) / 2) * cellWidth;
    const pinch = (cellHeight / 2) * concavity * 0.85;
    const topPinchY = cy - Math.max(4, cellHeight / 2 - pinch);
    const bottomPinchY = cy + Math.max(4, cellHeight / 2 - pinch);

    return [
      `M ${left + radius} ${top}`,
      `Q ${left} ${top} ${left} ${top + radius}`,
      `L ${left} ${bottom - radius}`,
      `Q ${left} ${bottom} ${left + radius} ${bottom}`,
      `Q ${seamX} ${bottomPinchY} ${right - radius} ${bottom}`,
      `Q ${right} ${bottom} ${right} ${bottom - radius}`,
      `L ${right} ${top + radius}`,
      `Q ${right} ${top} ${right - radius} ${top}`,
      `Q ${seamX} ${topPinchY} ${left + radius} ${top}`,
      "Z",
    ].join(" ");
  }

  const sortedRows = [...rows].sort((left, right) => left - right);
  const column = columns[0];
  const cx = center.x + column * cellWidth;
  const top = center.y + (sortedRows[0] - 0.5) * cellHeight;
  const bottom = center.y + (sortedRows[sortedRows.length - 1] + 0.5) * cellHeight;
  const left = cx - cellWidth / 2;
  const right = cx + cellWidth / 2;
  const seamY = center.y + ((sortedRows[0] + sortedRows[sortedRows.length - 1]) / 2) * cellHeight;
  const pinch = (cellWidth / 2) * concavity * 0.85;
  const leftPinchX = cx - Math.max(4, cellWidth / 2 - pinch);
  const rightPinchX = cx + Math.max(4, cellWidth / 2 - pinch);

  return [
    `M ${left} ${top + radius}`,
    `Q ${left} ${top} ${left + radius} ${top}`,
    `L ${right - radius} ${top}`,
    `Q ${right} ${top} ${right} ${top + radius}`,
    `Q ${rightPinchX} ${seamY} ${right} ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `L ${left + radius} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius}`,
    `Q ${leftPinchX} ${seamY} ${left} ${top + radius}`,
    "Z",
  ].join(" ");
}

function roundedPolygonPath(points: MapPoint[], cornerRadius: number, smoothFactor: number) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const loop = [...points, points[0]];
  let path = "";

  for (let index = 0; index < points.length; index += 1) {
    const prev = loop[index === 0 ? points.length - 1 : index - 1];
    const current = loop[index];
    const next = loop[index + 1];
    if (!prev || !current || !next) continue;

    const inDx = current.x - prev.x;
    const inDy = current.y - prev.y;
    const outDx = next.x - current.x;
    const outDy = next.y - current.y;
    const inLength = Math.hypot(inDx, inDy);
    const outLength = Math.hypot(outDx, outDy);
    if (inLength === 0 || outLength === 0) continue;

    const radius = Math.min(cornerRadius * (0.5 + smoothFactor * 0.5), inLength / 2, outLength / 2);
    const start = { x: current.x - (inDx / inLength) * radius, y: current.y - (inDy / inLength) * radius };
    const end = { x: current.x + (outDx / outLength) * radius, y: current.y + (outDy / outLength) * radius };

    if (index === 0) {
      path += `M ${start.x} ${start.y}`;
    } else {
      path += ` L ${start.x} ${start.y}`;
    }
    path += ` Q ${current.x} ${current.y} ${end.x} ${end.y}`;
  }

  return `${path} Z`;
}

function convexHull(points: MapPoint[]) {
  const sorted = [...points].sort((left, right) => (left.x === right.x ? left.y - right.y : left.x - right.x));
  if (sorted.length <= 1) return sorted;

  const cross = (origin: MapPoint, a: MapPoint, b: MapPoint) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: MapPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: MapPoint[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function buildNodeGroupCellsOutlinePath(
  cells: GridOutlineCell[],
  center: MapPoint,
  cellWidth: number,
  cellHeight: number,
  cornerRadius: number,
  concaveFactor: number,
) {
  if (cells.length === 0) return "";
  const compressedRunPath = buildCompressedRunPath(cells, center, cellWidth, cellHeight, cornerRadius, concaveFactor);
  if (compressedRunPath) return compressedRunPath;
  const corners: MapPoint[] = [];
  for (const cell of cells) {
    const x0 = center.x + (cell.column - 0.5) * cellWidth;
    const x1 = center.x + (cell.column + 0.5) * cellWidth;
    const y0 = center.y + (cell.row - 0.5) * cellHeight;
    const y1 = center.y + (cell.row + 0.5) * cellHeight;
    corners.push({ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 });
  }

  const hull = convexHull(corners);
  return roundedPolygonPath(hull, cornerRadius, concaveFactor);
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
