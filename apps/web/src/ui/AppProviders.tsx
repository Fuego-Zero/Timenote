import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/zh-cn";
import { type ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

import { i18n, resolveLocale } from "../i18n/index.js";
import { readCspNonce } from "../lib/nonce.js";

// 事件 Tag 的语义色作为自定义 token 声明为必选键，EventTag 通过 theme.useToken() 读取。
declare module "antd/es/theme/interface" {
  interface AliasToken {
    tagAnniversaryBg: string;
    tagAnniversaryColor: string;
    tagBirthdayBg: string;
    tagBirthdayColor: string;
    tagCustomBg: string;
    tagCustomColor: string;
    tagDurationBg: string;
    tagDurationColor: string;
    tagGeneralBg: string;
    tagGeneralColor: string;
    tagHolidayBg: string;
    tagHolidayColor: string;
    tagLunarBg: string;
    tagLunarColor: string;
    tagReminderBg: string;
    tagReminderColor: string;
    tagSolarBg: string;
    tagSolarColor: string;
  }
}

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#d6246e",
    colorBgLayout: "#faf7f5",
    colorBorderSecondary: "#f0e6e0",
    borderRadius: 10,
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    // 事件 Tag 字色与底色：每组对比度不得低于 4.5:1（WCAG AA）。
    tagBirthdayColor: "#a3174f",
    tagBirthdayBg: "#fbe4ee",
    tagAnniversaryColor: "#7a2e8a",
    tagAnniversaryBg: "#f3e6f5",
    tagHolidayColor: "#8a3b12",
    tagHolidayBg: "#f8ebdf",
    tagCustomColor: "#1d3e68",
    tagCustomBg: "#e6eef8",
    tagGeneralColor: "#6b6266",
    tagGeneralBg: "#f1eeef",
    tagSolarColor: "#46637f",
    tagSolarBg: "#e9eff4",
    tagLunarColor: "#85692e",
    tagLunarBg: "#f4efe0",
    tagDurationColor: "#3d7670",
    tagDurationBg: "#e5f1ef",
    tagReminderColor: "#55763a",
    tagReminderBg: "#ebf2e5",
  },
  components: {
    Layout: { headerBg: "#fff", headerPadding: "12px 16px", headerHeight: "auto" },
  },
};

function useUiLocale() {
  const [code, setCode] = useState(() => i18n.language);
  useEffect(() => {
    const onChange = (lng: string) => setCode(lng);
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, []);
  return resolveLocale(code);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const locale = useUiLocale();

  useEffect(() => {
    // eslint-disable-next-line import-x/no-named-as-default-member -- dayjs 官方用法为 dayjs.locale()
    dayjs.locale(locale.dayjs);
  }, [locale.dayjs]);

  return (
    <I18nextProvider i18n={i18n}>
      <ConfigProvider csp={{ nonce: readCspNonce() }} locale={locale.antd} theme={appTheme}>
        <AntdApp notification={{ placement: "topRight", maxCount: 3 }}>{children}</AntdApp>
      </ConfigProvider>
    </I18nextProvider>
  );
}
