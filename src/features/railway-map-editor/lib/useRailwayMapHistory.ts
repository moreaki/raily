import { useCallback, useEffect, useRef, useState } from "react";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import { sanitizeRailwayMap } from "@/entities/railway-map/model/utils";

function cloneMap(map: RailwayMap) {
  return JSON.parse(JSON.stringify(map)) as RailwayMap;
}

function mapsEqual(left: RailwayMap, right: RailwayMap) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type UseRailwayMapHistoryArgs = {
  initialMap: RailwayMap;
  storageKey: string;
};

export function useRailwayMapHistory(args: UseRailwayMapHistoryArgs) {
  const { initialMap, storageKey } = args;
  const [map, setMap] = useState<RailwayMap>(initialMap);
  const mapRef = useRef(map);
  const undoStackRef = useRef<RailwayMap[]>([]);
  const redoStackRef = useRef<RailwayMap[]>([]);
  const transientHistoryStartRef = useRef<RailwayMap | null>(null);

  useEffect(() => {
    mapRef.current = map;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(map));
    }
  }, [map, storageKey]);

  const pushUndoSnapshot = useCallback((snapshot: RailwayMap) => {
    undoStackRef.current = [...undoStackRef.current.slice(-99), cloneMap(snapshot)];
    redoStackRef.current = [];
  }, []);

  const updateMap = useCallback((updater: (current: RailwayMap) => RailwayMap, options?: { trackHistory?: boolean }) => {
    setMap((current) => {
      const next = sanitizeRailwayMap(updater(current));
      if (next === current || mapsEqual(next, current)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return next;
    });
  }, [pushUndoSnapshot]);

  const replaceMap = useCallback((nextMap: RailwayMap, options?: { trackHistory?: boolean }) => {
    setMap((current) => {
      const sanitizedNextMap = sanitizeRailwayMap(nextMap);
      if (mapsEqual(current, sanitizedNextMap)) {
        return current;
      }

      if (options?.trackHistory !== false && !transientHistoryStartRef.current) {
        pushUndoSnapshot(current);
      }

      return cloneMap(sanitizedNextMap);
    });
  }, [pushUndoSnapshot]);

  const beginTransientMapChange = useCallback(() => {
    if (!transientHistoryStartRef.current) {
      transientHistoryStartRef.current = cloneMap(mapRef.current);
    }
  }, []);

  const completeTransientMapChange = useCallback(() => {
    const snapshot = transientHistoryStartRef.current;
    transientHistoryStartRef.current = null;
    if (!snapshot) return;
    if (mapsEqual(snapshot, mapRef.current)) return;
    pushUndoSnapshot(snapshot);
  }, [pushUndoSnapshot]);

  const undoLastChange = useCallback(() => {
    completeTransientMapChange();
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return false;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, cloneMap(mapRef.current)];
    setMap(cloneMap(previous));
    return true;
  }, [completeTransientMapChange]);

  return {
    map,
    mapRef,
    setMap,
    updateMap,
    replaceMap,
    beginTransientMapChange,
    completeTransientMapChange,
    undoLastChange,
  };
}
