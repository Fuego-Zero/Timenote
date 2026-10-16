import { i18n } from "../i18n/index.js";
import { translateApiMessage, translateDetail } from "../i18n/translateMessage.js";
import { ApiRequestError } from "./apiRequestError.js";

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return translateApiMessage(error.code, error.detail, error.params);
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return i18n.t("timeoutError", { ns: "common" });
  }

  if (error instanceof Error && error.message) {
    return translateDetail(error.message);
  }

  return i18n.t("networkError", { ns: "common" });
}
