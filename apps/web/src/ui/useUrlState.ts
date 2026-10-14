import { useCallback, useEffect, useState } from "react";

import { readUrlState, type UrlSchema, writeUrlState } from "./urlState.js";

/** 用 replaceState 替换当前地址，不新增历史记录。 */
export function replaceSearch(search: string) {
  const { pathname, hash } = window.location;
  if (search !== window.location.search) {
    window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
  }
}

/**
 * 把页面状态同步到地址栏查询参数（不引入路由库）：首次渲染从地址读取，之后每次变化用 replaceState 写回，
 * 刷新或分享链接能还原同一状态。schema 需为模块级常量。
 */
export function useUrlState<T>(schema: UrlSchema<T>) {
  const [state, setState] = useState(() => readUrlState(schema, window.location.search));

  useEffect(() => {
    replaceSearch(writeUrlState(schema, state, window.location.search));
  }, [schema, state]);

  const update = useCallback((patch: Partial<T>) => setState(current => ({ ...current, ...patch })), []);
  return [state, update] as const;
}
