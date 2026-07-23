import { railwayMapSchema, RAILWAY_MAP_SCHEMA_VERSION } from "@/entities/railway-map/model/schema";
import type { RailwayMap } from "@/entities/railway-map/model/types";
import { sanitizeRailwayMap } from "@/entities/railway-map/model/utils";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
type RailwayMapLoadSource = "empty" | "stored" | "migrated" | "recovered";

export type RailwayMapLoadResult = {
  map: RailwayMap;
  source: RailwayMapLoadSource;
  recoveryKey: string | null;
  skipInitialPersistence: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateRailwayMapDocument(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Railway map document must be an object.");
  }

  if (value.schemaVersion === undefined) {
    return {
      ...value,
      schemaVersion: RAILWAY_MAP_SCHEMA_VERSION,
    };
  }

  if (value.schemaVersion !== RAILWAY_MAP_SCHEMA_VERSION) {
    throw new Error(`Unsupported railway map schema version: ${String(value.schemaVersion)}`);
  }

  return value;
}

export function parseRailwayMapDocument(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  const migrated = migrateRailwayMapDocument(parsed);
  return sanitizeRailwayMap(railwayMapSchema.parse(migrated));
}

export function persistRailwayMap(storage: StorageWriter, storageKey: string, map: RailwayMap) {
  try {
    storage.setItem(storageKey, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function loadRailwayMapFromStorage(
  storage: StorageReader & Partial<StorageWriter>,
  storageKey: string,
  fallbackMap: RailwayMap,
): RailwayMapLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return {
      map: sanitizeRailwayMap(fallbackMap),
      source: "recovered",
      recoveryKey: null,
      skipInitialPersistence: true,
    };
  }

  if (!raw) {
    return {
      map: sanitizeRailwayMap(fallbackMap),
      source: "empty",
      recoveryKey: null,
      skipInitialPersistence: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateRailwayMapDocument(parsed);
    return {
      map: sanitizeRailwayMap(railwayMapSchema.parse(migrated)),
      source: isRecord(parsed) && parsed.schemaVersion === undefined ? "migrated" : "stored",
      recoveryKey: null,
      skipInitialPersistence: false,
    };
  } catch {
    const recoveryKey = `${storageKey}:recovery`;
    try {
      storage.setItem?.(recoveryKey, raw);
    } catch {
      // Keep the original storage entry untouched when backup storage is unavailable.
    }
    return {
      map: sanitizeRailwayMap(fallbackMap),
      source: "recovered",
      recoveryKey,
      skipInitialPersistence: true,
    };
  }
}
