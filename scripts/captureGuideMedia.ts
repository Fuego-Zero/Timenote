/**
 * 生成 README 与帮助抽屉用的真实截图和录屏：pnpm media:guide。
 * 每种语言各起一个隔离实例（.tmp 下临时 SQLite、独立端口），用虚构账号和数据走真实界面；
 * 结束后停止实例，临时数据留在 .tmp/guide-media/ 供排查，下次运行前清空。
 */
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line import-x/no-extraneous-dependencies -- 素材脚本只在开发机手动运行，Playwright 只进 devDependencies。
import { type Browser, chromium, expect, type Locator, type Page } from "@playwright/test";

import {
  type MediaAccount,
  type MediaLanguage,
  type MediaScript,
  mediaScripts,
  showcaseBackup,
  uiCopy,
} from "./guide-media/mediaFixtures.js";
import { startMediaInstance } from "./guide-media/mediaInstance.js";
import {
  annotate,
  caption,
  clearOverlay,
  clickVisibly,
  pointAt,
  prepareMediaContext,
} from "./guide-media/mediaOverlay.js";

const password = "media-demo-password";
const desktop = { width: 1440, height: 900 };
const videoSize = { width: 1280, height: 800 };
const ports: Record<MediaLanguage, number> = { "zh-CN": 4320, en: 4330 };

type Copy = (typeof uiCopy)[MediaLanguage];

/** antd 会在两个汉字的按钮文字中间插入空格。 */
function buttonName(text: string) {
  return /^\p{Script=Han}{2}$/u.test(text) ? new RegExp(`^${text[0]}\\s?${text[1]}$`, "u") : text;
}

function pause(page: Page, ms: number) {
  return page.waitForTimeout(ms);
}

class Capture {
  readonly copy: Copy;
  readonly docsDir: string;
  readonly appDir: string;

  constructor(
    readonly browser: Browser,
    readonly origin: string,
    readonly language: MediaLanguage,
    readonly script: MediaScript
  ) {
    this.copy = uiCopy[language];
    this.docsDir = join("docs", "media", language);
    this.appDir = join("apps", "web", "src", "features", "guide", "media", language);
    mkdirSync(this.docsDir, { recursive: true });
    mkdirSync(this.appDir, { recursive: true });
  }

  async newContext(options: Parameters<Browser["newContext"]>[0] = {}) {
    const context = await this.browser.newContext({
      baseURL: this.origin,
      locale: this.script.browserLocale,
      timezoneId: this.script.timeZone,
      viewport: desktop,
      bypassCSP: true,
      ...options,
    });
    await prepareMediaContext(context);
    return context;
  }

  async login(page: Page, account: MediaAccount) {
    const { login } = this.copy.auth;
    await page.goto("/");
    await page.getByLabel(login.username).fill(account.username);
    await page.getByLabel(login.password).fill(password);
    await page.getByRole("button", { name: buttonName(login.submit) }).click();
    await expect(page.getByRole("tab", { name: this.copy.common.nav.events })).toBeVisible();
  }

  async logout(page: Page, account: MediaAccount) {
    await page.getByRole("banner").getByRole("button", { name: account.displayName, exact: true }).click();
    await page.getByText(this.copy.common.nav.logout).click();
    await expect(page.getByLabel(this.copy.auth.login.username)).toBeVisible();
  }

  /** 已登录的会话，交给录屏上下文，录像不必从登录页开始。 */
  async session(account: MediaAccount) {
    const context = await this.newContext();
    const page = await context.newPage();
    await this.login(page, account);
    const state = await context.storageState();
    await context.close();
    return state;
  }

  async screenshot(page: Page, name: string) {
    await page.screenshot({ path: join(this.docsDir, `${name}.png`) });
  }

  async setupAccounts() {
    const context = await this.newContext();
    const page = await context.newPage();
    const { setup } = this.copy.auth;
    await page.goto("/");
    await expect(page.getByRole("heading", { name: setup.title })).toBeVisible();
    await page.getByLabel(setup.username).fill(this.script.admin.username);
    await page.getByLabel(setup.displayName).fill(this.script.admin.displayName);
    await page.getByLabel(setup.password).fill(password);
    await page.getByRole("button", { name: buttonName(setup.submit) }).click();
    await page.getByRole("tab", { name: this.copy.common.nav.users }).click();
    for (const account of [this.script.showcase, this.script.firstRun, this.script.flow]) {
      // eslint-disable-next-line no-await-in-loop -- 依次在同一个弹窗里建号
      await this.createAccount(page, account);
    }

    await this.logout(page, this.script.admin);
    await context.close();
  }

  async createAccount(page: Page, account: MediaAccount) {
    const { form } = this.copy.admin;
    await page.getByRole("button", { name: this.copy.admin.create }).click();
    const dialog = page.getByRole("dialog", { name: form.title });
    await dialog.getByLabel(form.username).fill(account.username);
    await dialog.getByLabel(form.displayName).fill(account.displayName);
    await dialog.getByLabel(form.password).fill(password);
    await dialog.getByRole("button", { name: buttonName(this.copy.common.create) }).click();
    await expect(dialog).toBeHidden();
  }

  async createFeed(page: Page, visible = false) {
    const click = (target: Locator) => (visible ? clickVisibly(page, target) : target.click());
    await click(page.getByRole("tab", { name: this.copy.common.nav.feeds }));
    await click(page.getByRole("button", { name: this.copy.feeds.create }));
    const dialog = page.getByRole("dialog", { name: this.copy.feeds.create });
    await expect(dialog).toBeVisible();
    if (visible) {
      await pause(page, 1500);
    }

    await click(dialog.getByRole("button", { name: buttonName(this.copy.common.create) }));
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: this.copy.feeds.openCalendar })).toBeVisible();
  }

  /** 像日历客户端一样拉取一次订阅地址，服务端据此记录「最近拉取」。 */
  async fetchFeedLikeCalendar(page: Page) {
    const href = await page.getByRole("link", { name: this.copy.feeds.openCalendar }).getAttribute("href");
    const response = await fetch((href ?? "").replace(/^webcal:/, "http:"));
    if (!response.ok) {
      throw new Error(`订阅拉取失败：${response.status}`);
    }

    await response.text();
  }

  async reopenFeeds(page: Page) {
    await page.getByRole("tab", { name: this.copy.common.nav.events }).click();
    await page.getByRole("tab", { name: this.copy.common.nav.feeds }).click();
    await expect(page.locator('[data-guide="feed-actions"]')).toBeVisible();
  }

  /** 展示账号：导入虚构事件、建一个订阅并拉取一次，然后拍列表、编辑器、订阅、帮助和手机截图。 */
  async showcaseScenes() {
    const context = await this.newContext();
    const page = await context.newPage();
    await this.login(page, this.script.showcase);
    await page.getByRole("tab", { name: this.copy.common.nav.backup }).click();
    await page.getByLabel(this.copy.backup.pickFile).setInputFiles({
      name: "timenote-media.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(showcaseBackup(this.language))),
    });
    const confirm = page.getByRole("dialog").filter({ hasText: this.copy.backup.confirmTitle });
    await confirm.getByRole("button", { name: buttonName(this.copy.backup.importOk) }).click();
    await expect(confirm).toBeHidden();

    await this.createFeed(page);
    await this.fetchFeedLikeCalendar(page);
    await page.goto("/?tab=events&sort=nextOccurrence");
    const done = page.getByRole("alert").filter({ hasText: this.copy.guide.checklist.doneTitle });
    await done.getByRole("button").click();
    await expect(done).toBeHidden();
    await expect(page.getByRole("heading", { name: new RegExp(this.script.editorEvent) }).first()).toBeVisible();
    await pause(page, 500);
    await this.screenshot(page, "events");

    await page
      .getByRole("row")
      .filter({ hasText: this.script.editorEvent })
      .first()
      .getByRole("button", { name: buttonName(this.copy.common.edit) })
      .click();
    const editor = page.getByRole("dialog", { name: this.copy.events.editEvent });
    await expect(editor.getByLabel(this.copy.events.preview.aria).getByRole("listitem")).toHaveCount(5);
    await pause(page, 800);
    await editor.screenshot({ path: join(this.appDir, "editor.png") });
    await annotate(page, page.locator('[data-guide="event-preview"]'), this.script.notes.editor);
    await this.screenshot(page, "editor");
    await clearOverlay(page);
    await editor.getByRole("button", { name: buttonName(this.copy.common.cancel) }).click();
    await expect(editor).toBeHidden();

    await page.getByRole("tab", { name: this.copy.common.nav.feeds }).click();
    await page.locator(".ant-table-row-expand-icon").first().click();
    await expect(page.locator(".ant-qrcode")).toBeVisible();
    await pause(page, 500);
    const table = page.locator(".ant-table-wrapper");
    await table.screenshot({ path: join(this.appDir, "feeds.png") });
    await annotate(page, page.locator('[data-guide="feed-actions"]'), this.script.notes.feedsActions);
    await annotate(page, page.locator('thead [data-guide="feed-last-fetched"]'), this.script.notes.feedsFetched);
    await this.screenshot(page, "feeds");
    await clearOverlay(page);

    await page.getByRole("button", { name: this.copy.feeds.howToAdd }).click();
    const help = page.getByRole("dialog", { name: this.copy.guide.help.title });
    await expect(help.getByRole("heading", { name: this.copy.guide.help.calendar.title })).toBeInViewport();
    await pause(page, 800);
    await this.screenshot(page, "help");

    const state = await context.storageState();
    await context.close();
    const phone = await this.newContext({
      storageState: state,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const phonePage = await phone.newPage();
    await phonePage.goto("/?tab=events&sort=nextOccurrence");
    await expect(phonePage.getByRole("heading", { name: new RegExp(this.script.editorEvent) }).first()).toBeVisible();
    await pause(phonePage, 500);
    await this.screenshot(phonePage, "mobile");
    await phone.close();
  }

  /** 空账号登录会自动开始引导；截清单前先关掉，录屏再从「带我做」重新开始。 */
  async dismissAutoTour(page: Page) {
    const tour = page.locator(".ant-tour:visible");
    try {
      await tour.waitFor({ state: "visible", timeout: 8000 });
    } catch {
      // 已有事件的账号不会自动开始引导。
      return;
    }

    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
  }

  /** 首次进入的清单截图，以及跟着引导完成第一段的短录屏。 */
  async firstRunScenes() {
    const state = await this.session(this.script.firstRun);
    const context = await this.newContext({
      storageState: state,
      viewport: videoSize,
      recordVideo: { dir: join(".tmp", "guide-media", "video"), size: videoSize },
    });
    const page = await context.newPage();
    const video = page.video();
    const saving = video?.saveAs(join(this.docsDir, "guide-tour.webm"));
    const { guide, events, common } = this.copy;
    const checklist = page.getByRole("region", { name: guide.checklist.title });
    const tour = page.locator(".ant-tour:visible");
    const tourTitle = tour.locator(".ant-tour-title");
    const next = () => clickVisibly(page, tour.getByRole("button", { name: guide.tour.next }));

    await page.goto("/");
    await expect(checklist).toBeVisible();
    await this.dismissAutoTour(page);
    await pause(page, 800);
    await annotate(page, checklist, this.script.notes.firstRun);
    await this.screenshot(page, "first-run");
    await clearOverlay(page);

    await caption(page, this.script.captions.tour);
    await clickVisibly(page, checklist.getByRole("button", { name: guide.checklist.start }).first());
    await expect(tour).toBeVisible();
    await pause(page, 1800);
    await clickVisibly(page, page.getByRole("button", { name: events.newEvent }));
    const editor = page.getByRole("dialog", { name: events.newEvent });
    await expect(tourTitle.getByText(guide.tour.event.kind.title)).toBeVisible();
    await pause(page, 1500);
    await clickVisibly(page, editor.getByLabel(events.form.nameAria, { exact: true }));
    await page.keyboard.type(this.script.tourName, { delay: 120 });
    await pause(page, 800);
    await next();
    await expect(tourTitle.getByText(guide.tour.event.date.title)).toBeVisible();
    await pause(page, 1200);
    const thisYear = new Date().getFullYear();
    const date = editor.getByLabel(events.originalDate.dateAria, { exact: true });
    await clickVisibly(page, date);
    await date.fill(`${thisYear - 7}-06-08`);
    await date.press("Enter");
    await pause(page, 1000);
    await next();
    await expect(tourTitle.getByText(guide.tour.event.preview.title)).toBeVisible();
    await pause(page, 1200);
    // 静态截图不带演示指针，只保留字幕。
    await clearOverlay(page);
    await caption(page, this.script.captions.tour);
    await this.screenshot(page, "guide-tour-step");
    await pause(page, 1200);
    await next();
    await pause(page, 1800);
    await next();
    await expect(tourTitle.getByText(guide.tour.event.save.title)).toBeVisible();
    await caption(page, this.script.captions.tourSave);
    await pause(page, 1500);
    await clickVisibly(page, editor.getByRole("button", { name: buttonName(common.save) }));
    await expect(editor).toBeHidden();
    await expect(checklist.getByRole("button", { name: guide.checklist.again })).toBeVisible();
    await pause(page, 3000);
    await context.close();
    await saving;
  }

  /** 核心流程录屏：录入 → 预览 → 提醒 → 保存 → 创建订阅 → 添加方式 → 拉取后完成。 */
  async coreFlow() {
    const state = await this.session(this.script.flow);
    const context = await this.newContext({
      storageState: state,
      viewport: videoSize,
      recordVideo: { dir: join(".tmp", "guide-media", "video"), size: videoSize },
    });
    const page = await context.newPage();
    const saving = page.video()?.saveAs(join(this.docsDir, "core-flow.webm"));
    const { captions, flowEvent } = this.script;
    const { events, common, feeds } = this.copy;

    await page.goto("/");
    await expect(page.getByRole("region", { name: this.copy.guide.checklist.title })).toBeVisible();
    await this.dismissAutoTour(page);
    await pause(page, 1200);
    await caption(page, captions.newEvent);
    await clickVisibly(page, page.getByRole("button", { name: events.newEvent }));
    const editor = page.getByRole("dialog", { name: events.newEvent });
    await expect(editor).toBeVisible();
    await caption(page, captions.fillName);
    await pause(page, 1000);
    await clickVisibly(page, editor.getByLabel(events.form.nameAria, { exact: true }));
    await page.keyboard.type(flowEvent.name, { delay: 140 });
    await pause(page, 900);

    await caption(page, captions.date);
    if (flowEvent.calendar === "lunar") {
      await clickVisibly(page, editor.getByText(events.lunar, { exact: true }));
      await pause(page, 1200);
      const year = editor.getByLabel(events.originalDate.lunarYearAria);
      await clickVisibly(page, year);
      await year.fill(flowEvent.date);
      await year.press("Tab");
    } else {
      const date = editor.getByLabel(events.originalDate.dateAria, { exact: true });
      await clickVisibly(page, date);
      await date.fill(flowEvent.date);
      await date.press("Enter");
    }

    await pause(page, 1500);
    const preview = editor.getByLabel(events.preview.aria);
    await expect(preview.getByRole("listitem")).toHaveCount(5);
    await caption(page, captions.preview);
    await pointAt(page, preview, 2600);
    await clearOverlay(page);
    await caption(page, this.script.notes.cover);
    await this.screenshot(page, "core-flow-cover");

    await caption(page, captions.alarm);
    const alarm = editor.getByRole("switch", { name: events.alarm.switchAria });
    await alarm.scrollIntoViewIfNeeded();
    await clickVisibly(page, alarm);
    await pause(page, 2000);
    await caption(page, captions.save);
    await clickVisibly(page, editor.getByRole("button", { name: buttonName(common.save) }));
    await expect(editor).toBeHidden();
    await pause(page, 1800);

    await caption(page, captions.feed);
    await this.createFeed(page, true);
    await pause(page, 1200);
    await caption(page, captions.subscribe);
    await pointAt(page, page.getByRole("link", { name: feeds.openCalendar }), 1800);
    await pointAt(page, page.getByRole("button", { name: feeds.copyUrl }), 1800);
    await caption(page, captions.qr);
    await clickVisibly(page, page.locator(".ant-table-row-expand-icon").first());
    await pause(page, 2600);

    await caption(page, captions.simulatedFetch);
    await this.fetchFeedLikeCalendar(page);
    await pause(page, 1800);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await this.reopenFeeds(page);
    const done = page.getByRole("alert").filter({ hasText: this.copy.guide.checklist.doneTitle });
    await expect(done).toBeVisible();
    await caption(page, captions.done);
    await annotate(page, page.locator('thead [data-guide="feed-last-fetched"]'), this.script.notes.feedsFetched);
    await pause(page, 4000);
    await context.close();
    await saving;
  }
}

async function captureLanguage(browser: Browser, language: MediaLanguage) {
  const script = mediaScripts[language];
  const instance = await startMediaInstance(language, ports[language], script.timeZone);
  try {
    const capture = new Capture(browser, instance.origin, language, script);
    await capture.setupAccounts();
    await capture.showcaseScenes();
    await capture.firstRunScenes();
    await capture.coreFlow();
    for (const file of [
      "events.png",
      "editor.png",
      "feeds.png",
      "help.png",
      "mobile.png",
      "first-run.png",
      "guide-tour-step.png",
      "guide-tour.webm",
      "core-flow-cover.png",
      "core-flow.webm",
    ]) {
      const { size } = statSync(join(capture.docsDir, file));
      console.log(`${language}/${file}  ${(size / 1024).toFixed(0)} KB`);
    }
  } finally {
    instance.stop();
  }
}

const requested = process.argv.slice(2).filter((value): value is MediaLanguage => value in mediaScripts);
const languages = requested.length ? requested : (Object.keys(mediaScripts) as MediaLanguage[]);
const browser = await chromium.launch({ channel: "msedge" });
try {
  for (const language of languages) {
    // eslint-disable-next-line no-await-in-loop -- 每种语言独占一个实例，依次运行
    await captureLanguage(browser, language);
  }
} finally {
  await browser.close();
}
