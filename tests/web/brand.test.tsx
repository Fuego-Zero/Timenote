// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";

import { LoginPage } from "../../apps/web/src/features/auth/LoginPage.js";
import { productTitle, setLocale } from "../../apps/web/src/i18n/index.js";
import { AppShell } from "../../apps/web/src/ui/AppShell.js";

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

  // 顶栏会带上事件表格，jsdom 没有这两项。
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
  window.getComputedStyle = () =>
    ({
      getPropertyValue: () => "",
    }) as unknown as CSSStyleDeclaration;
});

afterEach(async () => {
  cleanup();
  await setLocale("zh-CN");
});

it("顶栏和登录页只显示当前语言的产品名，标签页保持双语全称", async () => {
  document.title = "临时标题";
  await setLocale("zh-CN");
  render(
    <AppShell
      user={{
        id: "admin",
        username: "admin",
        displayName: "管理员",
        role: "admin",
        disabled: false,
        timeZone: "Asia/Shanghai",
        createdAt: 1,
        updatedAt: 1,
        lastLoginAt: null,
      }}
      onLogout={() => undefined}
      onUserChange={() => undefined}
    />
  );
  render(<LoginPage registerDefaultDisabled publicRegisterEnabled={false} onLogin={() => undefined} />);

  const banner = screen.getByRole("banner");
  expect(banner).toHaveTextContent("岁时记");
  expect(banner).not.toHaveTextContent("Timenote");
  expect(screen.queryByRole("button", { name: "反 馈" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("岁时记");
  expect(document.title).toBe(productTitle);

  await setLocale("en");
  expect(banner).toHaveTextContent("Timenote");
  expect(banner).not.toHaveTextContent("岁时记");
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Timenote");
  expect(document.title).toBe(productTitle);
});
