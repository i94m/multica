"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import {
  addDaysDateOnly,
  dateOnlyToLocalDate,
  formatDateOnly,
  todayDateOnly,
} from "@multica/core/issues/date";
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
import { AdminDatePicker } from "../components/date-picker";
import { adminUsageOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  EmptyState,
  EntityLink,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  formatCost,
  formatNumber,
} from "../components/shared";

/** Start of a calendar day in the viewer's timezone, as an instant. */
function dayStartISO(day: string): string {
  const start = dateOnlyToLocalDate(day);
  return (start ?? new Date()).toISOString();
}

/** Exclusive upper bound: the next local midnight after an inclusive day. */
function nextDayStartISO(day: string): string {
  const start = dateOnlyToLocalDate(day);
  if (!start) return new Date().toISOString();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).toISOString();
}

export default function UsagePage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [groupBy, setGroupBy] = useState<"workspace" | "agent" | "model">("workspace");
  const [range, setRange] = useState(() => ({
    from: addDaysDateOnly(-6),
    to: todayDateOnly(),
  }));
  const from = range.from || addDaysDateOnly(-6);
  const to = range.to || todayDateOnly();
  const params = useMemo(
    () => ({ group_by: groupBy, from: dayStartISO(from), to: nextDayStartISO(to) }),
    [groupBy, from, to],
  );
  const usage = useQuery(adminUsageOptions(params));

  const updateFrom = (value: string) => {
    const next = value || addDaysDateOnly(-6);
    setRange((prev) => ({ from: next, to: prev.to < next ? next : prev.to }));
  };
  const updateTo = (value: string) => {
    const next = value || todayDateOnly();
    setRange((prev) => ({ from: prev.from > next ? next : prev.from, to: next }));
  };

  if (usage.isLoading) return <LoadingState label={copy.common.loading} />;
  if (usage.isError || !usage.data) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void usage.refetch();
        }}
      />
    );
  }

  const data = usage.data;
  const groupItems = [
    { value: "workspace", label: copy.common.workspaceGroup },
    { value: "agent", label: copy.common.agentGroup },
    { value: "model", label: copy.common.modelGroup },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.usage}
        description={`${formatDateOnly(from, { month: "short", day: "numeric" }, locale)} – ${formatDateOnly(to, { month: "short", day: "numeric" }, locale)} · ${copy.usage.excludedNote}`}
        actions={
          <Select
            items={groupItems}
            value={groupBy}
            onValueChange={(next) => {
              if (next === "workspace" || next === "agent" || next === "model") setGroupBy(next);
            }}
          >
            <SelectTrigger className="w-40" aria-label={copy.common.groupBy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {groupItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{copy.common.from}</span>
          <AdminDatePicker
            value={range.from}
            onChange={updateFrom}
            label={copy.common.from}
            placeholder={copy.common.anyDate}
            emptyLabel={copy.common.anyDate}
          />
        </div>
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{copy.common.to}</span>
          <AdminDatePicker
            value={range.to}
            onChange={updateTo}
            label={copy.common.to}
            placeholder={copy.common.anyDate}
            emptyLabel={copy.common.anyDate}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={copy.usage.input} value={formatNumber(data.totals.input_tokens, locale)} />
        <StatCard label={copy.usage.output} value={formatNumber(data.totals.output_tokens, locale)} />
        <StatCard label={copy.usage.cost} value={formatCost(data.totals.cost_usd, locale)} />
        <StatCard label={copy.usage.tasks} value={formatNumber(data.totals.task_count, locale)} />
      </div>

      <SectionCard title={copy.nav.usage}>
        {data.rows.length === 0 ? (
          <EmptyState label={copy.common.noData} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {groupBy === "workspace"
                    ? copy.common.workspaceGroup
                    : groupBy === "agent"
                      ? copy.common.agentGroup
                      : copy.common.modelGroup}
                </TableHead>
                <TableHead className="text-right">{copy.usage.input}</TableHead>
                <TableHead className="text-right">{copy.usage.output}</TableHead>
                <TableHead className="text-right">{copy.usage.cost}</TableHead>
                {groupBy === "model" ? (
                  <TableHead className="text-right">{copy.usage.tasks}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, index) => (
                <TableRow key={`${row.id}-${row.provider}-${row.model}-${index}`}>
                  <TableCell>
                    {groupBy === "workspace" ? (
                      <EntityLink href={adminPaths.workspace(row.workspace_id)}>
                        {row.name || row.workspace_name}
                      </EntityLink>
                    ) : groupBy === "agent" ? (
                      <span>
                        <EntityLink href={adminPaths.agent(row.id)}>{row.name}</EntityLink>
                        <span className="ml-2 text-caption text-muted-foreground">
                          {row.workspace_name}
                        </span>
                      </span>
                    ) : (
                      <span>
                        {row.provider} / {row.model}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.input_tokens, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.output_tokens, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCost(row.cost_usd, locale)}
                  </TableCell>
                  {groupBy === "model" ? (
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.task_count ?? 0, locale)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
