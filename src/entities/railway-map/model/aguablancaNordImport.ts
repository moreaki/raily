import type { Line, LineRun, MapNode, RailwayMap, Segment, Station } from "./types";
import { autoPlaceLabels } from "@/features/railway-map-editor/lib/labels";

type ImportTopic = {
  title: string;
  className?: string;
  children?: ImportTopic[];
};

type BuiltTopic = {
  id: string;
  nodeId: string;
  stationId: string;
  title: string;
  className?: string;
  depth: number;
  children: BuiltTopic[];
  x: number;
  y: number;
};

type ImportLineDef = {
  id: string;
  name: string;
  color: string;
  fromTitle: string;
  toTitle: string;
};

type ImportedSheetData = {
  sheet: RailwayMap["model"]["sheets"][number];
  nodes: MapNode[];
  stations: Station[];
  lines: Line[];
  segments: Segment[];
  lineRuns: LineRun[];
};

const AGUABLANCA_NORD_SHEET_ID = "sh-agn";

const AGUABLANCA_NORD_TREE: ImportTopic = { title: "AGUABLANCA NORD", children: [
  { title: "Jerica-Viver", children: [
    { title: "Cami Xest", children: [
      { title: "Bulevar", children: [
        { title: "Punta Benimaquia", children: [
          { title: "Residencial Paradise (Apd.)", children: [
            { title: "Bulevar Alqueries", children: [
              { title: "Crevillent", children: [
                { title: "Merca-Asia", children: [
                  { title: "Merca Bulevar", children: [
                    { title: "BULEVAR SUD", className: "minorTopic", children: [
                      { title: "Poble el Cid", children: [
                        { title: "Arbolicos (Apd.)", children: [
                          { title: "Residencial Turquesa", children: [
                            { title: "Cami Salobres", children: [
                              { title: "BENIFLA", className: "minorTopic", children: [
                                { title: "Benifla Urbanizacion", children: [
                                  { title: "Aldaia Carrus", children: [
                                    { title: "Aldaia-Laberint", children: [
                                      { title: "EL PINAR", className: "minorTopic", children: [
                                        { title: "El Hinojal", children: [
                                          { title: "Cami Pinar", children: [
                                            { title: "S. Isidro del Pinar-Albaterra", children: [
                                              { title: "San Isidro del Pinar", children: [
                                                { title: "Cami Campell", children: [
                                                  { title: "Campell", children: [
                                                    { title: "Vall de Laguart", children: [
                                                      { title: "Palmeral-Aeropuerto-Diseminados", children: [
                                                        { title: "PALMERAL", className: "minorTopic", children: [
                                                          { title: "Benimaurell", children: [
                                                            { title: "COCHERA", className: "minorTopic" },
                                                          ] },
                                                        ] },
                                                      ] },
                                                    ] },
                                                  ] },
                                                ] },
                                              ] },
                                            ] },
                                          ] },
                                        ] },
                                      ] },
                                    ] },
                                  ] },
                                ] },
                                { title: "Perla Negra", children: [
                                  { title: "Reial de Gandia", children: [
                                    { title: "CAMPODEVESES", className: "minorTopic" },
                                  ] },
                                ] },
                              ] },
                            ] },
                          ] },
                        ] },
                      ] },
                      { title: "Venta Merca", children: [
                        { title: "El Poligono", children: [
                          { title: "Francisco Tomas", children: [
                            { title: "Dankol", children: [
                              { title: "Avella Parc", children: [
                                { title: "AVELLA", className: "minorTopic", children: [
                                  { title: "Avella Bosc", children: [
                                    { title: "Rambla Tormado", children: [
                                      { title: "Tormo Arrabal", children: [
                                        { title: "El Descampado (Apd.)", children: [
                                          { title: "ONDA", className: "minorTopic" },
                                        ] },
                                        { title: "SCAN-RAMBLA TORMADO", className: "minorTopic" },
                                      ] },
                                    ] },
                                  ] },
                                ] },
                              ] },
                            ] },
                          ] },
                        ] },
                      ] },
                    ] },
                  ] },
                ] },
              ] },
            ] },
          ] },
        ] },
      ] },
    ] },
    { title: "Aguablanca Font de Sant Lluis", className: "minorTopic", children: [
      { title: "Aguablanca deposit", children: [
        { title: "L' Alqueria de la Comtessa", children: [
          { title: "Cabanyal", children: [
            { title: "Sant Isidre", children: [
              { title: "Rotova-L' Olleria", children: [
                { title: "Benetusser-Jalen", children: [
                  { title: "XIRIVELLA-L' ALTER", className: "minorTopic" },
                ] },
              ] },
            ] },
          ] },
        ] },
      ] },
      { title: "Bunol", children: [
        { title: "Intermodal", children: [
          { title: "Titaguas", children: [
            { title: "Yatova", children: [
              { title: "Yatova-Benaguacil", children: [
                { title: "Yatova Deposit", children: [
                  { title: "Oliveret", children: [
                    { title: "Bassot Alqueries", children: [
                      { title: "Bassot", children: [
                        { title: "Bassot Arrabal", children: [
                          { title: "Palmera", children: [
                            { title: "Las Lomas", children: [
                              { title: "Lomas-Benaguacil", children: [
                                { title: "OLIVA TERMINAL", className: "minorTopic", children: [
                                  { title: "Lomas Descampado" },
                                ] },
                              ] },
                            ] },
                          ] },
                        ] },
                      ] },
                    ] },
                  ] },
                ] },
              ] },
            ] },
          ] },
          { title: "Abetos-Arbol", children: [
            { title: "Camino Taller", children: [
              { title: "AUTOMOTOR ONDARA", className: "minorTopic" },
            ] },
          ] },
        ] },
      ] },
      { title: "Riba-Roja de Quart", children: [
        { title: "Vara de Quart", children: [
          { title: "Paterna", children: [
            { title: "Tonus Ciudad", children: [
              { title: "Tonus Arrabal", children: [
                { title: "Puerto Rotonda", children: [
                  { title: "BENICASSIM", className: "minorTopic", children: [
                    { title: "Agata Real", children: [
                      { title: "Agata-Parc", children: [
                        { title: "Callosa del Parque", children: [
                          { title: "EL CARRASQUET", className: "minorTopic" },
                        ] },
                      ] },
                    ] },
                  ] },
                ] },
              ] },
            ] },
            { title: "La Basura (Apd.)", children: [
              { title: "Denia Nature", children: [
                { title: "Adosados-Campillo", children: [
                  { title: "Vergermar" },
                ] },
              ] },
            ] },
          ] },
        ] },
      ] },
    ] },
  ] },
] };

const AGUABLANCA_NORD_LINES: ImportLineDef[] = [
  { id: "l-agn-c-5", name: "C-5", color: "#FF6B6B", fromTitle: "AGUABLANCA NORD", toTitle: "BULEVAR SUD" },
  { id: "l-agn-c-3", name: "C-3", color: "#4A148C", fromTitle: "AGUABLANCA NORD", toTitle: "XIRIVELLA-L' ALTER" },
  { id: "l-agn-c-2", name: "C-2", color: "#00579B", fromTitle: "AGUABLANCA NORD", toTitle: "OLIVA TERMINAL" },
  { id: "l-agn-c-13", name: "C-13", color: "#007C74", fromTitle: "AGUABLANCA NORD", toTitle: "AUTOMOTOR ONDARA" },
  { id: "l-agn-c-11", name: "C-11", color: "#FF6F00", fromTitle: "AGUABLANCA NORD", toTitle: "EL CARRASQUET" },
  { id: "l-agn-c-12-c-27", name: "C-12 (C-27)", color: "#15831C", fromTitle: "AGUABLANCA NORD", toTitle: "Vergermar" },
  { id: "l-agn-c-9a", name: "C-9a", color: "#FFC009", fromTitle: "BULEVAR SUD", toTitle: "ONDA" },
  { id: "l-agn-c-9b", name: "C-9b", color: "#FFC009", fromTitle: "BULEVAR SUD", toTitle: "SCAN-RAMBLA TORMADO" },
  { id: "l-agn-c-7", name: "C-7", color: "#666666", fromTitle: "BULEVAR SUD", toTitle: "EL PINAR" },
  { id: "l-agn-c-23", name: "C-23", color: "#2CD551", fromTitle: "EL PINAR", toTitle: "COCHERA" },
  { id: "l-agn-c-1", name: "C-1", color: "#2ABEE0", fromTitle: "OLIVA TERMINAL", toTitle: "Lomas Descampado" },
  { id: "l-agn-c-6", name: "C-6", color: "#AA7941", fromTitle: "BENIFLA", toTitle: "CAMPODEVESES" },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "node";
}

function buildTopics() {
  const slugCounts = new Map<string, number>();

  function build(topic: ImportTopic, depth: number): BuiltTopic {
    const slug = slugify(topic.title);
    const nextCount = (slugCounts.get(slug) ?? 0) + 1;
    slugCounts.set(slug, nextCount);
    const suffix = nextCount > 1 ? `-${nextCount}` : "";
    const id = `agn-${slug}${suffix}`;

    return {
      id,
      nodeId: `n-${id}`,
      stationId: `s-${id}`,
      title: topic.title,
      className: topic.className,
      depth,
      children: (topic.children ?? []).map((child) => build(child, depth + 1)),
      x: 0,
      y: 0,
    };
  }

  return build(AGUABLANCA_NORD_TREE, 0);
}

function layoutTopics(root: BuiltTopic) {
  const xOffset = 240;
  const xStep = 150;
  const yOffset = 120;
  const leafSpacing = 84;
  let leafIndex = 0;

  function walk(topic: BuiltTopic) {
    if (topic.children.length === 0) {
      topic.y = yOffset + leafIndex * leafSpacing;
      leafIndex += 1;
    } else {
      topic.children.forEach(walk);
      topic.y = topic.children.reduce((sum, child) => sum + child.y, 0) / topic.children.length;
    }
    topic.x = xOffset + topic.depth * xStep;
  }

  walk(root);
}

function flattenTopics(root: BuiltTopic) {
  const flat: BuiltTopic[] = [];

  function walk(topic: BuiltTopic) {
    flat.push(topic);
    topic.children.forEach(walk);
  }

  walk(root);
  return flat;
}

function topicByNormalizedTitle(topics: BuiltTopic[]) {
  const byTitle = new Map<string, BuiltTopic>();
  for (const topic of topics) {
    byTitle.set(slugify(topic.title), topic);
  }
  return byTitle;
}

function buildParentById(topics: BuiltTopic[]) {
  const parentById = new Map<string, BuiltTopic | null>();

  function walk(topic: BuiltTopic, parent: BuiltTopic | null) {
    parentById.set(topic.id, parent);
    topic.children.forEach((child) => walk(child, topic));
  }

  walk(topics[0], null);
  return parentById;
}

function resolvePath(start: BuiltTopic, end: BuiltTopic, parentById: Map<string, BuiltTopic | null>) {
  const startAncestors = new Map<string, BuiltTopic>();
  let current: BuiltTopic | null = start;
  while (current) {
    startAncestors.set(current.id, current);
    current = parentById.get(current.id) ?? null;
  }

  const endBranch: BuiltTopic[] = [];
  current = end;
  while (current && !startAncestors.has(current.id)) {
    endBranch.push(current);
    current = parentById.get(current.id) ?? null;
  }

  if (!current) {
    throw new Error(`Unable to resolve route between ${start.title} and ${end.title}.`);
  }

  const lca = current;
  const startBranch: BuiltTopic[] = [];
  current = start;
  while (current && current.id !== lca.id) {
    startBranch.push(current);
    current = parentById.get(current.id) ?? null;
  }

  return [...startBranch, lca, ...endBranch.reverse()];
}

function buildImportedSheet(): ImportedSheetData {
  const root = buildTopics();
  layoutTopics(root);
  const topics = flattenTopics(root);
  const byTitle = topicByNormalizedTitle(topics);
  const parentById = buildParentById([root]);

  const sheet: ImportedSheetData["sheet"] = {
    id: AGUABLANCA_NORD_SHEET_ID,
    name: "Aguablanca Nord",
  };

  const degrees = new Map<string, number>();
  for (const topic of topics) {
    const parent = parentById.get(topic.id);
    const degree = topic.children.length + (parent ? 1 : 0);
    degrees.set(topic.id, degree);
  }

  const nodes: MapNode[] = topics.map((topic) => ({
    id: topic.nodeId,
    sheetId: sheet.id,
    x: Math.round(topic.x),
    y: Math.round(topic.y),
  }));

  const draftStations: Station[] = topics.map((topic) => {
    const degree = degrees.get(topic.id) ?? 0;
    const isHub = topic.depth === 0 || topic.className === "minorTopic" || degree > 2;
    const isTerminal = degree === 1 && topic.depth > 0;

    return {
      id: topic.stationId,
      nodeId: topic.nodeId,
      name: topic.title,
      kindId: isHub ? "sk-hub" : isTerminal ? "sk-terminal" : "sk-stop",
      label: undefined,
    };
  });

  const lines: Line[] = AGUABLANCA_NORD_LINES.map((line) => ({
    id: line.id,
    name: line.name,
    color: line.color,
    strokeWidth: 8,
    strokeStyle: "solid",
  }));

  const segments: Segment[] = [];
  const lineRuns: LineRun[] = [];

  for (const line of AGUABLANCA_NORD_LINES) {
    const from = byTitle.get(slugify(line.fromTitle));
    const to = byTitle.get(slugify(line.toTitle));
    if (!from || !to) {
      throw new Error(`Unable to resolve imported line ${line.name}.`);
    }

    const path = resolvePath(from, to, parentById);
    const segmentIds: string[] = [];

    for (let index = 0; index < path.length - 1; index += 1) {
      const fromTopic = path[index];
      const toTopic = path[index + 1];
      const segmentId = `sg-${slugify(line.id)}-${index}`;

      segments.push({
        id: segmentId,
        sheetId: sheet.id,
        fromNodeId: fromTopic.nodeId,
        toNodeId: toTopic.nodeId,
        geometry: { kind: "straight" },
      });
      segmentIds.push(segmentId);
    }

    lineRuns.push({
      id: `lr-${line.id}`,
      lineId: line.id,
      segmentIds,
    });
  }

  const importedMap: RailwayMap = {
    config: {
      stationKinds: [
        { id: "sk-stop", name: "Stop", shape: "circle", symbolSize: 1, fontFamily: '"IBM Plex Sans Condensed", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif', fontWeight: "400", fontSize: 12 },
        { id: "sk-hub", name: "Hub", shape: "interchange", symbolSize: 1, fontFamily: '"IBM Plex Sans Condensed", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif', fontWeight: "500", fontSize: 14 },
        { id: "sk-terminal", name: "Terminal", shape: "terminal", symbolSize: 1, fontFamily: '"IBM Plex Sans Condensed", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif', fontWeight: "600", fontSize: 14 },
      ],
      lines,
      parallelTrackSpacing: 22,
      nodeGroupCellWidth: 22,
      nodeGroupCellHeight: 22,
      hubOutlineMode: "box",
      hubOutlineColor: "#111827",
      hubOutlineStrokeStyle: "solid",
      hubOutlineScale: 0.75,
      hubOutlineCornerRadius: 8,
      hubOutlineStrokeWidth: 1,
      hubOutlineConcaveFactor: 1,
      segmentIndicatorWidth: 16,
      selectedSegmentIndicatorBoost: 4,
      gridLineOpacity: 0.45,
      labelAxisSnapSensitivity: 10,
    },
    model: {
      sheets: [sheet],
      nodes,
      nodeLanes: [],
      stations: draftStations,
      segments,
      lineRuns,
    },
  };

  const stations = autoPlaceLabels(importedMap, { sheetId: sheet.id });
  return { sheet, nodes, stations, lines, segments, lineRuns };
}

export function mergeAguablancaNordIntoBootstrap(base: RailwayMap): RailwayMap {
  if (base.model.sheets.some((sheet) => sheet.id === AGUABLANCA_NORD_SHEET_ID)) {
    return base;
  }

  const imported = buildImportedSheet();
  const existingLineIds = new Set(base.config.lines.map((line) => line.id));

  return {
    ...base,
    config: {
      ...base.config,
      lines: [
        ...base.config.lines,
        ...imported.lines.filter((line) => !existingLineIds.has(line.id)),
      ],
    },
    model: {
      ...base.model,
      sheets: [...base.model.sheets, imported.sheet],
      nodes: [...base.model.nodes, ...imported.nodes],
      stations: [...base.model.stations, ...imported.stations],
      segments: [...base.model.segments, ...imported.segments],
      lineRuns: [...base.model.lineRuns, ...imported.lineRuns],
    },
  };
}
