import { describe, expect, it } from "vitest";
import { INITIAL_MAP } from "@/entities/railway-map/model/constants";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import { sanitizeRailwayMap } from "@/entities/railway-map/model/utils";

function makeMap(): RailwayMap {
  return {
    schemaVersion: 1,
    config: {
      ...INITIAL_MAP.config,
      lines: [
        { id: "line-a", name: "A", color: "#2563eb", strokeWidth: 8, strokeStyle: "solid" },
        { id: "line-b", name: "B", color: "#dc2626", strokeWidth: 8, strokeStyle: "solid" },
      ],
    },
    model: {
      sheets: [
        { id: "sheet-a", name: "A" },
        { id: "sheet-b", name: "B" },
      ],
      nodes: [
        { id: "n1", sheetId: "sheet-a", x: 0, y: 0 },
        { id: "n2", sheetId: "sheet-a", x: 100, y: 0 },
        { id: "n3", sheetId: "sheet-b", x: 200, y: 0 },
      ],
      nodeLanes: [],
      stations: [],
      segments: [
        { id: "sg1", sheetId: "sheet-a", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" } },
      ],
      lineRuns: [],
    },
  };
}

function owningLineId(map: RailwayMap, segmentId: string) {
  return map.model.lineRuns.find((lineRun) => lineRun.segmentIds.includes(segmentId))?.lineId ?? null;
}

describe("sanitizeRailwayMap invariants", () => {
  it("removes segments whose endpoints do not belong to the segment sheet", () => {
    const map = makeMap();
    map.model.segments.push({
      id: "sg-cross",
      sheetId: "sheet-a",
      fromNodeId: "n1",
      toNodeId: "n3",
      geometry: { kind: "straight" },
    });

    expect(sanitizeRailwayMap(map).model.segments.map((segment) => segment.id)).toEqual(["sg1"]);
  });

  it("resolves duplicate ownership independently of line-run array order", () => {
    const makeRuns = (reverse: boolean) => {
      const runs = [
        { id: "lr-b", lineId: "line-b", segmentIds: ["sg1"] },
        { id: "lr-a", lineId: "line-a", segmentIds: ["sg1"] },
      ];
      const map = makeMap();
      map.model.lineRuns = reverse ? [...runs].reverse() : runs;
      return sanitizeRailwayMap(map);
    };

    expect(owningLineId(makeRuns(false), "sg1")).toBe("line-a");
    expect(owningLineId(makeRuns(true), "sg1")).toBe("line-a");
  });

  it("prefers a valid endpoint port line when resolving duplicate ownership", () => {
    const map = makeMap();
    map.model.nodeLanes = [{ id: "lane-b", nodeId: "n1", order: 0, lineId: "line-b" }];
    map.model.segments[0].fromLaneId = "lane-b";
    map.model.lineRuns = [
      { id: "lr-a", lineId: "line-a", segmentIds: ["sg1"] },
      { id: "lr-b", lineId: "line-b", segmentIds: ["sg1"] },
    ];

    expect(owningLineId(sanitizeRailwayMap(map), "sg1")).toBe("line-b");
  });

  it("repairs stale endpoint lane and lane line references", () => {
    const map = makeMap();
    map.model.nodeLanes = [
      { id: "lane-stale-line", nodeId: "n1", order: 0, lineId: "missing-line" },
      { id: "lane-wrong-node", nodeId: "n2", order: 0, lineId: "line-a" },
    ];
    map.model.segments[0].fromLaneId = "lane-wrong-node";
    map.model.segments[0].toLaneId = "missing-lane";

    const sanitized = sanitizeRailwayMap(map);
    const segment = sanitized.model.segments[0];

    expect(segment.fromLaneId).not.toBe("lane-wrong-node");
    expect(segment.toLaneId).not.toBe("missing-lane");
    expect(sanitized.model.nodeLanes.find((lane) => lane.id === "lane-stale-line")?.lineId).toBeUndefined();
  });

  it("merges duplicate runs for one line and remains idempotent", () => {
    const map = makeMap();
    map.model.lineRuns = [
      { id: "lr-z", lineId: "line-a", segmentIds: [] },
      { id: "lr-a", lineId: "line-a", segmentIds: ["sg1"] },
    ];

    const once = sanitizeRailwayMap(map);
    const twice = sanitizeRailwayMap(once);

    expect(once.model.lineRuns.filter((lineRun) => lineRun.lineId === "line-a")).toEqual([
      { id: "lr-a", lineId: "line-a", segmentIds: ["sg1"] },
    ]);
    expect(twice).toEqual(once);
  });
});
