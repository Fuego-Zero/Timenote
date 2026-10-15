import {
  type CalendarEvent,
  type CalendarSystem,
  calendarSystems,
  type EventKind,
  eventKinds,
  maxQueryLength,
  type PageResult,
} from "@timenote/contracts";
import { App, Empty, Flex, Input, Select, Space, Table, type TableColumnsType, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { RowActions } from "../../ui/RowActions.js";
import { kindLabels, kindTagTones } from "./eventDraft.js";
import { EventTag } from "./EventTag.js";
import { nextOccurrence } from "./nextOccurrence.js";
import { rangeText } from "./occurrenceText.js";
import { recurrenceSummary } from "./recurrenceText.js";
import type { EventListQuery } from "./useEvents.js";

const pageSizeOptions = [10, 20, 50, 100];
const searchDebounceMs = 300;

function firstFilter(values: readonly (bigint | boolean | number | string)[] | null | undefined) {
  return values?.length ? String(values[0]) : undefined;
}

export function EventsList({
  page,
  loading,
  query,
  timeZone,
  onQueryChange,
  onEdit,
  onRemove,
}: {
  page: PageResult<CalendarEvent> | undefined;
  loading: boolean;
  query: EventListQuery;
  timeZone: string;
  onQueryChange: (patch: Partial<EventListQuery>) => void;
  onEdit: (event: CalendarEvent) => void;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation(["events", "common"]);
  const { message } = App.useApp();
  const [search, setSearch] = useState(query.q ?? "");
  const labels = kindLabels();
  const calendarLabels: Record<CalendarSystem, string> = {
    gregorian: t("gregorian"),
    lunar: t("lunar"),
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search.trim() || undefined;
      if (q !== query.q) {
        onQueryChange({ q, page: 1 });
      }
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, query.q, onQueryChange]);

  const filtered =
    query.q !== undefined ||
    query.kind !== undefined ||
    query.calendar !== undefined ||
    query.hasAlarm !== undefined ||
    query.nextWithinDays !== undefined;

  const columns: TableColumnsType<CalendarEvent> = [
    {
      key: "name",
      title: t("columnEvent"),
      render: (_value, event) => {
        const next = nextOccurrence(event, timeZone);
        return (
          <Space orientation="vertical" size={2}>
            <Typography.Title className="event-title" level={5} style={{ margin: 0 }}>
              {next?.title ?? event.name}
            </Typography.Title>
            <Typography.Text type="secondary">{next ? rangeText(next) : t("past")}</Typography.Text>
          </Space>
        );
      },
    },
    {
      key: "kind",
      title: t("common:type"),
      filterMultiple: false,
      filteredValue: query.kind ? [query.kind] : null,
      filters: eventKinds.map(kind => ({ text: labels[kind], value: kind })),
      render: (_value, event) => <EventTag tone={kindTagTones[event.kind]}>{labels[event.kind]}</EventTag>,
    },
    {
      key: "calendar",
      title: t("calendar"),
      filterMultiple: false,
      filteredValue: query.calendar ? [query.calendar] : null,
      filters: calendarSystems.map(calendar => ({ text: calendarLabels[calendar], value: calendar })),
      render: (_value, event) => (
        <Space wrap size={4}>
          {event.date.calendar === "lunar" ? (
            <EventTag tone="lunar">{t("lunar")}</EventTag>
          ) : (
            <EventTag tone="solar">{t("gregorian")}</EventTag>
          )}
          {event.durationDays > 1 ? (
            <EventTag tone="duration">{t("daysTag", { count: event.durationDays })}</EventTag>
          ) : null}
          {recurrenceSummary(event).map(text => (
            <EventTag key={text} tone="general">
              {text}
            </EventTag>
          ))}
        </Space>
      ),
    },
    {
      key: "hasAlarm",
      title: t("reminder"),
      filterMultiple: false,
      filteredValue: query.hasAlarm === undefined ? null : [String(query.hasAlarm)],
      filters: [
        { text: t("hasAlarm"), value: "true" },
        { text: t("noAlarm"), value: "false" },
      ],
      render: (_value, event) => (event.alarms.length ? <EventTag tone="reminder">{t("reminder")}</EventTag> : null),
    },
    {
      key: "actions",
      title: t("common:actions"),
      width: 110,
      render: (_value, event) => (
        <RowActions
          actions={[
            { key: "edit", label: t("common:edit"), onClick: () => onEdit(event) },
            {
              key: "remove",
              label: t("common:delete"),
              danger: true,
              confirm: {
                title: t("deleteConfirmTitle"),
                description: t("deleteConfirmDesc"),
                okText: t("common:delete"),
                okDanger: true,
              },
              onClick: () =>
                void onRemove(event.id).then(
                  () => message.success(t("deleted")),
                  (error: unknown) => message.error(errorMessage(error))
                ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      <Flex wrap gap="small">
        <Input
          allowClear
          maxLength={maxQueryLength}
          placeholder={t("common:searchName")}
          style={{ maxWidth: 240 }}
          value={search}
          aria-label={t("searchAria")}
          onChange={event => setSearch(event.target.value)}
        />
        <Select
          id="events-sort"
          options={[
            { value: "createdAt", label: t("sortCreated") },
            { value: "nextOccurrence", label: t("sortNext") },
          ]}
          style={{ width: 120 }}
          value={query.sort}
          aria-label={t("sortAria")}
          onChange={sort =>
            onQueryChange({ sort, page: 1, ...(sort === "createdAt" ? { nextWithinDays: undefined } : {}) })
          }
        />
        {query.sort === "nextOccurrence" ? (
          <Select
            allowClear
            id="events-next-within"
            options={[7, 30, 90].map(days => ({ value: days, label: t("withinDays", { count: days }) }))}
            placeholder={t("noTimeLimit")}
            style={{ width: 120 }}
            value={query.nextWithinDays}
            aria-label={t("nextWithinAria")}
            onChange={(days?: number) => onQueryChange({ nextWithinDays: days, page: 1 })}
          />
        ) : null}
      </Flex>
      <Table<CalendarEvent>
        columns={columns}
        dataSource={page?.items ?? []}
        loading={loading}
        locale={{
          emptyText: filtered ? <Empty description={t("emptyFiltered")} /> : <Empty description={t("empty")} />,
        }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: page?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions,
        }}
        rowKey="id"
        scroll={{ x: "max-content" }}
        onChange={(pagination, filters) => {
          const kind = firstFilter(filters.kind) as EventKind | undefined;
          const calendar = firstFilter(filters.calendar) as CalendarSystem | undefined;
          const alarm = firstFilter(filters.hasAlarm);
          const hasAlarm = alarm === undefined ? undefined : alarm === "true";
          const filtersChanged = kind !== query.kind || calendar !== query.calendar || hasAlarm !== query.hasAlarm;
          const pageSize = pagination.pageSize ?? query.pageSize;
          onQueryChange({
            kind,
            calendar,
            hasAlarm,
            pageSize,
            page: filtersChanged || pageSize !== query.pageSize ? 1 : (pagination.current ?? 1),
          });
        }}
      />
    </Space>
  );
}
