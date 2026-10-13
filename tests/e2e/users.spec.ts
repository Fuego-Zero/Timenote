import { expect, type Page, test } from "@playwright/test";

import { login } from "./fixtures.js";

async function createUser(page: Page, username: string) {
  await page.getByRole("button", { name: "新建账号" }).click();
  const dialog = page.getByRole("dialog", { name: "新建账号" });
  await dialog.getByLabel("用户名").fill(username);
  await dialog.getByLabel("显示名称").fill(username);
  await dialog.getByLabel("初始密码").fill(`${username}-password`);
  await dialog.getByRole("button", { name: "创 建" }).click();
  await expect(dialog).toBeHidden();
}

test("账号列表服务端分页；停用和改角色先确认，操作后停留在当前页", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") {
      warnings.push(message.text());
    }
  });
  await login(page);
  await page.getByRole("tab", { name: "账号管理" }).click();
  for (const username of ["ops-a", "ops-b", "ops-c"]) {
    // eslint-disable-next-line no-await-in-loop -- 依次创建，得到确定的创建时间顺序
    await createUser(page, username);
  }

  await page.goto("/?tab=users&q=ops-&pageSize=2&page=2");
  const rows = page.locator("tbody tr.ant-table-row");
  await expect(rows).toHaveCount(1);
  const row = rows.filter({ hasText: "ops-a" });
  await expect(row).toBeVisible();

  // 取消确认时不改动。
  await row.getByRole("button", { name: "停 用" }).click();
  const disableConfirm = page.locator(".ant-popover").filter({ hasText: "登录与订阅立即失效" });
  await disableConfirm.getByRole("button", { name: /^取\s?消$/ }).click();
  await expect(row.getByText("启用", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "停 用" }).click();
  await disableConfirm.getByRole("button", { name: /^确\s?定$/ }).click();
  await expect(row.getByText("已停用")).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(1);

  await row.getByRole("button", { name: "设为管理员" }).click();
  await page
    .locator(".ant-popover")
    .filter({ hasText: "该账号将可以管理所有账号" })
    .getByRole("button", { name: /^确\s?定$/ })
    .click();
  await expect(row.getByText("管理员", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows.filter({ hasText: "ops-a" })).toHaveCount(1);

  // 清理：删除后本页为空，退回第 1 页。
  await row.getByRole("button", { name: "删 除" }).click();
  await page
    .locator(".ant-popover")
    .filter({ hasText: "无法恢复" })
    .getByRole("button", { name: /^删\s?除$/ })
    .click();
  await expect(page).not.toHaveURL(/page=2/);
  await expect(rows).toHaveCount(2);

  expect(warnings.filter(text => /deprecated/i.test(text) && !/Spin|maskClosable/.test(text))).toEqual([]);
});
