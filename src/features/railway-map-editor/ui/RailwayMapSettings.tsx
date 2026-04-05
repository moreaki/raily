import { Input } from "@/shared/ui/input";

type RailwayMapSettingsProps = {
  nodeGroupCellWidth: number;
  nodeGroupCellHeight: number;
  segmentIndicatorWidth: number;
  selectedSegmentIndicatorBoost: number;
  gridLineOpacity: number;
  labelAxisSnapSensitivity: number;
  updateNodeGroupCellWidth: (value: number) => void;
  updateNodeGroupCellHeight: (value: number) => void;
  updateSegmentIndicatorWidth: (value: number) => void;
  updateSelectedSegmentIndicatorBoost: (value: number) => void;
  updateGridLineOpacity: (value: number) => void;
  updateLabelAxisSnapSensitivity: (value: number) => void;
};

export function RailwayMapSettings({
  nodeGroupCellWidth,
  nodeGroupCellHeight,
  segmentIndicatorWidth,
  selectedSegmentIndicatorBoost,
  gridLineOpacity,
  labelAxisSnapSensitivity,
  updateNodeGroupCellWidth,
  updateNodeGroupCellHeight,
  updateSegmentIndicatorWidth,
  updateSelectedSegmentIndicatorBoost,
  updateGridLineOpacity,
  updateLabelAxisSnapSensitivity,
}: RailwayMapSettingsProps) {
  const safeNodeGroupCellWidth = nodeGroupCellWidth ?? 22;
  const safeNodeGroupCellHeight = nodeGroupCellHeight ?? 22;
  const safeSegmentIndicatorWidth = segmentIndicatorWidth ?? 16;
  const safeSelectedSegmentIndicatorBoost = selectedSegmentIndicatorBoost ?? 4;
  const safeGridLineOpacity = gridLineOpacity ?? 0.45;
  const safeLabelAxisSnapSensitivity = labelAxisSnapSensitivity ?? 10;

  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-ink">General Settings</div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Node Group Cell Size</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">W</span>
            <Input
              type="number"
              min={8}
              max={64}
              step={1}
              value={safeNodeGroupCellWidth}
              onChange={(event) => updateNodeGroupCellWidth(Number(event.target.value) || safeNodeGroupCellWidth)}
              className="w-24"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">H</span>
            <Input
              type="number"
              min={8}
              max={64}
              step={1}
              value={safeNodeGroupCellHeight}
              onChange={(event) => updateNodeGroupCellHeight(Number(event.target.value) || safeNodeGroupCellHeight)}
              className="w-24"
            />
          </label>
          <p className="text-xs text-muted">Controls the cell spacing used to place ports inside a node group.</p>
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
            value={safeSegmentIndicatorWidth}
            onChange={(event) => updateSegmentIndicatorWidth(Number(event.target.value) || safeSegmentIndicatorWidth)}
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
            value={safeSelectedSegmentIndicatorBoost}
            onChange={(event) => updateSelectedSegmentIndicatorBoost(Number(event.target.value) || safeSelectedSegmentIndicatorBoost)}
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
            value={safeGridLineOpacity}
            onChange={(event) => updateGridLineOpacity(Number(event.target.value) || safeGridLineOpacity)}
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
            value={safeLabelAxisSnapSensitivity}
            onChange={(event) => updateLabelAxisSnapSensitivity(Number(event.target.value) || safeLabelAxisSnapSensitivity)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls how easily labels snap to horizontal, vertical, and diagonal axes while dragging.</p>
        </div>
      </div>
    </section>
  );
}
