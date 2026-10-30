import type { FeedbackClientConfig, PublicUser } from "@timenote/contracts";
import { Button, Dropdown, Flex, Layout, Tabs, theme, Typography } from "antd";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { UsersPage } from "../features/admin/UsersPage.js";
import { PasswordModal } from "../features/auth/PasswordModal.js";
import { ProfileModal } from "../features/auth/ProfileModal.js";
import { BackupPage } from "../features/backup/BackupPage.js";
import { EventsPage } from "../features/events/EventsPage.js";
import { FeedbackButton } from "../features/feedback/FeedbackButton.js";
import { FeedsPage } from "../features/feeds/FeedsPage.js";
import { GuideChecklist } from "../features/guide/GuideChecklist.js";
import { GuideProvider } from "../features/guide/GuideProvider.js";
import { guideTargets } from "../features/guide/guideTargets.js";
import { HelpButton } from "../features/guide/HelpButton.js";
import { enumParam, writeUrlState } from "./urlState.js";
import { replaceSearch, useUrlState } from "./useUrlState.js";

const tabSchema = enumParam("tab", ["events", "feeds", "backup", "users"], "events");

export function AppShell({
  user,
  feedback = null,
  onUserChange,
  onLogout,
}: {
  user: PublicUser;
  feedback?: FeedbackClientConfig | null;
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
    {
      key: "feeds",
      label: <span data-guide={guideTargets.feedsTab}>{t("nav.feeds")}</span>,
      children: <FeedsPage user={user} />,
    },
    { key: "backup", label: t("nav.backup"), children: <BackupPage /> },
    ...(user.role === "admin"
      ? [{ key: "users", label: t("nav.users"), children: <UsersPage currentUser={user} /> }]
      : []),
  ];
  const activeTab = items.some(item => item.key === tab) ? tab : "events";
  const selectTab = useCallback(
    (key: string) => {
      const next = tabSchema.parse({ tab: key }).tab;
      if (next === activeTab) {
        return;
      }

      // 切换页签时清掉上一页的查询参数，新页面从默认状态开始。
      replaceSearch(writeUrlState(tabSchema, { tab: next }, ""));
      setTab({ tab: next });
    },
    [activeTab, setTab]
  );

  return (
    <GuideProvider key={user.id} user={user} onNavigate={selectTab}>
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
            <Flex align="center" gap={8}>
              {feedback && <FeedbackButton ak={feedback.ak} serverUrl={feedback.serverUrl} userId={user.id} />}
              <HelpButton />
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
          <GuideChecklist />
          <Tabs destroyOnHidden activeKey={activeTab} items={items} onChange={selectTab} />
        </Layout.Content>
        <ProfileModal
          open={profileOpen}
          user={user}
          onClose={() => setProfileOpen(false)}
          onUserChange={onUserChange}
        />
        <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      </Layout>
    </GuideProvider>
  );
}
