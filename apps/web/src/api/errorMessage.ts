import { i18n } from "../i18n/index.js";
import { ApiRequestError } from "./apiRequestError.js";

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return error instanceof Error && error.name === "TimeoutError"
    ? i18n.t("timeoutError", { ns: "common" })
    : i18n.t("networkError", { ns: "common" });
}
