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
  showGroupOutline: z.boolean().optional(),
  groupOutlineMode: z.enum(["box", "cells"]).optional(),
  groupOutlineStrokeWidth: z.number().min(1).max(12).optional(),
  groupOutlineColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  groupOutlineStrokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  nodeGroupColumns: z.number().int().min(1).optional(),
  nodeGroupRows: z.number().int().min(1).optional(),
});

const nodeLaneSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  order: z.number().int().min(0),
  lineId: z.string().min(1).optional(),
  gridColumn: z.number().int().min(1).optional(),
  gridRow: z.number().int().min(1).optional(),
});

const stationLabelSchema = pointSchema.extend({
  align: z.enum(["left", "right", "top", "bottom"]).optional(),
  rotation: z.number().min(-360).max(360).optional(),
});

const stationKindSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shape: z.enum(["circle", "interchange", "terminal"]),
  symbolSize: z.number().min(0.6).max(2.5),
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
  fromLaneId: z.string().min(1).optional(),
  toLaneId: z.string().min(1).optional(),
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
    parallelTrackSpacing: z.number().min(8).max(48).default(22),
    nodeGroupCellWidth: z.number().min(8).max(64).default(22),
    nodeGroupCellHeight: z.number().min(8).max(64).default(22),
    hubOutlineMode: z.enum(["box", "cells"]).default("box"),
    hubOutlineColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).default("#111827"),
    hubOutlineStrokeStyle: z.enum(["solid", "dashed", "dotted"]).default("solid"),
    hubOutlineScale: z.number().min(0.25).max(2).default(1),
    hubOutlineCornerRadius: z.number().min(0).max(32).default(10),
    hubOutlineStrokeWidth: z.number().min(1).max(12).default(3.25),
    hubOutlineConcaveFactor: z.number().min(0).max(1).default(0.45),
    segmentIndicatorWidth: z.number().min(8).max(36).default(16),
    selectedSegmentIndicatorBoost: z.number().min(0).max(12).default(4),
    gridLineOpacity: z.number().min(0.1).max(0.8).default(0.45),
    labelAxisSnapSensitivity: z.number().min(6).max(24).default(10),
  }),
  model: z.object({
    sheets: z.array(sheetSchema).min(1),
    nodes: z.array(nodeSchema),
    nodeLanes: z.array(nodeLaneSchema).default([]),
    stations: z.array(stationSchema),
    segments: z.array(segmentSchema),
    lineRuns: z.array(lineRunSchema),
  }),
});
