import { describe, expect, it } from "vitest";
import { INITIAL_MAP } from "@/entities/railway-map/model/constants";
import {
  loadRailwayMapFromStorage,
  parseRailwayMapDocument,
  persistRailwayMap,
} from "@/features/railway-map-editor/lib/persistence";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    value(key: string) {
      return values.get(key) ?? null;
    },
  };
}

describe("railway map persistence", () => {
  it("migrates an unversioned document to the current schema", () => {
    const { schemaVersion: _schemaVersion, ...legacyMap } = INITIAL_MAP;
    const storage = createMemoryStorage({ map: JSON.stringify(legacyMap) });

    const result = loadRailwayMapFromStorage(storage, "map", INITIAL_MAP);

    expect(result.source).toBe("migrated");
    expect(result.map.schemaVersion).toBe(1);
    expect(result.skipInitialPersistence).toBe(false);
  });

  it("loads a current document without migration", () => {
    const parsed = parseRailwayMapDocument(JSON.stringify(INITIAL_MAP));

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.model.sheets).toEqual(INITIAL_MAP.model.sheets);
  });

  it("preserves invalid source data under a recovery key", () => {
    const storage = createMemoryStorage({ map: "{not-json" });

    const result = loadRailwayMapFromStorage(storage, "map", INITIAL_MAP);

    expect(result.source).toBe("recovered");
    expect(result.recoveryKey).toBe("map:recovery");
    expect(result.skipInitialPersistence).toBe(true);
    expect(storage.value("map")).toBe("{not-json");
    expect(storage.value("map:recovery")).toBe("{not-json");
  });

  it("falls back safely when recovery storage is unavailable", () => {
    const storage = {
      getItem() {
        return "{not-json";
      },
      setItem() {
        throw new Error("quota exceeded");
      },
    };

    expect(() => loadRailwayMapFromStorage(storage, "map", INITIAL_MAP)).not.toThrow();
    expect(loadRailwayMapFromStorage(storage, "map", INITIAL_MAP).skipInitialPersistence).toBe(true);
  });

  it("reports persistence failures without throwing", () => {
    const storage = {
      setItem() {
        throw new Error("quota exceeded");
      },
    };

    expect(persistRailwayMap(storage, "map", INITIAL_MAP)).toBe(false);
  });
});
