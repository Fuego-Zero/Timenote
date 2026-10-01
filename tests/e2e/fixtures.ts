import { expect, type Locator, type Page } from "@playwright/test";

export const adminPassword = "e2e-admin-password";

export async function login(page: Page, username = "admin", password = adminPassword) {
  await page.goto("/");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登 录" }).click();
  await expect(page.getByRole("tab", { name: "事件" })).toBeVisible();
}

export async function logout(page: Page, displayName: string) {
  await page.getByRole("banner").getByRole("button", { name: displayName, exact: true }).click();
  await page.getByText("退出登录").click();
  await expect(page.getByRole("button", { name: "登 录" })).toBeVisible();
}

/** antd Select 使用虚拟列表，靠后的选项不在 DOM 里；用键盘移动高亮项直到命中再回车。 */
export async function pickOption(page: Page, select: Locator, label: string) {
  await select.click();
  await expect(select).toHaveAttribute("aria-expanded", "true");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const activeId = await select.getAttribute("aria-activedescendant");
    const active = activeId ? await page.locator(`[id="${activeId}"]`).getAttribute("aria-label") : null;
    if (active === label) {
      await page.keyboard.press("Enter");
      await expect(select).toHaveAttribute("aria-expanded", "false");
      return;
    }

    await page.keyboard.press("ArrowDown");
  }

  throw new Error(`下拉框里找不到选项：${label}`);
}

/** 收集 CSP 违规；页面使用 nonce，任何内联脚本或样式被拦截都应视为失败。 */
export function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", message => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });
  return violations;
}
