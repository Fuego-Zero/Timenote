import { expect, test } from "@playwright/test";

import { login, logout, pickOption, watchCsp } from "./fixtures.js";

test("管理员建号，新账号新建农历生日、预览并通过订阅地址拿到 ICS", async ({ page, request }) => {
  const violations = watchCsp(page);
  await login(page);
  await expect(page).toHaveTitle("岁时记 Timenote");
  const banner = page.getByRole("banner");
  await expect(banner).toContainText("岁时记");
  await expect(banner).not.toContainText("Timenote");

  await page.getByRole("tab", { name: "账号管理" }).click();
  await page.getByRole("button", { name: "新建账号" }).click();
  const dialog = page.getByRole("dialog", { name: "新建账号" });
  await dialog.getByLabel("用户名").fill("alice");
  await dialog.getByLabel("显示名称").fill("Alice");
  await dialog.getByLabel("初始密码").fill("alice-password");
  await dialog.getByRole("button", { name: "创 建" }).click();
  await expect(page.getByRole("cell", { name: "alice Alice" })).toBeVisible();
  await logout(page, "管理员");

  await login(page, "alice", "alice-password");
  await expect(page.getByRole("tab", { name: "账号管理" })).toHaveCount(0);

  await page.getByRole("button", { name: "新建事件" }).click();
  const editor = page.getByRole("dialog", { name: "新建事件" });
  await editor.getByLabel("名称").fill("小明");
  await editor.getByText("农历", { exact: true }).click();
  await expect(editor.getByText(/已把公历 .* 换算为农历/)).toBeVisible();
  await editor.getByLabel("农历年").fill("1990");
  await pickOption(page, editor.getByLabel("月", { exact: true }), "腊月");
  await pickOption(page, editor.getByLabel("日", { exact: true }), "廿九");

  const preview = editor.getByLabel("发生日预览");
  await expect(preview.getByRole("listitem")).toHaveCount(5);
  await expect(preview.getByRole("listitem").first()).toContainText("小明");
  await expect(preview.getByRole("listitem").first()).toContainText("农历");
  await editor.getByRole("button", { name: "保 存" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("heading", { name: /小明 \d+ 岁生日/ })).toBeVisible();

  await page.getByRole("tab", { name: "订阅" }).click();
  await page.getByRole("button", { name: "创建订阅地址" }).click();
  await page
    .getByRole("dialog", { name: "创建订阅地址" })
    .getByRole("button", { name: /^创\s?建$/ })
    .click();
  const calendarLink = page.getByRole("link", { name: "日历打开" });
  // 「日历打开」是 webcal 链接，换回 http 后与复制地址一致（只替换协议）（同由 feedTokenService 生成）。
  const feedUrl = async () => ((await calendarLink.getAttribute("href")) ?? "").replace(/^webcal:/, "http:");
  const url = await feedUrl();
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:4183\/api\/feeds\/[\w-]{43}\.ics$/);
  expect(url).not.toMatch(/1990|小明|alice/);
  await page.reload();
  await page.getByRole("tab", { name: "订阅" }).click();
  await expect(calendarLink).toBeVisible();
  expect(await feedUrl()).toBe(url);

  const feed = await request.get(url);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["cache-control"]).toBe("private, no-cache");
  const body = await feed.text();
  expect(body).toContain("X-WR-CALNAME:Alice的纪念日");
  expect(body).toMatch(/SUMMARY:🎂 小明 \d+ 岁生日/);

  await page.getByRole("button", { name: "撤销" }).click();
  await page
    .locator(".ant-popconfirm")
    .getByRole("button", { name: /^撤\s?销$/ })
    .click();
  await expect.poll(async () => (await request.get(url)).status()).toBe(404);
  expect(violations).toEqual([]);
});

test("手机宽度下编辑抽屉全屏，跨天普通事件预览起止日期", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "新建事件" }).click();
  const editor = page.getByRole("dialog", { name: "新建事件" });
  await editor.getByText("普通事件", { exact: true }).click();
  await editor.getByLabel("名称").fill("国庆旅行");
  const startDate = editor.getByLabel("日期", { exact: true });
  await startDate.fill("2026-10-01");
  await startDate.press("Enter");
  const endDate = editor.getByLabel("最后一天");
  await endDate.fill("2026-10-07");
  await endDate.press("Enter");
  await expect(editor.getByText("共 7 天")).toBeVisible();
  await expect(editor.getByLabel("发生日预览")).toContainText("2026年10月1日 周四 至 2026年10月7日 周三");

  const box = await page.locator(".ant-drawer-content-wrapper").boundingBox();
  expect(box?.width).toBe(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: ".tmp/screenshots/mobile-editor.png", fullPage: true });
});

test("无效输入在保存前定位到字段，不发请求", async ({ page }) => {
  await login(page);
  let posts = 0;
  page.on("request", r => {
    if (r.method() === "POST" && r.url().endsWith("/api/events")) {
      posts += 1;
    }
  });
  await page.getByRole("button", { name: "新建事件" }).click();
  const editor = page.getByRole("dialog", { name: "新建事件" });
  await editor.getByLabel("标题模板").fill("{{name}} {{age}}");
  await expect(editor.getByText("填写完整且无误后显示预览")).toBeVisible();
  await editor.getByRole("button", { name: "保 存" }).click();
  await expect(editor.getByText("请填写名称")).toBeVisible();
  await expect(editor.getByText("模板只支持 {{name}} 与 {{years}}")).toBeVisible();
  expect(posts).toBe(0);
});
