import { describe, expect, it } from "vitest";
import { DEVELOPMENT_BOOTSTRAP_MAP } from "@/entities/railway-map/model/constants";

describe("development bootstrap import", () => {
  it("includes the Aguablanca Nord XMind import as a third sheet", () => {
    expect(DEVELOPMENT_BOOTSTRAP_MAP.model.sheets.map((sheet) => sheet.id)).toContain("sh-agn");
    expect(DEVELOPMENT_BOOTSTRAP_MAP.model.sheets).toHaveLength(3);
    expect(
      DEVELOPMENT_BOOTSTRAP_MAP.config.lines
        .filter((line) => line.id.startsWith("l-agn-"))
        .map((line) => line.name),
    ).toEqual([
      "C-5",
      "C-3",
      "C-2",
      "C-13",
      "C-11",
      "C-12 (C-27)",
      "C-9a",
      "C-9b",
      "C-7",
      "C-23",
      "C-1",
      "C-6",
    ]);
  });
});
