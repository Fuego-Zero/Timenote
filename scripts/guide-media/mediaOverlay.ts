import type { BrowserContext, Locator, Page } from "@playwright/test";

/**
 * 素材标注层：挂在 <html> 下、不接收点击，与产品界面明显区分（琥珀色虚线框、深色字幕条）。
 * 不挂在 <body> 下，避免触发引导对页面结构的监听。
 */
const rootId = "guide-media-overlay";

/** 录制上下文需 bypassCSP：页面只放行带 nonce 的样式，标注和二维码模糊都是脚本注入的。 */
export async function prepareMediaContext(context: BrowserContext) {
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      // 订阅二维码含私密 token，所有素材里都模糊处理。
      style.textContent = ".ant-qrcode { filter: blur(7px); }";
      document.head.append(style);
    });
  });
}

async function ensureRoot(page: Page) {
  await page.evaluate(id => {
    if (document.getElementById(id)) {
      return;
    }

    const root = document.createElement("div");
    root.id = id;
    Object.assign(root.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });
    document.documentElement.append(root);
  }, rootId);
}

/** 在目标外画一圈标注框，并在上方（空间不够时下方）放一段说明。 */
export async function annotate(page: Page, target: Locator, label: string) {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`标注目标不可见：${label}`);
  }

  await ensureRoot(page);
  await page.evaluate(
    ({ id, box: rect, label: text }) => {
      const root = document.getElementById(id);
      if (!root) {
        return;
      }

      const pad = 6;
      const frame = document.createElement("div");
      Object.assign(frame.style, {
        position: "fixed",
        left: `${rect.x - pad}px`,
        top: `${rect.y - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
        border: "3px dashed #f59e0b",
        borderRadius: "12px",
        boxShadow: "0 0 0 4px rgba(245, 158, 11, 0.18)",
      });
      const note = document.createElement("div");
      note.textContent = text;
      Object.assign(note.style, {
        position: "fixed",
        left: `${Math.max(8, Math.min(rect.x - pad, window.innerWidth - 420))}px`,
        maxWidth: "400px",
        padding: "6px 12px",
        borderRadius: "8px",
        background: "#1f2937",
        color: "#fff",
        font: "500 15px/1.5 system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
      });
      const above = rect.y - pad - 44 > 0;
      note.style.top = above ? `${rect.y - pad - 44}px` : `${rect.y + rect.height + pad + 8}px`;
      root.append(frame, note);
    },
    { id: rootId, box, label }
  );
}

/** 视频字幕：静音观看也能看懂每一步在做什么。 */
export async function caption(page: Page, text: string) {
  await ensureRoot(page);
  await page.evaluate(
    ({ id, text: value }) => {
      const root = document.getElementById(id);
      if (!root) {
        return;
      }

      let bar = root.querySelector<HTMLDivElement>("[data-caption]");
      if (!bar) {
        bar = document.createElement("div");
        bar.dataset.caption = "";
        Object.assign(bar.style, {
          position: "fixed",
          left: "50%",
          bottom: "28px",
          transform: "translateX(-50%)",
          maxWidth: "86%",
          padding: "10px 20px",
          borderRadius: "10px",
          background: "rgba(17, 24, 39, 0.88)",
          color: "#fff",
          font: "500 20px/1.5 system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          textAlign: "center",
        });
        root.append(bar);
      }

      bar.textContent = value;
    },
    { id: rootId, text }
  );
}

export async function clearOverlay(page: Page) {
  await page.evaluate(id => document.getElementById(id)?.replaceChildren(), rootId);
}

/** Playwright 录屏不带鼠标指针；画一个指针点并移到目标中心，观众才看得出点了哪里。 */
async function movePointer(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("指针目标不可见");
  }

  await ensureRoot(page);
  await page.evaluate(
    ({ id, x, y }) => {
      const root = document.getElementById(id);
      if (!root) {
        return;
      }

      let dot = root.querySelector<HTMLDivElement>("[data-pointer]");
      if (!dot) {
        dot = document.createElement("div");
        dot.dataset.pointer = "";
        Object.assign(dot.style, {
          position: "fixed",
          left: `${window.innerWidth / 2}px`,
          top: `${window.innerHeight / 2}px`,
          width: "22px",
          height: "22px",
          margin: "-11px 0 0 -11px",
          borderRadius: "50%",
          background: "rgba(245, 158, 11, 0.55)",
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.9)",
          transition: "left 450ms ease, top 450ms ease",
        });
        root.append(dot);
        void dot.offsetWidth;
      }

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    },
    { id: rootId, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  );
  await page.waitForTimeout(550);
}

export async function pointAt(page: Page, target: Locator, holdMs = 1200) {
  await movePointer(page, target);
  await page.waitForTimeout(holdMs);
}

export async function clickVisibly(page: Page, target: Locator) {
  await movePointer(page, target);
  await target.click();
}
