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

import { errorMessage } from "../../api/client.js";
import { RowActions } from "../../ui/RowActions.js";
import { kindLabels, kindTagTones } from "./eventDraft.js";
import { EventTag } from "./EventTag.js";
import { nextOccurrence } from "./nextOccurrence.js";
import { rangeText } from "./occurrenceText.js";
import type { EventListQuery } from "./useEvents.js";

const calendarLabels: Record<CalendarSystem, string> = { gregorian: "公历", lunar: "农历" };
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
  const { message } = App.useApp();
  const [search, setSearch] = useState(query.q ?? "");

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
      title: "事件",
      render: (_value, event) => {
        const next = nextOccurrence(event, timeZone);
        return (
          <Space orientation="vertical" size={2}>
            <Typography.Title className="event-title" level={5} style={{ margin: 0 }}>
              {next?.title ?? event.name}
            </Typography.Title>
            <Typography.Text type="secondary">{next ? rangeText(next) : "已过去"}</Typography.Text>
          </Space>
        );
      },
    },
    {
      key: "kind",
      title: "类型",
      filterMultiple: false,
      filteredValue: query.kind ? [query.kind] : null,
      filters: eventKinds.map(kind => ({ text: kindLabels[kind], value: kind })),
      render: (_value, event) => <EventTag tone={kindTagTones[event.kind]}>{kindLabels[event.kind]}</EventTag>,
    },
    {
      key: "calendar",
      title: "历法",
      filterMultiple: false,
      filteredValue: query.calendar ? [query.calendar] : null,
      filters: calendarSystems.map(calendar => ({ text: calendarLabels[calendar], value: calendar })),
      render: (_value, event) => (
        <Space wrap size={4}>
          {event.date.calendar === "lunar" ? (
            <EventTag tone="lunar">农历</EventTag>
          ) : (
            <EventTag tone="solar">公历</EventTag>
          )}
          {event.durationDays > 1 ? <EventTag tone="duration">{event.durationDays} 天</EventTag> : null}
        </Space>
      ),
    },
    {
      key: "hasAlarm",
      title: "提醒",
      filterMultiple: false,
      filteredValue: query.hasAlarm === undefined ? null : [String(query.hasAlarm)],
      filters: [
        { text: "有提醒", value: "true" },
        { text: "无提醒", value: "false" },
      ],
      render: (_value, event) => (event.alarms.length ? <EventTag tone="reminder">提醒</EventTag> : null),
    },
    {
      key: "actions",
      title: "操作",
      width: 110,
      render: (_value, event) => (
        <RowActions
          actions={[
            { key: "edit", label: "编辑", onClick: () => onEdit(event) },
            {
              key: "remove",
              label: "删除",
              danger: true,
              confirm: {
                title: "删除事件",
                description: "删除后订阅刷新时会移除对应日程。",
                okText: "删除",
                okDanger: true,
              },
              onClick: () =>
                void onRemove(event.id).then(
                  () => message.success("已删除"),
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
          placeholder="搜索名称"
          style={{ maxWidth: 240 }}
          value={search}
          aria-label="搜索事件"
          onChange={event => setSearch(event.target.value)}
        />
        <Select
          id="events-sort"
          options={[
            { value: "createdAt", label: "最近创建" },
            { value: "nextOccurrence", label: "下次发生" },
          ]}
          style={{ width: 120 }}
          value={query.sort}
          aria-label="排序"
          onChange={sort =>
            onQueryChange({ sort, page: 1, ...(sort === "createdAt" ? { nextWithinDays: undefined } : {}) })
          }
        />
        {query.sort === "nextOccurrence" ? (
          <Select
            allowClear
            id="events-next-within"
            options={[7, 30, 90].map(days => ({ value: days, label: `${days} 天内` }))}
            placeholder="不限时间"
            style={{ width: 120 }}
            value={query.nextWithinDays}
            aria-label="发生时间范围"
            onChange={(days?: number) => onQueryChange({ nextWithinDays: days, page: 1 })}
          />
        ) : null}
      </Flex>
      <Table<CalendarEvent>
        columns={columns}
        dataSource={page?.items ?? []}
        loading={loading}
        locale={{
          emptyText: filtered ? (
            <Empty description="没有匹配的事件" />
          ) : (
            <Empty description="还没有事件，点击「新建」添加生日或纪念日" />
          ),
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
