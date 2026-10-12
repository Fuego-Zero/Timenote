import type { CalendarEvent } from "@timenote/contracts";
import { App, Button, Empty, List, Popconfirm, Space, Tag, Typography } from "antd";

import { errorMessage } from "../../api/client.js";
import { kindLabels } from "./eventDraft.js";
import { nextOccurrence } from "./nextOccurrence.js";
import { rangeText } from "./occurrenceText.js";

export function EventsList({
  events,
  loading,
  timeZone,
  onEdit,
  onRemove,
}: {
  events: CalendarEvent[];
  loading: boolean;
  timeZone: string;
  onEdit: (event: CalendarEvent) => void;
  onRemove: (id: string) => Promise<void>;
}) {
  const { message } = App.useApp();

  return (
    <List<CalendarEvent>
      dataSource={events}
      loading={loading}
      locale={{ emptyText: <Empty description="还没有事件，点击「新建」添加生日或纪念日" /> }}
      renderItem={event => {
        const next = nextOccurrence(event, timeZone);
        return (
          <List.Item
            actions={[
              <Button key="edit" type="link" onClick={() => onEdit(event)}>
                编辑
              </Button>,
              <Popconfirm
                key="delete"
                description="删除后订阅刷新时会移除对应日程。"
                okButtonProps={{ danger: true }}
                okText="删除"
                title="删除事件"
                onConfirm={() =>
                  void onRemove(event.id).then(
                    () => message.success("已删除"),
                    (error: unknown) => message.error(errorMessage(error))
                  )
                }
              >
                <Button danger type="link">
                  删除
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              description={
                <Space wrap size={4}>
                  <Tag>{kindLabels[event.kind]}</Tag>
                  {event.date.calendar === "lunar" ? <Tag color="gold">农历</Tag> : null}
                  {event.durationDays > 1 ? <Tag color="blue">{event.durationDays} 天</Tag> : null}
                  {event.alarms.length ? <Tag color="green">提醒</Tag> : null}
                  <Typography.Text type="secondary">{next ? rangeText(next) : "已过去"}</Typography.Text>
                </Space>
              }
              title={<span className="event-title">{next?.title ?? event.name}</span>}
            />
          </List.Item>
        );
      }}
    />
  );
}
