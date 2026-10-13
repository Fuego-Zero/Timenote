import { Button, Layout, Result, Spin } from "antd";
import { useEffect, useState } from "react";

import { api } from "./api/client.js";
import { LoginPage } from "./features/auth/LoginPage.js";
import { SetupPage } from "./features/auth/SetupPage.js";
import { useSession } from "./features/auth/useSession.js";
import { AppProviders } from "./ui/AppProviders.js";
import { AppShell } from "./ui/AppShell.js";

function Root() {
  const session = useSession();
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    if (session.state.status !== "ready" || session.state.user) {
      return;
    }

    let active = true;
    api<{ needed: boolean }>("/setup").then(
      data => {
        if (active) {
          setSetupNeeded(data.needed);
        }
      },
      () => {
        if (active) {
          setSetupNeeded(false);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [session.state]);

  if (session.state.status === "loading") {
    return <Spin fullscreen tip="加载中" />;
  }

  if (session.state.status === "error") {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Layout.Content>
          <Result extra={<Button onClick={session.reload}>重试</Button>} status="warning" title="无法连接服务" />
        </Layout.Content>
      </Layout>
    );
  }

  if (!session.state.user) {
    if (setupNeeded === null) {
      return <Spin fullscreen tip="加载中" />;
    }

    if (setupNeeded) {
      return <SetupPage onReady={session.setUser} />;
    }

    return <LoginPage onLogin={session.setUser} />;
  }

  return <AppShell user={session.state.user} onLogout={() => void session.logout()} onUserChange={session.setUser} />;
}

export default function App() {
  return (
    <AppProviders>
      <Root />
    </AppProviders>
  );
}
