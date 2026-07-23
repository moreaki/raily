import { describe, expect, it } from "vitest";
import { parseStoredSheetViews } from "@/features/railway-map-editor/lib/useRailwayMapViewport";

describe("stored sheet viewport parsing", () => {
  it("clamps saved zoom to the supported range", () => {
    const views = parseStoredSheetViews(
      JSON.stringify({
        low: { zoom: 0.001, centerX: 10, centerY: 20 },
        high: { zoom: 100, centerX: 30, centerY: 40 },
      }),
      0.1,
      16,
    );

    expect(views.low.zoom).toBe(0.1);
    expect(views.high.zoom).toBe(16);
  });

  it("drops malformed and non-finite viewport entries", () => {
    const views = parseStoredSheetViews(
      JSON.stringify({
        valid: { zoom: 2, centerX: 100, centerY: 200 },
        missing: { zoom: 1, centerX: 0 },
        text: { zoom: "2", centerX: 0, centerY: 0 },
        infinite: { zoom: 1, centerX: "Infinity", centerY: 0 },
      }),
      0.1,
      16,
    );

    expect(views).toEqual({
      valid: { zoom: 2, centerX: 100, centerY: 200 },
    });
  });

  it("rejects non-object storage values", () => {
    expect(parseStoredSheetViews("[]", 0.1, 16)).toEqual({});
  });
});
