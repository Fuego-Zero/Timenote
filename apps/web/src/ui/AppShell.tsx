import type { PublicUser } from "@timenote/contracts";
import { Button, Dropdown, Tabs } from "antd";
import { useState } from "react";

import { UsersPage } from "../features/admin/UsersPage.js";
import { AccountModal } from "../features/auth/AccountModal.js";
import { BackupPage } from "../features/backup/BackupPage.js";
import { EventsPage } from "../features/events/EventsPage.js";
import { FeedsPage } from "../features/feeds/FeedsPage.js";

export function AppShell({
  user,
  onUserChange,
  onLogout,
}: {
  user: PublicUser;
  onUserChange: (user: PublicUser) => void;
  onLogout: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const items = [
    { key: "events", label: "事件", children: <EventsPage user={user} /> },
    { key: "feeds", label: "订阅", children: <FeedsPage /> },
    { key: "backup", label: "备份", children: <BackupPage /> },
    ...(user.role === "admin" ? [{ key: "users", label: "账号管理", children: <UsersPage currentUser={user} /> }] : []),
  ];
  return (
    <>
      <header className="app-header">
        <span className="app-brand">timenote 纪念日</span>
        <Dropdown
          menu={{
            items: [
              { key: "account", label: "账号设置" },
              { key: "logout", label: "退出登录" },
            ],
            onClick: ({ key }) => (key === "logout" ? onLogout() : setAccountOpen(true)),
          }}
        >
          <Button>{user.displayName || user.username}</Button>
        </Dropdown>
      </header>
      <main className="app-main">
        <Tabs destroyOnHidden items={items} />
      </main>
      <AccountModal open={accountOpen} user={user} onClose={() => setAccountOpen(false)} onUserChange={onUserChange} />
    </>
  );
}
