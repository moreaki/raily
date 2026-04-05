import { Input } from "@/shared/ui/input";

type RailwayMapSettingsProps = {
  parallelTrackSpacing: number;
  updateParallelTrackSpacing: (value: number) => void;
};

export function RailwayMapSettings({ parallelTrackSpacing, updateParallelTrackSpacing }: RailwayMapSettingsProps) {
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
            onChange={(event) => updateParallelTrackSpacing(Number(event.target.value) || 18)}
            className="w-28"
          />
          <p className="text-xs text-muted">Controls the distance between parallel segments and grouped station lanes.</p>
        </div>
      </div>
    </section>
  );
}
