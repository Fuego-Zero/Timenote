import type { PublicUser } from "@timenote/contracts";
import { Button, Popconfirm, Space, Table, Tag, Typography } from "antd";

export function UsersTable({
  users,
  loading,
  currentUserId,
  onToggleDisabled,
  onToggleRole,
  onResetPassword,
  onRemove,
}: {
  users: PublicUser[];
  loading: boolean;
  currentUserId: string;
  onToggleDisabled: (user: PublicUser) => void;
  onToggleRole: (user: PublicUser) => void;
  onResetPassword: (user: PublicUser) => void;
  onRemove: (user: PublicUser) => void;
}) {
  return (
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
                <Button disabled={self} size="small" onClick={() => onToggleDisabled(user)}>
                  {user.disabled ? "启用" : "停用"}
                </Button>
                <Button disabled={self} size="small" onClick={() => onToggleRole(user)}>
                  {user.role === "admin" ? "设为普通用户" : "设为管理员"}
                </Button>
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
      dataSource={users}
      loading={loading}
      pagination={false}
      rowKey="id"
      scroll={{ x: 640 }}
    />
  );
}
