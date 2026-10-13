import { expect, type Page, test } from "@playwright/test";

import { login, logout, pickOption } from "./fixtures.js";

async function asNewUser(page: Page, username: string) {
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

async function newAnniversary(page: Page, name: string) {
  // 测试环境下 antd 的 id 固定为 test-id，列表有内容后抽屉的可访问名称会指错，按标题文字定位。
  const editor = page.getByRole("dialog").filter({ hasText: "新建事件" });
  await expect(editor).toHaveCount(0);
  await page.getByRole("button", { name: "新建事件" }).click();
  await expect(editor).toBeVisible();
  await editor.getByText("纪念日", { exact: true }).click();
  await editor.getByLabel("名称").fill(name);
  return editor;
}

test("纪念日重复规则：自定义间隔、三种结束条件、里程碑预设与自定义天数都能保存，预览随设置更新", async ({ page }) => {
  await asNewUser(page, "recur");

  const editor = await newAnniversary(page, "恋爱");
  const preview = editor.getByLabel("发生日预览");
  await pickOption(page, editor.getByLabel("重复", { exact: true }), "自定义");
  await editor.getByLabel("间隔", { exact: true }).fill("3");
  await pickOption(page, editor.getByLabel("间隔单位"), "周");
  await expect(preview.getByRole("listitem").first()).toContainText("恋爱第 1 次");
  await editor.getByText("共 N 个周期").click();
  await editor.getByLabel("周期数").fill("6");
  await editor.getByText("520 天").click();
  const custom = editor.getByLabel("自定义里程碑天数");
  await custom.click();
  await custom.pressSequentially("77");
  await custom.press("Enter");
  await expect(preview).toContainText("恋爱第 77 天");
  await editor.getByRole("button", { name: "保 存" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("每 3 周 · 共 6 个周期")).toBeVisible();
  await expect(page.getByText("+2 个里程碑")).toBeVisible();

  const monthly = await newAnniversary(page, "每月");
  await pickOption(page, monthly.getByLabel("重复", { exact: true }), "每月");
  await monthly.getByText("截止到").click();
  await monthly.getByLabel("截止日期").fill("2099-12-31");
  await monthly.getByLabel("截止日期").press("Enter");
  await monthly.getByRole("button", { name: "保 存" }).click();
  await expect(monthly).toBeHidden();
  await expect(page.getByText("每月 · 至 2099-12-31")).toBeVisible();

  const weekly = await newAnniversary(page, "每周");
  await pickOption(page, weekly.getByLabel("重复", { exact: true }), "每周");
  await weekly.getByText("永不").click();
  await weekly.getByRole("button", { name: "保 存" }).click();
  await expect(weekly).toBeHidden();
  await expect(page.getByText("每周", { exact: true })).toBeVisible();
});

test("纪念日改成农历时非按年选项置灰，原来按月的规则自动改回每年并提示", async ({ page }) => {
  await asNewUser(page, "lunarrecur");
  const editor = await newAnniversary(page, "农历纪念");
  const repeat = editor.getByLabel("重复", { exact: true });
  await pickOption(page, repeat, "每月");
  await editor.getByText("农历", { exact: true }).click();
  await expect(page.getByText("农历或年份未知时只能按年重复，已改回每年")).toBeVisible();
  await expect(editor.getByText("农历日期只能按年重复")).toBeVisible();
  await expect(
    editor.locator(".ant-select-content, .ant-select-selection-item").filter({ hasText: "每年" }).first()
  ).toBeVisible();
  await repeat.click();
  await expect(page.locator(".ant-select-item-option-disabled").filter({ hasText: "每月" })).toBeVisible();
});
