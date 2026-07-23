import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MapNode, MapPoint } from "@/entities/railway-map/model/types";
import { clamp, getSheetContentCenter, getSvgPoint, normalizeWheelDelta } from "@/features/railway-map-editor/lib/geometry";

type SheetView = { zoom: number; centerX: number; centerY: number };

export function parseStoredSheetViews(raw: string, minZoom: number, maxZoom: number) {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .filter((entry): entry is [string, SheetView] => {
        const value = entry[1];
        return (
          typeof value === "object" &&
          value !== null &&
          "zoom" in value &&
          "centerX" in value &&
          "centerY" in value &&
          typeof value.zoom === "number" &&
          typeof value.centerX === "number" &&
          typeof value.centerY === "number" &&
          Number.isFinite(value.zoom) &&
          Number.isFinite(value.centerX) &&
          Number.isFinite(value.centerY)
        );
      })
      .map(([sheetId, view]) => [
        sheetId,
        {
          zoom: clamp(view.zoom, minZoom, maxZoom),
          centerX: view.centerX,
          centerY: view.centerY,
        },
      ]),
  ) as Record<string, SheetView>;
}

function loadStoredSheetViews(storageKey: string, minZoom: number, maxZoom: number) {
  if (typeof window === "undefined") return {} as Record<string, SheetView>;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? parseStoredSheetViews(raw, minZoom, maxZoom) : {};
  } catch {
    return {};
  }
}

type UseRailwayMapViewportArgs = {
  canvasViewportRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  currentSheetId: string;
  currentNodes: MapNode[];
  canvasWidth: number;
  canvasHeight: number;
  minZoom: number;
  maxZoom: number;
  minGridStep: number;
  sheetViewStorageKey: string;
};

export function useRailwayMapViewport(args: UseRailwayMapViewportArgs) {
  const {
    canvasViewportRef,
    svgRef,
    currentSheetId,
    currentNodes,
    canvasWidth,
    canvasHeight,
    minZoom,
    maxZoom,
    minGridStep,
    sheetViewStorageKey,
  } = args;

  const [zoom, setZoom] = useState(1);
  const [viewportCenter, setViewportCenter] = useState({ x: canvasWidth / 2, y: canvasHeight / 2 });
  const [sheetViews, setSheetViews] = useState<Record<string, SheetView>>(() =>
    loadStoredSheetViews(sheetViewStorageKey, minZoom, maxZoom),
  );
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridStepX, setGridStepX] = useState(20);
  const [gridStepY, setGridStepY] = useState(20);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null);

  const lastRestoredSheetIdRef = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  const viewBoxRef = useRef({ x: 0, y: 0, width: canvasWidth, height: canvasHeight, centerX: canvasWidth / 2, centerY: canvasHeight / 2 });
  const wheelZoomDeltaRef = useRef(0);
  const wheelZoomFocusRef = useRef<MapPoint | null>(null);
  const wheelZoomFrameRef = useRef<number | null>(null);

  const effectiveGridStepX = Math.max(minGridStep, gridStepX);
  const effectiveGridStepY = Math.max(minGridStep, gridStepY);

  const viewBoxDimensions = useMemo(() => {
    const width = canvasWidth / zoom;
    const height = canvasHeight / zoom;
    return { width, height };
  }, [canvasHeight, canvasWidth, zoom]);

  const viewBox = useMemo(() => {
    const { width, height } = viewBoxDimensions;
    const centerX = viewportCenter.x;
    const centerY = viewportCenter.y;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      centerX,
      centerY,
    };
  }, [viewBoxDimensions, viewportCenter]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(sheetViewStorageKey, JSON.stringify(sheetViews));
      } catch {
        // View persistence is optional and should never interrupt editing.
      }
    }
  }, [sheetViewStorageKey, sheetViews]);

  useEffect(() => {
    if (!currentSheetId) return;
    if (lastRestoredSheetIdRef.current === currentSheetId) return;

    lastRestoredSheetIdRef.current = currentSheetId;
    const savedView = sheetViews[currentSheetId];
    if (savedView) {
      setZoom(clamp(savedView.zoom, minZoom, maxZoom));
      setViewportCenter({ x: savedView.centerX, y: savedView.centerY });
      return;
    }

    setZoom(1);
    setViewportCenter({ x: canvasWidth / 2, y: canvasHeight / 2 });
  }, [canvasHeight, canvasWidth, currentSheetId, maxZoom, minZoom, sheetViews]);

  useEffect(() => {
    if (!currentSheetId) return;
    setSheetViews((current) => {
      const nextView = { zoom, centerX: viewportCenter.x, centerY: viewportCenter.y };
      const previous = current[currentSheetId];
      if (previous && previous.zoom === nextView.zoom && previous.centerX === nextView.centerX && previous.centerY === nextView.centerY) {
        return current;
      }
      return { ...current, [currentSheetId]: nextView };
    });
  }, [currentSheetId, viewportCenter.x, viewportCenter.y, zoom]);

  function panViewportByPixels(deltaX: number, deltaY: number) {
    setViewportCenter((current) => ({
      x: current.x + (deltaX / canvasWidth) * viewBox.width,
      y: current.y + (deltaY / canvasHeight) * viewBox.height,
    }));
  }

  function applyZoom(nextZoom: number, focusPoint?: { x: number; y: number }) {
    const currentZoom = zoomRef.current;
    const currentViewBox = viewBoxRef.current;
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    if (clampedZoom === currentZoom) return;

    const currentWidth = canvasWidth / currentZoom;
    const currentHeight = canvasHeight / currentZoom;
    const nextWidth = canvasWidth / clampedZoom;
    const nextHeight = canvasHeight / clampedZoom;
    const focusX = focusPoint?.x ?? currentViewBox.centerX;
    const focusY = focusPoint?.y ?? currentViewBox.centerY;

    const relativeX = (focusX - currentViewBox.x) / currentWidth;
    const relativeY = (focusY - currentViewBox.y) / currentHeight;
    const nextX = focusX - relativeX * nextWidth;
    const nextY = focusY - relativeY * nextHeight;

    setZoom(clampedZoom);
    setViewportCenter({
      x: nextX + nextWidth / 2,
      y: nextY + nextHeight / 2,
    });
  }

  function flushQueuedWheelZoom() {
    wheelZoomFrameRef.current = null;
    const delta = wheelZoomDeltaRef.current;
    const focusPoint = wheelZoomFocusRef.current ?? undefined;
    wheelZoomDeltaRef.current = 0;
    wheelZoomFocusRef.current = null;

    if (Math.abs(delta) < 0.5) return;

    const magnitude = clamp(Math.abs(delta) * 0.0125, 0.06, 0.45);
    const currentZoom = zoomRef.current;
    const nextZoom = delta < 0 ? currentZoom * (1 + magnitude) : currentZoom / (1 + magnitude);
    applyZoom(nextZoom, focusPoint);
  }

  useEffect(() => {
    const element = canvasViewportRef.current;
    if (!element) return;

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (!svgRef.current) return;
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        const svgPoint = getSvgPoint(svgRef.current, event.clientX, event.clientY);
        const normalizedDeltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);
        if (Math.abs(normalizedDeltaY) < 0.25) return;
        wheelZoomDeltaRef.current += normalizedDeltaY;
        wheelZoomFocusRef.current = svgPoint ? { x: svgPoint.x, y: svgPoint.y } : null;
        if (wheelZoomFrameRef.current === null) {
          wheelZoomFrameRef.current = window.requestAnimationFrame(flushQueuedWheelZoom);
        }
        return;
      }

      panViewportByPixels(
        normalizeWheelDelta(event.deltaX, event.deltaMode),
        normalizeWheelDelta(event.deltaY, event.deltaMode),
      );
    }

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
      if (wheelZoomFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelZoomFrameRef.current);
        wheelZoomFrameRef.current = null;
      }
      wheelZoomDeltaRef.current = 0;
      wheelZoomFocusRef.current = null;
    };
  }, [canvasViewportRef, svgRef, viewBox.height, viewBox.width]);

  function resetViewportToSheet() {
    const center = getSheetContentCenter(currentNodes, canvasWidth, canvasHeight);
    setZoom(1);
    setViewportCenter(center);
  }

  return {
    zoom,
    setZoom,
    viewportCenter,
    setViewportCenter,
    sheetViews,
    setSheetViews,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridStepX,
    setGridStepX,
    gridStepY,
    setGridStepY,
    effectiveGridStepX,
    effectiveGridStepY,
    panning,
    setPanning,
    panStart,
    setPanStart,
    viewBox,
    panViewportByPixels,
    applyZoom,
    resetViewportToSheet,
  };
}
