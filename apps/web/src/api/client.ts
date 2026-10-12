import { apiErrorSchema, type ErrorCode } from "@timenote/contracts";

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

/** API 失败统一转成带 code 与字段定位的错误，界面据此提示或标红字段。 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function responseError(response: Response) {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) {
    return new ApiRequestError(response.status, parsed.data.code, parsed.data.message, parsed.data.fields);
  }

  return new ApiRequestError(response.status, "INTERNAL_ERROR", "服务暂时不可用");
}

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

export { clearRequestSign, setAnonSign, setSessionSignKey };


export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return error instanceof Error && error.name === "TimeoutError" ? "请求超时，请稍后重试" : "网络异常，请稍后重试";
}
