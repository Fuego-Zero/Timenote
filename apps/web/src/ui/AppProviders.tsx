import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";

import { readCspNonce } from "../lib/nonce.js";

const theme = {
  token: {
    colorPrimary: "#d4380d",
    colorInfo: "#d4380d",
    borderRadius: 10,
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider csp={{ nonce: readCspNonce() }} locale={zhCN} theme={theme}>
      <AntdApp notification={{ placement: "topRight", maxCount: 3 }}>{children}</AntdApp>
    </ConfigProvider>
  );
}
