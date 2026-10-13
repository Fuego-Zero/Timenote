import { expect, it } from "vitest";

import { theme } from "../../apps/web/node_modules/antd/es/index.js";
import { appTheme } from "../../apps/web/src/ui/AppProviders.js";

it("主题只设定稿 token，派生色由 antd 计算", () => {
  const token = theme.getDesignToken(appTheme);
  expect(token.colorPrimary).toBe("#d6246e");
  expect(token.colorPrimaryHover).toBe("#e34b85");
  expect(token.colorPrimaryActive).toBe("#b0155b");
  expect(token.colorPrimaryBg).toBe("#fff0f4");
  expect(token.controlItemBgActive).toBe("#fff0f4");
  expect(token.colorLink).toBe("#1677ff");
  expect(token.colorBgLayout).toBe("#faf7f5");
  expect(token.colorBorderSecondary).toBe("#f0e6e0");
});

it("appTheme 只含定稿列出的键", () => {
  expect(Object.keys(appTheme.token ?? {}).sort()).toEqual(
    ["borderRadius", "colorBgLayout", "colorBorderSecondary", "colorPrimary", "fontFamily"].sort()
  );
  expect(Object.keys(appTheme.components ?? {})).toEqual(["Layout"]);
  expect(appTheme.components?.Layout).toEqual({ headerBg: "#fff", headerPadding: "12px 16px", headerHeight: "auto" });
});
