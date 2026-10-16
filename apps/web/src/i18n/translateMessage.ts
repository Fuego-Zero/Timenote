import { type ErrorCode, type FieldError, parseIssueDetail } from "@timenote/contracts";

import { i18n } from "./index.js";

function sentence(key: string, params?: Record<string, string | number>) {
  return i18n.t(key, { ns: "errors", ...params, defaultValue: i18n.t("codes.INVALID_INPUT", { ns: "errors" }) });
}

/** 把稳定 detail 或校验 message 转成当前语言的句子。 */
export function translateDetail(detail: string, params?: Record<string, string | number>) {
  const parsed = /^[a-z0-9_]+$/.test(detail) ? { detail, params } : parseIssueDetail(detail);
  const vars = parsed.params?.vars;
  const formatted =
    typeof vars === "string"
      ? {
          ...parsed.params,
          vars: vars
            .split(",")
            .map(name => `{{${name}}}`)
            .join(i18n.t("titleFields.and", { ns: "events" })),
        }
      : parsed.params;
  return sentence(`details.${parsed.detail}`, formatted);
}

export function translateApiMessage(code: ErrorCode, detail?: string, params?: Record<string, string | number>) {
  if (detail) {
    return translateDetail(detail, params);
  }

  return sentence(`codes.${code}`);
}

export function translateFieldError(field: FieldError) {
  return translateDetail(field.detail, field.params);
}
