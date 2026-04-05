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
  getSvgPoint,
  normalizeSearchValue,
  offsetPoints,
  snapCoordinate,
  sortPointsForSide,
} from "@/features/railway-map-editor/lib/geometry";
import {
  addNodeLane as addNodeLaneCommand,
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
  addSegmentPolylinePoint as addSegmentPolylinePointCommand,
  insertTrackPointOnSegment as insertTrackPointOnSegmentCommand,
  insertNodeGroupColumn as insertNodeGroupColumnCommand,
  insertNodeGroupRow as insertNodeGroupRowCommand,
  makeSegmentOrthogonal as makeSegmentOrthogonalCommand,
  makeSegmentPolyline as makeSegmentPolylineCommand,
  makeSegmentStraight as makeSegmentStraightCommand,
  moveLaneOrder as moveLaneOrderCommand,
  removeSegmentPolylinePoint as removeSegmentPolylinePointCommand,
  removeNodeLane as removeNodeLaneCommand,
  removeNodeGroupColumn as removeNodeGroupColumnCommand,
  removeNodeGroupRow as removeNodeGroupRowCommand,
  removeTrackPoint as removeTrackPointCommand,
  renameSheet,
  updateNodeLaneGridPosition as updateNodeLaneGridPositionCommand,
  updateNodeLaneLine as updateNodeLaneLineCommand,
  updateSegmentEndpointLane as updateSegmentEndpointLaneCommand,
  unassignLineFromSegment as unassignLineFromSegmentCommand,
  updateSegmentOrthogonalElbow as updateSegmentOrthogonalElbowCommand,
  updateSegmentPolylinePoint as updateSegmentPolylinePointCommand,
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
  const [sidePanelWidth, setSidePanelWidth] = useState(460);
  const [isResizingSidePanel, setIsResizingSidePanel] = useState(false);
  const [manageSection, setManageSection] = useState<"lines" | "stations" | "stationKinds">("lines");
  const [selectedSegmentPolylinePoint, setSelectedSegmentPolylinePoint] = useState<{ segmentId: string; pointIndex: number } | null>(null);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [highlightedStationId, setHighlightedStationId] = useState("");
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; point: MapPoint } | null>(null);
  const {
    nodeContextMenu,
    setNodeContextMenu,
    closeNodeContextMenu,
    segmentContextMenu,
    setSegmentContextMenu,
    closeSegmentContextMenu,
    bendPointContextMenu,
    setBendPointContextMenu,
    closeBendPointContextMenu,
    closeAllContextMenus,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    nodeAssignmentName,
    setNodeAssignmentName,
    resetNodeAssignmentDrafts,
  } = useRailwayMapContextMenus();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const sidePanelResizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
  const nodeGroupCellWidth = config.nodeGroupCellWidth ?? config.parallelTrackSpacing ?? 22;
  const nodeGroupCellHeight = config.nodeGroupCellHeight ?? config.parallelTrackSpacing ?? 22;
  const effectiveParallelTrackSpacing = Math.min(nodeGroupCellWidth, nodeGroupCellHeight);
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
        const offset = (index - center) * effectiveParallelTrackSpacing;
        offsets.set(orderedGroup[index].id, offset);
      }
    }

    return offsets;
  }, [currentSegments, effectiveParallelTrackSpacing]);
  const { nodeMarkerCentersById, anchoredEndpointBySegmentNodeKey } = useMemo(() => {
    const nodeLanesByNodeId = new Map<string, { id: string; order: number; gridColumn?: number; gridRow?: number }[]>();
    for (const lane of model.nodeLanes) {
      const current = nodeLanesByNodeId.get(lane.nodeId) ?? [];
      current.push({ id: lane.id, order: lane.order, gridColumn: lane.gridColumn, gridRow: lane.gridRow });
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
      const slotCenterByLaneId = new Map<string, MapPoint>();
      const explicitCells = effectiveLaneIds
        .map((laneId) => {
          const lane = (nodeLanesByNodeId.get(node.id) ?? []).find((candidate) => candidate.id === laneId);
          return lane?.gridColumn && lane?.gridRow
            ? { laneId, gridColumn: lane.gridColumn, gridRow: lane.gridRow }
            : null;
        })
        .filter((value): value is { laneId: string; gridColumn: number; gridRow: number } => Boolean(value));
      const occupiedLaneIds = effectiveLaneIds.filter((laneId) => allMarkers.some((marker) => marker.laneId === laneId));
      const emptyLaneIds = effectiveLaneIds.filter((laneId) => !occupiedLaneIds.includes(laneId));

      const placeLaneAtOffset = (laneId: string, delta: number) => {
        const center =
          dominantSide === "left" || dominantSide === "right"
            ? { x: node.x, y: node.y + delta }
            : { x: node.x + delta, y: node.y };
        slotCenterByLaneId.set(laneId, center);
      };

      if (explicitCells.length > 0) {
        const explicitByLaneId = new Map(explicitCells.map((cell) => [cell.laneId, cell]));
        const maxExplicitColumn = explicitCells.reduce((value, cell) => Math.max(value, cell.gridColumn), 1);
        const maxExplicitRow = explicitCells.reduce((value, cell) => Math.max(value, cell.gridRow), 1);
        for (const [index, laneId] of effectiveLaneIds.entries()) {
          if (!explicitByLaneId.has(laneId)) {
            explicitByLaneId.set(laneId, {
              laneId,
              gridColumn: dominantSide === "left" || dominantSide === "right" ? 1 : maxExplicitColumn + index + 1,
              gridRow: dominantSide === "up" || dominantSide === "down" ? 1 : maxExplicitRow + index + 1,
            });
          }
        }
        const columns = [...explicitByLaneId.values()].map((cell) => cell.gridColumn);
        const rows = [...explicitByLaneId.values()].map((cell) => cell.gridRow);
        const centerColumn = (Math.min(...columns) + Math.max(...columns)) / 2;
        const centerRow = (Math.min(...rows) + Math.max(...rows)) / 2;
        for (const { laneId, gridColumn, gridRow } of explicitByLaneId.values()) {
          slotCenterByLaneId.set(laneId, {
            x: node.x + (gridColumn - centerColumn) * nodeGroupCellWidth,
            y: node.y + (gridRow - centerRow) * nodeGroupCellHeight,
          });
        }
      } else if (occupiedLaneIds.length === 0) {
        effectiveLaneIds.forEach((laneId, index) => {
          placeLaneAtOffset(laneId, index * effectiveParallelTrackSpacing);
        });
      } else if (emptyLaneIds.length === 0) {
        const centerOffset = (effectiveLaneIds.length - 1) / 2;
        effectiveLaneIds.forEach((laneId, index) => {
          placeLaneAtOffset(laneId, (index - centerOffset) * effectiveParallelTrackSpacing);
        });
      } else {
        const occupiedCenterOffset = (occupiedLaneIds.length - 1) / 2;
        occupiedLaneIds.forEach((laneId, index) => {
          placeLaneAtOffset(laneId, (index - occupiedCenterOffset) * effectiveParallelTrackSpacing);
        });

        const positiveEdge = ((occupiedLaneIds.length - 1) / 2) * effectiveParallelTrackSpacing;
        emptyLaneIds.forEach((laneId, index) => {
          placeLaneAtOffset(laneId, positiveEdge + (index + 1) * effectiveParallelTrackSpacing);
        });
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
  }, [currentNodes, currentSegments, effectiveParallelTrackSpacing, model.nodeLanes, nodeGroupCellHeight, nodeGroupCellWidth, nodesById, segmentOffsetById]);
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
      const lineNames = [...new Set([lane.lineId, ...segmentIds.map((segmentId) => lineIdBySegmentId.get(segmentId))].filter(Boolean))]
        .map((lineId) => config.lines.find((line) => line.id === lineId)?.name ?? lineId)
        .filter(Boolean);

      next.set(lane.id, lineNames.length > 0 ? lineNames.join(", ") : "Unassigned lane");
    }

    return next;
  }, [config.lines, currentSegments, lineIdBySegmentId, model.nodeLanes]);
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
  const selectedNodeLanes = useMemo(() => {
    if (!selectedNodeId) return [];

    return model.nodeLanes
      .filter((lane) => lane.nodeId === selectedNodeId)
      .sort((left, right) => left.order - right.order)
      .map((lane) => {
        const segmentIds = currentSegments
          .filter((segment) => segment.fromLaneId === lane.id || segment.toLaneId === lane.id)
          .map((segment) => segment.id);
        const lineIds = [...new Set([lane.lineId, ...segmentIds.map((segmentId) => lineIdBySegmentId.get(segmentId))].filter(Boolean))];
        const lineNames = lineIds
          .map((lineId) => config.lines.find((line) => line.id === lineId)?.name ?? lineId)
          .filter(Boolean);
        const lineColors = lineIds
          .map((lineId) => config.lines.find((line) => line.id === lineId)?.color ?? null)
          .filter((color): color is string => Boolean(color));
        const connections = currentSegments
          .filter((segment) => segment.fromLaneId === lane.id || segment.toLaneId === lane.id)
          .map((segment) => {
            if (segment.fromLaneId === lane.id) {
              return {
                side: getNodeSide(
                  nodesById.get(segment.fromNodeId) ?? { x: 0, y: 0 },
                  nodesById.get(segment.toNodeId) ?? { x: 0, y: 0 },
                ),
                color: config.lines.find((line) => line.id === lineIdBySegmentId.get(segment.id))?.color ?? null,
              };
            }
            return {
              side: getNodeSide(
                nodesById.get(segment.toNodeId) ?? { x: 0, y: 0 },
                nodesById.get(segment.fromNodeId) ?? { x: 0, y: 0 },
              ),
              color: config.lines.find((line) => line.id === lineIdBySegmentId.get(segment.id))?.color ?? null,
            };
          });

        return {
          ...lane,
          cellLabel: lane.gridColumn && lane.gridRow ? `${String.fromCharCode(64 + lane.gridColumn)}${lane.gridRow}` : "",
          effectiveGridColumn: lane.gridColumn ?? (selectedNodeLaneAxis === "horizontal" ? lane.order + 1 : 1),
          effectiveGridRow: lane.gridRow ?? (selectedNodeLaneAxis === "vertical" ? lane.order + 1 : 1),
          isAutoPlaced: !(lane.gridColumn && lane.gridRow),
          lineId: lane.lineId ?? null,
          segmentIds,
          lineNames,
          lineColors,
          connections,
        };
      });
  }, [config.lines, currentSegments, lineIdBySegmentId, model.nodeLanes, nodesById, selectedNodeId, selectedNodeLaneAxis]);
  const selectedNodeMarkerLaneId = useMemo(() => {
    if (!selectedNodeId || !selectedNodeMarkerKey) return null;
    return nodeMarkerCentersById.get(selectedNodeId)?.find((marker) => marker.key === selectedNodeMarkerKey)?.laneId ?? null;
  }, [nodeMarkerCentersById, selectedNodeId, selectedNodeMarkerKey]);
  const selectedNodeMarkerLane = useMemo(
    () => selectedNodeLanes.find((lane) => lane.id === selectedNodeMarkerLaneId) ?? null,
    [selectedNodeLanes, selectedNodeMarkerLaneId],
  );
  const segmentFromPortOptions = useMemo(() => {
    if (!selectedSegment) return [{ value: "", label: "Auto" }];
    return [
      { value: "", label: "Auto" },
      ...model.nodeLanes
        .filter((lane) => lane.nodeId === selectedSegment.fromNodeId)
        .sort((left, right) => left.order - right.order)
        .map((lane) => ({
          value: lane.id,
          label: `${laneDisplayNameById.get(lane.id) ?? "Unassigned lane"}${lane.gridColumn && lane.gridRow ? ` · ${String.fromCharCode(64 + lane.gridColumn)}${lane.gridRow}` : ""}`,
        })),
    ];
  }, [laneDisplayNameById, model.nodeLanes, selectedSegment]);
  const segmentToPortOptions = useMemo(() => {
    if (!selectedSegment) return [{ value: "", label: "Auto" }];
    return [
      { value: "", label: "Auto" },
      ...model.nodeLanes
        .filter((lane) => lane.nodeId === selectedSegment.toNodeId)
        .sort((left, right) => left.order - right.order)
        .map((lane) => ({
          value: lane.id,
          label: `${laneDisplayNameById.get(lane.id) ?? "Unassigned lane"}${lane.gridColumn && lane.gridRow ? ` · ${String.fromCharCode(64 + lane.gridColumn)}${lane.gridRow}` : ""}`,
        })),
    ];
  }, [laneDisplayNameById, model.nodeLanes, selectedSegment]);
  const removableTrackPointNodeIds = useMemo(() => {
    const removable = new Set<string>();

    for (const node of currentNodes) {
      if ((stationsByNodeId.get(node.id) ?? []).length > 0) continue;
      const connectedSegments = currentSegments.filter((segment) => segment.fromNodeId === node.id || segment.toNodeId === node.id);
      if (connectedSegments.length !== 2) continue;
      const firstLineId = lineIdBySegmentId.get(connectedSegments[0].id) ?? null;
      const secondLineId = lineIdBySegmentId.get(connectedSegments[1].id) ?? null;
      if (firstLineId !== secondLineId) continue;
      if (connectedSegments[0].sheetId !== connectedSegments[1].sheetId) continue;
      removable.add(node.id);
    }

    return removable;
  }, [currentNodes, currentSegments, lineIdBySegmentId, stationsByNodeId]);
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
  const bendPointContextMenuPosition = useMemo(() => {
    if (!bendPointContextMenu) return null;
    return getClampedMenuPosition(bendPointContextMenu.x, bendPointContextMenu.y, 240, 80);
  }, [bendPointContextMenu]);
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
    if (selectedSegmentPolylinePoint) {
      removeSegmentPolylinePoint(selectedSegmentPolylinePoint.segmentId, selectedSegmentPolylinePoint.pointIndex);
      return;
    }

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
  }, [deleteNodes, removeSegmentPolylinePoint, selectedNodeIds, selectedSegment, selectedSegmentPolylinePoint, selectedStation]);

  useRailwayMapKeyboardShortcuts({
    onUndo: undoEditorChange,
    onSelectAllNodes: selectAllNodesOnCurrentSheet,
    onDeleteSelection: deleteCurrentSelection,
    hasDeletionTarget: !!selectedSegmentPolylinePoint || !!selectedStation || !!selectedSegment || selectedNodeIds.length > 0,
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

  useEffect(() => {
    if (!selectedSegmentPolylinePoint) return;
    const selectedPointSegment = model.segments.find((segment) => segment.id === selectedSegmentPolylinePoint.segmentId);
    if (!selectedPointSegment || selectedPointSegment.geometry.kind !== "polyline" || !selectedPointSegment.geometry.points[selectedSegmentPolylinePoint.pointIndex]) {
      setSelectedSegmentPolylinePoint(null);
    }
  }, [model.segments, selectedSegmentPolylinePoint]);

  useEffect(() => {
    if (!selectedSegmentPolylinePoint) return;
    if (selectedSegmentPolylinePoint.segmentId !== selectedSegmentId) {
      setSelectedSegmentPolylinePoint(null);
    }
  }, [selectedSegmentId, selectedSegmentPolylinePoint]);

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

  function addNodeToGroup(nodeId: string) {
    const { laneId } = addNodeLaneCommand(map, nodeId, selectedNodeLaneAxis);
    if (!laneId) return;
    updateMap((current) => addNodeLaneCommand(current, nodeId, selectedNodeLaneAxis).map);
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setNodeContextMenu(null);
  }

  function removeNodeFromGroup(nodeId: string, laneId: string) {
    updateMap((current) => removeNodeLaneCommand(current, nodeId, laneId));
    if (selectedNodeMarkerLaneId === laneId) {
      setSelectedNodeMarkerKey(null);
    }
    setNodeContextMenu(null);
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

  function createTrackPointAtCanvasPoint(point: MapPoint) {
    if (!currentSheet) return;
    updateMap((current) => {
      const snappedPlacement = snapToGrid ? snapPointToGrid(point) : point;
      return addNodeToSheet(current, currentSheet.id, snappedPlacement);
    });
    setCanvasContextMenu(null);
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
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
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
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
  }

  function makeSegmentStraight(segmentId: string) {
    updateMap((current) => makeSegmentStraightCommand(current, segmentId));
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
  }

  function makeSegmentOrthogonal(segmentId: string) {
    updateMap((current) => makeSegmentOrthogonalCommand(current, segmentId));
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
  }

  function makeSegmentPolyline(segmentId: string) {
    updateMap((current) => makeSegmentPolylineCommand(current, segmentId));
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
  }

  function updateSegmentOrthogonalElbow(segmentId: string, elbow: MapPoint, options?: { trackHistory?: boolean }) {
    updateMap((current) => updateSegmentOrthogonalElbowCommand(current, segmentId, elbow), options);
  }

  function addSegmentPolylinePoint(segmentId: string, point?: MapPoint) {
    updateMap((current) => addSegmentPolylinePointCommand(current, segmentId, {
      point,
      snapPoint: snapToGrid ? snapPointToGrid : undefined,
    }));
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
  }

  function updateSegmentPolylinePoint(segmentId: string, pointIndex: number, point: MapPoint, options?: { trackHistory?: boolean }) {
    updateMap((current) => updateSegmentPolylinePointCommand(current, segmentId, pointIndex, point), options);
  }

  function removeSegmentPolylinePoint(segmentId: string, pointIndex: number) {
    updateMap((current) => removeSegmentPolylinePointCommand(current, segmentId, pointIndex));
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
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

  function removeTrackPoint(nodeId: string) {
    updateMap((current) => removeTrackPointCommand(current, nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId("");
      setSelectedNodeIds([]);
      setSelectedNodeMarkerKey(null);
      setSelectedStationId("");
    }
    setNodeContextMenu(null);
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
        parallelTrackSpacing: Math.min(48, Math.max(8, value || 22)),
      },
    }));
  }

  function updateSegmentIndicatorWidth(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        segmentIndicatorWidth: Math.min(36, Math.max(8, value || 16)),
      },
    }));
  }

  function updateSelectedSegmentIndicatorBoost(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        selectedSegmentIndicatorBoost: Math.min(12, Math.max(0, value || 4)),
      },
    }));
  }

  function updateGridLineOpacity(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        gridLineOpacity: Math.min(0.8, Math.max(0.1, value || 0.45)),
      },
    }));
  }

  function updateLabelAxisSnapSensitivity(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        labelAxisSnapSensitivity: Math.min(24, Math.max(6, value || 10)),
      },
    }));
  }

  function updateNodeGroupCellWidth(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        nodeGroupCellWidth: Math.min(64, Math.max(8, value || 22)),
      },
    }));
  }

  function updateNodeGroupCellHeight(value: number) {
    updateMap((current) => ({
      ...current,
      config: {
        ...current.config,
        nodeGroupCellHeight: Math.min(64, Math.max(8, value || 22)),
      },
    }));
  }

  function updateSelectedNodeLaneCell(laneId: string, value: string) {
    if (!selectedNode) return;
    const match = value.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      updateMap((current) => updateNodeLaneGridPositionCommand(current, selectedNode.id, laneId));
      return;
    }

    let column = 0;
    for (const letter of match[1]) {
      column = column * 26 + (letter.charCodeAt(0) - 64);
    }

    updateMap((current) => updateNodeLaneGridPositionCommand(current, selectedNode.id, laneId, column, Number(match[2])));
  }

  function updateSelectedNodeLaneLine(laneId: string, lineId: string) {
    if (!selectedNode) return;
    updateMap((current) => updateNodeLaneLineCommand(current, selectedNode.id, laneId, lineId || undefined));
  }

  function selectNodeLane(laneId: string) {
    if (!selectedNodeId) return;
    const marker = nodeMarkerCentersById.get(selectedNodeId)?.find((candidate) => candidate.laneId === laneId) ?? null;
    if (!marker) return;
    setSelectedNodeMarkerKey(marker.key);
  }

  function updateSelectedSegmentPort(end: "from" | "to", laneId: string) {
    if (!selectedSegment) return;
    updateMap((current) => updateSegmentEndpointLaneCommand(current, selectedSegment.id, end, laneId || undefined));
  }

  function insertSelectedNodeGroupColumn(column: number) {
    if (!selectedNode) return;
    updateMap((current) => insertNodeGroupColumnCommand(current, selectedNode.id, column, selectedNodeLaneAxis));
  }

  function insertSelectedNodeGroupRow(row: number) {
    if (!selectedNode) return;
    updateMap((current) => insertNodeGroupRowCommand(current, selectedNode.id, row, selectedNodeLaneAxis));
  }

  function removeSelectedNodeGroupColumn(column: number) {
    if (!selectedNode) return;
    updateMap((current) => removeNodeGroupColumnCommand(current, selectedNode.id, column, selectedNodeLaneAxis));
  }

  function removeSelectedNodeGroupRow(row: number) {
    if (!selectedNode) return;
    updateMap((current) => removeNodeGroupRowCommand(current, selectedNode.id, row, selectedNodeLaneAxis));
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
    draggingSegmentElbowState,
    draggingSegmentPolylinePointState,
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
    handleSegmentElbowMouseDown,
    handleSegmentPolylinePointMouseDown,
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
    labelAxisSnapSensitivity: config.labelAxisSnapSensitivity,
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
    setSelectedSegmentPolylinePoint,
    setSelectedLineId,
    setSidePanel,
    closeAllContextMenus,
    closeNodeContextMenu,
    closeSegmentContextMenu,
    resetNodeAssignmentDrafts,
    setViewportCenter,
    updateSegmentOrthogonalElbow,
    updateSegmentPolylinePoint,
  });
  function handleStationContextMenu(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    setCanvasContextMenu(null);
    setSelectedSegmentPolylinePoint(null);
    const nextMenu = prepareStationContextMenu(stationId, nodeId, event.clientX, event.clientY);
    setNodeContextMenu(nextMenu);
  }

  function handleNodeContextMenu(event: MouseEvent<SVGGElement>, nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    setCanvasContextMenu(null);
    setSelectedSegmentPolylinePoint(null);
    const nextMenu = prepareNodeContextMenu(nodeId, markerKey, segmentIds, laneId, event.clientX, event.clientY);
    setNodeContextMenu(nextMenu);
  }

  function handleSegmentContextMenu(event: MouseEvent<SVGPathElement>, segmentId: string) {
    event.preventDefault();
    event.stopPropagation();
    setCanvasContextMenu(null);
    setSelectedSegmentPolylinePoint(null);
    prepareSegmentSelectionForContextMenu(event, segmentId);
    const point = svgRef.current ? getSvgPoint(svgRef.current, event.clientX, event.clientY) : null;
    setSegmentContextMenu({
      segmentId,
      x: event.clientX,
      y: event.clientY,
      point: point ?? undefined,
    });
  }

  function handleSegmentPolylinePointContextMenu(event: MouseEvent<SVGCircleElement>, segmentId: string, pointIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    setCanvasContextMenu(null);
    closeNodeContextMenu();
    closeSegmentContextMenu();
    setSelectedSegmentId(segmentId);
    setSelectedSegmentPolylinePoint({ segmentId, pointIndex });
    setSelectedNodeMarkerKey(null);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");
    setSelectedLineId(lineIdBySegmentId.get(segmentId) ?? "");
    setSidePanel("edit");
    setBendPointContextMenu({
      segmentId,
      pointIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCanvasContextMenu(event: MouseEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget || !svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    closeAllContextMenus();
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    setCanvasContextMenu({
      x: getClampedMenuPosition(event.clientX, event.clientY, 240, 80)?.left ?? event.clientX,
      y: getClampedMenuPosition(event.clientX, event.clientY, 240, 80)?.top ?? event.clientY,
      point,
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

  useEffect(() => {
    if (!isResizingSidePanel) return;

    function handlePointerMove(event: globalThis.MouseEvent) {
      const start = sidePanelResizeStartRef.current;
      if (!start) return;
      const delta = start.startX - event.clientX;
      setSidePanelWidth(Math.min(760, Math.max(380, start.startWidth + delta)));
    }

    function handlePointerUp() {
      setIsResizingSidePanel(false);
      sidePanelResizeStartRef.current = null;
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isResizingSidePanel]);

  const startSidePanelResize = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    sidePanelResizeStartRef.current = {
      startX: event.clientX,
      startWidth: sidePanelWidth,
    };
    setIsResizingSidePanel(true);
  }, [sidePanelWidth]);

  return (
    <div className={`h-screen overflow-hidden px-3 py-3 sm:px-4 ${isResizingSidePanel ? "cursor-col-resize select-none" : ""}`}>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-3">
        <header className="flex flex-col gap-2 rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-panel backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-sky-700">Raily Editor</h1>
            <p className="text-xs text-muted">Copyright © R. &amp; K. Nibali</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={sidePanel === "edit" ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : ""}
              onClick={() => setSidePanel(sidePanel === "edit" ? "closed" : "edit")}
            >
              Inspect
            </Button>
            <Button
              variant="outline"
              className={sidePanel === "manage" ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : ""}
              onClick={() => setSidePanel(sidePanel === "manage" ? "closed" : "manage")}
            >
              Manage
            </Button>
            <Button
              variant="outline"
              className={sidePanel === "settings" ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" : ""}
              onClick={() => setSidePanel(sidePanel === "settings" ? "closed" : "settings")}
            >
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

        <div
          className={sidePanel === "closed"
            ? "grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3"
            : "grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_12px_var(--panel-width)]"}
          style={sidePanel === "closed" ? undefined : ({ ["--panel-width" as string]: `${sidePanelWidth}px` })}
        >
          <div className="min-h-0 h-full">
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
            segmentIndicatorWidth={config.segmentIndicatorWidth}
            selectedSegmentIndicatorBoost={config.selectedSegmentIndicatorBoost}
            gridLineOpacity={config.gridLineOpacity}
            canvasViewportRef={canvasViewportRef}
            svgRef={svgRef}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
            viewBox={viewBox}
            worldSize={WORLD_SIZE}
            handleCanvasMouseDown={handleCanvasMouseDown}
            handleCanvasContextMenu={handleCanvasContextMenu}
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
            draggingSegmentElbowState={draggingSegmentElbowState}
            draggingSegmentPolylinePointState={draggingSegmentPolylinePointState}
            selectedSegmentPolylinePoint={selectedSegmentPolylinePoint}
            labelAxisGuide={labelAxisGuide}
            selectedStationId={selectedStationId}
            highlightedStationId={highlightedStationId}
            labelDiagnostics={labelDiagnostics}
            handleLabelMouseDown={handleLabelMouseDown}
            handleStationContextMenu={handleStationContextMenu}
            handleLabelRotateMouseDown={handleLabelRotateMouseDown}
            handleSegmentElbowMouseDown={handleSegmentElbowMouseDown}
            handleSegmentPolylinePointMouseDown={handleSegmentPolylinePointMouseDown}
            handleSegmentPolylinePointContextMenu={handleSegmentPolylinePointContextMenu}
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
            addNodeToGroup={addNodeToGroup}
            canRemoveNodeFromGroup={!!contextMenuNode && !!nodeContextMenu?.laneId && !currentSegments.some((segment) => segment.fromLaneId === nodeContextMenu.laneId || segment.toLaneId === nodeContextMenu.laneId)}
            removeNodeFromGroup={removeNodeFromGroup}
            canRemoveTrackPoint={!!contextMenuNode && removableTrackPointNodeIds.has(contextMenuNode.id)}
            removeTrackPoint={removeTrackPoint}
            completeSegmentAtNode={completeSegmentAtNode}
            cancelPendingSegment={cancelPendingSegment}
            startSegmentFromNode={startSegmentFromNode}
            segmentContextMenu={segmentContextMenu}
            contextMenuSegment={contextMenuSegment}
            segmentContextMenuPosition={segmentContextMenuPosition}
            bendPointContextMenu={bendPointContextMenu}
            bendPointContextMenuPosition={bendPointContextMenuPosition}
            assignedLineForContextSegment={assignedLineForContextSegment}
            assignableLinesForContextSegment={assignableLinesForContextSegment}
            unassignLineFromSegment={unassignLineFromSegment}
            assignLineToSegment={assignLineToSegment}
            insertTrackPointOnSegment={insertTrackPointOnSegment}
            makeSegmentStraight={makeSegmentStraight}
            makeSegmentOrthogonal={makeSegmentOrthogonal}
            makeSegmentPolyline={makeSegmentPolyline}
            addSegmentPolylinePoint={addSegmentPolylinePoint}
            removeSegmentPolylinePoint={removeSegmentPolylinePoint}
            deleteSegment={deleteSegment}
            canvasContextMenu={canvasContextMenu}
            createTrackPointAtCanvasPoint={createTrackPointAtCanvasPoint}
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
          </div>

          {sidePanel !== "closed" ? (
            <>
            <div
              className="relative hidden xl:block"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize side panel"
              onMouseDown={startSidePanelResize}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200" />
              <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 cursor-col-resize rounded-full hover:bg-slate-100" />
            </div>
            <div className="min-w-0 min-h-0 h-full">
              <Card className="flex h-full min-h-0 flex-col overflow-hidden border-slate-200 bg-white/95 backdrop-blur">
                <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <CardTitle>{sidePanel === "edit" ? "Inspector" : sidePanel === "settings" ? "Settings" : "Management"}</CardTitle>
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
                      nodeGroupCellWidth={nodeGroupCellWidth}
                      nodeGroupCellHeight={nodeGroupCellHeight}
                      selectedNodeMarkerLaneId={selectedNodeMarkerLaneId}
                      updateSelectedNodeLaneCell={updateSelectedNodeLaneCell}
                      updateSelectedNodeLaneLine={updateSelectedNodeLaneLine}
                      selectNodeLane={selectNodeLane}
                      insertNodeGroupColumn={insertSelectedNodeGroupColumn}
                      insertNodeGroupRow={insertSelectedNodeGroupRow}
                      removeNodeGroupColumn={removeSelectedNodeGroupColumn}
                      removeNodeGroupRow={removeSelectedNodeGroupRow}
                      selectedNodeStations={selectedNodeStations}
                      attachStationToSelectedNode={attachStationToSelectedNode}
                      addNodeToGroup={addNodeToGroup}
                      removableNodeLaneIds={new Set(selectedNodeLanes.filter((lane) => lane.segmentIds.length === 0).map((lane) => lane.id))}
                      removeSelectedNodeFromGroup={(laneId) => selectedNode && removeNodeFromGroup(selectedNode.id, laneId)}
                      canRemoveSelectedTrackPoint={!!selectedNode && removableTrackPointNodeIds.has(selectedNode.id)}
                      removeSelectedTrackPoint={() => selectedNode && removeTrackPoint(selectedNode.id)}
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
              makeSegmentStraight={makeSegmentStraight}
              makeSegmentOrthogonal={makeSegmentOrthogonal}
              makeSegmentPolyline={makeSegmentPolyline}
              addSegmentPolylinePoint={addSegmentPolylinePoint}
              selectedSegmentPolylinePoint={selectedSegmentPolylinePoint}
              removeSegmentPolylinePoint={removeSegmentPolylinePoint}
              segmentFromPortOptions={segmentFromPortOptions}
              segmentToPortOptions={segmentToPortOptions}
              updateSelectedSegmentPort={updateSelectedSegmentPort}
            />
                  ) : sidePanel === "settings" ? (
                    <RailwayMapSettings
                      nodeGroupCellWidth={nodeGroupCellWidth}
                      nodeGroupCellHeight={nodeGroupCellHeight}
                      segmentIndicatorWidth={config.segmentIndicatorWidth}
                      selectedSegmentIndicatorBoost={config.selectedSegmentIndicatorBoost}
                      gridLineOpacity={config.gridLineOpacity}
                      labelAxisSnapSensitivity={config.labelAxisSnapSensitivity}
                      updateNodeGroupCellWidth={updateNodeGroupCellWidth}
                      updateNodeGroupCellHeight={updateNodeGroupCellHeight}
                      updateSegmentIndicatorWidth={updateSegmentIndicatorWidth}
                      updateSelectedSegmentIndicatorBoost={updateSelectedSegmentIndicatorBoost}
                      updateGridLineOpacity={updateGridLineOpacity}
                      updateLabelAxisSnapSensitivity={updateLabelAxisSnapSensitivity}
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
            </>
          ) : (
            <div className="hidden xl:block" />
          )}
        </div>
      </div>
    </div>
  );
}
