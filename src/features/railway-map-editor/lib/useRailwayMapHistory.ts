import { useCallback, useEffect, useRef, useState } from "react";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import { persistRailwayMap } from "@/features/railway-map-editor/lib/persistence";
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
  skipInitialPersistence?: boolean;
};

export function useRailwayMapHistory(args: UseRailwayMapHistoryArgs) {
  const { initialMap, storageKey, skipInitialPersistence = false } = args;
  const [map, setMap] = useState<RailwayMap>(initialMap);
  const mapRef = useRef(map);
  const blockedInitialPersistenceMapRef = useRef<RailwayMap | null>(skipInitialPersistence ? initialMap : null);
  const undoStackRef = useRef<RailwayMap[]>([]);
  const redoStackRef = useRef<RailwayMap[]>([]);
  const transientHistoryStartRef = useRef<RailwayMap | null>(null);
  const persistenceTimeoutRef = useRef<number | null>(null);

  const schedulePersistence = useCallback((nextMap: RailwayMap) => {
    if (typeof window === "undefined") return;
    if (blockedInitialPersistenceMapRef.current === nextMap) return;
    blockedInitialPersistenceMapRef.current = null;
    if (persistenceTimeoutRef.current !== null) {
      window.clearTimeout(persistenceTimeoutRef.current);
    }
    persistenceTimeoutRef.current = window.setTimeout(() => {
      persistRailwayMap(window.localStorage, storageKey, nextMap);
      persistenceTimeoutRef.current = null;
    }, 250);
  }, [storageKey]);

  useEffect(() => {
    mapRef.current = map;
    if (!transientHistoryStartRef.current) {
      schedulePersistence(map);
    }
  }, [map, schedulePersistence]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistBeforeUnload = () => {
      if (blockedInitialPersistenceMapRef.current !== mapRef.current) {
        persistRailwayMap(window.localStorage, storageKey, mapRef.current);
      }
    };
    window.addEventListener("beforeunload", persistBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", persistBeforeUnload);
      if (persistenceTimeoutRef.current !== null) {
        window.clearTimeout(persistenceTimeoutRef.current);
        persistenceTimeoutRef.current = null;
      }
    };
  }, [storageKey]);

  const pushUndoSnapshot = useCallback((snapshot: RailwayMap) => {
    undoStackRef.current = [...undoStackRef.current.slice(-99), cloneMap(snapshot)];
    redoStackRef.current = [];
  }, []);

  const updateMap = useCallback((updater: (current: RailwayMap) => RailwayMap, options?: { trackHistory?: boolean }) => {
    setMap((current) => {
      const isTransient = transientHistoryStartRef.current !== null;
      const updated = updater(current);
      const next = isTransient ? updated : sanitizeRailwayMap(updated);
      if (next === current || (!isTransient && mapsEqual(next, current))) {
        return current;
      }

      if (options?.trackHistory !== false && !isTransient) {
        pushUndoSnapshot(current);
      }

      mapRef.current = next;
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

      const clonedNextMap = cloneMap(sanitizedNextMap);
      mapRef.current = clonedNextMap;
      return clonedNextMap;
    });
  }, [pushUndoSnapshot]);

  const beginTransientMapChange = useCallback(() => {
    if (!transientHistoryStartRef.current) {
      transientHistoryStartRef.current = cloneMap(mapRef.current);
      if (typeof window !== "undefined" && persistenceTimeoutRef.current !== null) {
        window.clearTimeout(persistenceTimeoutRef.current);
        persistenceTimeoutRef.current = null;
      }
    }
  }, []);

  const completeTransientMapChange = useCallback(() => {
    const snapshot = transientHistoryStartRef.current;
    transientHistoryStartRef.current = null;
    if (!snapshot) return;
    const sanitizedMap = sanitizeRailwayMap(mapRef.current);
    if (!mapsEqual(sanitizedMap, mapRef.current)) {
      mapRef.current = sanitizedMap;
      setMap(sanitizedMap);
    }
    schedulePersistence(sanitizedMap);
    if (mapsEqual(snapshot, sanitizedMap)) return;
    pushUndoSnapshot(snapshot);
  }, [pushUndoSnapshot, schedulePersistence]);

  const undoLastChange = useCallback(() => {
    completeTransientMapChange();
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return false;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, cloneMap(mapRef.current)];
    const clonedPrevious = cloneMap(previous);
    mapRef.current = clonedPrevious;
    setMap(clonedPrevious);
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
