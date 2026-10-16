import { apiErrorSchema, type ErrorCode, type FieldError } from "@timenote/contracts";

/** API 失败统一转成带 code、detail 与字段定位的错误，界面据此生成文案。 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public detail?: string,
    public params?: Record<string, string | number>,
    public fields: Record<string, FieldError> = {}
  ) {
    super(detail ?? code);
    this.name = "ApiRequestError";
  }
}

export async function responseError(response: Response) {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) {
    return new ApiRequestError(
      response.status,
      parsed.data.code,
      parsed.data.detail,
      parsed.data.params,
      parsed.data.fields
    );
  }

  return new ApiRequestError(response.status, "INTERNAL_ERROR");
}
