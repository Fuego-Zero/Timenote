// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { ProfileForm } from "../../apps/web/src/features/auth/ProfileForm.js";
import { setLocale } from "../../apps/web/src/i18n/index.js";

const api = vi.hoisted(() => vi.fn());

vi.mock("../../apps/web/src/api/client.js", () => ({
  api,
  errorMessage: () => "失败",
}));

const user = {
  id: "admin",
  username: "admin",
  displayName: "管理员",
  role: "admin" as const,
  disabled: false,
  timeZone: "Asia/Shanghai",
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: null,
};

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
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
  }

  window.ResizeObserver ??= class {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  };
});

afterEach(async () => {
  cleanup();
  api.mockReset();
  await setLocale("zh-CN");
});

it("语言要保存后才切换，未保存时界面保持原语言", async () => {
  api.mockResolvedValue({ user });
  await setLocale("zh-CN");
  render(
    <App>
      <ProfileForm user={user} onUserChange={() => undefined} />
    </App>
  );

  await userEvent.click(screen.getByText("English"));

  expect(screen.getByRole("button", { name: "保存资料" })).toBeVisible();
  expect(document.documentElement.lang).toBe("zh-CN");

  await userEvent.click(screen.getByRole("button", { name: "保存资料" }));

  expect(api).toHaveBeenCalledWith("/auth/profile", "PUT", {
    displayName: "管理员",
    timeZone: "Asia/Shanghai",
  });
  expect(document.documentElement.lang).toBe("en");
  expect(screen.getByRole("button", { name: "Save profile" })).toBeVisible();
});
