import { expect, type Page, test } from "@playwright/test";

import { login, logout, watchCsp } from "./fixtures.js";

const checklistName = "开始使用岁时记";

/** 以管理员身份建一个普通账号并登录，每个用例从「没有任何数据」开始。 */
async function loginAsNewUser(page: Page, username: string) {
  await login(page);
  await page.getByRole("tab", { name: "账号管理" }).click();
  await page.getByRole("button", { name: "新建账号" }).click();
  const dialog = page.getByRole("dialog", { name: "新建账号" });
  await dialog.getByLabel("用户名").fill(username);
  await dialog.getByLabel("显示名称").fill(username);
  await dialog.getByLabel("初始密码").fill(`${username}-password`);
  await dialog.getByRole("button", { name: "创 建" }).click();
  await expect(dialog).toBeHidden();
  await logout(page, "管理员");
  await login(page, username, `${username}-password`);
}

function checklist(page: Page) {
  return page.getByRole("region", { name: checklistName });
}

function tourStep(page: Page) {
  return page.locator(".ant-tour:visible");
}

async function expectStep(page: Page, title: string) {
  await expect(tourStep(page).locator(".ant-tour-title")).toHaveText(title);
}

async function next(page: Page) {
  await tourStep(page)
    .getByRole("button", { name: /^(下一步|完\s?成)$/ })
    .click();
}

/** 新用户登录后两段引导会自动开始，等第一段出现。 */
async function expectAutoTour(page: Page) {
  await expect(checklist(page)).toBeVisible();
  await expectStep(page, "添加第一个事件");
}

/** 第一段：每个需要操作的地方都由测试像用户一样亲自点击、输入。 */
async function runEventTour(page: Page, name: string) {
  if (!(await tourStep(page).isVisible())) {
    await checklist(page).getByRole("button", { name: "带我做" }).first().click();
  }

  await expectStep(page, "添加第一个事件");
  await expect(tourStep(page).getByRole("button", { name: "下一步" })).toHaveCount(0);
  await page.getByRole("button", { name: "新建事件" }).click();
  await expectStep(page, "选择类型，填写名称");
  const editor = page.getByRole("dialog", { name: "新建事件" });
  // 弹窗内不盖遮罩，高亮框要露在抽屉上面，并包住类型和名称。
  const highlight = page.locator(".ant-tour-target-placeholder");
  // 抽屉进场动画期间高亮框还在滑动，等到它包住类型和名称、并盖在抽屉之上。
  await expect
    .poll(() =>
      highlight.evaluate(node => {
        const ring = node.getBoundingClientRect();
        const target = document.querySelector("[data-guide='event-kind']")?.getBoundingClientRect();
        const drawer = document.querySelector(".ant-drawer");
        if (!target || !drawer || ring.width < 10) {
          return false;
        }

        const aboveDrawer = Number(getComputedStyle(node).zIndex) > Number(getComputedStyle(drawer).zIndex);
        return (
          aboveDrawer &&
          ring.left <= target.left + 2 &&
          ring.top <= target.top + 2 &&
          ring.right >= target.right - 2 &&
          ring.bottom >= target.bottom - 2
        );
      })
    )
    .toBe(true);
  // 真实指针点击：抽屉内的步骤不能用遮罩挡住表单。
  await editor.getByLabel("名称").click();
  await page.keyboard.type(name);
  for (const title of ["填写原始日期", "核对预览", "需要提醒就打开", "保存"]) {
    // eslint-disable-next-line no-await-in-loop -- 引导步骤必须按顺序前进
    await next(page);
    // eslint-disable-next-line no-await-in-loop -- 同上
    await expectStep(page, title);
  }

  await editor.getByRole("button", { name: "保 存" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("第一个事件已添加")).toBeVisible();
  await expect(checklist(page).getByRole("button", { name: "再看一遍" })).toHaveCount(1);
}

test("首次进入显示清单；不再显示后刷新也不出现；可从帮助重新打开", async ({ page }) => {
  await loginAsNewUser(page, "guide-skip");
  await expectAutoTour(page);
  await expect(checklist(page)).not.toContainText("你是管理员");
  await page.keyboard.press("Escape");
  await expect(tourStep(page)).toHaveCount(0);
  // 关掉自动引导后，清单留在页面流内，不弹遮罩。
  await expect(page.locator(".ant-tour-mask")).toHaveCount(0);

  await checklist(page).getByRole("button", { name: "不再显示" }).click();
  await expect(checklist(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab", { name: "事件" })).toBeVisible();
  await expect(checklist(page)).toHaveCount(0);
  await expect(tourStep(page)).toHaveCount(0);

  const helpButton = page.getByRole("button", { name: /^帮\s?助$/ });
  await helpButton.click();
  const help = page.getByRole("dialog", { name: "使用帮助" });
  await expect(help.getByRole("heading", { name: "岁时记是什么" })).toBeVisible();
  await expect(help.getByRole("heading", { name: "常见问题" })).toBeVisible();
  await help.getByRole("button", { name: "重新显示「开始使用」" }).click();
  await expect(checklist(page)).toBeVisible();
  await expect(help.getByRole("button", { name: "添加第一个事件" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  await expect(helpButton).toBeFocused();

  await page.reload();
  await expect(checklist(page)).toBeVisible();
  await expect(tourStep(page)).toHaveCount(0);
});

test("由用户操作走完两段引导；日历拉取订阅后清单全部完成", async ({ page, request }) => {
  const violations = watchCsp(page);
  const warnings: string[] = [];
  page.on("console", message => {
    // 事件预览沿用的 antd List 自带弃用警告，与引导无关。
    // rc-tour 在高亮框和说明卡片先后挂到页面上的同一瞬间会误报 shadow root，刷新后不再出现。
    const text = message.text();
    if (
      (message.type() === "warning" || message.type() === "error") &&
      !text.includes("[antd: List]") &&
      !text.includes("same shadow root")
    ) {
      warnings.push(text);
    }
  });
  await loginAsNewUser(page, "guide-full");
  await expectAutoTour(page);
  await runEventTour(page, "小明");
  await expect(page.getByRole("heading", { name: /小明 \d+ 岁生日/ })).toBeVisible();

  // 第一段完成后自动开始第二段。
  await expectStep(page, "放进日历");
  await page.getByRole("tab", { name: "订阅" }).click();
  await expectStep(page, "创建订阅地址");
  await page.getByRole("button", { name: "创建订阅地址" }).click();
  await expectStep(page, "填写并创建");
  await page
    .getByRole("dialog", { name: "创建订阅地址" })
    .getByRole("button", { name: /^创\s?建$/ })
    .click();
  await expectStep(page, "添加到日历 App");
  // 引导只说明，不会替用户打开 webcal 或复制地址。
  expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:4183\//);
  await next(page);
  await expectStep(page, "确认订阅成功");
  await next(page);
  await expect(tourStep(page)).toHaveCount(0);
  await expect(page.getByText("引导完成。")).toBeVisible();
  await expect(checklist(page)).toContainText("日历第一次拉取订阅后");

  // 用日历客户端的方式拉取一次订阅；回到网页时清单自动打勾。
  const href = await page.getByRole("link", { name: "日历打开" }).getAttribute("href");
  const feed = await request.get((href ?? "").replace(/^webcal:/, "http:"));
  expect(feed.status()).toBe(200);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const done = page.getByRole("alert").filter({ hasText: "都设置好了" });
  await expect(done).toBeVisible();
  await expect(checklist(page)).toHaveCount(0);
  await done.getByRole("button", { name: /close|关闭/i }).click();
  await expect(done).toBeHidden();
  await page.reload();
  await expect(page.getByRole("tab", { name: "事件" })).toBeVisible();
  await expect(done).toHaveCount(0);

  expect(violations).toEqual([]);
  expect(warnings).toEqual([]);
});

test("中途关闭表单会暂停并撤掉遮罩；可以继续；Esc 关闭后焦点回到入口", async ({ page }) => {
  await loginAsNewUser(page, "guide-pause");
  await expectAutoTour(page);
  await page.keyboard.press("Escape");
  const start = checklist(page).getByRole("button", { name: "带我做" }).first();
  await start.click();
  await expectStep(page, "添加第一个事件");
  await page.getByRole("button", { name: "新建事件" }).click();
  await expectStep(page, "选择类型，填写名称");
  await page
    .getByRole("dialog", { name: "新建事件" })
    .getByRole("button", { name: /^取\s?消$/ })
    .click();
  await expect(page.getByText("引导已暂停")).toBeVisible();
  await expect(tourStep(page)).toHaveCount(0);
  await expect(page.locator(".ant-tour-mask:visible")).toHaveCount(0);
  // 暂停后页面照常可用。
  await page.getByRole("tab", { name: "订阅" }).click();
  await expect(page.getByRole("button", { name: "创建订阅地址" })).toBeVisible();

  const resume = checklist(page).getByRole("button", { name: "继续" });
  await resume.click();
  await expect(page.getByRole("tab", { name: "事件", selected: true })).toBeVisible();
  await expectStep(page, "添加第一个事件");
  await page.keyboard.press("Escape");
  await expect(tourStep(page)).toHaveCount(0);
  await expect(page.locator(".ant-tour-mask:visible")).toHaveCount(0);
  await expect(checklist(page).getByRole("button", { name: "带我做" }).first()).toBeFocused();
});

test("订阅页的「如何添加到日历」直接打开帮助里的客户端步骤", async ({ page }) => {
  await loginAsNewUser(page, "guide-help");
  await expectAutoTour(page);
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "订阅" }).click();
  await page.getByRole("button", { name: "如何添加到日历？" }).click();
  const help = page.getByRole("dialog", { name: "使用帮助" });
  await expect(help.getByRole("heading", { name: "添加到日历 App" })).toBeInViewport();
  await expect(help.getByText("添加订阅日历", { exact: false })).toBeVisible();
  const official = help.getByRole("link", { name: "官方帮助" }).first();
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(official).toHaveAttribute("rel", "noopener noreferrer");
  const screenshots = help.getByRole("img", { name: /^(事件编辑抽屉|订阅页)/ });
  await expect(screenshots).toHaveCount(2);
  await expect
    .poll(() => screenshots.evaluateAll(images => images.map(image => (image as HTMLImageElement).naturalWidth > 0)))
    .toEqual([true, true]);

  // 从帮助开始引导：先关掉抽屉，再切回事件页开始。
  await help.getByRole("button", { name: "添加第一个事件" }).click();
  await expect(help).toBeHidden();
  await expect(page.getByRole("tab", { name: "事件", selected: true })).toBeVisible();
  await expectStep(page, "添加第一个事件");
});

test("手机宽度、减少动态效果时同样能走完第一段", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginAsNewUser(page, "guide-mobile");
  await expectAutoTour(page);
  await expect(page.locator(".ant-tour-mask:visible")).toHaveCount(1);
  await expect(page.locator(".ant-tour-placeholder-animated")).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape");
  await runEventTour(page, "小红");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
