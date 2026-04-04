import type { MouseEvent, WheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { DEVELOPMENT_BOOTSTRAP_MAP, INITIAL_MAP, LINE_PRESETS } from "@/entities/railway-map/model/constants";
import { railwayMapSchema } from "@/entities/railway-map/model/schema";
import type { Line, LineRun, MapNode, MapPoint, RailwayMap, Segment, Station, StationKind, StationKindShape, StationLabelFontWeight } from "@/entities/railway-map/model/types";
import {
  buildSegmentPoints,
  buildLineRunPath,
  buildSegmentPath,
  createDefaultLine,
  createDefaultNodeForSheet,
  createDefaultSheet,
  createDefaultStation,
  createDefaultStationAtNode,
  createLineRunId,
  createSegmentId,
  createStationKindId,
  createStraightSegmentForSheet,
  lineStrokeDasharray,
} from "@/entities/railway-map/model/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const STORAGE_KEY = "raily:editor-map";
const SHEET_VIEW_STORAGE_KEY = "raily:sheet-views";
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.04;
const WORLD_SIZE = 200000;
const LABEL_FONT_SIZE = 14;
const LABEL_PADDING_X = 10;
const LABEL_PADDING_Y = 8;
const MIN_GRID_STEP = 4;
const DEFAULT_STATION_FONT_FAMILY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_STATION_FONT_WEIGHT: StationLabelFontWeight = "600";
const STATION_FONT_WEIGHT_OPTIONS: StationLabelFontWeight[] = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  return point.matrixTransform(ctm.inverse());
}

function renderNodeSymbol(shape: StationKindShape, node: MapNode, isSelected: boolean, isTrackPoint: boolean) {
  return (
    <>
      {isTrackPoint ? (
        <rect
          x={node.x - 4}
          y={node.y - 4}
          width="8"
          height="8"
          transform={`rotate(45 ${node.x} ${node.y})`}
          fill="#e2e8f0"
          stroke="#475569"
          strokeWidth="2"
        />
      ) : shape === "interchange" ? (
        <rect x={node.x - 8} y={node.y - 8} width="16" height="16" rx="3" fill="white" stroke="#111827" strokeWidth="3" />
      ) : shape === "terminal" ? (
        <rect x={node.x - 10} y={node.y - 6} width="20" height="12" rx="4" fill="white" stroke="#111827" strokeWidth="3" />
      ) : (
        <circle cx={node.x} cy={node.y} r="6" fill="white" stroke="#111827" strokeWidth="3" />
      )}
      {isSelected ? <circle cx={node.x} cy={node.y} r={isTrackPoint ? "12" : "14"} fill="none" stroke="#0f172a" strokeDasharray="4 3" /> : null}
    </>
  );
}

function renderStationKindPreview(shape: StationKindShape) {
  const previewNode = { id: "preview", sheetId: "preview", x: 18, y: 18 };

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      {renderNodeSymbol(shape, previewNode, false, false)}
    </svg>
  );
}

function stationKindShapeGlyph(shape: StationKindShape) {
  if (shape === "interchange") return "□";
  if (shape === "terminal") return "▭";
  return "○";
}

function loadStoredMap() {
  if (typeof window === "undefined") return INITIAL_MAP;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return INITIAL_MAP;

  try {
    return railwayMapSchema.parse(JSON.parse(raw));
  } catch {
    return INITIAL_MAP;
  }
}

function loadStoredSheetViews() {
  if (typeof window === "undefined") return {} as Record<string, { zoom: number; centerX: number; centerY: number }>;

  const raw = window.localStorage.getItem(SHEET_VIEW_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, { zoom: number; centerX: number; centerY: number }>;
  } catch {
    return {};
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function estimateLabelBox(label: string, x: number, y: number) {
  const width = Math.max(38, label.length * 7.6);
  const height = LABEL_FONT_SIZE + 8;
  return {
    minX: x - LABEL_PADDING_X / 2,
    maxX: x + width + LABEL_PADDING_X / 2,
    minY: y - height + LABEL_PADDING_Y / 2,
    maxY: y + LABEL_PADDING_Y / 2,
  };
}

function boxesOverlap(
  left: ReturnType<typeof estimateLabelBox>,
  right: ReturnType<typeof estimateLabelBox>,
) {
  return left.minX < right.maxX && left.maxX > right.minX && left.minY < right.maxY && left.maxY > right.minY;
}

function pointToSegmentDistance(point: MapPoint, start: MapPoint, end: MapPoint) {
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

function pointInBox(
  point: MapPoint,
  box: ReturnType<typeof estimateLabelBox>,
  padding = 0,
) {
  return (
    point.x >= box.minX - padding &&
    point.x <= box.maxX + padding &&
    point.y >= box.minY - padding &&
    point.y <= box.maxY + padding
  );
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

function segmentIntersectsLabelBox(
  start: MapPoint,
  end: MapPoint,
  box: ReturnType<typeof estimateLabelBox>,
  padding = 8,
) {
  const expandedBox = {
    minX: box.minX - padding,
    maxX: box.maxX + padding,
    minY: box.minY - padding,
    maxY: box.maxY + padding,
  };

  if (pointInBox(start, expandedBox) || pointInBox(end, expandedBox)) {
    return true;
  }

  const topLeft = { x: expandedBox.minX, y: expandedBox.minY };
  const topRight = { x: expandedBox.maxX, y: expandedBox.minY };
  const bottomRight = { x: expandedBox.maxX, y: expandedBox.maxY };
  const bottomLeft = { x: expandedBox.minX, y: expandedBox.maxY };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function candidateLabelPositions(node: MapNode) {
  return [
    { x: node.x + 14, y: node.y - 12, align: "right" as const },
    { x: node.x + 14, y: node.y + 22, align: "right" as const },
    { x: node.x - 78, y: node.y - 12, align: "left" as const },
    { x: node.x - 78, y: node.y + 22, align: "left" as const },
    { x: node.x - 18, y: node.y - 22, align: "top" as const },
    { x: node.x - 18, y: node.y + 34, align: "bottom" as const },
  ];
}

function getStationLabelPosition(station: Station, node: MapNode) {
  return {
    x: station.label?.x ?? node.x + 12,
    y: station.label?.y ?? node.y - 10,
    align: station.label?.align ?? "right",
  };
}

function computeLabelPenalty(
  current: RailwayMap,
  station: Station,
  position: { x: number; y: number; align?: "left" | "right" | "top" | "bottom" },
  placedBoxes: ReturnType<typeof estimateLabelBox>[],
  nodesById: Map<string, MapNode>,
) {
  if (!station.nodeId) {
    return { score: Number.POSITIVE_INFINITY, box: estimateLabelBox(station.name, position.x, position.y) };
  }

  const node = nodesById.get(station.nodeId);
  if (!node) {
    return { score: Number.POSITIVE_INFINITY, box: estimateLabelBox(station.name, position.x, position.y) };
  }

  const box = estimateLabelBox(station.name, position.x, position.y);
  const sheetSegments = current.segments.filter((segment) => segment.sheetId === node.sheetId);

  let overlapPenalty = 0;
  for (const placedBox of placedBoxes) {
    if (boxesOverlap(box, placedBox)) overlapPenalty += 300;
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

      const boxCorners = [
        { x: box.minX, y: box.minY },
        { x: box.maxX, y: box.minY },
        { x: box.minX, y: box.maxY },
        { x: box.maxX, y: box.maxY },
        { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
      ];
      const minDistance = Math.min(...boxCorners.map((corner) => pointToSegmentDistance(corner, start, end)));
      if (minDistance < 18) {
        segmentPenalty += 120;
      }
    }
  }

  const offsetPenalty = Math.hypot(position.x - node.x, position.y - node.y) * 0.2;
  return { score: overlapPenalty + segmentPenalty + offsetPenalty, box };
}

function autoPlaceLabels(current: RailwayMap) {
  const nodesById = new Map(current.nodes.map((node) => [node.id, node]));
  const resolvedBoxes: ReturnType<typeof estimateLabelBox>[] = [];

  return current.stations.map((station) => {
    if (!station.nodeId) return station;
    const node = nodesById.get(station.nodeId);
    if (!node) return station;

    const candidate = candidateLabelPositions(node)
      .map((position) => {
        const analysis = computeLabelPenalty(current, station, position, resolvedBoxes, nodesById);
        return { position, box: analysis.box, score: analysis.score };
      })
      .sort((left, right) => left.score - right.score)[0];

    if (!candidate) return station;

    resolvedBoxes.push(candidate.box);
    return {
      ...station,
      label: {
        x: candidate.position.x,
        y: candidate.position.y,
        align: candidate.position.align,
      },
    };
  });
}

function cloneMap(map: RailwayMap) {
  return JSON.parse(JSON.stringify(map)) as RailwayMap;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function mapsEqual(left: RailwayMap, right: RailwayMap) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeRect(start: MapPoint, end: MapPoint) {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function findNearbyFreePoint(map: RailwayMap, sheetId: string, preferredCenter: MapPoint) {
  const sheetNodes = map.nodes.filter((node) => node.sheetId === sheetId);
  const sheetNodeIds = new Set(sheetNodes.map((node) => node.id));
  const nodesById = new Map(sheetNodes.map((node) => [node.id, node]));
  const sheetSegments = map.segments.filter((segment) => segment.sheetId === sheetId);
  const spacing = 56;
  const maxRadius = 8;

  function isClear(candidate: MapPoint) {
    for (const node of sheetNodes) {
      if (Math.hypot(node.x - candidate.x, node.y - candidate.y) < 52) {
        return false;
      }
    }

    for (const station of map.stations) {
      if (!station.nodeId || !sheetNodeIds.has(station.nodeId)) continue;
      const stationNode = nodesById.get(station.nodeId);
      if (!stationNode) continue;
      const position = getStationLabelPosition(station, stationNode);
      const labelBox = estimateLabelBox(station.name, position.x, position.y);
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

function getSheetContentCenter(nodes: MapNode[]) {
  if (nodes.length === 0) {
    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
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

export default function RailwayMapEditor() {
  const initialMapRef = useRef<RailwayMap | null>(null);
  if (!initialMapRef.current) {
    initialMapRef.current = loadStoredMap();
  }
  const initialMap = initialMapRef.current;

  const [map, setMap] = useState<RailwayMap>(initialMap);
  const [selectedNodeId, setSelectedNodeId] = useState(initialMap.nodes[0]?.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(initialMap.nodes[0]?.id ? [initialMap.nodes[0].id] : []);
  const [selectedStationId, setSelectedStationId] = useState(initialMap.stations[0]?.id ?? "");
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialMap.segments[0]?.id ?? "");
  const [selectedLineId, setSelectedLineId] = useState(initialMap.lines[0]?.id ?? "");
  const [selectedStationKindId, setSelectedStationKindId] = useState(initialMap.stationKinds[0]?.id ?? "");
  const [currentSheetId, setCurrentSheetId] = useState(initialMap.sheets[0]?.id ?? "");
  const [newStationName, setNewStationName] = useState("");
  const [newStationKindName, setNewStationKindName] = useState("");
  const [newStationKindShape, setNewStationKindShape] = useState<StationKindShape>("circle");
  const [newStationKindFontFamily, setNewStationKindFontFamily] = useState(DEFAULT_STATION_FONT_FAMILY);
  const [newStationKindFontWeight, setNewStationKindFontWeight] = useState<StationLabelFontWeight>(DEFAULT_STATION_FONT_WEIGHT);
  const [sidePanel, setSidePanel] = useState<"closed" | "edit" | "manage">("edit");
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [zoom, setZoom] = useState(1);
  const [viewportCenter, setViewportCenter] = useState({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const [sheetViews, setSheetViews] = useState<Record<string, { zoom: number; centerX: number; centerY: number }>>(loadStoredSheetViews);
  const [showGrid, setShowGrid] = useState(false);
  const [gridStepX, setGridStepX] = useState(20);
  const [gridStepY, setGridStepY] = useState(20);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingLabelStationId, setDraggingLabelStationId] = useState<string | null>(null);
  const [dragLastPoint, setDragLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{ start: MapPoint; end: MapPoint } | null>(null);
  const [pendingSegmentStartNodeId, setPendingSegmentStartNodeId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(JSON.stringify(initialMap, null, 2));
  const [errorMessage, setErrorMessage] = useState("");
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeIds: string[]; x: number; y: number } | null>(null);
  const [segmentContextMenu, setSegmentContextMenu] = useState<{ segmentId: string; x: number; y: number } | null>(null);
  const [nodeAssignmentQuery, setNodeAssignmentQuery] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const lastRestoredSheetIdRef = useRef<string | null>(null);
  const mapRef = useRef(map);
  const undoStackRef = useRef<RailwayMap[]>([]);
  const redoStackRef = useRef<RailwayMap[]>([]);
  const transientHistoryStartRef = useRef<RailwayMap | null>(null);

  const selectedNode = map.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedStation = map.stations.find((station) => station.id === selectedStationId) ?? null;
  const selectedSegment = map.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedLine = map.lines.find((line) => line.id === selectedLineId) ?? null;
  const selectedStationKind = map.stationKinds.find((kind) => kind.id === selectedStationKindId) ?? null;
  const currentSheet = map.sheets.find((sheet) => sheet.id === currentSheetId) ?? null;
  const contextMenuNodeId = nodeContextMenu?.nodeIds.length === 1 ? nodeContextMenu.nodeIds[0] : null;
  const contextMenuNode = contextMenuNodeId ? map.nodes.find((node) => node.id === contextMenuNodeId) ?? null : null;
  const contextMenuSegment = segmentContextMenu ? map.segments.find((segment) => segment.id === segmentContextMenu.segmentId) ?? null : null;

  const currentNodes = useMemo(() => map.nodes.filter((node) => node.sheetId === currentSheetId), [currentSheetId, map.nodes]);
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const currentNodeIds = useMemo(() => new Set(currentNodes.map((node) => node.id)), [currentNodes]);
  const currentStations = useMemo(
    () =>
      map.stations.filter(
        (station): station is Station & { nodeId: string } => !!station.nodeId && currentNodeIds.has(station.nodeId),
      ),
    [currentNodeIds, map.stations],
  );
  const unassignedStations = useMemo(
    () => map.stations.filter((station): station is Station & { nodeId: null } => !station.nodeId),
    [map.stations],
  );
  const currentSegments = useMemo(
    () => map.segments.filter((segment) => segment.sheetId === currentSheetId),
    [currentSheetId, map.segments],
  );

  const nodesById = useMemo(() => new Map(currentNodes.map((node) => [node.id, node])), [currentNodes]);
  const segmentsById = useMemo(() => new Map(currentSegments.map((segment) => [segment.id, segment])), [currentSegments]);
  const linesById = useMemo(() => new Map(map.lines.map((line) => [line.id, line])), [map.lines]);
  const stationKindsById = useMemo(() => new Map(map.stationKinds.map((kind) => [kind.id, kind])), [map.stationKinds]);
  const stationsByNodeId = useMemo(() => {
    const next = new Map<string, Station[]>();

    for (const station of currentStations) {
      if (!station.nodeId) continue;
      const current = next.get(station.nodeId) ?? [];
      current.push(station);
      next.set(station.nodeId, current);
    }

    return next;
  }, [currentStations]);
  const contextMenuStations = useMemo(
    () => (contextMenuNodeId ? stationsByNodeId.get(contextMenuNodeId) ?? [] : []),
    [contextMenuNodeId, stationsByNodeId],
  );
  const contextMenuStation = contextMenuStations[0] ?? null;
  const labelDiagnostics = useMemo(() => {
    const diagnostics = new Map<
      string,
      {
        box: ReturnType<typeof estimateLabelBox>;
        overlapsLabel: boolean;
        overlapsSegment: boolean;
        colliding: boolean;
        leaderLine: boolean;
      }
    >();

    for (const station of currentStations) {
      const node = nodesById.get(station.nodeId);
      if (!node) continue;
      const position = getStationLabelPosition(station, node);
      const box = estimateLabelBox(station.name, position.x, position.y);
      let overlapsLabel = false;
      let overlapsSegment = false;

      for (const otherStation of currentStations) {
        if (otherStation.id === station.id) continue;
        const otherNode = nodesById.get(otherStation.nodeId);
        if (!otherNode) continue;
        const otherPosition = getStationLabelPosition(otherStation, otherNode);
        const otherBox = estimateLabelBox(otherStation.name, otherPosition.x, otherPosition.y);
        if (boxesOverlap(box, otherBox)) {
          overlapsLabel = true;
          break;
        }
      }

      for (const segment of currentSegments) {
        const points = buildSegmentPoints(segment, nodesById);
        for (let index = 0; index < points.length - 1; index += 1) {
          const start = points[index];
          const end = points[index + 1];
          if (segmentIntersectsLabelBox(start, end, box, 8)) {
            overlapsSegment = true;
            break;
          }

          const boxCorners = [
            { x: box.minX, y: box.minY },
            { x: box.maxX, y: box.minY },
            { x: box.minX, y: box.maxY },
            { x: box.maxX, y: box.maxY },
            { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
          ];
          const minDistance = Math.min(...boxCorners.map((corner) => pointToSegmentDistance(corner, start, end)));
          if (minDistance < 8) {
            overlapsSegment = true;
            break;
          }
        }
        if (overlapsSegment) break;
      }

      diagnostics.set(station.id, {
        box,
        overlapsLabel,
        overlapsSegment,
        colliding: overlapsLabel || overlapsSegment,
        leaderLine: Math.hypot(position.x - node.x, position.y - node.y) > 28,
      });
    }

    return diagnostics;
  }, [currentSegments, currentStations, nodesById]);
  const selectedLineRun = useMemo(
    () => map.lineRuns.find((lineRun) => lineRun.lineId === selectedLineId) ?? null,
    [map.lineRuns, selectedLineId],
  );
  const assignedSegmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lineRun of map.lineRuns) {
      for (const segmentId of lineRun.segmentIds) {
        ids.add(segmentId);
      }
    }
    return ids;
  }, [map.lineRuns]);
  const viewBoxDimensions = useMemo(() => {
    const width = CANVAS_WIDTH / zoom;
    const height = CANVAS_HEIGHT / zoom;
    return { width, height };
  }, [zoom]);
  const stationAssignmentResults = useMemo(() => {
    if (!contextMenuNode) return [];

    const query = normalizeSearchValue(nodeAssignmentQuery);
    const results = unassignedStations
      .filter((station) => {
        if (!query) return true;
        const kindName = stationKindsById.get(station.kindId)?.name ?? "";
        const haystack = normalizeSearchValue(`${station.name} ${kindName} ${station.id}`);
        return haystack.includes(query);
      });

    return [...results].sort((left, right) => {
      const leftName = normalizeSearchValue(left.name);
      const rightName = normalizeSearchValue(right.name);
      const queryValue = normalizeSearchValue(nodeAssignmentQuery);
      const leftStarts = queryValue ? leftName.startsWith(queryValue) : false;
      const rightStarts = queryValue ? rightName.startsWith(queryValue) : false;
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }, [contextMenuNode, nodeAssignmentQuery, stationKindsById, unassignedStations]);
  const assignedLinesForContextSegment = useMemo(() => {
    if (!contextMenuSegment) return [];

    return map.lineRuns
      .filter((lineRun) => lineRun.segmentIds.includes(contextMenuSegment.id))
      .map((lineRun) => linesById.get(lineRun.lineId))
      .filter((line): line is Line => !!line);
  }, [contextMenuSegment, linesById, map.lineRuns]);
  const viewBox = useMemo(() => {
    const { width, height } = viewBoxDimensions;
    const centerX = viewportCenter.x;
    const centerY = viewportCenter.y;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      centerX,
      centerY,
    };
  }, [viewBoxDimensions, viewportCenter]);
  const gridLines = useMemo(() => {
    if (!showGrid) return { vertical: [] as number[], horizontal: [] as number[] };

    const safeStepX = Math.max(MIN_GRID_STEP, gridStepX);
    const safeStepY = Math.max(MIN_GRID_STEP, gridStepY);
    const vertical: number[] = [];
    const horizontal: number[] = [];

    const startX = Math.floor(viewBox.x / safeStepX) * safeStepX;
    const endX = Math.ceil((viewBox.x + viewBox.width) / safeStepX) * safeStepX;
    const startY = Math.floor(viewBox.y / safeStepY) * safeStepY;
    const endY = Math.ceil((viewBox.y + viewBox.height) / safeStepY) * safeStepY;

    for (let x = startX; x <= endX; x += safeStepX) {
      vertical.push(x);
    }

    for (let y = startY; y <= endY; y += safeStepY) {
      horizontal.push(y);
    }

    return { vertical, horizontal };
  }, [gridStepX, gridStepY, showGrid, viewBox.height, viewBox.width, viewBox.x, viewBox.y]);

  useEffect(() => {
    mapRef.current = map;
    setJsonText(JSON.stringify(map, null, 2));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  }, [map]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SHEET_VIEW_STORAGE_KEY, JSON.stringify(sheetViews));
    }
  }, [sheetViews]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const hasPrimaryModifier = event.metaKey || event.ctrlKey;

      if (hasPrimaryModifier && !event.shiftKey && key === "z") {
        event.preventDefault();
        undoLastChange();
        return;
      }

      if (hasPrimaryModifier && key === "a") {
        event.preventDefault();
        const nextSelectedNodeIds = currentNodes.map((node) => node.id);
        setSelectedNodeIds(nextSelectedNodeIds);
        setSelectedNodeId(nextSelectedNodeIds[0] ?? "");
        const firstStation = currentStations.find((station) => station.nodeId === nextSelectedNodeIds[0]);
        setSelectedStationId(firstStation?.id ?? "");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentNodes, currentStations]);

  useEffect(() => {
    const currentNodeIdSet = new Set(currentNodes.map((node) => node.id));
    const filteredSelectedIds = selectedNodeIds.filter((nodeId) => currentNodeIdSet.has(nodeId));
    if (filteredSelectedIds.length !== selectedNodeIds.length) {
      setSelectedNodeIds(filteredSelectedIds);
    }

    if (selectedNodeId && (!selectedNode || !nodesById.has(selectedNode.id))) {
      setSelectedNodeId(filteredSelectedIds[0] ?? "");
    }
  }, [currentNodes, nodesById, selectedNode, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    if (!selectedLine || !map.lines.some((line) => line.id === selectedLine.id)) {
      setSelectedLineId(map.lines[0]?.id ?? "");
    }
  }, [map.lines, selectedLine]);

  useEffect(() => {
    if (selectedStationId && (!selectedStation || !map.stations.some((station) => station.id === selectedStation.id))) {
      setSelectedStationId("");
    }
  }, [map.stations, selectedStation, selectedStationId]);

  useEffect(() => {
    if (selectedSegmentId && (!selectedSegment || !segmentsById.has(selectedSegment.id))) {
      setSelectedSegmentId("");
    }
  }, [currentSegments, segmentsById, selectedSegment, selectedSegmentId]);

  useEffect(() => {
    if (!selectedStationKind || !map.stationKinds.some((kind) => kind.id === selectedStationKind.id)) {
      setSelectedStationKindId(map.stationKinds[0]?.id ?? "");
    }
  }, [map.stationKinds, selectedStationKind]);

  useEffect(() => {
    if (!currentSheet || !map.sheets.some((sheet) => sheet.id === currentSheet.id)) {
      setCurrentSheetId(map.sheets[0]?.id ?? "");
    }
  }, [currentSheet, map.sheets]);

  useEffect(() => {
    if (!currentSheetId) return;
    if (lastRestoredSheetIdRef.current === currentSheetId) return;

    lastRestoredSheetIdRef.current = currentSheetId;
    const savedView = sheetViews[currentSheetId];
    if (savedView) {
      setZoom(savedView.zoom);
      setViewportCenter({ x: savedView.centerX, y: savedView.centerY });
      return;
    }

    setZoom(1);
    setViewportCenter({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  }, [currentSheetId, sheetViews]);

  useEffect(() => {
    if (!currentSheetId) return;
    setSheetViews((current) => {
      const nextView = { zoom, centerX: viewportCenter.x, centerY: viewportCenter.y };
      const previous = current[currentSheetId];
      if (
        previous &&
        previous.zoom === nextView.zoom &&
        previous.centerX === nextView.centerX &&
        previous.centerY === nextView.centerY
      ) {
        return current;
      }

      return {
        ...current,
        [currentSheetId]: nextView,
      };
    });
  }, [currentSheetId, viewportCenter.x, viewportCenter.y, zoom]);

  function pushUndoSnapshot(snapshot: RailwayMap) {
    undoStackRef.current = [...undoStackRef.current.slice(-99), cloneMap(snapshot)];
    redoStackRef.current = [];
  }

  function updateMap(updater: (current: RailwayMap) => RailwayMap, options?: { trackHistory?: boolean }) {
    setMap((current) => {
      const next = updater(current);
      if (next === current || mapsEqual(next, current)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return next;
    });
    setErrorMessage("");
  }

  function replaceMap(nextMap: RailwayMap, options?: { trackHistory?: boolean }) {
    setMap((current) => {
      if (mapsEqual(current, nextMap)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return cloneMap(nextMap);
    });
    setErrorMessage("");
  }

  function beginTransientMapChange() {
    if (!transientHistoryStartRef.current) {
      transientHistoryStartRef.current = cloneMap(mapRef.current);
    }
  }

  function completeTransientMapChange() {
    const snapshot = transientHistoryStartRef.current;
    transientHistoryStartRef.current = null;
    if (!snapshot) return;
    if (mapsEqual(snapshot, mapRef.current)) return;
    pushUndoSnapshot(snapshot);
  }

  function undoLastChange() {
    completeTransientMapChange();
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, cloneMap(mapRef.current)];
    setMap(cloneMap(previous));
    setErrorMessage("");
    setNodeContextMenu(null);
  }

  function clearCanvasSelections() {
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");
    setSelectedSegmentId("");
    setPendingSegmentStartNodeId(null);
    setNodeContextMenu(null);
  }

  function selectSingleNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedSegmentId("");
    const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
    setSelectedStationId(station?.id ?? "");
  }

  function addStation() {
    updateMap((current) => ({
      ...current,
      stations: [...current.stations, createDefaultStation(current, null, newStationName)],
    }));
    setNewStationName("");
  }

  function addNode() {
    if (!currentSheet) return;
    updateMap((current) => {
      const placement = findNearbyFreePoint(current, currentSheet.id, viewportCenter);
      return {
        ...current,
        nodes: [
          ...current.nodes,
          {
            ...createDefaultNodeForSheet(current, currentSheet.id),
            x: placement.x,
            y: placement.y,
          },
        ],
      };
    });
  }

  function attachStationToSelectedNode() {
    if (!selectedNode) return;
    if (selectedNodeStations.length > 0) return;

    updateMap((current) => ({
      ...current,
      stations: [...current.stations, createDefaultStationAtNode(current, selectedNode, newStationName)],
    }));
    setNewStationName("");
  }

  function assignStationToNode(stationId: string, nodeId: string) {
    const node = map.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    updateStation(stationId, {
      nodeId,
      label: {
        x: node.x + 12,
        y: node.y - 10,
        align: "right",
      },
    });
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedStationId(stationId);
    setNodeAssignmentQuery("");
    setNodeContextMenu(null);
  }

  function createStationAtNode(nodeId: string, name: string) {
    const node = map.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    const stationName = name.trim() || `Station ${map.stations.length + 1}`;
    const createdStation = createDefaultStationAtNode(map, node, stationName);
    updateMap((current) => ({
      ...current,
      stations: [...current.stations, createdStation],
    }));
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedStationId(createdStation.id);
    setNodeAssignmentQuery("");
    setNodeContextMenu(null);
  }

  function addSheet() {
    const nextSheet = createDefaultSheet(map, "");
    updateMap((current) => ({
      ...current,
      sheets: [...current.sheets, nextSheet],
    }));
    setSheetViews((current) => ({
      ...current,
      [nextSheet.id]: { zoom: 1, centerX: CANVAS_WIDTH / 2, centerY: CANVAS_HEIGHT / 2 },
    }));
    setCurrentSheetId(nextSheet.id);
    setRenamingSheetId(nextSheet.id);
    setSheetNameDraft(nextSheet.name);
  }

  function addStationKind() {
    const stationKind: StationKind = {
      id: createStationKindId(),
      name: newStationKindName.trim() || `Kind ${map.stationKinds.length + 1}`,
      shape: newStationKindShape,
      fontFamily: newStationKindFontFamily.trim() || DEFAULT_STATION_FONT_FAMILY,
      fontWeight: newStationKindFontWeight,
    };

    updateMap((current) => ({
      ...current,
      stationKinds: [...current.stationKinds, stationKind],
    }));
    setSelectedStationKindId(stationKind.id);
    setNewStationKindName("");
    setNewStationKindShape("circle");
    setNewStationKindFontFamily(DEFAULT_STATION_FONT_FAMILY);
    setNewStationKindFontWeight(DEFAULT_STATION_FONT_WEIGHT);
  }

  function addLine() {
    const preset = LINE_PRESETS[map.lines.length % LINE_PRESETS.length];
    const nextLine = createDefaultLine(map.lines.length, preset);
    updateMap((current) => ({
      ...current,
      lines: [...current.lines, nextLine],
      lineRuns: [...current.lineRuns, { id: `lr-${nextLine.id}`, lineId: nextLine.id, segmentIds: [] }],
    }));
    setSelectedLineId(nextLine.id);
  }

  function bootstrapDevelopmentModel() {
    const nextMap = cloneMap(DEVELOPMENT_BOOTSTRAP_MAP);
    replaceMap(nextMap);
    setSelectedNodeId(nextMap.nodes[0]?.id ?? "");
    setSelectedNodeIds(nextMap.nodes[0]?.id ? [nextMap.nodes[0].id] : []);
    setSelectedStationId(nextMap.stations[0]?.id ?? "");
    setSelectedSegmentId(nextMap.segments[0]?.id ?? "");
    setSelectedLineId(nextMap.lines[0]?.id ?? "");
    setSelectedStationKindId(nextMap.stationKinds[0]?.id ?? "");
    setCurrentSheetId(nextMap.sheets[0]?.id ?? "");
    setSheetViews({
      "sh-ov": { zoom: 1, centerX: 510, centerY: 260 },
      "sh-mid": { zoom: 1.1, centerX: 480, centerY: 280 },
      "sh-urban": { zoom: 1.3, centerX: 420, centerY: 280 },
      "sh-north": { zoom: 1.15, centerX: 410, centerY: 220 },
    });
    setViewportCenter({ x: 510, y: 260 });
    setZoom(1);
    setMarqueeSelection(null);
    setNodeContextMenu(null);
    setPendingSegmentStartNodeId(null);
    setErrorMessage("");
  }

  function autoPlaceCurrentSheetLabels() {
    if (!currentSheetId) return;
    updateMap((current) => ({
      ...current,
      stations: autoPlaceLabels(current).map((station) => {
        if (!station.nodeId) return station;
        const node = current.nodes.find((candidate) => candidate.id === station.nodeId);
        return node?.sheetId === currentSheetId
          ? station
          : current.stations.find((candidate) => candidate.id === station.id) ?? station;
      }),
    }));
  }

  function fixLabelForStation(stationId: string) {
    const station = map.stations.find((candidate) => candidate.id === stationId);
    if (!station || !station.nodeId) return;
    const stationNode = map.nodes.find((node) => node.id === station.nodeId);
    if (!stationNode) return;

    const occupiedBoxes = currentStations
      .filter((candidate) => candidate.id !== station.id)
      .map((candidate) => {
        const node = nodesById.get(candidate.nodeId);
        if (!node) return null;
        const position = getStationLabelPosition(candidate, node);
        return estimateLabelBox(candidate.name, position.x, position.y);
      })
      .filter((box): box is ReturnType<typeof estimateLabelBox> => box !== null);

    const allNodesById = new Map(map.nodes.map((node) => [node.id, node]));
    const bestCandidate = candidateLabelPositions(stationNode)
      .map((position) => {
        const analysis = computeLabelPenalty(map, station, position, occupiedBoxes, allNodesById);
        return { position, score: analysis.score };
      })
      .sort((left, right) => left.score - right.score)[0];

    if (!bestCandidate) return;
    updateStation(station.id, {
      label: {
        x: bestCandidate.position.x,
        y: bestCandidate.position.y,
        align: bestCandidate.position.align,
      },
    });
  }

  function fixSelectedLabel() {
    if (!selectedStation) return;
    fixLabelForStation(selectedStation.id);
  }

  function updateCurrentSheetName(name: string) {
    if (!currentSheet) return;

    updateMap((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => (sheet.id === currentSheet.id ? { ...sheet, name } : sheet)),
    }));
  }

  function startRenamingSheet(sheetId: string, currentName: string) {
    setRenamingSheetId(sheetId);
    setSheetNameDraft(currentName);
  }

  function commitSheetRename() {
    if (!renamingSheetId) return;
    const nextName = sheetNameDraft.trim();
    if (!nextName) {
      setRenamingSheetId(null);
      setSheetNameDraft("");
      return;
    }

    updateMap((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => (sheet.id === renamingSheetId ? { ...sheet, name: nextName } : sheet)),
    }));
    setRenamingSheetId(null);
    setSheetNameDraft("");
  }

  function deleteCurrentSheet() {
    if (!currentSheet) return;
    if (map.sheets.length <= 1) return;

    const nextSheetId = map.sheets.find((sheet) => sheet.id !== currentSheet.id)?.id;
    if (!nextSheetId) return;

    const nodeIdsToRemove = new Set(map.nodes.filter((node) => node.sheetId === currentSheet.id).map((node) => node.id));
    const segmentIdsToRemove = new Set(map.segments.filter((segment) => segment.sheetId === currentSheet.id).map((segment) => segment.id));

    updateMap((current) => ({
      ...current,
      sheets: current.sheets.filter((sheet) => sheet.id !== currentSheet.id),
      nodes: current.nodes.filter((node) => node.sheetId !== currentSheet.id),
      stations: current.stations.filter((station) => !station.nodeId || !nodeIdsToRemove.has(station.nodeId)),
      segments: current.segments.filter((segment) => segment.sheetId !== currentSheet.id),
      lineRuns: current.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((segmentId) => !segmentIdsToRemove.has(segmentId)),
      })),
    }));
    setSheetViews((current) => {
      const next = { ...current };
      delete next[currentSheet.id];
      return next;
    });
    setCurrentSheetId(nextSheetId);
  }

  function ensureLineRun(current: RailwayMap, lineId: string) {
    const existing = current.lineRuns.find((lineRun) => lineRun.lineId === lineId);
    if (existing) return { current, lineRun: existing };

    const nextLineRun: LineRun = {
      id: createLineRunId(),
      lineId,
      segmentIds: [],
    };

    return {
      current: {
        ...current,
        lineRuns: [...current.lineRuns, nextLineRun],
      },
      lineRun: nextLineRun,
    };
  }

  function toggleSegmentOnSelectedLine(segmentId: string) {
    if (!selectedLine) return;

    updateMap((current) => {
      const { current: nextCurrent, lineRun } = ensureLineRun(current, selectedLine.id);

      return {
        ...nextCurrent,
        lineRuns: nextCurrent.lineRuns.map((candidate) => {
          if (candidate.id !== lineRun.id) return candidate;
          const segmentIds = candidate.segmentIds.includes(segmentId)
            ? candidate.segmentIds.filter((value) => value !== segmentId)
            : [...candidate.segmentIds, segmentId];
          return { ...candidate, segmentIds };
        }),
      };
    });
    setSelectedSegmentId(segmentId);
  }

  function deleteSelectedSegment() {
    if (!selectedSegment) return;

    updateMap((current) => ({
      ...current,
      segments: current.segments.filter((segment) => segment.id !== selectedSegment.id),
      lineRuns: current.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((segmentId) => segmentId !== selectedSegment.id),
      })),
    }));
    setSegmentContextMenu(null);
  }

  function deleteSegment(segmentId: string) {
    updateMap((current) => ({
      ...current,
      segments: current.segments.filter((segment) => segment.id !== segmentId),
      lineRuns: current.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId),
      })),
    }));
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId("");
    }
    setSegmentContextMenu(null);
  }

  function duplicateSegment(segmentId: string) {
    const source = map.segments.find((segment) => segment.id === segmentId);
    if (!source) return;

    const duplicated = {
      ...JSON.parse(JSON.stringify(source)),
      id: createSegmentId(),
    };

    updateMap((current) => ({
      ...current,
      segments: [...current.segments, duplicated],
    }));
    setSelectedSegmentId(duplicated.id);
    setSegmentContextMenu(null);
  }

  function assignLineToSegment(lineId: string, segmentId: string) {
    updateMap((current) => {
      const { current: ensuredCurrent, lineRun } = ensureLineRun(current, lineId);
      return {
        ...ensuredCurrent,
        lineRuns: ensuredCurrent.lineRuns.map((candidate) => {
          if (candidate.id !== lineRun.id) return candidate;
          const segmentIds = candidate.segmentIds.includes(segmentId)
            ? candidate.segmentIds
            : [...candidate.segmentIds, segmentId];
          return { ...candidate, segmentIds };
        }),
      };
    });
    setSelectedLineId(lineId);
    setSelectedSegmentId(segmentId);
    setSegmentContextMenu(null);
  }

  function unassignLineFromSegment(lineId: string, segmentId: string) {
    updateMap((current) => ({
      ...current,
      lineRuns: current.lineRuns.map((lineRun) =>
        lineRun.lineId !== lineId
          ? lineRun
          : {
              ...lineRun,
              segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId),
            },
      ),
    }));
    setSegmentContextMenu(null);
  }

  function deleteNodes(nodeIds: string[]) {
    if (nodeIds.length === 0) return;
    const nodeIdSet = new Set(nodeIds);
    const connectedSegmentIds = new Set(
      map.segments
        .filter((segment) => nodeIdSet.has(segment.fromNodeId) || nodeIdSet.has(segment.toNodeId))
        .map((segment) => segment.id),
    );

    updateMap((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !nodeIdSet.has(node.id)),
      stations: current.stations.filter((station) => !station.nodeId || !nodeIdSet.has(station.nodeId)),
      segments: current.segments.filter((segment) => !connectedSegmentIds.has(segment.id)),
      lineRuns: current.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((segmentId) => !connectedSegmentIds.has(segmentId)),
      })),
    }));

    setSelectedNodeIds((current) => current.filter((nodeId) => !nodeIdSet.has(nodeId)));
    if (selectedNodeId && nodeIdSet.has(selectedNodeId)) setSelectedNodeId("");
    if (selectedStationId && map.stations.find((station) => station.id === selectedStationId && !!station.nodeId && nodeIdSet.has(station.nodeId))) {
      setSelectedStationId("");
    }
    setNodeContextMenu(null);
  }

  function deleteNode(nodeId: string) {
    deleteNodes([nodeId]);
  }

  function deleteStation(stationId: string) {
    updateMap((current) => ({
      ...current,
      stations: current.stations.filter((station) => station.id !== stationId),
    }));
    if (selectedStationId === stationId) {
      setSelectedStationId("");
    }
    setNodeContextMenu(null);
  }

  function deleteSelectedStationKind() {
    if (!selectedStationKind) return;
    if (map.stationKinds.length <= 1) return;

    const fallbackKindId = map.stationKinds.find((kind) => kind.id !== selectedStationKind.id)?.id;
    if (!fallbackKindId) return;

    updateMap((current) => ({
      ...current,
      stationKinds: current.stationKinds.filter((kind) => kind.id !== selectedStationKind.id),
      stations: current.stations.map((station) =>
        station.kindId === selectedStationKind.id ? { ...station, kindId: fallbackKindId } : station,
      ),
    }));
  }

  function updateNode(patch: Partial<MapNode>) {
    if (!selectedNode) return;

    updateMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
      stations: current.stations.map((station) =>
        station.nodeId !== selectedNode.id || !station.label
          ? station
          : {
              ...station,
              label: {
                ...station.label,
                x: station.label.x + ((patch.x ?? selectedNode.x) - selectedNode.x),
                y: station.label.y + ((patch.y ?? selectedNode.y) - selectedNode.y),
              },
            },
      ),
    }));
  }

  function updateLine(patch: Partial<Line>) {
    if (!selectedLine) return;

    updateMap((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === selectedLine.id ? { ...line, ...patch } : line)),
    }));
  }

  function updateStation(stationId: string, patch: Partial<Station>) {
    updateMap((current) => ({
      ...current,
      stations: current.stations.map((station) => (station.id === stationId ? { ...station, ...patch } : station)),
    }));
  }

  function updateStationKind(kindId: string, patch: Partial<StationKind>) {
    updateMap((current) => ({
      ...current,
      stationKinds: current.stationKinds.map((kind) => (kind.id === kindId ? { ...kind, ...patch } : kind)),
    }));
  }

  function createSegmentFromPendingNode(nextNodeId: string) {
    if (!currentSheet) return;
    if (!pendingSegmentStartNodeId || pendingSegmentStartNodeId === nextNodeId) {
      setPendingSegmentStartNodeId(nextNodeId);
      return;
    }

    const existingSegment = currentSegments.find(
      (segment) =>
        (segment.fromNodeId === pendingSegmentStartNodeId && segment.toNodeId === nextNodeId) ||
        (segment.fromNodeId === nextNodeId && segment.toNodeId === pendingSegmentStartNodeId),
    );

    if (existingSegment) {
      setSelectedSegmentId(existingSegment.id);
      setPendingSegmentStartNodeId(null);
      return;
    }

    const segment = createStraightSegmentForSheet(currentSheet.id, pendingSegmentStartNodeId, nextNodeId);
    updateMap((current) => ({
      ...current,
      segments: [...current.segments, segment],
    }));
    setSelectedSegmentId(segment.id);
    setPendingSegmentStartNodeId(null);
  }

  function startSegmentFromNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setPendingSegmentStartNodeId(nodeId);
    setNodeContextMenu(null);
  }

  function cancelPendingSegment() {
    setPendingSegmentStartNodeId(null);
    setNodeContextMenu(null);
  }

  function completeSegmentAtNode(nodeId: string) {
    selectSingleNode(nodeId);
    createSegmentFromPendingNode(nodeId);
    setNodeContextMenu(null);
  }

  function handleNodeMouseDown(event: MouseEvent<SVGGElement>, nodeId: string) {
    event.stopPropagation();
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setSidePanel("edit");
    if (event.altKey) {
      setPanning(true);
      setPanStart({
        clientX: event.clientX,
        clientY: event.clientY,
        centerX: viewportCenter.x,
        centerY: viewportCenter.y,
      });
      return;
    }
    if (event.metaKey) {
      setSelectedNodeIds((current) => {
        if (current.includes(nodeId)) {
          const next = current.filter((value) => value !== nodeId);
          setSelectedNodeId(next[0] ?? "");
          if (selectedStationId && currentStations.find((station) => station.id === selectedStationId)?.nodeId === nodeId) {
            setSelectedStationId("");
          }
          return next;
        }

        const next = [...current, nodeId];
        setSelectedNodeId(nodeId);
        const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
        setSelectedStationId(station?.id ?? "");
        return next;
      });
    } else if (!selectedNodeIdsSet.has(nodeId)) {
      selectSingleNode(nodeId);
    } else {
      setSelectedNodeId(nodeId);
      const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
      if (station) setSelectedStationId(station.id);
    }

    setDraggingNodeId(nodeId);
    beginTransientMapChange();
    if (svgRef.current) {
      const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
      if (point) {
        setDragLastPoint({ x: point.x, y: point.y });
      }
    }
  }

  function handleLabelMouseDown(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.stopPropagation();
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setSidePanel("edit");
    if (event.altKey) {
      setPanning(true);
      setPanStart({
        clientX: event.clientX,
        clientY: event.clientY,
        centerX: viewportCenter.x,
        centerY: viewportCenter.y,
      });
      return;
    }
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    setDraggingNodeId(null);
    setDraggingLabelStationId(stationId);
    beginTransientMapChange();
    if (svgRef.current) {
      const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
      if (point) {
        setDragLastPoint({ x: point.x, y: point.y });
      }
    }
  }

  function handleStationContextMenu(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    setSegmentContextMenu(null);
    setSidePanel("edit");
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    setNodeAssignmentQuery("");
    setNodeContextMenu({
      nodeIds: [nodeId],
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCanvasMouseDown(event: MouseEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setDraggingNodeId(null);
    setDraggingLabelStationId(null);
    setPendingSegmentStartNodeId(null);
    if (!svgRef.current) return;
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;

    if (event.altKey) {
      setPanning(true);
      setPanStart({
        clientX: event.clientX,
        clientY: event.clientY,
        centerX: viewportCenter.x,
        centerY: viewportCenter.y,
      });
      return;
    }

    setMarqueeSelection({ start: { x: point.x, y: point.y }, end: { x: point.x, y: point.y } });
  }

  function handleSegmentMouseDown(segmentId: string) {
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setSidePanel("edit");
    setSelectedSegmentId(segmentId);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");

  }

  function handleSegmentContextMenu(event: MouseEvent<SVGPathElement>, segmentId: string) {
    event.preventDefault();
    event.stopPropagation();
    setNodeContextMenu(null);
    setSelectedSegmentId(segmentId);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");
    setSegmentContextMenu({
      segmentId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleSvgMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!svgPoint) return;

    if (marqueeSelection) {
      setMarqueeSelection((current) => (current ? { ...current, end: { x: svgPoint.x, y: svgPoint.y } } : current));
      return;
    }

    if (panning && panStart) {
      const deltaX = ((event.clientX - panStart.clientX) / CANVAS_WIDTH) * viewBox.width;
      const deltaY = ((event.clientY - panStart.clientY) / CANVAS_HEIGHT) * viewBox.height;
      setViewportCenter({
        x: panStart.centerX - deltaX,
        y: panStart.centerY - deltaY,
      });
      return;
    }

    if (draggingLabelStationId && dragLastPoint) {
      const deltaX = Math.round(svgPoint.x - dragLastPoint.x);
      const deltaY = Math.round(svgPoint.y - dragLastPoint.y);
      if (deltaX === 0 && deltaY === 0) return;

      updateMap((current) => ({
        ...current,
        stations: current.stations.map((station) => {
          if (station.id !== draggingLabelStationId) return station;
          const stationNode = station.nodeId ? current.nodes.find((node) => node.id === station.nodeId) : null;
          return {
            ...station,
            label: {
              x: (station.label?.x ?? ((stationNode?.x ?? 0) + 12)) + deltaX,
              y: (station.label?.y ?? ((stationNode?.y ?? 0) - 10)) + deltaY,
              align: station.label?.align ?? "right",
            },
          };
        }),
      }), { trackHistory: false });
      setDragLastPoint({ x: svgPoint.x, y: svgPoint.y });
      return;
    }

    if (!draggingNodeId || !dragLastPoint) return;
    const deltaX = Math.round(svgPoint.x - dragLastPoint.x);
    const deltaY = Math.round(svgPoint.y - dragLastPoint.y);
    if (deltaX === 0 && deltaY === 0) return;

    const nodeIdsToMove = selectedNodeIdsSet.has(draggingNodeId) ? selectedNodeIdsSet : new Set([draggingNodeId]);

    updateMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const shouldMove = nodeIdsToMove.has(node.id);
        return shouldMove ? { ...node, x: node.x + deltaX, y: node.y + deltaY } : node;
      }),
      stations: current.stations.map((station) => {
        const stationNode = station.nodeId ? current.nodes.find((node) => node.id === station.nodeId) : null;
        const shouldMove = !!station.nodeId && nodeIdsToMove.has(station.nodeId);
        if (!shouldMove || !station.label) return station;
        return {
          ...station,
          label: {
            ...station.label,
            x: station.label.x + deltaX,
            y: station.label.y + deltaY,
          },
        };
      }),
    }), { trackHistory: false });
    setDragLastPoint({ x: svgPoint.x, y: svgPoint.y });
  }

  function handleSvgMouseUp() {
    completeTransientMapChange();
    if (marqueeSelection) {
      const rect = normalizeRect(marqueeSelection.start, marqueeSelection.end);
      setMarqueeSelection(null);

      if (rect.width < 4 && rect.height < 4) {
        clearCanvasSelections();
      } else {
        const nextSelectedNodeIds = currentNodes
          .filter((node) => node.x >= rect.minX && node.x <= rect.maxX && node.y >= rect.minY && node.y <= rect.maxY)
          .map((node) => node.id);

        setSelectedNodeIds(nextSelectedNodeIds);
        setSelectedNodeId(nextSelectedNodeIds[0] ?? "");
        const firstStation = currentStations.find((station) => station.nodeId === nextSelectedNodeIds[0]);
        setSelectedStationId(firstStation?.id ?? "");
        setSelectedSegmentId("");
      }
    }

    setDraggingNodeId(null);
    setDraggingLabelStationId(null);
    setDragLastPoint(null);
    setPanning(false);
    setPanStart(null);
  }

  function handleNodeContextMenu(event: MouseEvent<SVGGElement>, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    setSegmentContextMenu(null);
    const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
    if (!selectedNodeIdsSet.has(nodeId)) {
      selectSingleNode(nodeId);
      setSelectedStationId(station?.id ?? "");
    }
    if (selectedNodeIdsSet.has(nodeId) && selectedNodeIds.length <= 1) {
      setSelectedNodeId(nodeId);
      setSelectedStationId(station?.id ?? "");
      setSelectedSegmentId("");
    }
    const nodeIds = selectedNodeIdsSet.has(nodeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [nodeId];
    setNodeAssignmentQuery("");
    setNodeContextMenu({
      nodeIds,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function panViewportByPixels(deltaX: number, deltaY: number) {
    setViewportCenter((current) => ({
      x: current.x + (deltaX / CANVAS_WIDTH) * viewBox.width,
      y: current.y + (deltaY / CANVAS_HEIGHT) * viewBox.height,
    }));
  }

  function applyZoom(nextZoom: number, focusPoint?: { x: number; y: number }) {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (clampedZoom === zoom) return;

    const currentWidth = CANVAS_WIDTH / zoom;
    const currentHeight = CANVAS_HEIGHT / zoom;
    const nextWidth = CANVAS_WIDTH / clampedZoom;
    const nextHeight = CANVAS_HEIGHT / clampedZoom;
    const focusX = focusPoint?.x ?? viewBox.centerX;
    const focusY = focusPoint?.y ?? viewBox.centerY;

    const relativeX = (focusX - viewBox.x) / currentWidth;
    const relativeY = (focusY - viewBox.y) / currentHeight;

    const nextX = focusX - relativeX * nextWidth;
    const nextY = focusY - relativeY * nextHeight;

    setZoom(clampedZoom);
    setViewportCenter({
      x: nextX + nextWidth / 2,
      y: nextY + nextHeight / 2,
    });
  }

  function handleSvgWheel(event: WheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
      const focusPoint = svgPoint ? { x: svgPoint.x, y: svgPoint.y } : undefined;
      const nextZoom = event.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
      applyZoom(nextZoom, focusPoint);
      return;
    }

    panViewportByPixels(event.deltaX, event.deltaY);
  }

  useEffect(() => {
    const element = canvasViewportRef.current;
    if (!element) return;

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (!svgRef.current) return;
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
        const focusPoint = svgPoint ? { x: svgPoint.x, y: svgPoint.y } : undefined;
        const nextZoom = event.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
        applyZoom(nextZoom, focusPoint);
        return;
      }

      panViewportByPixels(event.deltaX, event.deltaY);
    }

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
    };
  }, [zoom, viewBox.centerX, viewBox.centerY, viewBox.x, viewBox.y]);

  function resetViewportToSheet() {
    const center = getSheetContentCenter(currentNodes);
    setZoom(1);
    setViewportCenter(center);
  }

  function exportSvg() {
    if (!svgRef.current) return;
    downloadFile("railway-map.svg", svgRef.current.outerHTML, "image/svg+xml;charset=utf-8");
  }

  function exportJson() {
    downloadFile("railway-map.json", JSON.stringify(map, null, 2), "application/json;charset=utf-8");
  }

  function importJson() {
    try {
      const parsed = railwayMapSchema.parse(JSON.parse(jsonText));
      replaceMap(parsed);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not import the map JSON.");
    }
  }

  const selectedNodeStations = selectedNode ? stationsByNodeId.get(selectedNode.id) ?? [] : [];
  const visibleStations = useMemo(() => [...currentStations, ...unassignedStations], [currentStations, unassignedStations]);

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/75 px-5 py-4 shadow-panel backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Raily editor</p>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-ink">Map workspace</h1>
              <p className="text-sm text-muted">
                Keep the canvas central. Use the side panel only when you need editing or management controls.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={sidePanel === "edit" ? "default" : "outline"} onClick={() => setSidePanel(sidePanel === "edit" ? "closed" : "edit")}>
              Edit Panel
            </Button>
            <Button variant={sidePanel === "manage" ? "default" : "outline"} onClick={() => setSidePanel(sidePanel === "manage" ? "closed" : "manage")}>
              Manage
            </Button>
            <Button variant="outline" onClick={exportSvg}>
              <Download className="h-4 w-4" />
              SVG
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <Download className="h-4 w-4" />
              JSON
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative min-h-[78vh] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-4">
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-sm backdrop-blur">
                    Canvas editor
                  </div>
                  {pendingSegmentStartNodeId ? (
                    <div className="pointer-events-auto rounded-2xl border border-sky-200 bg-sky-50/95 px-3 py-2 text-xs text-sky-800 shadow-sm">
                      Segment start: {pendingSegmentStartNodeId}. Right-click another track point to connect it.
                    </div>
                  ) : null}
                  <div className="pointer-events-auto ml-auto flex gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm backdrop-blur">
                      <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom / ZOOM_STEP)}>
                        -
                      </button>
                      <span className="min-w-[3.5rem] text-center text-xs font-semibold text-ink">{Math.round(zoom * 100)}%</span>
                      <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom * ZOOM_STEP)}>
                        +
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-muted"
                        onClick={resetViewportToSheet}
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
                        Grid
                      </label>
                      <Input
                        type="number"
                        value={gridStepX}
                        onChange={(event) => setGridStepX(Math.max(MIN_GRID_STEP, Number(event.target.value) || MIN_GRID_STEP))}
                        className="h-8 w-20 px-2 py-1 text-xs"
                      />
                      <Input
                        type="number"
                        value={gridStepY}
                        onChange={(event) => setGridStepY(Math.max(MIN_GRID_STEP, Number(event.target.value) || MIN_GRID_STEP))}
                        className="h-8 w-20 px-2 py-1 text-xs"
                      />
                    </div>
                    <Button variant="outline" className="bg-white/90 backdrop-blur" onClick={addNode}>
                      <Plus className="h-4 w-4" />
                      Track Point
                    </Button>
                    <Button variant="outline" className="bg-white/90 backdrop-blur" onClick={addStation}>
                      <Plus className="h-4 w-4" />
                      Station
                    </Button>
                  </div>
                </div>

                <div ref={canvasViewportRef} className="h-[78vh] overflow-auto overscroll-contain touch-none">
                  <svg
                    ref={svgRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    className="h-full w-full"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                  >
                    <rect x={-WORLD_SIZE / 2} y={-WORLD_SIZE / 2} width={WORLD_SIZE} height={WORLD_SIZE} fill="white" pointerEvents="none" />

                    {showGrid ? (
                      <g pointerEvents="none">
                        {gridLines.vertical.map((x) => (
                          <line
                            key={`grid-x-${x}`}
                            x1={x}
                            y1={viewBox.y - viewBox.height}
                            x2={x}
                            y2={viewBox.y + viewBox.height * 2}
                            stroke="#cbd5e1"
                            strokeOpacity="0.45"
                            strokeWidth="1"
                          />
                        ))}
                        {gridLines.horizontal.map((y) => (
                          <line
                            key={`grid-y-${y}`}
                            x1={viewBox.x - viewBox.width}
                            y1={y}
                            x2={viewBox.x + viewBox.width * 2}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeOpacity="0.45"
                            strokeWidth="1"
                          />
                        ))}
                      </g>
                    ) : null}

                    {currentSegments.map((segment) => (
                      <path
                        key={segment.id}
                        d={buildSegmentPath(segment, nodesById)}
                        fill="none"
                        stroke={selectedSegmentId === segment.id ? "#94a3b8" : assignedSegmentIds.has(segment.id) ? "transparent" : "#dbe4ee"}
                        strokeWidth={selectedSegmentId === segment.id ? "22" : "18"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        onMouseDown={() => handleSegmentMouseDown(segment.id)}
                        onContextMenu={(event) => handleSegmentContextMenu(event, segment.id)}
                      />
                    ))}

                    {map.lineRuns.map((lineRun) => {
                      const line = linesById.get(lineRun.lineId);
                      if (!line) return null;

                      return (
                        <path
                          key={lineRun.id}
                          d={buildLineRunPath(lineRun, segmentsById, nodesById)}
                          fill="none"
                          stroke={line.color}
                          strokeWidth={line.strokeWidth}
                          strokeDasharray={lineStrokeDasharray(line)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                      );
                    })}

                    {currentNodes.map((node) => {
                      const stations = stationsByNodeId.get(node.id) ?? [];
                      const isSelected = selectedNodeIdsSet.has(node.id);
                      const primaryStation = stations[0];
                      const isTrackPoint = stations.length === 0;
                      const shape = primaryStation ? stationKindsById.get(primaryStation.kindId)?.shape ?? "circle" : "circle";

                      return (
                        <g
                          key={node.id}
                          onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                          onContextMenu={(event) => handleNodeContextMenu(event, node.id)}
                          style={{ cursor: "grab" }}
                        >
                          {renderNodeSymbol(shape, node, isSelected, isTrackPoint)}
                        </g>
                      );
                    })}

                    {currentStations.map((station) => {
                      const node = nodesById.get(station.nodeId);
                      if (!node) return null;
                      const stationKind = stationKindsById.get(station.kindId);
                      const position = getStationLabelPosition(station, node);
                      const labelX = position.x;
                      const labelY = position.y;
                      const isDragging = draggingLabelStationId === station.id;
                      const isSelected = selectedStationId === station.id;
                      const diagnostics = labelDiagnostics.get(station.id);
                      const box = diagnostics?.box ?? estimateLabelBox(station.name, labelX, labelY);
                      const shouldShowLeader = isDragging && (diagnostics?.leaderLine ?? false);
                      const labelAnchorY = labelY - 6;

                      return (
                        <g
                          key={station.id}
                          onMouseDown={(event) => handleLabelMouseDown(event, station.id, node.id)}
                          onContextMenu={(event) => handleStationContextMenu(event, station.id, node.id)}
                          style={{ cursor: "grab" }}
                        >
                          {shouldShowLeader ? (
                            <line
                              x1={node.x}
                              y1={node.y}
                              x2={Math.max(box.minX, Math.min(node.x, box.maxX))}
                              y2={Math.max(box.minY, Math.min(labelAnchorY, box.maxY))}
                              stroke={diagnostics?.colliding ? "#dc2626" : "#94a3b8"}
                              strokeWidth="1.5"
                              strokeDasharray="3 3"
                            />
                          ) : null}
                          {diagnostics?.colliding || isDragging || isSelected ? (
                            <rect
                              x={box.minX}
                              y={box.minY}
                              width={box.maxX - box.minX}
                              height={box.maxY - box.minY}
                              rx="6"
                              fill={diagnostics?.colliding ? "#fff1f2" : "white"}
                              fillOpacity="0.92"
                              stroke={diagnostics?.colliding ? "#dc2626" : isSelected ? "#0f172a" : "#94a3b8"}
                              strokeDasharray={diagnostics?.colliding || isDragging || isSelected ? "4 3" : undefined}
                            />
                          ) : null}
                          <text
                            x={labelX}
                            y={labelY}
                            fontSize="14"
                            fontFamily={stationKind?.fontFamily ?? DEFAULT_STATION_FONT_FAMILY}
                            fontWeight={stationKind?.fontWeight ?? DEFAULT_STATION_FONT_WEIGHT}
                            fill={diagnostics?.colliding ? "#991b1b" : "#111827"}
                          >
                            {station.name}
                          </text>
                        </g>
                      );
                    })}

                    {marqueeSelection ? (
                      <rect
                        x={normalizeRect(marqueeSelection.start, marqueeSelection.end).minX}
                        y={normalizeRect(marqueeSelection.start, marqueeSelection.end).minY}
                        width={normalizeRect(marqueeSelection.start, marqueeSelection.end).width}
                        height={normalizeRect(marqueeSelection.start, marqueeSelection.end).height}
                        fill="#0ea5e9"
                        fillOpacity="0.08"
                        stroke="#0284c7"
                        strokeDasharray="6 4"
                        strokeWidth="1.5"
                        pointerEvents="none"
                      />
                    ) : null}
                  </svg>
                </div>

                <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {currentStations.length} stations
                  </div>
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {currentSegments.length} segments
                  </div>
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {currentSheet?.name ?? "Sheet"}
                  </div>
                </div>

                {nodeContextMenu ? (
                  <div
                    className="fixed z-30 min-w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
                  >
                    {nodeContextMenu.nodeIds.length === 1 ? (
                      <>
                        {contextMenuStation ? (
                          <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Station</div>
                            <Input
                              value={contextMenuStation.name}
                              onFocus={() => setSelectedStationId(contextMenuStation.id)}
                              onChange={(event) => {
                                setSelectedStationId(contextMenuStation.id);
                                updateStation(contextMenuStation.id, { name: event.target.value });
                              }}
                              placeholder="Station name"
                              className="h-9"
                            />
                            <select
                              value={contextMenuStation.kindId}
                              onChange={(event) => {
                                setSelectedStationId(contextMenuStation.id);
                                updateStation(contextMenuStation.id, { kindId: event.target.value });
                              }}
                              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              {map.stationKinds.map((kind) => (
                                <option key={kind.id} value={kind.id}>
                                  {kind.name} {stationKindShapeGlyph(kind.shape)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Track</div>
                          {pendingSegmentStartNodeId && pendingSegmentStartNodeId !== nodeContextMenu.nodeIds[0] ? (
                            <button
                              type="button"
                              className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                              onClick={() => completeSegmentAtNode(nodeContextMenu.nodeIds[0])}
                            >
                              Create segment to here
                            </button>
                          ) : pendingSegmentStartNodeId === nodeContextMenu.nodeIds[0] ? (
                            <button
                              type="button"
                              className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                              onClick={cancelPendingSegment}
                            >
                              Cancel pending segment
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                              onClick={() => startSegmentFromNode(nodeContextMenu.nodeIds[0])}
                            >
                              Start segment here
                            </button>
                          )}
                        </div>
                        <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assign Station</div>
                          <Input
                            value={nodeAssignmentQuery}
                            onChange={(event) => setNodeAssignmentQuery(event.target.value)}
                            placeholder="Search stations"
                            className="h-9"
                          />
                          <div className="max-h-40 space-y-1 overflow-auto">
                            {stationAssignmentResults.slice(0, 8).map((station) => (
                              <button
                                key={station.id}
                                type="button"
                                className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                                onClick={() => assignStationToNode(station.id, nodeContextMenu.nodeIds[0])}
                              >
                                <span className="truncate">{station.name}</span>
                                <span className="ml-3 shrink-0 text-xs text-slate-500">
                                  {stationKindsById.get(station.kindId)?.name ?? "Unknown"}
                                </span>
                              </button>
                            ))}
                            {stationAssignmentResults.length === 0 ? (
                              <div className="px-2 py-2 text-xs text-slate-500">No stations match that search.</div>
                            ) : null}
                          </div>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => createStationAtNode(nodeContextMenu.nodeIds[0], nodeAssignmentQuery)}
                          >
                            <Plus className="h-4 w-4" />
                            Add new station
                          </Button>
                        </div>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                      onClick={() => deleteNodes(nodeContextMenu.nodeIds)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {nodeContextMenu.nodeIds.length > 1 ? "Delete nodes" : "Delete node"}
                    </button>
                  </div>
                ) : null}

                {segmentContextMenu && contextMenuSegment ? (
                  <div
                    className="fixed z-30 min-w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{ left: segmentContextMenu.x, top: segmentContextMenu.y }}
                  >
                    {assignedLinesForContextSegment.length > 0 ? (
                      <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Unassign Line</div>
                        <div className="mt-2 space-y-1">
                          {assignedLinesForContextSegment.map((line) => (
                            <button
                              key={line.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                              onClick={() => unassignLineFromSegment(line.id, contextMenuSegment.id)}
                            >
                              <span className="truncate">{line.name}</span>
                              <span
                                className="ml-3 h-3 w-3 shrink-0 rounded-full border border-slate-200"
                                style={{ backgroundColor: line.color }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assign Line</div>
                      <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                        {map.lines.map((line) => (
                          <button
                            key={line.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                            onClick={() => assignLineToSegment(line.id, contextMenuSegment.id)}
                          >
                            <span className="truncate">{line.name}</span>
                            <span
                              className="ml-3 h-3 w-3 shrink-0 rounded-full border border-slate-200"
                              style={{ backgroundColor: line.color }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                      onClick={() => duplicateSegment(contextMenuSegment.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Duplicate segment
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                      onClick={() => deleteSegment(contextMenuSegment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove segment
                    </button>
                  </div>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/92 px-3 py-2 backdrop-blur">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {map.sheets.map((sheet) => {
                      const active = currentSheetId === sheet.id;
                      const renaming = renamingSheetId === sheet.id;

                      return (
                        <div
                          key={sheet.id}
                          className={`flex items-center gap-2 rounded-t-2xl border px-3 py-2 text-sm shadow-sm ${
                            active ? "border-slate-300 bg-white text-ink" : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {renaming ? (
                            <Input
                              autoFocus
                              value={sheetNameDraft}
                              onChange={(event) => setSheetNameDraft(event.target.value)}
                              onBlur={commitSheetRename}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitSheetRename();
                                if (event.key === "Escape") {
                                  setRenamingSheetId(null);
                                  setSheetNameDraft("");
                                }
                              }}
                              className="h-8 min-w-[10rem] px-2 py-1 text-sm"
                            />
                          ) : (
                            <button
                              type="button"
                              className="whitespace-nowrap font-medium"
                              onClick={() => setCurrentSheetId(sheet.id)}
                              onDoubleClick={() => startRenamingSheet(sheet.id, sheet.name)}
                            >
                              {sheet.name}
                            </button>
                          )}
                          {active && map.sheets.length > 1 ? (
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                              onClick={deleteCurrentSheet}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={addSheet}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {sidePanel !== "closed" ? (
            <div className="min-w-0">
              <Card className="flex h-full min-h-[78vh] flex-col overflow-hidden border-slate-200 bg-white/95 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>{sidePanel === "edit" ? "Edit Panel" : "Management"}</CardTitle>
                    <p className="mt-1 text-xs text-muted">
                      {sidePanel === "edit" ? "Contextual tools for the selected map elements." : "Infrequent project-level controls."}
                    </p>
                  </div>
                  <Button variant="outline" className="px-3" onClick={() => setSidePanel("closed")}>
                    Close
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto space-y-6">
                  {sidePanel === "edit" ? (
                    <>
                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Quick Add</div>
                        <div className="flex gap-2">
                          <Input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="Station name" />
                          <Button onClick={addStation}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted">Quick add creates an unassigned station object. Use the canvas to assign it to a track point later.</p>
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Stations</div>
                        <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                          {visibleStations.map((station) => (
                            <div
                              key={station.id}
                              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                                selectedStationId === station.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-slate-100"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedNodeId(station.nodeId ?? "");
                                  setSelectedNodeIds(station.nodeId ? [station.nodeId] : []);
                                  setSelectedStationId(station.id);
                                }}
                                className="flex min-w-0 flex-1 items-center justify-between text-left"
                              >
                                <span className="truncate">{station.name}</span>
                                <div className="flex items-center gap-2">
                                  {!station.nodeId ? <Badge>Unassigned</Badge> : null}
                                  <Badge>{stationKindsById.get(station.kindId)?.name ?? "Unknown"}</Badge>
                                </div>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${station.name}`}
                                className={`rounded-lg px-2 py-1 ${
                                  selectedStationId === station.id ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                                onClick={() => (station.nodeId ? deleteNode(station.nodeId) : deleteStation(station.id))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Selected Node</div>
                        {selectedNode ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="grid grid-cols-2 gap-2">
                              <Input type="number" value={selectedNode.x} onChange={(event) => updateNode({ x: Number(event.target.value) })} />
                              <Input type="number" value={selectedNode.y} onChange={(event) => updateNode({ y: Number(event.target.value) })} />
                            </div>
                            {selectedNodeStations.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-ink">This track point has no station yet.</p>
                                  <p className="text-xs text-muted">Attach a station here to give it a name, kind, and label.</p>
                                  <div className="flex gap-2">
                                    <Input
                                      value={newStationName}
                                      onChange={(event) => setNewStationName(event.target.value)}
                                      placeholder="Station name"
                                    />
                                    <Button onClick={attachStationToSelectedNode}>
                                      <Plus className="h-4 w-4" />
                                      Attach station
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              {selectedNodeStations.map((station) => (
                                <div key={station.id} className="rounded-xl bg-white px-3 py-2 text-sm text-ink">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={station.name}
                                      onFocus={() => setSelectedStationId(station.id)}
                                      onChange={(event) => updateStation(station.id, { name: event.target.value })}
                                    />
                                    <Button
                                      variant="outline"
                                      className="shrink-0"
                                      onClick={() => {
                                        setSelectedStationId(station.id);
                                        fixLabelForStation(station.id);
                                      }}
                                    >
                                      Fix label
                                    </Button>
                                  </div>
                                  <select
                                    value={station.kindId}
                                    onChange={(event) => {
                                      setSelectedStationId(station.id);
                                      updateStation(station.id, { kindId: event.target.value });
                                    }}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                  >
                                    {map.stationKinds.map((kind) => (
                                      <option key={kind.id} value={kind.id}>
                                        {kind.name} {stationKindShapeGlyph(kind.shape)}
                                      </option>
                                    ))}
                                  </select>
                                  {selectedStationId === station.id && labelDiagnostics.get(station.id)?.colliding ? (
                                    <p className="mt-2 text-xs font-medium text-rose-700">
                                      Label collision detected with
                                      {labelDiagnostics.get(station.id)?.overlapsLabel && labelDiagnostics.get(station.id)?.overlapsSegment
                                        ? " another label and a segment."
                                        : labelDiagnostics.get(station.id)?.overlapsSegment
                                          ? " a segment."
                                          : " another label."}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                              {selectedNodeStations.length === 0 ? <p className="text-xs text-muted">No station is attached to this node.</p> : null}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">Select a node on the canvas.</p>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Selected Segment</div>
                        {selectedSegment ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm font-medium text-ink">{selectedSegment.id}</div>
                            <div className="text-xs text-muted">
                              {selectedSegment.fromNodeId} to {selectedSegment.toNodeId}
                            </div>
                            <Button variant="destructive" className="w-full" onClick={deleteSelectedSegment}>
                              <Trash2 className="h-4 w-4" />
                              Delete segment
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">Select a segment on the canvas.</p>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Lines</div>
                        <div className="flex gap-2">
                          <select
                            value={selectedLineId}
                            onChange={(event) => setSelectedLineId(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          >
                            {map.lines.map((line) => (
                              <option key={line.id} value={line.id}>
                                {line.name}
                              </option>
                            ))}
                          </select>
                          <Button onClick={addLine}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {selectedLine ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <Input value={selectedLine.name} onChange={(event) => updateLine({ name: event.target.value })} />
                            <div className="grid grid-cols-3 gap-2">
                              <Input type="color" value={selectedLine.color} onChange={(event) => updateLine({ color: event.target.value })} />
                              <Input
                                type="number"
                                min={1}
                                max={32}
                                value={selectedLine.strokeWidth}
                                onChange={(event) =>
                                  updateLine({
                                    strokeWidth: Math.min(32, Math.max(1, Number(event.target.value) || 1)),
                                  })
                                }
                              />
                              <select
                                value={selectedLine.strokeStyle}
                                onChange={(event) => updateLine({ strokeStyle: event.target.value as Line["strokeStyle"] })}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                              <svg viewBox="0 0 180 24" className="h-6 w-full">
                                <path
                                  d="M 8 12 L 172 12"
                                  fill="none"
                                  stroke={selectedLine.color}
                                  strokeWidth={selectedLine.strokeWidth}
                                  strokeDasharray={lineStrokeDasharray(selectedLine)}
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                            <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
                              {currentSegments.map((segment) => {
                                const active = selectedLineRun?.segmentIds.includes(segment.id) ?? false;
                                return (
                                  <label key={segment.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink">
                                    <span>{segment.id}</span>
                                    <input type="checkbox" checked={active} onChange={() => toggleSegmentOnSelectedLine(segment.id)} />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Development Tools</div>
                        <div className="grid gap-2">
                          <Button className="w-full" onClick={bootstrapDevelopmentModel}>
                            Bootstrap Model
                          </Button>
                          <Button variant="outline" className="w-full" onClick={autoPlaceCurrentSheetLabels}>
                            Auto-place labels on this sheet
                          </Button>
                        </div>
                        <p className="text-xs text-muted">
                          Bootstrap seeds the editor with multiple overview/detail sheets, station kinds, line styles, and ready-made runs.
                        </p>
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Station Kinds</div>
                        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <Input value={newStationKindName} onChange={(event) => setNewStationKindName(event.target.value)} placeholder="New station kind" />
                          <Input
                            value={newStationKindFontFamily}
                            onChange={(event) => setNewStationKindFontFamily(event.target.value)}
                            placeholder='Font family, e.g. "Avenir Next", Arial, sans-serif'
                          />
                          <div className="flex gap-2">
                            <select
                              value={newStationKindShape}
                              onChange={(event) => setNewStationKindShape(event.target.value as StationKindShape)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              <option value="circle">Circle</option>
                              <option value="interchange">Interchange</option>
                              <option value="terminal">Terminal</option>
                            </select>
                            <select
                              value={newStationKindFontWeight}
                              onChange={(event) => setNewStationKindFontWeight(event.target.value as StationLabelFontWeight)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              {STATION_FONT_WEIGHT_OPTIONS.map((weight) => (
                                <option key={weight} value={weight}>
                                  {weight}
                                </option>
                              ))}
                            </select>
                            <Button onClick={addStationKind}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                          {map.stationKinds.map((kind) => (
                            <button
                              key={kind.id}
                              type="button"
                              onClick={() => setSelectedStationKindId(kind.id)}
                              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                                selectedStationKindId === kind.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-slate-100"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                  {renderStationKindPreview(kind.shape)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium">{kind.name}</div>
                                  <div
                                    className="mt-1 truncate text-sm opacity-90"
                                    style={{ fontFamily: kind.fontFamily, fontWeight: kind.fontWeight }}
                                  >
                                    Sample label ({kind.fontWeight})
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {selectedStationKind ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <Input value={selectedStationKind.name} onChange={(event) => updateStationKind(selectedStationKind.id, { name: event.target.value })} />
                            <Input
                              value={selectedStationKind.fontFamily}
                              onChange={(event) => updateStationKind(selectedStationKind.id, { fontFamily: event.target.value || DEFAULT_STATION_FONT_FAMILY })}
                              placeholder='Font family, e.g. "Avenir Next", Arial, sans-serif'
                            />
                            <select
                              value={selectedStationKind.shape}
                              onChange={(event) => updateStationKind(selectedStationKind.id, { shape: event.target.value as StationKindShape })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              <option value="circle">Circle</option>
                              <option value="interchange">Interchange</option>
                              <option value="terminal">Terminal</option>
                            </select>
                            <select
                              value={selectedStationKind.fontWeight}
                              onChange={(event) => updateStationKind(selectedStationKind.id, { fontWeight: event.target.value as StationLabelFontWeight })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              {STATION_FONT_WEIGHT_OPTIONS.map((weight) => (
                                <option key={weight} value={weight}>
                                  {weight}
                                </option>
                              ))}
                            </select>
                            <div
                              className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-ink"
                              style={{ fontFamily: selectedStationKind.fontFamily, fontWeight: selectedStationKind.fontWeight }}
                            >
                              Preview label for {selectedStationKind.name}
                            </div>
                            <Button variant="destructive" className="w-full" onClick={deleteSelectedStationKind} disabled={map.stationKinds.length <= 1}>
                              <Trash2 className="h-4 w-4" />
                              Delete station kind
                            </Button>
                          </div>
                        ) : null}
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Project JSON</div>
                        <Textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} className="min-h-[260px] font-mono text-xs" />
                        <Button className="w-full" onClick={importJson}>
                          <Upload className="h-4 w-4" />
                          Import JSON into editor
                        </Button>
                        {errorMessage ? <p className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
                      </section>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="hidden xl:block" />
          )}
        </div>
      </div>
    </div>
  );
}
