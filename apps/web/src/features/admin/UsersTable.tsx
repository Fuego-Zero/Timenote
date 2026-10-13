import { maxQueryLength, type PageQuery, type PageResult, type PublicUser } from "@timenote/contracts";
import { Button, Empty, Input, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

const searchDebounceMs = 300;

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
            render: (_value, user) =>
              user.disabled ? <Tag color="default">已停用</Tag> : <Tag color="green">启用</Tag>,
          },
          { title: "时区", dataIndex: "timeZone" },
          {
            title: "操作",
            key: "actions",
            render: (_value, user) => {
              const self = user.id === currentUserId;
              return (
                <Space wrap size={4}>
                  <Popconfirm
                    description={
                      user.disabled ? "启用后该账号可以重新登录，订阅恢复更新。" : "该账号的登录与订阅立即失效。"
                    }
                    disabled={self}
                    title={user.disabled ? "启用账号" : "停用账号"}
                    onConfirm={() => onToggleDisabled(user)}
                  >
                    <Button disabled={self} size="small">
                      {user.disabled ? "启用" : "停用"}
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    description={user.role === "admin" ? "该账号将失去账号管理权限。" : "该账号将可以管理所有账号。"}
                    disabled={self}
                    title={user.role === "admin" ? "设为普通用户" : "设为管理员"}
                    onConfirm={() => onToggleRole(user)}
                  >
                    <Button disabled={self} size="small">
                      {user.role === "admin" ? "设为普通用户" : "设为管理员"}
                    </Button>
                  </Popconfirm>
                  <Button size="small" onClick={() => onResetPassword(user)}>
                    重置密码
                  </Button>
                  <Popconfirm
                    description="该账号的事件和订阅地址会一并删除，且无法恢复。"
                    disabled={self}
                    okButtonProps={{ danger: true }}
                    okText="删除"
                    title="删除账号"
                    onConfirm={() => onRemove(user)}
                  >
                    <Button danger disabled={self} size="small">
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
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
