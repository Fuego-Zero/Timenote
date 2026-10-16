import type { PublicUser } from "@timenote/contracts";
import { Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function ResetPasswordModal({
  user,
  onCancel,
  onReset,
}: {
  user: PublicUser | undefined;
  onCancel: () => void;
  onReset: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation("admin");
  const [newPassword, setNewPassword] = useState("");

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: newPassword.length < 8 }}
      okText={t("reset.ok")}
      open={Boolean(user)}
      title={t("reset.title", { name: user?.username ?? "" })}
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
        placeholder={t("reset.placeholder")}
        value={newPassword}
        aria-label={t("reset.aria")}
        onChange={event => setNewPassword(event.target.value)}
      />
    </Modal>
  );
}
