import { responseError } from "./apiRequestError.js";
import {
  buildClientSignHeaders,
  clearRequestSign,
  isSignExemptClientPath,
  setAnonSign,
  setSessionSignKey,
} from "./requestSign.js";

const apiTimeoutMs = 30000;

/** 会话失效时广播，由会话 Hook 统一切回登录页，各页面不必各自处理。 */
export const authExpiredEvent = "timenote:auth-expired";

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const apiUrl = `/api${path}`;
  const bodyText = body === undefined ? undefined : JSON.stringify(body);
  const signHeaders =
    isSignExemptClientPath(method, path) ? {} : await buildClientSignHeaders({ method, apiUrl, bodyText });
  const response = await fetch(apiUrl, {
    method,
    signal: AbortSignal.timeout(apiTimeoutMs),
    credentials: "same-origin",
    headers: {
      ...(bodyText === undefined ? {} : { "Content-Type": "application/json" }),
      ...signHeaders,
    },
    ...(bodyText === undefined ? {} : { body: bodyText }),
  });
  if (!response.ok) {
    const error = await responseError(response);
    if (error.code === "AUTH_REQUIRED") {
      clearRequestSign();
      window.dispatchEvent(new Event(authExpiredEvent));
    }

    throw error;
  }

  const data = (await response.json()) as T & { signKey?: string; anonSign?: Parameters<typeof setAnonSign>[0] };
  if (data && typeof data === "object") {
    if ("signKey" in data) {
      setSessionSignKey(data.signKey);
    }

    if ("anonSign" in data) {
      setAnonSign(data.anonSign);
    }
  }

  return data;
}
