import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import { buildFeed } from "../../packages/calendar/src/index.js";
import type { CalendarEvent } from "../../packages/contracts/src/index.js";
import { calendarEvent } from "../fixtures.js";

const window = { fromYear: 2026, toYear: 2027 };

function feed(events: CalendarEvent[], timeZone = "Asia/Shanghai") {
  return buildFeed({ calendarName: "小明的纪念日", timeZone, window, events, today: "2026-10-02" });
}

function parse(text: string) {
  return new ICAL.Component(ICAL.parse(text)).getAllSubcomponents("vevent").map(vevent => new ICAL.Event(vevent));
}

describe("ICS 输出", () => {
  it("全天事件使用 VALUE=DATE，跨天 DTEND 为排他结束日", () => {
    const text = feed([
      calendarEvent({
        kind: "event",
        name: "国庆旅行",
        titleTemplate: "{{name}}",
        durationDays: 7,
        date: { year: 2026, month: 10, day: 1 },
      }),
    ]);
    expect(text).toContain("DTSTART;VALUE=DATE:20261001\r\n");
    expect(text).toContain("DTEND;VALUE=DATE:20261008\r\n");
    expect(text).toContain("UID:11111111-1111-4111-8111-111111111111@timenote\r\n");
    expect(text).toContain("TRANSP:TRANSPARENT\r\n");
  });

  it("每行以 CRLF 结束且不超过 75 字节，多字节字符与 emoji 不被折断", () => {
    const longName = "🎂".repeat(10) + "很长很长的名字".repeat(4);
    const text = feed([calendarEvent({ name: longName, titlePrefix: "🎉" })]);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    for (const line of text.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }

    expect(parse(text)[0]?.summary).toBe(`🎉 ${longName} 36 岁生日`);
  });

  it("名称与备注里的换行、分号、逗号、反斜杠被转义，不能注入额外属性或组件", () => {
    const name = "小明\nBEGIN:VEVENT\nSUMMARY:伪造";
    const note = "第一行\nEND:VCALENDAR;逗号,反斜杠\\";
    const text = feed([calendarEvent({ name, note, titleTemplate: "{{name}}生日" })]);
    expect(text.match(/^BEGIN:VEVENT$/gm)).toHaveLength(2);
    expect(text.match(/^END:VCALENDAR$/gm)).toHaveLength(1);
    const [first] = parse(text);
    expect(first?.summary).toBe(`${name}生日`);
    expect(first?.description).toBe(note);
  });

  it("UID 按事件 ID 与逻辑年份稳定，修改标题只递增 SEQUENCE", () => {
    const before = parse(feed([calendarEvent()]));
    const after = parse(feed([calendarEvent({ name: "小明同学", revision: 3, updatedAt: Date.UTC(2026, 5, 1) })]));
    expect(before.map(e => e.uid)).toEqual([
      "11111111-1111-4111-8111-111111111111-2026@timenote",
      "11111111-1111-4111-8111-111111111111-2027@timenote",
    ]);
    expect(after.map(e => e.uid)).toEqual(before.map(e => e.uid));
    expect(after.map(e => e.sequence)).toEqual([3, 3]);
    expect(after[0]?.summary).toBe("小明同学 36 岁生日");
  });

  it("相同输入产生相同字节，DTSTAMP 取事件修改时间而非请求时刻", () => {
    const events = [
      calendarEvent({ id: "22222222-2222-4222-8222-222222222222", createdAt: 2 }),
      calendarEvent({ createdAt: 1 }),
    ];
    const first = feed(events);
    expect(feed([...events].reverse())).toBe(first);
    expect(first).toContain("DTSTAMP:20260101T083015Z\r\n");
    expect(first).toContain("LAST-MODIFIED:20260101T083015Z\r\n");
    expect(first.indexOf("11111111-1111-4111-8111-111111111111-2026")).toBeLessThan(
      first.indexOf("22222222-2222-4222-8222-222222222222-2026")
    );
  });

  it("提醒写成绝对 UTC 触发时间并能被解析回来", () => {
    const text = feed([calendarEvent({ alarms: [{ daysBefore: 1, time: "09:00" }] })]);
    expect(text).toContain("TRIGGER;VALUE=DATE-TIME:20260519T010000Z\r\n");
    const vevent = new ICAL.Component(ICAL.parse(text)).getFirstSubcomponent("vevent");
    const valarm = vevent?.getFirstSubcomponent("valarm");
    expect(valarm?.getFirstPropertyValue("action")).toBe("DISPLAY");
    expect(String(valarm?.getFirstPropertyValue("trigger"))).toBe("2026-05-19T01:00:00Z");
  });

  it("日历头包含名称、刷新间隔与时区", () => {
    const text = feed([]);
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//timenote//timenote//ZH\r\n")).toBe(true);
    expect(text).toContain("X-WR-CALNAME:小明的纪念日\r\n");
    expect(text).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H\r\n");
    expect(text).toContain("X-WR-TIMEZONE:Asia/Shanghai\r\n");
  });
});
