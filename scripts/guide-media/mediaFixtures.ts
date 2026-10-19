import { randomUUID } from "node:crypto";

import enAdmin from "../../apps/web/src/i18n/en/admin.json" with { type: "json" };
import enAuth from "../../apps/web/src/i18n/en/auth.json" with { type: "json" };
import enBackup from "../../apps/web/src/i18n/en/backup.json" with { type: "json" };
import enCommon from "../../apps/web/src/i18n/en/common.json" with { type: "json" };
import enEvents from "../../apps/web/src/i18n/en/events.json" with { type: "json" };
import enFeeds from "../../apps/web/src/i18n/en/feeds.json" with { type: "json" };
import enGuide from "../../apps/web/src/i18n/en/guide.json" with { type: "json" };
import zhAdmin from "../../apps/web/src/i18n/zh-CN/admin.json" with { type: "json" };
import zhAuth from "../../apps/web/src/i18n/zh-CN/auth.json" with { type: "json" };
import zhBackup from "../../apps/web/src/i18n/zh-CN/backup.json" with { type: "json" };
import zhCommon from "../../apps/web/src/i18n/zh-CN/common.json" with { type: "json" };
import zhEvents from "../../apps/web/src/i18n/zh-CN/events.json" with { type: "json" };
import zhFeeds from "../../apps/web/src/i18n/zh-CN/feeds.json" with { type: "json" };
import zhGuide from "../../apps/web/src/i18n/zh-CN/guide.json" with { type: "json" };
import { type BackupFile, backupFileSchema, type EventInput } from "../../packages/contracts/src/index.js";

export type MediaLanguage = "en" | "zh-CN";

/** 界面文案直接取应用的语言包，脚本用它定位按钮，界面改字后不会对着旧文字找元素。 */
export const uiCopy = {
  "zh-CN": {
    admin: zhAdmin,
    auth: zhAuth,
    backup: zhBackup,
    common: zhCommon,
    events: zhEvents,
    feeds: zhFeeds,
    guide: zhGuide,
  },
  en: {
    admin: enAdmin,
    auth: enAuth,
    backup: enBackup,
    common: enCommon,
    events: enEvents,
    feeds: enFeeds,
    guide: enGuide,
  },
} as const;

export interface MediaAccount {
  displayName: string;
  username: string;
}

interface FlowEvent {
  /** 农历时只填农历年，月日沿用界面从今天换算的结果。 */
  calendar: "gregorian" | "lunar";
  /** 公历时的完整日期（YYYY-MM-DD）；农历时只用年份。 */
  date: string;
  name: string;
}

export interface MediaScript {
  admin: MediaAccount;
  /** 浏览器语言，与界面语言一致。 */
  browserLocale: string;
  captions: {
    newEvent: string;
    fillName: string;
    date: string;
    preview: string;
    alarm: string;
    save: string;
    feed: string;
    subscribe: string;
    qr: string;
    simulatedFetch: string;
    done: string;
    tour: string;
    tourSave: string;
  };
  /** 编辑抽屉截图打开的事件。 */
  editorEvent: string;
  /** 空账号：首次进入与引导。 */
  firstRun: MediaAccount;
  /** 空账号：核心流程录屏。 */
  flow: MediaAccount;
  flowEvent: FlowEvent;
  notes: {
    editor: string;
    feedsActions: string;
    feedsFetched: string;
    firstRun: string;
    cover: string;
  };
  /** 已有数据的账号，用于静态截图。 */
  showcase: MediaAccount;
  /** 浏览器时区，同时作为实例默认时区。 */
  timeZone: string;
  tourName: string;
}

const thisYear = new Date().getFullYear();

/**
 * 全部为虚构人物与日期。年份相对当前年份计算，换一年重新生成时岁数、周年数保持在相近范围；
 * 英文标题模板用固定的 “th” 后缀，挑选的年龄避开 1、2、3 结尾，免得素材出现 “21th”。
 */
export const mediaScripts: Record<MediaLanguage, MediaScript> = {
  "zh-CN": {
    browserLocale: "zh-CN",
    timeZone: "Asia/Shanghai",
    admin: { username: "admin", displayName: "管理员" },
    showcase: { username: "linxia", displayName: "林夏" },
    firstRun: { username: "zhouzhou", displayName: "周舟" },
    flow: { username: "tangguo", displayName: "唐果" },
    editorEvent: "妈妈",
    flowEvent: { calendar: "lunar", name: "妈妈", date: `${thisYear - 58}` },
    tourName: "小雨",
    notes: {
      editor: "保存前在这里核对未来 5 次的日期和标题",
      feedsActions: "苹果设备点「日历打开」；Google、Outlook 用「复制地址」",
      feedsFetched: "日历拉取后显示时间",
      firstRun: "首次登录显示，可随时「不再显示」",
      cover: "▶ 演示视频（不到 1 分钟）：录入生日 → 创建订阅 → 添加到日历",
    },
    captions: {
      newEvent: "1. 点「新建事件」",
      fillName: "2. 选择类型，填写名称",
      date: "3. 选择「农历」，填写出生年份；月日按农历核对",
      preview: "4. 右侧实时预览未来 5 次，日历里显示的就是这些",
      alarm: "5. 需要提醒就打开「日历提醒」",
      save: "6. 保存",
      feed: "7. 在「订阅」为这台设备创建私密地址",
      subscribe: "8. 苹果设备点「日历打开」；Google、Outlook 点「复制地址」后到日历里添加",
      qr: "也可以展开这一行，用 iPhone 相机扫码（演示中二维码已模糊处理）",
      simulatedFetch: "（演示中由录制脚本代替日历 App 拉取一次订阅）",
      done: "日历拉取后，「最近拉取」显示时间，「开始使用」三步全部完成",
      tour: "首次登录可以跟着引导做：它只高亮和说明，操作由你自己完成",
      tourSave: "保存后清单自动打勾",
    },
  },
  en: {
    browserLocale: "en-US",
    timeZone: "America/New_York",
    admin: { username: "admin", displayName: "Admin" },
    showcase: { username: "alex", displayName: "Alex" },
    firstRun: { username: "sam", displayName: "Sam" },
    flow: { username: "jordan", displayName: "Jordan" },
    editorEvent: "Lily",
    flowEvent: { calendar: "gregorian", name: "Lily", date: `${thisYear - 7}-06-08` },
    tourName: "Lily",
    notes: {
      editor: "Check the next 5 dates and titles here before saving",
      feedsActions: "Apple: Open in Calendar. Google or Outlook: Copy URL",
      feedsFetched: "Shows when a calendar last fetched",
      firstRun: "Shown on first sign-in; hide it anytime",
      cover: "▶ Demo video (under 1 min): add a birthday → create a feed → add it to a calendar",
    },
    captions: {
      newEvent: "1. Click New event",
      fillName: "2. Pick a type and enter a name",
      date: "3. Enter the original date (Lunar dates work too)",
      preview: "4. The preview lists the next 5 occurrences, exactly as your calendar will",
      alarm: "5. Turn on Calendar reminder if you want one",
      save: "6. Save",
      feed: "7. Under Feeds, create a private URL for this device",
      subscribe: "8. Apple: Open in Calendar. Google or Outlook: Copy URL and add it in the calendar",
      qr: "Or expand the row and scan the QR code with an iPhone (blurred in this demo)",
      simulatedFetch: "(In this demo the recording script fetches the feed in place of a calendar app)",
      done: "Once a calendar fetches the feed, Last fetched shows the time and all three Get started steps are done",
      tour: "On first sign-in you can follow the guide: it highlights and explains, and you do each step yourself",
      tourSave: "After saving, the checklist ticks itself",
    },
  },
};

function event(language: MediaLanguage, input: Partial<EventInput> & Pick<EventInput, "date" | "kind" | "name">) {
  const { templates } = uiCopy[language].events;
  const titleTemplate = {
    birthday: input.date.year === null ? templates.birthday : templates.birthdayYears,
    anniversary: input.date.year === null ? templates.anniversary : templates.anniversaryYears,
    event: templates.event,
  }[input.kind];
  const titlePrefix = { birthday: "🎂", anniversary: "💞", event: "" }[input.kind];
  return {
    id: randomUUID(),
    event: {
      titleTemplate,
      titlePrefix,
      note: "",
      durationDays: 1,
      rules: { feb29: "feb28", leapMonth: "regular", missingDay: "lastDay" },
      alarms: [],
      recurrence: { unit: "year", interval: 1, end: { type: "never" } },
      gregorianMissingDay: "lastDay",
      milestones: [],
      milestoneTemplate: templates.milestone,
      ...input,
    } satisfies EventInput,
  };
}

const people: Record<MediaLanguage, { mom: string; kid: string; grandma: string; wedding: string; trip: string }> = {
  "zh-CN": { mom: "妈妈", kid: "小雨", grandma: "外婆", wedding: "结婚", trip: "海边旅行" },
  en: { mom: "Mom", kid: "Lily", grandma: "Grandma", wedding: "Our wedding", trip: "Beach trip" },
};

/** 展示账号的备份文件，经应用自己的「备份」页导入，与用户导入走同一条校验。 */
export function showcaseBackup(language: MediaLanguage): BackupFile {
  const name = people[language];
  const lunar = (year: number | null, month: number, day: number) => ({
    calendar: "lunar" as const,
    year,
    month,
    day,
    leapMonth: false,
  });
  const solar = (year: number, month: number, day: number) => ({
    calendar: "gregorian" as const,
    year,
    month,
    day,
    leapMonth: false,
  });
  return backupFileSchema.parse({
    format: "timenote-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    events: [
      event(language, {
        kind: "birthday",
        name: name.mom,
        date: lunar(thisYear - 58, 3, 12),
        alarms: [{ daysBefore: 1, time: "09:00" }],
      }),
      event(language, {
        kind: "birthday",
        name: name.kid,
        date: solar(thisYear - 7, 6, 8),
        alarms: [{ daysBefore: 0, time: "08:00" }],
      }),
      event(language, { kind: "birthday", name: name.grandma, date: lunar(null, 8, 15) }),
      event(language, {
        kind: "anniversary",
        name: name.wedding,
        date: solar(thisYear - 10, 5, 20),
        alarms: [{ daysBefore: 3, time: "20:00" }],
      }),
      event(language, { kind: "event", name: name.trip, date: solar(thisYear + 1, 1, 24), durationDays: 5 }),
    ],
  });
}
