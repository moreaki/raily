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
});

const stationLabelSchema = pointSchema.extend({
  align: z.enum(["left", "right", "top", "bottom"]).optional(),
});

const stationKindSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shape: z.enum(["circle", "interchange", "terminal"]),
  fontFamily: z.string().min(1),
  fontWeight: z.enum(["100", "200", "300", "400", "500", "600", "700", "800", "900"]),
  fontSize: z.number().min(8).max(72),
});

const stationSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1).nullable(),
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
  config: z.object({
    stationKinds: z.array(stationKindSchema),
    lines: z.array(lineSchema),
  }),
  model: z.object({
    sheets: z.array(sheetSchema).min(1),
    nodes: z.array(nodeSchema),
    stations: z.array(stationSchema),
    segments: z.array(segmentSchema),
    lineRuns: z.array(lineRunSchema),
  }),
});
