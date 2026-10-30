// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";

import { FeedbackButton } from "../../apps/web/src/features/feedback/FeedbackButton.js";
import { setLocale } from "../../apps/web/src/i18n/index.js";

const ak = "a".repeat(43);

// jsdom 没有 HTMLDialogElement.showModal；只补打开和关闭，面板逻辑仍走 SDK。
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}

afterEach(async () => {
  cleanup();
  document.head.querySelector('meta[name="tn-nonce"]')?.remove();
  document.querySelector("echo-feedback")?.remove();
  await setLocale("zh-CN");
});

it("打开回声面板时带上页面 nonce，卸载后不留节点", async () => {
  const meta = document.createElement("meta");
  meta.name = "tn-nonce";
  meta.content = "test-nonce";
  document.head.append(meta);

  const view = render(<FeedbackButton ak={ak} serverUrl="https://feedback.example.com" userId="user-1" />);
  const host = document.querySelector("echo-feedback");
  expect(host?.shadowRoot?.querySelector("style")?.nonce).toBe("test-nonce");
  const dialog = host?.shadowRoot?.querySelector("dialog");
  expect(dialog?.open).toBe(false);

  await userEvent.click(screen.getByRole("button", { name: "反 馈" }));
  expect(dialog?.open).toBe(true);
  expect(host?.shadowRoot?.querySelector("#ef-title")).toHaveTextContent("说说你的想法");

  view.unmount();
  expect(document.querySelector("echo-feedback")).toBeNull();
});
