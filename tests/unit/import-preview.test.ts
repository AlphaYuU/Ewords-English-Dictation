import { describe, expect, it } from "vitest";
import { buildImportPreview } from "@dictation/import-export";

describe("import preview", () => {
  it("marks duplicate and unmatched rows", () => {
    const rows = buildImportPreview("word,meaning\nambiguous,含糊的\nresilient,", ["ambiguous"]);
    expect(rows[0].status).toBe("duplicate");
    expect(rows[0].action).toBe("skip");
    expect(rows[1].status).toBe("unmatched");
  });
});
