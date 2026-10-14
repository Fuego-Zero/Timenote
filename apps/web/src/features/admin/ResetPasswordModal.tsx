import type { PublicUser } from "@timenote/contracts";
import { Input, Modal } from "antd";
import { useState } from "react";

export function ResetPasswordModal({
  user,
  onCancel,
  onReset,
}: {
  user: PublicUser | undefined;
  onCancel: () => void;
  onReset: (password: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState("");

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: newPassword.length < 8 }}
      okText="重置"
      open={Boolean(user)}
      title={`重置 ${user?.username ?? ""} 的密码`}
      onCancel={() => {
        setNewPassword("");
        onCancel();
      }}
      onOk={() =>
        void onReset(newPassword).then(() => {
          setNewPassword("");
        })
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
  );
}
