import { afterEach, beforeEach, expect, it } from "vitest";

import { requestSignHeaderNames } from "../../packages/contracts/src/index.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

/** 固定现有行为：签名头为空串或全空白时视同缺失，返回 SIGN_INVALID。 */
it.each([
  ["签名", requestSignHeaderNames.signature, ""],
  ["签名", requestSignHeaderNames.signature, "   "],
  ["nonce", requestSignHeaderNames.nonce, ""],
  ["时间戳", requestSignHeaderNames.timestamp, "   "],
])("%s头为 %j 时返回 SIGN_INVALID", async (_label, name, value) => {
  const b = h.browser();
  await b.login();
  const ok = await b.request("POST", "/api/feed-tokens", { name: "对照" });
  expect(ok.status).toBe(201);
  const res = await b.request<{ code: string }>("POST", "/api/feed-tokens", { name: "空白头" }, { [name]: value });
  expect(res.status).toBe(403);
  expect(res.json.code).toBe("SIGN_INVALID");
});
