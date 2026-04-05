import type { RailwayMap } from "./types";

const DEFAULT_STATION_FONT_FAMILY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_STATION_FONT_WEIGHT = "600" as const;
const DEFAULT_STATION_FONT_SIZE = 14;
const DEFAULT_STATION_SYMBOL_SIZE = 1;

function scaleMapLayout(map: RailwayMap, scaleX: number, scaleY: number, originX: number, originY: number): RailwayMap {
  return {
    ...map,
    model: {
      ...map.model,
      nodes: map.model.nodes.map((node) => ({
        ...node,
        x: originX + (node.x - originX) * scaleX,
        y: originY + (node.y - originY) * scaleY,
      })),
      stations: map.model.stations.map((station) => ({
        ...station,
        label: station.label
          ? {
              ...station.label,
              x: originX + (station.label.x - originX) * scaleX,
              y: originY + (station.label.y - originY) * scaleY,
            }
          : station.label,
      })),
    },
  };
}

function directedEdgeKey(fromNodeId: string, toNodeId: string) {
  return `${fromNodeId}::${toNodeId}`;
}

function snapVectorToOctilinear(
  deltaX: number,
  deltaY: number,
  step: number,
  preferredDirection?: { x: number; y: number } | null,
) {
  if (deltaX === 0 && deltaY === 0) {
    return { x: step, y: 0 };
  }

  const directions = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ] as const;
  const direction = preferredDirection
    ? directions.find((candidate) => candidate.x === preferredDirection.x && candidate.y === preferredDirection.y) ?? directions[0]
    : (() => {
        const angle = Math.atan2(deltaY, deltaX);
        const eighthTurn = Math.PI / 4;
        const snappedIndex = (((Math.round(angle / eighthTurn) % 8) + 8) % 8);
        return directions[snappedIndex];
      })();
  const length = Math.hypot(deltaX, deltaY);
  const isDiagonal = direction.x !== 0 && direction.y !== 0;
  const units = Math.max(1, Math.round(length / (isDiagonal ? Math.SQRT2 * step : step)));

  return {
    x: direction.x * units * step,
    y: direction.y * units * step,
  };
}

function octilinearizeMapLayout(
  map: RailwayMap,
  rootNodeId: string,
  step: number,
  preferredEdgeDirections: Record<string, { x: number; y: number }> = {},
): RailwayMap {
  const originalNodesById = new Map(map.model.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();

  for (const node of map.model.nodes) {
    adjacency.set(node.id, []);
  }

  for (const segment of map.model.segments) {
    const fromList = adjacency.get(segment.fromNodeId) ?? [];
    fromList.push(segment.toNodeId);
    adjacency.set(segment.fromNodeId, fromList);

    const toList = adjacency.get(segment.toNodeId) ?? [];
    toList.push(segment.fromNodeId);
    adjacency.set(segment.toNodeId, toList);
  }

  const root = originalNodesById.get(rootNodeId) ?? map.model.nodes[0];
  if (!root) return map;

  const assignedPositions = new Map<string, { x: number; y: number }>();
  assignedPositions.set(root.id, { x: root.x, y: root.y });

  const queue = [root.id];
  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const currentOriginal = originalNodesById.get(currentNodeId);
    const currentAssigned = assignedPositions.get(currentNodeId);
    if (!currentOriginal || !currentAssigned) continue;

    for (const nextNodeId of adjacency.get(currentNodeId) ?? []) {
      if (assignedPositions.has(nextNodeId)) continue;
      const nextOriginal = originalNodesById.get(nextNodeId);
      if (!nextOriginal) continue;

      const directPreference = preferredEdgeDirections[directedEdgeKey(currentNodeId, nextNodeId)] ?? null;
      const reversePreference = preferredEdgeDirections[directedEdgeKey(nextNodeId, currentNodeId)] ?? null;
      const preferredDirection = directPreference
        ? directPreference
        : reversePreference
          ? { x: -reversePreference.x, y: -reversePreference.y }
          : null;

      const snappedDelta = snapVectorToOctilinear(
        nextOriginal.x - currentOriginal.x,
        nextOriginal.y - currentOriginal.y,
        step,
        preferredDirection,
      );

      assignedPositions.set(nextNodeId, {
        x: currentAssigned.x + snappedDelta.x,
        y: currentAssigned.y + snappedDelta.y,
      });
      queue.push(nextNodeId);
    }
  }

  return {
    ...map,
    model: {
      ...map.model,
      nodes: map.model.nodes.map((node) => ({
        ...node,
        x: assignedPositions.get(node.id)?.x ?? node.x,
        y: assignedPositions.get(node.id)?.y ?? node.y,
      })),
    },
  };
}

type BootstrapLabelSide = "left" | "right" | "top" | "bottom";

function estimateBootstrapLabelWidth(label: string, fontSize: number) {
  return Math.max(38, label.length * (fontSize * 0.54));
}

function resolveValenciaBootstrapLabelSide(stationId: string): BootstrapLabelSide {
  if (stationId.startsWith("s-c5-")) return "left";
  if (stationId.startsWith("s-c6-")) return "right";
  if (stationId === "s-sagunt") return "right";
  if (["s-pucol", "s-puig", "s-massalfassar", "s-albuixech", "s-roca", "s-cabanyal", "s-font", "s-nord"].includes(stationId)) {
    return "right";
  }
  if (["s-c3-0", "s-c3-0a", "s-c3-1", "s-c3-2", "s-c3-2a", "s-c3-3", "s-c3-4"].includes(stationId)) {
    return "left";
  }
  if (["s-c3-5", "s-c3-6", "s-c3-7", "s-c3-8", "s-c3-9"].includes(stationId)) {
    return "top";
  }
  if (["s-c3-6a", "s-c3-8a"].includes(stationId)) {
    return "bottom";
  }
  if (["s-alfafar", "s-massanassa", "s-catarroja", "s-albal", "s-silla"].includes(stationId)) {
    return "right";
  }
  if (stationId.startsWith("s-c1-")) return "right";
  if (stationId.startsWith("s-c2-")) return "left";
  return "right";
}

function applyValenciaBootstrapLabelLayout(map: RailwayMap): RailwayMap {
  const nodesById = new Map(map.model.nodes.map((node) => [node.id, node]));
  const stationKindsById = new Map(map.config.stationKinds.map((kind) => [kind.id, kind]));

  return {
    ...map,
    model: {
      ...map.model,
      stations: map.model.stations.map((station) => {
        if (!station.nodeId) return station;
        const node = nodesById.get(station.nodeId);
        if (!node) return station;

        const fontSize = stationKindsById.get(station.kindId)?.fontSize ?? DEFAULT_STATION_FONT_SIZE;
        const width = estimateBootstrapLabelWidth(station.name, fontSize);
        const side = resolveValenciaBootstrapLabelSide(station.id);

        const label =
          side === "left"
            ? { x: node.x - width - 18, y: node.y - 8, align: "left" as const }
            : side === "top"
              ? { x: node.x - width / 2, y: node.y - 18, align: "top" as const }
              : side === "bottom"
                ? { x: node.x - width / 2, y: node.y + fontSize + 14, align: "bottom" as const }
                : { x: node.x + 18, y: node.y - 8, align: "right" as const };

        const extraX =
          station.id === "s-c6-2a" ? 12 :
          station.id === "s-c5-7" ? -12 :
          station.id === "s-nord" ? 18 :
          station.id === "s-font" ? 12 :
          0;
        const extraY =
          station.id === "s-nord" ? 10 :
          station.id === "s-font" ? 4 :
          station.id === "s-sagunt" ? -4 :
          0;

        return {
          ...station,
          label: {
            ...label,
            x: label.x + extraX,
            y: label.y + extraY,
            rotation: 0,
          },
        };
      }),
    },
  };
}

const VALENCIA_BOOTSTRAP_EDGE_DIRECTIONS: Record<string, { x: number; y: number }> = {
  "n-c5-0::n-c5-1": { x: 1, y: 1 },
  "n-c5-1::n-c5-2": { x: 1, y: 1 },
  "n-c5-2::n-c5-3": { x: 1, y: 1 },
  "n-c5-3::n-c5-4": { x: 1, y: 1 },
  "n-c5-4::n-c5-5": { x: 1, y: 1 },
  "n-c5-5::n-c5-6": { x: 1, y: 1 },
  "n-c5-6::n-c5-7": { x: 1, y: 1 },
  "n-c5-7::n-c5-8": { x: 1, y: 1 },
  "n-c5-8::n-sagunt": { x: 1, y: 1 },
  "n-c6-0::n-c6-1": { x: -1, y: 1 },
  "n-c6-1::n-c6-2": { x: -1, y: 1 },
  "n-c6-2::n-c6-2a": { x: -1, y: 1 },
  "n-c6-2a::n-c6-3": { x: -1, y: 1 },
  "n-c6-3::n-c6-4": { x: -1, y: 1 },
  "n-c6-4::n-c6-5": { x: -1, y: 1 },
  "n-c6-5::n-c6-6": { x: -1, y: 1 },
  "n-c6-6::n-c6-7": { x: -1, y: 1 },
  "n-c6-7::n-c6-8": { x: -1, y: 1 },
  "n-c6-8::n-sagunt": { x: -1, y: 1 },
  "n-sagunt::n-pucol": { x: 0, y: 1 },
  "n-pucol::n-puig": { x: 0, y: 1 },
  "n-puig::n-massalfassar": { x: 0, y: 1 },
  "n-massalfassar::n-albuixech": { x: 0, y: 1 },
  "n-albuixech::n-roca-cuper": { x: 0, y: 1 },
  "n-roca-cuper::n-cabanyal": { x: 0, y: 1 },
  "n-cabanyal::n-font": { x: 0, y: 1 },
  "n-font::n-nord": { x: 0, y: 1 },
  "n-c3-0::n-c3-0a": { x: 1, y: 1 },
  "n-c3-0a::n-c3-1": { x: 1, y: 1 },
  "n-c3-1::n-c3-2": { x: 1, y: 1 },
  "n-c3-2::n-c3-2a": { x: 1, y: 1 },
  "n-c3-2a::n-c3-3": { x: 1, y: 1 },
  "n-c3-3::n-c3-4": { x: 1, y: 1 },
  "n-c3-4::n-c3-5": { x: 1, y: 0 },
  "n-c3-5::n-c3-6": { x: 1, y: 0 },
  "n-c3-6::n-c3-6a": { x: 1, y: 0 },
  "n-c3-6a::n-c3-7": { x: 1, y: 0 },
  "n-c3-7::n-c3-8": { x: 1, y: 0 },
  "n-c3-8::n-c3-8a": { x: 1, y: 0 },
  "n-c3-8a::n-c3-9": { x: 1, y: 0 },
  "n-c3-9::n-font": { x: 1, y: -1 },
  "n-nord::n-alfafar": { x: -1, y: 1 },
  "n-alfafar::n-massanassa": { x: -1, y: 1 },
  "n-massanassa::n-catarroja": { x: -1, y: 1 },
  "n-catarroja::n-albal": { x: -1, y: 1 },
  "n-albal::n-silla": { x: -1, y: 1 },
  "n-silla::n-c1-0a": { x: 1, y: 1 },
  "n-c1-0a::n-c1-0": { x: 1, y: 1 },
  "n-c1-0::n-c1-1": { x: 1, y: 1 },
  "n-c1-1::n-c1-2": { x: 1, y: 1 },
  "n-c1-2::n-c1-3": { x: 1, y: 1 },
  "n-c1-3::n-c1-4": { x: 1, y: 1 },
  "n-c1-4::n-c1-5": { x: 1, y: 1 },
  "n-c1-5::n-c1-6": { x: 0, y: 1 },
  "n-silla::n-c2-0": { x: 0, y: 1 },
  "n-c2-0::n-c2-1": { x: 0, y: 1 },
  "n-c2-1::n-c2-2": { x: 0, y: 1 },
  "n-c2-2::n-c2-3": { x: 0, y: 1 },
  "n-c2-3::n-c2-3a": { x: 0, y: 1 },
  "n-c2-3a::n-c2-4": { x: 0, y: 1 },
  "n-c2-4::n-c2-5": { x: 0, y: 1 },
  "n-c2-5::n-c2-6": { x: 0, y: 1 },
  "n-c2-6::n-c2-7": { x: 0, y: 1 },
  "n-c2-7::n-c2-8": { x: 0, y: 1 },
  "n-c2-8::n-c2-9": { x: 0, y: 1 },
};

export const LINE_PRESETS = [
  { id: "C1", color: "#e11d48", strokeWidth: 10, strokeStyle: "solid" as const },
  { id: "C2", color: "#2563eb", strokeWidth: 10, strokeStyle: "dashed" as const },
  { id: "C3", color: "#16a34a", strokeWidth: 10, strokeStyle: "solid" as const },
  { id: "C4", color: "#f59e0b", strokeWidth: 10, strokeStyle: "dotted" as const },
  { id: "C5", color: "#7c3aed", strokeWidth: 10, strokeStyle: "solid" as const },
  { id: "C6", color: "#0891b2", strokeWidth: 10, strokeStyle: "dashed" as const },
];

export const INITIAL_MAP: RailwayMap = {
  config: {
    stationKinds: [
      { id: "sk1", name: "Stop", shape: "circle", symbolSize: DEFAULT_STATION_SYMBOL_SIZE, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: DEFAULT_STATION_FONT_WEIGHT, fontSize: DEFAULT_STATION_FONT_SIZE },
      { id: "sk2", name: "Hub", shape: "interchange", symbolSize: 0.8, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: "700", fontSize: 15 },
      { id: "sk3", name: "Terminal", shape: "terminal", symbolSize: DEFAULT_STATION_SYMBOL_SIZE, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: DEFAULT_STATION_FONT_WEIGHT, fontSize: DEFAULT_STATION_FONT_SIZE },
    ],
    lines: [
      { id: "l1", name: "C1", color: "#e11d48", strokeWidth: 10, strokeStyle: "solid" },
      { id: "l2", name: "C2", color: "#2563eb", strokeWidth: 10, strokeStyle: "dashed" },
      { id: "l3", name: "C3", color: "#16a34a", strokeWidth: 10, strokeStyle: "solid" },
    ],
  },
  model: {
  sheets: [
    { id: "sh1", name: "Regional Overview" },
    { id: "sh2", name: "Urban Detail" },
  ],
  nodes: [
    { id: "n1", sheetId: "sh1", x: 170, y: 220 },
    { id: "n2", sheetId: "sh1", x: 340, y: 220 },
    { id: "n3", sheetId: "sh1", x: 510, y: 220 },
    { id: "n4", sheetId: "sh1", x: 680, y: 220 },
    { id: "n5", sheetId: "sh1", x: 340, y: 360 },
    { id: "n6", sheetId: "sh1", x: 510, y: 360 },
    { id: "n7", sheetId: "sh1", x: 510, y: 110 },
    { id: "n8", sheetId: "sh1", x: 680, y: 110 },
    { id: "n9", sheetId: "sh2", x: 200, y: 220 },
    { id: "n10", sheetId: "sh2", x: 320, y: 220 },
    { id: "n11", sheetId: "sh2", x: 440, y: 220 },
    { id: "n12", sheetId: "sh2", x: 560, y: 220 },
    { id: "n13", sheetId: "sh2", x: 320, y: 340 },
    { id: "n14", sheetId: "sh2", x: 440, y: 340 },
  ],
  nodeLanes: [],
  stations: [
    { id: "s1", nodeId: "n1", name: "Westside", kindId: "sk3", label: { x: 170, y: 196, align: "top" } },
    { id: "s2", nodeId: "n2", name: "Central Park", kindId: "sk2", label: { x: 340, y: 196, align: "top" } },
    { id: "s3", nodeId: "n3", name: "Museum", kindId: "sk2", label: { x: 510, y: 196, align: "top" } },
    { id: "s4", nodeId: "n4", name: "Eastside", kindId: "sk3", label: { x: 680, y: 196, align: "top" } },
    { id: "s5", nodeId: "n5", name: "Harbor", kindId: "sk1", label: { x: 340, y: 386, align: "bottom" } },
    { id: "s6", nodeId: "n6", name: "Airport", kindId: "sk3", label: { x: 510, y: 386, align: "bottom" } },
    { id: "s7", nodeId: "n8", name: "North Hill", kindId: "sk3", label: { x: 680, y: 86, align: "top" } },
    { id: "s8", nodeId: "n9", name: "Inner West", kindId: "sk1", label: { x: 200, y: 196, align: "top" } },
    { id: "s9", nodeId: "n10", name: "Central", kindId: "sk2", label: { x: 320, y: 196, align: "top" } },
    { id: "s10", nodeId: "n11", name: "Market", kindId: "sk2", label: { x: 440, y: 196, align: "top" } },
    { id: "s11", nodeId: "n12", name: "East Gate", kindId: "sk3", label: { x: 560, y: 196, align: "top" } },
    { id: "s12", nodeId: "n13", name: "Docklands", kindId: "sk1", label: { x: 320, y: 366, align: "bottom" } },
    { id: "s13", nodeId: "n14", name: "Airport Spur", kindId: "sk3", label: { x: 440, y: 366, align: "bottom" } },
  ],
  segments: [
    { id: "sg1", sheetId: "sh1", fromNodeId: "n1", toNodeId: "n2", geometry: { kind: "straight" } },
    { id: "sg2", sheetId: "sh1", fromNodeId: "n2", toNodeId: "n3", geometry: { kind: "straight" } },
    { id: "sg3", sheetId: "sh1", fromNodeId: "n3", toNodeId: "n4", geometry: { kind: "straight" } },
    { id: "sg4", sheetId: "sh1", fromNodeId: "n2", toNodeId: "n5", geometry: { kind: "straight" } },
    { id: "sg5", sheetId: "sh1", fromNodeId: "n5", toNodeId: "n6", geometry: { kind: "straight" } },
    { id: "sg6", sheetId: "sh1", fromNodeId: "n3", toNodeId: "n7", geometry: { kind: "straight" } },
    { id: "sg7", sheetId: "sh1", fromNodeId: "n7", toNodeId: "n8", geometry: { kind: "straight" } },
    { id: "sg8", sheetId: "sh2", fromNodeId: "n9", toNodeId: "n10", geometry: { kind: "straight" } },
    { id: "sg9", sheetId: "sh2", fromNodeId: "n10", toNodeId: "n11", geometry: { kind: "straight" } },
    { id: "sg10", sheetId: "sh2", fromNodeId: "n11", toNodeId: "n12", geometry: { kind: "straight" } },
    { id: "sg11", sheetId: "sh2", fromNodeId: "n10", toNodeId: "n13", geometry: { kind: "straight" } },
    { id: "sg12", sheetId: "sh2", fromNodeId: "n13", toNodeId: "n14", geometry: { kind: "straight" } },
  ],
  lineRuns: [
    { id: "lr1", lineId: "l1", segmentIds: ["sg1", "sg2", "sg3"] },
    { id: "lr2", lineId: "l2", segmentIds: ["sg1", "sg2", "sg6", "sg7", "sg8", "sg9", "sg10"] },
    { id: "lr3", lineId: "l3", segmentIds: ["sg2", "sg4", "sg5", "sg9", "sg11", "sg12"] },
  ],
  },
};

const DEVELOPMENT_BOOTSTRAP_MAP_BASE: RailwayMap = {
  config: {
    stationKinds: [
      { id: "sk-stop", name: "Stop", shape: "circle", symbolSize: DEFAULT_STATION_SYMBOL_SIZE, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: DEFAULT_STATION_FONT_WEIGHT, fontSize: DEFAULT_STATION_FONT_SIZE },
      { id: "sk-hub", name: "Hub", shape: "interchange", symbolSize: 0.8, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: "700", fontSize: 15 },
      { id: "sk-terminal", name: "Terminal", shape: "terminal", symbolSize: DEFAULT_STATION_SYMBOL_SIZE, fontFamily: DEFAULT_STATION_FONT_FAMILY, fontWeight: DEFAULT_STATION_FONT_WEIGHT, fontSize: DEFAULT_STATION_FONT_SIZE },
    ],
    lines: [
      { id: "l-c1", name: "C1", color: "#74b6f2", strokeWidth: 9, strokeStyle: "solid" },
      { id: "l-c2", name: "C2", color: "#facc15", strokeWidth: 9, strokeStyle: "solid" },
      { id: "l-c3", name: "C3", color: "#8b1fa9", strokeWidth: 9, strokeStyle: "solid" },
      { id: "l-c5", name: "C5", color: "#65a30d", strokeWidth: 9, strokeStyle: "solid" },
      { id: "l-c6", name: "C6", color: "#1d4ed8", strokeWidth: 9, strokeStyle: "solid" },
    ],
  },
  model: {
    sheets: [{ id: "sh-ov", name: "Rodalia València Overview" }],
    nodes: [
      { id: "n-c5-0", sheetId: "sh-ov", x: 300, y: 80 },
      { id: "n-c5-1", sheetId: "sh-ov", x: 340, y: 120 },
      { id: "n-c5-2", sheetId: "sh-ov", x: 380, y: 160 },
      { id: "n-c5-3", sheetId: "sh-ov", x: 420, y: 200 },
      { id: "n-c5-4", sheetId: "sh-ov", x: 460, y: 240 },
      { id: "n-c5-5", sheetId: "sh-ov", x: 500, y: 280 },
      { id: "n-c5-6", sheetId: "sh-ov", x: 540, y: 320 },
      { id: "n-c5-7", sheetId: "sh-ov", x: 580, y: 360 },
      { id: "n-c5-8", sheetId: "sh-ov", x: 620, y: 400 },
      { id: "n-sagunt", sheetId: "sh-ov", x: 660, y: 440 },
      { id: "n-c6-0", sheetId: "sh-ov", x: 1010, y: 60 },
      { id: "n-c6-1", sheetId: "sh-ov", x: 970, y: 100 },
      { id: "n-c6-2", sheetId: "sh-ov", x: 930, y: 140 },
      { id: "n-c6-2a", sheetId: "sh-ov", x: 910, y: 160 },
      { id: "n-c6-3", sheetId: "sh-ov", x: 890, y: 180 },
      { id: "n-c6-4", sheetId: "sh-ov", x: 850, y: 220 },
      { id: "n-c6-5", sheetId: "sh-ov", x: 810, y: 260 },
      { id: "n-c6-6", sheetId: "sh-ov", x: 770, y: 300 },
      { id: "n-c6-7", sheetId: "sh-ov", x: 730, y: 340 },
      { id: "n-c6-8", sheetId: "sh-ov", x: 695, y: 390 },
      { id: "n-pucol", sheetId: "sh-ov", x: 660, y: 500 },
      { id: "n-puig", sheetId: "sh-ov", x: 660, y: 560 },
      { id: "n-massalfassar", sheetId: "sh-ov", x: 660, y: 620 },
      { id: "n-albuixech", sheetId: "sh-ov", x: 660, y: 680 },
      { id: "n-roca-cuper", sheetId: "sh-ov", x: 660, y: 740 },
      { id: "n-cabanyal", sheetId: "sh-ov", x: 660, y: 800 },
      { id: "n-font", sheetId: "sh-ov", x: 660, y: 860 },
      { id: "n-nord", sheetId: "sh-ov", x: 660, y: 920 },
      { id: "n-c3-0", sheetId: "sh-ov", x: 120, y: 760 },
      { id: "n-c3-0a", sheetId: "sh-ov", x: 150, y: 780 },
      { id: "n-c3-1", sheetId: "sh-ov", x: 180, y: 800 },
      { id: "n-c3-2", sheetId: "sh-ov", x: 240, y: 840 },
      { id: "n-c3-2a", sheetId: "sh-ov", x: 270, y: 860 },
      { id: "n-c3-3", sheetId: "sh-ov", x: 300, y: 880 },
      { id: "n-c3-4", sheetId: "sh-ov", x: 360, y: 920 },
      { id: "n-c3-5", sheetId: "sh-ov", x: 420, y: 920 },
      { id: "n-c3-6", sheetId: "sh-ov", x: 480, y: 920 },
      { id: "n-c3-6a", sheetId: "sh-ov", x: 520, y: 920 },
      { id: "n-c3-7", sheetId: "sh-ov", x: 540, y: 920 },
      { id: "n-c3-8", sheetId: "sh-ov", x: 580, y: 920 },
      { id: "n-c3-8a", sheetId: "sh-ov", x: 600, y: 920 },
      { id: "n-c3-9", sheetId: "sh-ov", x: 620, y: 920 },
      { id: "n-alfafar", sheetId: "sh-ov", x: 620, y: 980 },
      { id: "n-massanassa", sheetId: "sh-ov", x: 580, y: 1040 },
      { id: "n-catarroja", sheetId: "sh-ov", x: 540, y: 1100 },
      { id: "n-albal", sheetId: "sh-ov", x: 500, y: 1160 },
      { id: "n-silla", sheetId: "sh-ov", x: 460, y: 1220 },
      { id: "n-c1-0a", sheetId: "sh-ov", x: 500, y: 1260 },
      { id: "n-c1-0", sheetId: "sh-ov", x: 540, y: 1300 },
      { id: "n-c1-1", sheetId: "sh-ov", x: 620, y: 1380 },
      { id: "n-c1-2", sheetId: "sh-ov", x: 700, y: 1460 },
      { id: "n-c1-3", sheetId: "sh-ov", x: 780, y: 1540 },
      { id: "n-c1-4", sheetId: "sh-ov", x: 860, y: 1620 },
      { id: "n-c1-5", sheetId: "sh-ov", x: 940, y: 1700 },
      { id: "n-c1-6", sheetId: "sh-ov", x: 940, y: 1760 },
      { id: "n-c2-0", sheetId: "sh-ov", x: 460, y: 1280 },
      { id: "n-c2-1", sheetId: "sh-ov", x: 460, y: 1340 },
      { id: "n-c2-2", sheetId: "sh-ov", x: 460, y: 1400 },
      { id: "n-c2-3", sheetId: "sh-ov", x: 460, y: 1460 },
      { id: "n-c2-3a", sheetId: "sh-ov", x: 460, y: 1490 },
      { id: "n-c2-4", sheetId: "sh-ov", x: 460, y: 1520 },
      { id: "n-c2-5", sheetId: "sh-ov", x: 460, y: 1580 },
      { id: "n-c2-6", sheetId: "sh-ov", x: 460, y: 1640 },
      { id: "n-c2-7", sheetId: "sh-ov", x: 460, y: 1700 },
      { id: "n-c2-8", sheetId: "sh-ov", x: 460, y: 1760 },
      { id: "n-c2-9", sheetId: "sh-ov", x: 460, y: 1820 },
    ],
    nodeLanes: [],
    stations: [
      { id: "s-c5-0", nodeId: "n-c5-0", name: "Caudiel", kindId: "sk-terminal", label: { x: 276, y: 68, align: "left" } },
      { id: "s-c5-1", nodeId: "n-c5-1", name: "Jérica-Viver", kindId: "sk-stop", label: { x: 316, y: 108, align: "left" } },
      { id: "s-c5-2", nodeId: "n-c5-2", name: "Navajas", kindId: "sk-stop", label: { x: 356, y: 148, align: "left" } },
      { id: "s-c5-3", nodeId: "n-c5-3", name: "Segorbe Arrabal", kindId: "sk-stop", label: { x: 396, y: 188, align: "left" } },
      { id: "s-c5-4", nodeId: "n-c5-4", name: "Segorbe Ciudad", kindId: "sk-stop", label: { x: 436, y: 228, align: "left" } },
      { id: "s-c5-5", nodeId: "n-c5-5", name: "Soneja", kindId: "sk-stop", label: { x: 476, y: 268, align: "left" } },
      { id: "s-c5-6", nodeId: "n-c5-6", name: "Algimia Ciudad", kindId: "sk-stop", label: { x: 516, y: 308, align: "left" } },
      { id: "s-c5-7", nodeId: "n-c5-7", name: "Estivella-Albalat dels Tarongers", kindId: "sk-stop", label: { x: 556, y: 348, align: "left" } },
      { id: "s-c5-8", nodeId: "n-c5-8", name: "Gilet", kindId: "sk-stop", label: { x: 596, y: 388, align: "left" } },
      { id: "s-sagunt", nodeId: "n-sagunt", name: "Sagunt/Sagunto", kindId: "sk-hub", label: { x: 684, y: 430, align: "right" } },
      { id: "s-c6-0", nodeId: "n-c6-0", name: "Castelló de la Plana", kindId: "sk-terminal", label: { x: 1034, y: 48, align: "right" } },
      { id: "s-c6-1", nodeId: "n-c6-1", name: "Almassora", kindId: "sk-stop", label: { x: 994, y: 88, align: "right" } },
      { id: "s-c6-2", nodeId: "n-c6-2", name: "Vila-real", kindId: "sk-stop", label: { x: 954, y: 128, align: "right" } },
      { id: "s-c6-2a", nodeId: "n-c6-2a", name: "Borriana/Burriana-les Alqueries/Alquerías del Niño Perdido", kindId: "sk-stop", label: { x: 934, y: 148, align: "right" } },
      { id: "s-c6-3", nodeId: "n-c6-3", name: "Nules-La Vilavella", kindId: "sk-stop", label: { x: 914, y: 168, align: "right" } },
      { id: "s-c6-4", nodeId: "n-c6-4", name: "Moncofa", kindId: "sk-stop", label: { x: 874, y: 208, align: "right" } },
      { id: "s-c6-5", nodeId: "n-c6-5", name: "Xilxes/Chilches", kindId: "sk-stop", label: { x: 834, y: 248, align: "right" } },
      { id: "s-c6-6", nodeId: "n-c6-6", name: "La Llosa", kindId: "sk-stop", label: { x: 794, y: 288, align: "right" } },
      { id: "s-c6-7", nodeId: "n-c6-7", name: "Almenara", kindId: "sk-stop", label: { x: 754, y: 328, align: "right" } },
      { id: "s-c6-8", nodeId: "n-c6-8", name: "les Valls", kindId: "sk-stop", label: { x: 719, y: 378, align: "right" } },
      { id: "s-pucol", nodeId: "n-pucol", name: "Puçol", kindId: "sk-stop", label: { x: 684, y: 488, align: "right" } },
      { id: "s-puig", nodeId: "n-puig", name: "el Puig de Santa Maria", kindId: "sk-stop", label: { x: 684, y: 548, align: "right" } },
      { id: "s-massalfassar", nodeId: "n-massalfassar", name: "Massalfassar", kindId: "sk-stop", label: { x: 684, y: 608, align: "right" } },
      { id: "s-albuixech", nodeId: "n-albuixech", name: "Albuixech", kindId: "sk-stop", label: { x: 684, y: 668, align: "right" } },
      { id: "s-roca", nodeId: "n-roca-cuper", name: "Roca-Cúper", kindId: "sk-stop", label: { x: 684, y: 728, align: "right" } },
      { id: "s-cabanyal", nodeId: "n-cabanyal", name: "València Cabanyal", kindId: "sk-stop", label: { x: 684, y: 788, align: "right" } },
      { id: "s-font", nodeId: "n-font", name: "València la Font de Sant Lluís", kindId: "sk-hub", label: { x: 684, y: 848, align: "right" } },
      { id: "s-nord", nodeId: "n-nord", name: "València Estació del Nord", kindId: "sk-hub", label: { x: 684, y: 908, align: "right" } },
      { id: "s-c3-0", nodeId: "n-c3-0", name: "Utiel", kindId: "sk-terminal", label: { x: 96, y: 748, align: "left" } },
      { id: "s-c3-0a", nodeId: "n-c3-0a", name: "San Antonio de Requena", kindId: "sk-stop", label: { x: 126, y: 768, align: "left" } },
      { id: "s-c3-1", nodeId: "n-c3-1", name: "Requena", kindId: "sk-stop", label: { x: 156, y: 788, align: "left" } },
      { id: "s-c3-2", nodeId: "n-c3-2", name: "El Rebollar", kindId: "sk-stop", label: { x: 216, y: 828, align: "left" } },
      { id: "s-c3-2a", nodeId: "n-c3-2a", name: "Siete Aguas", kindId: "sk-stop", label: { x: 246, y: 848, align: "left" } },
      { id: "s-c3-3", nodeId: "n-c3-3", name: "Venta Mina-Siete Aguas", kindId: "sk-stop", label: { x: 276, y: 868, align: "left" } },
      { id: "s-c3-4", nodeId: "n-c3-4", name: "Buñol", kindId: "sk-stop", label: { x: 336, y: 908, align: "left" } },
      { id: "s-c3-5", nodeId: "n-c3-5", name: "Chiva", kindId: "sk-stop", label: { x: 420, y: 896, align: "top" } },
      { id: "s-c3-6", nodeId: "n-c3-6", name: "Cheste", kindId: "sk-stop", label: { x: 480, y: 896, align: "top" } },
      { id: "s-c3-6a", nodeId: "n-c3-6a", name: "Circuit Ricardo Tormo", kindId: "sk-stop", label: { x: 520, y: 944, align: "bottom" } },
      { id: "s-c3-7", nodeId: "n-c3-7", name: "Loriguilla-Reva", kindId: "sk-stop", label: { x: 540, y: 896, align: "top" } },
      { id: "s-c3-8", nodeId: "n-c3-8", name: "Aldaia", kindId: "sk-stop", label: { x: 580, y: 896, align: "top" } },
      { id: "s-c3-8a", nodeId: "n-c3-8a", name: "Xirivella Alqueries", kindId: "sk-stop", label: { x: 600, y: 944, align: "bottom" } },
      { id: "s-c3-9", nodeId: "n-c3-9", name: "València Sant Isidre", kindId: "sk-stop", label: { x: 620, y: 896, align: "top" } },
      { id: "s-alfafar", nodeId: "n-alfafar", name: "Alfafar-Benetússer", kindId: "sk-stop", label: { x: 644, y: 968, align: "right" } },
      { id: "s-massanassa", nodeId: "n-massanassa", name: "Massanassa", kindId: "sk-stop", label: { x: 604, y: 1028, align: "right" } },
      { id: "s-catarroja", nodeId: "n-catarroja", name: "Catarroja", kindId: "sk-stop", label: { x: 564, y: 1088, align: "right" } },
      { id: "s-albal", nodeId: "n-albal", name: "Albal", kindId: "sk-stop", label: { x: 524, y: 1148, align: "right" } },
      { id: "s-silla", nodeId: "n-silla", name: "Silla", kindId: "sk-hub", label: { x: 484, y: 1208, align: "right" } },
      { id: "s-c1-0a", nodeId: "n-c1-0a", name: "el Romaní", kindId: "sk-stop", label: { x: 524, y: 1248, align: "right" } },
      { id: "s-c1-0", nodeId: "n-c1-0", name: "Sollana", kindId: "sk-stop", label: { x: 564, y: 1288, align: "right" } },
      { id: "s-c1-1", nodeId: "n-c1-1", name: "Sueca", kindId: "sk-stop", label: { x: 644, y: 1368, align: "right" } },
      { id: "s-c1-2", nodeId: "n-c1-2", name: "Cullera", kindId: "sk-stop", label: { x: 724, y: 1448, align: "right" } },
      { id: "s-c1-3", nodeId: "n-c1-3", name: "Tavernes de la Valldigna", kindId: "sk-stop", label: { x: 804, y: 1528, align: "right" } },
      { id: "s-c1-4", nodeId: "n-c1-4", name: "Xeraco", kindId: "sk-stop", label: { x: 884, y: 1608, align: "right" } },
      { id: "s-c1-5", nodeId: "n-c1-5", name: "Platja i Grau de Gandia", kindId: "sk-terminal", label: { x: 964, y: 1688, align: "right" } },
      { id: "s-c1-6", nodeId: "n-c1-6", name: "Gandia", kindId: "sk-terminal", label: { x: 964, y: 1748, align: "right" } },
      { id: "s-c2-0", nodeId: "n-c2-0", name: "Benifaió", kindId: "sk-stop", label: { x: 484, y: 1268, align: "right" } },
      { id: "s-c2-1", nodeId: "n-c2-1", name: "Algemesí", kindId: "sk-stop", label: { x: 484, y: 1328, align: "right" } },
      { id: "s-c2-2", nodeId: "n-c2-2", name: "Alzira", kindId: "sk-stop", label: { x: 484, y: 1388, align: "right" } },
      { id: "s-c2-3", nodeId: "n-c2-3", name: "Carcaixent", kindId: "sk-stop", label: { x: 484, y: 1448, align: "right" } },
      { id: "s-c2-3a", nodeId: "n-c2-3a", name: "la Pobla Llarga", kindId: "sk-stop", label: { x: 484, y: 1478, align: "right" } },
      { id: "s-c2-4", nodeId: "n-c2-4", name: "l'Ènova-Manuel", kindId: "sk-stop", label: { x: 484, y: 1508, align: "right" } },
      { id: "s-c2-5", nodeId: "n-c2-5", name: "Xàtiva", kindId: "sk-stop", label: { x: 484, y: 1568, align: "right" } },
      { id: "s-c2-6", nodeId: "n-c2-6", name: "l'Alcúdia de Crespins", kindId: "sk-stop", label: { x: 484, y: 1628, align: "right" } },
      { id: "s-c2-7", nodeId: "n-c2-7", name: "Montesa", kindId: "sk-stop", label: { x: 484, y: 1688, align: "right" } },
      { id: "s-c2-8", nodeId: "n-c2-8", name: "Vallada", kindId: "sk-stop", label: { x: 484, y: 1748, align: "right" } },
      { id: "s-c2-9", nodeId: "n-c2-9", name: "Moixent/Mogente", kindId: "sk-terminal", label: { x: 484, y: 1808, align: "right" } },
    ],
    segments: [
      { id: "sg-c5-0", sheetId: "sh-ov", fromNodeId: "n-c5-0", toNodeId: "n-c5-1", geometry: { kind: "straight" } },
      { id: "sg-c5-1", sheetId: "sh-ov", fromNodeId: "n-c5-1", toNodeId: "n-c5-2", geometry: { kind: "straight" } },
      { id: "sg-c5-2", sheetId: "sh-ov", fromNodeId: "n-c5-2", toNodeId: "n-c5-3", geometry: { kind: "straight" } },
      { id: "sg-c5-3", sheetId: "sh-ov", fromNodeId: "n-c5-3", toNodeId: "n-c5-4", geometry: { kind: "straight" } },
      { id: "sg-c5-4", sheetId: "sh-ov", fromNodeId: "n-c5-4", toNodeId: "n-c5-5", geometry: { kind: "straight" } },
      { id: "sg-c5-5", sheetId: "sh-ov", fromNodeId: "n-c5-5", toNodeId: "n-c5-6", geometry: { kind: "straight" } },
      { id: "sg-c5-6", sheetId: "sh-ov", fromNodeId: "n-c5-6", toNodeId: "n-c5-7", geometry: { kind: "straight" } },
      { id: "sg-c5-7", sheetId: "sh-ov", fromNodeId: "n-c5-7", toNodeId: "n-c5-8", geometry: { kind: "straight" } },
      { id: "sg-c5-8", sheetId: "sh-ov", fromNodeId: "n-c5-8", toNodeId: "n-sagunt", geometry: { kind: "straight" } },
      { id: "sg-c6-0", sheetId: "sh-ov", fromNodeId: "n-c6-0", toNodeId: "n-c6-1", geometry: { kind: "straight" } },
      { id: "sg-c6-1", sheetId: "sh-ov", fromNodeId: "n-c6-1", toNodeId: "n-c6-2", geometry: { kind: "straight" } },
      { id: "sg-c6-2", sheetId: "sh-ov", fromNodeId: "n-c6-2", toNodeId: "n-c6-2a", geometry: { kind: "straight" } },
      { id: "sg-c6-2a", sheetId: "sh-ov", fromNodeId: "n-c6-2a", toNodeId: "n-c6-3", geometry: { kind: "straight" } },
      { id: "sg-c6-3", sheetId: "sh-ov", fromNodeId: "n-c6-3", toNodeId: "n-c6-4", geometry: { kind: "straight" } },
      { id: "sg-c6-4", sheetId: "sh-ov", fromNodeId: "n-c6-4", toNodeId: "n-c6-5", geometry: { kind: "straight" } },
      { id: "sg-c6-5", sheetId: "sh-ov", fromNodeId: "n-c6-5", toNodeId: "n-c6-6", geometry: { kind: "straight" } },
      { id: "sg-c6-6", sheetId: "sh-ov", fromNodeId: "n-c6-6", toNodeId: "n-c6-7", geometry: { kind: "straight" } },
      { id: "sg-c6-7", sheetId: "sh-ov", fromNodeId: "n-c6-7", toNodeId: "n-c6-8", geometry: { kind: "straight" } },
      { id: "sg-c6-8", sheetId: "sh-ov", fromNodeId: "n-c6-8", toNodeId: "n-sagunt", geometry: { kind: "straight" } },
      { id: "sg-c5t-0", sheetId: "sh-ov", fromNodeId: "n-sagunt", toNodeId: "n-pucol", geometry: { kind: "straight" } },
      { id: "sg-c5t-1", sheetId: "sh-ov", fromNodeId: "n-pucol", toNodeId: "n-puig", geometry: { kind: "straight" } },
      { id: "sg-c5t-2", sheetId: "sh-ov", fromNodeId: "n-puig", toNodeId: "n-massalfassar", geometry: { kind: "straight" } },
      { id: "sg-c5t-3", sheetId: "sh-ov", fromNodeId: "n-massalfassar", toNodeId: "n-albuixech", geometry: { kind: "straight" } },
      { id: "sg-c5t-4", sheetId: "sh-ov", fromNodeId: "n-albuixech", toNodeId: "n-roca-cuper", geometry: { kind: "straight" } },
      { id: "sg-c5t-5", sheetId: "sh-ov", fromNodeId: "n-roca-cuper", toNodeId: "n-cabanyal", geometry: { kind: "straight" } },
      { id: "sg-c5t-6", sheetId: "sh-ov", fromNodeId: "n-cabanyal", toNodeId: "n-font", geometry: { kind: "straight" } },
      { id: "sg-c5t-7", sheetId: "sh-ov", fromNodeId: "n-font", toNodeId: "n-nord", geometry: { kind: "straight" } },
      { id: "sg-c6t-0", sheetId: "sh-ov", fromNodeId: "n-sagunt", toNodeId: "n-pucol", geometry: { kind: "straight" } },
      { id: "sg-c6t-1", sheetId: "sh-ov", fromNodeId: "n-pucol", toNodeId: "n-puig", geometry: { kind: "straight" } },
      { id: "sg-c6t-2", sheetId: "sh-ov", fromNodeId: "n-puig", toNodeId: "n-massalfassar", geometry: { kind: "straight" } },
      { id: "sg-c6t-3", sheetId: "sh-ov", fromNodeId: "n-massalfassar", toNodeId: "n-albuixech", geometry: { kind: "straight" } },
      { id: "sg-c6t-4", sheetId: "sh-ov", fromNodeId: "n-albuixech", toNodeId: "n-roca-cuper", geometry: { kind: "straight" } },
      { id: "sg-c6t-5", sheetId: "sh-ov", fromNodeId: "n-roca-cuper", toNodeId: "n-cabanyal", geometry: { kind: "straight" } },
      { id: "sg-c6t-6", sheetId: "sh-ov", fromNodeId: "n-cabanyal", toNodeId: "n-font", geometry: { kind: "straight" } },
      { id: "sg-c6t-7", sheetId: "sh-ov", fromNodeId: "n-font", toNodeId: "n-nord", geometry: { kind: "straight" } },
      { id: "sg-c3-0", sheetId: "sh-ov", fromNodeId: "n-c3-0", toNodeId: "n-c3-0a", geometry: { kind: "straight" } },
      { id: "sg-c3-0a", sheetId: "sh-ov", fromNodeId: "n-c3-0a", toNodeId: "n-c3-1", geometry: { kind: "straight" } },
      { id: "sg-c3-1", sheetId: "sh-ov", fromNodeId: "n-c3-1", toNodeId: "n-c3-2", geometry: { kind: "straight" } },
      { id: "sg-c3-2", sheetId: "sh-ov", fromNodeId: "n-c3-2", toNodeId: "n-c3-2a", geometry: { kind: "straight" } },
      { id: "sg-c3-2a", sheetId: "sh-ov", fromNodeId: "n-c3-2a", toNodeId: "n-c3-3", geometry: { kind: "straight" } },
      { id: "sg-c3-3", sheetId: "sh-ov", fromNodeId: "n-c3-3", toNodeId: "n-c3-4", geometry: { kind: "straight" } },
      { id: "sg-c3-4", sheetId: "sh-ov", fromNodeId: "n-c3-4", toNodeId: "n-c3-5", geometry: { kind: "straight" } },
      { id: "sg-c3-5", sheetId: "sh-ov", fromNodeId: "n-c3-5", toNodeId: "n-c3-6", geometry: { kind: "straight" } },
      { id: "sg-c3-6", sheetId: "sh-ov", fromNodeId: "n-c3-6", toNodeId: "n-c3-6a", geometry: { kind: "straight" } },
      { id: "sg-c3-6a", sheetId: "sh-ov", fromNodeId: "n-c3-6a", toNodeId: "n-c3-7", geometry: { kind: "straight" } },
      { id: "sg-c3-7", sheetId: "sh-ov", fromNodeId: "n-c3-7", toNodeId: "n-c3-8", geometry: { kind: "straight" } },
      { id: "sg-c3-8", sheetId: "sh-ov", fromNodeId: "n-c3-8", toNodeId: "n-c3-8a", geometry: { kind: "straight" } },
      { id: "sg-c3-8a", sheetId: "sh-ov", fromNodeId: "n-c3-8a", toNodeId: "n-c3-9", geometry: { kind: "straight" } },
      { id: "sg-c3-9", sheetId: "sh-ov", fromNodeId: "n-c3-9", toNodeId: "n-font", geometry: { kind: "straight" } },
      { id: "sg-c3-10", sheetId: "sh-ov", fromNodeId: "n-font", toNodeId: "n-nord", geometry: { kind: "straight" } },
      { id: "sg-c1s-0", sheetId: "sh-ov", fromNodeId: "n-nord", toNodeId: "n-alfafar", geometry: { kind: "straight" } },
      { id: "sg-c1s-1", sheetId: "sh-ov", fromNodeId: "n-alfafar", toNodeId: "n-massanassa", geometry: { kind: "straight" } },
      { id: "sg-c1s-2", sheetId: "sh-ov", fromNodeId: "n-massanassa", toNodeId: "n-catarroja", geometry: { kind: "straight" } },
      { id: "sg-c1s-3", sheetId: "sh-ov", fromNodeId: "n-catarroja", toNodeId: "n-albal", geometry: { kind: "straight" } },
      { id: "sg-c1s-4", sheetId: "sh-ov", fromNodeId: "n-albal", toNodeId: "n-silla", geometry: { kind: "straight" } },
      { id: "sg-c2s-0", sheetId: "sh-ov", fromNodeId: "n-nord", toNodeId: "n-alfafar", geometry: { kind: "straight" } },
      { id: "sg-c2s-1", sheetId: "sh-ov", fromNodeId: "n-alfafar", toNodeId: "n-massanassa", geometry: { kind: "straight" } },
      { id: "sg-c2s-2", sheetId: "sh-ov", fromNodeId: "n-massanassa", toNodeId: "n-catarroja", geometry: { kind: "straight" } },
      { id: "sg-c2s-3", sheetId: "sh-ov", fromNodeId: "n-catarroja", toNodeId: "n-albal", geometry: { kind: "straight" } },
      { id: "sg-c2s-4", sheetId: "sh-ov", fromNodeId: "n-albal", toNodeId: "n-silla", geometry: { kind: "straight" } },
      { id: "sg-c1-0", sheetId: "sh-ov", fromNodeId: "n-silla", toNodeId: "n-c1-0a", geometry: { kind: "straight" } },
      { id: "sg-c1-0a", sheetId: "sh-ov", fromNodeId: "n-c1-0a", toNodeId: "n-c1-0", geometry: { kind: "straight" } },
      { id: "sg-c1-1", sheetId: "sh-ov", fromNodeId: "n-c1-0", toNodeId: "n-c1-1", geometry: { kind: "straight" } },
      { id: "sg-c1-2", sheetId: "sh-ov", fromNodeId: "n-c1-1", toNodeId: "n-c1-2", geometry: { kind: "straight" } },
      { id: "sg-c1-3", sheetId: "sh-ov", fromNodeId: "n-c1-2", toNodeId: "n-c1-3", geometry: { kind: "straight" } },
      { id: "sg-c1-4", sheetId: "sh-ov", fromNodeId: "n-c1-3", toNodeId: "n-c1-4", geometry: { kind: "straight" } },
      { id: "sg-c1-5", sheetId: "sh-ov", fromNodeId: "n-c1-4", toNodeId: "n-c1-5", geometry: { kind: "straight" } },
      { id: "sg-c1-6", sheetId: "sh-ov", fromNodeId: "n-c1-5", toNodeId: "n-c1-6", geometry: { kind: "straight" } },
      { id: "sg-c2-0", sheetId: "sh-ov", fromNodeId: "n-silla", toNodeId: "n-c2-0", geometry: { kind: "straight" } },
      { id: "sg-c2-1", sheetId: "sh-ov", fromNodeId: "n-c2-0", toNodeId: "n-c2-1", geometry: { kind: "straight" } },
      { id: "sg-c2-2", sheetId: "sh-ov", fromNodeId: "n-c2-1", toNodeId: "n-c2-2", geometry: { kind: "straight" } },
      { id: "sg-c2-3", sheetId: "sh-ov", fromNodeId: "n-c2-2", toNodeId: "n-c2-3", geometry: { kind: "straight" } },
      { id: "sg-c2-4", sheetId: "sh-ov", fromNodeId: "n-c2-3", toNodeId: "n-c2-3a", geometry: { kind: "straight" } },
      { id: "sg-c2-4a", sheetId: "sh-ov", fromNodeId: "n-c2-3a", toNodeId: "n-c2-4", geometry: { kind: "straight" } },
      { id: "sg-c2-5", sheetId: "sh-ov", fromNodeId: "n-c2-4", toNodeId: "n-c2-5", geometry: { kind: "straight" } },
      { id: "sg-c2-6", sheetId: "sh-ov", fromNodeId: "n-c2-5", toNodeId: "n-c2-6", geometry: { kind: "straight" } },
      { id: "sg-c2-7", sheetId: "sh-ov", fromNodeId: "n-c2-6", toNodeId: "n-c2-7", geometry: { kind: "straight" } },
      { id: "sg-c2-8", sheetId: "sh-ov", fromNodeId: "n-c2-7", toNodeId: "n-c2-8", geometry: { kind: "straight" } },
      { id: "sg-c2-9", sheetId: "sh-ov", fromNodeId: "n-c2-8", toNodeId: "n-c2-9", geometry: { kind: "straight" } },
    ],
    lineRuns: [
      { id: "lr-c1", lineId: "l-c1", segmentIds: ["sg-c1s-0", "sg-c1s-1", "sg-c1s-2", "sg-c1s-3", "sg-c1s-4", "sg-c1-0", "sg-c1-0a", "sg-c1-1", "sg-c1-2", "sg-c1-3", "sg-c1-4", "sg-c1-5", "sg-c1-6"] },
      { id: "lr-c2", lineId: "l-c2", segmentIds: ["sg-c2s-0", "sg-c2s-1", "sg-c2s-2", "sg-c2s-3", "sg-c2s-4", "sg-c2-0", "sg-c2-1", "sg-c2-2", "sg-c2-3", "sg-c2-4", "sg-c2-4a", "sg-c2-5", "sg-c2-6", "sg-c2-7", "sg-c2-8", "sg-c2-9"] },
      { id: "lr-c3", lineId: "l-c3", segmentIds: ["sg-c3-0", "sg-c3-0a", "sg-c3-1", "sg-c3-2", "sg-c3-2a", "sg-c3-3", "sg-c3-4", "sg-c3-5", "sg-c3-6", "sg-c3-6a", "sg-c3-7", "sg-c3-8", "sg-c3-8a", "sg-c3-9", "sg-c3-10"] },
      { id: "lr-c5", lineId: "l-c5", segmentIds: ["sg-c5-0", "sg-c5-1", "sg-c5-2", "sg-c5-3", "sg-c5-4", "sg-c5-5", "sg-c5-6", "sg-c5-7", "sg-c5-8", "sg-c5t-0", "sg-c5t-1", "sg-c5t-2", "sg-c5t-3", "sg-c5t-4", "sg-c5t-5", "sg-c5t-6", "sg-c5t-7"] },
      { id: "lr-c6", lineId: "l-c6", segmentIds: ["sg-c6-0", "sg-c6-1", "sg-c6-2", "sg-c6-2a", "sg-c6-3", "sg-c6-4", "sg-c6-5", "sg-c6-6", "sg-c6-7", "sg-c6-8", "sg-c6t-0", "sg-c6t-1", "sg-c6t-2", "sg-c6t-3", "sg-c6t-4", "sg-c6t-5", "sg-c6t-6", "sg-c6t-7"] },
    ],
  },
};

export const DEVELOPMENT_BOOTSTRAP_MAP: RailwayMap = applyValenciaBootstrapLabelLayout(
  octilinearizeMapLayout(
    scaleMapLayout(DEVELOPMENT_BOOTSTRAP_MAP_BASE, 1.12, 1.12, 660, 920),
    "n-nord",
    48,
    VALENCIA_BOOTSTRAP_EDGE_DIRECTIONS,
  ),
);
