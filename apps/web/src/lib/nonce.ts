export function readCspNonce() {
  const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce;
  if (nonce) {
    return nonce;
  }

  return document.querySelector<HTMLMetaElement>('meta[name="tn-nonce"]')?.content ?? "";
}

/**
 * @rc-component/util 的弹层滚动锁与滚动条测量直接插入 `<style>`，不读取 ConfigProvider 的 csp 配置，
 * 会被 `style-src 'nonce-…'` 拦截。给运行时创建的 style 元素统一带上本页 nonce；
 * 能调用这里的代码本身已通过 script-src 校验，且同样能读到 meta 中的 nonce，因此不放宽策略。
 */
export function nonceRuntimeStyles(nonce: string) {
  if (!nonce) {
    return;
  }

  const create = document.createElement.bind(document);
  document.createElement = (tagName: string, options?: ElementCreationOptions) => {
    const element = create(tagName, options);
    if (element instanceof HTMLStyleElement) {
      element.nonce = nonce;
    }

    return element;
  };
}
