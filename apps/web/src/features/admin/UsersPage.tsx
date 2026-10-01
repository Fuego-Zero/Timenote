import type { PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { UserFormModal } from "./UserFormModal.js";
import { useUsers } from "./useUsers.js";

/** 管理员后台：账号的创建、停用/启用、角色、重置密码与删除；不展示其他账号的事件和订阅。 */
export function UsersPage({ currentUser }: { currentUser: PublicUser }) {
  const { message } = App.useApp();
  const users = useUsers();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<PublicUser>();
  const [newPassword, setNewPassword] = useState("");

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      void message.success(success);
    } catch (error) {
      void message.error(errorMessage(error));
    }
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          账号管理
        </Typography.Title>
        <Button type="primary" onClick={() => setCreating(true)}>
          新建账号
        </Button>
      </Space>
      {users.error ? <Alert showIcon title={errorMessage(users.error)} type="error" /> : null}
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
              const self = user.id === currentUser.id;
              return (
                <Space wrap size={4}>
                  <Button
                    disabled={self}
                    size="small"
                    onClick={() =>
                      void run(
                        () => users.update(user.id, { disabled: !user.disabled }),
                        user.disabled ? "已启用" : "已停用，该账号的登录与订阅立即失效"
                      )
                    }
                  >
                    {user.disabled ? "启用" : "停用"}
                  </Button>
                  <Button
                    disabled={self}
                    size="small"
                    onClick={() =>
                      void run(
                        () => users.update(user.id, { role: user.role === "admin" ? "user" : "admin" }),
                        "角色已更新"
                      )
                    }
                  >
                    {user.role === "admin" ? "设为普通用户" : "设为管理员"}
                  </Button>
                  <Button size="small" onClick={() => setResetting(user)}>
                    重置密码
                  </Button>
                  <Popconfirm
                    description="该账号的事件和订阅地址会一并删除，且无法恢复。"
                    disabled={self}
                    okButtonProps={{ danger: true }}
                    okText="删除"
                    title="删除账号"
                    onConfirm={() => void run(() => users.remove(user.id), "账号已删除")}
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
        dataSource={users.users ?? []}
        loading={!users.users && !users.error}
        pagination={false}
        rowKey="id"
        scroll={{ x: 640 }}
      />
      <UserFormModal
        defaultTimeZone={currentUser.timeZone}
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async input => {
          await users.create(input);
          setCreating(false);
          void message.success("账号已创建");
        }}
      />
      <Modal
        destroyOnHidden
        okButtonProps={{ disabled: newPassword.length < 8 }}
        okText="重置"
        open={Boolean(resetting)}
        title={`重置 ${resetting?.username ?? ""} 的密码`}
        onCancel={() => {
          setResetting(undefined);
          setNewPassword("");
        }}
        onOk={() =>
          void run(async () => {
            await users.resetPassword(resetting!.id, newPassword);
            setResetting(undefined);
            setNewPassword("");
          }, "密码已重置，该账号需要重新登录")
        }
      >
        <Input.Password
          autoComplete="new-password"
          placeholder="至少 8 位"
          value={newPassword}
          aria-label="新密码"
          onChange={event => setNewPassword(event.target.value)}
        />
      </Modal>
    </Space>
  );
}
