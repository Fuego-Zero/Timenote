import {
  canonicalSignPayload,
  requestSignHeaderNames,
  type AnonSign,
} from "@timenote/contracts";

type SignState =
  | { kind: "session"; signKey: string }
  | { kind: "anon"; anonKeyId: string; signKey: string; expiresAt: number }
  | null;

let state: SignState = null;

export function clearRequestSign() {
  state = null;
}

export function setSessionSignKey(signKey: string | undefined) {
  if (!signKey) {
    return;
  }

  state = { kind: "session", signKey };
}

export function setAnonSign(anon: AnonSign | undefined) {
  if (!anon) {
    return;
  }

  state = {
    kind: "anon",
    anonKeyId: anon.anonKeyId,
    signKey: anon.signKey,
    expiresAt: anon.expiresAt,
  };
}

export function getRequestSignState(): SignState {
  return state;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }

  return out;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizePath(url: string): string {
  const path = (url.split("?")[0] || "/").trim() || "/";
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

function normalizeQuery(url: string): string {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) {
    return "";
  }

  const qs = url.slice(qIndex + 1);
  if (!qs) {
    return "";
  }

  const params = new URLSearchParams(qs);
  const pairs: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    pairs.push([key, value]);
  }

  pairs.sort((a, b) => {
    if (a[0] !== b[0]) {
      return a[0] < b[0] ? -1 : 1;
    }

    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes.buffer);
}

/** 为 `/api...` 完整路径生成签名头；无可用密钥时返回空对象。 */
export async function buildClientSignHeaders(input: {
  method: string;
  apiUrl: string;
  bodyText?: string;
}): Promise<Record<string, string>> {
  const current = state;
  if (!current) {
    return {};
  }

  if (current.kind === "anon" && current.expiresAt <= Date.now()) {
    state = null;
    return {};
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomNonce();
  const payload = canonicalSignPayload({
    method: input.method,
    path: normalizePath(input.apiUrl),
    query: normalizeQuery(input.apiUrl),
    timestamp,
    nonce,
    bodyHash: await sha256Hex(input.bodyText ?? ""),
  });
  const keyBytes = base64UrlToBytes(current.signKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = bytesToBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const headers: Record<string, string> = {
    [requestSignHeaderNames.timestamp]: timestamp,
    [requestSignHeaderNames.nonce]: nonce,
    [requestSignHeaderNames.signature]: signature,
  };
  if (current.kind === "anon") {
    headers[requestSignHeaderNames.anonId] = current.anonKeyId;
  }

  return headers;
}

export function isSignExemptClientPath(method: string, apiPath: string): boolean {
  // apiPath 形如 `/auth/session`（client 传入的是 `/api` 之后的部分）
  const full = apiPath.startsWith("/api/") ? apiPath : `/api${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const path = full.split("?")[0] ?? full;
  if (path.startsWith("/api/feeds/") || path === "/health") {
    return true;
  }

  const upper = method.toUpperCase();
  return upper === "GET" && (path === "/api/auth/session" || path === "/api/setup");
}
