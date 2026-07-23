export type ExportExtent = {
  x: number;
  y: number;
  padding?: number;
};

export type ExportBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export function calculateExportBounds(
  extents: ExportExtent[],
  outerPadding: number,
  fallback: ExportBounds,
): ExportBounds {
  if (extents.length === 0) return fallback;

  const minX = Math.min(...extents.map((extent) => extent.x - (extent.padding ?? 0)));
  const maxX = Math.max(...extents.map((extent) => extent.x + (extent.padding ?? 0)));
  const minY = Math.min(...extents.map((extent) => extent.y - (extent.padding ?? 0)));
  const maxY = Math.max(...extents.map((extent) => extent.y + (extent.padding ?? 0)));

  return {
    minX: minX - outerPadding,
    minY: minY - outerPadding,
    width: Math.max(1, maxX - minX + outerPadding * 2),
    height: Math.max(1, maxY - minY + outerPadding * 2),
  };
}

export function prepareSvgElementForExport(source: SVGSVGElement, bounds: ExportBounds) {
  const exported = source.cloneNode(true) as SVGSVGElement;
  exported.querySelectorAll('[data-export="exclude"]').forEach((element) => element.remove());
  exported.querySelectorAll("[data-export]").forEach((element) => element.removeAttribute("data-export"));
  exported.removeAttribute("class");
  exported.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  exported.setAttribute("width", String(Math.ceil(bounds.width)));
  exported.setAttribute("height", String(Math.ceil(bounds.height)));
  exported.setAttribute("viewBox", `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);
  return exported;
}
