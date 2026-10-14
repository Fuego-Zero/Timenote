// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import { createElement, type ReactNode } from "react";
import { expect, it } from "vitest";

import { appTheme } from "../../apps/web/src/ui/AppProviders.js";

const tagTokens = {
  tagBirthdayColor: "#a3174f",
  tagBirthdayBg: "#fbe4ee",
  tagAnniversaryColor: "#7a2e8a",
  tagAnniversaryBg: "#f3e6f5",
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
};

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
    [
      "borderRadius",
      "colorBgLayout",
      "colorBorderSecondary",
      "colorPrimary",
      "fontFamily",
      ...Object.keys(tagTokens),
    ].sort()
  );
  expect(Object.keys(appTheme.components ?? {})).toEqual(["Layout"]);
  expect(appTheme.components?.Layout).toEqual({ headerBg: "#fff", headerPadding: "12px 16px", headerHeight: "auto" });
});

it("事件 Tag 的 14 个 token 与定稿色值一致", () => {
  for (const [key, value] of Object.entries(tagTokens)) {
    expect(appTheme.token).toHaveProperty(key, value);
  }
});

it("自定义 token 经 ConfigProvider 透传到 theme.useToken()", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ConfigProvider, { theme: appTheme }, children);
  const { result } = renderHook(() => theme.useToken(), { wrapper });
  expect(result.current.token.tagBirthdayColor).toBe("#a3174f");
});
