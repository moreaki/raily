export interface MapPoint {
  x: number;
  y: number;
}

export type LabelAlignment = "left" | "right" | "top" | "bottom";
export type StationKindShape = "circle" | "interchange" | "terminal";
export type StationLabelFontWeight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
export type LineStrokeStyle = "solid" | "dashed" | "dotted";

export interface Sheet {
  id: string;
  name: string;
}

export interface StationKind {
  id: string;
  name: string;
  shape: StationKindShape;
  symbolSize: number;
  fontFamily: string;
  fontWeight: StationLabelFontWeight;
  fontSize: number;
}

export interface MapNode extends MapPoint {
  id: string;
  sheetId: string;
}

export interface NodeLane {
  id: string;
  nodeId: string;
  order: number;
  lineId?: string;
  gridColumn?: number;
  gridRow?: number;
}

export interface StationLabel extends MapPoint {
  align?: LabelAlignment;
  rotation?: number;
}

export interface Station {
  id: string;
  nodeId: string | null;
  name: string;
  kindId: string;
  label?: StationLabel;
}

export interface StraightSegmentGeometry {
  kind: "straight";
}

export interface OrthogonalSegmentGeometry {
  kind: "orthogonal";
  elbow: MapPoint;
}

export interface PolylineSegmentGeometry {
  kind: "polyline";
  points: MapPoint[];
}

export type SegmentGeometry =
  | StraightSegmentGeometry
  | OrthogonalSegmentGeometry
  | PolylineSegmentGeometry;

export interface Segment {
  id: string;
  sheetId: string;
  fromNodeId: string;
  toNodeId: string;
  fromLaneId?: string;
  toLaneId?: string;
  geometry: SegmentGeometry;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  strokeWidth: number;
  strokeStyle: LineStrokeStyle;
}

export interface LineRun {
  id: string;
  lineId: string;
  segmentIds: string[];
}

export interface RailwayMapConfig {
  stationKinds: StationKind[];
  lines: Line[];
  parallelTrackSpacing: number;
  nodeGroupCellWidth: number;
  nodeGroupCellHeight: number;
  segmentIndicatorWidth: number;
  selectedSegmentIndicatorBoost: number;
  gridLineOpacity: number;
  labelAxisSnapSensitivity: number;
}

export interface RailwayMapModel {
  sheets: Sheet[];
  nodes: MapNode[];
  nodeLanes: NodeLane[];
  stations: Station[];
  segments: Segment[];
  lineRuns: LineRun[];
}

export interface RailwayMap {
  config: RailwayMapConfig;
  model: RailwayMapModel;
}
