import { z } from "zod";

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const sheetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const nodeSchema = pointSchema.extend({
  id: z.string().min(1),
  sheetId: z.string().min(1),
  kind: z.enum(["station", "junction", "waypoint"]),
});

const stationLabelSchema = pointSchema.extend({
  align: z.enum(["left", "right", "top", "bottom"]).optional(),
});

const stationKindSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shape: z.enum(["circle", "interchange", "terminal"]),
});

const stationSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  name: z.string().min(1),
  kindId: z.string().min(1),
  label: stationLabelSchema.optional(),
});

const straightSegmentSchema = z.object({
  kind: z.literal("straight"),
});

const orthogonalSegmentSchema = z.object({
  kind: z.literal("orthogonal"),
  elbow: pointSchema,
});

const polylineSegmentSchema = z.object({
  kind: z.literal("polyline"),
  points: z.array(pointSchema),
});

const segmentSchema = z.object({
  id: z.string().min(1),
  sheetId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  geometry: z.union([straightSegmentSchema, orthogonalSegmentSchema, polylineSegmentSchema]),
});

const lineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  strokeWidth: z.number().min(1).max(32),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]),
});

const lineRunSchema = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
  segmentIds: z.array(z.string().min(1)),
});

export const railwayMapSchema = z.object({
  sheets: z.array(sheetSchema).min(1),
  nodes: z.array(nodeSchema),
  stationKinds: z.array(stationKindSchema),
  stations: z.array(stationSchema),
  segments: z.array(segmentSchema),
  lines: z.array(lineSchema),
  lineRuns: z.array(lineRunSchema),
});
