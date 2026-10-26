"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { AdminDatePicker } from "../components/date-picker";
import { adminTasksOptions, adminWorkspacesOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import { useAdminListState } from "../use-list-state";
import {
  AdminPagination,
  EmptyState,
  EntityLink,
  ErrorState,
  FilterSelect,
  LoadingState,
  PageHeader,
  SearchBar,
  SortableHead,
  StatusBadge,
  formatCost,
  formatDateTime,
  formatDuration,
  formatNumber,
} from "../components/shared";

const statuses = [
  "",
  "queued",
  "dispatched",
  "running",
  "waiting_local_directory",
  "deferred",
  "completed",
  "failed",
  "cancelled",
];

export default function TasksPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const list = useAdminListState();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const workspaceOptions = useQuery(
    adminWorkspacesOptions({ page_size: 100, sort: "name", order: "asc" }),
  );
  const tasks = useQuery(
    adminTasksOptions({
      page: list.page,
      page_size: list.pageSize,
      sort: list.sort,
      order: list.order,
      q: query,
      status,
      workspace_id: workspaceId,
      from,
      to,
    }),
  );

  if (tasks.isLoading) return <LoadingState label={copy.common.loading} />;
  if (tasks.isError || !tasks.data) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void tasks.refetch();
        }}
      />
    );
  }

  const data = tasks.data;
  const statusItems = statuses.map((value) => ({
    value,
    label: value || copy.common.allStatuses,
  }));
  const workspaceItems = [
    { value: "", label: copy.common.allWorkspaces },
    ...(workspaceOptions.data?.items.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })) ?? []),
  ];

  const resetPage = list.resetPage;

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.tasks}
        actions={
          <SearchBar
            value={search}
            onChange={setSearch}
            onSubmit={() => {
              setQuery(search.trim());
              resetPage();
            }}
            placeholder={copy.common.searchPlaceholder}
            label={copy.common.search}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={status}
          onChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          items={statusItems}
          label={copy.common.status}
        />
        <FilterSelect
          value={workspaceId}
          onChange={(value) => {
            setWorkspaceId(value);
            resetPage();
          }}
          items={workspaceItems}
          label={copy.common.workspace}
          className="w-56"
        />
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{copy.common.from}</span>
          <AdminDatePicker
            value={from}
            onChange={(value) => {
              setFrom(value);
              resetPage();
            }}
            label={copy.common.from}
            placeholder={copy.common.anyDate}
            emptyLabel={copy.common.anyDate}
          />
        </div>
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{copy.common.to}</span>
          <AdminDatePicker
            value={to}
            onChange={(value) => {
              setTo(value);
              resetPage();
            }}
            label={copy.common.to}
            placeholder={copy.common.anyDate}
            emptyLabel={copy.common.anyDate}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        {data.items.length === 0 ? (
          <EmptyState label={copy.common.empty} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label={copy.common.status}
                  column="status"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.agent}
                  column="agent"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.workspace}
                  column="workspace"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <TableHead>{copy.common.issue}</TableHead>
                <TableHead>{copy.common.runtime}</TableHead>
                <SortableHead
                  label={copy.common.created}
                  column="created_at"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <TableHead className="text-right">{copy.common.duration}</TableHead>
                <TableHead className="text-right">{copy.common.cost}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    <EntityLink href={adminPaths.agent(task.agent_id)}>{task.agent_name}</EntityLink>
                  </TableCell>
                  <TableCell>
                    <EntityLink href={adminPaths.workspace(task.workspace_id)}>
                      {task.workspace_name}
                    </EntityLink>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {task.issue_number ? `#${task.issue_number} ` : ""}
                    {task.issue_title ?? copy.common.none}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.runtime_name ?? copy.common.none}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(task.created_at, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(task.started_at, task.completed_at)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCost(task.cost_usd, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AdminPagination
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          totalPages={data.total_pages}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          labels={{
            results: `${copy.common.showing} ${formatNumber(data.total, locale)} ${copy.common.results}`,
            pageSize: copy.common.pageSize,
            previous: copy.common.previous,
            next: copy.common.next,
          }}
        />
      </div>
    </div>
  );
}
