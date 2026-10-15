import type { PublicUser } from "@timenote/contracts";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { ProfileForm } from "./ProfileForm.js";

export function ProfileModal({
  user,
  open,
  onClose,
  onUserChange,
}: {
  user: PublicUser;
  open: boolean;
  onClose: () => void;
  onUserChange: (user: PublicUser) => void;
}) {
  const { t } = useTranslation("auth");
  return (
    <Modal destroyOnHidden footer={null} open={open} title={t("account.title")} onCancel={onClose}>
      <ProfileForm user={user} onUserChange={onUserChange} />
    </Modal>
  );
}
