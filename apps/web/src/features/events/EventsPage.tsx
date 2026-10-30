import { type EventInput, eventPageQuerySchema, type PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Space, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { useUrlState } from "../../ui/useUrlState.js";
import { guideTargets } from "../guide/guideTargets.js";
import { useGuide } from "../guide/useGuide.js";
import { draftFromEvent, newDraft } from "./eventDraft.js";
import { EventEditor } from "./EventEditor.js";
import { EventsList } from "./EventsList.js";
import { useEvents } from "./useEvents.js";

interface EditorState {
  id?: string;
  initial: EventInput;
}

const eventsUrlSchema = eventPageQuerySchema.omit({ ids: true });

export function EventsPage({ user }: { user: PublicUser }) {
  const { t } = useTranslation("events");
  const { message } = App.useApp();
  const [query, setQuery] = useUrlState(eventsUrlSchema);
  const events = useEvents(query);
  const guide = useGuide();
  const [editor, setEditor] = useState<EditorState>();

  async function remove(id: string) {
    await events.remove(id);
    void guide.refresh();
    // 删掉当前页最后一条且不在第一页时退回上一页，避免停在空页。
    if (events.page?.items.length === 1 && query.page > 1) {
      setQuery({ page: query.page - 1 });
    } else {
      events.reload();
    }
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("pageTitle")}
        </Typography.Title>
        <Button
          type="primary"
          data-guide={guideTargets.eventsNew}
          onClick={() => setEditor({ initial: newDraft("birthday", user.timeZone) })}
        >
          {t("newEvent")}
        </Button>
      </Space>
      {Boolean(events.error) && <Alert showIcon title={errorMessage(events.error)} type="error" />}
      <EventsList
        loading={!events.page && !events.error}
        page={events.page}
        query={query}
        timeZone={user.timeZone}
        onEdit={event => setEditor({ initial: draftFromEvent(event), id: event.id })}
        onQueryChange={setQuery}
        onRemove={remove}
      />
      {editor && (
        <EventEditor
          editing={Boolean(editor.id)}
          initial={editor.initial}
          timeZone={user.timeZone}
          onClose={() => setEditor(undefined)}
          onSave={async draft => {
            await events.save(draft, editor.id);
            void guide.refresh();
            setEditor(undefined);
            void message.success(t("saved"));
          }}
        />
      )}
    </Space>
  );
}
