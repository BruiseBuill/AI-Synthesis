import { expect, test } from "@playwright/test";

test("seeded deal is reproducible and prototype deck actions are absent", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("御前炼金所");
  await expect(page.getByTestId("hand-card")).toHaveCount(6);
  await expect(page.getByTestId("hand-card").first().getByText("获得一张基础卡")).toBeVisible();
  await expect(page.getByTestId("empty-treasure")).toBeVisible();

  const seedInput = page.getByLabel("牌局种子");
  await seedInput.fill("browser-seed-42");
  await page.getByRole("button", { name: "重新发牌" }).click();

  const initialHand = await page.getByTestId("hand-card").evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-card-id")),
  );

  const initialDeckTops = await page.evaluate(() => {
    const state = window.__SYNTHESIS_SOLO_STORE__!.getState();
    return [state.basicDeck[0]?.id, state.treasureDeck[0]?.id];
  });

  await page.getByRole("button", { name: "重新发牌" }).click();

  await expect(page.getByTestId("active-seed")).toHaveText("browser-seed-42");
  expect(await page.getByTestId("hand-card").evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-card-id")),
  )).toEqual(initialHand);
  expect(await page.evaluate(() => {
    const state = window.__SYNTHESIS_SOLO_STORE__!.getState();
    return [state.basicDeck[0]?.id, state.treasureDeck[0]?.id];
  })).toEqual(initialDeckTops);
  await expect(page.getByRole("button", { name: "发 1 张" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "翻 1 张" })).toHaveCount(0);
});

test("a fresh page starts with a generated seed", async ({ page }) => {
  await page.goto("/");
  const firstSeed = await page.getByTestId("active-seed").textContent();
  expect(firstSeed).toMatch(/^forge-[0-9a-z]{7}-[0-9a-z]{7}$/);

  await page.reload();
  const secondSeed = await page.getByTestId("active-seed").textContent();
  expect(secondSeed).toMatch(/^forge-[0-9a-z]{7}-[0-9a-z]{7}$/);
  expect(secondSeed).not.toBe(firstSeed);
});

test("the first screen does not overflow on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile-only layout assertion");
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("heading", { name: "当前手牌" })).toBeVisible();
});

test("synthesis accepts exactly four material cards", async ({ page }) => {
  await page.goto("/");

  const hand = page.getByTestId("hand-card");
  for (let index = 0; index < 5; index += 1) {
    await hand.nth(index).click();
  }

  await expect(page.getByText("已选 4/4")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始合成" })).toBeEnabled();
  await expect(page.locator('[aria-label="合成流程"]')).toHaveCount(0);
});

test("an initial statue unlocks one extra material slot", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("牌局种子").fill("statue-e2e-6");
  await page.getByRole("button", { name: "重新发牌" }).click();

  const firstHand = page.getByRole("region", { name: "当前手牌" });
  for (let index = 0; index < 4; index += 1) {
    await firstHand.getByTestId("hand-card").nth(index).click();
  }
  await firstHand.getByRole("button", { name: "开始合成" }).click();
  await page.getByRole("button", { name: "停止翻牌" }).click();

  const nextHand = page.getByRole("region", { name: "当前手牌" });
  const statue = nextHand.locator('[data-card-id="treasure-48-1"]');
  await expect(statue).toBeVisible();
  await statue.click();
  for (let index = 0; index < 4; index += 1) {
    await nextHand.getByTestId("hand-card").nth(index).click();
  }

  await expect(nextHand.getByText("已选 5/5")).toBeVisible();
  await expect(nextHand.getByRole("button", { name: "开始合成" })).toBeEnabled();
});

test("cards keep their height at 80% width, effects are smaller, and synthesis owns the explosion counter", async ({ page }) => {
  await page.goto("/");

  const firstCard = page.getByTestId("hand-card").first();
  const box = await firstCard.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box!.width / box!.height) - 0.8)).toBeLessThanOrEqual(0.02);
  await expect(firstCard.locator(".card-effect p")).toHaveCSS("font-size", "18.7px");
  await expect(firstCard.getByText(/Priority/)).toHaveCount(0);
  await expect(page.locator(".status-rail").getByText("炸锅", { exact: true })).toHaveCount(0);

  await page.evaluate(async () => {
    const cards = await import(/* @vite-ignore */ "/src/game-core/cards.ts");
    const store = window.__SYNTHESIS_SOLO_STORE__!;
    const treasure = cards.buildTreasureDeck().find((card) => card.kind === "treasure")!;
    store.setState({ revealedTreasures: [treasure] });
  });
  const treasureEffect = page.getByTestId("treasure-card").first().locator(".card-effect");
  expect(await treasureEffect.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);

  const hand = page.getByTestId("hand-card");
  for (let index = 0; index < 4; index += 1) await hand.nth(index).click();
  await page.getByRole("button", { name: "开始合成" }).click();

  const synthesis = page.getByRole("region", { name: "本次合成结算" });
  await expect(synthesis.getByText("炸锅", { exact: true })).toBeVisible();
  await expect(synthesis.getByText("0/2", { exact: true })).toBeVisible();
});

test("used materials stay visible and dark until synthesis ends", async ({ page }) => {
  await page.goto("/");
  const handRegion = page.getByRole("region", { name: "当前手牌" });
  const materialIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const card = handRegion.getByTestId("hand-card").nth(index);
    materialIds.push((await card.getAttribute("data-card-id"))!);
    await card.click();
  }

  await handRegion.getByRole("button", { name: "开始合成" }).click();
  await expect(handRegion.locator('[data-used="true"]')).toHaveCount(4);
  await expect(handRegion.locator('[data-used="true"]').first()).toHaveCSS("filter", /brightness\(0\.55\)/);

  await page.getByRole("button", { name: "停止翻牌" }).click();
  await expect(handRegion.locator('[data-used="true"]')).toHaveCount(0);
  for (const id of materialIds) await expect(handRegion.locator(`[data-card-id="${id}"]`)).toHaveCount(0);
});

test("settings shows physical-card difficulty counts and cumulative percentages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开设置" }).click();
  const dialog = page.getByRole("dialog", { name: "设置" });

  await dialog.getByRole("button", { name: "查看难度统计" }).click();
  const chart = dialog.getByRole("region", { name: "牌库难度统计" });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("img", { name: "难度 4，8 张，小于等于该难度占 10%" })).toBeVisible();
  await expect(chart.getByRole("img", { name: "难度 5，19 张，小于等于该难度占 34%" })).toBeVisible();
  await expect(chart.getByRole("img", { name: "难度 20，1 张，小于等于该难度占 100%" })).toBeVisible();
  await expect(chart.locator(".difficulty-column")).toHaveCount(15);
});

test("settings includes a concise basic rulebook", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开设置" }).click();
  const dialog = page.getByRole("dialog", { name: "设置" });

  await dialog.getByRole("tab", { name: "基础规则" }).click();
  const rulebook = dialog.getByRole("tabpanel", { name: "基础规则" });
  await expect(rulebook).toBeVisible();
  await expect(rulebook.getByText("选择材料", { exact: true })).toBeVisible();
  await expect(rulebook.getByText("获取与炸锅", { exact: true })).toBeVisible();
  await expect(rulebook.getByText("阶段与终局", { exact: true }).locator("..").getByRole("paragraph"))
    .toContainText("第三次遇到阶段提示时牌局结束并展示终局分数。");
  await expect(rulebook.locator("li")).toHaveCount(6);
});

test("synthesis header shows the evaluated total score", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const [game, cards] = await Promise.all([
      import(/* @vite-ignore */ "/src/game-core/game.ts"),
      import(/* @vite-ignore */ "/src/game-core/cards.ts"),
    ]);
    const candle = cards.buildTreasureDeck().find((card) => card.name === "烛台")!;
    const basics = cards.buildBasicDeck().filter((card) => card.color === "R" && card.synthesisScore === 1).slice(0, 3);
    const target = { ...cards.buildTreasureDeck().find((card) => card.kind === "treasure")!, id: "e2e-total-target", difficulty: 8 };
    window.__SYNTHESIS_SOLO_STORE__!.setState({
      ...game.createGame("total-score-e2e"),
      hand: [candle, ...basics],
      treasureDeck: [target],
    });
  });

  const hand = page.getByRole("region", { name: "当前手牌" });
  for (let index = 0; index < 4; index += 1) await hand.getByTestId(/hand-card|treasure-card/).nth(index).click();
  await hand.getByRole("button", { name: "开始合成" }).click();

  const synthesis = page.getByRole("region", { name: "本次合成结算" });
  await expect(synthesis.getByText("总分 9", { exact: true })).toBeVisible();
  await expect(synthesis.getByText(/基础分/)).toHaveCount(0);
});

test("seal bonuses apply once per matching material", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const [game, cards] = await Promise.all([
      import(/* @vite-ignore */ "/src/game-core/game.ts"),
      import(/* @vite-ignore */ "/src/game-core/cards.ts"),
    ]);
    const seal = cards.buildTreasureDeck().find((card) => card.name === "印章" && card.color === "B")!;
    const whiteBasics = cards.buildBasicDeck().filter((card) => card.color === "W" && card.synthesisScore === 2).slice(0, 2);
    const blueBasic = cards.buildBasicDeck().find((card) => card.color === "B" && card.synthesisScore === 2)!;
    const whiteTarget = {
      ...cards.buildTreasureDeck().find((card) => card.color === "W" && card.kind === "treasure")!,
      id: "e2e-white-score-target",
      name: "白色计分目标",
      difficulty: 12,
    };
    const filler = {
      ...cards.buildTreasureDeck().find((card) => card.color === "R" && card.kind === "treasure")!,
      id: "e2e-seal-safe-filler",
      difficulty: 0,
    };
    window.__SYNTHESIS_SOLO_STORE__!.setState({
      ...game.createGame("seal-score-e2e"),
      hand: [seal, ...whiteBasics, blueBasic],
      treasureDeck: [whiteTarget, filler],
    });
  });

  const hand = page.getByRole("region", { name: "当前手牌" });
  for (let index = 0; index < 4; index += 1) {
    await hand.getByTestId(/hand-card|treasure-card/).nth(index).click();
  }
  await hand.getByRole("button", { name: "开始合成" }).click();

  const synthesis = page.getByRole("region", { name: "本次合成结算" });
  await expect(synthesis.getByText("总分 11", { exact: true })).toBeVisible();
  const target = page.getByTestId("treasure-card").filter({ hasText: "白色计分目标" });
  await expect(target).toHaveAttribute("data-resolution", "failed");
});

test("silver flask previews the next risk card before the player commits", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("active-seed")).toBeVisible();
  await page.waitForTimeout(100);
  await page.evaluate(async () => {
    const [game, cards] = await Promise.all([
      import(/* @vite-ignore */ "/src/game-core/game.ts"),
      import(/* @vite-ignore */ "/src/game-core/cards.ts"),
    ]);
    const useGameStore = window.__SYNTHESIS_SOLO_STORE__!;
    const silverFlask = cards.buildTreasureDeck().find((card) => card.name === "银壶")!;
    const redBasics = cards.buildBasicDeck().filter((card) => card.color === "R").slice(0, 3);
    const template = cards.buildTreasureDeck().find((card) => card.kind === "treasure")!;
    const fillers = [0, 1, 2].map((index) => ({ ...template, id: `e2e-safe-${index}`, difficulty: 0 }));
    const previewTarget = { ...template, id: "e2e-preview-target", name: "预览目标", difficulty: 99 };
    let state = {
      ...game.createGame("silver-flask-e2e"),
      hand: [silverFlask, ...redBasics],
      treasureDeck: [...fillers, previewTarget, cards.buildStagePromptCard()],
    };
    for (const card of state.hand) state = game.toggleMaterial(state, card.id);
    useGameStore.setState(state);
  });

  await expect(page.getByText("已选 4/4")).toBeVisible();
  await page.getByRole("button", { name: "开始合成" }).click();
  await page.getByRole("button", { name: "继续翻下一张" }).click();

  const preview = page.getByTestId("risk-preview");
  await expect(preview).toContainText("预览目标");
  await expect(preview).toContainText("难度 99");
  await expect(page.getByRole("region", { name: "本次翻开的宝物" }).getByTestId("treasure-card")).toHaveCount(3);

  await page.getByRole("button", { name: "不翻开并结束" }).click();
  await expect(preview).toHaveCount(0);
  expect(await page.evaluate(() => window.__SYNTHESIS_SOLO_STORE__!.getState().treasureDeck[0]?.id)).toBe("e2e-preview-target");
});

test("settings reloads CardData and restores it from IndexedDB", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "打开设置" }).click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("内置卡牌数据")).toBeVisible();

  await dialog.getByRole("button", { name: "重载 CardData.xlsm" }).click();
  await expect(dialog.getByRole("status")).toContainText("已重载 63 条定义，共 80 张卡牌");

  await dialog.getByRole("button", { name: "关闭设置" }).click();
  await page.evaluate(async () => {
    const cards = await import(/* @vite-ignore */ "/src/game-core/cards.ts");
    const store = window.__SYNTHESIS_SOLO_STORE__!;
    const treasure = cards.buildTreasureDeck(store.getState().cardDefinitions)[0];
    store.setState({ revealedTreasures: [treasure] });
  });
  const importedEffectNode = page.getByTestId("treasure-card").first().locator(".card-effect p");
  await importedEffectNode.scrollIntoViewIfNeeded();
  const importedEffect = await importedEffectNode.textContent();
  expect(importedEffect).not.toBeNull();
  expect(importedEffect!.trim().length).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole("button", { name: "打开设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" }).getByText("CardData.xlsm", { exact: true })).toBeVisible();
});

test("rare gemstone cards show their additional acquisition method below the effect", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("active-seed")).toBeVisible();
  await page.evaluate(async () => {
    const cards = await import(/* @vite-ignore */ "/src/game-core/cards.ts");
    const useGameStore = window.__SYNTHESIS_SOLO_STORE__!;
    const redGemstone = cards.buildTreasureDeck().find((card) => card.name === "红宝石")!;
    useGameStore.setState({ revealedTreasures: [{ ...redGemstone, resolution: "gained" }] });
  });

  const card = page.getByTestId("treasure-card").filter({ hasText: "红宝石" });
  const effect = card.locator(".card-effect > p");
  const additional = card.locator(".additional-acquire-method");
  await expect(effect).toHaveText("终局分数加3");
  await expect(additional).toContainText("额外获取");
  await expect(additional).toContainText("所有的卡都为红色");

  const [effectBox, additionalBox] = await Promise.all([effect.boundingBox(), additional.boundingBox()]);
  expect(effectBox).not.toBeNull();
  expect(additionalBox).not.toBeNull();
  expect(additionalBox!.y).toBeGreaterThan(effectBox!.y);
  expect(await card.locator(".card-effect").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
});
