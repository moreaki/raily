import type { RailwayMap } from "./types";

const DEFAULT_STATION_FONT_FAMILY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_STATION_FONT_WEIGHT = "600" as const;
const DEFAULT_STATION_FONT_SIZE = 14;
const DEFAULT_STATION_SYMBOL_SIZE = 1;
const DEFAULT_PARALLEL_TRACK_SPACING = 22;
const DEFAULT_SEGMENT_INDICATOR_WIDTH = 16;
const DEFAULT_SELECTED_SEGMENT_INDICATOR_BOOST = 4;
const DEFAULT_GRID_LINE_OPACITY = 0.45;
const DEFAULT_LABEL_AXIS_SNAP_SENSITIVITY = 10;

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
    selectedSegmentIndicatorBoost: DEFAULT_SELECTED_SEGMENT_INDICATOR_BOOST,
    gridLineOpacity: DEFAULT_GRID_LINE_OPACITY,
    labelAxisSnapSensitivity: DEFAULT_LABEL_AXIS_SNAP_SENSITIVITY,
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
  "config": {
    "stationKinds": [
      {
        "id": "sk-stop",
        "name": "Stop",
        "shape": "circle",
        "symbolSize": 1,
        "fontFamily": "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        "fontWeight": "600",
        "fontSize": 14
      },
      {
        "id": "sk-hub",
        "name": "Hub",
        "shape": "interchange",
        "symbolSize": 1,
        "fontFamily": "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        "fontWeight": "700",
        "fontSize": 15
      },
      {
        "id": "sk-terminal",
        "name": "Terminal",
        "shape": "terminal",
        "symbolSize": 1,
        "fontFamily": "\"Avenir Next\", \"Helvetica Neue\", Arial, sans-serif",
        "fontWeight": "600",
        "fontSize": 14
      }
    ],
    "lines": [
      {
        "id": "l-c1",
        "name": "C1",
        "color": "#74b6f2",
        "strokeWidth": 9,
        "strokeStyle": "solid"
      },
      {
        "id": "l-c2",
        "name": "C2",
        "color": "#facc15",
        "strokeWidth": 9,
        "strokeStyle": "solid"
      },
      {
        "id": "l-c3",
        "name": "C3",
        "color": "#8b1fa9",
        "strokeWidth": 9,
        "strokeStyle": "solid"
      },
      {
        "id": "l-c5",
        "name": "C5",
        "color": "#65a30d",
        "strokeWidth": 9,
        "strokeStyle": "solid"
      },
      {
        "id": "l-c6",
        "name": "C6",
        "color": "#1d4ed8",
        "strokeWidth": 9,
        "strokeStyle": "solid"
      },
      {
        "id": "l1775378342355-5",
        "name": "C4",
        "color": "#ff2600",
        "strokeWidth": 10,
        "strokeStyle": "solid"
      }
    ],
    "parallelTrackSpacing": 22,
    "segmentIndicatorWidth": 16,
    "gridLineOpacity": 0.45,
    "selectedSegmentIndicatorBoost": 4,
    "labelAxisSnapSensitivity": 10
  },
  "model": {
    "sheets": [
      {
        "id": "sh-ov",
        "name": "Rodalia València Overview"
      }
    ],
    "nodes": [
      {
        "x": 228,
        "y": 104,
        "id": "n-c5-0",
        "sheetId": "sh-ov"
      },
      {
        "x": 276,
        "y": 152,
        "id": "n-c5-1",
        "sheetId": "sh-ov"
      },
      {
        "x": 324,
        "y": 200,
        "id": "n-c5-2",
        "sheetId": "sh-ov"
      },
      {
        "x": 372,
        "y": 248,
        "id": "n-c5-3",
        "sheetId": "sh-ov"
      },
      {
        "x": 420,
        "y": 296,
        "id": "n-c5-4",
        "sheetId": "sh-ov"
      },
      {
        "x": 468,
        "y": 344,
        "id": "n-c5-5",
        "sheetId": "sh-ov"
      },
      {
        "x": 516,
        "y": 392,
        "id": "n-c5-6",
        "sheetId": "sh-ov"
      },
      {
        "x": 564,
        "y": 440,
        "id": "n-c5-7",
        "sheetId": "sh-ov"
      },
      {
        "x": 610,
        "y": 491,
        "id": "n-c5-8",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 536,
        "id": "n-sagunt",
        "sheetId": "sh-ov"
      },
      {
        "x": 1140,
        "y": 56,
        "id": "n-c6-0",
        "sheetId": "sh-ov"
      },
      {
        "x": 1092,
        "y": 104,
        "id": "n-c6-1",
        "sheetId": "sh-ov"
      },
      {
        "x": 1044,
        "y": 152,
        "id": "n-c6-2",
        "sheetId": "sh-ov"
      },
      {
        "x": 996,
        "y": 200,
        "id": "n-c6-2a",
        "sheetId": "sh-ov"
      },
      {
        "x": 948,
        "y": 248,
        "id": "n-c6-3",
        "sheetId": "sh-ov"
      },
      {
        "x": 900,
        "y": 296,
        "id": "n-c6-4",
        "sheetId": "sh-ov"
      },
      {
        "x": 852,
        "y": 344,
        "id": "n-c6-5",
        "sheetId": "sh-ov"
      },
      {
        "x": 804,
        "y": 392,
        "id": "n-c6-6",
        "sheetId": "sh-ov"
      },
      {
        "x": 756,
        "y": 440,
        "id": "n-c6-7",
        "sheetId": "sh-ov"
      },
      {
        "x": 714,
        "y": 488,
        "id": "n-c6-8",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 584,
        "id": "n-pucol",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 632,
        "id": "n-puig",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 680,
        "id": "n-massalfassar",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 730,
        "id": "n-albuixech",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 776,
        "id": "n-roca-cuper",
        "sheetId": "sh-ov"
      },
      {
        "x": 660,
        "y": 824,
        "id": "n-cabanyal",
        "sheetId": "sh-ov"
      },
      {
        "x": 652,
        "y": 871,
        "id": "n-font",
        "sheetId": "sh-ov"
      },
      {
        "x": 632,
        "y": 919,
        "id": "n-nord",
        "sheetId": "sh-ov"
      },
      {
        "x": -114,
        "y": 584,
        "id": "n-c3-0",
        "sheetId": "sh-ov"
      },
      {
        "x": -66,
        "y": 632,
        "id": "n-c3-0a",
        "sheetId": "sh-ov"
      },
      {
        "x": -18,
        "y": 680,
        "id": "n-c3-1",
        "sheetId": "sh-ov"
      },
      {
        "x": 30,
        "y": 728,
        "id": "n-c3-2",
        "sheetId": "sh-ov"
      },
      {
        "x": 78,
        "y": 776,
        "id": "n-c3-2a",
        "sheetId": "sh-ov"
      },
      {
        "x": 126,
        "y": 824,
        "id": "n-c3-3",
        "sheetId": "sh-ov"
      },
      {
        "x": 172,
        "y": 871,
        "id": "n-c3-4",
        "sheetId": "sh-ov"
      },
      {
        "x": 220,
        "y": 871,
        "id": "n-c3-5",
        "sheetId": "sh-ov"
      },
      {
        "x": 268,
        "y": 871,
        "id": "n-c3-6",
        "sheetId": "sh-ov"
      },
      {
        "x": 316,
        "y": 871,
        "id": "n-c3-6a",
        "sheetId": "sh-ov"
      },
      {
        "x": 364,
        "y": 871,
        "id": "n-c3-7",
        "sheetId": "sh-ov"
      },
      {
        "x": 412,
        "y": 871,
        "id": "n-c3-8",
        "sheetId": "sh-ov"
      },
      {
        "x": 460,
        "y": 871,
        "id": "n-c3-8a",
        "sheetId": "sh-ov"
      },
      {
        "x": 508,
        "y": 871,
        "id": "n-c3-9",
        "sheetId": "sh-ov"
      },
      {
        "x": 596,
        "y": 973,
        "id": "n-alfafar",
        "sheetId": "sh-ov"
      },
      {
        "x": 599,
        "y": 1015,
        "id": "n-massanassa",
        "sheetId": "sh-ov"
      },
      {
        "x": 598,
        "y": 1066,
        "id": "n-catarroja",
        "sheetId": "sh-ov"
      },
      {
        "x": 598,
        "y": 1121,
        "id": "n-albal",
        "sheetId": "sh-ov"
      },
      {
        "x": 598,
        "y": 1165,
        "id": "n-silla",
        "sheetId": "sh-ov"
      },
      {
        "x": 610,
        "y": 1216,
        "id": "n-c1-0a",
        "sheetId": "sh-ov"
      },
      {
        "x": 609,
        "y": 1258,
        "id": "n-c1-0",
        "sheetId": "sh-ov"
      },
      {
        "x": 609,
        "y": 1309,
        "id": "n-c1-1",
        "sheetId": "sh-ov"
      },
      {
        "x": 610,
        "y": 1364,
        "id": "n-c1-2",
        "sheetId": "sh-ov"
      },
      {
        "x": 610,
        "y": 1417,
        "id": "n-c1-3",
        "sheetId": "sh-ov"
      },
      {
        "x": 610,
        "y": 1472,
        "id": "n-c1-4",
        "sheetId": "sh-ov"
      },
      {
        "x": 741,
        "y": 1573,
        "id": "n-c1-5",
        "sheetId": "sh-ov"
      },
      {
        "x": 609,
        "y": 1574,
        "id": "n-c1-6",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1215,
        "id": "n-c2-0",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1263,
        "id": "n-c2-1",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1311,
        "id": "n-c2-2",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1359,
        "id": "n-c2-3",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1407,
        "id": "n-c2-3a",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1455,
        "id": "n-c2-4",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1503,
        "id": "n-c2-5",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1551,
        "id": "n-c2-6",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1599,
        "id": "n-c2-7",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1647,
        "id": "n-c2-8",
        "sheetId": "sh-ov"
      },
      {
        "x": 408,
        "y": 1695,
        "id": "n-c2-9",
        "sheetId": "sh-ov"
      },
      {
        "x": 473,
        "y": 807,
        "id": "n1775378474326-7",
        "sheetId": "sh-ov"
      }
    ],
    "nodeLanes": [
      {
        "id": "nl-n-c5-0-l-c5",
        "nodeId": "n-c5-0",
        "order": 0
      },
      {
        "id": "nl-n-c5-1-l-c5",
        "nodeId": "n-c5-1",
        "order": 0
      },
      {
        "id": "nl-n-c5-2-l-c5",
        "nodeId": "n-c5-2",
        "order": 0
      },
      {
        "id": "nl-n-c5-3-l-c5",
        "nodeId": "n-c5-3",
        "order": 0
      },
      {
        "id": "nl-n-c5-4-l-c5",
        "nodeId": "n-c5-4",
        "order": 0
      },
      {
        "id": "nl-n-c5-5-l-c5",
        "nodeId": "n-c5-5",
        "order": 0
      },
      {
        "id": "nl-n-c5-6-l-c5",
        "nodeId": "n-c5-6",
        "order": 0
      },
      {
        "id": "nl-n-c5-7-l-c5",
        "nodeId": "n-c5-7",
        "order": 0
      },
      {
        "id": "nl-n-c5-8-l-c5",
        "nodeId": "n-c5-8",
        "order": 0
      },
      {
        "id": "nl-n-sagunt-l-c5",
        "nodeId": "n-sagunt",
        "order": 0
      },
      {
        "id": "nl-n-sagunt-l-c6",
        "nodeId": "n-sagunt",
        "order": 1
      },
      {
        "id": "nl-n-c6-0-l-c6",
        "nodeId": "n-c6-0",
        "order": 0
      },
      {
        "id": "nl-n-c6-1-l-c6",
        "nodeId": "n-c6-1",
        "order": 0
      },
      {
        "id": "nl-n-c6-2-l-c6",
        "nodeId": "n-c6-2",
        "order": 0
      },
      {
        "id": "nl-n-c6-2a-l-c6",
        "nodeId": "n-c6-2a",
        "order": 0
      },
      {
        "id": "nl-n-c6-3-l-c6",
        "nodeId": "n-c6-3",
        "order": 0
      },
      {
        "id": "nl-n-c6-4-l-c6",
        "nodeId": "n-c6-4",
        "order": 0
      },
      {
        "id": "nl-n-c6-5-l-c6",
        "nodeId": "n-c6-5",
        "order": 0
      },
      {
        "id": "nl-n-c6-6-l-c6",
        "nodeId": "n-c6-6",
        "order": 0
      },
      {
        "id": "nl-n-c6-7-l-c6",
        "nodeId": "n-c6-7",
        "order": 0
      },
      {
        "id": "nl-n-c6-8-l-c6",
        "nodeId": "n-c6-8",
        "order": 0
      },
      {
        "id": "nl-n-pucol-l-c5",
        "nodeId": "n-pucol",
        "order": 0
      },
      {
        "id": "nl-n-pucol-l-c6",
        "nodeId": "n-pucol",
        "order": 1
      },
      {
        "id": "nl-n-puig-l-c5",
        "nodeId": "n-puig",
        "order": 0
      },
      {
        "id": "nl-n-puig-l-c6",
        "nodeId": "n-puig",
        "order": 1
      },
      {
        "id": "nl-n-massalfassar-l-c5",
        "nodeId": "n-massalfassar",
        "order": 0
      },
      {
        "id": "nl-n-massalfassar-l-c6",
        "nodeId": "n-massalfassar",
        "order": 1
      },
      {
        "id": "nl-n-albuixech-l-c5",
        "nodeId": "n-albuixech",
        "order": 0
      },
      {
        "id": "nl-n-albuixech-l-c6",
        "nodeId": "n-albuixech",
        "order": 1
      },
      {
        "id": "nl-n-roca-cuper-l-c5",
        "nodeId": "n-roca-cuper",
        "order": 0
      },
      {
        "id": "nl-n-roca-cuper-l-c6",
        "nodeId": "n-roca-cuper",
        "order": 1
      },
      {
        "id": "nl-n-cabanyal-l-c5",
        "nodeId": "n-cabanyal",
        "order": 0
      },
      {
        "id": "nl-n-cabanyal-l-c6",
        "nodeId": "n-cabanyal",
        "order": 1
      },
      {
        "id": "nl-n-font-l-c3",
        "nodeId": "n-font",
        "order": 0
      },
      {
        "id": "nl-n-font-l-c5",
        "nodeId": "n-font",
        "order": 1
      },
      {
        "id": "nl-n-font-l-c6",
        "nodeId": "n-font",
        "order": 2
      },
      {
        "id": "nl-n-nord-l-c2",
        "nodeId": "n-nord",
        "order": 0
      },
      {
        "id": "nl-n-nord-l-c1",
        "nodeId": "n-nord",
        "order": 1
      },
      {
        "id": "nl-n-nord-l-c3",
        "nodeId": "n-nord",
        "order": 2
      },
      {
        "id": "nl-n-nord-l-c5",
        "nodeId": "n-nord",
        "order": 3
      },
      {
        "id": "nl-n-nord-l-c6",
        "nodeId": "n-nord",
        "order": 4
      },
      {
        "id": "nl-n-c3-0-l-c3",
        "nodeId": "n-c3-0",
        "order": 0
      },
      {
        "id": "nl-n-c3-0a-l-c3",
        "nodeId": "n-c3-0a",
        "order": 0
      },
      {
        "id": "nl-n-c3-1-l-c3",
        "nodeId": "n-c3-1",
        "order": 0
      },
      {
        "id": "nl-n-c3-2-l-c3",
        "nodeId": "n-c3-2",
        "order": 0
      },
      {
        "id": "nl-n-c3-2a-l-c3",
        "nodeId": "n-c3-2a",
        "order": 0
      },
      {
        "id": "nl-n-c3-3-l-c3",
        "nodeId": "n-c3-3",
        "order": 0
      },
      {
        "id": "nl-n-c3-4-l-c3",
        "nodeId": "n-c3-4",
        "order": 0
      },
      {
        "id": "nl-n-c3-5-l-c3",
        "nodeId": "n-c3-5",
        "order": 0
      },
      {
        "id": "nl-n-c3-6-l-c3",
        "nodeId": "n-c3-6",
        "order": 0
      },
      {
        "id": "nl-n-c3-6a-l-c3",
        "nodeId": "n-c3-6a",
        "order": 0
      },
      {
        "id": "nl-n-c3-7-l-c3",
        "nodeId": "n-c3-7",
        "order": 0
      },
      {
        "id": "nl-n-c3-8-l-c3",
        "nodeId": "n-c3-8",
        "order": 0
      },
      {
        "id": "nl-n-c3-8a-l-c3",
        "nodeId": "n-c3-8a",
        "order": 0
      },
      {
        "id": "nl-n-c3-9-l-c3",
        "nodeId": "n-c3-9",
        "order": 0
      },
      {
        "id": "nl-n-alfafar-l-c2",
        "nodeId": "n-alfafar",
        "order": 0
      },
      {
        "id": "nl-n-alfafar-l-c1",
        "nodeId": "n-alfafar",
        "order": 1
      },
      {
        "id": "nl-n-massanassa-l-c2",
        "nodeId": "n-massanassa",
        "order": 0
      },
      {
        "id": "nl-n-massanassa-l-c1",
        "nodeId": "n-massanassa",
        "order": 1
      },
      {
        "id": "nl-n-catarroja-l-c2",
        "nodeId": "n-catarroja",
        "order": 0
      },
      {
        "id": "nl-n-catarroja-l-c1",
        "nodeId": "n-catarroja",
        "order": 1
      },
      {
        "id": "nl-n-albal-l-c2",
        "nodeId": "n-albal",
        "order": 0
      },
      {
        "id": "nl-n-albal-l-c1",
        "nodeId": "n-albal",
        "order": 1
      },
      {
        "id": "nl-n-silla-l-c2",
        "nodeId": "n-silla",
        "order": 0
      },
      {
        "id": "nl-n-silla-l-c1",
        "nodeId": "n-silla",
        "order": 1
      },
      {
        "id": "nl-n-c1-0a-l-c1",
        "nodeId": "n-c1-0a",
        "order": 0
      },
      {
        "id": "nl-n-c1-0-l-c1",
        "nodeId": "n-c1-0",
        "order": 0
      },
      {
        "id": "nl-n-c1-1-l-c1",
        "nodeId": "n-c1-1",
        "order": 0
      },
      {
        "id": "nl-n-c1-2-l-c1",
        "nodeId": "n-c1-2",
        "order": 0
      },
      {
        "id": "nl-n-c1-3-l-c1",
        "nodeId": "n-c1-3",
        "order": 0
      },
      {
        "id": "nl-n-c1-4-l-c1",
        "nodeId": "n-c1-4",
        "order": 0
      },
      {
        "id": "nl-n-c1-5-l-c1",
        "nodeId": "n-c1-5",
        "order": 0
      },
      {
        "id": "nl-n-c1-6-auto-segment-sg1775382230143-1",
        "nodeId": "n-c1-6",
        "order": 0
      },
      {
        "id": "nl-n-c2-0-l-c2",
        "nodeId": "n-c2-0",
        "order": 0
      },
      {
        "id": "nl-n-c2-1-l-c2",
        "nodeId": "n-c2-1",
        "order": 0
      },
      {
        "id": "nl-n-c2-2-l-c2",
        "nodeId": "n-c2-2",
        "order": 0
      },
      {
        "id": "nl-n-c2-3-l-c2",
        "nodeId": "n-c2-3",
        "order": 0
      },
      {
        "id": "nl-n-c2-3a-l-c2",
        "nodeId": "n-c2-3a",
        "order": 0
      },
      {
        "id": "nl-n-c2-4-l-c2",
        "nodeId": "n-c2-4",
        "order": 0
      },
      {
        "id": "nl-n-c2-5-l-c2",
        "nodeId": "n-c2-5",
        "order": 0
      },
      {
        "id": "nl-n-c2-6-l-c2",
        "nodeId": "n-c2-6",
        "order": 0
      },
      {
        "id": "nl-n-c2-7-l-c2",
        "nodeId": "n-c2-7",
        "order": 0
      },
      {
        "id": "nl-n-c2-8-l-c2",
        "nodeId": "n-c2-8",
        "order": 0
      },
      {
        "id": "nl-n-c2-9-l-c2",
        "nodeId": "n-c2-9",
        "order": 0
      },
      {
        "id": "nl-n1775378474326-7-auto-segment-sg1775378705279-11",
        "nodeId": "n1775378474326-7",
        "order": 0
      }
    ],
    "stations": [
      {
        "id": "s-c5-0",
        "nodeId": "n-c5-0",
        "name": "Caudiel",
        "kindId": "sk-terminal",
        "label": {
          "x": 208,
          "y": 82,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-1",
        "nodeId": "n-c5-1",
        "name": "Jérica-Viver",
        "kindId": "sk-stop",
        "label": {
          "x": 149,
          "y": 158,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-2",
        "nodeId": "n-c5-2",
        "name": "Navajas",
        "kindId": "sk-stop",
        "label": {
          "x": 234,
          "y": 206,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-3",
        "nodeId": "n-c5-3",
        "name": "Segorbe Arrabal",
        "kindId": "sk-stop",
        "label": {
          "x": 230,
          "y": 254,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-4",
        "nodeId": "n-c5-4",
        "name": "Segorbe Ciudad",
        "kindId": "sk-stop",
        "label": {
          "x": 275,
          "y": 305,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-5",
        "nodeId": "n-c5-5",
        "name": "Soneja",
        "kindId": "sk-stop",
        "label": {
          "x": 385,
          "y": 351,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-6",
        "nodeId": "n-c5-6",
        "name": "Algimia Ciudad",
        "kindId": "sk-stop",
        "label": {
          "x": 391,
          "y": 400,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-7",
        "nodeId": "n-c5-7",
        "name": "Estivella-Albalat dels Tarongers",
        "kindId": "sk-stop",
        "label": {
          "x": 337.08,
          "y": 447,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c5-8",
        "nodeId": "n-c5-8",
        "name": "Gilet",
        "kindId": "sk-stop",
        "label": {
          "x": 550,
          "y": 498,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-sagunt",
        "nodeId": "n-sagunt",
        "name": "Sagunt/Sagunto",
        "kindId": "sk-stop",
        "label": {
          "x": 700,
          "y": 545,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-0",
        "nodeId": "n-c6-0",
        "name": "Castelló de la Plana",
        "kindId": "sk-terminal",
        "label": {
          "x": 1094,
          "y": 30,
          "align": "top",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-1",
        "nodeId": "n-c6-1",
        "name": "Almassora",
        "kindId": "sk-stop",
        "label": {
          "x": 1118,
          "y": 118,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-2",
        "nodeId": "n-c6-2",
        "name": "Vila-real",
        "kindId": "sk-stop",
        "label": {
          "x": 1075,
          "y": 163,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-2a",
        "nodeId": "n-c6-2a",
        "name": "Borriana/Burriana-les Alqueries/Alquerías del Niño Perdido",
        "kindId": "sk-stop",
        "label": {
          "x": 1024,
          "y": 208,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-3",
        "nodeId": "n-c6-3",
        "name": "Nules-La Vilavella",
        "kindId": "sk-stop",
        "label": {
          "x": 982,
          "y": 260,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-4",
        "nodeId": "n-c6-4",
        "name": "Moncofa",
        "kindId": "sk-stop",
        "label": {
          "x": 935,
          "y": 305,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-5",
        "nodeId": "n-c6-5",
        "name": "Xilxes/Chilches",
        "kindId": "sk-stop",
        "label": {
          "x": 884,
          "y": 354,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-6",
        "nodeId": "n-c6-6",
        "name": "La Llosa",
        "kindId": "sk-stop",
        "label": {
          "x": 843,
          "y": 401,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-7",
        "nodeId": "n-c6-7",
        "name": "Almenara",
        "kindId": "sk-stop",
        "label": {
          "x": 787,
          "y": 450,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c6-8",
        "nodeId": "n-c6-8",
        "name": "les Valls",
        "kindId": "sk-stop",
        "label": {
          "x": 744,
          "y": 497,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-pucol",
        "nodeId": "n-pucol",
        "name": "Puçol",
        "kindId": "sk-stop",
        "label": {
          "x": 704,
          "y": 591,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-puig",
        "nodeId": "n-puig",
        "name": "el Puig de Santa Maria",
        "kindId": "sk-stop",
        "label": {
          "x": 700,
          "y": 636,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-massalfassar",
        "nodeId": "n-massalfassar",
        "name": "Massalfassar",
        "kindId": "sk-stop",
        "label": {
          "x": 704,
          "y": 690,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-albuixech",
        "nodeId": "n-albuixech",
        "name": "Albuixech",
        "kindId": "sk-stop",
        "label": {
          "x": 700,
          "y": 737,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-roca",
        "nodeId": "n-roca-cuper",
        "name": "Roca-Cúper",
        "kindId": "sk-stop",
        "label": {
          "x": 704,
          "y": 783,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-cabanyal",
        "nodeId": "n-cabanyal",
        "name": "València Cabanyal",
        "kindId": "sk-stop",
        "label": {
          "x": 708,
          "y": 831,
          "align": "right",
          "rotation": 1
        }
      },
      {
        "id": "s-font",
        "nodeId": "n-font",
        "name": "València la Font de Sant Lluís",
        "kindId": "sk-hub",
        "label": {
          "x": 716,
          "y": 878.5,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-nord",
        "nodeId": "n-nord",
        "name": "València Estació del Nord",
        "kindId": "sk-hub",
        "label": {
          "x": 719,
          "y": 926,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c3-0",
        "nodeId": "n-c3-0",
        "name": "Utiel",
        "kindId": "sk-terminal",
        "label": {
          "x": -128,
          "y": 560,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c3-0a",
        "nodeId": "n-c3-0a",
        "name": "San Antonio de Requena",
        "kindId": "sk-stop",
        "label": {
          "x": -65.715,
          "y": 565.285,
          "align": "right",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-1",
        "nodeId": "n-c3-1",
        "name": "Requena",
        "kindId": "sk-stop",
        "label": {
          "x": -1.1700000000000017,
          "y": 644.83,
          "align": "left",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-2",
        "nodeId": "n-c3-2",
        "name": "El Rebollar",
        "kindId": "sk-stop",
        "label": {
          "x": 38.394999999999996,
          "y": 691.395,
          "align": "right",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-2a",
        "nodeId": "n-c3-2a",
        "name": "Siete Aguas",
        "kindId": "sk-stop",
        "label": {
          "x": 89.765,
          "y": 734.765,
          "align": "right",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-3",
        "nodeId": "n-c3-3",
        "name": "Venta Mina-Siete Aguas",
        "kindId": "sk-stop",
        "label": {
          "x": 127.53,
          "y": 756.53,
          "align": "right",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-4",
        "nodeId": "n-c3-4",
        "name": "Buñol",
        "kindId": "sk-stop",
        "label": {
          "x": 120.46000000000001,
          "y": 912.46,
          "align": "left",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-5",
        "nodeId": "n-c3-5",
        "name": "Chiva",
        "kindId": "sk-stop",
        "label": {
          "x": 164.96,
          "y": 915.96,
          "align": "top",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-6",
        "nodeId": "n-c3-6",
        "name": "Cheste",
        "kindId": "sk-stop",
        "label": {
          "x": 205.87,
          "y": 919.55,
          "align": "top",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-6a",
        "nodeId": "n-c3-6a",
        "name": "Circuit Ricardo Tormo",
        "kindId": "sk-stop",
        "label": {
          "x": 170.39,
          "y": 952.77,
          "align": "left",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-7",
        "nodeId": "n-c3-7",
        "name": "Loriguilla-Reva",
        "kindId": "sk-stop",
        "label": {
          "x": 252.27999999999997,
          "y": 941.98,
          "align": "left",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-8",
        "nodeId": "n-c3-8",
        "name": "Aldaia",
        "kindId": "sk-stop",
        "label": {
          "x": 348.9999999999999,
          "y": 921.6800000000001,
          "align": "top",
          "rotation": -46
        }
      },
      {
        "id": "s-c3-8a",
        "nodeId": "n-c3-8a",
        "name": "Xirivella Alqueries",
        "kindId": "sk-stop",
        "label": {
          "x": 336.59000000000015,
          "y": 945.4099999999999,
          "align": "left",
          "rotation": -45
        }
      },
      {
        "id": "s-c3-9",
        "nodeId": "n-c3-9",
        "name": "València Sant Isidre",
        "kindId": "sk-stop",
        "label": {
          "x": 375,
          "y": 949,
          "align": "bottom",
          "rotation": -45
        }
      },
      {
        "id": "s-alfafar",
        "nodeId": "n-alfafar",
        "name": "Alfafar-Benetússer",
        "kindId": "sk-stop",
        "label": {
          "x": 639,
          "y": 980,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-massanassa",
        "nodeId": "n-massanassa",
        "name": "Massanassa",
        "kindId": "sk-stop",
        "label": {
          "x": 645,
          "y": 1022,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-catarroja",
        "nodeId": "n-catarroja",
        "name": "Catarroja",
        "kindId": "sk-stop",
        "label": {
          "x": 645,
          "y": 1073,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-albal",
        "nodeId": "n-albal",
        "name": "Albal",
        "kindId": "sk-stop",
        "label": {
          "x": 646,
          "y": 1125,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-silla",
        "nodeId": "n-silla",
        "name": "Silla",
        "kindId": "sk-stop",
        "label": {
          "x": 644,
          "y": 1173,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-0a",
        "nodeId": "n-c1-0a",
        "name": "el Romaní",
        "kindId": "sk-stop",
        "label": {
          "x": 638,
          "y": 1223,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-0",
        "nodeId": "n-c1-0",
        "name": "Sollana",
        "kindId": "sk-stop",
        "label": {
          "x": 642,
          "y": 1265,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-1",
        "nodeId": "n-c1-1",
        "name": "Sueca",
        "kindId": "sk-stop",
        "label": {
          "x": 645,
          "y": 1316,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-2",
        "nodeId": "n-c1-2",
        "name": "Cullera",
        "kindId": "sk-stop",
        "label": {
          "x": 649,
          "y": 1371,
          "align": "top",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-3",
        "nodeId": "n-c1-3",
        "name": "Tavernes de la Valldigna",
        "kindId": "sk-stop",
        "label": {
          "x": 643,
          "y": 1424,
          "align": "top",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-4",
        "nodeId": "n-c1-4",
        "name": "Xeraco",
        "kindId": "sk-stop",
        "label": {
          "x": 651,
          "y": 1479,
          "align": "top",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-5",
        "nodeId": "n-c1-5",
        "name": "Platja i Grau de Gandia",
        "kindId": "sk-terminal",
        "label": {
          "x": 669.04,
          "y": 1623,
          "align": "top",
          "rotation": 0
        }
      },
      {
        "id": "s-c1-6",
        "nodeId": "n-c1-6",
        "name": "Gandia",
        "kindId": "sk-terminal",
        "label": {
          "x": 588.4200000000001,
          "y": 1621,
          "align": "right",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-0",
        "nodeId": "n-c2-0",
        "name": "Benifaió",
        "kindId": "sk-stop",
        "label": {
          "x": 321.52,
          "y": 1218,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-1",
        "nodeId": "n-c2-1",
        "name": "Algemesí",
        "kindId": "sk-stop",
        "label": {
          "x": 313.52,
          "y": 1269,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-2",
        "nodeId": "n-c2-2",
        "name": "Alzira",
        "kindId": "sk-stop",
        "label": {
          "x": 333.64,
          "y": 1315,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-3",
        "nodeId": "n-c2-3",
        "name": "Carcaixent",
        "kindId": "sk-stop",
        "label": {
          "x": 309.4,
          "y": 1364,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-3a",
        "nodeId": "n-c2-3a",
        "name": "la Pobla Llarga",
        "kindId": "sk-stop",
        "label": {
          "x": 281.6,
          "y": 1414,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-4",
        "nodeId": "n-c2-4",
        "name": "l'Ènova-Manuel",
        "kindId": "sk-stop",
        "label": {
          "x": 277.15999999999997,
          "y": 1462,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-5",
        "nodeId": "n-c2-5",
        "name": "Xàtiva",
        "kindId": "sk-stop",
        "label": {
          "x": 331.64,
          "y": 1511,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-6",
        "nodeId": "n-c2-6",
        "name": "l'Alcúdia de Crespins",
        "kindId": "sk-stop",
        "label": {
          "x": 239.24,
          "y": 1555,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-7",
        "nodeId": "n-c2-7",
        "name": "Montesa",
        "kindId": "sk-stop",
        "label": {
          "x": 324.08,
          "y": 1602,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-8",
        "nodeId": "n-c2-8",
        "name": "Vallada",
        "kindId": "sk-stop",
        "label": {
          "x": 325.08,
          "y": 1652,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s-c2-9",
        "nodeId": "n-c2-9",
        "name": "Moixent/Mogente",
        "kindId": "sk-terminal",
        "label": {
          "x": 258.6,
          "y": 1701,
          "align": "left",
          "rotation": 0
        }
      },
      {
        "id": "s1775378671843-10",
        "nodeId": "n1775378474326-7",
        "name": "Xirvella L'Alter",
        "kindId": "sk-terminal",
        "label": {
          "x": 423.93,
          "y": 786,
          "align": "right",
          "rotation": 0
        }
      }
    ],
    "segments": [
      {
        "id": "sg-c5-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-0",
        "toNodeId": "n-c5-1",
        "fromLaneId": "nl-n-c5-0-l-c5",
        "toLaneId": "nl-n-c5-1-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-1",
        "toNodeId": "n-c5-2",
        "fromLaneId": "nl-n-c5-1-l-c5",
        "toLaneId": "nl-n-c5-2-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-2",
        "toNodeId": "n-c5-3",
        "fromLaneId": "nl-n-c5-2-l-c5",
        "toLaneId": "nl-n-c5-3-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-3",
        "toNodeId": "n-c5-4",
        "fromLaneId": "nl-n-c5-3-l-c5",
        "toLaneId": "nl-n-c5-4-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-4",
        "toNodeId": "n-c5-5",
        "fromLaneId": "nl-n-c5-4-l-c5",
        "toLaneId": "nl-n-c5-5-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-5",
        "toNodeId": "n-c5-6",
        "fromLaneId": "nl-n-c5-5-l-c5",
        "toLaneId": "nl-n-c5-6-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-6",
        "toNodeId": "n-c5-7",
        "fromLaneId": "nl-n-c5-6-l-c5",
        "toLaneId": "nl-n-c5-7-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-7",
        "toNodeId": "n-c5-8",
        "fromLaneId": "nl-n-c5-7-l-c5",
        "toLaneId": "nl-n-c5-8-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5-8",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c5-8",
        "toNodeId": "n-sagunt",
        "fromLaneId": "nl-n-c5-8-l-c5",
        "toLaneId": "nl-n-sagunt-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-0",
        "toNodeId": "n-c6-1",
        "fromLaneId": "nl-n-c6-0-l-c6",
        "toLaneId": "nl-n-c6-1-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-1",
        "toNodeId": "n-c6-2",
        "fromLaneId": "nl-n-c6-1-l-c6",
        "toLaneId": "nl-n-c6-2-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-2",
        "toNodeId": "n-c6-2a",
        "fromLaneId": "nl-n-c6-2-l-c6",
        "toLaneId": "nl-n-c6-2a-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-2a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-2a",
        "toNodeId": "n-c6-3",
        "fromLaneId": "nl-n-c6-2a-l-c6",
        "toLaneId": "nl-n-c6-3-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-3",
        "toNodeId": "n-c6-4",
        "fromLaneId": "nl-n-c6-3-l-c6",
        "toLaneId": "nl-n-c6-4-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-4",
        "toNodeId": "n-c6-5",
        "fromLaneId": "nl-n-c6-4-l-c6",
        "toLaneId": "nl-n-c6-5-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-5",
        "toNodeId": "n-c6-6",
        "fromLaneId": "nl-n-c6-5-l-c6",
        "toLaneId": "nl-n-c6-6-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-6",
        "toNodeId": "n-c6-7",
        "fromLaneId": "nl-n-c6-6-l-c6",
        "toLaneId": "nl-n-c6-7-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-7",
        "toNodeId": "n-c6-8",
        "fromLaneId": "nl-n-c6-7-l-c6",
        "toLaneId": "nl-n-c6-8-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6-8",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c6-8",
        "toNodeId": "n-sagunt",
        "fromLaneId": "nl-n-c6-8-l-c6",
        "toLaneId": "nl-n-sagunt-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-sagunt",
        "toNodeId": "n-pucol",
        "fromLaneId": "nl-n-sagunt-l-c5",
        "toLaneId": "nl-n-pucol-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-pucol",
        "toNodeId": "n-puig",
        "fromLaneId": "nl-n-pucol-l-c5",
        "toLaneId": "nl-n-puig-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-puig",
        "toNodeId": "n-massalfassar",
        "fromLaneId": "nl-n-puig-l-c5",
        "toLaneId": "nl-n-massalfassar-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-massalfassar",
        "toNodeId": "n-albuixech",
        "fromLaneId": "nl-n-massalfassar-l-c5",
        "toLaneId": "nl-n-albuixech-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-albuixech",
        "toNodeId": "n-roca-cuper",
        "fromLaneId": "nl-n-albuixech-l-c5",
        "toLaneId": "nl-n-roca-cuper-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-roca-cuper",
        "toNodeId": "n-cabanyal",
        "fromLaneId": "nl-n-roca-cuper-l-c5",
        "toLaneId": "nl-n-cabanyal-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-cabanyal",
        "toNodeId": "n-font",
        "fromLaneId": "nl-n-cabanyal-l-c5",
        "toLaneId": "nl-n-font-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c5t-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-font",
        "toNodeId": "n-nord",
        "fromLaneId": "nl-n-font-l-c5",
        "toLaneId": "nl-n-nord-l-c5",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-sagunt",
        "toNodeId": "n-pucol",
        "fromLaneId": "nl-n-sagunt-l-c6",
        "toLaneId": "nl-n-pucol-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-pucol",
        "toNodeId": "n-puig",
        "fromLaneId": "nl-n-pucol-l-c6",
        "toLaneId": "nl-n-puig-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-puig",
        "toNodeId": "n-massalfassar",
        "fromLaneId": "nl-n-puig-l-c6",
        "toLaneId": "nl-n-massalfassar-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-massalfassar",
        "toNodeId": "n-albuixech",
        "fromLaneId": "nl-n-massalfassar-l-c6",
        "toLaneId": "nl-n-albuixech-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-albuixech",
        "toNodeId": "n-roca-cuper",
        "fromLaneId": "nl-n-albuixech-l-c6",
        "toLaneId": "nl-n-roca-cuper-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-roca-cuper",
        "toNodeId": "n-cabanyal",
        "fromLaneId": "nl-n-roca-cuper-l-c6",
        "toLaneId": "nl-n-cabanyal-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-cabanyal",
        "toNodeId": "n-font",
        "fromLaneId": "nl-n-cabanyal-l-c6",
        "toLaneId": "nl-n-font-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c6t-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-font",
        "toNodeId": "n-nord",
        "fromLaneId": "nl-n-font-l-c6",
        "toLaneId": "nl-n-nord-l-c6",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-0",
        "toNodeId": "n-c3-0a",
        "fromLaneId": "nl-n-c3-0-l-c3",
        "toLaneId": "nl-n-c3-0a-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-0a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-0a",
        "toNodeId": "n-c3-1",
        "fromLaneId": "nl-n-c3-0a-l-c3",
        "toLaneId": "nl-n-c3-1-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-1",
        "toNodeId": "n-c3-2",
        "fromLaneId": "nl-n-c3-1-l-c3",
        "toLaneId": "nl-n-c3-2-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-2",
        "toNodeId": "n-c3-2a",
        "fromLaneId": "nl-n-c3-2-l-c3",
        "toLaneId": "nl-n-c3-2a-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-2a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-2a",
        "toNodeId": "n-c3-3",
        "fromLaneId": "nl-n-c3-2a-l-c3",
        "toLaneId": "nl-n-c3-3-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-3",
        "toNodeId": "n-c3-4",
        "fromLaneId": "nl-n-c3-3-l-c3",
        "toLaneId": "nl-n-c3-4-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-4",
        "toNodeId": "n-c3-5",
        "fromLaneId": "nl-n-c3-4-l-c3",
        "toLaneId": "nl-n-c3-5-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-5",
        "toNodeId": "n-c3-6",
        "fromLaneId": "nl-n-c3-5-l-c3",
        "toLaneId": "nl-n-c3-6-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-6",
        "toNodeId": "n-c3-6a",
        "fromLaneId": "nl-n-c3-6-l-c3",
        "toLaneId": "nl-n-c3-6a-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-6a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-6a",
        "toNodeId": "n-c3-7",
        "fromLaneId": "nl-n-c3-6a-l-c3",
        "toLaneId": "nl-n-c3-7-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-7",
        "toNodeId": "n-c3-8",
        "fromLaneId": "nl-n-c3-7-l-c3",
        "toLaneId": "nl-n-c3-8-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-8",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-8",
        "toNodeId": "n-c3-8a",
        "fromLaneId": "nl-n-c3-8-l-c3",
        "toLaneId": "nl-n-c3-8a-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-8a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-8a",
        "toNodeId": "n-c3-9",
        "fromLaneId": "nl-n-c3-8a-l-c3",
        "toLaneId": "nl-n-c3-9-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-9",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c3-9",
        "toNodeId": "n-font",
        "fromLaneId": "nl-n-c3-9-l-c3",
        "toLaneId": "nl-n-font-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c3-10",
        "sheetId": "sh-ov",
        "fromNodeId": "n-font",
        "toNodeId": "n-nord",
        "fromLaneId": "nl-n-font-l-c3",
        "toLaneId": "nl-n-nord-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1s-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-nord",
        "toNodeId": "n-alfafar",
        "fromLaneId": "nl-n-nord-l-c1",
        "toLaneId": "nl-n-alfafar-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1s-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-alfafar",
        "toNodeId": "n-massanassa",
        "fromLaneId": "nl-n-alfafar-l-c1",
        "toLaneId": "nl-n-massanassa-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1s-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-massanassa",
        "toNodeId": "n-catarroja",
        "fromLaneId": "nl-n-massanassa-l-c1",
        "toLaneId": "nl-n-catarroja-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1s-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-catarroja",
        "toNodeId": "n-albal",
        "fromLaneId": "nl-n-catarroja-l-c1",
        "toLaneId": "nl-n-albal-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1s-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-albal",
        "toNodeId": "n-silla",
        "fromLaneId": "nl-n-albal-l-c1",
        "toLaneId": "nl-n-silla-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2s-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-nord",
        "toNodeId": "n-alfafar",
        "fromLaneId": "nl-n-nord-l-c2",
        "toLaneId": "nl-n-alfafar-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2s-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-alfafar",
        "toNodeId": "n-massanassa",
        "fromLaneId": "nl-n-alfafar-l-c2",
        "toLaneId": "nl-n-massanassa-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2s-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-massanassa",
        "toNodeId": "n-catarroja",
        "fromLaneId": "nl-n-massanassa-l-c2",
        "toLaneId": "nl-n-catarroja-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2s-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-catarroja",
        "toNodeId": "n-albal",
        "fromLaneId": "nl-n-catarroja-l-c2",
        "toLaneId": "nl-n-albal-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2s-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-albal",
        "toNodeId": "n-silla",
        "fromLaneId": "nl-n-albal-l-c2",
        "toLaneId": "nl-n-silla-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-silla",
        "toNodeId": "n-c1-0a",
        "fromLaneId": "nl-n-silla-l-c1",
        "toLaneId": "nl-n-c1-0a-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-0a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-0a",
        "toNodeId": "n-c1-0",
        "fromLaneId": "nl-n-c1-0a-l-c1",
        "toLaneId": "nl-n-c1-0-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-0",
        "toNodeId": "n-c1-1",
        "fromLaneId": "nl-n-c1-0-l-c1",
        "toLaneId": "nl-n-c1-1-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-1",
        "toNodeId": "n-c1-2",
        "fromLaneId": "nl-n-c1-1-l-c1",
        "toLaneId": "nl-n-c1-2-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-2",
        "toNodeId": "n-c1-3",
        "fromLaneId": "nl-n-c1-2-l-c1",
        "toLaneId": "nl-n-c1-3-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-3",
        "toNodeId": "n-c1-4",
        "fromLaneId": "nl-n-c1-3-l-c1",
        "toLaneId": "nl-n-c1-4-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c1-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-4",
        "toNodeId": "n-c1-5",
        "fromLaneId": "nl-n-c1-4-l-c1",
        "toLaneId": "nl-n-c1-5-l-c1",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-0",
        "sheetId": "sh-ov",
        "fromNodeId": "n-silla",
        "toNodeId": "n-c2-0",
        "fromLaneId": "nl-n-silla-l-c2",
        "toLaneId": "nl-n-c2-0-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-0",
        "toNodeId": "n-c2-1",
        "fromLaneId": "nl-n-c2-0-l-c2",
        "toLaneId": "nl-n-c2-1-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-2",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-1",
        "toNodeId": "n-c2-2",
        "fromLaneId": "nl-n-c2-1-l-c2",
        "toLaneId": "nl-n-c2-2-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-3",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-2",
        "toNodeId": "n-c2-3",
        "fromLaneId": "nl-n-c2-2-l-c2",
        "toLaneId": "nl-n-c2-3-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-4",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-3",
        "toNodeId": "n-c2-3a",
        "fromLaneId": "nl-n-c2-3-l-c2",
        "toLaneId": "nl-n-c2-3a-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-4a",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-3a",
        "toNodeId": "n-c2-4",
        "fromLaneId": "nl-n-c2-3a-l-c2",
        "toLaneId": "nl-n-c2-4-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-5",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-4",
        "toNodeId": "n-c2-5",
        "fromLaneId": "nl-n-c2-4-l-c2",
        "toLaneId": "nl-n-c2-5-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-6",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-5",
        "toNodeId": "n-c2-6",
        "fromLaneId": "nl-n-c2-5-l-c2",
        "toLaneId": "nl-n-c2-6-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-7",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-6",
        "toNodeId": "n-c2-7",
        "fromLaneId": "nl-n-c2-6-l-c2",
        "toLaneId": "nl-n-c2-7-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-8",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-7",
        "toNodeId": "n-c2-8",
        "fromLaneId": "nl-n-c2-7-l-c2",
        "toLaneId": "nl-n-c2-8-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg-c2-9",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c2-8",
        "toNodeId": "n-c2-9",
        "fromLaneId": "nl-n-c2-8-l-c2",
        "toLaneId": "nl-n-c2-9-l-c2",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg1775378705279-11",
        "sheetId": "sh-ov",
        "fromNodeId": "n1775378474326-7",
        "toNodeId": "n-c3-9",
        "fromLaneId": "nl-n1775378474326-7-auto-segment-sg1775378705279-11",
        "toLaneId": "nl-n-c3-9-l-c3",
        "geometry": {
          "kind": "straight"
        }
      },
      {
        "id": "sg1775382230143-1",
        "sheetId": "sh-ov",
        "fromNodeId": "n-c1-4",
        "toNodeId": "n-c1-6",
        "fromLaneId": "nl-n-c1-4-l-c1",
        "toLaneId": "nl-n-c1-6-auto-segment-sg1775382230143-1",
        "geometry": {
          "kind": "straight"
        }
      }
    ],
    "lineRuns": [
      {
        "id": "lr-c1",
        "lineId": "l-c1",
        "segmentIds": [
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
          "sg1775382230143-1"
        ]
      },
      {
        "id": "lr-c2",
        "lineId": "l-c2",
        "segmentIds": [
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
        "id": "lr-c3",
        "lineId": "l-c3",
        "segmentIds": [
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
        "id": "lr-c5",
        "lineId": "l-c5",
        "segmentIds": [
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
        "id": "lr-c6",
        "lineId": "l-c6",
        "segmentIds": [
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
        "id": "lr-l1775378342355-5",
        "lineId": "l1775378342355-5",
        "segmentIds": [
          "sg1775378705279-11"
        ]
      }
    ]
  }
};
