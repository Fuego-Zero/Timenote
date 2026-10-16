import { describe, expect, it } from "vitest";

import { manifestForLanguage, manifestLanguage } from "../../apps/web/server/webManifest.js";

describe("安装清单随语言", () => {
  it("lang 查询优先于 Accept-Language", () => {
    expect(manifestLanguage("/site.webmanifest?lang=en", "zh-CN,zh;q=0.9")).toBe("en");
    expect(manifestLanguage("/site.webmanifest", "zh-CN,zh;q=0.9")).toBe("zh-CN,zh;q=0.9");
  });

  it("中文用岁时记，其他语言用 Timenote", () => {
    expect(manifestForLanguage("zh-CN").short_name).toBe("岁时记");
    expect(manifestForLanguage("zh-CN,zh;q=0.9").name).toBe("岁时记");
    expect(manifestForLanguage("en-US,en;q=0.8").short_name).toBe("Timenote");
    expect(manifestForLanguage(undefined).name).toBe("Timenote");
  });
});
