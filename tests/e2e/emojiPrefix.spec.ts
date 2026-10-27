import { expect, test } from "@playwright/test";

import { login } from "./fixtures.js";

test("表情选择器只提供 Emoji 12.0 及更早，点选写入标题前缀", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "新建事件" }).click();
  const editor = page.getByRole("dialog", { name: "新建事件" });
  await editor.getByRole("button", { name: "选择表情" }).click();

  const grid = page.locator(".emoji-prefix-grid");
  await expect(grid).toBeVisible();
  const search = page.getByLabel("搜索表情，例如蛋糕");
  await search.fill("蛋糕");
  await page.getByRole("button", { name: "生日蛋糕", exact: true }).click();
  await expect(editor.getByLabel("标题前缀")).toHaveValue("🎂");

  await editor.getByRole("button", { name: "选择表情" }).click();
  await expect(search).toBeVisible();
  await search.fill("含泪");
  await expect(page.getByText("没有匹配的表情")).toBeVisible();
  await expect(page.getByRole("button", { name: "含泪的笑脸" })).toHaveCount(0);

  await search.fill("");
  await expect(grid).toBeVisible();
  const seen = new Set<string>();
  const row = grid.locator(".emoji-prefix-row").first();
  let previousTop = -1;
  for (let step = 0; step < 120; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- 虚拟列表只挂载当前屏，必须滚完再读下一屏
    for (const text of await grid.locator(".emoji-prefix-cell").allTextContents()) {
      seen.add(text);
    }

    // eslint-disable-next-line no-await-in-loop -- 同上，先记下当前行，再滚到下一屏
    const shift = (await row.getAttribute("style")) ?? "";
    // eslint-disable-next-line no-await-in-loop -- 同上
    const top = await grid.evaluate(node => {
      node.scrollTop += node.clientHeight;
      return node.scrollTop;
    });
    if (top === previousTop) {
      break;
    }

    previousTop = top;
    // eslint-disable-next-line no-await-in-loop -- 同上，等新的一行挂上再读，避免跳屏
    await expect.poll(async () => row.getAttribute("style")).not.toBe(shift);
  }

  expect(seen.has("🎂")).toBe(true);
  expect(seen.has("🥲")).toBe(false);
  expect(seen.has("🫠")).toBe(false);
});
