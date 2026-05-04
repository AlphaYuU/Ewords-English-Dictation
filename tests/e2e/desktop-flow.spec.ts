import { expect, test } from "@playwright/test";

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
});

test("library detail search enter filters the current word table", async ({ page }) => {
  await page.goto("/library/10");
  const search = page.getByPlaceholder("在该词库中搜索...");
  await search.fill("abn");
  await search.press("Enter");
  await expect(page.locator(".word-row-title", { hasText: "abnormal" })).toBeVisible();
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
