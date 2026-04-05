import type { MapPoint } from "@/entities/railway-map/model/types";
import { CornerDownRight, Minus, Plus, Spline, Trash2 } from "lucide-react";
import type { Line, Segment } from "@/entities/railway-map/model/types";

type SegmentContextMenuState = {
  segmentId: string;
  x: number;
  y: number;
  point?: MapPoint;
};

type SegmentContextMenuProps = {
  segmentContextMenu: SegmentContextMenuState;
  contextMenuSegment: Segment;
  segmentContextMenuPosition: { left: number; top: number } | null;
  assignedLineForContextSegment: Line | null;
  assignableLinesForContextSegment: Line[];
  unassignLineFromSegment: (lineId: string, segmentId: string) => void;
  assignLineToSegment: (lineId: string, segmentId: string) => void;
  insertTrackPointOnSegment: (segmentId: string) => void;
  makeSegmentStraight: (segmentId: string) => void;
  makeSegmentOrthogonal: (segmentId: string) => void;
  makeSegmentPolyline: (segmentId: string) => void;
  addSegmentPolylinePoint: (segmentId: string, point?: MapPoint) => void;
  deleteSegment: (segmentId: string) => void;
};

export function SegmentContextMenu(props: SegmentContextMenuProps) {
  const {
    segmentContextMenu,
    contextMenuSegment,
    segmentContextMenuPosition,
    assignedLineForContextSegment,
    assignableLinesForContextSegment,
    unassignLineFromSegment,
    assignLineToSegment,
    insertTrackPointOnSegment,
    makeSegmentStraight,
    makeSegmentOrthogonal,
    makeSegmentPolyline,
    addSegmentPolylinePoint,
    deleteSegment,
  } = props;

  return (
    <div
      className="fixed z-30 min-w-[240px] max-w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
      style={{
        left: segmentContextMenuPosition?.left ?? segmentContextMenu.x,
        top: segmentContextMenuPosition?.top ?? segmentContextMenu.y,
        maxHeight: "calc(100vh - 24px)",
      }}
    >
      {assignedLineForContextSegment ? (
        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Unassign Line</div>
          <div className="mt-2 space-y-1">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
              onClick={() => unassignLineFromSegment(assignedLineForContextSegment.id, contextMenuSegment.id)}
            >
              <span className="truncate">{assignedLineForContextSegment.name}</span>
              <span className="ml-3 h-3 w-3 shrink-0 rounded-full border border-slate-200" style={{ backgroundColor: assignedLineForContextSegment.color }} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assign Line</div>
        <div className="mt-2 max-h-40 space-y-1 overflow-auto">
          {assignableLinesForContextSegment.map((line) => (
            <button
              key={line.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
              onClick={() => assignLineToSegment(line.id, contextMenuSegment.id)}
            >
              <span className="truncate">{line.name}</span>
              <span className="ml-3 h-3 w-3 shrink-0 rounded-full border border-slate-200" style={{ backgroundColor: line.color }} />
            </button>
          ))}
          {assignableLinesForContextSegment.length === 0 ? <div className="px-2 py-2 text-xs text-slate-500">All available lines are already assigned to this segment.</div> : null}
        </div>
      </div>

      <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Geometry</div>
        <div className="mt-2 space-y-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
            onClick={() => makeSegmentStraight(contextMenuSegment.id)}
          >
            <Minus className="h-4 w-4" />
            Make straight
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
            onClick={() => makeSegmentOrthogonal(contextMenuSegment.id)}
          >
            <CornerDownRight className="h-4 w-4" />
            Make orthogonal
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
            onClick={() => makeSegmentPolyline(contextMenuSegment.id)}
          >
            <Spline className="h-4 w-4" />
            Make polyline
          </button>
        </div>
      </div>

      <button
        type="button"
        className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
        onClick={() => addSegmentPolylinePoint(contextMenuSegment.id, segmentContextMenu.point)}
      >
        <Plus className="h-4 w-4" />
        Add bend point
      </button>
      <button
        type="button"
        className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-100"
        onClick={() => insertTrackPointOnSegment(contextMenuSegment.id)}
      >
        <Plus className="h-4 w-4" />
        Insert track point
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
  );
}
