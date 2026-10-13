import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";

import { readCspNonce } from "../lib/nonce.js";

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#d6246e",
    colorBgLayout: "#faf7f5",
    colorBorderSecondary: "#f0e6e0",
    borderRadius: 10,
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  components: {
    Layout: { headerBg: "#fff", headerPadding: "12px 16px", headerHeight: "auto" },
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider csp={{ nonce: readCspNonce() }} locale={zhCN} theme={appTheme}>
      <AntdApp notification={{ placement: "topRight", maxCount: 3 }}>{children}</AntdApp>
    </ConfigProvider>
  );
}
