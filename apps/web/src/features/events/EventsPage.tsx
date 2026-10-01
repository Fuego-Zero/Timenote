import { upcomingOccurrences } from "@timenote/calendar";
import type { CalendarEvent, EventInput, PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Empty, List, Popconfirm, Space, Tag, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { draftFromEvent, kindLabels, newDraft } from "./eventDraft.js";
import { EventEditor } from "./EventEditor.js";
import { rangeText } from "./occurrenceText.js";
import { useEvents } from "./useEvents.js";

interface EditorState {
  id?: string;
  initial: EventInput;
}

function nextOccurrence(event: CalendarEvent, timeZone: string) {
  try {
    return upcomingOccurrences(event, new Date(), timeZone, 1)[0];
  } catch {
    return undefined;
  }
}

export function EventsPage({ user }: { user: PublicUser }) {
  const { message } = App.useApp();
  const events = useEvents();
  const [editor, setEditor] = useState<EditorState>();

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的事件
        </Typography.Title>
        <Button type="primary" onClick={() => setEditor({ initial: newDraft("birthday", user.timeZone) })}>
          新建事件
        </Button>
      </Space>
      {events.error ? <Alert showIcon title={errorMessage(events.error)} type="error" /> : null}
      <List<CalendarEvent>
        dataSource={events.events ?? []}
        loading={!events.events && !events.error}
        locale={{ emptyText: <Empty description="还没有事件，点击「新建」添加生日或纪念日" /> }}
        renderItem={event => {
          const next = nextOccurrence(event, user.timeZone);
          return (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="link"
                  onClick={() => setEditor({ initial: draftFromEvent(event), id: event.id })}
                >
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  description="删除后订阅刷新时会移除对应日程。"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  title="删除事件"
                  onConfirm={() =>
                    void events.remove(event.id).then(
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
      {editor ? (
        <EventEditor
          editing={Boolean(editor.id)}
          initial={editor.initial}
          timeZone={user.timeZone}
          onClose={() => setEditor(undefined)}
          onSave={async draft => {
            await events.save(draft, editor.id);
            setEditor(undefined);
            void message.success("已保存，订阅地址不变，日历刷新后同步");
          }}
        />
      ) : null}
    </Space>
  );
}
