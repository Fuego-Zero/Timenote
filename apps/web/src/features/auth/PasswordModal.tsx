import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { ChangePasswordForm } from "./ChangePasswordForm.js";

export function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("common");
  return (
    <Modal destroyOnHidden footer={null} open={open} title={t("nav.password")} onCancel={onClose}>
      <ChangePasswordForm />
    </Modal>
  );
}
