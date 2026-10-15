import type { PublicUser } from "@timenote/contracts";
import { Button, Dropdown, Flex, Layout, Tabs, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { UsersPage } from "../features/admin/UsersPage.js";
import { PasswordModal } from "../features/auth/PasswordModal.js";
import { ProfileModal } from "../features/auth/ProfileModal.js";
import { BackupPage } from "../features/backup/BackupPage.js";
import { EventsPage } from "../features/events/EventsPage.js";
import { FeedsPage } from "../features/feeds/FeedsPage.js";
import { enumParam, writeUrlState } from "./urlState.js";
import { replaceSearch, useUrlState } from "./useUrlState.js";

const tabSchema = enumParam("tab", ["events", "feeds", "backup", "users"], "events");

export function AppShell({
  user,
  onUserChange,
  onLogout,
}: {
  user: PublicUser;
  onUserChange: (user: PublicUser) => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation("common");
  const { token } = theme.useToken();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [{ tab }, setTab] = useUrlState(tabSchema);
  const items = [
    { key: "events", label: t("nav.events"), children: <EventsPage user={user} /> },
    { key: "feeds", label: t("nav.feeds"), children: <FeedsPage user={user} /> },
    { key: "backup", label: t("nav.backup"), children: <BackupPage /> },
    ...(user.role === "admin"
      ? [{ key: "users", label: t("nav.users"), children: <UsersPage currentUser={user} /> }]
      : []),
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
            {t("brand")}
          </Typography.Text>
          <Dropdown
            menu={{
              items: [
                { key: "profile", label: t("nav.account") },
                { key: "password", label: t("nav.password") },
                { key: "logout", label: t("nav.logout") },
              ],
              onClick: ({ key }) => {
                if (key === "logout") {
                  onLogout();
                } else if (key === "password") {
                  setPasswordOpen(true);
                } else {
                  setProfileOpen(true);
                }
              },
            }}
          >
            <Button>{user.displayName || user.username}</Button>
          </Dropdown>
        </Flex>
      </Layout.Header>
      <Layout.Content
        style={{
          width: "100%",
          maxWidth: 1440,
          margin: "0 auto",
          padding: token.paddingSM,
          paddingBottom: `max(${token.paddingXL}px, env(safe-area-inset-bottom))`,
        }}
      >
        <Tabs
          destroyOnHidden
          activeKey={items.some(item => item.key === tab) ? tab : "events"}
          items={items}
          onChange={key => {
            const next = tabSchema.parse({ tab: key }).tab;
            // 切换页签时清掉上一页的查询参数，新页面从默认状态开始。
            replaceSearch(writeUrlState(tabSchema, { tab: next }, ""));
            setTab({ tab: next });
          }}
        />
      </Layout.Content>
      <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} onUserChange={onUserChange} />
      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Layout>
  );
}
