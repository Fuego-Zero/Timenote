import { Modal } from "antd";

import { ChangePasswordForm } from "./ChangePasswordForm.js";

export function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal destroyOnHidden footer={null} open={open} title="修改密码" onCancel={onClose}>
      <ChangePasswordForm />
    </Modal>
  );
}
