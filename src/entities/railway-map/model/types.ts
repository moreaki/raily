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
  fontFamily: string;
  fontWeight: StationLabelFontWeight;
  fontSize: number;
}

export interface MapNode extends MapPoint {
  id: string;
  sheetId: string;
}

export interface StationLabel extends MapPoint {
  align?: LabelAlignment;
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

export interface RailwayMap {
  sheets: Sheet[];
  nodes: MapNode[];
  stationKinds: StationKind[];
  stations: Station[];
  segments: Segment[];
  lines: Line[];
  lineRuns: LineRun[];
}
