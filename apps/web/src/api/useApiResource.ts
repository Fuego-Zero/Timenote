import { useCallback, useEffect, useState } from "react";

import { api } from "./client.js";

/** 读取一个 GET 资源；reload 触发重新请求，旧数据在新结果返回前保留。 */
export function useApiResource<T>(path: string) {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api<T>(path).then(
      data => {
        if (active) {
          setState({ data });
        }
      },
      (error: unknown) => {
        if (active) {
          setState(previous => ({ data: previous.data, error }));
        }
      }
    );
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { data: state.data, error: state.error, reload };
}
