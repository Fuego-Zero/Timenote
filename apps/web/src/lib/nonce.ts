export function readCspNonce() {
  const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce;
  if (nonce) {
    return nonce;
  }

  return document.querySelector<HTMLMetaElement>('meta[name="tn-nonce"]')?.content ?? "";
}
