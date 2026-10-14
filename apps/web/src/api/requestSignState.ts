import type { AnonSign } from "@timenote/contracts";

export type SignState =
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
