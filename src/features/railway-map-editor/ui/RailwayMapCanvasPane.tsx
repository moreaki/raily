import { useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { Plus } from "lucide-react";
import type { Line, MapNode, MapPoint, Segment, Sheet, Station, StationKind } from "@/entities/railway-map/model/types";
import { buildSegmentPoints, lineStrokeDasharray } from "@/entities/railway-map/model/utils";
import { DEFAULT_STATION_FONT_FAMILY, DEFAULT_STATION_FONT_WEIGHT, DEFAULT_STATION_SYMBOL_SIZE, estimateLabelBox, getStationKindFontSize, getStationLabelPosition, normalizeRotation } from "@/features/railway-map-editor/lib/labels";
import { normalizeRect, offsetPoints, pathFromPoints, withAnchoredSegmentEndpoints } from "@/features/railway-map-editor/lib/geometry";
import { NodeContextMenu } from "@/features/railway-map-editor/ui/NodeContextMenu";
import { SegmentContextMenu } from "@/features/railway-map-editor/ui/SegmentContextMenu";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type NodeMarker = {
  key: string;
  center: MapPoint;
  segmentIds: string[];
  laneId: string | null;
};

type NodeContextMenuState = {
  nodeIds: string[];
  markerKey: string | null;
  laneId: string | null;
  x: number;
  y: number;
};

type SegmentContextMenuState = {
  segmentId: string;
  x: number;
  y: number;
};

type SegmentDrawState = {
  nodeId: string;
  markerKey: string;
  currentPoint: MapPoint;
};

type PendingSegmentStart = {
  nodeId: string;
  markerKey: string | null;
  laneId: string | null;
};

type LabelDiagnostic = {
  box: ReturnType<typeof estimateLabelBox>;
  overlapsLabel: boolean;
  overlapsSegment: boolean;
  colliding: boolean;
  leaderLine: boolean;
};

type RotatingLabelState = {
  stationId: string;
};

type LabelAxisGuide = {
  stationId: string;
  nodeId: string;
  nodeCenter: MapPoint;
  snapX: boolean;
  snapY: boolean;
};

type MarqueeSelection = {
  start: MapPoint;
  end: MapPoint;
};

type RailwayMapCanvasPaneProps = {
  pendingSegmentStart: PendingSegmentStart | null;
  laneDisplayNameById: Map<string, string>;
  zoom: number;
  zoomStep: number;
  applyZoom: (nextZoom: number) => void;
  resetViewportToSheet: () => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (value: boolean) => void;
  gridStepX: number;
  gridStepY: number;
  minGridStep: number;
  setGridStepX: (value: number) => void;
  setGridStepY: (value: number) => void;
  addNode: () => void;
  canvasViewportRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  viewBox: { x: number; y: number; width: number; height: number };
  worldSize: number;
  handleCanvasMouseDown: (event: ReactMouseEvent<SVGSVGElement>) => void;
  handleSvgMouseMove: (event: ReactMouseEvent<SVGSVGElement>) => void;
  handleSvgMouseUp: (event: ReactMouseEvent<SVGSVGElement>) => void;
  gridLines: { vertical: number[]; horizontal: number[] };
  currentSegments: Segment[];
  nodesById: Map<string, MapNode>;
  segmentOffsetById: Map<string, number>;
  anchoredEndpointBySegmentNodeKey: Map<string, MapPoint>;
  selectedSegmentId: string;
  assignedSegmentIds: Set<string>;
  handleSegmentMouseDown: (segmentId: string) => void;
  handleSegmentContextMenu: (event: ReactMouseEvent<SVGPathElement>, segmentId: string) => void;
  lineRuns: Array<{ id: string; lineId: string; segmentIds: string[] }>;
  linesById: Map<string, Line>;
  segmentsById: Map<string, Segment>;
  segmentDrawState: SegmentDrawState | null;
  nodeMarkerCenterByKey: Map<string, MapPoint>;
  nodeMarkerCentersById: Map<string, NodeMarker[]>;
  currentNodes: MapNode[];
  stationsByNodeId: Map<string, Station[]>;
  selectedNodeIdsSet: Set<string>;
  selectedNodeMarkerKey: string | null;
  stationKindsById: Map<string, StationKind>;
  renderNodeSymbol: (shape: StationKind["shape"], center: MapPoint, isTrackPoint: boolean, symbolSize?: number) => React.ReactNode;
  handleNodeMouseDown: (event: ReactMouseEvent<SVGGElement>, nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null) => void;
  handleNodeMouseUp: (event: ReactMouseEvent<SVGGElement>, nodeId: string, markerKey: string, laneId: string | null) => void;
  handleNodeContextMenu: (event: ReactMouseEvent<SVGGElement>, nodeId: string, markerKey: string, segmentIds: string[], laneId: string | null) => void;
  currentStations: Station[];
  draggingLabelStationId: string | null;
  draggingNodeId: string | null;
  nodeDragSnapshotRef: RefObject<{ positionsByNodeId: Map<string, { x: number; y: number }> } | null>;
  rotatingLabelState: RotatingLabelState | null;
  labelAxisGuide: LabelAxisGuide | null;
  selectedStationId: string;
  highlightedStationId: string;
  labelDiagnostics: Map<string, LabelDiagnostic>;
  handleLabelMouseDown: (event: ReactMouseEvent<SVGGElement>, stationId: string, nodeId: string) => void;
  handleStationContextMenu: (event: ReactMouseEvent<SVGGElement>, stationId: string, nodeId: string) => void;
  handleLabelRotateMouseDown: (
    event: ReactMouseEvent<SVGRectElement>,
    stationId: string,
    nodeId: string,
    center: MapPoint,
    currentRotation: number,
  ) => void;
  marqueeSelection: MarqueeSelection | null;
  currentSheet: Sheet | null;
  nodeContextMenu: NodeContextMenuState | null;
  nodeContextMenuPosition: { left: number; top: number } | null;
  contextMenuStation: Station | null;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  unassignStation: (stationId: string) => void;
  configStationKinds: StationKind[];
  stationKindShapeGlyph: (shape: StationKind["shape"]) => string;
  nodeAssignmentQuery: string;
  setNodeAssignmentQuery: (value: string) => void;
  stationAssignmentResults: Station[];
  assignStationToNode: (stationId: string, nodeId: string) => void;
  nodeAssignmentName: string;
  setNodeAssignmentName: (value: string) => void;
  nodeAssignmentKindId: string;
  setNodeAssignmentKindId: (value: string) => void;
  createStationAtNode: (nodeId: string, name: string, kindId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
  completeSegmentAtNode: (nodeId: string, laneId: string | null, markerKey: string | null) => void;
  cancelPendingSegment: () => void;
  startSegmentFromNode: (nodeId: string, laneId: string | null, markerKey: string | null) => void;
  segmentContextMenu: SegmentContextMenuState | null;
  contextMenuSegment: Segment | null;
  segmentContextMenuPosition: { left: number; top: number } | null;
  assignedLineForContextSegment: Line | null;
  assignableLinesForContextSegment: Line[];
  unassignLineFromSegment: (lineId: string, segmentId: string) => void;
  assignLineToSegment: (lineId: string, segmentId: string) => void;
  insertTrackPointOnSegment: (segmentId: string) => void;
  duplicateSegment: (segmentId: string) => void;
  deleteSegment: (segmentId: string) => void;
  sheets: Sheet[];
  currentSheetId: string;
  renamingSheetId: string | null;
  sheetNameDraft: string;
  setSheetNameDraft: (value: string) => void;
  commitSheetRename: () => void;
  startRenamingSheet: (sheetId: string, sheetName: string) => void;
  deleteCurrentSheet: () => void;
  addSheet: () => void;
  setCurrentSheetId: (sheetId: string) => void;
};

export function RailwayMapCanvasPane(props: RailwayMapCanvasPaneProps) {
  const [sheetRailOpen, setSheetRailOpen] = useState(false);
  const {
    pendingSegmentStart,
    laneDisplayNameById,
    zoom,
    zoomStep,
    applyZoom,
    resetViewportToSheet,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridStepX,
    gridStepY,
    minGridStep,
    setGridStepX,
    setGridStepY,
    addNode,
    canvasViewportRef,
    svgRef,
    canvasWidth,
    canvasHeight,
    viewBox,
    worldSize,
    handleCanvasMouseDown,
    handleSvgMouseMove,
    handleSvgMouseUp,
    gridLines,
    currentSegments,
    nodesById,
    segmentOffsetById,
    anchoredEndpointBySegmentNodeKey,
    selectedSegmentId,
    assignedSegmentIds,
    handleSegmentMouseDown,
    handleSegmentContextMenu,
    lineRuns,
    linesById,
    segmentsById,
    segmentDrawState,
    nodeMarkerCenterByKey,
    nodeMarkerCentersById,
    currentNodes,
    stationsByNodeId,
    selectedNodeIdsSet,
    selectedNodeMarkerKey,
    stationKindsById,
    renderNodeSymbol,
    handleNodeMouseDown,
    handleNodeMouseUp,
    handleNodeContextMenu,
    currentStations,
    draggingLabelStationId,
    draggingNodeId,
    nodeDragSnapshotRef,
    rotatingLabelState,
    labelAxisGuide,
    selectedStationId,
    highlightedStationId,
    labelDiagnostics,
    handleLabelMouseDown,
    handleStationContextMenu,
    handleLabelRotateMouseDown,
    marqueeSelection,
    currentSheet,
    nodeContextMenu,
    nodeContextMenuPosition,
    contextMenuStation,
    updateStation,
    unassignStation,
    configStationKinds,
    stationKindShapeGlyph,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    stationAssignmentResults,
    assignStationToNode,
    nodeAssignmentName,
    setNodeAssignmentName,
    nodeAssignmentKindId,
    setNodeAssignmentKindId,
    createStationAtNode,
    deleteNodes,
    completeSegmentAtNode,
    cancelPendingSegment,
    startSegmentFromNode,
    segmentContextMenu,
    contextMenuSegment,
    segmentContextMenuPosition,
    assignedLineForContextSegment,
    assignableLinesForContextSegment,
    unassignLineFromSegment,
    assignLineToSegment,
    insertTrackPointOnSegment,
    duplicateSegment,
    deleteSegment,
    sheets,
    currentSheetId,
    renamingSheetId,
    sheetNameDraft,
    setSheetNameDraft,
    commitSheetRename,
    startRenamingSheet,
    deleteCurrentSheet,
    addSheet,
    setCurrentSheetId,
  } = props;
  const showSheetRail = sheetRailOpen || renamingSheetId !== null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative h-[82vh] min-h-[760px] bg-slate-50">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-3">
            {pendingSegmentStart ? (
              <div className="pointer-events-auto rounded-2xl border border-sky-200 bg-sky-50/95 px-3 py-2 text-xs text-sky-800 shadow-sm">
                Segment start: {pendingSegmentStart.nodeId}
                {pendingSegmentStart.laneId ? ` (${laneDisplayNameById.get(pendingSegmentStart.laneId) ?? "Unassigned lane"})` : ""}. Right-click another track point to connect it.
              </div>
            ) : null}
            <div className="pointer-events-auto ml-auto flex gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm shadow-sm backdrop-blur">
                <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom / zoomStep)}>
                  -
                </button>
                <span className="min-w-[3.5rem] text-center text-xs font-semibold text-ink">{Math.round(zoom * 100)}%</span>
                <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom * zoomStep)}>
                  +
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-muted" onClick={resetViewportToSheet}>
                  Reset
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
                  Grid
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} />
                  Snap
                </label>
                <Input
                  type="number"
                  value={gridStepX}
                  onChange={(event) => setGridStepX(Math.max(minGridStep, Number(event.target.value) || minGridStep))}
                  className="h-8 w-20 px-2 py-1 text-xs"
                />
                <Input
                  type="number"
                  value={gridStepY}
                  onChange={(event) => setGridStepY(Math.max(minGridStep, Number(event.target.value) || minGridStep))}
                  className="h-8 w-20 px-2 py-1 text-xs"
                />
              </div>
              <Button variant="outline" className="h-9 bg-white/90 backdrop-blur" onClick={addNode}>
                <Plus className="h-4 w-4" />
                Track Point
              </Button>
            </div>
          </div>

          <div ref={canvasViewportRef} className="h-full overflow-hidden overscroll-contain touch-none">
            <svg
              ref={svgRef}
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              className="h-full w-full"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
            >
              <rect x={-worldSize / 2} y={-worldSize / 2} width={worldSize} height={worldSize} fill="white" pointerEvents="none" />
              {showGrid ? (
                <g pointerEvents="none">
                  {gridLines.vertical.map((x) => (
                    <line key={`grid-x-${x}`} x1={x} y1={viewBox.y - viewBox.height} x2={x} y2={viewBox.y + viewBox.height * 2} stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="1" />
                  ))}
                  {gridLines.horizontal.map((y) => (
                    <line key={`grid-y-${y}`} x1={viewBox.x - viewBox.width} y1={y} x2={viewBox.x + viewBox.width * 2} y2={y} stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="1" />
                  ))}
                </g>
              ) : null}

              {currentSegments.map((segment) => {
                const segmentPoints = buildSegmentPoints(segment, nodesById);
                const offsetPointsForSegment = withAnchoredSegmentEndpoints(
                  segment,
                  offsetPoints(segmentPoints, segmentOffsetById.get(segment.id) ?? 0),
                  anchoredEndpointBySegmentNodeKey,
                );
                return (
                  <path
                    key={segment.id}
                    d={pathFromPoints(offsetPointsForSegment)}
                    fill="none"
                    stroke={selectedSegmentId === segment.id ? "#94a3b8" : assignedSegmentIds.has(segment.id) ? "transparent" : "#dbe4ee"}
                    strokeWidth={selectedSegmentId === segment.id ? "22" : "18"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onMouseDown={() => handleSegmentMouseDown(segment.id)}
                    onContextMenu={(event) => handleSegmentContextMenu(event, segment.id)}
                  />
                );
              })}

              {lineRuns.map((lineRun) => {
                const line = linesById.get(lineRun.lineId);
                if (!line) return null;
                const visibleSegments = lineRun.segmentIds.map((segmentId) => segmentsById.get(segmentId)).filter((segment): segment is Segment => !!segment);
                return visibleSegments.map((segment) => {
                  const points = buildSegmentPoints(segment, nodesById);
                  const offsetSegmentPoints = withAnchoredSegmentEndpoints(
                    segment,
                    offsetPoints(points, segmentOffsetById.get(segment.id) ?? 0),
                    anchoredEndpointBySegmentNodeKey,
                  );
                  return (
                    <path
                      key={`${lineRun.id}-${segment.id}`}
                      d={pathFromPoints(offsetSegmentPoints)}
                      fill="none"
                      stroke={line.color}
                      strokeWidth={line.strokeWidth}
                      strokeDasharray={lineStrokeDasharray(line)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  );
                });
              })}

              {segmentDrawState ? (
                <line
                  x1={(nodeMarkerCenterByKey.get(segmentDrawState.markerKey) ?? nodesById.get(segmentDrawState.nodeId) ?? segmentDrawState.currentPoint).x}
                  y1={(nodeMarkerCenterByKey.get(segmentDrawState.markerKey) ?? nodesById.get(segmentDrawState.nodeId) ?? segmentDrawState.currentPoint).y}
                  x2={segmentDrawState.currentPoint.x}
                  y2={segmentDrawState.currentPoint.y}
                  stroke="#64748b"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              ) : null}

              {currentNodes.map((node) => {
                const stations = stationsByNodeId.get(node.id) ?? [];
                const isSelected = selectedNodeIdsSet.has(node.id);
                const primaryStation = stations[0];
                const isTrackPoint = stations.length === 0;
                const markers: NodeMarker[] = nodeMarkerCentersById.get(node.id) ?? [{ key: `${node.id}:base`, center: { x: node.x, y: node.y }, segmentIds: [], laneId: null }];
                const hasSelectedMarker = markers.some((marker) => marker.key === selectedNodeMarkerKey);
                const shape = primaryStation ? stationKindsById.get(primaryStation.kindId)?.shape ?? "circle" : "circle";
                const symbolSize = primaryStation ? stationKindsById.get(primaryStation.kindId)?.symbolSize ?? DEFAULT_STATION_SYMBOL_SIZE : DEFAULT_STATION_SYMBOL_SIZE;

                return (
                  <g key={node.id} style={{ cursor: "grab" }}>
                    {markers.map((marker) => (
                      <g
                        key={marker.key}
                        onMouseDown={(event) => handleNodeMouseDown(event, node.id, marker.key, marker.segmentIds, marker.laneId)}
                        onMouseUp={(event) => handleNodeMouseUp(event, node.id, marker.key, marker.laneId)}
                        onContextMenu={(event) => handleNodeContextMenu(event, node.id, marker.key, marker.segmentIds, marker.laneId)}
                      >
                        {primaryStation?.id === highlightedStationId ? (
                          <circle
                            cx={marker.center.x}
                            cy={marker.center.y}
                            r={isTrackPoint ? "18" : `${18 * symbolSize}`}
                            fill="#fde68a"
                            fillOpacity="0.45"
                            stroke="#eab308"
                            strokeWidth="2"
                          />
                        ) : null}
                        {renderNodeSymbol(shape, marker.center, isTrackPoint, symbolSize)}
                        {selectedNodeMarkerKey === marker.key ? <circle cx={marker.center.x} cy={marker.center.y} r={isTrackPoint ? "14" : "16"} fill="none" stroke="#0f172a" strokeDasharray="4 3" /> : null}
                      </g>
                    ))}
                    {isSelected && !hasSelectedMarker ? <circle cx={node.x} cy={node.y} r={isTrackPoint ? "14" : "16"} fill="none" stroke="#0f172a" strokeDasharray="4 3" /> : null}
                  </g>
                );
              })}

              {labelAxisGuide ? (
                <g pointerEvents="none">
                  {labelAxisGuide.snapX ? (
                    <line
                      x1={labelAxisGuide.nodeCenter.x}
                      y1={viewBox.y}
                      x2={labelAxisGuide.nodeCenter.x}
                      y2={viewBox.y + viewBox.height}
                      stroke="#eab308"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      opacity="0.9"
                    />
                  ) : null}
                  {labelAxisGuide.snapY ? (
                    <line
                      x1={viewBox.x}
                      y1={labelAxisGuide.nodeCenter.y}
                      x2={viewBox.x + viewBox.width}
                      y2={labelAxisGuide.nodeCenter.y}
                      stroke="#eab308"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      opacity="0.9"
                    />
                  ) : null}
                </g>
              ) : null}

              {currentStations.map((station) => {
                if (!station.nodeId) return null;
                const node = nodesById.get(station.nodeId);
                if (!node) return null;
                const stationKind = stationKindsById.get(station.kindId);
                const position = getStationLabelPosition(station, node);
                const labelX = position.x;
                const labelY = position.y;
                const labelRotation = position.rotation;
                const isDragging = draggingLabelStationId === station.id;
                const isNodeDragging = !!draggingNodeId && !!station.nodeId && !!nodeDragSnapshotRef.current?.positionsByNodeId.has(station.nodeId);
                const isRotating = rotatingLabelState?.stationId === station.id;
                const isSelected = selectedStationId === station.id;
                const isHighlighted = highlightedStationId === station.id;
                const diagnostics = labelDiagnostics.get(station.id);
                const box = diagnostics?.box ?? estimateLabelBox(station.name, labelX, labelY, getStationKindFontSize(stationKind), labelRotation);
                const shouldShowLeader = (isDragging || isNodeDragging) && (diagnostics?.leaderLine ?? false);
                const labelCenterX = box.center.x;
                const labelCenterY = box.center.y;
                const labelTransform = labelRotation ? `rotate(${labelRotation} ${labelCenterX} ${labelCenterY})` : undefined;
                const rotationLabel = `${normalizeRotation(labelRotation)}°`;
                const rotationBadgeWidth = Math.max(42, rotationLabel.length * 7.2 + 14);

                return (
                  <g key={station.id} onMouseDown={(event) => handleLabelMouseDown(event, station.id, node.id)} onContextMenu={(event) => handleStationContextMenu(event, station.id, node.id)} style={{ cursor: "grab" }}>
                    {shouldShowLeader ? <line x1={node.x} y1={node.y} x2={labelCenterX} y2={labelCenterY} stroke={diagnostics?.colliding ? "#dc2626" : "#94a3b8"} strokeWidth="1.5" strokeDasharray="3 3" /> : null}
                    <g transform={labelTransform}>
                      {isHighlighted ? (
                        <rect
                          x={box.localMinX - 4}
                          y={box.localMinY - 4}
                          width={box.localMaxX - box.localMinX + 8}
                          height={box.localMaxY - box.localMinY + 8}
                          rx="8"
                          fill="#fde68a"
                          fillOpacity="0.35"
                          stroke="#eab308"
                          strokeWidth="2"
                        />
                      ) : null}
                      {diagnostics?.colliding || isDragging || isRotating || isSelected ? (
                        <rect
                          x={box.localMinX}
                          y={box.localMinY}
                          width={box.localMaxX - box.localMinX}
                          height={box.localMaxY - box.localMinY}
                          rx="6"
                          fill={diagnostics?.colliding ? "#fff1f2" : "white"}
                          fillOpacity="0.92"
                          stroke={diagnostics?.colliding ? "#dc2626" : isSelected ? "#0f172a" : "#94a3b8"}
                          strokeDasharray="4 3"
                        />
                      ) : null}
                      {isSelected ? (
                        <rect
                          x={box.localMinX}
                          y={box.localMinY}
                          width={box.localMaxX - box.localMinX}
                          height={box.localMaxY - box.localMinY}
                          rx="6"
                          fill="none"
                          stroke="transparent"
                          strokeWidth="12"
                          pointerEvents="stroke"
                          onMouseDown={(event) => handleLabelRotateMouseDown(event, station.id, node.id, { x: labelCenterX, y: labelCenterY }, labelRotation)}
                          style={{ cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M22 12l-3 3-3-3'/><path d='M2 12l3-3 3 3'/><path d='M19.016 14v-1.95A7.05 7.05 0 0 0 8 6.22'/><path d='M16.016 17.845A7.05 7.05 0 0 1 5 12.015V10'/><path d='M5 10V9'/><path d='M19 15v-1'/></svg>") 12 12, crosshair` }}
                        />
                      ) : null}
                      <text x={labelX} y={labelY} fontSize={getStationKindFontSize(stationKind)} fontFamily={stationKind?.fontFamily ?? DEFAULT_STATION_FONT_FAMILY} fontWeight={stationKind?.fontWeight ?? DEFAULT_STATION_FONT_WEIGHT} fill={diagnostics?.colliding ? "#991b1b" : "#111827"}>
                        {station.name}
                      </text>
                    </g>
                    {isRotating ? (
                      <g pointerEvents="none">
                        <rect x={labelCenterX - rotationBadgeWidth / 2} y={box.minY - 28} width={rotationBadgeWidth} height="20" rx="10" fill="#0f172a" fillOpacity="0.92" />
                        <text x={labelCenterX} y={box.minY - 14} textAnchor="middle" fontSize="11" fontFamily={DEFAULT_STATION_FONT_FAMILY} fontWeight="700" fill="white">
                          {rotationLabel}
                        </text>
                      </g>
                    ) : null}
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

          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
            <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm shadow-sm">{currentStations.length} stations</div>
            <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm shadow-sm">{currentSegments.length} segments</div>
            <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 text-sm shadow-sm">{currentSheet?.name ?? "Sheet"}</div>
          </div>

          {nodeContextMenu ? (
            <NodeContextMenu
              nodeContextMenu={nodeContextMenu}
              nodeContextMenuPosition={nodeContextMenuPosition}
              contextMenuStation={contextMenuStation}
              updateStation={updateStation}
              unassignStation={unassignStation}
              configStationKinds={configStationKinds}
              stationKindShapeGlyph={stationKindShapeGlyph}
              laneDisplayNameById={laneDisplayNameById}
              pendingSegmentStart={pendingSegmentStart}
              completeSegmentAtNode={completeSegmentAtNode}
              cancelPendingSegment={cancelPendingSegment}
              startSegmentFromNode={startSegmentFromNode}
              nodeAssignmentQuery={nodeAssignmentQuery}
              setNodeAssignmentQuery={setNodeAssignmentQuery}
              stationAssignmentResults={stationAssignmentResults}
              assignStationToNode={assignStationToNode}
              stationKindsById={stationKindsById}
              nodeAssignmentName={nodeAssignmentName}
              setNodeAssignmentName={setNodeAssignmentName}
              nodeAssignmentKindId={nodeAssignmentKindId}
              setNodeAssignmentKindId={setNodeAssignmentKindId}
              createStationAtNode={createStationAtNode}
              deleteNodes={deleteNodes}
            />
          ) : null}

          {segmentContextMenu && contextMenuSegment ? (
            <SegmentContextMenu
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
            />
          ) : null}

          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center"
            onMouseEnter={() => setSheetRailOpen(true)}
            onMouseLeave={() => {
              if (renamingSheetId === null) {
                setSheetRailOpen(false);
              }
            }}
          >
            <div className="pointer-events-auto relative h-[68%]">
              <div
                className={`absolute left-0 top-1/2 flex -translate-y-1/2 transition-transform duration-200 ${
                  showSheetRail ? "translate-x-0" : "-translate-x-[228px]"
                }`}
              >
                <div className="flex w-[248px] items-stretch">
                  <div className="w-[228px] rounded-r-2xl border border-l-0 border-slate-200 bg-white/96 p-3 shadow-lg backdrop-blur">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-ink">Sheets</div>
                      <button
                        type="button"
                        className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        onClick={addSheet}
                      >
                        +
                      </button>
                    </div>
                    <div className="max-h-[52vh] space-y-1 overflow-auto pr-1">
                      {sheets.map((sheet) => {
                        const active = currentSheetId === sheet.id;
                        const renaming = renamingSheetId === sheet.id;

                        return (
                          <div
                            key={sheet.id}
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              active ? "border-slate-300 bg-slate-100 text-ink" : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {renaming ? (
                                <Input
                                  autoFocus
                                  value={sheetNameDraft}
                                  onChange={(event) => setSheetNameDraft(event.target.value)}
                                  onBlur={commitSheetRename}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitSheetRename();
                                    if (event.key === "Escape") setSheetNameDraft("");
                                  }}
                                  className="h-8 min-w-0 flex-1 px-2 py-1 text-sm"
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 truncate text-left font-medium"
                                  onClick={() => setCurrentSheetId(sheet.id)}
                                  onDoubleClick={() => startRenamingSheet(sheet.id, sheet.name)}
                                >
                                  {sheet.name}
                                </button>
                              )}
                              {active && sheets.length > 1 ? (
                                <button type="button" className="rounded-full px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200" onClick={deleteCurrentSheet}>
                                  ×
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="ml-1 flex items-center">
                    <button
                      type="button"
                      className="rounded-r-xl border border-l-0 border-slate-200 bg-white/96 px-2 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur [writing-mode:vertical-rl]"
                      onClick={() => setSheetRailOpen((current) => !current)}
                    >
                      Sheets
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
