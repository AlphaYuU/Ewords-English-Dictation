import { describe, expect, it } from "vitest";
import { buildImportPreview, exportHistoryListCsv } from "@dictation/import-export";

describe("import preview", () => {
  it("marks duplicate and unmatched rows", () => {
    const rows = buildImportPreview("word,meaning\nambiguous,含糊的\nresilient,", ["ambiguous"]);
    expect(rows[0].status).toBe("duplicate");
    expect(rows[0].action).toBe("skip");
    expect(rows[1].status).toBe("unmatched");
  });

  it("accepts Chinese commas and whitespace separated rows", () => {
    const rows = buildImportPreview("单词，释义\napple，苹果\nlearn 学习；认识到；得知\nbattery\t电池");
    expect(rows.map((row) => [row.word, row.meaning])).toEqual([
      ["apple", "苹果"],
      ["learn", "学习；认识到；得知"],
      ["battery", "电池"],
    ]);
  });

  it("exports history list with UTF-8 BOM and Chinese headers", () => {
    const csv = exportHistoryListCsv([
      {
        sessionId: 1,
        sourceName: "收藏夹",
        sourceType: "favorite",
        mode: "typing",
        accent: "uk",
        total: 3,
        correctCount: 2,
        wrongCount: 1,
        skippedCount: 0,
        unmarkedCount: 0,
        accuracy: 66.7,
        durationSec: 75,
        endedAt: new Date("2026-05-05T10:20:00").getTime(),
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"来源","模式","发音","词数","正确","错误","正确率","用时","完成时间"');
    expect(csv).toContain('"收藏夹","打字模式","英音","3","2","1","66.7%","1:15"');
  });
});
