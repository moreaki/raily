import { DEVELOPMENT_BOOTSTRAP_MAP, LINE_PRESETS } from "@/entities/railway-map/model/constants";
import type { LabelAlignment, Line, LineRun, MapNode, MapPoint, RailwayMap, Segment, Station, StationKind } from "@/entities/railway-map/model/types";
import {
  buildSegmentPoints,
  createDefaultLine,
  createDefaultNodeForSheet,
  createDefaultSheet,
  createDefaultStation,
  createDefaultStationAtNode,
  createLineRunId,
  createSegmentId,
  createStationKindId,
  createStraightSegmentForSheet,
} from "@/entities/railway-map/model/utils";
import {
  DEFAULT_STATION_FONT_FAMILY,
  DEFAULT_STATION_FONT_SIZE,
  DEFAULT_STATION_FONT_WEIGHT,
  DEFAULT_STATION_SYMBOL_SIZE,
  autoPlaceLabels,
  pointToSegmentDistance,
} from "@/features/railway-map-editor/lib/labels";
import { clamp, pointOnPathAtHalf } from "@/features/railway-map-editor/lib/geometry";

export function cloneRailwayMap(map: RailwayMap) {
  return JSON.parse(JSON.stringify(map)) as RailwayMap;
}

export function addUnassignedStation(map: RailwayMap, name: string, kindId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      stations: [
        ...map.model.stations,
        {
          ...createDefaultStation(map, null, name),
          kindId,
        },
      ],
    },
  };
}

export function addNodeToSheet(map: RailwayMap, sheetId: string, placement: MapPoint) {
  return {
    ...map,
    model: {
      ...map.model,
      nodes: [
        ...map.model.nodes,
        {
          ...createDefaultNodeForSheet(map, sheetId),
          x: placement.x,
          y: placement.y,
        },
      ],
    },
  };
}

export function attachDefaultStationToNode(map: RailwayMap, node: MapNode, name: string) {
  return {
    ...map,
    model: {
      ...map.model,
      stations: [...map.model.stations, createDefaultStationAtNode(map, node, name)],
    },
  };
}

export function assignStationToNode(map: RailwayMap, stationId: string, nodeId: string) {
  const node = map.model.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return map;
  const align: LabelAlignment = "right";
  return {
    ...map,
    model: {
      ...map.model,
      stations: map.model.stations.map((station) =>
        station.id !== stationId
          ? station
          : {
              ...station,
              nodeId,
              label: {
                x: node.x + 12,
                y: node.y - 10,
                align,
                rotation: 0,
              },
            },
      ),
    },
  };
}

export function createStationAtNode(map: RailwayMap, nodeId: string, name: string, fallbackKindId: string) {
  const node = map.model.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return { map, station: null as Station | null };
  const stationName = name.trim() || `Station ${map.model.stations.length + 1}`;
  const station = {
    ...createDefaultStationAtNode(map, node, stationName),
    kindId: fallbackKindId,
  };
  return {
    map: {
      ...map,
      model: {
        ...map.model,
        stations: [...map.model.stations, station],
      },
    },
    station,
  };
}

export function addSheet(map: RailwayMap) {
  const sheet = createDefaultSheet(map, "");
  return {
    map: {
      ...map,
      model: {
        ...map.model,
        sheets: [...map.model.sheets, sheet],
      },
    },
    sheet,
  };
}

export function addNodeLane(map: RailwayMap, nodeId: string, axis: "horizontal" | "vertical" = "vertical") {
  const node = map.model.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return { map, laneId: null as string | null };
  const currentNodeLanes = map.model.nodeLanes.filter((lane) => lane.nodeId === nodeId);
  const nextOrder = currentNodeLanes.length;
  const laneId = `nl-${nodeId}-manual-${nextOrder + 1}`;
  if (map.model.nodeLanes.some((lane) => lane.id === laneId)) {
    return { map, laneId };
  }

  const seededGrid = currentNodeLanes.map((lane, index) => ({
    ...lane,
    gridColumn: lane.gridColumn ?? (axis === "horizontal" ? index + 1 : 1),
    gridRow: lane.gridRow ?? (axis === "vertical" ? index + 1 : 1),
  }));
  const maxColumn = seededGrid.reduce((value, lane) => Math.max(value, lane.gridColumn ?? 1), 1);
  const maxRow = seededGrid.reduce((value, lane) => Math.max(value, lane.gridRow ?? 1), 1);

  return {
    map: {
      ...map,
      model: {
        ...map.model,
        nodeLanes: [
          ...map.model.nodeLanes.map((lane) => seededGrid.find((candidate) => candidate.id === lane.id) ?? lane),
          {
            id: laneId,
            nodeId,
            order: nextOrder,
            gridColumn: axis === "horizontal" ? maxColumn + 1 : 1,
            gridRow: axis === "vertical" ? maxRow + 1 : 1,
          },
        ],
      },
    },
    laneId,
  };
}

export function removeNodeLane(map: RailwayMap, nodeId: string, laneId: string) {
  const lane = map.model.nodeLanes.find((candidate) => candidate.id === laneId && candidate.nodeId === nodeId);
  if (!lane) return map;
  const hasConnectedSegments = map.model.segments.some((segment) => segment.fromLaneId === laneId || segment.toLaneId === laneId);
  if (hasConnectedSegments) return map;

  const remainingLanes = map.model.nodeLanes
    .filter((candidate) => candidate.id !== laneId)
    .map((candidate) => ({ ...candidate }));
  const reorderedNodeLanes = remainingLanes
    .filter((candidate) => candidate.nodeId === nodeId)
    .sort((left, right) => left.order - right.order)
    .map((candidate, index) => ({ ...candidate, order: index }));
  const orderByLaneId = new Map(reorderedNodeLanes.map((candidate) => [candidate.id, candidate.order]));

  return {
    ...map,
    model: {
      ...map.model,
      nodeLanes: remainingLanes.map((candidate) => (
        candidate.nodeId === nodeId && orderByLaneId.has(candidate.id)
          ? { ...candidate, order: orderByLaneId.get(candidate.id) ?? candidate.order }
          : candidate
      )),
    },
  };
}

export function updateNodeLaneGridPosition(
  map: RailwayMap,
  nodeId: string,
  laneId: string,
  gridColumn?: number,
  gridRow?: number,
) {
  const lane = map.model.nodeLanes.find((candidate) => candidate.id === laneId && candidate.nodeId === nodeId);
  if (!lane) return map;

  const targetColumn = gridColumn && gridColumn > 0 ? gridColumn : undefined;
  const targetRow = gridRow && gridRow > 0 ? gridRow : undefined;
  const swapLane =
    targetColumn && targetRow
      ? map.model.nodeLanes.find(
          (candidate) =>
            candidate.nodeId === nodeId &&
            candidate.id !== laneId &&
            candidate.gridColumn === targetColumn &&
            candidate.gridRow === targetRow,
        ) ?? null
      : null;

  return {
    ...map,
    model: {
      ...map.model,
      nodeLanes: map.model.nodeLanes.map((candidate) => {
        if (candidate.id === laneId) {
          return {
            ...candidate,
            gridColumn: targetColumn,
            gridRow: targetRow,
          };
        }
        if (swapLane && candidate.id === swapLane.id) {
          return {
            ...candidate,
            gridColumn: lane.gridColumn,
            gridRow: lane.gridRow,
          };
        }
        return candidate;
      }),
    },
  };
}

export function updateSegmentEndpointLane(map: RailwayMap, segmentId: string, end: "from" | "to", laneId?: string) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              ...(end === "from" ? { fromLaneId: laneId || undefined } : { toLaneId: laneId || undefined }),
            },
      ),
    },
  };
}

export function addStationKind(
  map: RailwayMap,
  args: {
    name: string;
    shape: StationKind["shape"];
    symbolSize: number;
    fontFamily: string;
    fontWeight: StationKind["fontWeight"];
    fontSize: number;
  },
) {
  const stationKind: StationKind = {
    id: createStationKindId(),
    name: args.name.trim() || `Kind ${map.config.stationKinds.length + 1}`,
    shape: args.shape,
    symbolSize: clamp(args.symbolSize, 0.6, 2.5),
    fontFamily: args.fontFamily.trim() || DEFAULT_STATION_FONT_FAMILY,
    fontWeight: args.fontWeight,
    fontSize: clamp(args.fontSize, 8, 72),
  };
  return {
    map: {
      ...map,
      config: {
        ...map.config,
        stationKinds: [...map.config.stationKinds, stationKind],
      },
    },
    stationKind,
  };
}

export function addLine(map: RailwayMap, patch?: Partial<Line>) {
  const preset = LINE_PRESETS[map.config.lines.length % LINE_PRESETS.length];
  const baseLine = createDefaultLine(map.config.lines.length, preset);
  const line = { ...baseLine, ...patch };
  return {
    map: {
      ...map,
      config: {
        ...map.config,
        lines: [...map.config.lines, line],
      },
      model: {
        ...map.model,
        lineRuns: [...map.model.lineRuns, { id: `lr-${line.id}`, lineId: line.id, segmentIds: [] }],
      },
    },
    line,
  };
}

export function buildBootstrapMap() {
  const seededMap = cloneRailwayMap(DEVELOPMENT_BOOTSTRAP_MAP);
  return {
    ...seededMap,
    model: {
      ...seededMap.model,
      stations: autoPlaceLabels(seededMap, { preserveExisting: true, bootstrapMode: true }),
    },
  };
}

export function autoPlaceSheetLabels(map: RailwayMap, currentSheetId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      stations: autoPlaceLabels(map).map((station) => {
        if (!station.nodeId) return station;
        const node = map.model.nodes.find((candidate) => candidate.id === station.nodeId);
        return node?.sheetId === currentSheetId
          ? station
          : map.model.stations.find((candidate) => candidate.id === station.id) ?? station;
      }),
    },
  };
}

export function renameSheet(map: RailwayMap, sheetId: string, name: string) {
  return {
    ...map,
    model: {
      ...map.model,
      sheets: map.model.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, name } : sheet)),
    },
  };
}

export function deleteSheet(map: RailwayMap, sheetId: string) {
  const nodeIdsToRemove = new Set(map.model.nodes.filter((node) => node.sheetId === sheetId).map((node) => node.id));
  const segmentIdsToRemove = new Set(map.model.segments.filter((segment) => segment.sheetId === sheetId).map((segment) => segment.id));
  return {
    ...map,
    model: {
      ...map.model,
      sheets: map.model.sheets.filter((sheet) => sheet.id !== sheetId),
      nodes: map.model.nodes.filter((node) => node.sheetId !== sheetId),
      stations: map.model.stations.filter((station) => !station.nodeId || !nodeIdsToRemove.has(station.nodeId)),
      segments: map.model.segments.filter((segment) => segment.sheetId !== sheetId),
      lineRuns: map.model.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((segmentId) => !segmentIdsToRemove.has(segmentId)),
      })),
    },
  };
}

export function deleteSegment(map: RailwayMap, segmentId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.filter((segment) => segment.id !== segmentId),
      lineRuns: map.model.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId),
      })),
    },
  };
}

function buildOrthogonalElbow(from: MapPoint, to: MapPoint) {
  const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  return horizontalFirst
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
}

export function makeSegmentStraight(map: RailwayMap, segmentId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              geometry: { kind: "straight" as const },
            },
      ),
    },
  };
}

export function makeSegmentOrthogonal(map: RailwayMap, segmentId: string) {
  const segment = map.model.segments.find((candidate) => candidate.id === segmentId);
  if (!segment) return map;

  const from = map.model.nodes.find((candidate) => candidate.id === segment.fromNodeId);
  const to = map.model.nodes.find((candidate) => candidate.id === segment.toNodeId);
  if (!from || !to) return map;

  const fallbackElbow = buildOrthogonalElbow(from, to);
  const elbow =
    segment.geometry.kind === "orthogonal"
      ? segment.geometry.elbow
      : segment.geometry.kind === "polyline" && segment.geometry.points.length > 0
        ? segment.geometry.points[Math.floor((segment.geometry.points.length - 1) / 2)]
        : fallbackElbow;

  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((candidate) =>
        candidate.id !== segmentId
          ? candidate
          : {
              ...candidate,
              geometry: {
                kind: "orthogonal" as const,
                elbow,
              },
            },
      ),
    },
  };
}

export function updateSegmentOrthogonalElbow(map: RailwayMap, segmentId: string, elbow: MapPoint) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((segment) =>
        segment.id !== segmentId || segment.geometry.kind !== "orthogonal"
          ? segment
          : {
              ...segment,
              geometry: {
                ...segment.geometry,
                elbow,
              },
            },
      ),
    },
  };
}

export function makeSegmentPolyline(map: RailwayMap, segmentId: string) {
  const segment = map.model.segments.find((candidate) => candidate.id === segmentId);
  if (!segment) return map;

  const nodesById = new Map(map.model.nodes.map((node) => [node.id, node]));
  const points = buildSegmentPoints(segment, nodesById);
  if (points.length < 2) return map;

  const polylinePoints =
    segment.geometry.kind === "polyline"
      ? segment.geometry.points
      : segment.geometry.kind === "orthogonal"
        ? [segment.geometry.elbow]
        : [pointOnPathAtHalf(points)];

  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((candidate) =>
        candidate.id !== segmentId
          ? candidate
          : {
              ...candidate,
              geometry: {
                kind: "polyline" as const,
                points: polylinePoints,
              },
            },
      ),
    },
  };
}

export function addSegmentPolylinePoint(
  map: RailwayMap,
  segmentId: string,
  options?: {
    point?: MapPoint;
    snapPoint?: (point: MapPoint) => MapPoint;
  },
) {
  const segment = map.model.segments.find((candidate) => candidate.id === segmentId);
  if (!segment) return map;

  const nodesById = new Map(map.model.nodes.map((node) => [node.id, node]));
  const sourcePoints = buildSegmentPoints(segment, nodesById);
  if (sourcePoints.length < 2) return map;

  const nearestLegIndex = options?.point
    ? sourcePoints.reduce(
        (bestIndex, _, index) => {
          if (index >= sourcePoints.length - 1 || !options.point) return bestIndex;
          const currentDistance = pointToSegmentDistance(options.point, sourcePoints[index], sourcePoints[index + 1]);
          const bestDistance = pointToSegmentDistance(options.point, sourcePoints[bestIndex], sourcePoints[bestIndex + 1]);
          return currentDistance < bestDistance ? index : bestIndex;
        },
        0,
      )
    : sourcePoints.reduce(
        (bestIndex, _, index) => {
          if (index >= sourcePoints.length - 1) return bestIndex;
          const currentLength = Math.hypot(sourcePoints[index + 1].x - sourcePoints[index].x, sourcePoints[index + 1].y - sourcePoints[index].y);
          const bestLength = Math.hypot(sourcePoints[bestIndex + 1].x - sourcePoints[bestIndex].x, sourcePoints[bestIndex + 1].y - sourcePoints[bestIndex].y);
          return currentLength > bestLength ? index : bestIndex;
        },
        0,
      );
  const midpoint = {
    x: (sourcePoints[nearestLegIndex].x + sourcePoints[nearestLegIndex + 1].x) / 2,
    y: (sourcePoints[nearestLegIndex].y + sourcePoints[nearestLegIndex + 1].y) / 2,
  };
  const insertedPoint = options?.snapPoint
    ? options.snapPoint(options?.point ?? midpoint)
    : (options?.point ?? midpoint);
  const existingPoints =
    segment.geometry.kind === "polyline"
      ? [...segment.geometry.points]
      : segment.geometry.kind === "orthogonal"
        ? [segment.geometry.elbow]
        : [];
  const insertIndex = nearestLegIndex;
  existingPoints.splice(insertIndex, 0, insertedPoint);

  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((candidate) =>
        candidate.id !== segmentId
          ? candidate
          : {
              ...candidate,
              geometry: {
                kind: "polyline" as const,
                points: existingPoints,
              },
            },
      ),
    },
  };
}

export function updateSegmentPolylinePoint(map: RailwayMap, segmentId: string, pointIndex: number, point: MapPoint) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((segment) =>
        segment.id !== segmentId || segment.geometry.kind !== "polyline"
          ? segment
          : {
              ...segment,
              geometry: {
                ...segment.geometry,
                points: segment.geometry.points.map((candidate, index) => (index === pointIndex ? point : candidate)),
              },
            },
      ),
    },
  };
}

export function removeSegmentPolylinePoint(map: RailwayMap, segmentId: string, pointIndex: number) {
  return {
    ...map,
    model: {
      ...map.model,
      segments: map.model.segments.map((segment) => {
        if (segment.id !== segmentId || segment.geometry.kind !== "polyline") return segment;
        const remainingPoints = segment.geometry.points.filter((_, index) => index !== pointIndex);
        if (remainingPoints.length === 0) {
          return {
            ...segment,
            geometry: {
              kind: "straight" as const,
            },
          };
        }
        return {
          ...segment,
          geometry: {
            ...segment.geometry,
            points: remainingPoints,
          },
        };
      }),
    },
  };
}

export function insertTrackPointOnSegment(
  map: RailwayMap,
  segmentId: string,
  snapPoint?: (point: MapPoint) => MapPoint,
) {
  const source = map.model.segments.find((segment) => segment.id === segmentId);
  if (!source) return { map, insertedNode: null as MapNode | null };
  const sourcePoints = buildSegmentPoints(source, new Map(map.model.nodes.map((node) => [node.id, node])));
  if (sourcePoints.length < 2) return { map, insertedNode: null as MapNode | null };
  const halfwayPoint = pointOnPathAtHalf(sourcePoints);
  const insertedNode = {
    ...createDefaultNodeForSheet(map, source.sheetId),
    ...(snapPoint ? snapPoint(halfwayPoint) : halfwayPoint),
  };

  const currentSource = map.model.segments.find((segment) => segment.id === segmentId);
  if (!currentSource) return { map, insertedNode: null as MapNode | null };

  const firstSegment = createStraightSegmentForSheet(currentSource.sheetId, currentSource.fromNodeId, insertedNode.id);
  const secondSegment = createStraightSegmentForSheet(currentSource.sheetId, insertedNode.id, currentSource.toNodeId);
  firstSegment.fromLaneId = currentSource.fromLaneId;
  secondSegment.toLaneId = currentSource.toLaneId;

  return {
    map: {
      ...map,
      model: {
        ...map.model,
        nodes: [...map.model.nodes, insertedNode],
        segments: [...map.model.segments.filter((segment) => segment.id !== segmentId), firstSegment, secondSegment],
        lineRuns: map.model.lineRuns.map((lineRun) => ({
          ...lineRun,
          segmentIds: lineRun.segmentIds.flatMap((candidateId) => (candidateId === segmentId ? [firstSegment.id, secondSegment.id] : [candidateId])),
        })),
      },
    },
    insertedNode,
  };
}

function ensureLineRun(map: RailwayMap, lineId: string) {
  const existing = map.model.lineRuns.find((lineRun) => lineRun.lineId === lineId);
  if (existing) return { map, lineRun: existing };
  const lineRun: LineRun = { id: createLineRunId(), lineId, segmentIds: [] };
  return {
    map: {
      ...map,
      model: {
        ...map.model,
        lineRuns: [...map.model.lineRuns, lineRun],
      },
    },
    lineRun,
  };
}

export function assignLineToSegment(map: RailwayMap, lineId: string, segmentId: string) {
  const { map: ensuredMap, lineRun } = ensureLineRun(map, lineId);
  const segmentsByNodeId = new Map<string, Segment[]>();
  for (const segment of ensuredMap.model.segments) {
    const fromSegments = segmentsByNodeId.get(segment.fromNodeId) ?? [];
    fromSegments.push(segment);
    segmentsByNodeId.set(segment.fromNodeId, fromSegments);
    const toSegments = segmentsByNodeId.get(segment.toNodeId) ?? [];
    toSegments.push(segment);
    segmentsByNodeId.set(segment.toNodeId, toSegments);
  }
  const segmentIdsToAssign = new Set<string>();
  const queue = [segmentId];
  while (queue.length > 0) {
    const currentSegmentId = queue.shift();
    if (!currentSegmentId || segmentIdsToAssign.has(currentSegmentId)) continue;
    segmentIdsToAssign.add(currentSegmentId);
    const currentSegment = ensuredMap.model.segments.find((segment) => segment.id === currentSegmentId);
    if (!currentSegment) continue;
    for (const nodeId of [currentSegment.fromNodeId, currentSegment.toNodeId]) {
      const connectedSegments = segmentsByNodeId.get(nodeId) ?? [];
      if (connectedSegments.length !== 2) continue;
      for (const connectedSegment of connectedSegments) {
        if (!segmentIdsToAssign.has(connectedSegment.id)) {
          queue.push(connectedSegment.id);
        }
      }
    }
  }
  return {
    ...ensuredMap,
    model: {
      ...ensuredMap.model,
      lineRuns: ensuredMap.model.lineRuns.map((candidate) => {
        if (candidate.id === lineRun.id) {
          const segmentIds = [...candidate.segmentIds.filter((value) => !segmentIdsToAssign.has(value))];
          for (const propagatedSegmentId of segmentIdsToAssign) {
            if (!segmentIds.includes(propagatedSegmentId)) segmentIds.push(propagatedSegmentId);
          }
          return { ...candidate, segmentIds };
        }
        return {
          ...candidate,
          segmentIds: candidate.segmentIds.filter((value) => !segmentIdsToAssign.has(value)),
        };
      }),
    },
  };
}

export function unassignLineFromSegment(map: RailwayMap, lineId: string, segmentId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      lineRuns: map.model.lineRuns.map((lineRun) =>
        lineRun.lineId !== lineId ? lineRun : { ...lineRun, segmentIds: lineRun.segmentIds.filter((candidate) => candidate !== segmentId) },
      ),
    },
  };
}

function orientedSegmentThroughNode(segment: Segment, nodeId: string, nodesById: Map<string, MapNode>) {
  const points = buildSegmentPoints(segment, nodesById);
  if (points.length < 2) return null;

  if (segment.toNodeId === nodeId) {
    return {
      startNodeId: segment.fromNodeId,
      endNodeId: segment.toNodeId,
      startLaneId: segment.fromLaneId,
      endLaneId: segment.toLaneId,
      points,
    };
  }

  if (segment.fromNodeId === nodeId) {
    return {
      startNodeId: segment.toNodeId,
      endNodeId: segment.fromNodeId,
      startLaneId: segment.toLaneId,
      endLaneId: segment.fromLaneId,
      points: [...points].reverse(),
    };
  }

  return null;
}

export function removeTrackPoint(map: RailwayMap, nodeId: string) {
  const node = map.model.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return map;
  if (map.model.stations.some((station) => station.nodeId === nodeId)) return map;

  const connectedSegments = map.model.segments.filter((segment) => segment.fromNodeId === nodeId || segment.toNodeId === nodeId);
  if (connectedSegments.length !== 2) return map;

  const [firstSegment, secondSegment] = connectedSegments;
  const firstLineId = map.model.lineRuns.find((lineRun) => lineRun.segmentIds.includes(firstSegment.id))?.lineId ?? null;
  const secondLineId = map.model.lineRuns.find((lineRun) => lineRun.segmentIds.includes(secondSegment.id))?.lineId ?? null;
  if (firstLineId !== secondLineId) return map;
  if (firstSegment.sheetId !== secondSegment.sheetId) return map;

  const nodesById = new Map(map.model.nodes.map((candidate) => [candidate.id, candidate]));
  const firstOriented = orientedSegmentThroughNode(firstSegment, nodeId, nodesById);
  const secondOriented = orientedSegmentThroughNode(secondSegment, nodeId, nodesById);
  if (!firstOriented || !secondOriented) return map;

  const mergedPoints = [...firstOriented.points, ...secondOriented.points.slice(1)];
  const controlPoints = mergedPoints.slice(1, -1);
  const geometry =
    controlPoints.length === 0
      ? ({ kind: "straight" } as const)
      : controlPoints.length === 1
        ? ({ kind: "orthogonal", elbow: controlPoints[0] } as const)
        : ({ kind: "polyline", points: controlPoints } as const);
  const mergedSegmentId = createSegmentId();
  const mergedSegment: Segment = {
    id: mergedSegmentId,
    sheetId: firstSegment.sheetId,
    fromNodeId: firstOriented.startNodeId,
    toNodeId: secondOriented.startNodeId,
    fromLaneId: firstOriented.startLaneId,
    toLaneId: secondOriented.startLaneId,
    geometry,
  };
  const removedSegmentIds = new Set([firstSegment.id, secondSegment.id]);

  return {
    ...map,
    model: {
      ...map.model,
      nodes: map.model.nodes.filter((candidate) => candidate.id !== nodeId),
      nodeLanes: map.model.nodeLanes.filter((lane) => lane.nodeId !== nodeId),
      segments: [...map.model.segments.filter((candidate) => !removedSegmentIds.has(candidate.id)), mergedSegment],
      lineRuns: map.model.lineRuns.map((lineRun) => {
        if (!lineRun.segmentIds.some((segmentId) => removedSegmentIds.has(segmentId))) return lineRun;
        const replaced: string[] = [];
        let inserted = false;
        for (const segmentId of lineRun.segmentIds) {
          if (removedSegmentIds.has(segmentId)) {
            if (!inserted && lineRun.lineId === firstLineId) {
              replaced.push(mergedSegmentId);
              inserted = true;
            }
            continue;
          }
          replaced.push(segmentId);
        }
        return { ...lineRun, segmentIds: replaced };
      }),
    },
  };
}

export function deleteNodes(map: RailwayMap, nodeIds: string[]) {
  const nodeIdSet = new Set(nodeIds);
  const connectedSegmentIds = new Set(
    map.model.segments.filter((segment) => nodeIdSet.has(segment.fromNodeId) || nodeIdSet.has(segment.toNodeId)).map((segment) => segment.id),
  );
  return {
    ...map,
    model: {
      ...map.model,
      nodes: map.model.nodes.filter((node) => !nodeIdSet.has(node.id)),
      stations: map.model.stations.filter((station) => !station.nodeId || !nodeIdSet.has(station.nodeId)),
      segments: map.model.segments.filter((segment) => !connectedSegmentIds.has(segment.id)),
      lineRuns: map.model.lineRuns.map((lineRun) => ({
        ...lineRun,
        segmentIds: lineRun.segmentIds.filter((segmentId) => !connectedSegmentIds.has(segmentId)),
      })),
    },
  };
}

export function deleteStation(map: RailwayMap, stationId: string) {
  return {
    ...map,
    model: {
      ...map.model,
      stations: map.model.stations.filter((station) => station.id !== stationId),
    },
  };
}

export function deleteStationKind(map: RailwayMap, stationKindId: string, fallbackKindId: string) {
  return {
    ...map,
    config: {
      ...map.config,
      stationKinds: map.config.stationKinds.filter((kind) => kind.id !== stationKindId),
    },
    model: {
      ...map.model,
      stations: map.model.stations.map((station) => (station.kindId === stationKindId ? { ...station, kindId: fallbackKindId } : station)),
    },
  };
}

export function deleteLine(map: RailwayMap, lineId: string) {
  return {
    ...map,
    config: {
      ...map.config,
      lines: map.config.lines.filter((line) => line.id !== lineId),
    },
    model: {
      ...map.model,
      lineRuns: map.model.lineRuns.filter((lineRun) => lineRun.lineId !== lineId),
    },
  };
}

export function updateNode(map: RailwayMap, nodeId: string, originalNode: MapNode, patch: Partial<MapNode>) {
  return {
    ...map,
    model: {
      ...map.model,
      nodes: map.model.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      stations: map.model.stations.map((station) =>
        station.nodeId !== nodeId || !station.label
          ? station
          : {
              ...station,
              label: {
                ...station.label,
                x: station.label.x + ((patch.x ?? originalNode.x) - originalNode.x),
                y: station.label.y + ((patch.y ?? originalNode.y) - originalNode.y),
              },
            },
      ),
    },
  };
}

export function moveLaneOrder(map: RailwayMap, targetNodeIds: string[], referenceNodeId: string, laneId: string, direction: -1 | 1) {
  const referenceNodeLanes = map.model.nodeLanes.filter((lane) => lane.nodeId === referenceNodeId).sort((left, right) => left.order - right.order);
  const currentIndex = referenceNodeLanes.findIndex((lane) => lane.id === laneId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0) return map;
  const orderByLaneId = new Map<string, number>();
  for (const targetNodeId of targetNodeIds) {
    const nodeLanes = map.model.nodeLanes.filter((lane) => lane.nodeId === targetNodeId).sort((left, right) => left.order - right.order);
    if (nextIndex < 0 || nextIndex >= nodeLanes.length) continue;
    const reordered = [...nodeLanes];
    const [moved] = reordered.splice(currentIndex, 1);
    if (!moved) continue;
    reordered.splice(nextIndex, 0, moved);
    for (let index = 0; index < reordered.length; index += 1) {
      orderByLaneId.set(reordered[index].id, index);
    }
  }
  if (orderByLaneId.size === 0) return map;
  return {
    ...map,
    model: {
      ...map.model,
      nodeLanes: map.model.nodeLanes.map((lane) => (orderByLaneId.has(lane.id) ? { ...lane, order: orderByLaneId.get(lane.id) ?? lane.order } : lane)),
    },
  };
}

export function updateLine(map: RailwayMap, lineId: string, patch: Partial<Line>) {
  return {
    ...map,
    config: {
      ...map.config,
      lines: map.config.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    },
  };
}

export function updateStation(map: RailwayMap, stationId: string, patch: Partial<Station>) {
  return {
    ...map,
    model: {
      ...map.model,
      stations: map.model.stations.map((station) => (station.id === stationId ? { ...station, ...patch } : station)),
    },
  };
}

export function updateStationKind(map: RailwayMap, kindId: string, patch: Partial<StationKind>) {
  return {
    ...map,
    config: {
      ...map.config,
      stationKinds: map.config.stationKinds.map((kind) => (kind.id === kindId ? { ...kind, ...patch } : kind)),
    },
  };
}

export const commandDefaults = {
  DEFAULT_STATION_FONT_FAMILY,
  DEFAULT_STATION_FONT_WEIGHT,
  DEFAULT_STATION_FONT_SIZE,
  DEFAULT_STATION_SYMBOL_SIZE,
};
