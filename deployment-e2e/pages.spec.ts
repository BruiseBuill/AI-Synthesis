import { expect, test } from "@playwright/test";

test("production build works from the GitHub Pages repository path", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByTestId("hand-card")).toHaveCount(6);

  const assetPaths = await page.locator('script[src], link[rel="stylesheet"][href]').evaluateAll((elements) =>
    elements.map((element) => {
      const attribute = element.tagName === "SCRIPT" ? "src" : "href";
      return new URL(element.getAttribute(attribute)!, document.baseURI).pathname;
    }),
  );
  expect(assetPaths.length).toBeGreaterThan(0);
  expect(assetPaths.every((path) => path.startsWith("/AI-Synthesis/assets/"))).toBe(true);

  const workbookResponse = await page.request.get(new URL("CardData.xlsm", page.url()).href);
  expect(workbookResponse.ok()).toBe(true);
  expect((await workbookResponse.body()).byteLength).toBeGreaterThan(0);
});
