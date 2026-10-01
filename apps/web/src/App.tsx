import { Button, Result, Spin } from "antd";

import { LoginPage } from "./features/auth/LoginPage.js";
import { useSession } from "./features/auth/useSession.js";
import { AppProviders } from "./ui/AppProviders.js";
import { AppShell } from "./ui/AppShell.js";

function Root() {
  const session = useSession();
  if (session.state.status === "loading") {
    return <Spin fullscreen tip="加载中" />;
  }

  if (session.state.status === "error") {
    return <Result extra={<Button onClick={session.reload}>重试</Button>} status="warning" title="无法连接服务" />;
  }

  if (!session.state.user) {
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
