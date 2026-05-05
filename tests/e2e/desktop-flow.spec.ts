import { expect, test } from "@playwright/test";

type MockLibrary = {
  id: number;
  name: string;
  description: string;
  tags?: string[];
  type: "wrong_book" | "favorite" | "official" | "custom";
  coverColor: string;
  coverIcon: string;
  wordCount: number;
  unitCount: number;
  progress: number;
  createdAt: number;
  updatedAt: number;
};

type MockUnit = {
  id: number;
  libraryId: number;
  name: string;
  sortOrder: number;
  wordCount: number;
};

type MockWord = {
  id: number;
  libraryId: number;
  dictionaryEntryId: number;
  wordKey: string;
  unitIds: number[];
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech?: string;
  isFavorite: boolean;
  inWrongBook: boolean;
  masteryLevel: number;
  wrongCount: number;
  dictationCount: number;
  addedAt: number;
};

type MockDictionaryEntry = {
  id: number;
  word: string;
  ukPhonetic: string;
  usPhonetic: string;
  partOfSpeech?: string;
  meaningCn: string;
  source: string;
};

type MockSession = {
  id: number;
  sourceName: string;
  source: { sourceType: string; [key: string]: unknown };
  mode: string;
  accent: string;
  status: string;
  wordCount: number;
  durationSec: number;
  completedAt?: number;
  [key: string]: unknown;
};

type MockSessionResult = {
  sessionId: number;
  result: string;
  [key: string]: unknown;
};

type MockHistoryItem = {
  sessionId: number;
  sourceName: string;
  sourceType: string;
  mode: string;
  accent: string;
  total: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  unmarkedCount: number;
  accuracy: number;
  durationSec: number;
  endedAt: number;
};

type MockState = {
  libraries: MockLibrary[];
  units: MockUnit[];
  words: MockWord[];
  dictionary: MockDictionaryEntry[];
  examples: unknown[];
  sessions: MockSession[];
  results: MockSessionResult[];
  history: MockHistoryItem[];
  searchHistory: unknown[];
  practiceQueueWordIds: number[];
  settings: Record<string, unknown>;
};

type MockDatabaseRequest = Record<string, unknown> & {
  resource?: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    const officialBooks: Array<[number, string, number]> = [
      [10, "IELTS", 5040],
      [11, "TOEFL", 6974],
      [12, "GRE", 7504],
      [13, "CET4", 3849],
      [14, "CET6", 5407],
      [15, "考研英语", 4801],
      [16, "高考英语", 3677],
      [17, "中考英语", 1603],
    ];
    const sampleRows: Array<[number, string, string, string, string]> = [
      [10, "abbreviation", "ә.bri:vi'eiʃәn", "n. 缩写词, 缩写, 缩短, 节略", "n."],
      [10, "ability", "ә'biliti", "n. 能力, 才干", "n."],
      [10, "abnormal", "æb'nɒ:mәl", "a. 反常的, 不规则的, 变态的, 畸形的", "a."],
      [10, "abolish", "ә'bɒliʃ", "vt. 废止, 革除, 消灭", "v."],
      [10, "access", "'ækses", "n. 通路, 入口 vt. 访问", "n."],
      [10, "accident", "'æksidәnt", "n. 事故, 意外", "n."],
      [10, "account", "ә'kaunt", "n. 账户, 说明 vt. 认为", "n."],
      [10, "accurate", "'ækjurәt", "a. 精确的, 准确的", "a."],
      [10, "achieve", "ә'tʃi:v", "vt. 完成, 达到", "v."],
      [10, "acquire", "ә'kwaiә", "vt. 获得, 学到", "v."],
      [10, "adapt", "ә'dæpt", "vt. 使适应 vi. 适应", "v."],
      [10, "admire", "әd'maiә", "vt. 钦佩, 赞美", "v."],
      [10, "advance", "әd'vɑ:ns", "n. 前进 vt. 推进", "v."],
      [10, "advocate", "'ædvәkeit", "vt. 提倡 n. 倡导者", "v."],
      [11, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v."],
      [11, "abandoned", "ә'bændәnd", "a. 被抛弃的, 无约束的", "a."],
      [12, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v."],
      [13, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v."],
      [13, "ability", "ә'biliti", "n. 能力, 才干", "n."],
      [17, "apple", "'æpl", "n. 苹果, 家伙 [医] 苹果", "n."],
    ];
    const state: MockState = {
      libraries: [
        { id: 1, name: "错题本", description: "自动收集听写错误和跳过的单词", type: "wrong_book", coverColor: "#D4916E", coverIcon: "alert", wordCount: 0, unitCount: 0, progress: 0, createdAt: now, updatedAt: now },
        { id: 2, name: "收藏夹", description: "收藏的重要单词", type: "favorite", coverColor: "#D4916E", coverIcon: "star", wordCount: 0, unitCount: 0, progress: 0, createdAt: now, updatedAt: now },
        ...officialBooks.map(([id, name, count], index) => ({ id, name, description: `${count} 词`, type: "official" as const, coverColor: "#D4916E", coverIcon: "book", wordCount: count, unitCount: 1, progress: 0, createdAt: now + index, updatedAt: now + index })),
      ],
      units: officialBooks.map(([id], index) => ({ id: 100 + index, libraryId: id, name: "全部", sortOrder: 0, wordCount: sampleRows.filter(([libraryId]) => libraryId === id).length })),
      words: sampleRows.map(([libraryId, word, phonetic, meaning, partOfSpeech], index) => {
        const isWrongBookWord = word === "abnormal";
        return {
          id: 1000 + index,
          libraryId,
          dictionaryEntryId: 1000 + index,
          wordKey: word.toLowerCase(),
          unitIds: [100 + officialBooks.findIndex(([id]) => id === libraryId)],
          word,
          meaning,
          phonetic,
          partOfSpeech,
          isFavorite: false,
          inWrongBook: isWrongBookWord,
          masteryLevel: 0,
          wrongCount: isWrongBookWord ? 1 : 0,
          dictationCount: 0,
          addedAt: now + index,
        };
      }),
      dictionary: sampleRows.map(([, word, phonetic, meaning, partOfSpeech], index) => ({
        id: 1000 + index,
        word,
        ukPhonetic: phonetic,
        usPhonetic: phonetic,
        partOfSpeech,
        meaningCn: meaning,
        source: "ecdict",
      })),
      examples: [],
      sessions: [],
      results: [],
      history: [],
      searchHistory: [],
      practiceQueueWordIds: [],
      settings: { defaultAccent: "us", defaultDictationMode: "typing", autoPlay: true, theme: "light", fontSize: "normal", cacheLimitMb: 512, colorWeakMode: false },
    };
    const bootstrap = () => ({ ...state, libraries: [...state.libraries], words: [...state.words], sessions: [...state.sessions], results: [...state.results], history: [...state.history], searchHistory: [...state.searchHistory] });
    const searchDictionary = (query: string, limit = 24) => {
      const normalized = query.trim().toLowerCase();
      return state.dictionary
        .filter((entry) => entry.word.toLowerCase().includes(normalized) || entry.meaningCn.includes(query.trim()))
        .filter((entry, index, rows) => rows.findIndex((row) => row.word.toLowerCase() === entry.word.toLowerCase()) === index)
        .slice(0, limit);
    };
    const importWords = (rows: Array<Record<string, unknown>>, targetLibraryId?: number) => {
      const libraryId = targetLibraryId ?? state.libraries.find((library) => library.type === "custom")?.id ?? 10;
      const nextStart = Math.max(1000, ...state.words.map((word) => word.id)) + 1;
      rows.forEach((row, index) => {
        const word = String(row.word ?? "");
        if (!word || state.words.some((item) => item.libraryId === libraryId && item.word.toLowerCase() === word.toLowerCase())) return;
        state.words.push({
          id: nextStart + index,
          libraryId,
          dictionaryEntryId: nextStart + index,
          wordKey: word.toLowerCase(),
          unitIds: [],
          word,
          meaning: String(row.meaning ?? "暂无释义"),
          phonetic: String(row.phonetic ?? ""),
          partOfSpeech: row.partOfSpeech ? String(row.partOfSpeech) : undefined,
          isFavorite: false,
          inWrongBook: false,
          masteryLevel: 0,
          wrongCount: 0,
          dictationCount: 0,
          addedAt: now + nextStart + index,
        });
      });
      state.libraries = state.libraries.map((library) => (library.id === libraryId ? { ...library, wordCount: state.words.filter((word) => word.libraryId === libraryId).length } : library));
    };
    Object.defineProperty(window, "dictationBridge", {
      configurable: true,
      value: {
      app: { getAppVersion: async () => "1.0.0", getPlatform: () => "win32", openExternal: async () => true },
      database: {
        query: async (request: MockDatabaseRequest) => {
          if (request.resource === "bootstrap") return { ok: true, data: bootstrap() };
          if (request.resource === "dictionary-search") return { ok: true, data: searchDictionary(String(request.query ?? ""), Number(request.limit ?? 24)) };
          if (request.resource === "dictionary-entry") {
            const entry = request.entryId != null ? state.dictionary.find((item) => item.id === Number(request.entryId)) : state.dictionary.find((item) => item.word.toLowerCase() === String(request.word ?? "").toLowerCase());
            return { ok: true, data: { entry: entry ?? null, examples: [] } };
          }
          if (request.resource === "create-library") {
            const id = Math.max(...state.libraries.map((library) => library.id)) + 1;
            const tags = Array.isArray(request.tags) ? request.tags.map(String) : undefined;
            state.libraries.push({ id, name: String(request.name), description: "自建词库", tags, type: "custom", coverColor: String(request.coverColor ?? "#D4916E"), coverIcon: "book", wordCount: 0, unitCount: 1, progress: 0, createdAt: now, updatedAt: now });
            state.units.push({ id: id * 10, libraryId: id, name: "全部", sortOrder: 0, wordCount: 0 });
            return { ok: true, data: bootstrap() };
          }
          if (request.resource === "import-words") {
            importWords((request.rows as Array<Record<string, unknown>>) ?? [], request.targetLibraryId == null ? undefined : Number(request.targetLibraryId));
            return { ok: true, data: bootstrap() };
          }
          if (request.resource === "toggle-favorite") {
            const wordId = Number(request.wordId);
            state.words = state.words.map((word) => (word.id === wordId ? { ...word, isFavorite: Boolean(request.isFavorite) } : word));
            return { ok: true, data: null };
          }
          if (request.resource === "save-session") {
            const session = request.session as MockSession;
            const id = Number(session.id);
            const results = Array.isArray(request.results) ? (request.results as MockSessionResult[]) : [];
            state.sessions = [...state.sessions.filter((item) => item.id !== id), session];
            state.results = [...state.results.filter((item) => item.sessionId !== id), ...results];
            state.history = state.sessions.filter((item) => item.status === "completed").map((item) => ({ sessionId: item.id, sourceName: item.sourceName, sourceType: item.source.sourceType, mode: item.mode, accent: item.accent, total: item.wordCount, correctCount: state.results.filter((row) => row.sessionId === item.id && row.result === "correct").length, wrongCount: state.results.filter((row) => row.sessionId === item.id && row.result !== "correct").length, skippedCount: 0, unmarkedCount: 0, accuracy: 0, durationSec: item.durationSec, endedAt: item.completedAt ?? now }));
            return { ok: true, data: null };
          }
          if (request.resource === "save-practice-queue" || request.resource === "record-search") return { ok: true, data: null };
          return { ok: true, data: bootstrap() };
        },
      },
      file: {
        selectImportFile: async () => null,
        selectDataBackupFile: async () => null,
        saveTextFile: async () => null,
        exportTatoebaAttributionCsv: async () => null,
        clearCache: async () => ({ removedFiles: 0, removedBytes: 0 }),
      },
      audio: {
        play: async () => ({ ok: true, dataUrl: "data:audio/wav;base64," }),
        prepare: async () => ({ ok: true, dataUrl: "data:audio/wav;base64," }),
        playFile: async () => ({ ok: true }),
        pause: async () => true,
        stop: async () => true,
      },
      },
    });
  });
});

test("primary practice entry opens setup and keeps start disabled until source is set", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "听写设置" })).toBeVisible();
  await expect(page.getByText("未选择来源")).toBeVisible();
  await expect(page.locator(".desktop-main").getByRole("button", { name: "开始听写" })).toBeDisabled();
  await page.getByRole("button", { name: "更改" }).click();
  await expect(page.getByRole("heading", { name: "选择目标词库与 Unit" })).toBeVisible();
  await page.getByRole("button", { name: /雅思|IELTS/ }).first().click();
  await page.getByRole("button", { name: "全选当前列表" }).click();
  await page.getByRole("button", { name: /确定/ }).click();
  await expect(page.getByRole("heading", { name: "听写设置" })).toBeVisible();
  await expect(page.locator(".desktop-main").getByRole("button", { name: "开始听写" })).toBeEnabled();
});

test("dictionary page search opens dictionary entry detail", async ({ page }) => {
  await page.goto("/dictionary");
  await page.getByPlaceholder("搜索单词和中文释义").fill("ability");
  await page.getByRole("button", { name: /ability/ }).first().click();
  await expect(page.getByRole("heading", { name: "ability" })).toBeVisible();
  await expect(page.locator(".back-link")).toContainText("词典 / ability");
  await expect(page.getByRole("heading", { name: "标签" })).toBeVisible();
  await expect(page.getByRole("button", { name: /UK/ })).toBeEnabled();
  await expect(page.locator(".word-hero-actions").getByRole("button", { name: "收藏" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "加入听写列表" })).toBeEnabled();
});

test("sidebar search opens dictionary entry detail without a search page", async ({ page }) => {
  await page.goto("/library");
  await page.locator(".sidebar-search").getByPlaceholder("搜索词库 / 单词").fill("ability");
  await page.locator(".sidebar-suggest-panel").getByRole("button", { name: /ability/ }).first().click();
  await expect(page).toHaveURL(/\/dictionary\/entry\//);
  await expect(page.getByRole("heading", { name: "ability" })).toBeVisible();
  await expect(page.locator(".back-link")).toContainText("词典 / ability");
});

test("favorite and wrong-book pins become active on their pages", async ({ page }) => {
  await page.goto("/favorites");
  await expect(page.locator(".sidebar-pin-item.is-active").filter({ hasText: "收藏夹" })).toBeVisible();
  await page.goto("/wrong-book");
  await expect(page.locator(".sidebar-pin-item.is-active").filter({ hasText: "错题本" })).toBeVisible();
  await expect(page.getByText("1 词 · 掌握度满后自动移出")).toBeVisible();
});

test("typing wrong answer advances immediately and prevents re-grading the same word", async ({ page }) => {
  await page.goto("/practice");
  await page.getByRole("button", { name: "更改" }).click();
  await page.getByRole("button", { name: /IELTS/ }).first().click();
  await page.getByRole("button", { name: "全选当前列表" }).click();
  await page.getByRole("button", { name: /确定/ }).click();
  await page.locator(".desktop-main").getByRole("button", { name: "开始听写" }).click();
  await expect(page.getByText(/进度 1 \/ \d+/)).toBeVisible();
  const answerInput = page.locator(".session-input-caret + input");
  await answerInput.fill("definitelywrong");
  await page.locator(".desktop-main").getByRole("button", { name: "提交" }).click();
  await expect(page.getByText(/进度 2 \/ \d+/)).toBeVisible();
  await expect(answerInput).toHaveValue("");
});

test("library detail search enter filters the current word table", async ({ page }) => {
  await page.goto("/library/10");
  const search = page.getByPlaceholder("在该词库中搜索...");
  await search.fill("abn");
  await search.press("Enter");
  await expect(page.locator(".word-row-title", { hasText: "abnormal" })).toBeVisible();
  await expect(page.locator(".word-row-title", { hasText: "ability" })).toHaveCount(0);
});

test("library detail restores scroll position after returning from word detail", async ({ page }) => {
  await page.goto("/library/10");
  const tableBody = page.locator(".word-table-body");
  await tableBody.evaluate((element) => {
    element.scrollTop = 368;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(page.locator(".word-row", { hasText: "adapt" })).toBeVisible();
  await page.locator(".word-row", { hasText: "adapt" }).click();
  await expect(page.getByRole("heading", { name: "adapt" })).toBeVisible();
  await page.locator(".back-link").click();
  await expect(page.locator(".word-row.is-active", { hasText: "adapt" })).toBeVisible();
  const restoredScrollTop = await page.locator(".word-table-body").evaluate((element) => element.scrollTop);
  expect(restoredScrollTop).toBeGreaterThan(150);
});

test("library detail restores filter and search state after returning from word detail", async ({ page }) => {
  await page.goto("/library/10");
  await page.getByRole("button", { name: "错词 (1)" }).click();
  await expect(page.locator(".word-row-title", { hasText: "abnormal" })).toBeVisible();
  await expect(page.locator(".word-row-title", { hasText: "ability" })).toHaveCount(0);
  await page.locator(".word-row", { hasText: "abnormal" }).click();
  await expect(page.getByRole("heading", { name: "abnormal" })).toBeVisible();
  await page.locator(".back-link").click();
  await expect(page.locator(".word-row-title", { hasText: "abnormal" })).toBeVisible();
  await expect(page.locator(".word-row-title", { hasText: "ability" })).toHaveCount(0);

  await page.goto("/library/10");
  const search = page.getByPlaceholder("在该词库中搜索...");
  await search.fill("ach");
  await search.press("Enter");
  await expect(page.locator(".word-row-title", { hasText: "achieve" })).toBeVisible();
  await page.locator(".word-row", { hasText: "achieve" }).click();
  await expect(page.getByRole("heading", { name: "achieve" })).toBeVisible();
  await page.locator(".back-link").click();
  await expect(page.getByPlaceholder("在该词库中搜索...")).toHaveValue("ach");
  await expect(page.locator(".word-row-title", { hasText: "achieve" })).toBeVisible();
  await expect(page.locator(".word-row-title", { hasText: "ability" })).toHaveCount(0);
});

test("word detail favorite button toggles selected state", async ({ page }) => {
  await page.goto("/words/1000");
  const actions = page.locator(".word-hero-actions");
  await actions.getByRole("button", { name: "收藏" }).click();
  await expect(actions.getByRole("button", { name: "取消收藏" })).toBeVisible();
  await actions.getByRole("button", { name: "取消收藏" }).click();
  await expect(actions.getByRole("button", { name: "收藏" })).toBeVisible();
});

test("word detail adds to dictation list without leaving detail page", async ({ page }) => {
  await page.goto("/words/1000");
  await page.getByRole("button", { name: "加入听写列表" }).click();
  await expect(page).toHaveURL(/\/words\/1000$/);
  await expect(page.getByRole("button", { name: "已加入听写列表" })).toBeVisible();
  await page.getByRole("button", { name: "已加入听写列表" }).click();
  await expect(page.getByRole("heading", { name: "移出听写列表" })).toBeVisible();
  await page.getByRole("button", { name: "移出" }).click();
  await expect(page.getByRole("button", { name: "加入听写列表" })).toBeVisible();
});

test("library shelf uses built-in names, labels, and unified color", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByText("IELTS")).toBeVisible();
  await expect(page.getByText("TOEFL")).toBeVisible();
  await expect(page.getByText("GRE")).toBeVisible();
  await expect(page.getByText("CET4")).toBeVisible();
  await expect(page.getByText("CET6")).toBeVisible();
  await expect(page.getByText("内置词库").first()).toBeVisible();
  const colors = await page.locator(".library-card.system, .library-card.official").evaluateAll((cards) =>
    cards.map((card) => getComputedStyle(card).backgroundColor),
  );
  expect(new Set(colors)).toEqual(new Set(["rgb(212, 145, 110)"]));
});

test("word detail add-to-library opens library picker directly", async ({ page }) => {
  await page.goto("/words/1000");
  await page.getByRole("button", { name: "加入词库" }).click();
  await expect(page.getByRole("heading", { name: "加入词库" })).toBeVisible();
  await expect(page.getByText(/选择要加入/)).toBeVisible();
  await expect(page.getByPlaceholder("搜索单词")).toHaveCount(0);
});

test("word detail add-to-library success dialog has view and confirm actions", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "新建词库", exact: true }).first().click();
  await page.getByLabel("词库名称").fill("导入目标");
  await page.getByRole("button", { name: "创建" }).click();
  await page.getByRole("button", { name: /IELTS/ }).click();
  await page.locator(".word-row").first().click();
  await page.getByRole("button", { name: "加入词库" }).click();
  await page.getByRole("button", { name: /导入目标/ }).click();
  await expect(page.getByRole("heading", { name: "导入成功" })).toBeVisible();
  await expect(page.getByText("单词已经导入目标词库。")).toBeVisible();
  await expect(page.getByRole("button", { name: "查看词库" })).toBeVisible();
  await page.getByRole("button", { name: "确定" }).click();
  await expect(page).toHaveURL(/\/words\/\d+$/);
});

test("create library dialog supports editable tags and cover colors", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "新建词库", exact: true }).first().click();
  await page.getByLabel("词库名称").fill("测试词库");
  await page.getByPlaceholder("输入标签").fill("雅思");
  await page.getByRole("button", { name: "添加" }).click();
  await page.getByLabel("标签 1").fill("复习");
  await page.getByRole("button", { name: "紫色" }).click();
  await page.getByRole("button", { name: "删除标签 复习" }).click();
  await expect(page.getByLabel("标签 1")).toHaveCount(0);
  await page.getByPlaceholder("输入标签").fill("自建");
  await page.getByRole("button", { name: "添加" }).click();
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page.getByText("测试词库")).toBeVisible();
});
