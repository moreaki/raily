import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { INITIAL_MAP } from "@/entities/railway-map/model/constants";
import { railwayMapSchema } from "@/entities/railway-map/model/schema";
import type { Line, LineRun, MapNode, MapPoint, RailwayMap, Segment, Station, StationKind, StationKindShape, StationLabelFontWeight } from "@/entities/railway-map/model/types";
import {
  buildSegmentPoints,
  createLineRunId,
  sanitizeRailwayMap,
} from "@/entities/railway-map/model/utils";
import {
  getClampedMenuPosition,
  getNodeSide,
  NodeSide,
  normalizeSearchValue,
  offsetPoints,
  snapCoordinate,
  sortPointsForSide,
} from "@/features/railway-map-editor/lib/geometry";
import {
  addLine as addLineCommand,
  addNodeToSheet,
  addSheet as addSheetCommand,
  addStationKind as addStationKindCommand,
  addUnassignedStation,
  assignLineToSegment as assignLineToSegmentCommand,
  assignStationToNode as assignStationToNodeCommand,
  attachDefaultStationToNode,
  autoPlaceSheetLabels,
  buildBootstrapMap,
  createStationAtNode as createStationAtNodeCommand,
  deleteLine as deleteLineCommand,
  deleteNodes as deleteNodesCommand,
  deleteSegment as deleteSegmentCommand,
  deleteSheet as deleteSheetCommand,
  deleteStation as deleteStationCommand,
  deleteStationKind as deleteStationKindCommand,
  duplicateSegment as duplicateSegmentCommand,
  insertTrackPointOnSegment as insertTrackPointOnSegmentCommand,
  moveLaneOrder as moveLaneOrderCommand,
  renameSheet,
  unassignLineFromSegment as unassignLineFromSegmentCommand,
  updateLine as updateLineCommand,
  updateNode as updateNodeCommand,
  updateStation as updateStationCommand,
  updateStationKind as updateStationKindCommand,
} from "@/features/railway-map-editor/lib/commands";
import {
  boxesOverlap,
  DEFAULT_STATION_FONT_FAMILY,
  DEFAULT_STATION_FONT_SIZE,
  DEFAULT_STATION_FONT_WEIGHT,
  DEFAULT_STATION_SYMBOL_SIZE,
  estimateLabelBox,
  findNearbyFreePoint,
  getStationKindFontSize,
  getStationLabelPosition,
  pointToSegmentDistance,
  segmentIntersectsLabelBox,
} from "@/features/railway-map-editor/lib/labels";
import { useRailwayMapContextMenus } from "@/features/railway-map-editor/lib/useRailwayMapContextMenus";
import { useRailwayMapHistory } from "@/features/railway-map-editor/lib/useRailwayMapHistory";
import { useRailwayMapInteractions } from "@/features/railway-map-editor/lib/useRailwayMapInteractions";
import { useRailwayMapKeyboardShortcuts } from "@/features/railway-map-editor/lib/useRailwayMapKeyboardShortcuts";
import { useRailwayMapSelection } from "@/features/railway-map-editor/lib/useRailwayMapSelection";
import { useRailwayMapViewport } from "@/features/railway-map-editor/lib/useRailwayMapViewport";
import { RailwayMapInspector } from "@/features/railway-map-editor/ui/RailwayMapInspector";
import { RailwayMapManagement } from "@/features/railway-map-editor/ui/RailwayMapManagement";
import { RailwayMapSettings } from "@/features/railway-map-editor/ui/RailwayMapSettings";
import { RailwayMapCanvasPane } from "@/features/railway-map-editor/ui/RailwayMapCanvasPane";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const STORAGE_KEY = "raily:editor-map";
const SHEET_VIEW_STORAGE_KEY = "raily:sheet-views";
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.04;
const WORLD_SIZE = 200000;
const MIN_GRID_STEP = 4;

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

export default function RailwayMapEditor() {
  const initialMapRef = useRef<RailwayMap | null>(null);
  const focusHighlightTimeoutRef = useRef<number | null>(null);
  if (!initialMapRef.current) {
    initialMapRef.current = loadStoredMap();
  }
  const initialMap = initialMapRef.current;

  const {
    map,
    updateMap,
    replaceMap,
    beginTransientMapChange,
    completeTransientMapChange,
    undoLastChange,
  } = useRailwayMapHistory({
    initialMap,
    storageKey: STORAGE_KEY,
  });
  const model = map.model;
  const config = map.config;
  const [currentSheetId, setCurrentSheetId] = useState(initialMap.model.sheets[0]?.id ?? "");
  const [newStationName, setNewStationName] = useState("");
  const [newStationKindId, setNewStationKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");
  const [nodeAssignmentKindId, setNodeAssignmentKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");
  const [newStationKindName, setNewStationKindName] = useState("");
  const [newStationKindShape, setNewStationKindShape] = useState<StationKindShape>("circle");
  const [newStationKindFontFamily, setNewStationKindFontFamily] = useState(DEFAULT_STATION_FONT_FAMILY);
  const [newStationKindFontWeight, setNewStationKindFontWeight] = useState<StationLabelFontWeight>(DEFAULT_STATION_FONT_WEIGHT);
  const [newStationKindFontSize, setNewStationKindFontSize] = useState(DEFAULT_STATION_FONT_SIZE);
  const [newStationKindSymbolSize, setNewStationKindSymbolSize] = useState(DEFAULT_STATION_SYMBOL_SIZE);
  const [sidePanel, setSidePanel] = useState<"closed" | "edit" | "manage" | "settings">("edit");
  const [manageSection, setManageSection] = useState<"lines" | "stations" | "stationKinds">("lines");
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [highlightedStationId, setHighlightedStationId] = useState("");
  const {
    nodeContextMenu,
    setNodeContextMenu,
    closeNodeContextMenu,
    segmentContextMenu,
    setSegmentContextMenu,
    closeSegmentContextMenu,
    closeAllContextMenus,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    nodeAssignmentName,
    setNodeAssignmentName,
    resetNodeAssignmentDrafts,
  } = useRailwayMapContextMenus();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  const currentSheet = model.sheets.find((sheet) => sheet.id === currentSheetId) ?? null;
  const contextMenuNodeId = nodeContextMenu?.nodeIds.length === 1 ? nodeContextMenu.nodeIds[0] : null;
  const contextMenuNode = contextMenuNodeId ? model.nodes.find((node) => node.id === contextMenuNodeId) ?? null : null;
  const contextMenuSegment = segmentContextMenu ? model.segments.find((segment) => segment.id === segmentContextMenu.segmentId) ?? null : null;

  const currentNodes = useMemo(() => model.nodes.filter((node) => node.sheetId === currentSheetId), [currentSheetId, model.nodes]);
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
        const offset = (index - center) * config.parallelTrackSpacing;
        offsets.set(orderedGroup[index].id, offset);
      }
    }

    return offsets;
  }, [config.parallelTrackSpacing, currentSegments]);
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
    const markerSpacing = config.parallelTrackSpacing;

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
  }, [config.parallelTrackSpacing, currentNodes, currentSegments, model.nodeLanes, nodesById, segmentOffsetById]);
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
  const markerKeys = useMemo(() => new Set(nodeMarkerCenterByKey.keys()), [nodeMarkerCenterByKey]);
  const {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedNodeIdsSet,
    selectedNodeMarkerKey,
    setSelectedNodeMarkerKey,
    selectedStationId,
    setSelectedStationId,
    selectedSegmentId,
    setSelectedSegmentId,
    selectedLineId,
    setSelectedLineId,
    selectedStationKindId,
    setSelectedStationKindId,
    selectSingleNode,
    selectAllNodesOnCurrentSheet,
    clearPrimarySelection,
  } = useRailwayMapSelection({
    initialMap,
    currentNodes,
    currentStations,
    currentSegments,
    modelStations: model.stations,
    configLines: config.lines,
    configStationKinds: config.stationKinds,
    nodeExistsById: nodesById,
    segmentExistsById: segmentsById,
    markerKeys,
  });
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedStation = model.stations.find((station) => station.id === selectedStationId) ?? null;
  const selectedSegment = model.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedLine = config.lines.find((line) => line.id === selectedLineId) ?? null;
  const selectedStationKind = config.stationKinds.find((kind) => kind.id === selectedStationKindId) ?? null;
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
    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds);
      return;
    }

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
  }, [selectedNodeIds, selectedSegment, selectedStation]);

  useRailwayMapKeyboardShortcuts({
    onUndo: undoEditorChange,
    onSelectAllNodes: selectAllNodesOnCurrentSheet,
    onDeleteSelection: deleteCurrentSelection,
    hasDeletionTarget: !!selectedStation || !!selectedSegment || selectedNodeIds.length > 0,
  });

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

  useEffect(() => {
    return () => {
      if (focusHighlightTimeoutRef.current !== null) {
        window.clearTimeout(focusHighlightTimeoutRef.current);
      }
    };
  }, []);

  function undoEditorChange() {
    if (undoLastChange()) {
      closeAllContextMenus();
    }
  }
  function addStation() {
    const nextKindId = newStationKindId || (config.stationKinds[0]?.id ?? "");
    updateMap((current) => addUnassignedStation(current, newStationName, nextKindId));
    setNewStationName("");
  }

  function focusStation(stationId: string) {
    const station = model.stations.find((candidate) => candidate.id === stationId);
    if (!station) return;
    if (!station.nodeId) return;

    const node = model.nodes.find((candidate) => candidate.id === station.nodeId) ?? null;
    if (!node) return;

    setSheetViews((current) => ({
      ...current,
      [node.sheetId]: {
        zoom,
        centerX: node.x,
        centerY: node.y,
      },
    }));
    if (node.sheetId !== currentSheetId) {
      setCurrentSheetId(node.sheetId);
    }
    setViewportCenter({ x: node.x, y: node.y });
    setHighlightedStationId(station.id);
    if (focusHighlightTimeoutRef.current !== null) {
      window.clearTimeout(focusHighlightTimeoutRef.current);
    }
    focusHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedStationId((current) => (current === station.id ? "" : current));
      focusHighlightTimeoutRef.current = null;
    }, 1800);
  }

  function addNode() {
    if (!currentSheet) return;
    updateMap((current) => {
      const placement = findNearbyFreePoint(current, currentSheet.id, viewportCenter);
      const snappedPlacement = snapToGrid ? snapPointToGrid(placement) : placement;
      return addNodeToSheet(current, currentSheet.id, snappedPlacement);
    });
  }

  function attachStationToSelectedNode() {
    if (!selectedNode) return;
    if (selectedNodeStations.length > 0) return;
    updateMap((current) => attachDefaultStationToNode(current, selectedNode, newStationName));
    setNewStationName("");
  }

  function assignStationToNode(stationId: string, nodeId: string) {
    const node = model.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const stationAtNode = model.stations.find((candidate) => candidate.nodeId === nodeId);
    if (stationAtNode && stationAtNode.id !== stationId) return;

    updateMap((current) => assignStationToNodeCommand(current, stationId, nodeId));
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    resetNodeAssignmentDrafts();
    setNodeContextMenu(null);
  }

  function createStationAtNode(nodeId: string, name: string, kindId?: string) {
    const node = model.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (model.stations.some((candidate) => candidate.nodeId === nodeId)) return;

    const stationName = name.trim() || `Station ${model.stations.length + 1}`;
    const { station: createdStation } = createStationAtNodeCommand(map, nodeId, stationName, kindId || config.stationKinds[0]?.id || "");
    if (!createdStation) return;
    updateMap((current) => createStationAtNodeCommand(current, nodeId, stationName, kindId || config.stationKinds[0]?.id || "").map);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(createdStation.id);
    resetNodeAssignmentDrafts();
    setNodeAssignmentKindId(config.stationKinds[0]?.id ?? "");
    setNodeContextMenu(null);
  }

  function addSheet() {
    const { sheet: nextSheet } = addSheetCommand(map);
    updateMap((current) => addSheetCommand(current).map);
    setSheetViews((current) => ({
      ...current,
      [nextSheet.id]: { zoom: 1, centerX: CANVAS_WIDTH / 2, centerY: CANVAS_HEIGHT / 2 },
    }));
    setCurrentSheetId(nextSheet.id);
    setRenamingSheetId(nextSheet.id);
    setSheetNameDraft(nextSheet.name);
  }

  function addStationKind() {
    const { stationKind } = addStationKindCommand(map, {
      name: newStationKindName,
      shape: newStationKindShape,
      symbolSize: newStationKindSymbolSize,
      fontFamily: newStationKindFontFamily,
      fontWeight: newStationKindFontWeight,
      fontSize: newStationKindFontSize,
    });
    updateMap((current) =>
      addStationKindCommand(current, {
        name: newStationKindName,
        shape: newStationKindShape,
        symbolSize: newStationKindSymbolSize,
        fontFamily: newStationKindFontFamily,
        fontWeight: newStationKindFontWeight,
        fontSize: newStationKindFontSize,
      }).map,
    );
    setSelectedStationKindId(stationKind.id);
    setNewStationKindName("");
    setNewStationKindShape("circle");
    setNewStationKindSymbolSize(DEFAULT_STATION_SYMBOL_SIZE);
    setNewStationKindFontFamily(DEFAULT_STATION_FONT_FAMILY);
    setNewStationKindFontWeight(DEFAULT_STATION_FONT_WEIGHT);
    setNewStationKindFontSize(DEFAULT_STATION_FONT_SIZE);
  }

  function addLine(patch?: Partial<Line>) {
    const { line: nextLine } = addLineCommand(map, patch);
    updateMap((current) => addLineCommand(current, patch).map);
    setSelectedLineId(nextLine.id);
  }

  function bootstrapDevelopmentModel() {
    const nextMap = buildBootstrapMap();

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
    clearCanvasSelections();
  }

  function autoPlaceCurrentSheetLabels() {
    if (!currentSheetId) return;
    updateMap((current) => autoPlaceSheetLabels(current, currentSheetId));
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

    updateMap((current) => renameSheet(current, renamingSheetId, nextName));
    setRenamingSheetId(null);
    setSheetNameDraft("");
  }

  function deleteCurrentSheet() {
    if (!currentSheet) return;
    if (model.sheets.length <= 1) return;

    const nextSheetId = model.sheets.find((sheet) => sheet.id !== currentSheet.id)?.id;
    if (!nextSheetId) return;

    updateMap((current) => deleteSheetCommand(current, currentSheet.id));
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

  function deleteSegment(segmentId: string) {
    updateMap((current) => deleteSegmentCommand(current, segmentId));
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId("");
    }
    setSegmentContextMenu(null);
  }

  function duplicateSegment(segmentId: string) {
    const source = model.segments.find((segment) => segment.id === segmentId);
    if (!source) return;

    const { duplicated } = duplicateSegmentCommand(map, segmentId);
    if (!duplicated) return;
    updateMap((current) => duplicateSegmentCommand(current, segmentId).map);
    setSelectedSegmentId(duplicated.id);
    setSegmentContextMenu(null);
  }

  function insertTrackPointOnSegment(segmentId: string) {
    const source = model.segments.find((segment) => segment.id === segmentId);
    if (!source) return;

    const { insertedNode } = insertTrackPointOnSegmentCommand(map, segmentId, snapToGrid ? snapPointToGrid : undefined);
    if (!insertedNode) return;
    updateMap((current) => insertTrackPointOnSegmentCommand(current, segmentId, snapToGrid ? snapPointToGrid : undefined).map);

    setSelectedSegmentId("");
    setSelectedNodeId(insertedNode.id);
    setSelectedNodeIds([insertedNode.id]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId("");
    setSegmentContextMenu(null);
  }

  function assignLineToSegment(lineId: string, segmentId: string) {
    updateMap((current) => assignLineToSegmentCommand(current, lineId, segmentId));
    setSelectedLineId(lineId);
    setSelectedSegmentId(segmentId);
    setSegmentContextMenu(null);
  }

  function unassignLineFromSegment(lineId: string, segmentId: string) {
    updateMap((current) => unassignLineFromSegmentCommand(current, lineId, segmentId));
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
    updateMap((current) => deleteNodesCommand(current, nodeIds));

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
    updateMap((current) => deleteStationCommand(current, stationId));
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

    updateMap((current) => deleteStationKindCommand(current, selectedStationKind.id, fallbackKindId));
  }

  function deleteSelectedLine() {
    if (!selectedLine) return;

    updateMap((current) => deleteLineCommand(current, selectedLine.id));

    if (selectedLineId === selectedLine.id) {
      setSelectedLineId(config.lines.find((line) => line.id !== selectedLine.id)?.id ?? "");
    }
  }

  function updateNode(patch: Partial<MapNode>) {
    if (!selectedNode) return;

    updateMap((current) => updateNodeCommand(current, selectedNode.id, selectedNode, patch));
  }

  function moveLaneOrder(nodeId: string, laneId: string, direction: -1 | 1) {
    const targetNodeIds = selectedNodeIdsSet.has(nodeId) && selectedNodeIds.length > 1 ? selectedNodeIds : [nodeId];
    updateMap((current) => moveLaneOrderCommand(current, targetNodeIds, nodeId, laneId, direction));
  }

  function updateLine(patch: Partial<Line>) {
    if (!selectedLine) return;

    updateMap((current) => updateLineCommand(current, selectedLine.id, patch));
  }

  function updateParallelTrackSpacing(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        parallelTrackSpacing: Math.min(48, Math.max(8, value || 18)),
      },
    }));
  }

  function updateStation(stationId: string, patch: Partial<Station>) {
    updateMap((current) => updateStationCommand(current, stationId, patch));
  }

  function unassignStation(stationId: string) {
    updateStation(stationId, {
      nodeId: null,
      label: undefined,
    });
    resetNodeAssignmentDrafts();
    setNodeContextMenu(null);
  }

  function updateStationKind(kindId: string, patch: Partial<StationKind>) {
    updateMap((current) => updateStationKindCommand(current, kindId, patch));
  }
  const {
    draggingNodeId,
    draggingLabelStationId,
    rotatingLabelState,
    labelAxisGuide,
    marqueeSelection,
    pendingSegmentStart,
    segmentDrawState,
    nodeDragSnapshotRef,
    startSegmentFromNode,
    cancelPendingSegment,
    completeSegmentAtNode,
    clearCanvasSelections,
    handleNodeMouseDown,
    handleNodeMouseUp,
    handleLabelMouseDown,
    handleLabelRotateMouseDown,
    handleCanvasMouseDown,
    handleSegmentMouseDown,
    handleSegmentContextMenu: prepareSegmentSelectionForContextMenu,
    handleSvgMouseMove,
    handleSvgMouseUp,
    prepareStationContextMenu,
    prepareNodeContextMenu,
  } = useRailwayMapInteractions({
    svgRef,
    model,
    currentSheetId,
    currentSheetExists: !!currentSheet,
    currentSegments,
    currentStations,
    stationKindsById,
    selectedNodeIds,
    selectedNodeIdsSet,
    selectedNodeMarkerKey,
    selectedStationId,
    selectedSegmentId,
    lineIdBySegmentId,
    viewportCenter,
    panning,
    panStart,
    setPanning,
    setPanStart,
    viewBox,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    snapToGrid,
    snapPointToGrid,
    updateMap,
    beginTransientMapChange,
    completeTransientMapChange,
    selectSingleNode,
    clearPrimarySelection,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedNodeMarkerKey,
    setSelectedStationId,
    setSelectedSegmentId,
    setSelectedLineId,
    setSidePanel,
    closeAllContextMenus,
    closeNodeContextMenu,
    closeSegmentContextMenu,
    resetNodeAssignmentDrafts,
    setViewportCenter,
  });
  function handleStationContextMenu(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    const nextMenu = prepareStationContextMenu(stationId, nodeId, event.clientX, event.clientY);
    setNodeContextMenu(nextMenu);
  }

  function handleNodeContextMenu(event: MouseEvent<SVGGElement>, nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    const nextMenu = prepareNodeContextMenu(nodeId, markerKey, segmentIds, laneId, event.clientX, event.clientY);
    setNodeContextMenu(nextMenu);
  }

  function handleSegmentContextMenu(event: MouseEvent<SVGPathElement>, segmentId: string) {
    event.preventDefault();
    event.stopPropagation();
    prepareSegmentSelectionForContextMenu(event, segmentId);
    setSegmentContextMenu({
      segmentId,
      x: event.clientX,
      y: event.clientY,
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
    <div className="min-h-screen px-3 py-3 sm:px-4">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="flex flex-col gap-2 rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-panel backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-sky-700">Raily Editor</h1>
            <p className="text-xs text-muted">Copyright © R. &amp; K. Nibali</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={sidePanel === "edit" ? "default" : "outline"} onClick={() => setSidePanel(sidePanel === "edit" ? "closed" : "edit")}>
              Edit Panel
            </Button>
            <Button variant={sidePanel === "manage" ? "default" : "outline"} onClick={() => setSidePanel(sidePanel === "manage" ? "closed" : "manage")}>
              Manage
            </Button>
            <Button variant={sidePanel === "settings" ? "default" : "outline"} onClick={() => setSidePanel(sidePanel === "settings" ? "closed" : "settings")}>
              Settings
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

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <RailwayMapCanvasPane
            bootstrapDevelopmentModel={bootstrapDevelopmentModel}
            autoPlaceCurrentSheetLabels={autoPlaceCurrentSheetLabels}
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
            labelAxisGuide={labelAxisGuide}
            selectedStationId={selectedStationId}
            highlightedStationId={highlightedStationId}
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
              <Card className="flex h-full min-h-[82vh] flex-col overflow-hidden border-slate-200 bg-white/95 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <CardTitle>{sidePanel === "edit" ? "Edit Panel" : sidePanel === "settings" ? "Settings" : "Management"}</CardTitle>
                    {sidePanel === "edit" ? <p className="mt-1 text-xs text-muted">Contextual tools for the selected map elements.</p> : null}
                  </div>
                  <Button variant="outline" className="px-3" onClick={() => setSidePanel("closed")}>
                    Close
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 space-y-6 overflow-auto px-5 pb-5 pt-0">
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
                      parallelTrackSpacing={config.parallelTrackSpacing}
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
              insertTrackPointOnSegment={insertTrackPointOnSegment}
            />
                  ) : sidePanel === "settings" ? (
                    <RailwayMapSettings
                      parallelTrackSpacing={config.parallelTrackSpacing}
                      updateParallelTrackSpacing={updateParallelTrackSpacing}
                    />
                  ) : (
                    <RailwayMapManagement
                      manageSection={manageSection}
                      setManageSection={setManageSection}
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
                      newStationName={newStationName}
                      setNewStationName={setNewStationName}
                      newStationKindId={newStationKindId}
                      setNewStationKindId={setNewStationKindId}
                      addStation={addStation}
                      visibleStations={visibleStations}
                      selectedStationId={selectedStationId}
                      setSelectedStationId={setSelectedStationId}
                      selectedStation={selectedStation}
                      updateStation={updateStation}
                      deleteStation={deleteStation}
                      unassignStation={unassignStation}
                      nodesById={nodesById}
                      sheets={model.sheets}
                      segments={model.segments}
                      focusStation={focusStation}
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
