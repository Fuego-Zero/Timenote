import { responseError } from "./apiRequestError.js";
import {
  buildClientSignHeaders,
  clearRequestSign,
  isSignExemptClientPath,
  setAnonSign,
  setSessionSignKey,
} from "./requestSign.js";
import { getRequestSignState } from "./requestSignState.js";

const apiTimeoutMs = 30000;

/** 会话失效时广播，由会话 Hook 统一切回登录页，各页面不必各自处理。 */
export const authExpiredEvent = "timenote:auth-expired";

interface SignBearing {
  anonSign?: Parameters<typeof setAnonSign>[0];
  signKey?: string;
}

function applySignFromBody(data: SignBearing) {
  if ("signKey" in data) {
    setSessionSignKey(data.signKey);
  }

  if ("anonSign" in data) {
    setAnonSign(data.anonSign);
  }
}

/** 从 /auth/session 重新领取 signKey（该路径免签）；供 SIGN 失败后单次重试。 */
async function refreshSignFromSession() {
  clearRequestSign();
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "same-origin",
    signal: AbortSignal.timeout(apiTimeoutMs),
  });
  if (!response.ok) {
    return;
  }

  applySignFromBody((await response.json()) as SignBearing);
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return apiOnce<T>(path, method, body, false);
}

async function apiOnce<T>(path: string, method: string, body: unknown, isRetry: boolean): Promise<T> {
  const apiUrl = `/api${path}`;
  const bodyText = body === undefined ? undefined : JSON.stringify(body);
  const signHeaders = isSignExemptClientPath(method, path)
    ? {}
    : await buildClientSignHeaders({ method, apiUrl, bodyText });
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
      throw error;
    }

    // 旁路换人或 HMR 丢 key 后，客户端仍持旧 signKey 会 SIGN_INVALID；拉一次 session 后单次重试。
    if (
      !isRetry &&
      (error.code === "SIGN_INVALID" || error.code === "SIGN_EXPIRED") &&
      !isSignExemptClientPath(method, path)
    ) {
      await refreshSignFromSession();
      if (getRequestSignState()) {
        return apiOnce<T>(path, method, body, true);
      }
    }

    throw error;
  }

  const data = (await response.json()) as T & SignBearing;
  if (data && typeof data === "object") {
    applySignFromBody(data);
  }

  return data;
}
