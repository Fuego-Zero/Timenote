import { expect, type Page, test } from "@playwright/test";

import { eventInput } from "../fixtures.js";
import { login } from "./fixtures.js";

const id = "00000000-0000-4000-8000-0000000b0001";

async function pickBackup(page: Page) {
  const events = [{ id, event: eventInput({ name: "预览确认事件" }) }];
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "timenote-backup", version: 3, exportedAt: new Date().toISOString(), events })
    ),
  });
  const dialog = page.getByRole("dialog").filter({ hasText: "确认导入" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("导入前先预览数量，取消时不写库，确认后才导入（任务 14）", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") {
      warnings.push(message.text());
    }
  });
  await login(page);
  await page.getByRole("tab", { name: "备份" }).click();

  const cancelled = await pickBackup(page);
  await expect(cancelled.getByText("将新增 1、覆盖 0 个事件")).toBeVisible();
  await cancelled.getByRole("button", { name: /^取\s?消$/ }).click();
  await expect(cancelled).toBeHidden();
  await page.getByRole("tab", { name: "事件" }).click();
  await expect(page.getByText("预览确认事件")).toHaveCount(0);

  await page.getByRole("tab", { name: "备份" }).click();
  const confirmed = await pickBackup(page);
  await confirmed.getByRole("button", { name: /^导\s?入$/ }).click();
  await expect(page.getByText("导入完成：新增 1，更新 0")).toBeVisible();
  await page.getByRole("tab", { name: "事件" }).click();
  await expect(page.getByText("预览确认事件")).toBeVisible();

  await page.getByRole("tab", { name: "备份" }).click();
  const again = await pickBackup(page);
  await expect(again.getByText("将新增 0、覆盖 1 个事件")).toBeVisible();
  await again.getByRole("button", { name: /^取\s?消$/ }).click();

  expect(warnings.filter(text => /deprecated/i.test(text) && !/maskClosable/.test(text))).toEqual([]);
});
