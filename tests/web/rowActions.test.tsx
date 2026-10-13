// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { type RowAction, RowActions } from "../../apps/web/src/ui/RowActions.js";

beforeAll(() => {
  // antd 响应式与浮层组件依赖 matchMedia、ResizeObserver，jsdom 未实现。
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  });
});
afterEach(cleanup);

it("各操作之间用竖线分隔", () => {
  const { container } = render(
    <RowActions
      actions={[
        { key: "a", label: "编辑" },
        { key: "b", label: "复制" },
        { key: "c", label: "轮换" },
      ]}
    />
  );
  expect(container.querySelectorAll(".ant-divider-vertical")).toHaveLength(2);
});

it("置灰操作悬停时以 Tooltip 显示原因", async () => {
  render(
    <RowActions actions={[{ key: "a", label: "删除", disabled: true, disabledReason: "不能操作当前登录账号" }]} />
  );
  expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  const trigger = screen.getByRole("button", { name: "删除" }).parentElement;
  expect(trigger).not.toBeNull();
  if (trigger) {
    await userEvent.hover(trigger);
  }

  expect(await screen.findByText("不能操作当前登录账号")).toBeInTheDocument();
});

it("取消确认后不触发回调，确认后触发", async () => {
  const onClick = vi.fn();
  render(
    <RowActions
      actions={[
        {
          key: "revoke",
          label: "撤销",
          danger: true,
          confirm: { title: "撤销地址", description: "无法恢复", okText: "撤销", okDanger: true },
          onClick,
        },
      ]}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "撤销" }));
  await userEvent.click(await screen.findByRole("button", { name: /^(取\s?消|Cancel)$/ }));
  expect(onClick).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "撤销" }));
  const ok = screen.getAllByRole("button", { name: /^撤\s?销$/ }).find(button => button.closest(".ant-popover"));
  expect(ok).toBeDefined();
  if (ok) {
    await userEvent.click(ok);
  }

  await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
});

it("标红操作在类型层面必须带确认", () => {
  // @ts-expect-error danger 为 true 时 confirm 必填。
  const action: RowAction = { key: "a", label: "删除", danger: true };
  expect(action.danger).toBe(true);
});
