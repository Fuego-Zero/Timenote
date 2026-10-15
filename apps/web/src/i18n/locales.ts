import type { Locale as AntdLocale } from "antd/es/locale";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";

/** 已注册 UI 语言。新增语言：加资源目录并在此追加一项，勿在业务里穷尽 if 写死语种。 */
export interface LocaleEntry {
  antd: AntdLocale;
  /** 注册 code，如 zh-CN、en；第三语言同此扩展。 */
  code: string;
  dayjs: string;
  htmlLang: string;
  /** Intl / toLocaleString 用 */
  intl: string;
  /** common 命名空间下的展示名 key，如 locale.zhCN */
  labelKey: string;
}

export const defaultLocaleCode = "zh-CN";

export const localeRegistry: readonly LocaleEntry[] = [
  {
    code: "zh-CN",
    labelKey: "locale.zhCN",
    antd: zhCN,
    dayjs: "zh-cn",
    htmlLang: "zh-CN",
    intl: "zh-CN",
  },
  {
    code: "en",
    labelKey: "locale.en",
    antd: enUS,
    dayjs: "en",
    htmlLang: "en",
    intl: "en",
  },
  // 占位说明：后续语言在此追加 { code, labelKey, antd, dayjs, htmlLang, intl }，并增加对应资源目录。
];

export function findLocale(code: string): LocaleEntry | undefined {
  return localeRegistry.find(entry => entry.code === code);
}

export function resolveLocale(code: string): LocaleEntry {
  return findLocale(code) ?? findLocale(defaultLocaleCode)!;
}

export function isRegisteredLocale(code: string): boolean {
  return localeRegistry.some(entry => entry.code === code);
}

/** 按 navigator.language 匹配已注册语种；无匹配则回落到默认中文。 */
export function matchNavigatorLanguage(language: string): string {
  const lower = language.toLowerCase();
  const exact = localeRegistry.find(entry => entry.code.toLowerCase() === lower);
  if (exact) {
    return exact.code;
  }

  for (const entry of localeRegistry) {
    const primary = entry.code.split("-")[0].toLowerCase();
    if (lower === primary || lower.startsWith(`${primary}-`)) {
      return entry.code;
    }
  }

  return defaultLocaleCode;
}
