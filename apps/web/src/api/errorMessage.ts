import { ApiRequestError } from "./apiRequestError.js";

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return error instanceof Error && error.name === "TimeoutError" ? "请求超时，请稍后重试" : "网络异常，请稍后重试";
}
