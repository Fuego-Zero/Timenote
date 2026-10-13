import { afterEach, beforeEach, expect, it } from "vitest";

import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

async function postRaw(url: string, payload: string) {
  return h.app.inject({
    method: "POST",
    url,
    headers: { origin: h.config.webOrigin, "content-type": "application/json" },
    payload,
  });
}

it.each(["/api/auth/login", "/api/setup/admin", "/api/events"])("%s 收到格式错误的 JSON 返回 400", async url => {
  const res = await postRaw(url, '{"username":"admin",');
  expect(res.statusCode).toBe(400);
  expect(res.json()).toMatchObject({ code: "INVALID_INPUT", message: "请求无效" });
});

it("格式正确的 JSON 仍按原流程处理", async () => {
  const b = h.browser();
  const res = await b.request("POST", "/api/auth/login", { username: "admin", password: "wrong-password-1" });
  expect(res.status).toBe(401);
});
