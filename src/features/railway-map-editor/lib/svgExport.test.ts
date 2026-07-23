import { describe, expect, it, vi } from "vitest";
import { calculateExportBounds, prepareSvgElementForExport } from "@/features/railway-map-editor/lib/svgExport";

describe("SVG export bounds", () => {
  it("includes per-element geometry padding and outer whitespace", () => {
    const bounds = calculateExportBounds(
      [
        { x: 100, y: 80, padding: 10 },
        { x: 300, y: 220, padding: 25 },
      ],
      40,
      { minX: 0, minY: 0, width: 1, height: 1 },
    );

    expect(bounds).toEqual({
      minX: 50,
      minY: 30,
      width: 315,
      height: 255,
    });
  });

  it("retains distant nodegroup markers instead of using only their anchor", () => {
    const bounds = calculateExportBounds(
      [
        { x: 0, y: 0, padding: 20 },
        { x: 480, y: 0, padding: 20 },
      ],
      40,
      { minX: 0, minY: 0, width: 1, height: 1 },
    );

    expect(bounds.minX).toBe(-60);
    expect(bounds.width).toBe(600);
  });

  it("uses the current viewport for an empty sheet", () => {
    const fallback = { minX: 25, minY: 30, width: 400, height: 300 };

    expect(calculateExportBounds([], 40, fallback)).toEqual(fallback);
  });

  it("removes editor-only elements from the exported clone", () => {
    const excludedElement = { remove: vi.fn() };
    const retainedTaggedElement = { removeAttribute: vi.fn() };
    const exported = {
      querySelectorAll: vi.fn((selector: string) =>
        selector === '[data-export="exclude"]' ? [excludedElement] : [retainedTaggedElement],
      ),
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    };
    const source = {
      cloneNode: vi.fn(() => exported),
    };

    const result = prepareSvgElementForExport(
      source as unknown as SVGSVGElement,
      { minX: 10, minY: 20, width: 300, height: 200 },
    );

    expect(result).toBe(exported);
    expect(excludedElement.remove).toHaveBeenCalledOnce();
    expect(retainedTaggedElement.removeAttribute).toHaveBeenCalledWith("data-export");
    expect(exported.setAttribute).toHaveBeenCalledWith("viewBox", "10 20 300 200");
  });
});
