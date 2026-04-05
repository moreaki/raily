import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { DEVELOPMENT_BOOTSTRAP_MAP, INITIAL_MAP, LINE_PRESETS } from "@/entities/railway-map/model/constants";
import { railwayMapSchema } from "@/entities/railway-map/model/schema";
import type { Line, LineRun, MapNode, MapPoint, RailwayMap, Segment, Station, StationKind, StationKindShape, StationLabelFontWeight } from "@/entities/railway-map/model/types";
import {
  buildSegmentPoints,
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
  sanitizeRailwayMap,
} from "@/entities/railway-map/model/utils";
import {
  chooseSlotIndices,
  clamp,
  getClampedMenuPosition,
  getSvgPoint,
  getNodeSide,
  NodeSide,
  normalizeRect,
  normalizeSearchValue,
  offsetPoints,
  pathFromPoints,
  pointOnPathAtHalf,
  snapCoordinate,
  sortPointsForSide,
  withAnchoredSegmentEndpoints,
} from "@/features/railway-map-editor/lib/geometry";
import {
  autoPlaceLabels,
  boxesOverlap,
  DEFAULT_STATION_FONT_FAMILY,
  DEFAULT_STATION_FONT_SIZE,
  DEFAULT_STATION_FONT_WEIGHT,
  DEFAULT_STATION_SYMBOL_SIZE,
  estimateLabelBox,
  findNearbyFreePoint,
  getStationKindFontSize,
  getStationLabelPosition,
  normalizeRotation,
  pointInBox,
  pointToSegmentDistance,
  segmentIntersectsLabelBox,
  STATION_FONT_WEIGHT_OPTIONS,
} from "@/features/railway-map-editor/lib/labels";
import { useRailwayMapViewport } from "@/features/railway-map-editor/lib/useRailwayMapViewport";
import { RailwayMapInspector } from "@/features/railway-map-editor/ui/RailwayMapInspector";
import { RailwayMapManagement } from "@/features/railway-map-editor/ui/RailwayMapManagement";
import { RailwayMapCanvasPane } from "@/features/railway-map-editor/ui/RailwayMapCanvasPane";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

const STORAGE_KEY = "raily:editor-map";
const SHEET_VIEW_STORAGE_KEY = "raily:sheet-views";
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.04;
const WORLD_SIZE = 200000;
const MIN_GRID_STEP = 4;
const ROTATE_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M22 12l-3 3-3-3'/><path d='M2 12l3-3 3 3'/><path d='M19.016 14v-1.95A7.05 7.05 0 0 0 8 6.22'/><path d='M16.016 17.845A7.05 7.05 0 0 1 5 12.015V10'/><path d='M5 10V9'/><path d='M19 15v-1'/></svg>") 12 12, crosshair`;
const NODE_SEGMENT_LONG_PRESS_MS = 260;
const NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD = 6;

type NodeMarker = {
  key: string;
  center: MapPoint;
  segmentIds: string[];
  laneId: string | null;
};

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderNodeSymbol(
  shape: StationKindShape,
  center: MapPoint,
  isTrackPoint: boolean,
  symbolSize = DEFAULT_STATION_SYMBOL_SIZE,
) {
  const scale = isTrackPoint ? 1 : symbolSize;
  return (
    <>
      {isTrackPoint ? (
        <rect
          x={center.x - 5}
          y={center.y - 5}
          width="10"
          height="10"
          transform={`rotate(45 ${center.x} ${center.y})`}
          fill="#e2e8f0"
          stroke="#475569"
          strokeWidth="2.25"
        />
      ) : shape === "interchange" ? (
        <rect
          x={center.x - 10 * scale}
          y={center.y - 10 * scale}
          width={20 * scale}
          height={20 * scale}
          rx={4 * scale}
          fill="white"
          stroke="#111827"
          strokeWidth="3.25"
        />
      ) : shape === "terminal" ? (
        <rect
          x={center.x - 12 * scale}
          y={center.y - 7 * scale}
          width={24 * scale}
          height={14 * scale}
          rx={5 * scale}
          fill="white"
          stroke="#111827"
          strokeWidth="3.25"
        />
      ) : (
        <circle cx={center.x} cy={center.y} r={7.5 * scale} fill="white" stroke="#111827" strokeWidth="3.25" />
      )}
    </>
  );
}

function renderStationKindPreview(shape: StationKindShape, symbolSize: number) {
  const previewNode = { id: "preview", sheetId: "preview", x: 18, y: 18 };

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      {renderNodeSymbol(shape, previewNode, false, symbolSize)}
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
  if (!raw) return sanitizeRailwayMap(INITIAL_MAP);

  try {
    return sanitizeRailwayMap(railwayMapSchema.parse(JSON.parse(raw)));
  } catch {
    return sanitizeRailwayMap(INITIAL_MAP);
  }
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

export default function RailwayMapEditor() {
  const initialMapRef = useRef<RailwayMap | null>(null);
  if (!initialMapRef.current) {
    initialMapRef.current = loadStoredMap();
  }
  const initialMap = initialMapRef.current;

  const [map, setMap] = useState<RailwayMap>(initialMap);
  const model = map.model;
  const config = map.config;
  const [selectedNodeId, setSelectedNodeId] = useState(initialMap.model.nodes[0]?.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(initialMap.model.nodes[0]?.id ? [initialMap.model.nodes[0].id] : []);
  const [selectedNodeMarkerKey, setSelectedNodeMarkerKey] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState(initialMap.model.stations[0]?.id ?? "");
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialMap.model.segments[0]?.id ?? "");
  const [selectedLineId, setSelectedLineId] = useState(initialMap.config.lines[0]?.id ?? "");
  const [selectedStationKindId, setSelectedStationKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");
  const [currentSheetId, setCurrentSheetId] = useState(initialMap.model.sheets[0]?.id ?? "");
  const [newStationName, setNewStationName] = useState("");
  const [newStationKindId, setNewStationKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");
  const [nodeAssignmentKindId, setNodeAssignmentKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");
  const [nodeAssignmentName, setNodeAssignmentName] = useState("");
  const [newStationKindName, setNewStationKindName] = useState("");
  const [newStationKindShape, setNewStationKindShape] = useState<StationKindShape>("circle");
  const [newStationKindFontFamily, setNewStationKindFontFamily] = useState(DEFAULT_STATION_FONT_FAMILY);
  const [newStationKindFontWeight, setNewStationKindFontWeight] = useState<StationLabelFontWeight>(DEFAULT_STATION_FONT_WEIGHT);
  const [newStationKindFontSize, setNewStationKindFontSize] = useState(DEFAULT_STATION_FONT_SIZE);
  const [newStationKindSymbolSize, setNewStationKindSymbolSize] = useState(DEFAULT_STATION_SYMBOL_SIZE);
  const [sidePanel, setSidePanel] = useState<"closed" | "edit" | "manage">("edit");
  const [manageSection, setManageSection] = useState<"development" | "lines" | "stationKinds">("lines");
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingLabelStationId, setDraggingLabelStationId] = useState<string | null>(null);
  const [rotatingLabelState, setRotatingLabelState] = useState<{
    stationId: string;
    center: MapPoint;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const [dragLastPoint, setDragLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{ start: MapPoint; end: MapPoint } | null>(null);
  const [pendingSegmentStart, setPendingSegmentStart] = useState<{ nodeId: string; laneId: string | null; markerKey: string | null } | null>(null);
  const [segmentDrawState, setSegmentDrawState] = useState<{
    nodeId: string;
    laneId: string | null;
    markerKey: string;
    currentPoint: MapPoint;
  } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    nodeIds: string[];
    x: number;
    y: number;
    markerKey: string | null;
    laneId: string | null;
    segmentId: string | null;
  } | null>(null);
  const [segmentContextMenu, setSegmentContextMenu] = useState<{ segmentId: string; x: number; y: number } | null>(null);
  const [nodeAssignmentQuery, setNodeAssignmentQuery] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef(map);
  const nodeDragSnapshotRef = useRef<{
    startPoint: MapPoint;
    positionsByNodeId: Map<string, MapPoint>;
    labelOffsetsByStationId: Map<string, MapPoint>;
  } | null>(null);
  const undoStackRef = useRef<RailwayMap[]>([]);
  const redoStackRef = useRef<RailwayMap[]>([]);
  const transientHistoryStartRef = useRef<RailwayMap | null>(null);
  const nodeLongPressTimeoutRef = useRef<number | null>(null);
  const nodeLongPressPressRef = useRef<{
    nodeId: string;
    laneId: string | null;
    markerKey: string;
    clientX: number;
    clientY: number;
    startPoint: MapPoint;
  } | null>(null);

  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedStation = model.stations.find((station) => station.id === selectedStationId) ?? null;
  const selectedSegment = model.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedLine = config.lines.find((line) => line.id === selectedLineId) ?? null;
  const selectedStationKind = config.stationKinds.find((kind) => kind.id === selectedStationKindId) ?? null;
  const currentSheet = model.sheets.find((sheet) => sheet.id === currentSheetId) ?? null;
  const pendingSegmentStartNodeId = pendingSegmentStart?.nodeId ?? null;
  const contextMenuNodeId = nodeContextMenu?.nodeIds.length === 1 ? nodeContextMenu.nodeIds[0] : null;
  const contextMenuNode = contextMenuNodeId ? model.nodes.find((node) => node.id === contextMenuNodeId) ?? null : null;
  const contextMenuSegment = segmentContextMenu ? model.segments.find((segment) => segment.id === segmentContextMenu.segmentId) ?? null : null;

  const currentNodes = useMemo(() => model.nodes.filter((node) => node.sheetId === currentSheetId), [currentSheetId, model.nodes]);
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const currentNodeIds = useMemo(() => new Set(currentNodes.map((node) => node.id)), [currentNodes]);
  const currentStations = useMemo(
    () =>
      model.stations.filter(
        (station): station is Station & { nodeId: string } => !!station.nodeId && currentNodeIds.has(station.nodeId),
      ),
    [currentNodeIds, model.stations],
  );
  const unassignedStations = useMemo(
    () => model.stations.filter((station): station is Station & { nodeId: null } => !station.nodeId),
    [model.stations],
  );
  const currentSegments = useMemo(
    () => model.segments.filter((segment) => segment.sheetId === currentSheetId),
    [currentSheetId, model.segments],
  );
  const {
    zoom,
    setZoom,
    viewportCenter,
    setViewportCenter,
    sheetViews,
    setSheetViews,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridStepX,
    setGridStepX,
    gridStepY,
    setGridStepY,
    effectiveGridStepX,
    effectiveGridStepY,
    panning,
    setPanning,
    panStart,
    setPanStart,
    viewBox,
    gridLines,
    panViewportByPixels,
    applyZoom,
    resetViewportToSheet,
  } = useRailwayMapViewport({
    canvasViewportRef,
    svgRef,
    currentSheetId,
    currentNodes,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    minGridStep: MIN_GRID_STEP,
    sheetViewStorageKey: SHEET_VIEW_STORAGE_KEY,
  });

  const nodesById = useMemo(() => new Map(currentNodes.map((node) => [node.id, node])), [currentNodes]);
  const segmentsById = useMemo(() => new Map(currentSegments.map((segment) => [segment.id, segment])), [currentSegments]);
  const segmentOffsetById = useMemo(() => {
    const groups = new Map<string, Segment[]>();

    for (const segment of currentSegments) {
      const key = [segment.fromNodeId, segment.toNodeId].sort().join("::");
      const current = groups.get(key) ?? [];
      current.push(segment);
      groups.set(key, current);
    }

    const offsets = new Map<string, number>();
    for (const group of groups.values()) {
      const orderedGroup = [...group].sort((left, right) => left.id.localeCompare(right.id));
      const center = (orderedGroup.length - 1) / 2;
      for (let index = 0; index < orderedGroup.length; index += 1) {
        const offset = (index - center) * 18;
        offsets.set(orderedGroup[index].id, offset);
      }
    }

    return offsets;
  }, [currentSegments]);
  const { nodeMarkerCentersById, anchoredEndpointBySegmentNodeKey } = useMemo(() => {
    const nodeLanesByNodeId = new Map<string, { id: string; order: number }[]>();
    for (const lane of model.nodeLanes) {
      const current = nodeLanesByNodeId.get(lane.nodeId) ?? [];
      current.push({ id: lane.id, order: lane.order });
      nodeLanesByNodeId.set(lane.nodeId, current);
    }
    for (const lanes of nodeLanesByNodeId.values()) {
      lanes.sort((left, right) => left.order - right.order);
    }

    const endpointsByNodeId = new Map<
      string,
      Map<
        string,
        {
          side: NodeSide;
          markers: NodeMarker[];
        }
      >
    >();

    for (const node of currentNodes) {
      endpointsByNodeId.set(node.id, new Map());
    }

    for (const segment of currentSegments) {
      const offsetSegmentPoints = offsetPoints(buildSegmentPoints(segment, nodesById), segmentOffsetById.get(segment.id) ?? 0);
      if (offsetSegmentPoints.length < 2) continue;

      const endpoints = [
        {
          nodeId: segment.fromNodeId,
          otherNodeId: segment.toNodeId,
          point: offsetSegmentPoints[0],
          side: getNodeSide(nodesById.get(segment.fromNodeId)!, nodesById.get(segment.toNodeId)!),
          laneId: segment.fromLaneId ?? null,
        },
        {
          nodeId: segment.toNodeId,
          otherNodeId: segment.fromNodeId,
          point: offsetSegmentPoints[offsetSegmentPoints.length - 1],
          side: getNodeSide(nodesById.get(segment.toNodeId)!, nodesById.get(segment.fromNodeId)!),
          laneId: segment.toLaneId ?? null,
        },
      ];

      for (const endpoint of endpoints) {
        const groupsForNode = endpointsByNodeId.get(endpoint.nodeId) ?? new Map();
        const group = groupsForNode.get(endpoint.otherNodeId) ?? { side: endpoint.side, markers: [] };
        group.markers.push({
          key: `${endpoint.nodeId}:${endpoint.otherNodeId}:${segment.id}`,
          center: endpoint.point,
          segmentIds: [segment.id],
          laneId: endpoint.laneId,
        });
        groupsForNode.set(endpoint.otherNodeId, group);
        endpointsByNodeId.set(endpoint.nodeId, groupsForNode);
      }
    }

    const byNodeId = new Map<string, NodeMarker[]>();
    const endpointAnchors = new Map<string, MapPoint>();
    const markerSpacing = 18;

    for (const node of currentNodes) {
      const groups = endpointsByNodeId.get(node.id);
      const allMarkers = [...(groups?.values() ?? [])].flatMap((group) => group.markers);
      const dominantGroup =
        groups
          ? [...groups.values()].sort((left, right) => {
              const leftLaneCount = new Set(left.markers.map((marker) => marker.laneId ?? marker.key)).size;
              const rightLaneCount = new Set(right.markers.map((marker) => marker.laneId ?? marker.key)).size;
              if (rightLaneCount !== leftLaneCount) return rightLaneCount - leftLaneCount;
              if (right.markers.length !== left.markers.length) return right.markers.length - left.markers.length;
              const leftMinX = Math.min(...left.markers.map((marker) => marker.center.x));
              const rightMinX = Math.min(...right.markers.map((marker) => marker.center.x));
              if (leftMinX !== rightMinX) return leftMinX - rightMinX;
              const leftMinY = Math.min(...left.markers.map((marker) => marker.center.y));
              const rightMinY = Math.min(...right.markers.map((marker) => marker.center.y));
              return leftMinY - rightMinY;
            })[0]
          : null;

      const knownLaneIds = (nodeLanesByNodeId.get(node.id) ?? []).map((lane) => lane.id);
      const dominantLaneIds = dominantGroup
        ? sortPointsForSide(
            dominantGroup.markers.map((marker) => marker.center),
            dominantGroup.side,
          )
            .map((point) => dominantGroup.markers.find((marker) => marker.center.x === point.x && marker.center.y === point.y)!)
            .map((marker) => marker.laneId)
            .filter((laneId, index, source): laneId is string => Boolean(laneId) && source.indexOf(laneId) === index)
        : [];
      const orderedLaneIds =
        knownLaneIds.length > 0
          ? [...knownLaneIds, ...dominantLaneIds.filter((laneId) => !knownLaneIds.includes(laneId))]
          : dominantLaneIds;

      if (orderedLaneIds.length === 0 && allMarkers.length === 0) {
        byNodeId.set(node.id, [{ key: `${node.id}:base`, center: { x: node.x, y: node.y }, segmentIds: [], laneId: null }]);
        continue;
      }

      const effectiveLaneIds = orderedLaneIds.length > 0 ? orderedLaneIds : [allMarkers[0]?.laneId ?? `${node.id}:base`];
      const dominantSide = dominantGroup?.side ?? "right";
      const centerOffset = (effectiveLaneIds.length - 1) / 2;
      const slotCenterByLaneId = new Map<string, MapPoint>();

      for (let index = 0; index < effectiveLaneIds.length; index += 1) {
        const laneId = effectiveLaneIds[index];
        const delta = (index - centerOffset) * markerSpacing;
        const center =
          dominantSide === "left" || dominantSide === "right"
            ? { x: node.x, y: node.y + delta }
            : { x: node.x + delta, y: node.y };
        slotCenterByLaneId.set(laneId, center);
      }

      for (const marker of allMarkers) {
        const laneId = marker.laneId ?? effectiveLaneIds[0] ?? null;
        if (!laneId) continue;
        const slotCenter = slotCenterByLaneId.get(laneId) ?? marker.center;
        for (const segmentId of marker.segmentIds) {
          endpointAnchors.set(`${node.id}:${segmentId}`, slotCenter);
        }
      }

      byNodeId.set(
        node.id,
        effectiveLaneIds.map((laneId, index) => ({
          key: `${node.id}:slot:${index}:${laneId}`,
          center: slotCenterByLaneId.get(laneId) ?? { x: node.x, y: node.y },
          segmentIds: allMarkers.flatMap((marker) => (marker.laneId === laneId ? marker.segmentIds : [])),
          laneId,
        })),
      );
    }

    return {
      nodeMarkerCentersById: byNodeId,
      anchoredEndpointBySegmentNodeKey: endpointAnchors,
    };
  }, [currentNodes, currentSegments, model.nodeLanes, nodesById, segmentOffsetById]);
  const linesById = useMemo(() => new Map(config.lines.map((line) => [line.id, line])), [config.lines]);
  const stationKindsById = useMemo(() => new Map(config.stationKinds.map((kind) => [kind.id, kind])), [config.stationKinds]);
  const nodeMarkerCenterByKey = useMemo(() => {
    const next = new Map<string, MapPoint>();
    for (const markers of nodeMarkerCentersById.values()) {
      for (const marker of markers) {
        next.set(marker.key, marker.center);
      }
    }
    return next;
  }, [nodeMarkerCentersById]);
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
  const hasNodeOrStationSelection = Boolean(selectedNode || selectedStation);
  const hasSegmentOrLineSelection = Boolean(selectedSegment || (!hasNodeOrStationSelection && selectedLine));
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
      const box = estimateLabelBox(
        station.name,
        position.x,
        position.y,
        getStationKindFontSize(stationKindsById.get(station.kindId)),
        position.rotation,
      );
      let overlapsLabel = false;
      let overlapsSegment = false;

      for (const otherStation of currentStations) {
        if (otherStation.id === station.id) continue;
        const otherNode = nodesById.get(otherStation.nodeId);
        if (!otherNode) continue;
        const otherPosition = getStationLabelPosition(otherStation, otherNode);
        const otherBox = estimateLabelBox(
          otherStation.name,
          otherPosition.x,
          otherPosition.y,
          getStationKindFontSize(stationKindsById.get(otherStation.kindId)),
          otherPosition.rotation,
        );
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

          const boxCorners = [...box.corners, box.center];
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
    () => model.lineRuns.find((lineRun) => lineRun.lineId === selectedLineId) ?? null,
    [model.lineRuns, selectedLineId],
  );
  const lineIdBySegmentId = useMemo(() => {
    const next = new Map<string, string>();
    for (const lineRun of model.lineRuns) {
      for (const segmentId of lineRun.segmentIds) {
        if (!next.has(segmentId)) {
          next.set(segmentId, lineRun.lineId);
        }
      }
    }
    return next;
  }, [model.lineRuns]);
  const assignedSegmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lineRun of model.lineRuns) {
      for (const segmentId of lineRun.segmentIds) {
        ids.add(segmentId);
      }
    }
    return ids;
  }, [model.lineRuns]);
  const laneDisplayNameById = useMemo(() => {
    const next = new Map<string, string>();

    for (const lane of model.nodeLanes) {
      const segmentIds = currentSegments
        .filter((segment) => segment.fromLaneId === lane.id || segment.toLaneId === lane.id)
        .map((segment) => segment.id);
      const lineNames = [...new Set(segmentIds.map((segmentId) => lineIdBySegmentId.get(segmentId)).filter(Boolean))]
        .map((lineId) => config.lines.find((line) => line.id === lineId)?.name ?? lineId)
        .filter(Boolean);

      next.set(lane.id, lineNames.length > 0 ? lineNames.join(", ") : "Unassigned lane");
    }

    return next;
  }, [config.lines, currentSegments, lineIdBySegmentId, model.nodeLanes]);
  const selectedNodeLanes = useMemo(() => {
    if (!selectedNodeId) return [];

    return model.nodeLanes
      .filter((lane) => lane.nodeId === selectedNodeId)
      .sort((left, right) => left.order - right.order)
      .map((lane) => {
        const segmentIds = currentSegments
          .filter((segment) => segment.fromLaneId === lane.id || segment.toLaneId === lane.id)
          .map((segment) => segment.id);
        const lineNames = [...new Set(segmentIds.map((segmentId) => lineIdBySegmentId.get(segmentId)).filter(Boolean))]
          .map((lineId) => config.lines.find((line) => line.id === lineId)?.name ?? lineId)
          .filter(Boolean);
        const lineColors = [...new Set(segmentIds.map((segmentId) => lineIdBySegmentId.get(segmentId)).filter(Boolean))]
          .map((lineId) => config.lines.find((line) => line.id === lineId)?.color ?? null)
          .filter((color): color is string => Boolean(color));

        return {
          ...lane,
          segmentIds,
          lineNames,
          lineColors,
        };
      });
  }, [config.lines, currentSegments, lineIdBySegmentId, model.nodeLanes, selectedNodeId]);
  const selectedNodeMarkerLaneId = useMemo(() => {
    if (!selectedNodeId || !selectedNodeMarkerKey) return null;
    return nodeMarkerCentersById.get(selectedNodeId)?.find((marker) => marker.key === selectedNodeMarkerKey)?.laneId ?? null;
  }, [nodeMarkerCentersById, selectedNodeId, selectedNodeMarkerKey]);
  const selectedNodeLaneAxis = useMemo(() => {
    if (!selectedNodeId) return "vertical" as const;
    const markers = nodeMarkerCentersById.get(selectedNodeId) ?? [];
    if (markers.length < 2) return "vertical" as const;

    const xs = markers.map((marker) => marker.center.x);
    const ys = markers.map((marker) => marker.center.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    return width > height ? ("horizontal" as const) : ("vertical" as const);
  }, [nodeMarkerCentersById, selectedNodeId]);
  const selectedNodeLaneMoveLabels = selectedNodeLaneAxis === "horizontal"
    ? {
        backward: "Left",
        forward: "Right",
        hint: "Lane order for this node runs left to right around the node center.",
      }
    : {
        backward: "Up",
        forward: "Down",
        hint: "Lane order for this node runs top to bottom around the node center.",
      };
  const nodeContextMenuPosition = useMemo(() => {
    if (!nodeContextMenu) return null;
    return getClampedMenuPosition(
      nodeContextMenu.x,
      nodeContextMenu.y,
      320,
      nodeContextMenu.nodeIds.length === 1 ? 520 : 120,
    );
  }, [nodeContextMenu]);
  const segmentContextMenuPosition = useMemo(() => {
    if (!segmentContextMenu) return null;
    return getClampedMenuPosition(segmentContextMenu.x, segmentContextMenu.y, 320, 420);
  }, [segmentContextMenu]);
  const snapPointToGrid = (point: MapPoint) => ({
    x: snapCoordinate(point.x, effectiveGridStepX),
    y: snapCoordinate(point.y, effectiveGridStepY),
  });
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
  const assignedLineForContextSegment = useMemo(() => {
    if (!contextMenuSegment) return null;

    const owningRun = model.lineRuns.find((lineRun) => lineRun.segmentIds.includes(contextMenuSegment.id));
    return owningRun ? linesById.get(owningRun.lineId) ?? null : null;
  }, [contextMenuSegment, linesById, model.lineRuns]);
  const assignableLinesForContextSegment = useMemo(() => {
    if (!contextMenuSegment) return [];

    return config.lines.filter((line) => line.id !== assignedLineForContextSegment?.id);
  }, [assignedLineForContextSegment, config.lines, contextMenuSegment]);

  const deleteCurrentSelection = useCallback(() => {
    if (selectedStation) {
      if (selectedStation.nodeId) {
        deleteNode(selectedStation.nodeId);
      } else {
        deleteStation(selectedStation.id);
      }
      return;
    }

    if (selectedSegment) {
      deleteSegment(selectedSegment.id);
      return;
    }

    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds);
    }
  }, [selectedNodeIds, selectedSegment, selectedStation]);

  useEffect(() => {
    mapRef.current = map;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  }, [map]);

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
        setSelectedNodeMarkerKey(null);
        const firstStation = currentStations.find((station) => station.nodeId === nextSelectedNodeIds[0]);
        setSelectedStationId(firstStation?.id ?? "");
        return;
      }

      if (key === "backspace" || key === "delete") {
        const hasDeletionTarget = !!selectedStation || !!selectedSegment || selectedNodeIds.length > 0;
        if (!hasDeletionTarget) return;
        event.preventDefault();
        deleteCurrentSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentNodes, currentStations, deleteCurrentSelection, selectedNodeIds.length, selectedSegment, selectedStation]);

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
    if (!selectedNodeMarkerKey) return;
    const markerStillExists = [...nodeMarkerCentersById.values()].some((markers) =>
      markers.some((marker) => marker.key === selectedNodeMarkerKey),
    );
    if (!markerStillExists) {
      setSelectedNodeMarkerKey(null);
    }
  }, [nodeMarkerCentersById, selectedNodeMarkerKey]);

  useEffect(() => {
    if (!selectedLine || !config.lines.some((line) => line.id === selectedLine.id)) {
      setSelectedLineId(config.lines[0]?.id ?? "");
    }
  }, [config.lines, selectedLine]);

  useEffect(() => {
    if (selectedStationId && (!selectedStation || !model.stations.some((station) => station.id === selectedStation.id))) {
      setSelectedStationId("");
    }
  }, [model.stations, selectedStation, selectedStationId]);

  useEffect(() => {
    if (selectedSegmentId && (!selectedSegment || !segmentsById.has(selectedSegment.id))) {
      setSelectedSegmentId("");
    }
  }, [currentSegments, segmentsById, selectedSegment, selectedSegmentId]);

  useEffect(() => {
    if (!selectedStationKind || !config.stationKinds.some((kind) => kind.id === selectedStationKind.id)) {
      setSelectedStationKindId(config.stationKinds[0]?.id ?? "");
    }
  }, [config.stationKinds, selectedStationKind]);

  useEffect(() => {
    if (!config.stationKinds.some((kind) => kind.id === newStationKindId)) {
      setNewStationKindId(config.stationKinds[0]?.id ?? "");
    }
    if (!config.stationKinds.some((kind) => kind.id === nodeAssignmentKindId)) {
      setNodeAssignmentKindId(config.stationKinds[0]?.id ?? "");
    }
  }, [config.stationKinds, newStationKindId, nodeAssignmentKindId]);

  useEffect(() => {
    if (!currentSheet || !model.sheets.some((sheet) => sheet.id === currentSheet.id)) {
      setCurrentSheetId(model.sheets[0]?.id ?? "");
    }
  }, [currentSheet, model.sheets]);

  function pushUndoSnapshot(snapshot: RailwayMap) {
    undoStackRef.current = [...undoStackRef.current.slice(-99), cloneMap(snapshot)];
    redoStackRef.current = [];
  }

  function updateMap(updater: (current: RailwayMap) => RailwayMap, options?: { trackHistory?: boolean }) {
    setMap((current) => {
      const next = sanitizeRailwayMap(updater(current));
      if (next === current || mapsEqual(next, current)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return next;
    });
  }

  function replaceMap(nextMap: RailwayMap, options?: { trackHistory?: boolean }) {
    setMap((current) => {
      const sanitizedNextMap = sanitizeRailwayMap(nextMap);
      if (mapsEqual(current, sanitizedNextMap)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return cloneMap(sanitizedNextMap);
    });
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
    setNodeContextMenu(null);
  }

  function clearCanvasSelections() {
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId("");
    setSelectedSegmentId("");
    setPendingSegmentStart(null);
    setSegmentDrawState(null);
    setNodeContextMenu(null);
    setRotatingLabelState(null);
    clearNodeLongPress();
  }

  function selectSingleNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedSegmentId("");
    const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
    setSelectedStationId(station?.id ?? "");
  }

  function addStation() {
    const nextKindId = newStationKindId || (config.stationKinds[0]?.id ?? "");
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        stations: [
          ...current.model.stations,
          {
            ...createDefaultStation(current, null, newStationName),
            kindId: nextKindId,
          },
        ],
      },
    }));
    setNewStationName("");
  }

  function addNode() {
    if (!currentSheet) return;
    updateMap((current) => {
      const placement = findNearbyFreePoint(current, currentSheet.id, viewportCenter);
      const snappedPlacement = snapToGrid ? snapPointToGrid(placement) : placement;
      return {
        ...current,
        model: {
          ...current.model,
          nodes: [
            ...current.model.nodes,
            {
              ...createDefaultNodeForSheet(current, currentSheet.id),
              x: snappedPlacement.x,
              y: snappedPlacement.y,
            },
          ],
        },
      };
    });
  }

  function attachStationToSelectedNode() {
    if (!selectedNode) return;
    if (selectedNodeStations.length > 0) return;

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        stations: [...current.model.stations, createDefaultStationAtNode(current, selectedNode, newStationName)],
      },
    }));
    setNewStationName("");
  }

  function assignStationToNode(stationId: string, nodeId: string) {
    const node = model.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const stationAtNode = model.stations.find((candidate) => candidate.nodeId === nodeId);
    if (stationAtNode && stationAtNode.id !== stationId) return;

    updateStation(stationId, {
      nodeId,
      label: {
        x: node.x + 12,
        y: node.y - 10,
        align: "right",
        rotation: 0,
      },
    });
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    setNodeAssignmentQuery("");
    setNodeAssignmentName("");
    setNodeContextMenu(null);
  }

  function createStationAtNode(nodeId: string, name: string, kindId?: string) {
    const node = model.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (model.stations.some((candidate) => candidate.nodeId === nodeId)) return;

    const stationName = name.trim() || `Station ${model.stations.length + 1}`;
    const createdStation = {
      ...createDefaultStationAtNode(map, node, stationName),
      kindId: kindId || config.stationKinds[0]?.id || "",
    };
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        stations: [...current.model.stations, createdStation],
      },
    }));
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(createdStation.id);
    setNodeAssignmentQuery("");
    setNodeAssignmentName("");
    setNodeAssignmentKindId(config.stationKinds[0]?.id ?? "");
    setNodeContextMenu(null);
  }

  function addSheet() {
    const nextSheet = createDefaultSheet(map, "");
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        sheets: [...current.model.sheets, nextSheet],
      },
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
      name: newStationKindName.trim() || `Kind ${config.stationKinds.length + 1}`,
      shape: newStationKindShape,
      symbolSize: clamp(newStationKindSymbolSize, 0.6, 2.5),
      fontFamily: newStationKindFontFamily.trim() || DEFAULT_STATION_FONT_FAMILY,
      fontWeight: newStationKindFontWeight,
      fontSize: clamp(newStationKindFontSize, 8, 72),
    };

    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        stationKinds: [...current.config.stationKinds, stationKind],
      },
    }));
    setSelectedStationKindId(stationKind.id);
    setNewStationKindName("");
    setNewStationKindShape("circle");
    setNewStationKindSymbolSize(DEFAULT_STATION_SYMBOL_SIZE);
    setNewStationKindFontFamily(DEFAULT_STATION_FONT_FAMILY);
    setNewStationKindFontWeight(DEFAULT_STATION_FONT_WEIGHT);
    setNewStationKindFontSize(DEFAULT_STATION_FONT_SIZE);
  }

  function addLine() {
    const preset = LINE_PRESETS[config.lines.length % LINE_PRESETS.length];
    const nextLine = createDefaultLine(config.lines.length, preset);
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        lines: [...current.config.lines, nextLine],
      },
      model: {
        ...current.model,
        lineRuns: [...current.model.lineRuns, { id: `lr-${nextLine.id}`, lineId: nextLine.id, segmentIds: [] }],
      },
    }));
    setSelectedLineId(nextLine.id);
  }

  function bootstrapDevelopmentModel() {
    const seededMap = cloneMap(DEVELOPMENT_BOOTSTRAP_MAP);
    const nextMap = {
      ...seededMap,
      model: {
        ...seededMap.model,
        stations: autoPlaceLabels(seededMap, { preserveExisting: true, bootstrapMode: true }),
      },
    };

    replaceMap(nextMap);
    setSelectedNodeId(nextMap.model.nodes[0]?.id ?? "");
    setSelectedNodeIds(nextMap.model.nodes[0]?.id ? [nextMap.model.nodes[0].id] : []);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(nextMap.model.stations[0]?.id ?? "");
    setSelectedSegmentId(nextMap.model.segments[0]?.id ?? "");
    setSelectedLineId(nextMap.config.lines[0]?.id ?? "");
    setSelectedStationKindId(nextMap.config.stationKinds[0]?.id ?? "");
    setCurrentSheetId(nextMap.model.sheets[0]?.id ?? "");
    setSheetViews({
      "sh-ov": { zoom: 0.46, centerX: 620, centerY: 955 },
    });
    setViewportCenter({ x: 620, y: 955 });
    setZoom(0.46);
    setMarqueeSelection(null);
    setNodeContextMenu(null);
    setPendingSegmentStart(null);
  }

  function autoPlaceCurrentSheetLabels() {
    if (!currentSheetId) return;
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        stations: autoPlaceLabels(current).map((station) => {
        if (!station.nodeId) return station;
        const node = current.model.nodes.find((candidate) => candidate.id === station.nodeId);
        return node?.sheetId === currentSheetId
          ? station
          : current.model.stations.find((candidate) => candidate.id === station.id) ?? station;
      }),
      },
    }));
  }

  function updateCurrentSheetName(name: string) {
    if (!currentSheet) return;

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        sheets: current.model.sheets.map((sheet) => (sheet.id === currentSheet.id ? { ...sheet, name } : sheet)),
      },
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
      model: {
        ...current.model,
        sheets: current.model.sheets.map((sheet) => (sheet.id === renamingSheetId ? { ...sheet, name: nextName } : sheet)),
      },
    }));
    setRenamingSheetId(null);
    setSheetNameDraft("");
  }

  function deleteCurrentSheet() {
    if (!currentSheet) return;
    if (model.sheets.length <= 1) return;

    const nextSheetId = model.sheets.find((sheet) => sheet.id !== currentSheet.id)?.id;
    if (!nextSheetId) return;

    const nodeIdsToRemove = new Set(model.nodes.filter((node) => node.sheetId === currentSheet.id).map((node) => node.id));
    const segmentIdsToRemove = new Set(model.segments.filter((segment) => segment.sheetId === currentSheet.id).map((segment) => segment.id));

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        sheets: current.model.sheets.filter((sheet) => sheet.id !== currentSheet.id),
        nodes: current.model.nodes.filter((node) => node.sheetId !== currentSheet.id),
        stations: current.model.stations.filter((station) => !station.nodeId || !nodeIdsToRemove.has(station.nodeId)),
        segments: current.model.segments.filter((segment) => segment.sheetId !== currentSheet.id),
        lineRuns: current.model.lineRuns.map((lineRun) => ({
          ...lineRun,
          segmentIds: lineRun.segmentIds.filter((segmentId) => !segmentIdsToRemove.has(segmentId)),
        })),
      },
    }));
    setSheetViews((current) => {
      const next = { ...current };
      delete next[currentSheet.id];
      return next;
    });
    setCurrentSheetId(nextSheetId);
  }

  function ensureLineRun(current: RailwayMap, lineId: string) {
    const existing = current.model.lineRuns.find((lineRun) => lineRun.lineId === lineId);
    if (existing) return { current, lineRun: existing };

    const nextLineRun: LineRun = {
      id: createLineRunId(),
      lineId,
      segmentIds: [],
    };

    return {
      current: {
        ...current,
        model: {
          ...current.model,
          lineRuns: [...current.model.lineRuns, nextLineRun],
        },
      },
      lineRun: nextLineRun,
    };
  }

  function toggleSegmentOnSelectedLine(segmentId: string) {
    if (!selectedLine) return;

    updateMap((current) => {
      const { current: nextCurrent, lineRun } = ensureLineRun(current, selectedLine.id);
      const currentlyAssignedToSelected = lineRun.segmentIds.includes(segmentId);

      return {
        ...nextCurrent,
        model: {
          ...nextCurrent.model,
          lineRuns: nextCurrent.model.lineRuns.map((candidate) => {
            if (candidate.id === lineRun.id) {
              const segmentIds = currentlyAssignedToSelected
                ? candidate.segmentIds.filter((value) => value !== segmentId)
                : [...candidate.segmentIds.filter((value) => value !== segmentId), segmentId];
              return { ...candidate, segmentIds };
            }

            if (currentlyAssignedToSelected) return candidate;
            return {
              ...candidate,
              segmentIds: candidate.segmentIds.filter((value) => value !== segmentId),
            };
          }),
        },
      };
    });
    setSelectedSegmentId(segmentId);
  }

  function deleteSelectedSegment() {
    if (!selectedSegment) return;

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        segments: current.model.segments.filter((segment) => segment.id !== selectedSegment.id),
        lineRuns: current.model.lineRuns.map((lineRun) => ({
          ...lineRun,
          segmentIds: lineRun.segmentIds.filter((segmentId) => segmentId !== selectedSegment.id),
        })),
      },
    }));
    setSegmentContextMenu(null);
  }

  function deleteSegment(segmentId: string) {
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        segments: current.model.segments.filter((segment) => segment.id !== segmentId),
        lineRuns: current.model.lineRuns.map((lineRun) => ({
          ...lineRun,
          segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId),
        })),
      },
    }));
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId("");
    }
    setSegmentContextMenu(null);
  }

  function duplicateSegment(segmentId: string) {
    const source = model.segments.find((segment) => segment.id === segmentId);
    if (!source) return;

    const duplicated = {
      ...JSON.parse(JSON.stringify(source)),
      id: createSegmentId(),
      fromLaneId: undefined,
      toLaneId: undefined,
    };

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        segments: [...current.model.segments, duplicated],
      },
    }));
    setSelectedSegmentId(duplicated.id);
    setSegmentContextMenu(null);
  }

  function insertTrackPointOnSegment(segmentId: string) {
    const source = model.segments.find((segment) => segment.id === segmentId);
    if (!source) return;

    const sourcePoints = buildSegmentPoints(source, new Map(model.nodes.map((node) => [node.id, node])));
    if (sourcePoints.length < 2) return;
    const halfwayPoint = pointOnPathAtHalf(sourcePoints);
    const snappedHalfwayPoint = snapToGrid ? snapPointToGrid(halfwayPoint) : halfwayPoint;
    const insertedNode = {
      ...createDefaultNodeForSheet(map, source.sheetId),
      ...snappedHalfwayPoint,
    };

    updateMap((current) => {
      const currentSource = current.model.segments.find((segment) => segment.id === segmentId);
      if (!currentSource) return current;

      const firstSegment = createStraightSegmentForSheet(currentSource.sheetId, currentSource.fromNodeId, insertedNode.id);
      const secondSegment = createStraightSegmentForSheet(currentSource.sheetId, insertedNode.id, currentSource.toNodeId);

      return {
        ...current,
        model: {
          ...current.model,
          nodes: [...current.model.nodes, insertedNode],
          segments: [...current.model.segments.filter((segment) => segment.id !== segmentId), firstSegment, secondSegment],
          lineRuns: current.model.lineRuns.map((lineRun) => ({
            ...lineRun,
            segmentIds: lineRun.segmentIds.flatMap((candidateId) =>
              candidateId === segmentId ? [firstSegment.id, secondSegment.id] : [candidateId],
            ),
          })),
        },
      };
    });

    setSelectedSegmentId("");
    setSelectedNodeId(insertedNode.id);
    setSelectedNodeIds([insertedNode.id]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId("");
    setSegmentContextMenu(null);
  }

  function assignLineToSegment(lineId: string, segmentId: string) {
    updateMap((current) => {
      const { current: ensuredCurrent, lineRun } = ensureLineRun(current, lineId);
      const segmentsByNodeId = new Map<string, Segment[]>();
      for (const segment of ensuredCurrent.model.segments) {
        const fromSegments = segmentsByNodeId.get(segment.fromNodeId) ?? [];
        fromSegments.push(segment);
        segmentsByNodeId.set(segment.fromNodeId, fromSegments);

        const toSegments = segmentsByNodeId.get(segment.toNodeId) ?? [];
        toSegments.push(segment);
        segmentsByNodeId.set(segment.toNodeId, toSegments);
      }

      const segmentIdsToAssign = new Set<string>();
      const queue = [segmentId];

      while (queue.length > 0) {
        const currentSegmentId = queue.shift();
        if (!currentSegmentId || segmentIdsToAssign.has(currentSegmentId)) continue;
        segmentIdsToAssign.add(currentSegmentId);

        const currentSegment = ensuredCurrent.model.segments.find((segment) => segment.id === currentSegmentId);
        if (!currentSegment) continue;

        for (const nodeId of [currentSegment.fromNodeId, currentSegment.toNodeId]) {
          const connectedSegments = segmentsByNodeId.get(nodeId) ?? [];
          if (connectedSegments.length !== 2) continue;

          for (const connectedSegment of connectedSegments) {
            if (!segmentIdsToAssign.has(connectedSegment.id)) {
              queue.push(connectedSegment.id);
            }
          }
        }
      }

      return {
        ...ensuredCurrent,
        model: {
          ...ensuredCurrent.model,
          lineRuns: ensuredCurrent.model.lineRuns.map((candidate) => {
            if (candidate.id === lineRun.id) {
              const segmentIds = [...candidate.segmentIds.filter((value) => !segmentIdsToAssign.has(value))];
              for (const propagatedSegmentId of segmentIdsToAssign) {
                if (!segmentIds.includes(propagatedSegmentId)) {
                  segmentIds.push(propagatedSegmentId);
                }
              }
              return { ...candidate, segmentIds };
            }

            return {
              ...candidate,
              segmentIds: candidate.segmentIds.filter((value) => !segmentIdsToAssign.has(value)),
            };
          }),
        },
      };
    });
    setSelectedLineId(lineId);
    setSelectedSegmentId(segmentId);
    setSegmentContextMenu(null);
  }

  function unassignLineFromSegment(lineId: string, segmentId: string) {
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        lineRuns: current.model.lineRuns.map((lineRun) =>
          lineRun.lineId !== lineId
            ? lineRun
            : {
                ...lineRun,
                segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId),
              },
        ),
      },
    }));
    setSegmentContextMenu(null);
  }

  function handleSelectedLineInspectorChange(lineId: string) {
    if (selectedSegment) {
      assignLineToSegment(lineId, selectedSegment.id);
      return;
    }

    setSelectedLineId(lineId);
  }

  function deleteNodes(nodeIds: string[]) {
    if (nodeIds.length === 0) return;
    const nodeIdSet = new Set(nodeIds);
    const connectedSegmentIds = new Set(
      model.segments
        .filter((segment) => nodeIdSet.has(segment.fromNodeId) || nodeIdSet.has(segment.toNodeId))
        .map((segment) => segment.id),
    );

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        nodes: current.model.nodes.filter((node) => !nodeIdSet.has(node.id)),
        stations: current.model.stations.filter((station) => !station.nodeId || !nodeIdSet.has(station.nodeId)),
        segments: current.model.segments.filter((segment) => !connectedSegmentIds.has(segment.id)),
        lineRuns: current.model.lineRuns.map((lineRun) => ({
          ...lineRun,
          segmentIds: lineRun.segmentIds.filter((segmentId) => !connectedSegmentIds.has(segmentId)),
        })),
      },
    }));

    setSelectedNodeIds((current) => current.filter((nodeId) => !nodeIdSet.has(nodeId)));
    if (selectedNodeId && nodeIdSet.has(selectedNodeId)) setSelectedNodeId("");
    if (selectedNodeId && nodeIdSet.has(selectedNodeId)) setSelectedNodeMarkerKey(null);
    if (selectedStationId && model.stations.find((station) => station.id === selectedStationId && !!station.nodeId && nodeIdSet.has(station.nodeId))) {
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
      model: {
        ...current.model,
        stations: current.model.stations.filter((station) => station.id !== stationId),
      },
    }));
    if (selectedStationId === stationId) {
      setSelectedStationId("");
    }
    setNodeContextMenu(null);
  }

  function deleteSelectedStationKind() {
    if (!selectedStationKind) return;
    if (config.stationKinds.length <= 1) return;

    const fallbackKindId = config.stationKinds.find((kind) => kind.id !== selectedStationKind.id)?.id;
    if (!fallbackKindId) return;

    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        stationKinds: current.config.stationKinds.filter((kind) => kind.id !== selectedStationKind.id),
      },
      model: {
        ...current.model,
        stations: current.model.stations.map((station) =>
          station.kindId === selectedStationKind.id ? { ...station, kindId: fallbackKindId } : station,
        ),
      },
    }));
  }

  function deleteSelectedLine() {
    if (!selectedLine) return;

    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        lines: current.config.lines.filter((line) => line.id !== selectedLine.id),
      },
      model: {
        ...current.model,
        lineRuns: current.model.lineRuns.filter((lineRun) => lineRun.lineId !== selectedLine.id),
      },
    }));

    if (selectedLineId === selectedLine.id) {
      setSelectedLineId(config.lines.find((line) => line.id !== selectedLine.id)?.id ?? "");
    }
  }

  function updateNode(patch: Partial<MapNode>) {
    if (!selectedNode) return;

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        nodes: current.model.nodes.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
        stations: current.model.stations.map((station) =>
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
      },
    }));
  }

  function moveLaneOrder(nodeId: string, laneId: string, direction: -1 | 1) {
    updateMap((current) => {
      const referenceNodeLanes = current.model.nodeLanes
        .filter((lane) => lane.nodeId === nodeId)
        .sort((left, right) => left.order - right.order);
      const currentIndex = referenceNodeLanes.findIndex((lane) => lane.id === laneId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0) {
        return current;
      }

      const targetNodeIds = selectedNodeIdsSet.has(nodeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [nodeId];
      const orderByLaneId = new Map<string, number>();

      for (const targetNodeId of targetNodeIds) {
        const nodeLanes = current.model.nodeLanes
          .filter((lane) => lane.nodeId === targetNodeId)
          .sort((left, right) => left.order - right.order);
        if (nextIndex < 0 || nextIndex >= nodeLanes.length) {
          continue;
        }

        const reordered = [...nodeLanes];
        const [moved] = reordered.splice(currentIndex, 1);
        if (!moved) continue;
        reordered.splice(nextIndex, 0, moved);
        for (let index = 0; index < reordered.length; index += 1) {
          orderByLaneId.set(reordered[index].id, index);
        }
      }

      if (orderByLaneId.size === 0) {
        return current;
      }

      return {
        ...current,
        model: {
          ...current.model,
          nodeLanes: current.model.nodeLanes.map((lane) =>
            orderByLaneId.has(lane.id) ? { ...lane, order: orderByLaneId.get(lane.id) ?? lane.order } : lane,
          ),
        },
      };
    });
  }

  function updateLine(patch: Partial<Line>) {
    if (!selectedLine) return;

    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        lines: current.config.lines.map((line) => (line.id === selectedLine.id ? { ...line, ...patch } : line)),
      },
    }));
  }

  function updateStation(stationId: string, patch: Partial<Station>) {
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        stations: current.model.stations.map((station) => (station.id === stationId ? { ...station, ...patch } : station)),
      },
    }));
  }

  function unassignStation(stationId: string) {
    updateStation(stationId, {
      nodeId: null,
      label: undefined,
    });
    setNodeAssignmentQuery("");
    setNodeContextMenu(null);
  }

  function clearNodeLongPress() {
    if (nodeLongPressTimeoutRef.current !== null) {
      window.clearTimeout(nodeLongPressTimeoutRef.current);
      nodeLongPressTimeoutRef.current = null;
    }
    nodeLongPressPressRef.current = null;
  }

  function beginSegmentDrawFromNode(nodeId: string, laneId: string | null, markerKey: string, startPoint: MapPoint) {
    clearNodeLongPress();
    setDraggingNodeId(null);
    setDragLastPoint(null);
    nodeDragSnapshotRef.current = null;
    setSegmentDrawState({
      nodeId,
      laneId,
      markerKey,
      currentPoint: startPoint,
    });
    setPendingSegmentStart({ nodeId, laneId, markerKey });
  }

  function cancelSegmentDraw() {
    clearNodeLongPress();
    setSegmentDrawState(null);
    setPendingSegmentStart(null);
  }

  function updateStationKind(kindId: string, patch: Partial<StationKind>) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        stationKinds: current.config.stationKinds.map((kind) => (kind.id === kindId ? { ...kind, ...patch } : kind)),
      },
    }));
  }

  function createSegmentFromPendingNode(nextNodeId: string, nextLaneId: string | null) {
    if (!currentSheet) return;
    if (!pendingSegmentStart) {
      setPendingSegmentStart({ nodeId: nextNodeId, laneId: nextLaneId, markerKey: null });
      return;
    }
    if (pendingSegmentStart.nodeId === nextNodeId) {
      setPendingSegmentStart({ nodeId: nextNodeId, laneId: nextLaneId, markerKey: null });
      return;
    }
    const existingSegment = currentSegments.find(
      (segment) =>
        ((segment.fromNodeId === pendingSegmentStart.nodeId &&
          segment.toNodeId === nextNodeId &&
          (segment.fromLaneId ?? null) === (pendingSegmentStart.laneId ?? null) &&
          (segment.toLaneId ?? null) === (nextLaneId ?? null)) ||
          (segment.fromNodeId === nextNodeId &&
            segment.toNodeId === pendingSegmentStart.nodeId &&
            (segment.fromLaneId ?? null) === (nextLaneId ?? null) &&
            (segment.toLaneId ?? null) === (pendingSegmentStart.laneId ?? null))),
    );

    if (existingSegment) {
      setSelectedSegmentId(existingSegment.id);
      setPendingSegmentStart(null);
      return;
    }

    const segment = {
      ...createStraightSegmentForSheet(currentSheet.id, pendingSegmentStart.nodeId, nextNodeId),
      fromLaneId: pendingSegmentStart.laneId ?? undefined,
      toLaneId: nextLaneId ?? undefined,
    };
    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        segments: [...current.model.segments, segment],
      },
    }));
    setSelectedSegmentId(segment.id);
    setPendingSegmentStart(null);
  }

  function startSegmentFromNode(nodeId: string, laneId: string | null, markerKey: string | null) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(markerKey);
    setSegmentDrawState(null);
    setPendingSegmentStart({ nodeId, laneId, markerKey });
    setNodeContextMenu(null);
  }

  function cancelPendingSegment() {
    cancelSegmentDraw();
    setNodeContextMenu(null);
  }

  function completeSegmentAtNode(nodeId: string, laneId: string | null, markerKey: string | null) {
    selectSingleNode(nodeId);
    setSelectedNodeMarkerKey(markerKey);
    createSegmentFromPendingNode(nodeId, laneId);
    setNodeContextMenu(null);
  }

  function handleNodeMouseDown(
    event: MouseEvent<SVGGElement>,
    nodeId: string,
    markerKey: string,
    segmentIds: string[],
    laneId: string | null,
  ) {
    event.stopPropagation();
    clearNodeLongPress();
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
          if (selectedNodeMarkerKey === markerKey) {
            setSelectedNodeMarkerKey(null);
          }
          if (selectedStationId && currentStations.find((station) => station.id === selectedStationId)?.nodeId === nodeId) {
            setSelectedStationId("");
          }
          if (segmentIds.includes(selectedSegmentId)) {
            setSelectedSegmentId("");
          }
          return next;
        }

        const next = [...current, nodeId];
        setSelectedNodeId(nodeId);
        setSelectedNodeMarkerKey(markerKey);
        const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
        setSelectedStationId(station?.id ?? "");
        setSelectedSegmentId(segmentIds.length === 1 ? segmentIds[0] : "");
        return next;
      });
    } else if (!selectedNodeIdsSet.has(nodeId)) {
      selectSingleNode(nodeId);
      setSelectedNodeMarkerKey(markerKey);
      setSelectedSegmentId(segmentIds.length === 1 ? segmentIds[0] : "");
    } else {
      setSelectedNodeId(nodeId);
      setSelectedNodeMarkerKey(markerKey);
      const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
      if (station) setSelectedStationId(station.id);
      setSelectedSegmentId(segmentIds.length === 1 ? segmentIds[0] : "");
    }

    setDraggingNodeId(nodeId);
    if (svgRef.current) {
      const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
      if (point) {
        setDragLastPoint({ x: point.x, y: point.y });
        const nodeIdsToMove = selectedNodeIdsSet.has(nodeId) ? selectedNodeIds : [nodeId];
        nodeDragSnapshotRef.current = {
          startPoint: { x: point.x, y: point.y },
          positionsByNodeId: new Map(
            model.nodes
              .filter((node) => nodeIdsToMove.includes(node.id))
              .map((node) => [node.id, { x: node.x, y: node.y }]),
          ),
          labelOffsetsByStationId: new Map(
            model.stations
              .filter((station) => !!station.nodeId && nodeIdsToMove.includes(station.nodeId) && !!station.label)
              .map((station) => {
                const node = model.nodes.find((candidate) => candidate.id === station.nodeId)!;
                return [
                  station.id,
                  {
                    x: station.label!.x - node.x,
                    y: station.label!.y - node.y,
                  },
                ];
              }),
          ),
        };
        nodeLongPressPressRef.current = {
          nodeId,
          laneId,
          markerKey,
          clientX: event.clientX,
          clientY: event.clientY,
          startPoint: point,
        };
        nodeLongPressTimeoutRef.current = window.setTimeout(() => {
          const press = nodeLongPressPressRef.current;
          if (!press) return;
          if (press.nodeId !== nodeId || press.markerKey !== markerKey) return;
          beginSegmentDrawFromNode(nodeId, laneId, markerKey, press.startPoint);
        }, NODE_SEGMENT_LONG_PRESS_MS);
      }
    }
  }

  function handleNodeMouseUp(event: MouseEvent<SVGGElement>, nodeId: string, markerKey: string, laneId: string | null) {
    if (!segmentDrawState) {
      clearNodeLongPress();
      return;
    }

    event.stopPropagation();
    clearNodeLongPress();
    setDraggingNodeId(null);
    setDragLastPoint(null);
    nodeDragSnapshotRef.current = null;

    if (segmentDrawState.nodeId === nodeId && segmentDrawState.markerKey === markerKey) {
      cancelSegmentDraw();
      return;
    }

    setSegmentDrawState(null);
    completeSegmentAtNode(nodeId, laneId, markerKey);
  }

  function handleLabelMouseDown(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.stopPropagation();
    clearNodeLongPress();
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
    setSelectedNodeMarkerKey(null);
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

  function handleLabelRotateMouseDown(
    event: MouseEvent<SVGRectElement>,
    stationId: string,
    nodeId: string,
    center: MapPoint,
    currentRotation: number,
  ) {
    event.stopPropagation();
    clearNodeLongPress();
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setSidePanel("edit");
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    setDraggingNodeId(null);
    setDraggingLabelStationId(null);

    if (!svgRef.current) return;
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;

    setRotatingLabelState({
      stationId,
      center,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x),
      startRotation: currentRotation,
    });
    beginTransientMapChange();
  }

  function handleStationContextMenu(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    clearNodeLongPress();
    setSegmentContextMenu(null);
    setSidePanel("edit");
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    setNodeAssignmentQuery("");
    setNodeAssignmentName("");
    setNodeContextMenu({
      nodeIds: [nodeId],
      x: event.clientX,
      y: event.clientY,
      markerKey: null,
      laneId: null,
      segmentId: null,
    });
  }

  function handleCanvasMouseDown(event: MouseEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    clearNodeLongPress();
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setDraggingNodeId(null);
    setDraggingLabelStationId(null);
    setRotatingLabelState(null);
    setSegmentDrawState(null);
    setPendingSegmentStart(null);
    nodeDragSnapshotRef.current = null;
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
    clearNodeLongPress();
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setSidePanel("edit");
    setSelectedNodeMarkerKey(null);
    setSelectedSegmentId(segmentId);
    setSelectedLineId(lineIdBySegmentId.get(segmentId) ?? "");
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");

  }

  function handleSegmentContextMenu(event: MouseEvent<SVGPathElement>, segmentId: string) {
    event.preventDefault();
    event.stopPropagation();
    clearNodeLongPress();
    setNodeContextMenu(null);
    setSelectedNodeMarkerKey(null);
    setSelectedSegmentId(segmentId);
    setSelectedLineId(lineIdBySegmentId.get(segmentId) ?? "");
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

    if (segmentDrawState) {
      setSegmentDrawState((current) => (current ? { ...current, currentPoint: svgPoint } : current));
      return;
    }

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

    if (rotatingLabelState) {
      const nextAngle = Math.atan2(svgPoint.y - rotatingLabelState.center.y, svgPoint.x - rotatingLabelState.center.x);
      const nextRotation = normalizeRotation(
        rotatingLabelState.startRotation + ((nextAngle - rotatingLabelState.startAngle) * 180) / Math.PI,
      );

      updateMap((current) => ({
        ...current,
        model: {
          ...current.model,
          stations: current.model.stations.map((station) => {
            if (station.id !== rotatingLabelState.stationId) return station;
            const stationNode = station.nodeId ? current.model.nodes.find((node) => node.id === station.nodeId) : null;
            return {
              ...station,
              label: {
                x: station.label?.x ?? ((stationNode?.x ?? 0) + 12),
                y: station.label?.y ?? ((stationNode?.y ?? 0) - 10),
                align: station.label?.align ?? "right",
                rotation: nextRotation,
              },
            };
          }),
        },
      }), { trackHistory: false });
      return;
    }

    if (draggingLabelStationId && dragLastPoint) {
      const deltaX = Math.round(svgPoint.x - dragLastPoint.x);
      const deltaY = Math.round(svgPoint.y - dragLastPoint.y);
      if (deltaX === 0 && deltaY === 0) return;

      updateMap((current) => ({
        ...current,
        model: {
          ...current.model,
          stations: current.model.stations.map((station) => {
            if (station.id !== draggingLabelStationId) return station;
            const stationNode = station.nodeId ? current.model.nodes.find((node) => node.id === station.nodeId) : null;
            return {
              ...station,
              label: {
                ...station.label,
                x: (station.label?.x ?? ((stationNode?.x ?? 0) + 12)) + deltaX,
                y: (station.label?.y ?? ((stationNode?.y ?? 0) - 10)) + deltaY,
                align: station.label?.align ?? "right",
              },
            };
          }),
        },
      }), { trackHistory: false });
      setDragLastPoint({ x: svgPoint.x, y: svgPoint.y });
      return;
    }

    if (!draggingNodeId) return;
    const dragSnapshot = nodeDragSnapshotRef.current;
    if (!dragSnapshot) return;

    const draggedNodeStart = dragSnapshot.positionsByNodeId.get(draggingNodeId);
    if (!draggedNodeStart) return;

    const rawDeltaX = svgPoint.x - dragSnapshot.startPoint.x;
    const rawDeltaY = svgPoint.y - dragSnapshot.startPoint.y;
    let deltaX = Math.round(rawDeltaX);
    let deltaY = Math.round(rawDeltaY);

    const longPress = nodeLongPressPressRef.current;
    if (
      longPress &&
      (Math.abs(event.clientX - longPress.clientX) > NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD ||
        Math.abs(event.clientY - longPress.clientY) > NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD)
    ) {
      clearNodeLongPress();
    }

    if (snapToGrid) {
      const snappedTarget = snapPointToGrid({
        x: draggedNodeStart.x + rawDeltaX,
        y: draggedNodeStart.y + rawDeltaY,
      });
      deltaX = snappedTarget.x - draggedNodeStart.x;
      deltaY = snappedTarget.y - draggedNodeStart.y;
    }

    if (deltaX === 0 && deltaY === 0) return;

    beginTransientMapChange();

    updateMap((current) => ({
      ...current,
      model: {
        ...current.model,
        nodes: current.model.nodes.map((node) => {
          const start = dragSnapshot.positionsByNodeId.get(node.id);
          return start ? { ...node, x: start.x + deltaX, y: start.y + deltaY } : node;
        }),
        stations: current.model.stations.map((station) => {
          if (!station.nodeId || !station.label) return station;
          if (!dragSnapshot.positionsByNodeId.has(station.nodeId)) return station;
          const startNode = dragSnapshot.positionsByNodeId.get(station.nodeId);
          const labelOffset = dragSnapshot.labelOffsetsByStationId.get(station.id);
          if (!startNode || !labelOffset) return station;
          return {
            ...station,
            label: {
              ...station.label,
              x: startNode.x + deltaX + labelOffset.x,
              y: startNode.y + deltaY + labelOffset.y,
            },
          };
        }),
      },
    }), { trackHistory: false });
  }

  function handleSvgMouseUp() {
    clearNodeLongPress();
    completeTransientMapChange();
    setRotatingLabelState(null);
    if (segmentDrawState) {
      setSegmentDrawState(null);
      setPendingSegmentStart(null);
    }
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
        setSelectedNodeMarkerKey(null);
        const firstStation = currentStations.find((station) => station.nodeId === nextSelectedNodeIds[0]);
        setSelectedStationId(firstStation?.id ?? "");
        setSelectedSegmentId("");
      }
    }

    setDraggingNodeId(null);
    setDraggingLabelStationId(null);
    setDragLastPoint(null);
    nodeDragSnapshotRef.current = null;
    setPanning(false);
    setPanStart(null);
  }

  function handleNodeContextMenu(event: MouseEvent<SVGGElement>, nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null) {
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
    }
    setSelectedNodeMarkerKey(markerKey);
    setSelectedSegmentId(segmentIds.length === 1 ? segmentIds[0] : "");
    const nodeIds = selectedNodeIdsSet.has(nodeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [nodeId];
    setNodeAssignmentQuery("");
    setNodeAssignmentName("");
    setNodeContextMenu({
      nodeIds,
      x: event.clientX,
      y: event.clientY,
      markerKey,
      laneId,
      segmentId: segmentIds.length === 1 ? segmentIds[0] : null,
    });
  }

  function exportSvg() {
    if (!svgRef.current) return;
    downloadFile("railway-map.svg", svgRef.current.outerHTML, "image/svg+xml;charset=utf-8");
  }

  function exportJson() {
    downloadFile("railway-map.json", JSON.stringify(map, null, 2), "application/json;charset=utf-8");
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
          <RailwayMapCanvasPane
            sidePanel={sidePanel}
            setSidePanel={setSidePanel}
            exportSvg={exportSvg}
            exportJson={exportJson}
            pendingSegmentStart={pendingSegmentStart}
            laneDisplayNameById={laneDisplayNameById}
            zoom={zoom}
            zoomStep={ZOOM_STEP}
            applyZoom={applyZoom}
            resetViewportToSheet={resetViewportToSheet}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            gridStepX={gridStepX}
            gridStepY={gridStepY}
            minGridStep={MIN_GRID_STEP}
            setGridStepX={setGridStepX}
            setGridStepY={setGridStepY}
            addNode={addNode}
            canvasViewportRef={canvasViewportRef}
            svgRef={svgRef}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
            viewBox={viewBox}
            worldSize={WORLD_SIZE}
            handleCanvasMouseDown={handleCanvasMouseDown}
            handleSvgMouseMove={handleSvgMouseMove}
            handleSvgMouseUp={handleSvgMouseUp}
            gridLines={gridLines}
            currentSegments={currentSegments}
            nodesById={nodesById}
            segmentOffsetById={segmentOffsetById}
            anchoredEndpointBySegmentNodeKey={anchoredEndpointBySegmentNodeKey}
            selectedSegmentId={selectedSegmentId}
            assignedSegmentIds={assignedSegmentIds}
            handleSegmentMouseDown={handleSegmentMouseDown}
            handleSegmentContextMenu={handleSegmentContextMenu}
            lineRuns={model.lineRuns}
            linesById={linesById}
            segmentsById={segmentsById}
            segmentDrawState={segmentDrawState}
            nodeMarkerCenterByKey={nodeMarkerCenterByKey}
            nodeMarkerCentersById={nodeMarkerCentersById}
            currentNodes={currentNodes}
            stationsByNodeId={stationsByNodeId}
            selectedNodeIdsSet={selectedNodeIdsSet}
            selectedNodeMarkerKey={selectedNodeMarkerKey}
            stationKindsById={stationKindsById}
            renderNodeSymbol={renderNodeSymbol}
            handleNodeMouseDown={handleNodeMouseDown}
            handleNodeMouseUp={handleNodeMouseUp}
            handleNodeContextMenu={handleNodeContextMenu}
            currentStations={currentStations}
            draggingLabelStationId={draggingLabelStationId}
            draggingNodeId={draggingNodeId}
            nodeDragSnapshotRef={nodeDragSnapshotRef}
            rotatingLabelState={rotatingLabelState}
            selectedStationId={selectedStationId}
            labelDiagnostics={labelDiagnostics}
            handleLabelMouseDown={handleLabelMouseDown}
            handleStationContextMenu={handleStationContextMenu}
            handleLabelRotateMouseDown={handleLabelRotateMouseDown}
            marqueeSelection={marqueeSelection}
            currentSheet={currentSheet}
            nodeContextMenu={nodeContextMenu}
            nodeContextMenuPosition={nodeContextMenuPosition}
            contextMenuStation={contextMenuStation}
            updateStation={updateStation}
            unassignStation={unassignStation}
            configStationKinds={config.stationKinds}
            stationKindShapeGlyph={stationKindShapeGlyph}
            nodeAssignmentQuery={nodeAssignmentQuery}
            setNodeAssignmentQuery={setNodeAssignmentQuery}
            stationAssignmentResults={stationAssignmentResults}
            assignStationToNode={assignStationToNode}
            nodeAssignmentName={nodeAssignmentName}
            setNodeAssignmentName={setNodeAssignmentName}
            nodeAssignmentKindId={nodeAssignmentKindId}
            setNodeAssignmentKindId={setNodeAssignmentKindId}
            createStationAtNode={createStationAtNode}
            deleteNodes={deleteNodes}
            completeSegmentAtNode={completeSegmentAtNode}
            cancelPendingSegment={cancelPendingSegment}
            startSegmentFromNode={startSegmentFromNode}
            segmentContextMenu={segmentContextMenu}
            contextMenuSegment={contextMenuSegment}
            segmentContextMenuPosition={segmentContextMenuPosition}
            assignedLineForContextSegment={assignedLineForContextSegment}
            assignableLinesForContextSegment={assignableLinesForContextSegment}
            unassignLineFromSegment={unassignLineFromSegment}
            assignLineToSegment={assignLineToSegment}
            insertTrackPointOnSegment={insertTrackPointOnSegment}
            duplicateSegment={duplicateSegment}
            deleteSegment={deleteSegment}
            sheets={model.sheets}
            currentSheetId={currentSheetId}
            renamingSheetId={renamingSheetId}
            sheetNameDraft={sheetNameDraft}
            setSheetNameDraft={setSheetNameDraft}
            commitSheetRename={commitSheetRename}
            startRenamingSheet={startRenamingSheet}
            deleteCurrentSheet={deleteCurrentSheet}
            addSheet={addSheet}
            setCurrentSheetId={setCurrentSheetId}
          />

          {sidePanel !== "closed" ? (
            <div className="min-w-0">
              <Card className="flex h-full min-h-[78vh] flex-col overflow-hidden border-slate-200 bg-white/95 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>{sidePanel === "edit" ? "Edit Panel" : "Management"}</CardTitle>
                    {sidePanel === "edit" ? <p className="mt-1 text-xs text-muted">Contextual tools for the selected map elements.</p> : null}
                  </div>
                  <Button variant="outline" className="px-3" onClick={() => setSidePanel("closed")}>
                    Close
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto space-y-6">
                  {sidePanel === "edit" ? (
                    <RailwayMapInspector
                      hasNodeOrStationSelection={hasNodeOrStationSelection}
                      hasSegmentOrLineSelection={hasSegmentOrLineSelection}
                      newStationName={newStationName}
                      newStationKindId={newStationKindId}
                      setNewStationName={setNewStationName}
                      setNewStationKindId={setNewStationKindId}
                      addStation={addStation}
                      visibleStations={visibleStations}
                      selectedStationId={selectedStationId}
                      stationKinds={config.stationKinds}
                      stationKindsById={stationKindsById}
                      stationKindShapeGlyph={stationKindShapeGlyph}
                      setSelectedNodeId={setSelectedNodeId}
                      setSelectedNodeIds={setSelectedNodeIds}
                      setSelectedStationId={setSelectedStationId}
                      deleteNode={deleteNode}
                      deleteStation={deleteStation}
                      selectedNode={selectedNode}
                      updateNode={updateNode}
                      selectedNodeLanes={selectedNodeLanes}
                      selectedNodeLaneAxis={selectedNodeLaneAxis}
                      selectedNodeMarkerLaneId={selectedNodeMarkerLaneId}
                      selectedNodeLaneMoveLabels={selectedNodeLaneMoveLabels}
                      moveLaneOrder={moveLaneOrder}
                      selectedNodeStations={selectedNodeStations}
                      attachStationToSelectedNode={attachStationToSelectedNode}
                      unassignStation={unassignStation}
                      selectedStation={selectedStation}
                      updateStation={updateStation}
                      labelDiagnostics={labelDiagnostics}
                      selectedSegment={selectedSegment}
                      selectedLine={selectedLine}
                      selectedLineId={selectedLineId}
                      lines={config.lines}
                      selectedLineRun={selectedLineRun}
                      segmentsById={segmentsById}
                      handleSelectedLineInspectorChange={handleSelectedLineInspectorChange}
                    />
                  ) : (
                    <RailwayMapManagement
                      manageSection={manageSection}
                      setManageSection={setManageSection}
                      bootstrapDevelopmentModel={bootstrapDevelopmentModel}
                      autoPlaceCurrentSheetLabels={autoPlaceCurrentSheetLabels}
                      selectedLineId={selectedLineId}
                      setSelectedLineId={setSelectedLineId}
                      addLine={addLine}
                      selectedLine={selectedLine}
                      lines={config.lines}
                      currentSegments={currentSegments}
                      lineIdBySegmentId={lineIdBySegmentId}
                      linesById={linesById}
                      updateLine={updateLine}
                      toggleSegmentOnSelectedLine={toggleSegmentOnSelectedLine}
                      deleteSelectedLine={deleteSelectedLine}
                      newStationKindName={newStationKindName}
                      setNewStationKindName={setNewStationKindName}
                      newStationKindFontFamily={newStationKindFontFamily}
                      setNewStationKindFontFamily={setNewStationKindFontFamily}
                      newStationKindShape={newStationKindShape}
                      setNewStationKindShape={setNewStationKindShape}
                      newStationKindFontWeight={newStationKindFontWeight}
                      setNewStationKindFontWeight={setNewStationKindFontWeight}
                      newStationKindFontSize={newStationKindFontSize}
                      setNewStationKindFontSize={setNewStationKindFontSize}
                      newStationKindSymbolSize={newStationKindSymbolSize}
                      setNewStationKindSymbolSize={setNewStationKindSymbolSize}
                      addStationKind={addStationKind}
                      stationKinds={config.stationKinds}
                      selectedStationKindId={selectedStationKindId}
                      setSelectedStationKindId={setSelectedStationKindId}
                      renderStationKindPreview={renderStationKindPreview}
                      selectedStationKind={selectedStationKind}
                      updateStationKind={updateStationKind}
                      deleteSelectedStationKind={deleteSelectedStationKind}
                      stationKindsCount={config.stationKinds.length}
                    />
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
