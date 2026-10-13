import type { PublicUser } from "@timenote/contracts";
import { Button, Dropdown, Flex, Layout, Tabs, theme, Typography } from "antd";
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
  const { token } = theme.useToken();
  const [accountOpen, setAccountOpen] = useState(false);
  const forcePasswordChange = Boolean(user.mustChangePassword);
  const items = [
    { key: "events", label: "事件", children: <EventsPage user={user} /> },
    { key: "feeds", label: "订阅", children: <FeedsPage /> },
    { key: "backup", label: "备份", children: <BackupPage /> },
    ...(user.role === "admin" ? [{ key: "users", label: "账号管理", children: <UsersPage currentUser={user} /> }] : []),
  ];
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: `max(${token.paddingSM}px, env(safe-area-inset-top))`,
        }}
      >
        <Flex align="center" gap={12} justify="space-between">
          <Typography.Text strong style={{ fontSize: token.fontSizeLG, whiteSpace: "nowrap" }}>
            timenote 纪念日
          </Typography.Text>
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
        </Flex>
      </Layout.Header>
      <Layout.Content
        style={{
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          padding: token.paddingSM,
          paddingBottom: `max(${token.paddingXL}px, env(safe-area-inset-bottom))`,
        }}
      >
        <Tabs destroyOnHidden items={items} />
      </Layout.Content>
      <AccountModal
        forcePasswordChange={forcePasswordChange}
        open={accountOpen || forcePasswordChange}
        user={user}
        onClose={() => setAccountOpen(false)}
        onUserChange={onUserChange}
      />
    </Layout>
  );
}
