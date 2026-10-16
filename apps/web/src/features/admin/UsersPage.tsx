import { pageQuerySchema, type PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Space, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { useUrlState } from "../../ui/useUrlState.js";
import { ResetPasswordModal } from "./ResetPasswordModal.js";
import { UserFormModal } from "./UserFormModal.js";
import { UsersTable } from "./UsersTable.js";
import { useUsers } from "./useUsers.js";

/** 管理员后台：账号的创建、停用/启用、角色、重置密码与删除；不展示其他账号的事件和订阅。 */
export function UsersPage({ currentUser }: { currentUser: PublicUser }) {
  const { t } = useTranslation("admin");
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
          {t("title")}
        </Typography.Title>
        <Button type="primary" onClick={() => setCreating(true)}>
          {t("create")}
        </Button>
      </Space>
      {users.error ? <Alert showIcon title={errorMessage(users.error)} type="error" /> : null}
      <UsersTable
        currentUserId={currentUser.id}
        loading={!users.page && !users.error}
        page={users.page}
        query={query}
        onQueryChange={setQuery}
        onRemove={user => void run(() => remove(user.id), t("deleted"))}
        onResetPassword={user => setResetting(user)}
        onToggleDisabled={user =>
          void run(
            () => users.update(user.id, { disabled: !user.disabled }),
            user.disabled ? t("enabled") : t("disabled")
          )
        }
        onToggleRole={user =>
          void run(() => users.update(user.id, { role: user.role === "admin" ? "user" : "admin" }), t("roleUpdated"))
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
          void message.success(t("created"));
        }}
      />
      <ResetPasswordModal
        user={resetting}
        onCancel={() => setResetting(undefined)}
        onReset={password =>
          run(async () => {
            await users.resetPassword(resetting!.id, password);
            setResetting(undefined);
          }, t("passwordReset"))
        }
      />
    </Space>
  );
}
