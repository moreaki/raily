import type { MouseEvent, WheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Grip, Link2, Plus, Trash2, Upload } from "lucide-react";
import { INITIAL_MAP, LINE_PRESETS } from "@/entities/railway-map/model/constants";
import { railwayMapSchema } from "@/entities/railway-map/model/schema";
import type { Line, LineRun, MapNode, RailwayMap, Station, StationKind, StationKindShape } from "@/entities/railway-map/model/types";
import {
  buildLineRunPath,
  buildSegmentPath,
  createDefaultLine,
  createDefaultNode,
  createDefaultStation,
  createLineRunId,
  createStationKindId,
  createStraightSegment,
} from "@/entities/railway-map/model/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const STORAGE_KEY = "raily:editor-map";
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

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

function renderNodeSymbol(shape: StationKindShape, node: MapNode, isSelected: boolean) {
  return (
    <>
      {shape === "interchange" ? (
        <rect x={node.x - 8} y={node.y - 8} width="16" height="16" rx="3" fill="white" stroke="#111827" strokeWidth="3" />
      ) : shape === "terminal" ? (
        <rect x={node.x - 10} y={node.y - 6} width="20" height="12" rx="4" fill="white" stroke="#111827" strokeWidth="3" />
      ) : (
        <circle cx={node.x} cy={node.y} r="6" fill="white" stroke="#111827" strokeWidth="3" />
      )}
      {isSelected ? <circle cx={node.x} cy={node.y} r="14" fill="none" stroke="#0f172a" strokeDasharray="4 3" /> : null}
    </>
  );
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RailwayMapEditor() {
  const initialMapRef = useRef<RailwayMap | null>(null);
  if (!initialMapRef.current) {
    initialMapRef.current = loadStoredMap();
  }
  const initialMap = initialMapRef.current;

  const [map, setMap] = useState<RailwayMap>(initialMap);
  const [selectedNodeId, setSelectedNodeId] = useState(initialMap.nodes[0]?.id ?? "");
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialMap.segments[0]?.id ?? "");
  const [selectedLineId, setSelectedLineId] = useState(initialMap.lines[0]?.id ?? "");
  const [selectedStationKindId, setSelectedStationKindId] = useState(initialMap.stationKinds[0]?.id ?? "");
  const [newStationName, setNewStationName] = useState("");
  const [newStationKindName, setNewStationKindName] = useState("");
  const [newStationKindShape, setNewStationKindShape] = useState<StationKindShape>("circle");
  const [mode, setMode] = useState<"move" | "segment" | "assign">("move");
  const [sidePanel, setSidePanel] = useState<"closed" | "edit" | "manage">("edit");
  const [zoom, setZoom] = useState(1);
  const [viewportCenter, setViewportCenter] = useState({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const [showGrid, setShowGrid] = useState(false);
  const [gridStepX, setGridStepX] = useState(80);
  const [gridStepY, setGridStepY] = useState(80);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [pendingSegmentStartNodeId, setPendingSegmentStartNodeId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(JSON.stringify(initialMap, null, 2));
  const [errorMessage, setErrorMessage] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const selectedNode = map.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedSegment = map.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedLine = map.lines.find((line) => line.id === selectedLineId) ?? null;
  const selectedStationKind = map.stationKinds.find((kind) => kind.id === selectedStationKindId) ?? null;

  const nodesById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);
  const segmentsById = useMemo(() => new Map(map.segments.map((segment) => [segment.id, segment])), [map.segments]);
  const linesById = useMemo(() => new Map(map.lines.map((line) => [line.id, line])), [map.lines]);
  const stationKindsById = useMemo(() => new Map(map.stationKinds.map((kind) => [kind.id, kind])), [map.stationKinds]);
  const stationsByNodeId = useMemo(() => {
    const next = new Map<string, Station[]>();

    for (const station of map.stations) {
      const current = next.get(station.nodeId) ?? [];
      current.push(station);
      next.set(station.nodeId, current);
    }

    return next;
  }, [map.stations]);
  const selectedLineRun = useMemo(
    () => map.lineRuns.find((lineRun) => lineRun.lineId === selectedLineId) ?? null,
    [map.lineRuns, selectedLineId],
  );
  const viewBoxDimensions = useMemo(() => {
    const width = CANVAS_WIDTH / zoom;
    const height = CANVAS_HEIGHT / zoom;
    return { width, height };
  }, [zoom]);
  const viewBox = useMemo(() => {
    const { width, height } = viewBoxDimensions;
    const minCenterX = width / 2;
    const maxCenterX = CANVAS_WIDTH - width / 2;
    const minCenterY = height / 2;
    const maxCenterY = CANVAS_HEIGHT - height / 2;
    const centerX = clamp(viewportCenter.x, minCenterX, maxCenterX);
    const centerY = clamp(viewportCenter.y, minCenterY, maxCenterY);
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

    const safeStepX = Math.max(8, gridStepX);
    const safeStepY = Math.max(8, gridStepY);
    const vertical: number[] = [];
    const horizontal: number[] = [];

    for (let x = safeStepX; x < CANVAS_WIDTH; x += safeStepX) {
      vertical.push(x);
    }

    for (let y = safeStepY; y < CANVAS_HEIGHT; y += safeStepY) {
      horizontal.push(y);
    }

    return { vertical, horizontal };
  }, [gridStepX, gridStepY, showGrid]);

  useEffect(() => {
    setJsonText(JSON.stringify(map, null, 2));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  }, [map]);

  useEffect(() => {
    if (!selectedNode || !nodesById.has(selectedNode.id)) {
      setSelectedNodeId(map.nodes[0]?.id ?? "");
    }
  }, [map.nodes, nodesById, selectedNode]);

  useEffect(() => {
    if (!selectedLine || !map.lines.some((line) => line.id === selectedLine.id)) {
      setSelectedLineId(map.lines[0]?.id ?? "");
    }
  }, [map.lines, selectedLine]);

  useEffect(() => {
    if (!selectedSegment || !map.segments.some((segment) => segment.id === selectedSegment.id)) {
      setSelectedSegmentId(map.segments[0]?.id ?? "");
    }
  }, [map.segments, selectedSegment]);

  useEffect(() => {
    if (!selectedStationKind || !map.stationKinds.some((kind) => kind.id === selectedStationKind.id)) {
      setSelectedStationKindId(map.stationKinds[0]?.id ?? "");
    }
  }, [map.stationKinds, selectedStationKind]);

  useEffect(() => {
    setViewportCenter({ x: viewBox.centerX, y: viewBox.centerY });
  }, [viewBox.centerX, viewBox.centerY]);

  function updateMap(updater: (current: RailwayMap) => RailwayMap) {
    setMap((current) => updater(current));
    setErrorMessage("");
  }

  function addStation() {
    updateMap((current) => {
      const node = createDefaultNode(current, "station");
      const station = createDefaultStation(current, node.id, newStationName);
      return {
        ...current,
        nodes: [...current.nodes, node],
        stations: [...current.stations, station],
      };
    });
    setNewStationName("");
  }

  function addJunction() {
    updateMap((current) => ({
      ...current,
      nodes: [...current.nodes, createDefaultNode(current, "junction")],
    }));
  }

  function addStationKind() {
    const stationKind: StationKind = {
      id: createStationKindId(),
      name: newStationKindName.trim() || `Kind ${map.stationKinds.length + 1}`,
      shape: newStationKindShape,
    };

    updateMap((current) => ({
      ...current,
      stationKinds: [...current.stationKinds, stationKind],
    }));
    setSelectedStationKindId(stationKind.id);
    setNewStationKindName("");
    setNewStationKindShape("circle");
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
    if (!pendingSegmentStartNodeId || pendingSegmentStartNodeId === nextNodeId) {
      setPendingSegmentStartNodeId(nextNodeId);
      return;
    }

    const existingSegment = map.segments.find(
      (segment) =>
        (segment.fromNodeId === pendingSegmentStartNodeId && segment.toNodeId === nextNodeId) ||
        (segment.fromNodeId === nextNodeId && segment.toNodeId === pendingSegmentStartNodeId),
    );

    if (existingSegment) {
      setSelectedSegmentId(existingSegment.id);
      setPendingSegmentStartNodeId(null);
      return;
    }

    const segment = createStraightSegment(pendingSegmentStartNodeId, nextNodeId);
    updateMap((current) => ({
      ...current,
      segments: [...current.segments, segment],
    }));
    setSelectedSegmentId(segment.id);
    setPendingSegmentStartNodeId(null);
  }

  function handleNodeMouseDown(nodeId: string) {
    setSidePanel("edit");
    if (mode === "segment") {
      setSelectedNodeId(nodeId);
      createSegmentFromPendingNode(nodeId);
      return;
    }

    if (mode !== "move") return;
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
  }

  function handleSegmentMouseDown(segmentId: string) {
    setSidePanel("edit");
    setSelectedSegmentId(segmentId);

    if (mode === "assign") {
      toggleSegmentOnSelectedLine(segmentId);
    }
  }

  function handleSvgMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (!draggingNodeId || !svgRef.current) return;
    const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!svgPoint) return;
    const x = Math.round(svgPoint.x);
    const y = Math.round(svgPoint.y);

    updateMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === draggingNodeId ? { ...node, x, y } : node)),
      stations: current.stations.map((station) => {
        if (station.nodeId !== draggingNodeId || !station.label) return station;
        const draggedNode = current.nodes.find((node) => node.id === draggingNodeId);
        if (!draggedNode) return station;
        return {
          ...station,
          label: {
            ...station.label,
            x: station.label.x + (x - draggedNode.x),
            y: station.label.y + (y - draggedNode.y),
          },
        };
      }),
    }));
  }

  function handleSvgMouseUp() {
    setDraggingNodeId(null);
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
    const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    const focusPoint = svgPoint ? { x: svgPoint.x, y: svgPoint.y } : undefined;
    const nextZoom = event.deltaY < 0 ? zoom * 1.1 : zoom / 1.1;
    applyZoom(nextZoom, focusPoint);
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
      setMap(parsed);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not import the map JSON.");
    }
  }

  const selectedNodeStations = selectedNode ? stationsByNodeId.get(selectedNode.id) ?? [] : [];

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
            <Button variant={mode === "move" ? "default" : "outline"} onClick={() => setMode("move")}>
              <Grip className="h-4 w-4" />
              Move
            </Button>
            <Button variant={mode === "segment" ? "default" : "outline"} onClick={() => setMode("segment")}>
              <Link2 className="h-4 w-4" />
              Segment
            </Button>
            <Button variant={mode === "assign" ? "default" : "outline"} onClick={() => setMode("assign")}>
              <Link2 className="h-4 w-4" />
              Assign
            </Button>
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
                    {mode === "move" ? "Move nodes" : mode === "segment" ? "Draw segments" : "Assign segments to the selected line"}
                  </div>
                  {mode === "segment" ? (
                    <div className="pointer-events-auto rounded-2xl border border-sky-200 bg-sky-50/95 px-3 py-2 text-xs text-sky-800 shadow-sm">
                      Click one node, then another.
                      {pendingSegmentStartNodeId ? ` Start node: ${pendingSegmentStartNodeId}` : ""}
                    </div>
                  ) : null}
                  <div className="pointer-events-auto ml-auto flex gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm backdrop-blur">
                      <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom / 1.2)}>
                        -
                      </button>
                      <span className="min-w-[3.5rem] text-center text-xs font-semibold text-ink">{Math.round(zoom * 100)}%</span>
                      <button type="button" className="font-semibold text-ink" onClick={() => applyZoom(zoom * 1.2)}>
                        +
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-muted"
                        onClick={() => {
                          setZoom(1);
                          setViewportCenter({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
                        }}
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
                        onChange={(event) => setGridStepX(Math.max(8, Number(event.target.value) || 8))}
                        className="h-8 w-20 px-2 py-1 text-xs"
                      />
                      <Input
                        type="number"
                        value={gridStepY}
                        onChange={(event) => setGridStepY(Math.max(8, Number(event.target.value) || 8))}
                        className="h-8 w-20 px-2 py-1 text-xs"
                      />
                    </div>
                    <Button variant="outline" className="bg-white/90 backdrop-blur" onClick={addJunction}>
                      <Plus className="h-4 w-4" />
                      Junction
                    </Button>
                    <Button variant="outline" className="bg-white/90 backdrop-blur" onClick={addStation}>
                      <Plus className="h-4 w-4" />
                      Station
                    </Button>
                  </div>
                </div>

                <div className="h-[78vh] overflow-auto">
                  <svg
                    ref={svgRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    className="h-full w-full"
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                    onWheel={handleSvgWheel}
                  >
                    <rect x="0" y="0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="white" />

                    {showGrid ? (
                      <g pointerEvents="none">
                        {gridLines.vertical.map((x) => (
                          <line key={`grid-x-${x}`} x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT} stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="1" />
                        ))}
                        {gridLines.horizontal.map((y) => (
                          <line key={`grid-y-${y}`} x1={0} y1={y} x2={CANVAS_WIDTH} y2={y} stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="1" />
                        ))}
                      </g>
                    ) : null}

                    {map.segments.map((segment) => (
                      <path
                        key={segment.id}
                        d={buildSegmentPath(segment, nodesById)}
                        fill="none"
                        stroke={selectedSegmentId === segment.id ? "#94a3b8" : "#dbe4ee"}
                        strokeWidth={selectedSegmentId === segment.id ? "22" : "18"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        onMouseDown={() => handleSegmentMouseDown(segment.id)}
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
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}

                    {map.nodes.map((node) => {
                      const stations = stationsByNodeId.get(node.id) ?? [];
                      const isSelected = selectedNodeId === node.id;
                      const primaryStation = stations[0];
                      const shape = primaryStation ? stationKindsById.get(primaryStation.kindId)?.shape ?? "circle" : "circle";

                      return (
                        <g key={node.id} onMouseDown={() => handleNodeMouseDown(node.id)} style={{ cursor: "grab" }}>
                          {renderNodeSymbol(shape, node, isSelected)}
                        </g>
                      );
                    })}

                    {map.stations.map((station) => {
                      const node = nodesById.get(station.nodeId);
                      if (!node) return null;
                      const labelX = station.label?.x ?? node.x + 12;
                      const labelY = station.label?.y ?? node.y - 10;

                      return (
                        <text key={station.id} x={labelX} y={labelY} fontSize="14" fontWeight="600" fill="#111827">
                          {station.name}
                        </text>
                      );
                    })}
                  </svg>
                </div>

                <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {map.stations.length} stations
                  </div>
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {map.segments.length} segments
                  </div>
                  <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
                    {map.lines.length} lines
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
                          <Input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="New station name" />
                          <Button onClick={addStation}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="text-sm font-semibold text-ink">Stations</div>
                        <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                          {map.stations.map((station) => (
                            <button
                              key={station.id}
                              type="button"
                              onClick={() => setSelectedNodeId(station.nodeId)}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                selectedNodeId === station.nodeId ? "bg-ink text-white" : "bg-white text-ink hover:bg-slate-100"
                              }`}
                            >
                              <span>{station.name}</span>
                              <Badge>{stationKindsById.get(station.kindId)?.name ?? "Unknown"}</Badge>
                            </button>
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
                            <div className="text-xs text-muted">Kind: {selectedNode.kind}</div>
                            <div className="space-y-2">
                              {selectedNodeStations.map((station) => (
                                <div key={station.id} className="rounded-xl bg-white px-3 py-2 text-sm text-ink">
                                  <Input value={station.name} onChange={(event) => updateStation(station.id, { name: event.target.value })} />
                                  <select
                                    value={station.kindId}
                                    onChange={(event) => updateStation(station.id, { kindId: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                  >
                                    {map.stationKinds.map((kind) => (
                                      <option key={kind.id} value={kind.id}>
                                        {kind.name}
                                      </option>
                                    ))}
                                  </select>
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
                            <Input type="color" value={selectedLine.color} onChange={(event) => updateLine({ color: event.target.value })} />
                            <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
                              {map.segments.map((segment) => {
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
                        <div className="text-sm font-semibold text-ink">Station Kinds</div>
                        <div className="flex gap-2">
                          <Input value={newStationKindName} onChange={(event) => setNewStationKindName(event.target.value)} placeholder="New station kind" />
                          <select
                            value={newStationKindShape}
                            onChange={(event) => setNewStationKindShape(event.target.value as StationKindShape)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          >
                            <option value="circle">Circle</option>
                            <option value="interchange">Interchange</option>
                            <option value="terminal">Terminal</option>
                          </select>
                          <Button onClick={addStationKind}>
                            <Plus className="h-4 w-4" />
                          </Button>
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
                              <div className="font-medium">{kind.name}</div>
                              <div className="text-xs opacity-80">{kind.shape}</div>
                            </button>
                          ))}
                        </div>
                        {selectedStationKind ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <Input value={selectedStationKind.name} onChange={(event) => updateStationKind(selectedStationKind.id, { name: event.target.value })} />
                            <select
                              value={selectedStationKind.shape}
                              onChange={(event) => updateStationKind(selectedStationKind.id, { shape: event.target.value as StationKindShape })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            >
                              <option value="circle">Circle</option>
                              <option value="interchange">Interchange</option>
                              <option value="terminal">Terminal</option>
                            </select>
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
