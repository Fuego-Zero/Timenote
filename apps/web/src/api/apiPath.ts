/** 拼接带查询参数的 API 路径，未设置的参数省略。 */
export function apiPath(base: string, query: Readonly<Record<string, boolean | number | string | undefined>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `${base}?${text}` : base;
}
