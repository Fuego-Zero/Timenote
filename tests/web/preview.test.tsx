// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";

import { EventPreview } from "../../apps/web/src/features/events/EventPreview.js";
import { eventInput } from "../fixtures.js";

beforeAll(() => {
  // antd 响应式组件依赖 matchMedia，jsdom 未实现。
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
});
afterEach(cleanup);

const now = new Date("2026-10-02T04:00:00Z");

it("农历生日预览未来 5 次，标题、农历年份与提醒时间和订阅一致", () => {
  render(
    <EventPreview
      draft={eventInput({
        titlePrefix: "🎂",
        date: { calendar: "lunar", year: 1990, month: 12, day: 29 },
        alarms: [{ daysBefore: 1, time: "09:00" }],
      })}
      now={now}
      timeZone="Asia/Shanghai"
    />
  );
  const items = within(screen.getByLabelText("发生日预览")).getAllByRole("listitem");
  expect(items).toHaveLength(5);
  expect(items[0]).toHaveTextContent("🎂 小明 36 岁生日");
  expect(items[0]).toHaveTextContent("2027年2月5日 周五");
  expect(items[0]).toHaveTextContent("农历 2026 年");
  expect(items[0]).toHaveTextContent("提醒：2/4 09:00");
  expect(items[4]).toHaveTextContent("🎂 小明 40 岁生日");
});

it("草稿有错误时不计算预览", () => {
  render(<EventPreview draft={eventInput({ name: "" })} now={now} timeZone="Asia/Shanghai" />);
  expect(screen.getByRole("alert")).toHaveTextContent("填写完整且无误后显示预览");
});

it("已经过去的普通事件仍显示它唯一的那一次，与订阅输出一致", () => {
  render(
    <EventPreview
      draft={eventInput({ kind: "event", titleTemplate: "{{name}}", date: { year: 2020, month: 1, day: 1 } })}
      now={now}
      timeZone="Asia/Shanghai"
    />
  );
  expect(within(screen.getByLabelText("发生日预览")).getAllByRole("listitem")).toHaveLength(1);
});

it("支持范围内没有发生日时给出空状态", () => {
  // 农历只支持到 2100 年，2100 年出生的第 1 个生日超出范围。
  render(
    <EventPreview
      draft={eventInput({ date: { calendar: "lunar", year: 2100, month: 1, day: 1 } })}
      now={now}
      timeZone="Asia/Shanghai"
    />
  );
  expect(screen.getByText("接下来没有符合规则的发生日")).toBeInTheDocument();
});
