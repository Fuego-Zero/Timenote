import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import enAdmin from "./en/admin.json";
import enAuth from "./en/auth.json";
import enBackup from "./en/backup.json";
import enCommon from "./en/common.json";
import enErrors from "./en/errors.json";
import enEvents from "./en/events.json";
import enFeeds from "./en/feeds.json";
import {
  defaultLocaleCode,
  isRegisteredLocale,
  type LocaleEntry,
  matchNavigatorLanguage,
  resolveLocale,
} from "./locales.js";
import zhAdmin from "./zh-CN/admin.json";
import zhAuth from "./zh-CN/auth.json";
import zhBackup from "./zh-CN/backup.json";
import zhCommon from "./zh-CN/common.json";
import zhErrors from "./zh-CN/errors.json";
import zhEvents from "./zh-CN/events.json";
import zhFeeds from "./zh-CN/feeds.json";

export const localeStorageKey = "timenote.locale";

/** 浏览器标签用的双语全称，不随界面语言切换。顶栏和登录页只用当前语言的 brand。 */
export const productTitle = "岁时记 Timenote";

const resources = {
  "zh-CN": {
    common: zhCommon,
    auth: zhAuth,
    events: zhEvents,
    feeds: zhFeeds,
    errors: zhErrors,
    admin: zhAdmin,
    backup: zhBackup,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    events: enEvents,
    feeds: enFeeds,
    errors: enErrors,
    admin: enAdmin,
    backup: enBackup,
  },
} as const;

export function readStoredLocale(): string | undefined {
  try {
    const stored = localStorage.getItem(localeStorageKey);
    return stored && isRegisteredLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function detectLocale(): string {
  const stored = readStoredLocale();
  if (stored) {
    return stored;
  }

  // 单元测试默认中文，避免 jsdom 的 en-US 把断言打成英文。
  if (typeof process !== "undefined" && process.env.VITEST) {
    return defaultLocaleCode;
  }

  const language = typeof navigator !== "undefined" ? navigator.language : "";
  return language ? matchNavigatorLanguage(language) : defaultLocaleCode;
}

export function applyDocumentLang(entry: LocaleEntry) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = entry.htmlLang;
    document.title = productTitle;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) {
      manifest.href = `/site.webmanifest?lang=${entry.code}`;
    }
  }
}

export async function setLocale(code: string) {
  if (!isRegisteredLocale(code)) {
    return;
  }

  try {
    localStorage.setItem(localeStorageKey, code);
  } catch {
    // 隐私模式等写失败时仍切换内存语言。
  }

  // eslint-disable-next-line import-x/no-named-as-default-member -- i18next 官方实例 API
  await i18next.changeLanguage(code);
  applyDocumentLang(resolveLocale(code));
}

const initial = detectLocale();

// eslint-disable-next-line import-x/no-named-as-default-member -- i18next 官方实例 API
void i18next.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: defaultLocaleCode,
  defaultNS: "common",
  ns: ["common", "auth", "events", "feeds", "admin", "backup", "errors"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLang(resolveLocale(i18next.language));

i18next.on("languageChanged", lng => {
  applyDocumentLang(resolveLocale(lng));
});

const i18n = i18next;
export { i18n };
export {
  defaultLocaleCode,
  findLocale,
  isRegisteredLocale,
  type LocaleEntry,
  localeRegistry,
  matchNavigatorLanguage,
  resolveLocale,
} from "./locales.js";
