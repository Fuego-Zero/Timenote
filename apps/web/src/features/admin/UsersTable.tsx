import { maxQueryLength, type PageQuery, type PageResult, type PublicUser } from "@timenote/contracts";
import { Button, Empty, Input, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveLocale } from "../../i18n/index.js";
import { RowActions } from "../../ui/RowActions.js";

const searchDebounceMs = 300;

function dateTime(ms: number, intl: string) {
  return new Date(ms).toLocaleString(intl, { hour12: false });
}

function StatusSwitch({
  user,
  self,
  onToggle,
}: {
  user: PublicUser;
  self: boolean;
  onToggle: (user: PublicUser) => void;
}) {
  const { t } = useTranslation("admin");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const enabled = !user.disabled;
  const switchNode = (
    <Switch
      checked={enabled}
      checkedChildren={t("enabledShort")}
      disabled={self}
      unCheckedChildren={t("disabledShort")}
      onChange={checked => {
        if (self) {
          return;
        }

        if (checked) {
          onToggle(user);
          return;
        }

        setConfirmOpen(true);
      }}
    />
  );

  if (self) {
    return (
      <Tooltip title={t("selfDisabled")}>
        <span>{switchNode}</span>
      </Tooltip>
    );
  }

  return (
    <Popconfirm
      description={t("disableDesc")}
      okText={t("disabledShort")}
      open={confirmOpen}
      title={t("disableTitle")}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={() => {
        onToggle(user);
        setConfirmOpen(false);
      }}
      onOpenChange={open => {
        if (!open) {
          setConfirmOpen(false);
        }
      }}
    >
      <span>{switchNode}</span>
    </Popconfirm>
  );
}

export function UsersTable({
  page,
  loading,
  query,
  onQueryChange,
  currentUserId,
  onToggleDisabled,
  onToggleRole,
  onResetPassword,
  onRemove,
}: {
  page: PageResult<PublicUser> | undefined;
  loading: boolean;
  query: PageQuery;
  onQueryChange: (patch: Partial<PageQuery>) => void;
  currentUserId: string;
  onToggleDisabled: (user: PublicUser) => void;
  onToggleRole: (user: PublicUser) => void;
  onResetPassword: (user: PublicUser) => void;
  onRemove: (user: PublicUser) => void;
}) {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const { intl } = resolveLocale(i18n.language);
  const [search, setSearch] = useState(query.q ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search.trim() || undefined;
      if (q !== query.q) {
        onQueryChange({ q, page: 1 });
      }
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, query.q, onQueryChange]);

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      <Input
        allowClear
        maxLength={maxQueryLength}
        placeholder={t("searchPlaceholder")}
        style={{ maxWidth: 240 }}
        value={search}
        aria-label={t("searchAria")}
        onChange={event => setSearch(event.target.value)}
      />
      <Table<PublicUser>
        columns={[
          {
            title: t("username"),
            dataIndex: "username",
            render: (_value, user) => (
              <Space orientation="vertical" size={0}>
                <span>{user.username}</span>
                {user.displayName && <Typography.Text type="secondary">{user.displayName}</Typography.Text>}
              </Space>
            ),
          },
          {
            title: t("role"),
            dataIndex: "role",
            render: (_value, user) =>
              user.role === "admin" ? <Tag color="volcano">{t("admin")}</Tag> : <Tag>{t("user")}</Tag>,
          },
          {
            title: t("status"),
            dataIndex: "disabled",
            width: 110,
            render: (_value, user) => (
              <StatusSwitch self={user.id === currentUserId} user={user} onToggle={onToggleDisabled} />
            ),
          },
          { title: t("timeZone"), dataIndex: "timeZone" },
          {
            title: t("lastLogin"),
            dataIndex: "lastLoginAt",
            render: (_value, user) => (user.lastLoginAt === null ? "—" : dateTime(user.lastLoginAt, intl)),
          },
          {
            title: t("common:actions"),
            key: "actions",
            width: 210,
            render: (_value, user) => {
              const self = user.id === currentUserId;
              const selfReason = self ? t("selfDisabled") : undefined;
              return (
                <RowActions
                  actions={[
                    {
                      key: "toggleRole",
                      label: user.role === "admin" ? t("revokeAdmin") : t("makeAdmin"),
                      disabled: self,
                      disabledReason: selfReason,
                      confirm: {
                        title: user.role === "admin" ? t("toUserTitle") : t("toAdminTitle"),
                        description: user.role === "admin" ? t("toUserDesc") : t("toAdminDesc"),
                        okText: t("common:confirm"),
                        okDanger: false,
                      },
                      onClick: () => onToggleRole(user),
                    },
                    { key: "resetPassword", label: t("resetPassword"), onClick: () => onResetPassword(user) },
                    {
                      key: "remove",
                      label: t("common:delete"),
                      danger: true,
                      disabled: self,
                      disabledReason: selfReason,
                      confirm: {
                        title: t("deleteTitle"),
                        description: t("deleteDesc"),
                        okText: t("common:delete"),
                        okDanger: true,
                      },
                      onClick: () => onRemove(user),
                    },
                  ]}
                />
              );
            },
          },
        ]}
        dataSource={page?.items ?? []}
        loading={loading}
        locale={{
          emptyText: (
            <Empty description={t("empty")}>
              <Button onClick={() => setSearch("")}>{t("clearSearch")}</Button>
            </Empty>
          ),
        }}
        // 不提供每页条数切换：条数仍可经地址栏 pageSize 指定。
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          showSizeChanger: false,
          total: page?.total ?? 0,
        }}
        rowKey="id"
        scroll={{ x: 640 }}
        onChange={pagination => onQueryChange({ page: pagination.current ?? 1 })}
      />
    </Space>
  );
}
