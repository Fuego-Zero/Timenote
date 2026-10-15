import type { PublicUser } from "@timenote/contracts";
import { Modal } from "antd";

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
  return (
    <Modal destroyOnHidden footer={null} open={open} title="账号设置" onCancel={onClose}>
      <ProfileForm user={user} onUserChange={onUserChange} />
    </Modal>
  );
}
