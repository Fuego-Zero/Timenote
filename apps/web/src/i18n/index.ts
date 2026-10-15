import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import enAuth from "./en/auth.json";
import enCommon from "./en/common.json";
import enEvents from "./en/events.json";
import enFeeds from "./en/feeds.json";
import {
  defaultLocaleCode,
  isRegisteredLocale,
  type LocaleEntry,
  matchNavigatorLanguage,
  resolveLocale,
} from "./locales.js";
import zhAuth from "./zh-CN/auth.json";
import zhCommon from "./zh-CN/common.json";
import zhEvents from "./zh-CN/events.json";
import zhFeeds from "./zh-CN/feeds.json";

export const localeStorageKey = "timenote.locale";

const resources = {
  "zh-CN": {
    common: zhCommon,
    auth: zhAuth,
    events: zhEvents,
    feeds: zhFeeds,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    events: enEvents,
    feeds: enFeeds,
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
  ns: ["common", "auth", "events", "feeds"],
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
