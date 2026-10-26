import { expect, type Locator, type Page, test } from "@playwright/test";

import { eventInput } from "../fixtures.js";
import { login, logout } from "./fixtures.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function useNewAccount(page: Page, username: string) {
  await login(page);
  await page.getByRole("tab", { name: "账号管理" }).click();
  await page.getByRole("button", { name: "新建账号" }).click();
  const dialog = page.getByRole("dialog", { name: "新建账号" });
  await dialog.getByLabel("用户名").fill(username);
  await dialog.getByLabel("显示名称").fill(username);
  await dialog.getByLabel("初始密码").fill(`${username}-password`);
  await dialog.getByRole("button", { name: "创 建" }).click();
  await expect(page.getByRole("cell", { name: `${username} ${username}` })).toBeVisible();
  await logout(page, "管理员");
  await login(page, username, `${username}-password`);
}

async function showHundredPerPage(page: Page, dialog: Locator) {
  await dialog.locator(".ant-pagination-options .ant-select").click();
  await page.getByTitle("100 条/页").click();
}

test("编辑含 150 个事件的订阅：跨页勾选后保存，再次编辑全部回显并勾选", async ({ page }) => {
  await useNewAccount(page, "picker");
  const events = Array.from({ length: 150 }, (_value, index) => ({
    id: uuid(index + 1),
    event: eventInput({ name: `事件${String(index + 1).padStart(3, "0")}` }),
  }));
  await page.getByRole("tab", { name: "备份" }).click();
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "timenote-backup", version: 3, exportedAt: new Date().toISOString(), events })
    ),
  });
  await page
    .getByRole("dialog")
    .filter({ hasText: "确认导入" })
    .getByRole("button", { name: /^导\s?入$/ })
    .click();
  await expect(page.getByText("导入完成：新增 150")).toBeVisible();

  await page.getByRole("tab", { name: "订阅" }).click();
  await page.getByRole("button", { name: "创建订阅地址" }).click();
  const create = page.getByRole("dialog", { name: "创建订阅地址" });
  await create.getByLabel("订阅名称").fill("全部手选");
  await create.getByText("仅所选事件").click();
  await showHundredPerPage(page, create);
  await expect(create.locator("tbody tr.ant-table-row")).toHaveCount(100);
  await create.locator("thead .ant-checkbox-input").check();
  await create.locator(".ant-pagination-next").click();
  await expect(create.locator("tbody tr.ant-table-row")).toHaveCount(50);
  await create.locator("thead .ant-checkbox-input").check();
  await expect(create.getByText("已选 150 项")).toBeVisible();
  await create.getByRole("button", { name: /^创\s?建$/ }).click();
  await expect(create).toBeHidden();
  await expect(page.getByRole("cell", { name: "已选 150" })).toBeVisible();

  await page.getByRole("button", { name: "编辑" }).click();
  const edit = page.getByRole("dialog", { name: "编辑订阅" });
  await expect(edit.getByText("已选 150 项")).toBeVisible();
  await edit.getByText("只看已选").click();
  await showHundredPerPage(page, edit);
  await expect(edit.locator("tbody tr.ant-table-row")).toHaveCount(100);
  await expect(edit.locator("tbody .ant-checkbox-input:checked")).toHaveCount(100);
  await edit.locator(".ant-pagination-next").click();
  await expect(edit.locator("tbody tr.ant-table-row")).toHaveCount(50);
  await expect(edit.locator("tbody .ant-checkbox-input:checked")).toHaveCount(50);
  await expect(edit.getByText(/个已选事件已被删除/)).toHaveCount(0);
});
