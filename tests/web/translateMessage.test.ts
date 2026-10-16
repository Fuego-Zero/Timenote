import { describe, expect, it } from "vitest";

import { setLocale } from "../../apps/web/src/i18n/index.js";
import { translateApiMessage, translateDetail } from "../../apps/web/src/i18n/translateMessage.js";

describe("界面按错误码生成提示", () => {
  it("同一 detail 在中英文下各有一句，未知码回落到通用无效请求", async () => {
    await setLocale("zh-CN");
    expect(translateDetail("name_required")).toBe("请填写名称");
    expect(translateDetail('{"detail":"lunar_month_days","params":{"n":29}}')).toBe("该农历月只有 29 天");

    await setLocale("en");
    try {
      expect(translateDetail("name_required")).toBe("Enter a name");
      expect(translateApiMessage("INVALID_CREDENTIALS")).toBe("Incorrect username or password");
      expect(translateApiMessage("FORBIDDEN", "setup_closed")).toBe(
        "An account already exists, so setup cannot create another admin"
      );
      expect(translateDetail("not_a_real_detail")).toBe("Invalid request");
    } finally {
      await setLocale("zh-CN");
    }
  });
});
