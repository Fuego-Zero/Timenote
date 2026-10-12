export function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }

  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeClientSignPath(url: string): string {
  const path = (url.split("?")[0] || "/").trim() || "/";
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export function normalizeClientSignQuery(url: string): string {
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

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes.buffer);
}
