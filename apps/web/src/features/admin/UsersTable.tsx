import { maxQueryLength, type PageQuery, type PageResult, type PublicUser } from "@timenote/contracts";
import { Button, Empty, Input, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";

import { RowActions } from "../../ui/RowActions.js";

const searchDebounceMs = 300;
const selfDisabledReason = "不能操作当前登录账号";

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const enabled = !user.disabled;
  const switchNode = (
    <Switch
      checked={enabled}
      checkedChildren="启用"
      disabled={self}
      unCheckedChildren="停用"
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
      <Tooltip title={selfDisabledReason}>
        <span>{switchNode}</span>
      </Tooltip>
    );
  }

  return (
    <Popconfirm
      description="该账号的登录与订阅立即失效。"
      okText="停用"
      open={confirmOpen}
      title="停用账号"
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
        placeholder="搜索用户名或显示名称"
        style={{ maxWidth: 240 }}
        value={search}
        aria-label="搜索账号"
        onChange={event => setSearch(event.target.value)}
      />
      <Table<PublicUser>
        columns={[
          {
            title: "用户名",
            dataIndex: "username",
            render: (_value, user) => (
              <Space orientation="vertical" size={0}>
                <span>{user.username}</span>
                {user.displayName ? <Typography.Text type="secondary">{user.displayName}</Typography.Text> : null}
              </Space>
            ),
          },
          {
            title: "角色",
            dataIndex: "role",
            render: (_value, user) => (user.role === "admin" ? <Tag color="volcano">管理员</Tag> : <Tag>普通用户</Tag>),
          },
          {
            title: "状态",
            dataIndex: "disabled",
            width: 110,
            render: (_value, user) => (
              <StatusSwitch self={user.id === currentUserId} user={user} onToggle={onToggleDisabled} />
            ),
          },
          { title: "时区", dataIndex: "timeZone" },
          {
            title: "最后登录",
            dataIndex: "lastLoginAt",
            render: (_value, user) => (user.lastLoginAt === null ? "—" : dateTime(user.lastLoginAt)),
          },
          {
            title: "操作",
            key: "actions",
            width: 210,
            render: (_value, user) => {
              const self = user.id === currentUserId;
              const selfReason = self ? selfDisabledReason : undefined;
              return (
                <RowActions
                  actions={[
                    {
                      key: "toggleRole",
                      label: user.role === "admin" ? "取消管理" : "设管理员",
                      disabled: self,
                      disabledReason: selfReason,
                      confirm: {
                        title: user.role === "admin" ? "设为普通用户" : "设为管理员",
                        description:
                          user.role === "admin" ? "该账号将失去账号管理权限。" : "该账号将可以管理所有账号。",
                        okText: "确认",
                        okDanger: false,
                      },
                      onClick: () => onToggleRole(user),
                    },
                    { key: "resetPassword", label: "重置密码", onClick: () => onResetPassword(user) },
                    {
                      key: "remove",
                      label: "删除",
                      danger: true,
                      disabled: self,
                      disabledReason: selfReason,
                      confirm: {
                        title: "删除账号",
                        description: "该账号的事件和订阅地址会一并删除，且无法恢复。",
                        okText: "删除",
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
            <Empty description="没有匹配的账号">
              <Button onClick={() => setSearch("")}>清除搜索</Button>
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
