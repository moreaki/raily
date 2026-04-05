import type { MouseEvent, RefObject } from "react";
import { useRef, useState } from "react";
import type { MapPoint, RailwayMap, Segment, Station, StationKind } from "@/entities/railway-map/model/types";
import { createStraightSegmentForSheet } from "@/entities/railway-map/model/utils";
import { getSvgPoint, normalizeRect } from "@/features/railway-map-editor/lib/geometry";
import { estimateLabelBox, getStationKindFontSize, normalizeRotation } from "@/features/railway-map-editor/lib/labels";

const NODE_SEGMENT_LONG_PRESS_MS = 260;
const NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD = 6;

type RotatingLabelState = {
  stationId: string;
  center: MapPoint;
  startAngle: number;
  startRotation: number;
};

type PendingSegmentStart = {
  nodeId: string;
  laneId: string | null;
  markerKey: string | null;
};

type SegmentDrawState = {
  nodeId: string;
  laneId: string | null;
  markerKey: string;
  currentPoint: MapPoint;
};

type NodeDragSnapshot = {
  startPoint: MapPoint;
  positionsByNodeId: Map<string, MapPoint>;
  labelOffsetsByStationId: Map<string, MapPoint>;
};

type LabelDragSnapshot = {
  stationId: string;
  startPoint: MapPoint;
  startLabel: MapPoint;
};

type MarqueeSelection = {
  start: MapPoint;
  end: MapPoint;
};

type LabelAxisGuide = {
  stationId: string;
  nodeId: string;
  nodeCenter: MapPoint;
  snapX: boolean;
  snapY: boolean;
  snapDiagPos: boolean;
  snapDiagNeg: boolean;
};

type LabelAxisBreakoutState = {
  stationId: string;
  releaseX: boolean;
  releaseY: boolean;
  breakXStartedAt: number | null;
  breakYStartedAt: number | null;
};

const LABEL_AXIS_BREAKOUT_MS = 90;
const LABEL_AXIS_BREAKOUT_DISTANCE = 12;
const ROTATION_SNAP_INCREMENT = 45;
const ROTATION_SOFT_SNAP_THRESHOLD = 6;

type UseRailwayMapInteractionsArgs = {
  svgRef: RefObject<SVGSVGElement | null>;
  model: RailwayMap["model"];
  currentSheetId: string;
  currentSheetExists: boolean;
  currentSegments: Segment[];
  currentStations: Array<Station & { nodeId: string }>;
  stationKindsById: Map<string, StationKind>;
  selectedNodeIds: string[];
  selectedNodeIdsSet: Set<string>;
  selectedNodeMarkerKey: string | null;
  selectedStationId: string;
  selectedSegmentId: string;
  lineIdBySegmentId: Map<string, string>;
  viewportCenter: MapPoint;
  panning: boolean;
  panStart: { clientX: number; clientY: number; centerX: number; centerY: number } | null;
  setPanning: (value: boolean) => void;
  setPanStart: (value: { clientX: number; clientY: number; centerX: number; centerY: number } | null) => void;
  viewBox: { width: number; height: number };
  canvasWidth: number;
  canvasHeight: number;
  snapToGrid: boolean;
  labelAxisSnapSensitivity: number;
  snapPointToGrid: (point: MapPoint) => MapPoint;
  updateMap: (updater: (current: RailwayMap) => RailwayMap, options?: { trackHistory?: boolean }) => void;
  beginTransientMapChange: () => void;
  completeTransientMapChange: () => void;
  selectSingleNode: (nodeId: string) => void;
  clearPrimarySelection: () => void;
  setSelectedNodeId: (value: string) => void;
  setSelectedNodeIds: (value: string[] | ((current: string[]) => string[])) => void;
  setSelectedNodeMarkerKey: (value: string | null) => void;
  setSelectedStationId: (value: string) => void;
  setSelectedSegmentId: (value: string) => void;
  setSelectedLineId: (value: string) => void;
  setSidePanel: (value: "closed" | "edit" | "manage") => void;
  closeAllContextMenus: () => void;
  closeNodeContextMenu: () => void;
  closeSegmentContextMenu: () => void;
  resetNodeAssignmentDrafts: () => void;
  setViewportCenter: (value: MapPoint) => void;
};

export function useRailwayMapInteractions(args: UseRailwayMapInteractionsArgs) {
  const {
    svgRef,
    model,
    currentSheetId,
    currentSheetExists,
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
    canvasWidth,
    canvasHeight,
    snapToGrid,
    labelAxisSnapSensitivity,
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
  } = args;

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingLabelStationId, setDraggingLabelStationId] = useState<string | null>(null);
  const [rotatingLabelState, setRotatingLabelState] = useState<RotatingLabelState | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<MarqueeSelection | null>(null);
  const [pendingSegmentStart, setPendingSegmentStart] = useState<PendingSegmentStart | null>(null);
  const [segmentDrawState, setSegmentDrawState] = useState<SegmentDrawState | null>(null);
  const [labelAxisGuide, setLabelAxisGuide] = useState<LabelAxisGuide | null>(null);

  const nodeDragSnapshotRef = useRef<NodeDragSnapshot | null>(null);
  const labelDragSnapshotRef = useRef<LabelDragSnapshot | null>(null);
  const labelAxisBreakoutRef = useRef<LabelAxisBreakoutState | null>(null);
  const nodeLongPressTimeoutRef = useRef<number | null>(null);
  const nodeLongPressPressRef = useRef<{
    nodeId: string;
    laneId: string | null;
    markerKey: string;
    clientX: number;
    clientY: number;
    startPoint: MapPoint;
  } | null>(null);

  function clearNodeLongPress() {
    if (nodeLongPressTimeoutRef.current !== null) {
      window.clearTimeout(nodeLongPressTimeoutRef.current);
      nodeLongPressTimeoutRef.current = null;
    }
    nodeLongPressPressRef.current = null;
  }

  function snapRotationToIncrement(rotation: number, force: boolean) {
    const nearest = Math.round(rotation / ROTATION_SNAP_INCREMENT) * ROTATION_SNAP_INCREMENT;
    if (force || Math.abs(rotation - nearest) <= ROTATION_SOFT_SNAP_THRESHOLD) {
      return normalizeRotation(nearest);
    }
    return normalizeRotation(rotation);
  }

  function resolveRotationAxisFamily(rotation: number, force: boolean) {
    const normalized = normalizeRotation(rotation);
    const snapped = snapRotationToIncrement(normalized, force);
    const effective = force || Math.abs(normalized - snapped) <= ROTATION_SOFT_SNAP_THRESHOLD ? snapped : normalized;
    const modulo = ((effective % 180) + 180) % 180;

    if (modulo === 45) return "diag-pos" as const;
    if (modulo === 135) return "diag-neg" as const;
    return "cardinal" as const;
  }

  function beginSegmentDrawFromNode(nodeId: string, laneId: string | null, markerKey: string, startPoint: MapPoint) {
    clearNodeLongPress();
    setDraggingNodeId(null);
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

  function createSegmentFromPendingNode(nextNodeId: string, nextLaneId: string | null) {
    if (!currentSheetExists) return;
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
      ...createStraightSegmentForSheet(currentSheetId, pendingSegmentStart.nodeId, nextNodeId),
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
    closeNodeContextMenu();
  }

  function cancelPendingSegment() {
    cancelSegmentDraw();
    closeNodeContextMenu();
  }

  function completeSegmentAtNode(nodeId: string, laneId: string | null, markerKey: string | null) {
    selectSingleNode(nodeId);
    setSelectedNodeMarkerKey(markerKey);
    createSegmentFromPendingNode(nodeId, laneId);
    closeNodeContextMenu();
  }

  function clearCanvasSelections() {
    clearPrimarySelection();
    setLabelAxisGuide(null);
    labelAxisBreakoutRef.current = null;
    setPendingSegmentStart(null);
    setSegmentDrawState(null);
    closeNodeContextMenu();
    setRotatingLabelState(null);
    clearNodeLongPress();
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
    closeAllContextMenus();
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
    if (!svgRef.current) return;
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;

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
            return [station.id, { x: station.label!.x - node.x, y: station.label!.y - node.y }];
        }),
      ),
    };
    if (nodeIdsToMove.length > 1) {
      nodeLongPressPressRef.current = null;
      return;
    }
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

  function handleNodeMouseUp(event: MouseEvent<SVGGElement>, nodeId: string, markerKey: string, laneId: string | null) {
    if (!segmentDrawState) {
      clearNodeLongPress();
      return;
    }

    event.stopPropagation();
    clearNodeLongPress();
    setDraggingNodeId(null);
    nodeDragSnapshotRef.current = null;

    if (segmentDrawState.nodeId === nodeId && segmentDrawState.markerKey === markerKey) {
      cancelSegmentDraw();
      return;
    }

    setSegmentDrawState(null);
    completeSegmentAtNode(nodeId, laneId, markerKey);
  }

  function handleLabelMouseDown(event: MouseEvent<SVGGElement>, stationId: string, nodeId: string) {
    event.preventDefault();
    event.stopPropagation();
    clearNodeLongPress();
    closeAllContextMenus();
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
    labelDragSnapshotRef.current = null;
    setLabelAxisGuide(null);
    labelAxisBreakoutRef.current = {
      stationId,
      releaseX: false,
      releaseY: false,
      breakXStartedAt: null,
      breakYStartedAt: null,
    };
    setDraggingLabelStationId(stationId);
    beginTransientMapChange();
    if (!svgRef.current) return;
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    const station = model.stations.find((candidate) => candidate.id === stationId);
    const stationNode = station?.nodeId ? model.nodes.find((candidate) => candidate.id === station.nodeId) : null;
    labelDragSnapshotRef.current = {
      stationId,
      startPoint: point,
      startLabel: {
        x: station?.label?.x ?? ((stationNode?.x ?? 0) + 12),
        y: station?.label?.y ?? ((stationNode?.y ?? 0) - 10),
      },
    };
  }

  function handleLabelRotateMouseDown(
    event: MouseEvent<SVGRectElement>,
    stationId: string,
    nodeId: string,
    center: MapPoint,
    currentRotation: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    clearNodeLongPress();
    closeAllContextMenus();
    setSidePanel("edit");
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    setDraggingNodeId(null);
    setDraggingLabelStationId(null);
    setLabelAxisGuide(null);
    labelAxisBreakoutRef.current = null;

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
    closeSegmentContextMenu();
    setSidePanel("edit");
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId(stationId);
    setSelectedSegmentId("");
    resetNodeAssignmentDrafts();
    // open handled by caller afterward via setNodeContextMenu
  }

  function handleCanvasMouseDown(event: MouseEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    clearNodeLongPress();
    closeAllContextMenus();
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
    closeAllContextMenus();
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
    closeNodeContextMenu();
    setSelectedNodeMarkerKey(null);
    setSelectedSegmentId(segmentId);
    setSelectedLineId(lineIdBySegmentId.get(segmentId) ?? "");
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedStationId("");
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
      const deltaX = ((event.clientX - panStart.clientX) / canvasWidth) * viewBox.width;
      const deltaY = ((event.clientY - panStart.clientY) / canvasHeight) * viewBox.height;
      setViewportCenter({
        x: panStart.centerX - deltaX,
        y: panStart.centerY - deltaY,
      });
      return;
    }

    if (rotatingLabelState) {
      const nextAngle = Math.atan2(svgPoint.y - rotatingLabelState.center.y, svgPoint.x - rotatingLabelState.center.x);
      const rawRotation = normalizeRotation(rotatingLabelState.startRotation + ((nextAngle - rotatingLabelState.startAngle) * 180) / Math.PI);
      const nextRotation = snapRotationToIncrement(rawRotation, event.altKey);

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

    if (draggingLabelStationId && labelDragSnapshotRef.current?.stationId === draggingLabelStationId) {
      const labelDragSnapshot = labelDragSnapshotRef.current;
      const deltaX = Math.round(svgPoint.x - labelDragSnapshot.startPoint.x);
      const deltaY = Math.round(svgPoint.y - labelDragSnapshot.startPoint.y);
      if (deltaX === 0 && deltaY === 0) return;

      updateMap((current) => ({
        ...current,
        model: {
          ...current.model,
          stations: current.model.stations.map((station) => {
            if (station.id !== draggingLabelStationId) return station;
            const stationNode = station.nodeId ? current.model.nodes.find((node) => node.id === station.nodeId) : null;
            const stationKind = stationKindsById.get(station.kindId);
            const nextLabel = {
              ...station.label,
              x: labelDragSnapshot.startLabel.x + deltaX,
              y: labelDragSnapshot.startLabel.y + deltaY,
              align: station.label?.align ?? "right",
              rotation: station.label?.rotation ?? 0,
            };

            if (!stationNode) {
              setLabelAxisGuide(null);
              return {
                ...station,
                label: nextLabel,
              };
            }

            const box = estimateLabelBox(
              station.name,
              nextLabel.x,
              nextLabel.y,
              getStationKindFontSize(stationKind),
              nextLabel.rotation ?? 0,
            );
            let snappedX = nextLabel.x;
            let snappedY = nextLabel.y;
            let snapX = false;
            let snapY = false;
            const enforceAxisSnap = event.altKey;
            const breakout = labelAxisBreakoutRef.current?.stationId === station.id
              ? labelAxisBreakoutRef.current
              : {
                  stationId: station.id,
                  releaseX: false,
                  releaseY: false,
                  breakXStartedAt: null,
                  breakYStartedAt: null,
                };

            const centerDeltaX = box.center.x - stationNode.x;
            const centerDeltaY = box.center.y - stationNode.y;
            const nearAxisX = Math.abs(centerDeltaX) <= labelAxisSnapSensitivity;
            const nearAxisY = Math.abs(centerDeltaY) <= labelAxisSnapSensitivity;
            const diagPosDelta = centerDeltaY - centerDeltaX;
            const diagNegDelta = centerDeltaY + centerDeltaX;
            const diagonalAxisSnapSensitivity = labelAxisSnapSensitivity * 1.8;
            const nearDiagPos = Math.abs(diagPosDelta) <= diagonalAxisSnapSensitivity;
            const nearDiagNeg = Math.abs(diagNegDelta) <= diagonalAxisSnapSensitivity;
            const beyondBreakoutX = Math.abs(centerDeltaX) >= LABEL_AXIS_BREAKOUT_DISTANCE;
            const beyondBreakoutY = Math.abs(centerDeltaY) >= LABEL_AXIS_BREAKOUT_DISTANCE;
            const axisFamily = resolveRotationAxisFamily(nextLabel.rotation ?? 0, enforceAxisSnap);
            const nearPrimaryAxis = axisFamily === "diag-pos" ? nearDiagPos : axisFamily === "diag-neg" ? nearDiagNeg : nearAxisX;
            const nearSecondaryAxis = axisFamily === "diag-pos" ? nearDiagPos : axisFamily === "diag-neg" ? nearDiagNeg : nearAxisY;
            const beyondPrimaryBreakout =
              axisFamily === "diag-pos"
                ? Math.abs(diagPosDelta) >= LABEL_AXIS_BREAKOUT_DISTANCE
                : axisFamily === "diag-neg"
                  ? Math.abs(diagNegDelta) >= LABEL_AXIS_BREAKOUT_DISTANCE
                  : beyondBreakoutX;
            const beyondSecondaryBreakout =
              axisFamily === "diag-pos"
                ? Math.abs(diagPosDelta) >= LABEL_AXIS_BREAKOUT_DISTANCE
                : axisFamily === "diag-neg"
                  ? Math.abs(diagNegDelta) >= LABEL_AXIS_BREAKOUT_DISTANCE
                  : beyondBreakoutY;

            if (enforceAxisSnap) {
              breakout.releaseX = false;
              breakout.releaseY = false;
              breakout.breakXStartedAt = null;
              breakout.breakYStartedAt = null;
            } else {
              if (!breakout.releaseX && !nearPrimaryAxis && beyondPrimaryBreakout) {
                breakout.breakXStartedAt ??= event.timeStamp;
                if (event.timeStamp - breakout.breakXStartedAt >= LABEL_AXIS_BREAKOUT_MS) {
                  breakout.releaseX = true;
                }
              } else if (nearPrimaryAxis) {
                breakout.breakXStartedAt = null;
                breakout.releaseX = false;
              } else {
                breakout.breakXStartedAt = null;
              }

              if (!breakout.releaseY && !nearSecondaryAxis && beyondSecondaryBreakout) {
                breakout.breakYStartedAt ??= event.timeStamp;
                if (event.timeStamp - breakout.breakYStartedAt >= LABEL_AXIS_BREAKOUT_MS) {
                  breakout.releaseY = true;
                }
              } else if (nearSecondaryAxis) {
                breakout.breakYStartedAt = null;
                breakout.releaseY = false;
              } else {
                breakout.breakYStartedAt = null;
              }
            }

            labelAxisBreakoutRef.current = breakout;

            let snapDiagPos = false;
            let snapDiagNeg = false;

            if (axisFamily === "diag-pos" || axisFamily === "diag-neg") {
              if (axisFamily === "diag-pos" && (enforceAxisSnap || (!breakout.releaseX && nearDiagPos))) {
                const shiftX = (centerDeltaY - centerDeltaX) / 2;
                const shiftY = (centerDeltaX - centerDeltaY) / 2;
                snappedX += shiftX;
                snappedY += shiftY;
                snapDiagPos = true;
              } else if (axisFamily === "diag-neg" && (enforceAxisSnap || (!breakout.releaseY && nearDiagNeg))) {
                const shift = -(centerDeltaX + centerDeltaY) / 2;
                snappedX += shift;
                snappedY += shift;
                snapDiagNeg = true;
              }
            } else {
              if ((enforceAxisSnap || (!breakout.releaseX && nearAxisX))) {
                snappedX += stationNode.x - box.center.x;
                snapX = true;
              }
              if ((enforceAxisSnap || (!breakout.releaseY && nearAxisY))) {
                snappedY += stationNode.y - box.center.y;
                snapY = true;
              }
            }

            setLabelAxisGuide(
              snapX || snapY || snapDiagPos || snapDiagNeg
                ? {
                    stationId: station.id,
                    nodeId: stationNode.id,
                    nodeCenter: { x: stationNode.x, y: stationNode.y },
                    snapX,
                    snapY,
                    snapDiagPos,
                    snapDiagNeg,
                  }
                : null,
            );

            return {
              ...station,
              label: {
                ...nextLabel,
                x: snappedX,
                y: snappedY,
              },
            };
          }),
        },
      }), { trackHistory: false });
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
    if (longPress && (Math.abs(event.clientX - longPress.clientX) > NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD || Math.abs(event.clientY - longPress.clientY) > NODE_SEGMENT_LONG_PRESS_MOVE_THRESHOLD)) {
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
    setLabelAxisGuide(null);
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
        const nextSelectedNodeIds = model.nodes
          .filter((node) => node.sheetId === currentSheetId)
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
    setLabelAxisGuide(null);
    labelDragSnapshotRef.current = null;
    labelAxisBreakoutRef.current = null;
    nodeDragSnapshotRef.current = null;
    setPanning(false);
    setPanStart(null);
  }

  function prepareStationContextMenu(stationId: string, nodeId: string, x: number, y: number) {
    handleStationContextMenu({ preventDefault() {}, stopPropagation() {} } as MouseEvent<SVGGElement>, stationId, nodeId);
    return {
      nodeIds: [nodeId],
      x,
      y,
      markerKey: null,
      laneId: null,
      segmentId: null,
    };
  }

  function prepareNodeContextMenu(nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null, x: number, y: number) {
    closeSegmentContextMenu();
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
    resetNodeAssignmentDrafts();
    return {
      nodeIds,
      x,
      y,
      markerKey,
      laneId,
      segmentId: segmentIds.length === 1 ? segmentIds[0] : null,
    };
  }

  return {
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
    handleSegmentContextMenu,
    handleSvgMouseMove,
    handleSvgMouseUp,
    prepareStationContextMenu,
    prepareNodeContextMenu,
    setNodeContextMenuFromStation: () => {},
  };
}
