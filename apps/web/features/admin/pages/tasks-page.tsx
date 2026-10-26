"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { adminTasksOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  EmptyState,
  EntityLink,
  ErrorState,
  LoadMoreButton,
  LoadingState,
  PageHeader,
  StatusBadge,
  formatCost,
  formatDateTime,
  formatDuration,
  formatNumber,
} from "../components/shared";

const statuses = ["", "queued", "dispatched", "running", "waiting_local_directory", "deferred", "completed", "failed", "cancelled"];

export default function TasksPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [status, setStatus] = useState("");
  const tasks = useInfiniteQuery(adminTasksOptions({ status }));

  if (tasks.isLoading) return <LoadingState label={copy.common.loading} />;
  if (tasks.isError) {
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

  const items = tasks.data?.pages.flatMap((page) => page.items) ?? [];
  const statusItems = statuses.map((value) => ({
    value: value || "all",
    label: value || copy.common.all,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.tasks}
        actions={
          <Select
            items={statusItems}
            value={status || "all"}
            onValueChange={(next) => setStatus(!next || next === "all" ? "" : next)}
          >
            <SelectTrigger className="w-44" aria-label={copy.common.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {items.length === 0 ? (
        <EmptyState label={copy.common.empty} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.status}</TableHead>
                <TableHead>{copy.common.agent}</TableHead>
                <TableHead>{copy.common.workspace}</TableHead>
                <TableHead>{copy.common.issue}</TableHead>
                <TableHead>{copy.common.runtime}</TableHead>
                <TableHead>{copy.common.created}</TableHead>
                <TableHead className="text-right">{copy.common.duration}</TableHead>
                <TableHead className="text-right">{copy.common.cost}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((task) => (
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
          <LoadMoreButton
            hasNext={tasks.hasNextPage}
            loading={tasks.isFetchingNextPage}
            label={copy.common.loadMore}
            onClick={() => {
              void tasks.fetchNextPage();
            }}
          />
        </div>
      )}
    </div>
  );
}
