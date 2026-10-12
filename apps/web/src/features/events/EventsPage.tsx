import type { EventInput, PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Space, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { draftFromEvent, newDraft } from "./eventDraft.js";
import { EventEditor } from "./EventEditor.js";
import { EventsList } from "./EventsList.js";
import { useEvents } from "./useEvents.js";

interface EditorState {
  id?: string;
  initial: EventInput;
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
      <EventsList
        events={events.events ?? []}
        loading={!events.events && !events.error}
        timeZone={user.timeZone}
        onEdit={event => setEditor({ initial: draftFromEvent(event), id: event.id })}
        onRemove={id => events.remove(id)}
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
