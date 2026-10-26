import { expect, type Page, test } from "@playwright/test";

import { eventInput } from "../fixtures.js";
import { login, logout } from "./fixtures.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function importEvents(page: Page, events: { id: string; event: ReturnType<typeof eventInput> }[]) {
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
  await expect(page.getByText(`导入完成：新增 ${events.length}`)).toBeVisible();
}

test("事件列表：分页与筛选同步到地址栏，刷新还原；删掉末页最后一条退回上一页；无弃用警告", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: "账号管理" }).click();
  await page.getByRole("button", { name: "新建账号" }).click();
  const dialog = page.getByRole("dialog", { name: "新建账号" });
  await dialog.getByLabel("用户名").fill("lister");
  await dialog.getByLabel("显示名称").fill("Lister");
  await dialog.getByLabel("初始密码").fill("lister-password");
  await dialog.getByRole("button", { name: "创 建" }).click();
  await expect(page.getByRole("cell", { name: "lister Lister" })).toBeVisible();
  await logout(page, "管理员");
  await login(page, "lister", "lister-password");
  await importEvents(page, [
    ...Array.from({ length: 20 }, (_value, index) => ({
      id: uuid(index + 1),
      event: eventInput({ name: `事件${String(index + 1).padStart(2, "0")}` }),
    })),
    {
      id: uuid(0),
      event: eventInput({ kind: "anniversary", name: "结婚", titleTemplate: "{{name}} {{years}} 周年" }),
    },
  ]);

  const warnings: string[] = [];
  page.on("console", message => {
    if (/deprecated/i.test(message.text())) {
      warnings.push(message.text());
    }
  });
  const rows = page.locator(".ant-table-tbody tr.ant-table-row");

  await page.goto("/?tab=events&pageSize=10&page=3");
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole("listitem", { name: "3" })).toHaveClass(/ant-pagination-item-active/);

  await rows.first().getByRole("button", { name: "删除" }).click();
  await page
    .locator(".ant-popconfirm")
    .getByRole("button", { name: /^删\s?除$/ })
    .click();
  await expect(rows).toHaveCount(10);
  await expect(page).toHaveURL(/page=2/);

  await page.getByRole("columnheader", { name: /类型/ }).locator(".ant-table-filter-trigger").click();
  await page.locator(".ant-table-filter-dropdown").getByText("纪念日").click();
  await page
    .locator(".ant-table-filter-dropdown")
    .getByRole("button", { name: /确\s?定|OK/ })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(page).toHaveURL(/kind=anniversary/);
  await expect(page).not.toHaveURL(/page=/);

  await page.getByLabel("搜索事件").fill("结");
  await expect(page).toHaveURL(/q=%E7%BB%93/);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(page.getByLabel("搜索事件")).toHaveValue("结");
  await expect(page.getByRole("heading", { name: /结婚 \d+ 周年/ })).toBeVisible();

  await page.goto("/?tab=events&page=abc&pageSize=999&sort=nextOccurrence");
  await expect(rows).toHaveCount(20);
  await expect(page.getByLabel("排序")).toBeVisible();
  await expect(page.locator(".ant-select").filter({ hasText: "下次发生" })).toBeVisible();
  // Modal 的 maskClosable 仍是既有弃用警告，单独排除；本页组件不应再产生其他弃用警告。
  expect(warnings.filter(text => !/maskClosable/.test(text))).toEqual([]);
});
