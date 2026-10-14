export const BODY_LIMIT_BYTES = 8192;

/** 订阅地址里的 token 只保留前 4 位，日志不记录完整 token。 */
export function redactPath(path: string) {
  return path.replace(/^\/api\/feeds\/([^/?]+?)(\.ics)?$/, (_match, token: string, suffix = "") => {
    return `/api/feeds/${token.slice(0, 4)}…${suffix}`;
  });
}

function sensitiveKey(key: string) {
  return /password|token|authorization|cookie|url|signkey|signature|anonsign/i.test(key);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = sensitiveKey(key) ? "[redacted]" : redact(nested);
    }

    return out;
  }

  return value;
}

export function clipBody(value: unknown, limit = BODY_LIMIT_BYTES): unknown {
  if (value === undefined) {
    return undefined;
  }

  const json = typeof value === "string" ? value : (JSON.stringify(value) ?? "null");
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes <= limit) {
    return value;
  }

  return { truncated: true, bytes, preview: json.slice(0, limit) };
}
