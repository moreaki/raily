import { Input } from "@/shared/ui/input";

type RailwayMapSettingsProps = {
  parallelTrackSpacing: number;
  segmentIndicatorWidth: number;
  selectedSegmentIndicatorBoost: number;
  gridLineOpacity: number;
  labelAxisSnapSensitivity: number;
  updateParallelTrackSpacing: (value: number) => void;
  updateSegmentIndicatorWidth: (value: number) => void;
  updateSelectedSegmentIndicatorBoost: (value: number) => void;
  updateGridLineOpacity: (value: number) => void;
  updateLabelAxisSnapSensitivity: (value: number) => void;
};

export function RailwayMapSettings({
  parallelTrackSpacing,
  segmentIndicatorWidth,
  selectedSegmentIndicatorBoost,
  gridLineOpacity,
  labelAxisSnapSensitivity,
  updateParallelTrackSpacing,
  updateSegmentIndicatorWidth,
  updateSelectedSegmentIndicatorBoost,
  updateGridLineOpacity,
  updateLabelAxisSnapSensitivity,
}: RailwayMapSettingsProps) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-ink">General Settings</div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Parallel Track Spacing</div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={8}
            max={48}
            step={1}
            value={parallelTrackSpacing}
            onChange={(event) => updateParallelTrackSpacing(Number(event.target.value) || parallelTrackSpacing)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls the distance between parallel segments and grouped station lanes.</p>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Segment Indicator Width</div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={8}
            max={36}
            step={1}
            value={segmentIndicatorWidth}
            onChange={(event) => updateSegmentIndicatorWidth(Number(event.target.value) || segmentIndicatorWidth)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls the width of the gray segment indicator for selected or unassigned segments.</p>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Selected Segment Boost</div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={12}
            step={1}
            value={selectedSegmentIndicatorBoost}
            onChange={(event) => updateSelectedSegmentIndicatorBoost(Number(event.target.value) || selectedSegmentIndicatorBoost)}
            className="w-28"
          />
          <p className="text-xs text-muted">Adds extra width to the indicator when a segment is selected.</p>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Grid Line Opacity</div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0.1}
            max={0.8}
            step={0.05}
            value={gridLineOpacity}
            onChange={(event) => updateGridLineOpacity(Number(event.target.value) || gridLineOpacity)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls how strong the grid lines appear when the grid is shown.</p>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Label Axis Snap Sensitivity</div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={6}
            max={24}
            step={1}
            value={labelAxisSnapSensitivity}
            onChange={(event) => updateLabelAxisSnapSensitivity(Number(event.target.value) || labelAxisSnapSensitivity)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls how easily labels snap to horizontal, vertical, and diagonal axes while dragging.</p>
        </div>
      </div>
    </section>
  );
}
