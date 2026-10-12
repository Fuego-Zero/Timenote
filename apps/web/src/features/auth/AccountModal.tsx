import type { PublicUser } from "@timenote/contracts";
import { Divider, Modal } from "antd";

import { ChangePasswordForm } from "./ChangePasswordForm.js";
import { ProfileForm } from "./ProfileForm.js";

export function AccountModal({
  user,
  open,
  onClose,
  onUserChange,
  forcePasswordChange = false,
}: {
  user: PublicUser;
  open: boolean;
  onClose: () => void;
  onUserChange: (user: PublicUser) => void;
  forcePasswordChange?: boolean;
}) {
  return (
    <Modal
      closable={!forcePasswordChange}
      destroyOnHidden
      footer={null}
      keyboard={!forcePasswordChange}
      maskClosable={!forcePasswordChange}
      open={open}
      title={forcePasswordChange ? "请先修改初始密码" : "账号设置"}
      onCancel={forcePasswordChange ? undefined : onClose}
    >
      {forcePasswordChange ? null : (
        <>
          <ProfileForm user={user} onUserChange={onUserChange} />
          <Divider />
        </>
      )}
      <ChangePasswordForm
        forcePasswordChange={forcePasswordChange}
        user={user}
        onDone={onClose}
        onUserChange={onUserChange}
      />
    </Modal>
  );
}
