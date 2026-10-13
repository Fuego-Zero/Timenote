import { type CalendarEvent, maxQueryLength, type PageResult } from "@timenote/contracts";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Flex,
  Input,
  Space,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";

import { apiPath } from "../../api/apiPath.js";
import { errorMessage } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";
import { kindLabels } from "../events/eventDraft.js";
import { fetchEventsByIds } from "../events/eventsByIds.js";

const pageSizeOptions = [10, 20, 50, 100];
const searchDebounceMs = 300;

const columns: TableColumnsType<CalendarEvent> = [
  { key: "name", title: "名称", render: (_value, event) => event.name },
  { key: "kind", title: "类型", render: (_value, event) => <Tag>{kindLabels[event.kind]}</Tag> },
];

interface SelectedSnapshot {
  error?: unknown;
  events?: CalendarEvent[];
  loading: boolean;
}

/**
 * 订阅的事件选择器：服务端分页加搜索，跨页勾选靠 preserveSelectedRowKeys 保留。
 * 表头全选只作用于当前页；“清空”清掉全部已选。“只看已选”按 id 分批取回全部已选事件后在本地分页，
 * 已被删除的 id 会单独提示并可一键移除。
 */
export function EventPicker({
  value,
  onChange,
  reloadKey = 0,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** 变化时重新拉取当前页（例如保存因事件已删除返回 400 之后）。 */
  reloadKey?: number;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState<string>();
  const [paging, setPaging] = useState({ page: 1, pageSize: 10 });
  const [onlySelected, setOnlySelected] = useState(false);
  const [selected, setSelected] = useState<SelectedSnapshot>({ loading: false });
  const browse = useApiResource<PageResult<CalendarEvent>>(
    apiPath("/events", { q, page: paging.page, pageSize: paging.pageSize })
  );
  const { reload } = browse;
  const firstRender = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim() || undefined;
      if (next !== q) {
        setQ(next);
        setPaging(current => ({ ...current, page: 1 }));
      }
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, q]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    reload();
  }, [reloadKey, reload]);

  async function toggleOnlySelected(checked: boolean) {
    setOnlySelected(checked);
    setPaging(current => ({ ...current, page: 1 }));
    if (!checked) {
      return;
    }

    setSelected({ loading: true });
    try {
      setSelected({ loading: false, events: await fetchEventsByIds(value) });
    } catch (error) {
      setSelected({ loading: false, error });
    }
  }

  const offset = (paging.page - 1) * paging.pageSize;
  const rows = onlySelected
    ? (selected.events ?? []).slice(offset, offset + paging.pageSize)
    : (browse.data?.items ?? []);
  const total = onlySelected ? (selected.events?.length ?? 0) : (browse.data?.total ?? 0);
  const found = new Set(selected.events?.map(event => event.id));
  const missing = onlySelected && selected.events ? value.filter(id => !found.has(id)) : [];
  const error = onlySelected ? selected.error : browse.error;
  let emptyText = "没有匹配的事件";
  if (onlySelected) {
    emptyText = "还没有选择事件";
  } else if (q === undefined) {
    emptyText = "暂无事件，保存后将生成空日历";
  }

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      <Flex wrap align="center" gap="small">
        <Typography.Text>{`已选 ${value.length} 项`}</Typography.Text>
        <Checkbox checked={onlySelected} onChange={event => void toggleOnlySelected(event.target.checked)}>
          只看已选
        </Checkbox>
        <Button disabled={!value.length} size="small" type="link" onClick={() => onChange([])}>
          清空
        </Button>
        <Input
          allowClear
          disabled={onlySelected}
          maxLength={maxQueryLength}
          placeholder="搜索名称"
          style={{ maxWidth: 200 }}
          value={search}
          aria-label="搜索事件"
          onChange={event => setSearch(event.target.value)}
        />
      </Flex>
      {error ? <Alert showIcon title={errorMessage(error)} type="error" /> : null}
      {missing.length ? (
        <Alert
          showIcon
          action={
            <Button size="small" onClick={() => onChange(value.filter(id => found.has(id)))}>
              移除
            </Button>
          }
          title={`${missing.length} 个已选事件已被删除`}
          type="warning"
        />
      ) : null}
      <Table<CalendarEvent>
        columns={columns}
        dataSource={rows}
        loading={onlySelected ? selected.loading : !browse.data && !browse.error}
        locale={{
          emptyText: <Empty description={emptyText} />,
        }}
        pagination={{
          current: paging.page,
          pageSize: paging.pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions,
          onChange: (page, pageSize) => setPaging({ page: pageSize === paging.pageSize ? page : 1, pageSize }),
        }}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: value,
          preserveSelectedRowKeys: true,
          selections: [
            Table.SELECTION_ALL,
            Table.SELECTION_INVERT,
            { key: "clear", text: "清空全部已选", onSelect: () => onChange([]) },
          ],
          onChange: keys => onChange(keys.map(String)),
        }}
        size="small"
      />
    </Space>
  );
}
