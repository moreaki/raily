import { describe, expect, it } from "vitest";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import {
  assignLineToSegment,
  assignStationToNode,
  deleteNodes,
  deleteSheet,
  insertTrackPointOnSegment,
  addSegmentPolylinePoint,
  makeSegmentOrthogonal,
  makeSegmentPolyline,
  makeSegmentStraight,
  updateSegmentPolylinePoint,
} from "@/features/railway-map-editor/lib/commands";

function makeMap(): RailwayMap {
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
      lines: [
        { id: "line-a", name: "A", color: "#2563eb", strokeWidth: 8, strokeStyle: "solid" },
        { id: "line-b", name: "B", color: "#dc2626", strokeWidth: 8, strokeStyle: "solid" },
      ],
      parallelTrackSpacing: 18,
      segmentIndicatorWidth: 16,
      selectedSegmentIndicatorBoost: 4,
      gridLineOpacity: 0.45,
      labelAxisSnapSensitivity: 10,
    },
    model: {
      sheets: [
        { id: "sheet-main", name: "Main" },
        { id: "sheet-other", name: "Other" },
      ],
      nodes: [
        { id: "n1", sheetId: "sheet-main", x: 0, y: 0 },
        { id: "n2", sheetId: "sheet-main", x: 100, y: 0 },
        { id: "n3", sheetId: "sheet-main", x: 200, y: 0 },
        { id: "n4", sheetId: "sheet-other", x: 300, y: 0 },
      ],
      nodeLanes: [],
      stations: [
        { id: "s1", nodeId: null, name: "Loose", kindId: "kind-stop" },
        { id: "s2", nodeId: "n4", name: "Other", kindId: "kind-stop", label: { x: 312, y: -10, align: "right" } },
      ],
      segments: [
        { id: "sg1", sheetId: "sheet-main", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" } },
        { id: "sg2", sheetId: "sheet-main", fromNodeId: "n2", toNodeId: "n3", geometry: { kind: "straight" } },
        { id: "sg3", sheetId: "sheet-other", fromNodeId: "n4", toNodeId: "n4", geometry: { kind: "straight" } },
      ],
      lineRuns: [
        { id: "lr-a", lineId: "line-a", segmentIds: [] },
      ],
    },
  };
}

describe("railway-map commands", () => {
  it("assignStationToNode attaches the station and seeds a right-side label", () => {
    const map = makeMap();
    const next = assignStationToNode(map, "s1", "n2");
    const station = next.model.stations.find((candidate) => candidate.id === "s1");

    expect(station?.nodeId).toBe("n2");
    expect(station?.label).toEqual({
      x: 112,
      y: -10,
      align: "right",
      rotation: 0,
    });
  });

  it("assignLineToSegment propagates through a simple degree-2 corridor", () => {
    const map = makeMap();
    const next = assignLineToSegment(map, "line-b", "sg1");
    const run = next.model.lineRuns.find((candidate) => candidate.lineId === "line-b");

    expect(run?.segmentIds).toEqual(["sg1", "sg2"]);
    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-a")?.segmentIds).toEqual([]);
  });

  it("insertTrackPointOnSegment replaces one segment with two and one inserted node", () => {
    const map = makeMap();
    const { map: next, insertedNode } = insertTrackPointOnSegment(map, "sg1");

    expect(insertedNode).not.toBeNull();
    expect(next.model.nodes.some((node) => node.id === insertedNode?.id)).toBe(true);
    expect(next.model.segments.some((segment) => segment.id === "sg1")).toBe(false);
    expect(next.model.segments.filter((segment) => segment.sheetId === "sheet-main")).toHaveLength(3);
  });

  it("can convert a segment between straight and orthogonal geometry", () => {
    const map = makeMap();
    const orthogonal = makeSegmentOrthogonal(map, "sg1");
    const segmentAfterOrthogonal = orthogonal.model.segments.find((candidate) => candidate.id === "sg1");

    expect(segmentAfterOrthogonal?.geometry.kind).toBe("orthogonal");
    if (segmentAfterOrthogonal?.geometry.kind === "orthogonal") {
      expect(segmentAfterOrthogonal.geometry.elbow).toEqual({ x: 100, y: 0 });
    }

    const straightAgain = makeSegmentStraight(orthogonal, "sg1");
    const segmentAfterStraight = straightAgain.model.segments.find((candidate) => candidate.id === "sg1");
    expect(segmentAfterStraight?.geometry.kind).toBe("straight");
  });

  it("can convert a segment to polyline and edit bend points", () => {
    const map = makeMap();
    const polyline = makeSegmentPolyline(map, "sg1");
    const segmentAfterPolyline = polyline.model.segments.find((candidate) => candidate.id === "sg1");

    expect(segmentAfterPolyline?.geometry.kind).toBe("polyline");
    if (segmentAfterPolyline?.geometry.kind === "polyline") {
      expect(segmentAfterPolyline.geometry.points).toEqual([{ x: 50, y: 0 }]);
    }

    const withExtraPoint = addSegmentPolylinePoint(polyline, "sg1");
    const segmentAfterAdd = withExtraPoint.model.segments.find((candidate) => candidate.id === "sg1");
    expect(segmentAfterAdd?.geometry.kind).toBe("polyline");
    if (segmentAfterAdd?.geometry.kind === "polyline") {
      expect(segmentAfterAdd.geometry.points).toHaveLength(2);
    }

    const movedPoint = updateSegmentPolylinePoint(withExtraPoint, "sg1", 0, { x: 50, y: 20 });
    const segmentAfterMove = movedPoint.model.segments.find((candidate) => candidate.id === "sg1");
    expect(segmentAfterMove?.geometry.kind).toBe("polyline");
    if (segmentAfterMove?.geometry.kind === "polyline") {
      expect(segmentAfterMove.geometry.points[0]).toEqual({ x: 50, y: 20 });
    }
  });

  it("deleteNodes removes connected segments and line-run references", () => {
    const map = assignLineToSegment(makeMap(), "line-b", "sg1");
    const next = deleteNodes(map, ["n2"]);

    expect(next.model.nodes.map((node) => node.id)).not.toContain("n2");
    expect(next.model.segments.map((segment) => segment.id)).not.toContain("sg1");
    expect(next.model.segments.map((segment) => segment.id)).not.toContain("sg2");
    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-b")?.segmentIds).toEqual([]);
  });

  it("deleteSheet removes sheet-owned nodes, stations, segments, and run references", () => {
    const map = assignLineToSegment(makeMap(), "line-b", "sg1");
    const next = deleteSheet(map, "sheet-other");

    expect(next.model.sheets.map((sheet) => sheet.id)).not.toContain("sheet-other");
    expect(next.model.nodes.map((node) => node.id)).not.toContain("n4");
    expect(next.model.stations.map((station) => station.id)).not.toContain("s2");
    expect(next.model.segments.map((segment) => segment.id)).not.toContain("sg3");
  });
});
