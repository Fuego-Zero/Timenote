export type Hop = "web" | "api";

export interface TraceSpan {
  code?: string | number;
  durationMs: number;
  error?: { name: string; message: string };
  hop: Hop;
  method?: string;
  ok: boolean;
  path?: string;
  request?: unknown;
  requestId: string;
  response?: unknown;
  status?: number;
  traceId: string;
  ts?: string;
  userId?: string;
}

export function incomingTraceId(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && /^[\w-]{1,64}$/.test(trimmed) ? trimmed : fallback;
}
