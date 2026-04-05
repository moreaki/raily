import { Fragment, useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { Line, LineRun, MapNode, Segment, Station, StationKind } from "@/entities/railway-map/model/types";
import { lineStrokeDasharray } from "@/entities/railway-map/model/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type SelectedNodeLane = {
  id: string;
  lineId: string | null;
  gridColumn?: number;
  gridRow?: number;
  cellLabel: string;
  effectiveGridColumn: number;
  effectiveGridRow: number;
  isAutoPlaced: boolean;
  lineNames: Array<string | undefined>;
  lineColors: string[];
  segmentIds: string[];
  connections: Array<{ side: "left" | "right" | "up" | "down"; color: string | null }>;
};

type LabelDiagnostic = {
  overlapsLabel: boolean;
  overlapsSegment: boolean;
  colliding: boolean;
};

type RailwayMapInspectorProps = {
  hasNodeOrStationSelection: boolean;
  hasSegmentOrLineSelection: boolean;
  newStationName: string;
  newStationKindId: string;
  setNewStationName: (value: string) => void;
  setNewStationKindId: (value: string) => void;
  addStation: () => void;
  visibleStations: Station[];
  selectedStationId: string;
  stationKinds: StationKind[];
  stationKindsById: Map<string, StationKind>;
  stationKindShapeGlyph: (shape: StationKind["shape"]) => string;
  setSelectedNodeId: (value: string) => void;
  setSelectedNodeIds: (value: string[]) => void;
  setSelectedStationId: (value: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteStation: (stationId: string) => void;
  selectedNode: MapNode | null;
  updateNode: (patch: Partial<MapNode>) => void;
  selectedNodeLanes: SelectedNodeLane[];
  selectedNodeLaneAxis: "horizontal" | "vertical";
  nodeGroupCellWidth: number;
  nodeGroupCellHeight: number;
  selectedNodeMarkerLaneId: string | null;
  updateSelectedNodeLaneCell: (laneId: string, value: string) => void;
  updateSelectedNodeLaneLine: (laneId: string, lineId: string) => void;
  selectNodeLane: (laneId: string) => void;
  insertNodeGroupColumn: (column: number) => void;
  insertNodeGroupRow: (row: number) => void;
  removeNodeGroupColumn: (column: number) => void;
  removeNodeGroupRow: (row: number) => void;
  selectedNodeStations: Station[];
  attachStationToSelectedNode: () => void;
  addNodeToGroup: (nodeId: string) => void;
  removableNodeLaneIds: Set<string>;
  removeSelectedNodeFromGroup: (laneId: string) => void;
  canRemoveSelectedTrackPoint: boolean;
  removeSelectedTrackPoint: () => void;
  unassignStation: (stationId: string) => void;
  selectedStation: Station | null;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  labelDiagnostics: Map<string, LabelDiagnostic>;
  selectedSegment: Segment | null;
  selectedLine: Line | null;
  selectedLineId: string;
  lines: Line[];
  selectedLineRun: LineRun | null;
  segmentsById: Map<string, Segment>;
  handleSelectedLineInspectorChange: (lineId: string) => void;
  insertTrackPointOnSegment: (segmentId: string) => void;
  makeSegmentStraight: (segmentId: string) => void;
  makeSegmentOrthogonal: (segmentId: string) => void;
  makeSegmentPolyline: (segmentId: string) => void;
  addSegmentPolylinePoint: (segmentId: string) => void;
  selectedSegmentPolylinePoint: { segmentId: string; pointIndex: number } | null;
  removeSegmentPolylinePoint: (segmentId: string, pointIndex: number) => void;
  segmentFromPortOptions: Array<{ value: string; label: string }>;
  segmentToPortOptions: Array<{ value: string; label: string }>;
  updateSelectedSegmentPort: (end: "from" | "to", laneId: string) => void;
};

function toColumnLabel(value: number) {
  let current = value;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result || "A";
}

export function RailwayMapInspector({
  hasNodeOrStationSelection,
  hasSegmentOrLineSelection,
  newStationName,
  newStationKindId,
  setNewStationName,
  setNewStationKindId,
  addStation,
  visibleStations,
  selectedStationId,
  stationKinds,
  stationKindsById,
  stationKindShapeGlyph,
  setSelectedNodeId,
  setSelectedNodeIds,
  setSelectedStationId,
  deleteNode,
  deleteStation,
  selectedNode,
  updateNode,
  selectedNodeLanes,
  selectedNodeLaneAxis,
  nodeGroupCellWidth,
  nodeGroupCellHeight,
  selectedNodeMarkerLaneId,
  updateSelectedNodeLaneCell,
  updateSelectedNodeLaneLine,
  selectNodeLane,
  insertNodeGroupColumn,
  insertNodeGroupRow,
  removeNodeGroupColumn,
  removeNodeGroupRow,
  selectedNodeStations,
  attachStationToSelectedNode,
  addNodeToGroup,
  removableNodeLaneIds,
  removeSelectedNodeFromGroup,
  canRemoveSelectedTrackPoint,
  removeSelectedTrackPoint,
  unassignStation,
  selectedStation,
  updateStation,
  labelDiagnostics,
  selectedSegment,
  selectedLine,
  selectedLineId,
  lines,
  selectedLineRun,
  segmentsById,
  handleSelectedLineInspectorChange,
  insertTrackPointOnSegment,
  makeSegmentStraight,
  makeSegmentOrthogonal,
  makeSegmentPolyline,
  addSegmentPolylinePoint,
  selectedSegmentPolylinePoint,
  removeSegmentPolylinePoint,
  segmentFromPortOptions,
  segmentToPortOptions,
  updateSelectedSegmentPort,
}: RailwayMapInspectorProps) {
  const [laneCellDrafts, setLaneCellDrafts] = useState<Record<string, string>>({});
  const [activeLaneId, setActiveLaneId] = useState<string | null>(selectedNodeMarkerLaneId);
  const [dragLaneId, setDragLaneId] = useState<string | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [dragOverEdge, setDragOverEdge] = useState<"left" | "right" | "top" | "bottom" | null>(null);
  const [lastExpandedEdge, setLastExpandedEdge] = useState<string | null>(null);
  const [flashColumn, setFlashColumn] = useState<number | null>(null);
  const [flashRow, setFlashRow] = useState<number | null>(null);
  useEffect(() => {
    setLaneCellDrafts(Object.fromEntries(selectedNodeLanes.map((lane) => [lane.id, lane.cellLabel])));
  }, [selectedNodeLanes]);
  useEffect(() => {
    setActiveLaneId(selectedNodeMarkerLaneId ?? selectedNodeLanes[0]?.id ?? null);
  }, [selectedNodeLanes, selectedNodeMarkerLaneId]);
  useEffect(() => {
    if (!dragLaneId) {
      setLastExpandedEdge(null);
      return;
    }
    function handleWindowDragOver(event: DragEvent) {
      setDragPointer({ x: event.clientX, y: event.clientY });
    }
    function handleWindowDragEnd() {
      setDragLaneId(null);
      setDragOverCellKey(null);
      setDragPointer(null);
      setDragOverEdge(null);
      setLastExpandedEdge(null);
    }
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragend", handleWindowDragEnd);
    window.addEventListener("drop", handleWindowDragEnd);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragend", handleWindowDragEnd);
      window.removeEventListener("drop", handleWindowDragEnd);
    };
  }, [dragLaneId]);
  useEffect(() => {
    if (flashColumn == null && flashRow == null) return;
    const timeout = window.setTimeout(() => {
      setFlashColumn(null);
      setFlashRow(null);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [flashColumn, flashRow]);
  const previewBounds = useMemo(() => {
    const columns = selectedNodeLanes.map((lane) => lane.effectiveGridColumn);
    const rows = selectedNodeLanes.map((lane) => lane.effectiveGridRow);
    return {
      minColumn: columns.length > 0 ? Math.min(...columns) : 1,
      maxColumn: columns.length > 0 ? Math.max(...columns) : Math.max(1, selectedNodeLanes.length),
      minRow: rows.length > 0 ? Math.min(...rows) : 1,
      maxRow: rows.length > 0 ? Math.max(...rows) : Math.max(1, selectedNodeLanes.length),
    };
  }, [selectedNodeLanes]);
  const editorGrid = useMemo(() => {
    const minColumn = Math.max(1, previewBounds.minColumn);
    const maxColumn = Math.max(minColumn, previewBounds.maxColumn);
    const minRow = Math.max(1, previewBounds.minRow);
    const maxRow = Math.max(minRow, previewBounds.maxRow);
    return {
      columns: Array.from({ length: maxColumn - minColumn + 1 }, (_, index) => minColumn + index),
      rows: Array.from({ length: maxRow - minRow + 1 }, (_, index) => minRow + index),
      byCell: new Map(
        selectedNodeLanes.map((lane) => [`${lane.effectiveGridColumn}:${lane.effectiveGridRow}`, lane] as const),
      ),
    };
  }, [previewBounds, selectedNodeLanes]);
  const dragLane = selectedNodeLanes.find((lane) => lane.id === dragLaneId) ?? null;
  const dragLaneColumn = dragLane?.effectiveGridColumn ?? previewBounds.minColumn;
  const dragLaneRow = dragLane?.effectiveGridRow ?? previewBounds.minRow;
  const sortedLines = [...lines].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return left.id.localeCompare(right.id);
  });

  return (
    <>
      {!hasNodeOrStationSelection && !hasSegmentOrLineSelection ? (
        <>
          <section className="space-y-3">
            <div className="text-sm font-semibold text-ink">Quick Add</div>
            <div className="flex gap-2">
              <Input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="Station name" />
              <select
                value={newStationKindId}
                onChange={(event) => setNewStationKindId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {stationKinds.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name} {stationKindShapeGlyph(kind.shape)}
                  </option>
                ))}
              </select>
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
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    selectedStationId === station.id
                      ? "border border-slate-200 bg-white text-ink shadow-sm"
                      : "border border-transparent bg-white text-ink hover:bg-slate-100"
                  }`}
                >
                  {selectedStationId === station.id ? <span className="absolute bottom-2 left-1 top-2 w-1 rounded-full bg-sky-400" /> : null}
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
                      selectedStationId === station.id ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => (station.nodeId ? deleteNode(station.nodeId) : deleteStation(station.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {hasNodeOrStationSelection ? (
        <>
          <section className="space-y-3">
            <div className="text-sm font-semibold text-ink">Selected Node</div>
            {selectedNode ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={selectedNode.x} onChange={(event) => updateNode({ x: Number(event.target.value) })} />
                  <Input type="number" value={selectedNode.y} onChange={(event) => updateNode({ y: Number(event.target.value) })} />
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedNode.showGroupOutline ?? selectedNodeLanes.length > 1}
                    onChange={(event) => updateNode({ showGroupOutline: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Show nodegroup as hub outline</span>
                </label>
                {(selectedNode.showGroupOutline ?? selectedNodeLanes.length > 1) && selectedNodeLanes.length > 1 ? (
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Outline shape</span>
                    <select
                      value={selectedNode.groupOutlineMode ?? "box"}
                      onChange={(event) => updateNode({ groupOutlineMode: event.target.value as "box" | "cells" })}
                      className="h-9 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="box">Bounding box</option>
                      <option value="cells">Follow cells</option>
                    </select>
                  </label>
                ) : null}
                {selectedNodeLanes.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Node Group</div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <svg viewBox="0 0 180 56" className="h-14 w-full" aria-hidden="true">
                        {selectedNodeLanes.map((lane, index) => {
                          const column = lane.effectiveGridColumn;
                          const row = lane.effectiveGridRow;
                          const centerColumn = (previewBounds.minColumn + previewBounds.maxColumn) / 2;
                          const centerRow = (previewBounds.minRow + previewBounds.maxRow) / 2;
                          const cx = 90 + (column - centerColumn) * nodeGroupCellWidth;
                          const cy = 28 + (row - centerRow) * nodeGroupCellHeight;
                          const stroke = lane.lineColors[0] ?? "#64748b";
                          const isActive = selectedNodeMarkerLaneId === lane.id;
                          return (
                            <g key={lane.id}>
                              <circle cx={cx} cy={cy} r={isActive ? 9 : 7} fill="white" stroke={stroke} strokeWidth={isActive ? 4 : 3} />
                              {isActive ? <circle cx={cx} cy={cy} r="13" fill="none" stroke="#0f172a" strokeDasharray="4 3" /> : null}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div className="space-y-2">
                      {selectedNodeLanes.map((lane, index) => (
                        <div
                          key={lane.id}
                          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                            activeLaneId === lane.id ? "bg-sky-50 text-sky-900 ring-1 ring-sky-200" : "bg-slate-50 text-ink"
                          }`}
                          draggable
                          onClick={() => {
                            setActiveLaneId(lane.id);
                            selectNodeLane(lane.id);
                          }}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", lane.id);
                            setDragLaneId(lane.id);
                          }}
                          onDragEnd={() => setDragLaneId(null)}
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 shrink-0 cursor-grab text-slate-400">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 font-medium">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lane.lineColors[0] ?? "#94a3b8" }} />
                                <span>{lane.lineNames.length > 0 ? lane.lineNames.join(", ") : "Unassigned lane"}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                                <Input
                                  value={laneCellDrafts[lane.id] ?? lane.cellLabel}
                                  onChange={(event) => setLaneCellDrafts((current) => ({ ...current, [lane.id]: event.target.value.toUpperCase() }))}
                                  onBlur={() => updateSelectedNodeLaneCell(lane.id, laneCellDrafts[lane.id] ?? lane.cellLabel)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      updateSelectedNodeLaneCell(lane.id, laneCellDrafts[lane.id] ?? lane.cellLabel);
                                    }
                                  }}
                                  placeholder="A1"
                                  className="h-8 w-20 bg-white"
                                />
                                <select
                                  value={lane.lineId ?? ""}
                                  onChange={(event) => updateSelectedNodeLaneLine(lane.id, event.target.value)}
                                  className="h-8 max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <option value="">No line</option>
                                  {sortedLines.map((line) => (
                                    <option key={line.id} value={line.id}>
                                      {line.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-1">
                                  {lane.connections.map((connection, connectionIndex) => (
                                    <span
                                      key={`${lane.id}:connection:${connectionIndex}`}
                                      className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]"
                                      style={{ color: connection.color ?? "#64748b" }}
                                      title={connection.side}
                                    >
                                      {connection.side === "left" ? "←" : connection.side === "right" ? "→" : connection.side === "up" ? "↑" : "↓"}
                                    </span>
                                  ))}
                                </div>
                                {lane.segmentIds.length} segment{lane.segmentIds.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {lane.isAutoPlaced ? `AUTO · ${toColumnLabel(lane.effectiveGridColumn)}${lane.effectiveGridRow}` : lane.cellLabel}
                            </div>
                            {removableNodeLaneIds.has(lane.id) ? (
                              <button
                                type="button"
                                aria-label="Remove node from group"
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeSelectedNodeFromGroup(lane.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Grid Editor</div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Button type="button" variant="outline" className="h-7 px-2" onClick={() => removeNodeGroupColumn(previewBounds.maxColumn)} disabled={previewBounds.maxColumn <= 1}>
                            Col -
                          </Button>
                          <Button type="button" variant="outline" className="h-7 px-2" onClick={() => insertNodeGroupColumn(previewBounds.maxColumn + 1)}>
                            Col +
                          </Button>
                          <Button type="button" variant="outline" className="h-7 px-2" onClick={() => removeNodeGroupRow(previewBounds.maxRow)} disabled={previewBounds.maxRow <= 1}>
                            Row -
                          </Button>
                          <Button type="button" variant="outline" className="h-7 px-2" onClick={() => insertNodeGroupRow(previewBounds.maxRow + 1)}>
                            Row +
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted">Select or drag a port, then place it in a cell. Dropping on another occupied cell swaps them. Expand the grid by dragging across an outer edge.</p>
                      <div className="relative overflow-auto rounded-xl border border-slate-200 bg-white p-3">
                        {dragLane && dragPointer ? (
                          <div
                            className="pointer-events-none fixed z-50 rounded-md border border-sky-200 bg-white/95 px-2 py-1 text-xs font-medium text-sky-900 shadow-sm"
                            style={{ left: dragPointer.x + 14, top: dragPointer.y + 14 }}
                          >
                            {dragLane.lineNames[0] || "Port"} · {dragLane.isAutoPlaced ? `AUTO ${toColumnLabel(dragLane.effectiveGridColumn)}${dragLane.effectiveGridRow}` : dragLane.cellLabel}
                          </div>
                        ) : null}
                        {dragLaneId ? (
                          <>
                            <div
                              className={`absolute inset-y-8 left-1 z-10 flex w-6 items-center justify-center rounded-md border border-dashed text-slate-400 transition ${
                                dragOverEdge === "left" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50/90"
                              }`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDragOverEdge("left");
                                if (lastExpandedEdge === "left") return;
                                insertNodeGroupColumn(editorGrid.columns[0]);
                                setFlashColumn(editorGrid.columns[0]);
                                setLastExpandedEdge("left");
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDragOverEdge((current) => (current === "left" ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedLaneId = event.dataTransfer.getData("text/plain") || dragLaneId;
                                if (!droppedLaneId) return;
                                const newColumn = editorGrid.columns[0];
                                insertNodeGroupColumn(newColumn);
                                updateSelectedNodeLaneCell(droppedLaneId, `${toColumnLabel(newColumn)}${dragLaneRow}`);
                                setFlashColumn(newColumn);
                                setActiveLaneId(droppedLaneId);
                                selectNodeLane(droppedLaneId);
                                setDragLaneId(null);
                                setDragOverEdge(null);
                                setDragOverCellKey(null);
                              }}
                            >
                              ←
                            </div>
                            <div
                              className={`absolute inset-y-8 right-1 z-10 flex w-6 items-center justify-center rounded-md border border-dashed text-slate-400 transition ${
                                dragOverEdge === "right" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50/90"
                              }`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDragOverEdge("right");
                                if (lastExpandedEdge === "right") return;
                                insertNodeGroupColumn(editorGrid.columns[editorGrid.columns.length - 1] + 1);
                                setFlashColumn(editorGrid.columns[editorGrid.columns.length - 1] + 1);
                                setLastExpandedEdge("right");
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDragOverEdge((current) => (current === "right" ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedLaneId = event.dataTransfer.getData("text/plain") || dragLaneId;
                                if (!droppedLaneId) return;
                                const newColumn = editorGrid.columns[editorGrid.columns.length - 1] + 1;
                                insertNodeGroupColumn(newColumn);
                                updateSelectedNodeLaneCell(droppedLaneId, `${toColumnLabel(newColumn)}${dragLaneRow}`);
                                setFlashColumn(newColumn);
                                setActiveLaneId(droppedLaneId);
                                selectNodeLane(droppedLaneId);
                                setDragLaneId(null);
                                setDragOverEdge(null);
                                setDragOverCellKey(null);
                              }}
                            >
                              →
                            </div>
                            <div
                              className={`absolute inset-x-8 top-1 z-10 flex h-6 items-center justify-center rounded-md border border-dashed text-slate-400 transition ${
                                dragOverEdge === "top" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50/90"
                              }`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDragOverEdge("top");
                                if (lastExpandedEdge === "top") return;
                                insertNodeGroupRow(editorGrid.rows[0]);
                                setFlashRow(editorGrid.rows[0]);
                                setLastExpandedEdge("top");
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDragOverEdge((current) => (current === "top" ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedLaneId = event.dataTransfer.getData("text/plain") || dragLaneId;
                                if (!droppedLaneId) return;
                                const newRow = editorGrid.rows[0];
                                insertNodeGroupRow(newRow);
                                updateSelectedNodeLaneCell(droppedLaneId, `${toColumnLabel(dragLaneColumn)}${newRow}`);
                                setFlashRow(newRow);
                                setActiveLaneId(droppedLaneId);
                                selectNodeLane(droppedLaneId);
                                setDragLaneId(null);
                                setDragOverEdge(null);
                                setDragOverCellKey(null);
                              }}
                            >
                              ↑
                            </div>
                            <div
                              className={`absolute inset-x-8 bottom-1 z-10 flex h-6 items-center justify-center rounded-md border border-dashed text-slate-400 transition ${
                                dragOverEdge === "bottom" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50/90"
                              }`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDragOverEdge("bottom");
                                if (lastExpandedEdge === "bottom") return;
                                insertNodeGroupRow(editorGrid.rows[editorGrid.rows.length - 1] + 1);
                                setFlashRow(editorGrid.rows[editorGrid.rows.length - 1] + 1);
                                setLastExpandedEdge("bottom");
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDragOverEdge((current) => (current === "bottom" ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedLaneId = event.dataTransfer.getData("text/plain") || dragLaneId;
                                if (!droppedLaneId) return;
                                const newRow = editorGrid.rows[editorGrid.rows.length - 1] + 1;
                                insertNodeGroupRow(newRow);
                                updateSelectedNodeLaneCell(droppedLaneId, `${toColumnLabel(dragLaneColumn)}${newRow}`);
                                setFlashRow(newRow);
                                setActiveLaneId(droppedLaneId);
                                selectNodeLane(droppedLaneId);
                                setDragLaneId(null);
                                setDragOverEdge(null);
                                setDragOverCellKey(null);
                              }}
                            >
                              ↓
                            </div>
                          </>
                        ) : null}
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: `24px repeat(${editorGrid.columns.length}, minmax(40px, 1fr))`,
                          }}
                        >
                          <div />
                          {editorGrid.columns.map((column) => (
                            <div
                              key={`col:${column}`}
                              className={`text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition ${
                                flashColumn === column ? "rounded bg-sky-100 text-sky-700" : ""
                              }`}
                            >
                              {toColumnLabel(column)}
                            </div>
                          ))}
                          {editorGrid.rows.map((row) => (
                            <Fragment key={`row:${row}`}>
                              <div className={`flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition ${flashRow === row ? "rounded bg-sky-100 text-sky-700" : ""}`}>
                                {row}
                              </div>
                              {editorGrid.columns.map((column) => {
                                const cellLane = editorGrid.byCell.get(`${column}:${row}`) ?? null;
                                const isActive = cellLane?.id === activeLaneId;
                                const isDraggingSource = cellLane?.id === dragLaneId;
                                const targetCellLabel = `${toColumnLabel(column)}${row}`;
                                const cellKey = `${column}:${row}`;
                                const isDropTarget = dragOverCellKey === cellKey;
                                return (
                                  <button
                                    key={`${column}:${row}`}
                                    type="button"
                                    draggable={!!cellLane}
                                    className={`relative h-12 rounded-lg border text-xs transition ${
                                      flashColumn === column || flashRow === row
                                        ? "ring-1 ring-sky-200"
                                        : ""
                                    } ${
                                      cellLane
                                        ? isActive
                                          ? "border-sky-400 bg-sky-50 shadow-sm"
                                          : isDraggingSource
                                            ? "border-sky-300 bg-sky-50/60 opacity-70 ring-2 ring-sky-200"
                                            : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                                        : activeLaneId
                                          ? isDropTarget
                                            ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
                                            : "border-dashed border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/40"
                                          : "border-dashed border-slate-200 bg-white"
                                    }`}
                                    onClick={() => {
                                      if (cellLane) {
                                        if (activeLaneId && activeLaneId !== cellLane.id) {
                                          updateSelectedNodeLaneCell(activeLaneId, targetCellLabel);
                                          return;
                                        }
                                        setActiveLaneId(cellLane.id);
                                        selectNodeLane(cellLane.id);
                                        return;
                                      }
                                      if (!activeLaneId) return;
                                      updateSelectedNodeLaneCell(activeLaneId, targetCellLabel);
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDragEnter={(event) => {
                                      event.preventDefault();
                                      setDragOverCellKey(cellKey);
                                    }}
                                    onDragLeave={() => {
                                      setDragOverCellKey((current) => (current === cellKey ? null : current));
                                    }}
                                    onDragStart={(event) => {
                                      if (!cellLane) return;
                                      event.dataTransfer.setData("text/plain", cellLane.id);
                                      setDragLaneId(cellLane.id);
                                      setDragOverCellKey(null);
                                      setActiveLaneId(cellLane.id);
                                      selectNodeLane(cellLane.id);
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const droppedLaneId = event.dataTransfer.getData("text/plain") || dragLaneId;
                                      if (!droppedLaneId) return;
                                      if (cellLane && cellLane.id === droppedLaneId) return;
                                      updateSelectedNodeLaneCell(droppedLaneId, targetCellLabel);
                                      setActiveLaneId(droppedLaneId);
                                      selectNodeLane(droppedLaneId);
                                      setDragLaneId(null);
                                      setDragOverCellKey(null);
                                    }}
                                    onDragEnd={() => {
                                      setDragLaneId(null);
                                      setDragOverCellKey(null);
                                      setDragOverEdge(null);
                                    }}
                                  >
                                  {cellLane ? (
                                      <div className="flex h-full flex-col items-center justify-center gap-1 px-1">
                                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cellLane.lineColors[0] ?? "#94a3b8" }} />
                                        <span className="truncate font-medium text-ink">{cellLane.lineNames[0] || "Port"}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300">{activeLaneId ? "Place" : ""}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedNodeStations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink">This track point has no station yet.</p>
                      <p className="text-xs text-muted">Attach a station here to give it a name, kind, and label.</p>
                      <div className="flex gap-2">
                        <Input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="Station name" />
                        <Button onClick={attachStationToSelectedNode}>
                          <Plus className="h-4 w-4" />
                          Attach station
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedNodeStations.length === 0 && canRemoveSelectedTrackPoint ? (
                  <Button type="button" variant="outline" onClick={removeSelectedTrackPoint}>
                    Remove track point
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => addNodeToGroup(selectedNode.id)}>
                  <Plus className="h-4 w-4" />
                  Add node to group
                </Button>
                {activeLaneId && removableNodeLaneIds.has(activeLaneId) ? (
                  <Button type="button" variant="outline" onClick={() => removeSelectedNodeFromGroup(activeLaneId)}>
                    Remove node from group
                  </Button>
                ) : null}
                <div className="space-y-2">
                  {selectedNodeStations.map((station) => (
                    <div key={station.id} className="rounded-xl bg-white px-3 py-2 text-sm text-ink">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedStationId(station.id)}>
                          <div className="truncate font-medium">{station.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge>{stationKindsById.get(station.kindId)?.name ?? "Unknown"}</Badge>
                            <Badge>{station.nodeId ? "Assigned" : "Unassigned"}</Badge>
                          </div>
                        </button>
                        <Button
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            setSelectedStationId(station.id);
                            unassignStation(station.id);
                          }}
                        >
                          Unassign
                        </Button>
                      </div>
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
            <div className="text-sm font-semibold text-ink">Selected Station</div>
            {selectedStation ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <Input value={selectedStation.name} onChange={(event) => updateStation(selectedStation.id, { name: event.target.value })} placeholder="Station name" />
                <select
                  value={selectedStation.kindId}
                  onChange={(event) => updateStation(selectedStation.id, { kindId: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                >
                  {stationKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.name} {stationKindShapeGlyph(kind.shape)}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <Badge>{stationKindsById.get(selectedStation.kindId)?.name ?? "Unknown"}</Badge>
                  <Badge>{selectedStation.nodeId ? "Assigned" : "Unassigned"}</Badge>
                </div>
                {selectedStationId === selectedStation.id && labelDiagnostics.get(selectedStation.id)?.colliding ? (
                  <p className="text-xs font-medium text-rose-700">
                    Label collision detected with
                    {labelDiagnostics.get(selectedStation.id)?.overlapsLabel && labelDiagnostics.get(selectedStation.id)?.overlapsSegment
                      ? " another label and a segment."
                      : labelDiagnostics.get(selectedStation.id)?.overlapsSegment
                        ? " a segment."
                        : " another label."}
                  </p>
                ) : null}
                {!selectedStation.nodeId ? (
                  <p className="text-xs text-muted">This station is currently unassigned. Use a track point context menu to assign it to the map.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">Select a station from the list or canvas.</p>
            )}
          </section>
        </>
      ) : null}

      {hasSegmentOrLineSelection ? (
        <>
          <section className="space-y-3">
            <div className="text-sm font-semibold text-ink">Selected Segment</div>
            {selectedSegment ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-medium text-ink">{selectedSegment.id}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedSegment.fromNodeId}</Badge>
                  <Badge>to</Badge>
                  <Badge>{selectedSegment.toNodeId}</Badge>
                  <Badge>{selectedSegment.geometry.kind}</Badge>
                  {selectedSegmentPolylinePoint?.segmentId === selectedSegment.id ? <Badge>Bend {selectedSegmentPolylinePoint.pointIndex + 1}</Badge> : null}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">From port</span>
                    <select
                      value={selectedSegment.fromLaneId ?? ""}
                      onChange={(event) => updateSelectedSegmentPort("from", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                      {segmentFromPortOptions.map((option) => (
                        <option key={option.value || "__auto"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">To port</span>
                    <select
                      value={selectedSegment.toLaneId ?? ""}
                      onChange={(event) => updateSelectedSegmentPort("to", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                      {segmentToPortOptions.map((option) => (
                        <option key={option.value || "__auto"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => makeSegmentStraight(selectedSegment.id)}>
                    Straight
                  </Button>
                  <Button type="button" variant="outline" onClick={() => makeSegmentOrthogonal(selectedSegment.id)}>
                    Orthogonal
                  </Button>
                  <Button type="button" variant="outline" onClick={() => makeSegmentPolyline(selectedSegment.id)}>
                    Polyline
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addSegmentPolylinePoint(selectedSegment.id)}>
                    Add bend point
                  </Button>
                  {selectedSegmentPolylinePoint?.segmentId === selectedSegment.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeSegmentPolylinePoint(selectedSegment.id, selectedSegmentPolylinePoint.pointIndex)}
                    >
                      Remove bend point
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => insertTrackPointOnSegment(selectedSegment.id)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Insert track point
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Select a segment on the canvas.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold text-ink">Selected Line</div>
            {selectedLine ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <select
                  value={selectedLineId}
                  onChange={(event) => handleSelectedLineInspectorChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  style={{ color: selectedLine.color }}
                >
                  {sortedLines.map((line) => (
                    <option key={line.id} value={line.id} style={{ color: line.color }}>
                      {line.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: selectedLine.color }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{selectedLine.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge>{selectedLine.strokeStyle}</Badge>
                      <Badge>{selectedLine.strokeWidth}px</Badge>
                      <Badge>
                        {selectedLineRun?.segmentIds.filter((segmentId) => segmentsById.has(segmentId)).length ?? 0} segment
                        {(selectedLineRun?.segmentIds.filter((segmentId) => segmentsById.has(segmentId)).length ?? 0) === 1 ? "" : "s"} on this sheet
                      </Badge>
                    </div>
                  </div>
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
                <p className="text-xs text-muted">Management contains the full line editing controls and segment assignment helper.</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Click a line or a segment on the canvas.</p>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
