import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";

import { readCspNonce } from "../lib/nonce.js";
import { themeTokens } from "./themeTokens.js";

const theme = {
  token: {
    colorPrimary: themeTokens.colorPrimary,
    colorPrimaryHover: themeTokens.colorPrimaryHover,
    colorPrimaryActive: themeTokens.colorPrimaryActive,
    colorPrimaryBg: themeTokens.colorPrimarySoft,
    colorPrimaryBorder: themeTokens.colorPrimaryBorder,
    colorInfo: themeTokens.colorPrimary,
    colorLink: themeTokens.colorLink,
    colorLinkHover: themeTokens.colorLinkHover,
    borderRadius: 10,
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  components: {
    Segmented: {
      itemSelectedBg: themeTokens.colorSelectedBg,
      itemSelectedColor: themeTokens.colorSelectedText,
    },
    Menu: {
      itemSelectedBg: themeTokens.colorSelectedBg,
      itemSelectedColor: themeTokens.colorSelectedText,
    },
    Tabs: {
      inkBarColor: themeTokens.colorPrimary,
      itemSelectedColor: themeTokens.colorSelectedText,
      itemHoverColor: themeTokens.colorPrimaryHover,
    },
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider csp={{ nonce: readCspNonce() }} locale={zhCN} theme={theme}>
      <AntdApp notification={{ placement: "topRight", maxCount: 3 }}>{children}</AntdApp>
    </ConfigProvider>
  );
}
