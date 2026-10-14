import { pageQuerySchema, type PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Space, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { useUrlState } from "../../ui/useUrlState.js";
import { ResetPasswordModal } from "./ResetPasswordModal.js";
import { UserFormModal } from "./UserFormModal.js";
import { UsersTable } from "./UsersTable.js";
import { useUsers } from "./useUsers.js";

/** 管理员后台：账号的创建、停用/启用、角色、重置密码与删除；不展示其他账号的事件和订阅。 */
export function UsersPage({ currentUser }: { currentUser: PublicUser }) {
  const { message } = App.useApp();
  const [query, setQuery] = useUrlState(pageQuerySchema);
  const users = useUsers(query);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<PublicUser>();

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      void message.success(success);
    } catch (error) {
      void message.error(errorMessage(error));
    }
  }

  async function remove(id: string) {
    await users.remove(id);
    // 删除当前页最后一条且不在第一页时退回上一页，避免停在空页。
    if (users.page?.items.length === 1 && query.page > 1) {
      setQuery({ page: query.page - 1 });
    } else {
      users.reload();
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
      <UsersTable
        currentUserId={currentUser.id}
        loading={!users.page && !users.error}
        page={users.page}
        query={query}
        onQueryChange={setQuery}
        onRemove={user => void run(() => remove(user.id), "账号已删除")}
        onResetPassword={user => setResetting(user)}
        onToggleDisabled={user =>
          void run(
            () => users.update(user.id, { disabled: !user.disabled }),
            user.disabled ? "已启用" : "已停用，该账号的登录与订阅立即失效"
          )
        }
        onToggleRole={user =>
          void run(() => users.update(user.id, { role: user.role === "admin" ? "user" : "admin" }), "角色已更新")
        }
      />
      <UserFormModal
        defaultTimeZone={currentUser.timeZone}
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async input => {
          await users.create(input);
          setCreating(false);
          setQuery({ page: 1 });
          void message.success("账号已创建");
        }}
      />
      <ResetPasswordModal
        user={resetting}
        onCancel={() => setResetting(undefined)}
        onReset={password =>
          run(async () => {
            await users.resetPassword(resetting!.id, password);
            setResetting(undefined);
          }, "密码已重置，该账号需要重新登录")
        }
      />
    </Space>
  );
}
