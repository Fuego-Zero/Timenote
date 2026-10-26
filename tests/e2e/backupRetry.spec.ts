import { expect, test } from "@playwright/test";

import { eventInput } from "../fixtures.js";
import { login } from "./fixtures.js";

test("导入失败时确认框保持打开，可直接重试", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: "备份" }).click();
  const events = [{ id: "00000000-0000-4000-8000-0000000b0002", event: eventInput({ name: "导入重试事件" }) }];
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "timenote-backup", version: 3, exportedAt: new Date().toISOString(), events })
    ),
  });
  const dialog = page.getByRole("dialog").filter({ hasText: "确认导入" });
  await expect(dialog.getByText("将新增 1、覆盖 0 个事件")).toBeVisible();

  // 只让实际导入失败一次，预览不受影响。
  let failed = false;
  await page.route("**/api/backup", async route => {
    if (route.request().method() === "POST" && !failed) {
      failed = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "INTERNAL_ERROR" }),
      });
      return;
    }

    await route.fallback();
  });
  await dialog.getByRole("button", { name: /^导\s?入$/ }).click();
  await expect(page.getByText("服务暂时不可用")).toBeVisible();
  await expect(dialog).toBeVisible();
  // 按钮的 loading 图标在退场动画结束前仍计入可访问名称，这里按主按钮定位。
  const ok = dialog.locator(".ant-btn-primary");
  await expect(ok).not.toHaveClass(/ant-btn-loading/);

  await ok.click();
  await expect(page.getByText("导入完成：新增 1，更新 0")).toBeVisible();
  await expect(dialog).toBeHidden();
});
