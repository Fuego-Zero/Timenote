import type { FeedbackClientConfig, PublicUser } from "@timenote/contracts";
import { useCallback, useEffect, useState } from "react";

import { api, authExpiredEvent, clearRequestSign } from "../../api/client.js";

type SessionState =
  | { status: "loading" }
  | {
      status: "ready";
      user: PublicUser | null;
      publicRegisterEnabled: boolean;
      registerDefaultDisabled: boolean;
      feedback: FeedbackClientConfig | null;
    }
  | { status: "error" };

function readFeedback(value: { serverUrl?: string; ak?: string } | undefined): FeedbackClientConfig | null {
  if (!value?.serverUrl || !value.ak) {
    return null;
  }

  return { serverUrl: value.serverUrl, ak: value.ak };
}

function keptRegisterFlags(prev: SessionState) {
  if (prev.status === "ready") {
    return {
      publicRegisterEnabled: prev.publicRegisterEnabled,
      registerDefaultDisabled: prev.registerDefaultDisabled,
      feedback: prev.feedback,
    };
  }

  return { publicRegisterEnabled: false, registerDefaultDisabled: true, feedback: null };
}

export function useSession() {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api<{
      user: PublicUser | null;
      publicRegisterEnabled?: boolean;
      registerDefaultDisabled?: boolean;
      feedback?: { serverUrl?: string; ak?: string };
    }>("/auth/session").then(
      data => {
        if (active) {
          setState({
            status: "ready",
            user: data.user,
            publicRegisterEnabled: data.publicRegisterEnabled === true,
            registerDefaultDisabled: data.registerDefaultDisabled !== false,
            feedback: readFeedback(data.feedback),
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
      setState(prev => ({ status: "ready", user: null, ...keptRegisterFlags(prev) }));
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
      ...keptRegisterFlags(prev),
    }));
  }, []);
  const logout = useCallback(async () => {
    await api("/auth/logout", "POST");
    clearRequestSign();
    setState(prev => ({
      status: "ready",
      user: null,
      ...keptRegisterFlags(prev),
    }));
  }, []);

  return { state, reload, setUser, logout };
}
