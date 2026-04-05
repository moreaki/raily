import { Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { Station, StationKind } from "@/entities/railway-map/model/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type NodeContextMenuState = {
  nodeIds: string[];
  markerKey: string | null;
  laneId: string | null;
  x: number;
  y: number;
};

type NodeContextMenuProps = {
  nodeContextMenu: NodeContextMenuState;
  nodeContextMenuPosition: { left: number; top: number } | null;
  contextMenuStation: Station | null;
  updateStation: (stationId: string, patch: Partial<Station>) => void;
  unassignStation: (stationId: string) => void;
  configStationKinds: StationKind[];
  stationKindShapeGlyph: (shape: StationKind["shape"]) => string;
  laneDisplayNameById: Map<string, string>;
  pendingSegmentStart: { nodeId: string; laneId: string | null } | null;
  completeSegmentAtNode: (nodeId: string, laneId: string | null, markerKey: string | null) => void;
  cancelPendingSegment: () => void;
  nodeAssignmentQuery: string;
  setNodeAssignmentQuery: (value: string) => void;
  hasAssignableStations: boolean;
  stationAssignmentResults: Station[];
  assignStationToNode: (stationId: string, nodeId: string) => void;
  stationKindsById: Map<string, StationKind>;
  nodeAssignmentName: string;
  setNodeAssignmentName: (value: string) => void;
  nodeAssignmentKindId: string;
  setNodeAssignmentKindId: (value: string) => void;
  createStationAtNode: (nodeId: string, name: string, kindId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
  addNodeToGroup: (nodeId: string) => void;
  canRemoveNodeFromGroup: boolean;
  removeNodeFromGroup: (nodeId: string, laneId: string) => void;
  canRemoveTrackPoint: boolean;
  removeTrackPoint: (nodeId: string) => void;
};

export function NodeContextMenu(props: NodeContextMenuProps) {
  const {
    nodeContextMenu,
    nodeContextMenuPosition,
    contextMenuStation,
    updateStation,
    unassignStation,
    configStationKinds,
    stationKindShapeGlyph,
    laneDisplayNameById,
    pendingSegmentStart,
    completeSegmentAtNode,
    cancelPendingSegment,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    hasAssignableStations,
    stationAssignmentResults,
    assignStationToNode,
    stationKindsById,
    nodeAssignmentName,
    setNodeAssignmentName,
    nodeAssignmentKindId,
    setNodeAssignmentKindId,
    createStationAtNode,
    deleteNodes,
    addNodeToGroup,
    canRemoveNodeFromGroup,
    removeNodeFromGroup,
    canRemoveTrackPoint,
    removeTrackPoint,
  } = props;

  function handleAddStationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    createStationAtNode(nodeContextMenu.nodeIds[0], nodeAssignmentName, nodeAssignmentKindId);
  }

  return (
    <div
      className="fixed z-30 min-w-[240px] max-w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
      style={{
        left: nodeContextMenuPosition?.left ?? nodeContextMenu.x,
        top: nodeContextMenuPosition?.top ?? nodeContextMenu.y,
        maxHeight: "calc(100vh - 24px)",
      }}
    >
      {nodeContextMenu.nodeIds.length === 1 ? (
        <>
          {contextMenuStation ? (
            <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Station</div>
              <Input
                value={contextMenuStation.name}
                onChange={(event) => updateStation(contextMenuStation.id, { name: event.target.value })}
                placeholder="Station name"
                className="h-9"
              />
              <select
                value={contextMenuStation.kindId}
                onChange={(event) => updateStation(contextMenuStation.id, { kindId: event.target.value })}
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {configStationKinds.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name} {stationKindShapeGlyph(kind.shape)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                onClick={() => unassignStation(contextMenuStation.id)}
              >
                Unassign station
              </button>
            </div>
          ) : null}

          <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Track</div>
            {nodeContextMenu.laneId ? <div className="mt-1 text-xs text-muted">Lane: {laneDisplayNameById.get(nodeContextMenu.laneId) ?? "Unassigned lane"}</div> : null}
            {pendingSegmentStart && (pendingSegmentStart.nodeId !== nodeContextMenu.nodeIds[0] || pendingSegmentStart.laneId !== nodeContextMenu.laneId) ? (
              <button
                type="button"
                className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                onClick={() => completeSegmentAtNode(nodeContextMenu.nodeIds[0], nodeContextMenu.laneId, nodeContextMenu.markerKey)}
              >
                Create segment to here
              </button>
            ) : pendingSegmentStart && pendingSegmentStart.nodeId === nodeContextMenu.nodeIds[0] && pendingSegmentStart.laneId === nodeContextMenu.laneId ? (
              <button
                type="button"
                className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                onClick={cancelPendingSegment}
              >
                Cancel pending segment
              </button>
            ) : null}
          </div>

          {!contextMenuStation ? (
            <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              {hasAssignableStations ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assign Station</div>
                  <Input value={nodeAssignmentQuery} onChange={(event) => setNodeAssignmentQuery(event.target.value)} placeholder="Search unassigned stations" className="h-9" />
                  <div className="max-h-40 space-y-1 overflow-auto">
                    {stationAssignmentResults.slice(0, 8).map((station) => (
                      <button
                        key={station.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
                        onClick={() => assignStationToNode(station.id, nodeContextMenu.nodeIds[0])}
                      >
                        <span className="truncate">{station.name}</span>
                        <span className="ml-3 shrink-0 text-xs text-slate-500">{stationKindsById.get(station.kindId)?.name ?? "Unknown"}</span>
                      </button>
                    ))}
                    {stationAssignmentResults.length === 0 ? <div className="px-2 py-2 text-xs text-slate-500">No stations match that search.</div> : null}
                  </div>
                </>
              ) : null}
              <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Add New Station</div>
              <Input
                value={nodeAssignmentName}
                onChange={(event) => setNodeAssignmentName(event.target.value)}
                onKeyDown={handleAddStationKeyDown}
                placeholder="Optional station name"
                className="h-9"
              />
              <select value={nodeAssignmentKindId} onChange={(event) => setNodeAssignmentKindId(event.target.value)} className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                {configStationKinds.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name} {stationKindShapeGlyph(kind.shape)}
                  </option>
                ))}
              </select>
              <Button variant="outline" className="w-full" onClick={() => createStationAtNode(nodeContextMenu.nodeIds[0], nodeAssignmentName, nodeAssignmentKindId)}>
                <Plus className="h-4 w-4" />
                Add new station
              </Button>
            </div>
          ) : null}

          {canRemoveTrackPoint ? (
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
              onClick={() => removeTrackPoint(nodeContextMenu.nodeIds[0])}
            >
              Remove track point
            </button>
          ) : null}
          <button
            type="button"
            className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
            onClick={() => addNodeToGroup(nodeContextMenu.nodeIds[0])}
          >
            <Plus className="h-4 w-4" />
            Add node to group
          </button>
          {canRemoveNodeFromGroup && nodeContextMenu.laneId ? (
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
              onClick={() => removeNodeFromGroup(nodeContextMenu.nodeIds[0], nodeContextMenu.laneId!)}
            >
              Remove node from group
            </button>
          ) : null}
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
  );
}
