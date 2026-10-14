/** 地址栏参数的校验 schema：结构上兼容 zod 对象（contracts 里的查询 schema 可直接传入），Web 不直接依赖 zod。 */
export interface UrlSchema<T> {
  parse(input: unknown): T;
  safeParse(
    input: unknown
  ): { success: true; data: T } | { success: false; error: { issues: readonly { path: readonly PropertyKey[] }[] } };
  readonly shape: Readonly<Record<string, unknown>>;
}

type Params = Record<string, string>;

/**
 * 按 schema 从查询串读取状态。只取 schema 声明的参数；某个参数非法时只丢弃它、回退到默认值，
 * 其余合法参数照常生效，所以手改或过期的分享链接不会让整页报错。
 */
export function readUrlState<T>(schema: UrlSchema<T>, search: string): T {
  const params = new URLSearchParams(search);
  const keys = Object.keys(schema.shape);
  let raw: Params = Object.fromEntries(
    keys.flatMap(key => {
      const value = params.get(key);
      return value === null ? [] : [[key, value]];
    })
  );
  for (let attempt = 0; attempt <= keys.length; attempt += 1) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }

    const invalid = new Set(parsed.error.issues.map(issue => String(issue.path[0])));
    raw = Object.fromEntries(Object.entries(raw).filter(([key]) => !invalid.has(key)));
  }

  return schema.parse({});
}

/** 把状态写回查询串：只改 schema 声明的参数，等于默认值或未设置的参数省略，其他参数原样保留。 */
export function writeUrlState<T>(schema: UrlSchema<T>, state: T, search: string) {
  const params = new URLSearchParams(search);
  const defaults = schema.parse({}) as Record<string, unknown>;
  const values = state as Record<string, unknown>;
  for (const key of Object.keys(schema.shape)) {
    const value = values[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (value === defaults[key]) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    } else {
      params.delete(key);
    }
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

/** 单个枚举参数（如页签）的 schema：非法或缺省时取 fallback。 */
export function enumParam<K extends string, V extends string>(
  key: K,
  values: readonly V[],
  fallback: V
): UrlSchema<Record<K, V>> {
  const valid = (value: unknown): value is V => values.includes(value as V);
  const pick = (input: unknown) =>
    input && typeof input === "object" ? (input as Record<string, unknown>)[key] : undefined;
  return {
    shape: { [key]: values },
    parse: input => {
      const value = pick(input);
      return { [key]: valid(value) ? value : fallback } as Record<K, V>;
    },
    safeParse: input => {
      const value = pick(input);
      return value === undefined || valid(value)
        ? { success: true, data: { [key]: value ?? fallback } as Record<K, V> }
        : { success: false, error: { issues: [{ path: [key] }] } };
    },
  };
}
