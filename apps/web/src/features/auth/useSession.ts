import type { PublicUser } from "@timenote/contracts";
import { useCallback, useEffect, useState } from "react";

import { api, authExpiredEvent, clearRequestSign } from "../../api/client.js";

type SessionState =
  | { status: "loading" }
  | { status: "ready"; user: PublicUser | null; publicRegisterEnabled: boolean }
  | { status: "error" };

export function useSession() {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api<{ user: PublicUser | null; publicRegisterEnabled?: boolean }>("/auth/session").then(
      data => {
        if (active) {
          setState({
            status: "ready",
            user: data.user,
            publicRegisterEnabled: data.publicRegisterEnabled === true,
          });
        }
      },
      () => {
        if (active) {
          setState({ status: "error" });
        }
      }
    );
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    const expire = () => {
      clearRequestSign();
      setState(prev =>
        prev.status === "ready"
          ? { status: "ready", user: null, publicRegisterEnabled: prev.publicRegisterEnabled }
          : { status: "ready", user: null, publicRegisterEnabled: false }
      );
    };

    window.addEventListener(authExpiredEvent, expire);
    return () => window.removeEventListener(authExpiredEvent, expire);
  }, []);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion(value => value + 1);
  }, []);
  const setUser = useCallback((user: PublicUser | null) => {
    setState(prev => ({
      status: "ready",
      user,
      publicRegisterEnabled: prev.status === "ready" ? prev.publicRegisterEnabled : false,
    }));
  }, []);
  const logout = useCallback(async () => {
    await api("/auth/logout", "POST");
    clearRequestSign();
    setState(prev => ({
      status: "ready",
      user: null,
      publicRegisterEnabled: prev.status === "ready" ? prev.publicRegisterEnabled : false,
    }));
  }, []);

  return { state, reload, setUser, logout };
}
