import { expect, it } from "vitest";

import { contentSecurityPolicy } from "../../apps/web/server/html.js";

const nonce = "nonce-value";

it("未配置回声时保持原有连接与图片来源", () => {
  expect(contentSecurityPolicy({ nonce, built: true, port: 8720 })).toBe(
    "default-src 'self'; script-src 'self' 'nonce-nonce-value'; worker-src 'self' blob:; style-src 'self' 'nonce-nonce-value'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  expect(contentSecurityPolicy({ nonce, built: false, port: 8720 })).toContain(
    "connect-src 'self' ws://127.0.0.1:8720 ws://localhost:8720"
  );
});

it("配置回声来源后放行该 Origin 和本地图片预览", () => {
  const policy = contentSecurityPolicy({
    nonce,
    built: true,
    port: 8720,
    feedbackOrigin: "https://feedback.example.com",
  });
  expect(policy).toContain("connect-src 'self' https://feedback.example.com");
  expect(policy).toContain("img-src 'self' data: blob:");
});
