import { describe, expect, it } from "vitest";
import { DEVELOPMENT_BOOTSTRAP_MAP } from "@/entities/railway-map/model/constants";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import { autoPlaceLabels, evaluateLabelLayout } from "@/features/railway-map-editor/lib/labels";

function makeHorizontalMap(): RailwayMap {
  return {
    config: {
      stationKinds: [
        {
          id: "kind-stop",
          name: "Stop",
          shape: "circle",
          symbolSize: 1,
          fontFamily: "Arial",
          fontWeight: "600",
          fontSize: 14,
        },
      ],
      lines: [{ id: "line-a", name: "A", color: "#2563eb", strokeWidth: 8, strokeStyle: "solid" }],
      parallelTrackSpacing: 26,
    },
    model: {
      sheets: [{ id: "sheet-main", name: "Main" }],
      nodes: [
        { id: "n1", sheetId: "sheet-main", x: 100, y: 120 },
        { id: "n2", sheetId: "sheet-main", x: 220, y: 120 },
        { id: "n3", sheetId: "sheet-main", x: 340, y: 120 },
      ],
      nodeLanes: [],
      stations: [
        { id: "s1", nodeId: "n1", name: "Alpha", kindId: "kind-stop" },
        { id: "s2", nodeId: "n2", name: "Beta", kindId: "kind-stop" },
        { id: "s3", nodeId: "n3", name: "Gamma", kindId: "kind-stop" },
      ],
      segments: [
        { id: "sg1", sheetId: "sheet-main", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" } },
        { id: "sg2", sheetId: "sheet-main", fromNodeId: "n2", toNodeId: "n3", geometry: { kind: "straight" } },
      ],
      lineRuns: [{ id: "lr1", lineId: "line-a", segmentIds: ["sg1", "sg2"] }],
    },
  };
}

function stripLabels(map: RailwayMap): RailwayMap {
  return {
    ...map,
    model: {
      ...map.model,
      stations: map.model.stations.map((station) => ({
        ...station,
        label: station.nodeId ? undefined : station.label,
      })),
    },
  };
}

function layoutDistance(current: RailwayMap, target: RailwayMap) {
  const targetStationsById = new Map(target.model.stations.map((station) => [station.id, station]));
  let total = 0;

  for (const station of current.model.stations) {
    const targetStation = targetStationsById.get(station.id);
    if (!station.label || !targetStation?.label) continue;
    total += Math.hypot(station.label.x - targetStation.label.x, station.label.y - targetStation.label.y);
    total += Math.abs((station.label.rotation ?? 0) - (targetStation.label.rotation ?? 0)) * 2;
    total += station.label.align === targetStation.label.align ? 0 : 24;
  }

  return total;
}

describe("label placement", () => {
  it("keeps the committed bootstrap collision-free", () => {
    const evaluation = evaluateLabelLayout(DEVELOPMENT_BOOTSTRAP_MAP);

    expect(evaluation.overlapCount).toBe(0);
    expect(evaluation.segmentIntersectionCount).toBeLessThanOrEqual(25);
  });

  it("keeps labels on one side of a simple horizontal corridor", () => {
    const map = makeHorizontalMap();
    const placed = autoPlaceLabels(map);
    const offsets = placed
      .filter((station) => station.nodeId)
      .map((station) => {
        const node = map.model.nodes.find((candidate) => candidate.id === station.nodeId)!;
        return (station.label?.y ?? node.y) - node.y;
      });

    const hasPositive = offsets.some((offset) => offset > 0);
    const hasNegative = offsets.some((offset) => offset < 0);

    expect(hasPositive && hasNegative).toBe(false);
  });

  it("bootstrap-aware auto placement lands closer to the committed bootstrap than generic placement", () => {
    const unlabeled = stripLabels(DEVELOPMENT_BOOTSTRAP_MAP);
    const generic = {
      ...unlabeled,
      model: {
        ...unlabeled.model,
        stations: autoPlaceLabels(unlabeled),
      },
    };
    const bootstrapAware = {
      ...unlabeled,
      model: {
        ...unlabeled.model,
        stations: autoPlaceLabels(unlabeled, { bootstrapMode: true }),
      },
    };

    expect(layoutDistance(bootstrapAware, DEVELOPMENT_BOOTSTRAP_MAP)).toBeLessThan(layoutDistance(generic, DEVELOPMENT_BOOTSTRAP_MAP));
  });
});
