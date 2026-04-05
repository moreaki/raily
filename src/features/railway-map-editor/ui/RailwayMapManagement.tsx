import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { Line, MapNode, Segment, Sheet, Station, StationKind, StationLabelFontWeight } from "@/entities/railway-map/model/types";
import { lineStrokeDasharray } from "@/entities/railway-map/model/utils";
import { DEFAULT_STATION_FONT_FAMILY, DEFAULT_STATION_FONT_SIZE, DEFAULT_STATION_SYMBOL_SIZE, STATION_FONT_WEIGHT_OPTIONS } from "@/features/railway-map-editor/lib/labels";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type RailwayMapManagementProps = {
  manageSection: "development" | "lines" | "stations" | "stationKinds";
  setManageSection: (value: "development" | "lines" | "stations" | "stationKinds") => void;
  bootstrapDevelopmentModel: () => void;
  autoPlaceCurrentSheetLabels: () => void;
  selectedLineId: string;
  setSelectedLineId: (value: string) => void;
  addLine: () => void;
  selectedLine: Line | null;
  lines: Line[];
  currentSegments: Segment[];
  lineIdBySegmentId: Map<string, string>;
  linesById: Map<string, Line>;
  updateLine: (patch: Partial<Line>) => void;
  toggleSegmentOnSelectedLine: (segmentId: string) => void;
  deleteSelectedLine: () => void;
  newStationName: string;
  setNewStationName: (value: string) => void;
  newStationKindId: string;
  setNewStationKindId: (value: string) => void;
  addStation: () => void;
  visibleStations: Station[];
  selectedStationId: string;
  setSelectedStationId: (value: string) => void;
  selectedStation: Station | null;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  deleteStation: (stationId: string) => void;
  unassignStation: (stationId: string) => void;
  nodesById: Map<string, MapNode>;
  sheets: Sheet[];
  segments: Segment[];
  focusStation: (stationId: string) => void;
  newStationKindName: string;
  setNewStationKindName: (value: string) => void;
  newStationKindFontFamily: string;
  setNewStationKindFontFamily: (value: string) => void;
  newStationKindShape: StationKind["shape"];
  setNewStationKindShape: (value: StationKind["shape"]) => void;
  newStationKindFontWeight: StationLabelFontWeight;
  setNewStationKindFontWeight: (value: StationLabelFontWeight) => void;
  newStationKindFontSize: number;
  setNewStationKindFontSize: (value: number) => void;
  newStationKindSymbolSize: number;
  setNewStationKindSymbolSize: (value: number) => void;
  addStationKind: () => void;
  stationKinds: StationKind[];
  selectedStationKindId: string;
  setSelectedStationKindId: (value: string) => void;
  renderStationKindPreview: (shape: StationKind["shape"], symbolSize: number) => ReactNode;
  selectedStationKind: StationKind | null;
  updateStationKind: (stationKindId: string, patch: Partial<StationKind>) => void;
  deleteSelectedStationKind: () => void;
  stationKindsCount: number;
};

export function RailwayMapManagement(props: RailwayMapManagementProps) {
  const {
    manageSection,
    setManageSection,
    bootstrapDevelopmentModel,
    autoPlaceCurrentSheetLabels,
    selectedLineId,
    setSelectedLineId,
    addLine,
    selectedLine,
    lines,
    currentSegments,
    lineIdBySegmentId,
    linesById,
    updateLine,
    toggleSegmentOnSelectedLine,
    deleteSelectedLine,
    newStationName,
    setNewStationName,
    newStationKindId,
    setNewStationKindId,
    addStation,
    visibleStations,
    selectedStationId,
    setSelectedStationId,
    selectedStation,
    updateStation,
    deleteStation,
    unassignStation,
    nodesById,
    sheets,
    segments,
    focusStation,
    newStationKindName,
    setNewStationKindName,
    newStationKindFontFamily,
    setNewStationKindFontFamily,
    newStationKindShape,
    setNewStationKindShape,
    newStationKindFontWeight,
    setNewStationKindFontWeight,
    newStationKindFontSize,
    setNewStationKindFontSize,
    newStationKindSymbolSize,
    setNewStationKindSymbolSize,
    addStationKind,
    stationKinds,
    selectedStationKindId,
    setSelectedStationKindId,
    renderStationKindPreview,
    selectedStationKind,
    updateStationKind,
    deleteSelectedStationKind,
    stationKindsCount,
  } = props;
  const [stationSearch, setStationSearch] = useState("");
  const sheetsById = useMemo(() => new Map(sheets.map((sheet) => [sheet.id, sheet])), [sheets]);
  const filteredStations = useMemo(() => {
    const query = stationSearch.trim().toLowerCase();
    const filtered = !query
      ? visibleStations
      : visibleStations.filter((station) => {
          return station.name.toLowerCase().includes(query);
        });

    return [...filtered].sort((left, right) => {
      const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName;
      return left.id.localeCompare(right.id);
    });
  }, [nodesById, sheetsById, stationKinds, stationSearch, visibleStations]);
  const assignedLinesByStationId = useMemo(() => {
    const next = new Map<string, Array<{ id: string; name: string; color: string }>>();

    for (const station of visibleStations) {
      if (!station.nodeId) {
        next.set(station.id, []);
        continue;
      }

      const seenLineIds = new Set<string>();
      const lines = segments
        .filter((segment) => segment.fromNodeId === station.nodeId || segment.toNodeId === station.nodeId)
        .map((segment) => lineIdBySegmentId.get(segment.id))
        .filter((lineId): lineId is string => Boolean(lineId))
        .flatMap((lineId) => {
          if (seenLineIds.has(lineId)) return [];
          seenLineIds.add(lineId);
          const line = linesById.get(lineId);
          return line ? [{ id: line.id, name: line.name, color: line.color }] : [];
        });

      next.set(station.id, lines);
    }

    return next;
  }, [lineIdBySegmentId, linesById, segments, visibleStations]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {[
          { id: "lines", label: "Lines" },
          { id: "stations", label: "Stations" },
          { id: "stationKinds", label: "Station Kinds" },
          { id: "development", label: "Development" },
        ].map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setManageSection(section.id as "development" | "lines" | "stations" | "stationKinds")}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
              manageSection === section.id ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:bg-white/70"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {manageSection === "development" ? (
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
          <p className="text-xs text-muted">Bootstrap seeds the editor with multiple overview/detail sheets, station kinds, line styles, and ready-made runs.</p>
        </section>
      ) : null}

      {manageSection === "lines" ? (
        <section className="space-y-3">
          <div className="text-sm font-semibold text-ink">Line Definitions</div>
          <div className="flex gap-2">
            <select
              value={selectedLineId}
              onChange={(event) => setSelectedLineId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              {lines.map((line) => (
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
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Segments On Current Sheet</div>
                <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
                  {currentSegments.map((segment) => {
                    const ownerLineId = lineIdBySegmentId.get(segment.id) ?? null;
                    const active = ownerLineId === selectedLine.id;
                    const ownerLine = ownerLineId ? linesById.get(ownerLineId) ?? null : null;
                    return (
                      <label key={segment.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink">
                        <span className="flex min-w-0 flex-col">
                          <span>{segment.id}</span>
                          <span className="text-xs text-muted">{ownerLine ? `Assigned to ${ownerLine.name}` : "Unassigned"}</span>
                        </span>
                        <input type="checkbox" checked={active} onChange={() => toggleSegmentOnSelectedLine(segment.id)} />
                      </label>
                    );
                  })}
                  {currentSegments.length === 0 ? <p className="px-3 py-2 text-xs text-muted">No segments on the active sheet yet.</p> : null}
                </div>
                <p className="text-xs text-muted">Each segment can belong to one line at most. This helper reassigns the segment to the selected line or clears it if it is already selected.</p>
              </div>
              <Button variant="destructive" className="w-full" onClick={deleteSelectedLine}>
                <Trash2 className="h-4 w-4" />
                Delete line
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {manageSection === "stations" ? (
        <section className="space-y-3">
          <div className="text-sm font-semibold text-ink">Station Manager</div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Add Station Object</div>
            <div className="flex gap-2">
              <Input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="Station name" />
              <select
                value={newStationKindId}
                onChange={(event) => setNewStationKindId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {stationKinds.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name}
                  </option>
                ))}
              </select>
              <Button onClick={addStation}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted">Stations are created as standalone objects first and can later be assigned to track points on the canvas.</p>
          </div>
          <div className="space-y-2">
            <Input value={stationSearch} onChange={(event) => setStationSearch(event.target.value)} placeholder="Search stations, kinds, or sheet names" />
            <div className="max-h-[240px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {filteredStations.map((station) => {
                const node = station.nodeId ? nodesById.get(station.nodeId) ?? null : null;
                const sheetName = node ? sheetsById.get(node.sheetId)?.name ?? "Unknown sheet" : null;
                return (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => setSelectedStationId(station.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      selectedStationId === station.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{station.name}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge className={selectedStationId === station.id ? "bg-white/15 text-white" : ""}>
                            {stationKinds.find((kind) => kind.id === station.kindId)?.name ?? "Unknown"}
                          </Badge>
                          {(assignedLinesByStationId.get(station.id) ?? []).map((line) => (
                            <Badge
                              key={line.id}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                selectedStationId === station.id ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
                              <span>{line.name}</span>
                            </Badge>
                          ))}
                          {station.nodeId && (assignedLinesByStationId.get(station.id) ?? []).length === 0 ? (
                            <Badge className={selectedStationId === station.id ? "bg-white/15 text-white" : ""}>No line assigned</Badge>
                          ) : null}
                        </div>
                        <div className={`mt-2 truncate text-xs ${selectedStationId === station.id ? "text-white/80" : "text-muted"}`}>
                          {station.nodeId ? `Assigned on ${sheetName}` : "Unassigned"}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${station.name}`}
                        className={`shrink-0 self-start rounded-lg p-1 ${
                          selectedStationId === station.id ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteStation(station.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                );
              })}
              {filteredStations.length === 0 ? <p className="px-3 py-2 text-xs text-muted">No stations match the current search.</p> : null}
            </div>
          </div>
          {selectedStation ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Selected Station</div>
              <Input value={selectedStation.name} onChange={(event) => updateStation(selectedStation.id, { name: event.target.value })} placeholder="Station name" />
              <select
                value={selectedStation.kindId}
                onChange={(event) => updateStation(selectedStation.id, { kindId: event.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {stationKinds.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => focusStation(selectedStation.id)} disabled={!selectedStation.nodeId}>
                  Focus on canvas
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => unassignStation(selectedStation.id)} disabled={!selectedStation.nodeId}>
                  Unassign
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteStation(selectedStation.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete station
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {manageSection === "stationKinds" ? (
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
                onChange={(event) => setNewStationKindShape(event.target.value as StationKind["shape"])}
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
              <Input
                type="number"
                min={8}
                max={72}
                step={1}
                value={newStationKindFontSize}
                onChange={(event) => setNewStationKindFontSize(Number(event.target.value) || DEFAULT_STATION_FONT_SIZE)}
                className="w-24"
                placeholder="Size"
              />
              <Input
                type="number"
                min={0.6}
                max={2.5}
                step={0.1}
                value={newStationKindSymbolSize}
                onChange={(event) => setNewStationKindSymbolSize(Number(event.target.value) || DEFAULT_STATION_SYMBOL_SIZE)}
                className="w-24"
                placeholder="Symbol"
              />
              <Button onClick={addStationKind}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-[220px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {stationKinds.map((kind) => (
              <button
                key={kind.id}
                type="button"
                onClick={() => setSelectedStationKindId(kind.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedStationKindId === kind.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1">{renderStationKindPreview(kind.shape, kind.symbolSize)}</div>
                  <div className="min-w-0">
                    <div className="font-medium">{kind.name}</div>
                    <div className="mt-1 truncate text-sm opacity-90" style={{ fontFamily: kind.fontFamily, fontWeight: kind.fontWeight, fontSize: `${kind.fontSize}px` }}>
                      Sample label ({kind.fontWeight}, {kind.fontSize}px)
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
              <Input
                type="number"
                min={8}
                max={72}
                step={1}
                value={selectedStationKind.fontSize}
                onChange={(event) =>
                  updateStationKind(selectedStationKind.id, {
                    fontSize: Math.min(72, Math.max(8, Number(event.target.value) || DEFAULT_STATION_FONT_SIZE)),
                  })
                }
                placeholder="Font size"
              />
              <Input
                type="number"
                min={0.6}
                max={2.5}
                step={0.1}
                value={selectedStationKind.symbolSize}
                onChange={(event) =>
                  updateStationKind(selectedStationKind.id, {
                    symbolSize: Math.min(2.5, Math.max(0.6, Number(event.target.value) || DEFAULT_STATION_SYMBOL_SIZE)),
                  })
                }
                placeholder="Symbol size"
              />
              <select
                value={selectedStationKind.shape}
                onChange={(event) => updateStationKind(selectedStationKind.id, { shape: event.target.value as StationKind["shape"] })}
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
                style={{
                  fontFamily: selectedStationKind.fontFamily,
                  fontWeight: selectedStationKind.fontWeight,
                  fontSize: `${selectedStationKind.fontSize}px`,
                }}
              >
                Preview label for {selectedStationKind.name} ({selectedStationKind.fontSize}px)
              </div>
              <Button variant="destructive" className="w-full" onClick={deleteSelectedStationKind} disabled={stationKindsCount <= 1}>
                <Trash2 className="h-4 w-4" />
                Delete station kind
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
