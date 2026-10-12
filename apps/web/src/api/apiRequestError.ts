import { apiErrorSchema, type ErrorCode } from "@timenote/contracts";

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

export async function responseError(response: Response) {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) {
    return new ApiRequestError(response.status, parsed.data.code, parsed.data.message, parsed.data.fields);
  }

  return new ApiRequestError(response.status, "INTERNAL_ERROR", "服务暂时不可用");
}
