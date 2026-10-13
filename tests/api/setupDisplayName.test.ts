import { afterEach, expect, it } from "vitest";

import { harness, type Harness } from "../helpers.js";

let h: Harness | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

/** 固定现有行为：显示名称缺省、为空或全空白时，首个管理员显示为“管理员”。 */
it.each([
  ["缺省", undefined],
  ["空串", ""],
  ["全空白", "   "],
])("首次引导创建管理员时显示名称%s，回落为“管理员”", async (_label, displayName) => {
  h = await harness({}, { seedAdmin: false });
  const res = await h.browser().request("POST", "/api/setup/admin", {
    username: "owner",
    password: "owner-password-1",
    ...(displayName === undefined ? {} : { displayName }),
  });
  expect(res.status).toBe(200);
  expect(h.repo.users.getUserByUsername("owner")?.displayName).toBe("管理员");
});

it("首次引导创建管理员时显示名称去掉首尾空白后保留", async () => {
  h = await harness({}, { seedAdmin: false });
  await h.browser().request("POST", "/api/setup/admin", {
    username: "owner",
    password: "owner-password-1",
    displayName: "  主人  ",
  });
  expect(h.repo.users.getUserByUsername("owner")?.displayName).toBe("主人");
});
