import { Button, Layout, Result, Spin, theme } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "./api/client.js";
import { LoginPage } from "./features/auth/LoginPage.js";
import { SetupPage } from "./features/auth/SetupPage.js";
import { useSession } from "./features/auth/useSession.js";
import { AppProviders } from "./ui/AppProviders.js";
import { AppShell } from "./ui/AppShell.js";

function Loading() {
  const { t } = useTranslation("common");
  const { token } = theme.useToken();
  return (
    <Spin
      fullscreen
      description={t("loading")}
      styles={{
        root: { backgroundColor: token.colorBgLayout },
        section: { color: token.colorPrimary },
        description: { color: token.colorPrimary },
      }}
    />
  );
}

function Root() {
  const { t } = useTranslation("common");
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
    return <Loading />;
  }

  if (session.state.status === "error") {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Layout.Content>
          <Result
            extra={<Button onClick={session.reload}>{t("retry")}</Button>}
            status="warning"
            title={t("serviceUnavailable")}
          />
        </Layout.Content>
      </Layout>
    );
  }

  if (!session.state.user) {
    if (setupNeeded === null) {
      return <Loading />;
    }

    if (setupNeeded) {
      return <SetupPage onReady={session.setUser} />;
    }

    return (
      <LoginPage
        publicRegisterEnabled={session.state.publicRegisterEnabled}
        registerDefaultDisabled={session.state.registerDefaultDisabled}
        onLogin={session.setUser}
      />
    );
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
