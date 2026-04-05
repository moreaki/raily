import { describe, expect, it } from "vitest";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import {
  addNodeLane,
  addSegmentPolylinePoint,
  assignLineToSegment,
  assignStationToNode,
  deleteNodes,
  deleteSheet,
  extendLineFromNode,
  updateNodeLaneGridPosition,
  makeSegmentOrthogonal,
  makeSegmentPolyline,
  makeSegmentStraight,
  insertTrackPointOnSegment,
  insertNodeGroupColumn,
  insertNodeGroupRow,
  removeTrackPoint,
  removeSegmentPolylinePoint,
  removeNodeLane,
  removeNodeGroupColumn,
  removeNodeGroupRow,
  updateNodeLaneLine,
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
          lineStop: false,
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
      nodeGroupCellWidth: 22,
      nodeGroupCellHeight: 22,
      hubOutlineMode: "box",
      hubOutlineColor: "#111827",
      hubOutlineStrokeStyle: "solid",
      hubOutlineScale: 1,
      hubOutlineCornerRadius: 10,
      hubOutlineStrokeWidth: 3.25,
      hubOutlineConcaveFactor: 0.45,
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

  it("assignLineToSegment stops propagating at a line-stop station", () => {
    const map = {
      ...makeMap(),
      config: {
        ...makeMap().config,
        stationKinds: [
          {
            id: "kind-stop",
            name: "Stop",
            shape: "circle" as const,
            lineStop: false,
            symbolSize: 1,
            fontFamily: "Arial",
            fontWeight: "600" as const,
            fontSize: 14,
          },
          {
            id: "kind-hub",
            name: "Hub",
            shape: "interchange" as const,
            lineStop: true,
            symbolSize: 1,
            fontFamily: "Arial",
            fontWeight: "700" as const,
            fontSize: 14,
          },
        ],
      },
      model: {
        ...makeMap().model,
        stations: [
          { id: "s1", nodeId: null, name: "Loose", kindId: "kind-stop" },
          { id: "s-mid", nodeId: "n2", name: "Mid", kindId: "kind-hub" },
          { id: "s2", nodeId: "n4", name: "Other", kindId: "kind-stop", label: { x: 312, y: -10, align: "right" as const } },
        ],
      },
    };
    const next = assignLineToSegment(map, "line-b", "sg1");

    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-b")?.segmentIds).toEqual(["sg1"]);
  });

  it("assignLineToSegment does not jump across a parallel sibling between the same two nodes", () => {
    const map = {
      ...makeMap(),
      model: {
        ...makeMap().model,
        segments: [
          { id: "sg1", sheetId: "sheet-main", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" as const } },
          { id: "sg1b", sheetId: "sheet-main", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" as const } },
        ],
      },
    };

    const next = assignLineToSegment(map, "line-b", "sg1");

    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-b")?.segmentIds).toEqual(["sg1"]);
  });

  it("insertTrackPointOnSegment replaces one segment with two and one inserted node", () => {
    const map = makeMap();
    const { map: next, insertedNode } = insertTrackPointOnSegment(map, "sg1");

    expect(insertedNode).not.toBeNull();
    expect(next.model.nodes.some((node) => node.id === insertedNode?.id)).toBe(true);
    expect(next.model.segments.some((segment) => segment.id === "sg1")).toBe(false);
    expect(next.model.segments.filter((segment) => segment.sheetId === "sheet-main")).toHaveLength(3);
  });

  it("can extend a line from a node to the right", () => {
    const map = assignLineToSegment(makeMap(), "line-b", "sg2");
    const { map: next, insertedNode, insertedSegment } = extendLineFromNode(map, "n3", { lineId: "line-b" });

    expect(insertedNode).toMatchObject({
      sheetId: "sheet-main",
      x: 290,
      y: 0,
    });
    expect(insertedSegment).toMatchObject({
      sheetId: "sheet-main",
      fromNodeId: "n3",
      toNodeId: insertedNode?.id,
    });
    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-b")?.segmentIds).toContain(insertedSegment?.id);
  });

  it("can extend a node and create an autogenerated station on the new node", () => {
    const { map: next, insertedNode } = extendLineFromNode(makeMap(), "n3", { stationKindId: "kind-stop" });

    expect(insertedNode).not.toBeNull();
    expect(next.model.stations.find((station) => station.nodeId === insertedNode?.id)).toMatchObject({
      name: "Station 3",
      kindId: "kind-stop",
    });
  });

  it("can extend a node without assigning a line", () => {
    const { map: next, insertedSegment } = extendLineFromNode(makeMap(), "n1");

    expect(insertedSegment).not.toBeNull();
    expect(next.model.lineRuns.every((candidate) => !candidate.segmentIds.includes(insertedSegment!.id))).toBe(true);
  });

  it("can extend from an existing lane without widening the source node group", () => {
    const withLane = addNodeLane(makeMap(), "n2").map;
    const connected = {
      ...withLane,
      model: {
        ...withLane.model,
        segments: withLane.model.segments.map((segment) =>
          segment.id === "sg2" ? { ...segment, fromLaneId: "nl-n2-manual-1" } : segment,
        ),
      },
    };

    const { insertedSegment } = extendLineFromNode(connected, "n2", {
      lineId: "line-b",
      fromLaneId: "nl-n2-manual-1",
    });

    expect(insertedSegment?.fromLaneId).toBe("nl-n2-manual-1");
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

  it("inserts a bend point near the clicked segment leg when a point is provided", () => {
    const map = makeSegmentPolyline(makeMap(), "sg1");
    const next = addSegmentPolylinePoint(map, "sg1", { point: { x: 80, y: 12 } });
    const segment = next.model.segments.find((candidate) => candidate.id === "sg1");

    expect(segment?.geometry.kind).toBe("polyline");
    if (segment?.geometry.kind === "polyline") {
      expect(segment.geometry.points).toHaveLength(2);
      expect(segment.geometry.points[1]).toEqual({ x: 80, y: 12 });
    }
  });

  it("can remove a bend point and turns the segment straight when no bend points remain", () => {
    const withTwoPoints = addSegmentPolylinePoint(makeSegmentPolyline(makeMap(), "sg1"), "sg1");
    const withOnePoint = removeSegmentPolylinePoint(withTwoPoints, "sg1", 0);
    const segmentWithOnePoint = withOnePoint.model.segments.find((candidate) => candidate.id === "sg1");

    expect(segmentWithOnePoint?.geometry.kind).toBe("polyline");
    if (segmentWithOnePoint?.geometry.kind === "polyline") {
      expect(segmentWithOnePoint.geometry.points).toHaveLength(1);
    }

    const straight = removeSegmentPolylinePoint(withOnePoint, "sg1", 0);
    const straightSegment = straight.model.segments.find((candidate) => candidate.id === "sg1");
    expect(straightSegment?.geometry.kind).toBe("straight");
  });

  it("deleteNodes removes connected segments and line-run references", () => {
    const map = assignLineToSegment(makeMap(), "line-b", "sg1");
    const next = deleteNodes(map, ["n2"]);

    expect(next.model.nodes.map((node) => node.id)).not.toContain("n2");
    expect(next.model.segments.map((segment) => segment.id)).not.toContain("sg1");
    expect(next.model.segments.map((segment) => segment.id)).not.toContain("sg2");
    expect(next.model.lineRuns.find((candidate) => candidate.lineId === "line-b")?.segmentIds).toEqual([]);
  });

  it("can remove an unassigned pass-through track point by merging its two segments", () => {
    const map = insertTrackPointOnSegment(makeMap(), "sg1").map;
    const insertedNode = map.model.nodes.find((node) => !["n1", "n2", "n3", "n4"].includes(node.id));
    expect(insertedNode).toBeTruthy();
    if (!insertedNode) return;

    const next = removeTrackPoint(map, insertedNode.id);
    expect(next.model.nodes.some((node) => node.id === insertedNode.id)).toBe(false);

    const mergedSegment = next.model.segments.find((segment) => segment.fromNodeId === "n1" && segment.toNodeId === "n2");
    expect(mergedSegment).toBeTruthy();
  });

  it("can add an empty lane to a node group explicitly", () => {
    const next = addNodeLane(makeMap(), "n2").map;
    expect(next.model.nodeLanes).toEqual([
      {
        id: "nl-n2-manual-1",
        nodeId: "n2",
        order: 0,
        gridColumn: 1,
        gridRow: 2,
      },
    ]);
  });

  it("can remove an empty lane from a node group explicitly", () => {
    const withLane = addNodeLane(makeMap(), "n2").map;
    const next = removeNodeLane(withLane, "n2", "nl-n2-manual-1");
    expect(next.model.nodeLanes).toEqual([]);
  });

  it("can insert and remove empty node-group columns and rows", () => {
    const withLane = addNodeLane(makeMap(), "n2").map;
    const shiftedCols = insertNodeGroupColumn(withLane, "n2", 1);
    expect(shiftedCols.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.gridColumn).toBe(2);
    const restoredCols = removeNodeGroupColumn(shiftedCols, "n2", 1);
    expect(restoredCols.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.gridColumn).toBe(1);

    const shiftedRows = insertNodeGroupRow(withLane, "n2", 1);
    expect(shiftedRows.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.gridRow).toBe(3);
    const restoredRows = removeNodeGroupRow(shiftedRows, "n2", 1);
    expect(restoredRows.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.gridRow).toBe(2);
  });

  it("persists appended empty node-group dimensions", () => {
    const withLane = addNodeLane(makeMap(), "n2").map;
    const expanded = insertNodeGroupColumn(insertNodeGroupRow(withLane, "n2", 3), "n2", 2);
    const node = expanded.model.nodes.find((candidate) => candidate.id === "n2");

    expect(node?.nodeGroupColumns).toBe(2);
    expect(node?.nodeGroupRows).toBe(3);
    expect(expanded.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")).toMatchObject({
      gridColumn: 1,
      gridRow: 2,
    });
  });

  it("swaps occupied node-group cells when moving a lane onto another lane", () => {
    const withTwoLanes = addNodeLane(addNodeLane(makeMap(), "n2").map, "n2").map;

    const swapped = updateNodeLaneGridPosition(withTwoLanes, "n2", "nl-n2-manual-1", 1, 3);

    expect(swapped.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")).toMatchObject({
      gridColumn: 1,
      gridRow: 3,
    });
    expect(swapped.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-2")).toMatchObject({
      gridColumn: 1,
      gridRow: 2,
    });
  });

  it("can assign a line to a node-group port", () => {
    const withLane = addNodeLane(makeMap(), "n2").map;
    const connected = {
      ...withLane,
      model: {
        ...withLane.model,
        segments: withLane.model.segments.map((segment) =>
          segment.id === "sg1"
            ? { ...segment, toLaneId: "nl-n2-manual-1" }
            : segment.id === "sg2"
              ? { ...segment, fromLaneId: "nl-n2-manual-1" }
              : segment,
        ),
      },
    };
    const next = updateNodeLaneLine(connected, "n2", "nl-n2-manual-1", "line-b");
    expect(next.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.lineId).toBe("line-b");
    expect(next.model.lineRuns.find((lineRun) => lineRun.lineId === "line-b")?.segmentIds.sort()).toEqual(["sg1", "sg2"]);
  });

  it("moves same-line continuity from a sibling port onto the newly assigned port", () => {
    const withLanes = {
      ...addNodeLane(addNodeLane(makeMap(), "n2").map, "n2").map,
      model: {
        ...addNodeLane(addNodeLane(makeMap(), "n2").map, "n2").map.model,
        segments: addNodeLane(addNodeLane(makeMap(), "n2").map, "n2").map.model.segments.map((segment) =>
          segment.id === "sg1"
            ? { ...segment, toLaneId: "nl-n2-manual-1" }
            : segment.id === "sg2"
              ? { ...segment, fromLaneId: "nl-n2-manual-2" }
              : segment,
        ),
        lineRuns: [
          { id: "lr-a", lineId: "line-a", segmentIds: ["sg2"] },
          { id: "lr-b", lineId: "line-b", segmentIds: ["sg1"] },
        ],
      },
    };

    const next = updateNodeLaneLine(withLanes, "n2", "nl-n2-manual-2", "line-b");

    expect(next.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-2")?.lineId).toBe("line-b");
    expect(next.model.nodeLanes.find((lane) => lane.id === "nl-n2-manual-1")?.lineId).toBeUndefined();
    expect(next.model.segments.find((segment) => segment.id === "sg1")?.toLaneId).toBe("nl-n2-manual-2");
    expect(next.model.lineRuns.find((lineRun) => lineRun.lineId === "line-b")?.segmentIds.sort()).toEqual(["sg1", "sg2"]);
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
