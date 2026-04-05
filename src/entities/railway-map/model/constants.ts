import type { RailwayMap } from "./types";

const DEFAULT_STATION_FONT_FAMILY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_STATION_FONT_WEIGHT = "600" as const;
const DEFAULT_STATION_FONT_SIZE = 14;
const DEFAULT_STATION_SYMBOL_SIZE = 1;
const DEFAULT_PARALLEL_TRACK_SPACING = 22;
const DEFAULT_SEGMENT_INDICATOR_WIDTH = 16;

export const LINE_PRESETS = [
  { id: "preset-c1", name: "C1", color: "#74b6f2", strokeWidth: 9, strokeStyle: "solid" as const },
  { id: "preset-c2", name: "C2", color: "#facc15", strokeWidth: 9, strokeStyle: "solid" as const },
  { id: "preset-c3", name: "C3", color: "#8b1fa9", strokeWidth: 9, strokeStyle: "solid" as const },
  { id: "preset-c4", name: "C4", color: "#ff2600", strokeWidth: 10, strokeStyle: "solid" as const },
  { id: "preset-c5", name: "C5", color: "#65a30d", strokeWidth: 9, strokeStyle: "solid" as const },
  { id: "preset-c6", name: "C6", color: "#1d4ed8", strokeWidth: 9, strokeStyle: "solid" as const },
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
    parallelTrackSpacing: DEFAULT_PARALLEL_TRACK_SPACING,
    segmentIndicatorWidth: DEFAULT_SEGMENT_INDICATOR_WIDTH,
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

export const DEVELOPMENT_BOOTSTRAP_MAP: RailwayMap = {
  config: {
    stationKinds: [
      {
        id: "sk-stop",
        name: "Stop",
        shape: "circle",
        symbolSize: 1,
        fontFamily: "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: "600",
        fontSize: 14
      },
      {
        id: "sk-hub",
        name: "Hub",
        shape: "interchange",
        symbolSize: 1,
        fontFamily: "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: "700",
        fontSize: 15
      },
      {
        id: "sk-terminal",
        name: "Terminal",
        shape: "terminal",
        symbolSize: 1,
        fontFamily: "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: "600",
        fontSize: 14
      }
    ],
    lines: [
      {
        id: "l-c1",
        name: "C1",
        color: "#74b6f2",
        strokeWidth: 9,
        strokeStyle: "solid"
      },
      {
        id: "l-c2",
        name: "C2",
        color: "#facc15",
        strokeWidth: 9,
        strokeStyle: "solid"
      },
      {
        id: "l-c3",
        name: "C3",
        color: "#8b1fa9",
        strokeWidth: 9,
        strokeStyle: "solid"
      },
      {
        id: "l-c5",
        name: "C5",
        color: "#65a30d",
        strokeWidth: 9,
        strokeStyle: "solid"
      },
      {
        id: "l-c6",
        name: "C6",
        color: "#1d4ed8",
        strokeWidth: 9,
        strokeStyle: "solid"
      },
      {
        id: "l1775378342355-5",
        name: "C4",
        color: "#ff2600",
        strokeWidth: 10,
        strokeStyle: "solid"
      }
    ],
    parallelTrackSpacing: 22,
    segmentIndicatorWidth: 16
  },
  model: {
    sheets: [
      {
        id: "sh-ov",
        name: "Rodalia València Overview"
      }
    ],
    nodes: [
      {
        x: 228,
        y: 104,
        id: "n-c5-0",
        sheetId: "sh-ov"
      },
      {
        x: 276,
        y: 152,
        id: "n-c5-1",
        sheetId: "sh-ov"
      },
      {
        x: 324,
        y: 200,
        id: "n-c5-2",
        sheetId: "sh-ov"
      },
      {
        x: 372,
        y: 248,
        id: "n-c5-3",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 296,
        id: "n-c5-4",
        sheetId: "sh-ov"
      },
      {
        x: 468,
        y: 344,
        id: "n-c5-5",
        sheetId: "sh-ov"
      },
      {
        x: 516,
        y: 392,
        id: "n-c5-6",
        sheetId: "sh-ov"
      },
      {
        x: 564,
        y: 440,
        id: "n-c5-7",
        sheetId: "sh-ov"
      },
      {
        x: 610,
        y: 491,
        id: "n-c5-8",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 536,
        id: "n-sagunt",
        sheetId: "sh-ov"
      },
      {
        x: 1140,
        y: 56,
        id: "n-c6-0",
        sheetId: "sh-ov"
      },
      {
        x: 1092,
        y: 104,
        id: "n-c6-1",
        sheetId: "sh-ov"
      },
      {
        x: 1044,
        y: 152,
        id: "n-c6-2",
        sheetId: "sh-ov"
      },
      {
        x: 996,
        y: 200,
        id: "n-c6-2a",
        sheetId: "sh-ov"
      },
      {
        x: 948,
        y: 248,
        id: "n-c6-3",
        sheetId: "sh-ov"
      },
      {
        x: 900,
        y: 296,
        id: "n-c6-4",
        sheetId: "sh-ov"
      },
      {
        x: 852,
        y: 344,
        id: "n-c6-5",
        sheetId: "sh-ov"
      },
      {
        x: 804,
        y: 392,
        id: "n-c6-6",
        sheetId: "sh-ov"
      },
      {
        x: 756,
        y: 440,
        id: "n-c6-7",
        sheetId: "sh-ov"
      },
      {
        x: 714,
        y: 488,
        id: "n-c6-8",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 584,
        id: "n-pucol",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 632,
        id: "n-puig",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 680,
        id: "n-massalfassar",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 730,
        id: "n-albuixech",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 776,
        id: "n-roca-cuper",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 824,
        id: "n-cabanyal",
        sheetId: "sh-ov"
      },
      {
        x: 660,
        y: 872,
        id: "n-font",
        sheetId: "sh-ov"
      },
      {
        x: 654,
        y: 923,
        id: "n-nord",
        sheetId: "sh-ov"
      },
      {
        x: -87,
        y: 632,
        id: "n-c3-0",
        sheetId: "sh-ov"
      },
      {
        x: -39,
        y: 680,
        id: "n-c3-0a",
        sheetId: "sh-ov"
      },
      {
        x: 9,
        y: 728,
        id: "n-c3-1",
        sheetId: "sh-ov"
      },
      {
        x: 57,
        y: 776,
        id: "n-c3-2",
        sheetId: "sh-ov"
      },
      {
        x: 105,
        y: 824,
        id: "n-c3-2a",
        sheetId: "sh-ov"
      },
      {
        x: 153,
        y: 872,
        id: "n-c3-3",
        sheetId: "sh-ov"
      },
      {
        x: 199,
        y: 919,
        id: "n-c3-4",
        sheetId: "sh-ov"
      },
      {
        x: 247,
        y: 919,
        id: "n-c3-5",
        sheetId: "sh-ov"
      },
      {
        x: 295,
        y: 919,
        id: "n-c3-6",
        sheetId: "sh-ov"
      },
      {
        x: 343,
        y: 919,
        id: "n-c3-6a",
        sheetId: "sh-ov"
      },
      {
        x: 391,
        y: 919,
        id: "n-c3-7",
        sheetId: "sh-ov"
      },
      {
        x: 439,
        y: 919,
        id: "n-c3-8",
        sheetId: "sh-ov"
      },
      {
        x: 487,
        y: 919,
        id: "n-c3-8a",
        sheetId: "sh-ov"
      },
      {
        x: 535,
        y: 919,
        id: "n-c3-9",
        sheetId: "sh-ov"
      },
      {
        x: 612,
        y: 968,
        id: "n-alfafar",
        sheetId: "sh-ov"
      },
      {
        x: 564,
        y: 1016,
        id: "n-massanassa",
        sheetId: "sh-ov"
      },
      {
        x: 516,
        y: 1064,
        id: "n-catarroja",
        sheetId: "sh-ov"
      },
      {
        x: 468,
        y: 1112,
        id: "n-albal",
        sheetId: "sh-ov"
      },
      {
        x: 440,
        y: 1164,
        id: "n-silla",
        sheetId: "sh-ov"
      },
      {
        x: 468,
        y: 1208,
        id: "n-c1-0a",
        sheetId: "sh-ov"
      },
      {
        x: 516,
        y: 1256,
        id: "n-c1-0",
        sheetId: "sh-ov"
      },
      {
        x: 612,
        y: 1352,
        id: "n-c1-1",
        sheetId: "sh-ov"
      },
      {
        x: 708,
        y: 1448,
        id: "n-c1-2",
        sheetId: "sh-ov"
      },
      {
        x: 804,
        y: 1544,
        id: "n-c1-3",
        sheetId: "sh-ov"
      },
      {
        x: 900,
        y: 1640,
        id: "n-c1-4",
        sheetId: "sh-ov"
      },
      {
        x: 996,
        y: 1736,
        id: "n-c1-5",
        sheetId: "sh-ov"
      },
      {
        x: 996,
        y: 1784,
        id: "n-c1-6",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1208,
        id: "n-c2-0",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1256,
        id: "n-c2-1",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1304,
        id: "n-c2-2",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1352,
        id: "n-c2-3",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1400,
        id: "n-c2-3a",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1448,
        id: "n-c2-4",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1496,
        id: "n-c2-5",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1544,
        id: "n-c2-6",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1592,
        id: "n-c2-7",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1640,
        id: "n-c2-8",
        sheetId: "sh-ov"
      },
      {
        x: 420,
        y: 1688,
        id: "n-c2-9",
        sheetId: "sh-ov"
      },
      {
        id: "n1775378474326-7",
        sheetId: "sh-ov",
        x: 500,
        y: 855
      }
    ],
    nodeLanes: [
      {
        id: "nl-n-c5-0-l-c5",
        nodeId: "n-c5-0",
        order: 0
      },
      {
        id: "nl-n-c5-1-l-c5",
        nodeId: "n-c5-1",
        order: 0
      },
      {
        id: "nl-n-c5-2-l-c5",
        nodeId: "n-c5-2",
        order: 0
      },
      {
        id: "nl-n-c5-3-l-c5",
        nodeId: "n-c5-3",
        order: 0
      },
      {
        id: "nl-n-c5-4-l-c5",
        nodeId: "n-c5-4",
        order: 0
      },
      {
        id: "nl-n-c5-5-l-c5",
        nodeId: "n-c5-5",
        order: 0
      },
      {
        id: "nl-n-c5-6-l-c5",
        nodeId: "n-c5-6",
        order: 0
      },
      {
        id: "nl-n-c5-7-l-c5",
        nodeId: "n-c5-7",
        order: 0
      },
      {
        id: "nl-n-c5-8-l-c5",
        nodeId: "n-c5-8",
        order: 0
      },
      {
        id: "nl-n-sagunt-l-c5",
        nodeId: "n-sagunt",
        order: 0
      },
      {
        id: "nl-n-sagunt-l-c6",
        nodeId: "n-sagunt",
        order: 1
      },
      {
        id: "nl-n-c6-0-l-c6",
        nodeId: "n-c6-0",
        order: 0
      },
      {
        id: "nl-n-c6-1-l-c6",
        nodeId: "n-c6-1",
        order: 0
      },
      {
        id: "nl-n-c6-2-l-c6",
        nodeId: "n-c6-2",
        order: 0
      },
      {
        id: "nl-n-c6-2a-l-c6",
        nodeId: "n-c6-2a",
        order: 0
      },
      {
        id: "nl-n-c6-3-l-c6",
        nodeId: "n-c6-3",
        order: 0
      },
      {
        id: "nl-n-c6-4-l-c6",
        nodeId: "n-c6-4",
        order: 0
      },
      {
        id: "nl-n-c6-5-l-c6",
        nodeId: "n-c6-5",
        order: 0
      },
      {
        id: "nl-n-c6-6-l-c6",
        nodeId: "n-c6-6",
        order: 0
      },
      {
        id: "nl-n-c6-7-l-c6",
        nodeId: "n-c6-7",
        order: 0
      },
      {
        id: "nl-n-c6-8-l-c6",
        nodeId: "n-c6-8",
        order: 0
      },
      {
        id: "nl-n-pucol-l-c5",
        nodeId: "n-pucol",
        order: 0
      },
      {
        id: "nl-n-pucol-l-c6",
        nodeId: "n-pucol",
        order: 1
      },
      {
        id: "nl-n-puig-l-c5",
        nodeId: "n-puig",
        order: 0
      },
      {
        id: "nl-n-puig-l-c6",
        nodeId: "n-puig",
        order: 1
      },
      {
        id: "nl-n-massalfassar-l-c5",
        nodeId: "n-massalfassar",
        order: 0
      },
      {
        id: "nl-n-massalfassar-l-c6",
        nodeId: "n-massalfassar",
        order: 1
      },
      {
        id: "nl-n-albuixech-l-c5",
        nodeId: "n-albuixech",
        order: 0
      },
      {
        id: "nl-n-albuixech-l-c6",
        nodeId: "n-albuixech",
        order: 1
      },
      {
        id: "nl-n-roca-cuper-l-c5",
        nodeId: "n-roca-cuper",
        order: 0
      },
      {
        id: "nl-n-roca-cuper-l-c6",
        nodeId: "n-roca-cuper",
        order: 1
      },
      {
        id: "nl-n-cabanyal-l-c5",
        nodeId: "n-cabanyal",
        order: 0
      },
      {
        id: "nl-n-cabanyal-l-c6",
        nodeId: "n-cabanyal",
        order: 1
      },
      {
        id: "nl-n-font-l-c3",
        nodeId: "n-font",
        order: 0
      },
      {
        id: "nl-n-font-l-c5",
        nodeId: "n-font",
        order: 1
      },
      {
        id: "nl-n-font-l-c6",
        nodeId: "n-font",
        order: 2
      },
      {
        id: "nl-n-nord-l-c2",
        nodeId: "n-nord",
        order: 0
      },
      {
        id: "nl-n-nord-l-c1",
        nodeId: "n-nord",
        order: 1
      },
      {
        id: "nl-n-nord-l-c3",
        nodeId: "n-nord",
        order: 2
      },
      {
        id: "nl-n-nord-l-c5",
        nodeId: "n-nord",
        order: 3
      },
      {
        id: "nl-n-nord-l-c6",
        nodeId: "n-nord",
        order: 4
      },
      {
        id: "nl-n-c3-0-l-c3",
        nodeId: "n-c3-0",
        order: 0
      },
      {
        id: "nl-n-c3-0a-l-c3",
        nodeId: "n-c3-0a",
        order: 0
      },
      {
        id: "nl-n-c3-1-l-c3",
        nodeId: "n-c3-1",
        order: 0
      },
      {
        id: "nl-n-c3-2-l-c3",
        nodeId: "n-c3-2",
        order: 0
      },
      {
        id: "nl-n-c3-2a-l-c3",
        nodeId: "n-c3-2a",
        order: 0
      },
      {
        id: "nl-n-c3-3-l-c3",
        nodeId: "n-c3-3",
        order: 0
      },
      {
        id: "nl-n-c3-4-l-c3",
        nodeId: "n-c3-4",
        order: 0
      },
      {
        id: "nl-n-c3-5-l-c3",
        nodeId: "n-c3-5",
        order: 0
      },
      {
        id: "nl-n-c3-6-l-c3",
        nodeId: "n-c3-6",
        order: 0
      },
      {
        id: "nl-n-c3-6a-l-c3",
        nodeId: "n-c3-6a",
        order: 0
      },
      {
        id: "nl-n-c3-7-l-c3",
        nodeId: "n-c3-7",
        order: 0
      },
      {
        id: "nl-n-c3-8-l-c3",
        nodeId: "n-c3-8",
        order: 0
      },
      {
        id: "nl-n-c3-8a-l-c3",
        nodeId: "n-c3-8a",
        order: 0
      },
      {
        id: "nl-n-c3-9-l-c3",
        nodeId: "n-c3-9",
        order: 0
      },
      {
        id: "nl-n-alfafar-l-c2",
        nodeId: "n-alfafar",
        order: 0
      },
      {
        id: "nl-n-alfafar-l-c1",
        nodeId: "n-alfafar",
        order: 1
      },
      {
        id: "nl-n-massanassa-l-c2",
        nodeId: "n-massanassa",
        order: 0
      },
      {
        id: "nl-n-massanassa-l-c1",
        nodeId: "n-massanassa",
        order: 1
      },
      {
        id: "nl-n-catarroja-l-c2",
        nodeId: "n-catarroja",
        order: 0
      },
      {
        id: "nl-n-catarroja-l-c1",
        nodeId: "n-catarroja",
        order: 1
      },
      {
        id: "nl-n-albal-l-c2",
        nodeId: "n-albal",
        order: 0
      },
      {
        id: "nl-n-albal-l-c1",
        nodeId: "n-albal",
        order: 1
      },
      {
        id: "nl-n-silla-l-c2",
        nodeId: "n-silla",
        order: 0
      },
      {
        id: "nl-n-silla-l-c1",
        nodeId: "n-silla",
        order: 1
      },
      {
        id: "nl-n-c1-0a-l-c1",
        nodeId: "n-c1-0a",
        order: 0
      },
      {
        id: "nl-n-c1-0-l-c1",
        nodeId: "n-c1-0",
        order: 0
      },
      {
        id: "nl-n-c1-1-l-c1",
        nodeId: "n-c1-1",
        order: 0
      },
      {
        id: "nl-n-c1-2-l-c1",
        nodeId: "n-c1-2",
        order: 0
      },
      {
        id: "nl-n-c1-3-l-c1",
        nodeId: "n-c1-3",
        order: 0
      },
      {
        id: "nl-n-c1-4-l-c1",
        nodeId: "n-c1-4",
        order: 0
      },
      {
        id: "nl-n-c1-5-l-c1",
        nodeId: "n-c1-5",
        order: 0
      },
      {
        id: "nl-n-c1-6-l-c1",
        nodeId: "n-c1-6",
        order: 0
      },
      {
        id: "nl-n-c2-0-l-c2",
        nodeId: "n-c2-0",
        order: 0
      },
      {
        id: "nl-n-c2-1-l-c2",
        nodeId: "n-c2-1",
        order: 0
      },
      {
        id: "nl-n-c2-2-l-c2",
        nodeId: "n-c2-2",
        order: 0
      },
      {
        id: "nl-n-c2-3-l-c2",
        nodeId: "n-c2-3",
        order: 0
      },
      {
        id: "nl-n-c2-3a-l-c2",
        nodeId: "n-c2-3a",
        order: 0
      },
      {
        id: "nl-n-c2-4-l-c2",
        nodeId: "n-c2-4",
        order: 0
      },
      {
        id: "nl-n-c2-5-l-c2",
        nodeId: "n-c2-5",
        order: 0
      },
      {
        id: "nl-n-c2-6-l-c2",
        nodeId: "n-c2-6",
        order: 0
      },
      {
        id: "nl-n-c2-7-l-c2",
        nodeId: "n-c2-7",
        order: 0
      },
      {
        id: "nl-n-c2-8-l-c2",
        nodeId: "n-c2-8",
        order: 0
      },
      {
        id: "nl-n-c2-9-l-c2",
        nodeId: "n-c2-9",
        order: 0
      },
      {
        id: "nl-n1775378474326-7-auto-segment-sg1775378705279-11",
        nodeId: "n1775378474326-7",
        order: 0
      }
    ],
    stations: [
      {
        id: "s-c5-0",
        nodeId: "n-c5-0",
        name: "Caudiel",
        kindId: "sk-terminal",
        label: {
          x: 208,
          y: 82,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c5-1",
        nodeId: "n-c5-1",
        name: "Jérica-Viver",
        kindId: "sk-stop",
        label: {
          x: 149,
          y: 158,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c5-2",
        nodeId: "n-c5-2",
        name: "Navajas",
        kindId: "sk-stop",
        label: {
          x: 234,
          y: 206,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c5-3",
        nodeId: "n-c5-3",
        name: "Segorbe Arrabal",
        kindId: "sk-stop",
        label: {
          x: 230,
          y: 254,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c5-4",
        nodeId: "n-c5-4",
        name: "Segorbe Ciudad",
        kindId: "sk-stop",
        label: {
          x: 275,
          y: 305,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c5-5",
        nodeId: "n-c5-5",
        name: "Soneja",
        kindId: "sk-stop",
        label: {
          x: 385,
          y: 351,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c5-6",
        nodeId: "n-c5-6",
        name: "Algimia Ciudad",
        kindId: "sk-stop",
        label: {
          x: 391,
          y: 400,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c5-7",
        nodeId: "n-c5-7",
        name: "Estivella-Albalat dels Tarongers",
        kindId: "sk-stop",
        label: {
          x: 337.08,
          y: 447,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c5-8",
        nodeId: "n-c5-8",
        name: "Gilet",
        kindId: "sk-stop",
        label: {
          x: 550,
          y: 498,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-sagunt",
        nodeId: "n-sagunt",
        name: "Sagunt/Sagunto",
        kindId: "sk-stop",
        label: {
          x: 700,
          y: 545,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-0",
        nodeId: "n-c6-0",
        name: "Castelló de la Plana",
        kindId: "sk-terminal",
        label: {
          x: 1094,
          y: 30,
          align: "top",
          rotation: 0
        }
      },
      {
        id: "s-c6-1",
        nodeId: "n-c6-1",
        name: "Almassora",
        kindId: "sk-stop",
        label: {
          x: 1118,
          y: 118,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-2",
        nodeId: "n-c6-2",
        name: "Vila-real",
        kindId: "sk-stop",
        label: {
          x: 1075,
          y: 163,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-2a",
        nodeId: "n-c6-2a",
        name: "Borriana/Burriana-les Alqueries/Alquerías del Niño Perdido",
        kindId: "sk-stop",
        label: {
          x: 1024,
          y: 208,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-3",
        nodeId: "n-c6-3",
        name: "Nules-La Vilavella",
        kindId: "sk-stop",
        label: {
          x: 982,
          y: 260,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-4",
        nodeId: "n-c6-4",
        name: "Moncofa",
        kindId: "sk-stop",
        label: {
          x: 935,
          y: 305,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c6-5",
        nodeId: "n-c6-5",
        name: "Xilxes/Chilches",
        kindId: "sk-stop",
        label: {
          x: 884,
          y: 354,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-6",
        nodeId: "n-c6-6",
        name: "La Llosa",
        kindId: "sk-stop",
        label: {
          x: 843,
          y: 401,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-7",
        nodeId: "n-c6-7",
        name: "Almenara",
        kindId: "sk-stop",
        label: {
          x: 787,
          y: 450,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c6-8",
        nodeId: "n-c6-8",
        name: "les Valls",
        kindId: "sk-stop",
        label: {
          x: 744,
          y: 497,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-pucol",
        nodeId: "n-pucol",
        name: "Puçol",
        kindId: "sk-stop",
        label: {
          x: 702,
          y: 576,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-puig",
        nodeId: "n-puig",
        name: "el Puig de Santa Maria",
        kindId: "sk-stop",
        label: {
          x: 700,
          y: 636,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-massalfassar",
        nodeId: "n-massalfassar",
        name: "Massalfassar",
        kindId: "sk-stop",
        label: {
          x: 701,
          y: 689,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-albuixech",
        nodeId: "n-albuixech",
        name: "Albuixech",
        kindId: "sk-stop",
        label: {
          x: 703,
          y: 735,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-roca",
        nodeId: "n-roca-cuper",
        name: "Roca-Cúper",
        kindId: "sk-stop",
        label: {
          x: 702,
          y: 778,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-cabanyal",
        nodeId: "n-cabanyal",
        name: "València Cabanyal",
        kindId: "sk-stop",
        label: {
          x: 700,
          y: 828,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-font",
        nodeId: "n-font",
        name: "València la Font de Sant Lluís",
        kindId: "sk-hub",
        label: {
          x: 712,
          y: 884,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-nord",
        nodeId: "n-nord",
        name: "València Estació del Nord",
        kindId: "sk-hub",
        label: {
          x: 741,
          y: 930,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c3-0",
        nodeId: "n-c3-0",
        name: "Utiel",
        kindId: "sk-terminal",
        label: {
          x: -101,
          y: 608,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c3-0a",
        nodeId: "n-c3-0a",
        name: "San Antonio de Requena",
        kindId: "sk-stop",
        label: {
          x: -10,
          y: 684,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c3-1",
        nodeId: "n-c3-1",
        name: "Requena",
        kindId: "sk-stop",
        label: {
          x: 43,
          y: 735,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c3-2",
        nodeId: "n-c3-2",
        name: "El Rebollar",
        kindId: "sk-stop",
        label: {
          x: 87,
          y: 780,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c3-2a",
        nodeId: "n-c3-2a",
        name: "Siete Aguas",
        kindId: "sk-stop",
        label: {
          x: 130,
          y: 819,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c3-3",
        nodeId: "n-c3-3",
        name: "Venta Mina-Siete Aguas",
        kindId: "sk-stop",
        label: {
          x: 173,
          y: 868,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c3-4",
        nodeId: "n-c3-4",
        name: "Buñol",
        kindId: "sk-stop",
        label: {
          x: 153,
          y: 962,
          align: "left",
          rotation: -45
        }
      },
      {
        id: "s-c3-5",
        nodeId: "n-c3-5",
        name: "Chiva",
        kindId: "sk-stop",
        label: {
          x: 203,
          y: 963,
          align: "top",
          rotation: -45
        }
      },
      {
        id: "s-c3-6",
        nodeId: "n-c3-6",
        name: "Cheste",
        kindId: "sk-stop",
        label: {
          x: 240.32,
          y: 966,
          align: "top",
          rotation: -45
        }
      },
      {
        id: "s-c3-6a",
        nodeId: "n-c3-6a",
        name: "Circuit Ricardo Tormo",
        kindId: "sk-stop",
        label: {
          x: 206.62,
          y: 995,
          align: "left",
          rotation: -45
        }
      },
      {
        id: "s-c3-7",
        nodeId: "n-c3-7",
        name: "Loriguilla-Reva",
        kindId: "sk-stop",
        label: {
          x: 293.3,
          y: 984,
          align: "left",
          rotation: -45
        }
      },
      {
        id: "s-c3-8",
        nodeId: "n-c3-8",
        name: "Aldaia",
        kindId: "sk-stop",
        label: {
          x: 386.31999999999994,
          y: 968,
          align: "top",
          rotation: -46
        }
      },
      {
        id: "s-c3-8a",
        nodeId: "n-c3-8a",
        name: "Xirivella Alqueries",
        kindId: "sk-stop",
        label: {
          x: 371.18000000000006,
          y: 993,
          align: "left",
          rotation: -45
        }
      },
      {
        id: "s-c3-9",
        nodeId: "n-c3-9",
        name: "València Sant Isidre",
        kindId: "sk-stop",
        label: {
          x: 409,
          y: 994,
          align: "bottom",
          rotation: -45
        }
      },
      {
        id: "s-alfafar",
        nodeId: "n-alfafar",
        name: "Alfafar-Benetússer",
        kindId: "sk-stop",
        label: {
          x: 648,
          y: 982,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-massanassa",
        nodeId: "n-massanassa",
        name: "Massanassa",
        kindId: "sk-stop",
        label: {
          x: 612,
          y: 1020,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-catarroja",
        nodeId: "n-catarroja",
        name: "Catarroja",
        kindId: "sk-stop",
        label: {
          x: 564,
          y: 1068,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-albal",
        nodeId: "n-albal",
        name: "Albal",
        kindId: "sk-stop",
        label: {
          x: 516,
          y: 1116,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-silla",
        nodeId: "n-silla",
        name: "Silla",
        kindId: "sk-stop",
        label: {
          x: 486,
          y: 1172,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c1-0a",
        nodeId: "n-c1-0a",
        name: "el Romaní",
        kindId: "sk-stop",
        label: {
          x: 510,
          y: 1200,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c1-0",
        nodeId: "n-c1-0",
        name: "Sollana",
        kindId: "sk-stop",
        label: {
          x: 558,
          y: 1248,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c1-1",
        nodeId: "n-c1-1",
        name: "Sueca",
        kindId: "sk-stop",
        label: {
          x: 648,
          y: 1344,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c1-2",
        nodeId: "n-c1-2",
        name: "Cullera",
        kindId: "sk-stop",
        label: {
          x: 726,
          y: 1428,
          align: "top",
          rotation: 0
        }
      },
      {
        id: "s-c1-3",
        nodeId: "n-c1-3",
        name: "Tavernes de la Valldigna",
        kindId: "sk-stop",
        label: {
          x: 822,
          y: 1524,
          align: "top",
          rotation: 0
        }
      },
      {
        id: "s-c1-4",
        nodeId: "n-c1-4",
        name: "Xeraco",
        kindId: "sk-stop",
        label: {
          x: 918,
          y: 1620,
          align: "top",
          rotation: 0
        }
      },
      {
        id: "s-c1-5",
        nodeId: "n-c1-5",
        name: "Platja i Grau de Gandia",
        kindId: "sk-terminal",
        label: {
          x: 1014,
          y: 1716,
          align: "top",
          rotation: 0
        }
      },
      {
        id: "s-c1-6",
        nodeId: "n-c1-6",
        name: "Gandia",
        kindId: "sk-terminal",
        label: {
          x: 1026,
          y: 1776,
          align: "right",
          rotation: 0
        }
      },
      {
        id: "s-c2-0",
        nodeId: "n-c2-0",
        name: "Benifaió",
        kindId: "sk-stop",
        label: {
          x: 333.52,
          y: 1211,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-1",
        nodeId: "n-c2-1",
        name: "Algemesí",
        kindId: "sk-stop",
        label: {
          x: 325.52,
          y: 1262,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-2",
        nodeId: "n-c2-2",
        name: "Alzira",
        kindId: "sk-stop",
        label: {
          x: 345.64,
          y: 1308,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-3",
        nodeId: "n-c2-3",
        name: "Carcaixent",
        kindId: "sk-stop",
        label: {
          x: 321.4,
          y: 1357,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-3a",
        nodeId: "n-c2-3a",
        name: "la Pobla Llarga",
        kindId: "sk-stop",
        label: {
          x: 293.6,
          y: 1407,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-4",
        nodeId: "n-c2-4",
        name: "l'Ènova-Manuel",
        kindId: "sk-stop",
        label: {
          x: 289.15999999999997,
          y: 1455,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-5",
        nodeId: "n-c2-5",
        name: "Xàtiva",
        kindId: "sk-stop",
        label: {
          x: 343.64,
          y: 1504,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-6",
        nodeId: "n-c2-6",
        name: "l'Alcúdia de Crespins",
        kindId: "sk-stop",
        label: {
          x: 251.24,
          y: 1548,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-7",
        nodeId: "n-c2-7",
        name: "Montesa",
        kindId: "sk-stop",
        label: {
          x: 336.08,
          y: 1595,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-8",
        nodeId: "n-c2-8",
        name: "Vallada",
        kindId: "sk-stop",
        label: {
          x: 337.08,
          y: 1645,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s-c2-9",
        nodeId: "n-c2-9",
        name: "Moixent/Mogente",
        kindId: "sk-terminal",
        label: {
          x: 270.6,
          y: 1694,
          align: "left",
          rotation: 0
        }
      },
      {
        id: "s1775378671843-10",
        nodeId: "n1775378474326-7",
        name: "Xirvella L'Alter",
        kindId: "sk-terminal",
        label: {
          x: 454,
          y: 831,
          align: "right",
          rotation: 0
        }
      }
    ],
    segments: [
      {
        id: "sg-c5-0",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-0",
        toNodeId: "n-c5-1",
        fromLaneId: "nl-n-c5-0-l-c5",
        toLaneId: "nl-n-c5-1-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-1",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-1",
        toNodeId: "n-c5-2",
        fromLaneId: "nl-n-c5-1-l-c5",
        toLaneId: "nl-n-c5-2-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-2",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-2",
        toNodeId: "n-c5-3",
        fromLaneId: "nl-n-c5-2-l-c5",
        toLaneId: "nl-n-c5-3-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-3",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-3",
        toNodeId: "n-c5-4",
        fromLaneId: "nl-n-c5-3-l-c5",
        toLaneId: "nl-n-c5-4-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-4",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-4",
        toNodeId: "n-c5-5",
        fromLaneId: "nl-n-c5-4-l-c5",
        toLaneId: "nl-n-c5-5-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-5",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-5",
        toNodeId: "n-c5-6",
        fromLaneId: "nl-n-c5-5-l-c5",
        toLaneId: "nl-n-c5-6-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-6",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-6",
        toNodeId: "n-c5-7",
        fromLaneId: "nl-n-c5-6-l-c5",
        toLaneId: "nl-n-c5-7-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-7",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-7",
        toNodeId: "n-c5-8",
        fromLaneId: "nl-n-c5-7-l-c5",
        toLaneId: "nl-n-c5-8-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5-8",
        sheetId: "sh-ov",
        fromNodeId: "n-c5-8",
        toNodeId: "n-sagunt",
        fromLaneId: "nl-n-c5-8-l-c5",
        toLaneId: "nl-n-sagunt-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-0",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-0",
        toNodeId: "n-c6-1",
        fromLaneId: "nl-n-c6-0-l-c6",
        toLaneId: "nl-n-c6-1-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-1",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-1",
        toNodeId: "n-c6-2",
        fromLaneId: "nl-n-c6-1-l-c6",
        toLaneId: "nl-n-c6-2-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-2",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-2",
        toNodeId: "n-c6-2a",
        fromLaneId: "nl-n-c6-2-l-c6",
        toLaneId: "nl-n-c6-2a-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-2a",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-2a",
        toNodeId: "n-c6-3",
        fromLaneId: "nl-n-c6-2a-l-c6",
        toLaneId: "nl-n-c6-3-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-3",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-3",
        toNodeId: "n-c6-4",
        fromLaneId: "nl-n-c6-3-l-c6",
        toLaneId: "nl-n-c6-4-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-4",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-4",
        toNodeId: "n-c6-5",
        fromLaneId: "nl-n-c6-4-l-c6",
        toLaneId: "nl-n-c6-5-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-5",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-5",
        toNodeId: "n-c6-6",
        fromLaneId: "nl-n-c6-5-l-c6",
        toLaneId: "nl-n-c6-6-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-6",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-6",
        toNodeId: "n-c6-7",
        fromLaneId: "nl-n-c6-6-l-c6",
        toLaneId: "nl-n-c6-7-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-7",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-7",
        toNodeId: "n-c6-8",
        fromLaneId: "nl-n-c6-7-l-c6",
        toLaneId: "nl-n-c6-8-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6-8",
        sheetId: "sh-ov",
        fromNodeId: "n-c6-8",
        toNodeId: "n-sagunt",
        fromLaneId: "nl-n-c6-8-l-c6",
        toLaneId: "nl-n-sagunt-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-0",
        sheetId: "sh-ov",
        fromNodeId: "n-sagunt",
        toNodeId: "n-pucol",
        fromLaneId: "nl-n-sagunt-l-c5",
        toLaneId: "nl-n-pucol-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-1",
        sheetId: "sh-ov",
        fromNodeId: "n-pucol",
        toNodeId: "n-puig",
        fromLaneId: "nl-n-pucol-l-c5",
        toLaneId: "nl-n-puig-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-2",
        sheetId: "sh-ov",
        fromNodeId: "n-puig",
        toNodeId: "n-massalfassar",
        fromLaneId: "nl-n-puig-l-c5",
        toLaneId: "nl-n-massalfassar-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-3",
        sheetId: "sh-ov",
        fromNodeId: "n-massalfassar",
        toNodeId: "n-albuixech",
        fromLaneId: "nl-n-massalfassar-l-c5",
        toLaneId: "nl-n-albuixech-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-4",
        sheetId: "sh-ov",
        fromNodeId: "n-albuixech",
        toNodeId: "n-roca-cuper",
        fromLaneId: "nl-n-albuixech-l-c5",
        toLaneId: "nl-n-roca-cuper-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-5",
        sheetId: "sh-ov",
        fromNodeId: "n-roca-cuper",
        toNodeId: "n-cabanyal",
        fromLaneId: "nl-n-roca-cuper-l-c5",
        toLaneId: "nl-n-cabanyal-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-6",
        sheetId: "sh-ov",
        fromNodeId: "n-cabanyal",
        toNodeId: "n-font",
        fromLaneId: "nl-n-cabanyal-l-c5",
        toLaneId: "nl-n-font-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c5t-7",
        sheetId: "sh-ov",
        fromNodeId: "n-font",
        toNodeId: "n-nord",
        fromLaneId: "nl-n-font-l-c5",
        toLaneId: "nl-n-nord-l-c5",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-0",
        sheetId: "sh-ov",
        fromNodeId: "n-sagunt",
        toNodeId: "n-pucol",
        fromLaneId: "nl-n-sagunt-l-c6",
        toLaneId: "nl-n-pucol-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-1",
        sheetId: "sh-ov",
        fromNodeId: "n-pucol",
        toNodeId: "n-puig",
        fromLaneId: "nl-n-pucol-l-c6",
        toLaneId: "nl-n-puig-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-2",
        sheetId: "sh-ov",
        fromNodeId: "n-puig",
        toNodeId: "n-massalfassar",
        fromLaneId: "nl-n-puig-l-c6",
        toLaneId: "nl-n-massalfassar-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-3",
        sheetId: "sh-ov",
        fromNodeId: "n-massalfassar",
        toNodeId: "n-albuixech",
        fromLaneId: "nl-n-massalfassar-l-c6",
        toLaneId: "nl-n-albuixech-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-4",
        sheetId: "sh-ov",
        fromNodeId: "n-albuixech",
        toNodeId: "n-roca-cuper",
        fromLaneId: "nl-n-albuixech-l-c6",
        toLaneId: "nl-n-roca-cuper-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-5",
        sheetId: "sh-ov",
        fromNodeId: "n-roca-cuper",
        toNodeId: "n-cabanyal",
        fromLaneId: "nl-n-roca-cuper-l-c6",
        toLaneId: "nl-n-cabanyal-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-6",
        sheetId: "sh-ov",
        fromNodeId: "n-cabanyal",
        toNodeId: "n-font",
        fromLaneId: "nl-n-cabanyal-l-c6",
        toLaneId: "nl-n-font-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c6t-7",
        sheetId: "sh-ov",
        fromNodeId: "n-font",
        toNodeId: "n-nord",
        fromLaneId: "nl-n-font-l-c6",
        toLaneId: "nl-n-nord-l-c6",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-0",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-0",
        toNodeId: "n-c3-0a",
        fromLaneId: "nl-n-c3-0-l-c3",
        toLaneId: "nl-n-c3-0a-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-0a",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-0a",
        toNodeId: "n-c3-1",
        fromLaneId: "nl-n-c3-0a-l-c3",
        toLaneId: "nl-n-c3-1-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-1",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-1",
        toNodeId: "n-c3-2",
        fromLaneId: "nl-n-c3-1-l-c3",
        toLaneId: "nl-n-c3-2-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-2",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-2",
        toNodeId: "n-c3-2a",
        fromLaneId: "nl-n-c3-2-l-c3",
        toLaneId: "nl-n-c3-2a-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-2a",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-2a",
        toNodeId: "n-c3-3",
        fromLaneId: "nl-n-c3-2a-l-c3",
        toLaneId: "nl-n-c3-3-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-3",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-3",
        toNodeId: "n-c3-4",
        fromLaneId: "nl-n-c3-3-l-c3",
        toLaneId: "nl-n-c3-4-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-4",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-4",
        toNodeId: "n-c3-5",
        fromLaneId: "nl-n-c3-4-l-c3",
        toLaneId: "nl-n-c3-5-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-5",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-5",
        toNodeId: "n-c3-6",
        fromLaneId: "nl-n-c3-5-l-c3",
        toLaneId: "nl-n-c3-6-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-6",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-6",
        toNodeId: "n-c3-6a",
        fromLaneId: "nl-n-c3-6-l-c3",
        toLaneId: "nl-n-c3-6a-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-6a",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-6a",
        toNodeId: "n-c3-7",
        fromLaneId: "nl-n-c3-6a-l-c3",
        toLaneId: "nl-n-c3-7-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-7",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-7",
        toNodeId: "n-c3-8",
        fromLaneId: "nl-n-c3-7-l-c3",
        toLaneId: "nl-n-c3-8-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-8",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-8",
        toNodeId: "n-c3-8a",
        fromLaneId: "nl-n-c3-8-l-c3",
        toLaneId: "nl-n-c3-8a-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-8a",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-8a",
        toNodeId: "n-c3-9",
        fromLaneId: "nl-n-c3-8a-l-c3",
        toLaneId: "nl-n-c3-9-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-9",
        sheetId: "sh-ov",
        fromNodeId: "n-c3-9",
        toNodeId: "n-font",
        fromLaneId: "nl-n-c3-9-l-c3",
        toLaneId: "nl-n-font-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c3-10",
        sheetId: "sh-ov",
        fromNodeId: "n-font",
        toNodeId: "n-nord",
        fromLaneId: "nl-n-font-l-c3",
        toLaneId: "nl-n-nord-l-c3",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1s-0",
        sheetId: "sh-ov",
        fromNodeId: "n-nord",
        toNodeId: "n-alfafar",
        fromLaneId: "nl-n-nord-l-c1",
        toLaneId: "nl-n-alfafar-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1s-1",
        sheetId: "sh-ov",
        fromNodeId: "n-alfafar",
        toNodeId: "n-massanassa",
        fromLaneId: "nl-n-alfafar-l-c1",
        toLaneId: "nl-n-massanassa-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1s-2",
        sheetId: "sh-ov",
        fromNodeId: "n-massanassa",
        toNodeId: "n-catarroja",
        fromLaneId: "nl-n-massanassa-l-c1",
        toLaneId: "nl-n-catarroja-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1s-3",
        sheetId: "sh-ov",
        fromNodeId: "n-catarroja",
        toNodeId: "n-albal",
        fromLaneId: "nl-n-catarroja-l-c1",
        toLaneId: "nl-n-albal-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1s-4",
        sheetId: "sh-ov",
        fromNodeId: "n-albal",
        toNodeId: "n-silla",
        fromLaneId: "nl-n-albal-l-c1",
        toLaneId: "nl-n-silla-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2s-0",
        sheetId: "sh-ov",
        fromNodeId: "n-nord",
        toNodeId: "n-alfafar",
        fromLaneId: "nl-n-nord-l-c2",
        toLaneId: "nl-n-alfafar-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2s-1",
        sheetId: "sh-ov",
        fromNodeId: "n-alfafar",
        toNodeId: "n-massanassa",
        fromLaneId: "nl-n-alfafar-l-c2",
        toLaneId: "nl-n-massanassa-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2s-2",
        sheetId: "sh-ov",
        fromNodeId: "n-massanassa",
        toNodeId: "n-catarroja",
        fromLaneId: "nl-n-massanassa-l-c2",
        toLaneId: "nl-n-catarroja-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2s-3",
        sheetId: "sh-ov",
        fromNodeId: "n-catarroja",
        toNodeId: "n-albal",
        fromLaneId: "nl-n-catarroja-l-c2",
        toLaneId: "nl-n-albal-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2s-4",
        sheetId: "sh-ov",
        fromNodeId: "n-albal",
        toNodeId: "n-silla",
        fromLaneId: "nl-n-albal-l-c2",
        toLaneId: "nl-n-silla-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-0",
        sheetId: "sh-ov",
        fromNodeId: "n-silla",
        toNodeId: "n-c1-0a",
        fromLaneId: "nl-n-silla-l-c1",
        toLaneId: "nl-n-c1-0a-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-0a",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-0a",
        toNodeId: "n-c1-0",
        fromLaneId: "nl-n-c1-0a-l-c1",
        toLaneId: "nl-n-c1-0-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-1",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-0",
        toNodeId: "n-c1-1",
        fromLaneId: "nl-n-c1-0-l-c1",
        toLaneId: "nl-n-c1-1-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-2",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-1",
        toNodeId: "n-c1-2",
        fromLaneId: "nl-n-c1-1-l-c1",
        toLaneId: "nl-n-c1-2-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-3",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-2",
        toNodeId: "n-c1-3",
        fromLaneId: "nl-n-c1-2-l-c1",
        toLaneId: "nl-n-c1-3-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-4",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-3",
        toNodeId: "n-c1-4",
        fromLaneId: "nl-n-c1-3-l-c1",
        toLaneId: "nl-n-c1-4-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-5",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-4",
        toNodeId: "n-c1-5",
        fromLaneId: "nl-n-c1-4-l-c1",
        toLaneId: "nl-n-c1-5-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c1-6",
        sheetId: "sh-ov",
        fromNodeId: "n-c1-5",
        toNodeId: "n-c1-6",
        fromLaneId: "nl-n-c1-5-l-c1",
        toLaneId: "nl-n-c1-6-l-c1",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-0",
        sheetId: "sh-ov",
        fromNodeId: "n-silla",
        toNodeId: "n-c2-0",
        fromLaneId: "nl-n-silla-l-c2",
        toLaneId: "nl-n-c2-0-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-1",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-0",
        toNodeId: "n-c2-1",
        fromLaneId: "nl-n-c2-0-l-c2",
        toLaneId: "nl-n-c2-1-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-2",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-1",
        toNodeId: "n-c2-2",
        fromLaneId: "nl-n-c2-1-l-c2",
        toLaneId: "nl-n-c2-2-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-3",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-2",
        toNodeId: "n-c2-3",
        fromLaneId: "nl-n-c2-2-l-c2",
        toLaneId: "nl-n-c2-3-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-4",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-3",
        toNodeId: "n-c2-3a",
        fromLaneId: "nl-n-c2-3-l-c2",
        toLaneId: "nl-n-c2-3a-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-4a",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-3a",
        toNodeId: "n-c2-4",
        fromLaneId: "nl-n-c2-3a-l-c2",
        toLaneId: "nl-n-c2-4-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-5",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-4",
        toNodeId: "n-c2-5",
        fromLaneId: "nl-n-c2-4-l-c2",
        toLaneId: "nl-n-c2-5-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-6",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-5",
        toNodeId: "n-c2-6",
        fromLaneId: "nl-n-c2-5-l-c2",
        toLaneId: "nl-n-c2-6-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-7",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-6",
        toNodeId: "n-c2-7",
        fromLaneId: "nl-n-c2-6-l-c2",
        toLaneId: "nl-n-c2-7-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-8",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-7",
        toNodeId: "n-c2-8",
        fromLaneId: "nl-n-c2-7-l-c2",
        toLaneId: "nl-n-c2-8-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg-c2-9",
        sheetId: "sh-ov",
        fromNodeId: "n-c2-8",
        toNodeId: "n-c2-9",
        fromLaneId: "nl-n-c2-8-l-c2",
        toLaneId: "nl-n-c2-9-l-c2",
        geometry: {
          kind: "straight"
        }
      },
      {
        id: "sg1775378705279-11",
        sheetId: "sh-ov",
        fromNodeId: "n1775378474326-7",
        toNodeId: "n-c3-9",
        geometry: {
          kind: "straight"
        },
        fromLaneId: "nl-n1775378474326-7-auto-segment-sg1775378705279-11",
        toLaneId: "nl-n-c3-9-l-c3"
      }
    ],
    lineRuns: [
      {
        id: "lr-c1",
        lineId: "l-c1",
        segmentIds: [
          "sg-c1s-0",
          "sg-c1s-1",
          "sg-c1s-2",
          "sg-c1s-3",
          "sg-c1s-4",
          "sg-c1-0",
          "sg-c1-0a",
          "sg-c1-1",
          "sg-c1-2",
          "sg-c1-3",
          "sg-c1-4",
          "sg-c1-5",
          "sg-c1-6"
        ]
      },
      {
        id: "lr-c2",
        lineId: "l-c2",
        segmentIds: [
          "sg-c2s-0",
          "sg-c2s-1",
          "sg-c2s-2",
          "sg-c2s-3",
          "sg-c2s-4",
          "sg-c2-0",
          "sg-c2-1",
          "sg-c2-2",
          "sg-c2-3",
          "sg-c2-4",
          "sg-c2-4a",
          "sg-c2-5",
          "sg-c2-6",
          "sg-c2-7",
          "sg-c2-8",
          "sg-c2-9"
        ]
      },
      {
        id: "lr-c3",
        lineId: "l-c3",
        segmentIds: [
          "sg-c3-0",
          "sg-c3-0a",
          "sg-c3-1",
          "sg-c3-2",
          "sg-c3-2a",
          "sg-c3-3",
          "sg-c3-4",
          "sg-c3-5",
          "sg-c3-6",
          "sg-c3-6a",
          "sg-c3-7",
          "sg-c3-8",
          "sg-c3-8a",
          "sg-c3-9",
          "sg-c3-10"
        ]
      },
      {
        id: "lr-c5",
        lineId: "l-c5",
        segmentIds: [
          "sg-c5-0",
          "sg-c5-1",
          "sg-c5-2",
          "sg-c5-3",
          "sg-c5-4",
          "sg-c5-5",
          "sg-c5-6",
          "sg-c5-7",
          "sg-c5-8",
          "sg-c5t-0",
          "sg-c5t-1",
          "sg-c5t-2",
          "sg-c5t-3",
          "sg-c5t-4",
          "sg-c5t-5",
          "sg-c5t-6",
          "sg-c5t-7"
        ]
      },
      {
        id: "lr-c6",
        lineId: "l-c6",
        segmentIds: [
          "sg-c6-0",
          "sg-c6-1",
          "sg-c6-2",
          "sg-c6-2a",
          "sg-c6-3",
          "sg-c6-4",
          "sg-c6-5",
          "sg-c6-6",
          "sg-c6-7",
          "sg-c6-8",
          "sg-c6t-0",
          "sg-c6t-1",
          "sg-c6t-2",
          "sg-c6t-3",
          "sg-c6t-4",
          "sg-c6t-5",
          "sg-c6t-6",
          "sg-c6t-7"
        ]
      },
      {
        id: "lr-l1775378342355-5",
        lineId: "l1775378342355-5",
        segmentIds: [
          "sg1775378705279-11"
        ]
      }
    ]
  }
};
