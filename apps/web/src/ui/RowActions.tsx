import { Button, Divider, Popconfirm, Space, Tooltip } from "antd";

export interface Confirm {
  description: string;
  okDanger: boolean;
  okText?: string;
  title: string;
}

// 标红按钮代表不可恢复的操作，类型层面强制必须带确认。
export type RowAction = {
  key: string;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
} & ({ danger: true; confirm: Confirm } | { danger?: false; confirm?: Confirm });

function renderAction(action: RowAction) {
  const { confirm } = action;
  const button = (
    <Button
      danger={action.danger}
      disabled={action.disabled}
      href={action.href}
      size="small"
      style={{ paddingInline: 0 }}
      type="link"
      onClick={confirm ? undefined : action.onClick}
    >
      {action.label}
    </Button>
  );

  if (action.disabled) {
    // disabled 按钮不触发鼠标事件，需用 span 承接 Tooltip。
    return action.disabledReason ? (
      <Tooltip title={action.disabledReason}>
        <span>{button}</span>
      </Tooltip>
    ) : (
      button
    );
  }

  if (!confirm) {
    return button;
  }

  return (
    <Popconfirm
      description={confirm.description}
      okButtonProps={{ danger: confirm.okDanger }}
      okText={confirm.okText}
      title={confirm.title}
      onConfirm={action.onClick}
    >
      {button}
    </Popconfirm>
  );
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <Space separator={<Divider orientation="vertical" />} size={0}>
      {actions.map(action => (
        <span key={action.key}>{renderAction(action)}</span>
      ))}
    </Space>
  );
}
