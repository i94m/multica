"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { ArrowUpDown, Download } from "@multica/ui/icons";
import {
  addDaysDateOnly,
  dateOnlyToLocalDate,
  formatDateOnly,
  todayDateOnly,
} from "@multica/core/issues/date";
import { Button } from "@multica/ui/components/ui/button";
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
import { AdminDatePicker } from "./date-picker";
import {
  AdminPagination,
  EmptyState,
  EntityLink,
  ErrorState,
  FilterSelect,
  SectionCard,
  StatCard,
  formatDateTime,
  formatNumber,
} from "./shared";
import { adminPaths } from "../paths";
import { useAdminCopy } from "../i18n";
import {
  adminUsageMatrixOptions,
  adminUsageOptions,
  adminUsageTrendOptions,
  adminWorkspacesOptions,
} from "../queries";
import type { AdminUsageRow, AdminUsageTotals } from "../schemas";

const dimensions = ["workspace", "agent", "model", "project", "runtime", "provider"] as const;
type Dimension = (typeof dimensions)[number];

type SortKey =
  | "name"
  | "issueCount"
  | "taskCount"
  | "duration"
  | "lastActiveAt"
  | "totalTokens"
  | "cacheReadTokens"
  | "cacheHit"
  | "perTask"
  | "share";

const CHART_BARS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-muted-foreground/40",
];

function dayStartISO(day: string): string {
  const start = dateOnlyToLocalDate(day);
  return (start ?? new Date()).toISOString();
}

function nextDayStartISO(day: string): string {
  const start = dateOnlyToLocalDate(day);
  if (!start) return new Date().toISOString();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).toISOString();
}

function totalTokens(row: { input_tokens: number; output_tokens: number; cache_read_tokens: number }) {
  return row.input_tokens + row.output_tokens + row.cache_read_tokens;
}

function perTask(tokens: number, tasks: number): number {
  return tasks > 0 ? tokens / tasks : 0;
}

function cacheHit(row: { input_tokens: number; cache_read_tokens: number }): number {
  const seen = row.input_tokens + row.cache_read_tokens;
  return seen > 0 ? row.cache_read_tokens / seen : 0;
}

/** Compact token counts for chart legends and heatmap cells. */
function compact(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/** Token totals are shown in millions so ten columns still fit; the exact count lives in the title. */
function formatMillions(value: number, locale: string): string {
  const millions = value / 1e6;
  const digits = millions > 0 && millions < 1 ? 2 : 1;
  return `${millions.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}M`;
}

function TokenCell({ value, locale }: { value: number; locale: string }) {
  return (
    <span title={formatNumber(value, locale)} className="tabular-nums">
      {formatMillions(value, locale)}
    </span>
  );
}

function formatWorkTime(seconds: number): string {
  if (seconds <= 0) return "—";
  return `${(seconds / 3600).toFixed(1)}h`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function bucketLabel(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const copy = useAdminCopy();
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  return (
    <span className="ml-1 text-caption font-normal text-muted-foreground" title={copy.usage.vsPrevious}>
      {change >= 0 ? "↑" : "↓"} {percent(Math.abs(change))}
    </span>
  );
}

function SortHead({
  label,
  column,
  sort,
  order,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  order: "asc" | "desc";
  onSort: (column: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        <ArrowUpDown className={`size-3 ${sort === column ? "text-foreground" : "text-faint-foreground"}`} />
        <span className="sr-only">{order}</span>
      </button>
    </TableHead>
  );
}

export function UsageReport() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [range, setRange] = useState(() => ({
    from: addDaysDateOnly(-6),
    to: todayDateOnly(),
  }));
  const [preset, setPreset] = useState<7 | 30 | 90 | null>(7);
  const [dimension, setDimension] = useState<Dimension>("workspace");
  const [workspaceId, setWorkspaceId] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [bucket, setBucket] = useState<"day" | "week">("day");
  const [sort, setSort] = useState<SortKey>("totalTokens");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fromDay = range.from || addDaysDateOnly(-6);
  const toDay = range.to || todayDateOnly();
  const from = dayStartISO(fromDay);
  const to = nextDayStartISO(toDay);

  const filters = useMemo(
    () => ({ from, to, workspace_id: workspaceId, provider, model }),
    [from, to, workspaceId, provider, model],
  );

  const usage = useQuery(adminUsageOptions({ ...filters, group_by: dimension }));
  const filterOptions = useQuery(adminUsageOptions({ from, to, group_by: "model" }));
  const trend = useQuery(adminUsageTrendOptions({ ...filters, bucket }));
  const matrix = useQuery(adminUsageMatrixOptions(filters));
  const workspaceList = useQuery(
    adminWorkspacesOptions({ page_size: 100, sort: "name", order: "asc" }),
  );

  const spanMs = new Date(to).getTime() - new Date(from).getTime();
  const previous = useQuery(
    adminUsageOptions({
      ...filters,
      group_by: dimension,
      from: new Date(new Date(from).getTime() - spanMs).toISOString(),
      to: from,
    }),
  );

  const applyPreset = (days: 7 | 30 | 90) => {
    setPreset(days);
    setRange({ from: addDaysDateOnly(-(days - 1)), to: todayDateOnly() });
    setPage(1);
  };

  const updateFrom = (value: string) => {
    const next = value || addDaysDateOnly(-6);
    setPreset(null);
    setRange((prev) => ({ from: next, to: prev.to < next ? next : prev.to }));
    setPage(1);
  };

  const updateTo = (value: string) => {
    const next = value || todayDateOnly();
    setPreset(null);
    setRange((prev) => ({ from: prev.from > next ? next : prev.from, to: next }));
    setPage(1);
  };

  const onSort = (column: SortKey) => {
    setOrder((prevOrder) => (sort === column ? (prevOrder === "desc" ? "asc" : "desc") : "desc"));
    setSort(column);
    setPage(1);
  };

  const rows = usage.data?.rows ?? [];
  const totals: AdminUsageTotals | undefined = usage.data?.totals;
  const totalsTokens = totals ? totalTokens(totals) : 0;

  const workspaceIssues = new Map(
    (workspaceList.data?.items ?? []).map((workspace) => [workspace.id, workspace.issue_count]),
  );
  const issuesFor = (row: AdminUsageRow) =>
    dimension === "workspace" ? (workspaceIssues.get(row.workspace_id) ?? 0) : 0;

  const valueFor = (row: AdminUsageRow, key: SortKey): number | string => {
    const tokens = totalTokens(row);
    switch (key) {
      case "name":
        return row.name || row.workspace_name;
      case "issueCount":
        return issuesFor(row);
      case "duration":
        return row.duration_seconds;
      case "cacheReadTokens":
        return row.cache_read_tokens;
      case "cacheHit":
        return cacheHit(row);
      case "taskCount":
        return row.task_count;
      case "perTask":
        return perTask(tokens, row.task_count);
      case "lastActiveAt":
        return row.last_active_at;
      case "share":
        return totalsTokens > 0 ? tokens / totalsTokens : 0;
      default:
        return tokens;
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const left = valueFor(a, sort);
    const right = valueFor(b, sort);
    const result =
      typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right))
        : left - right;
    return order === "asc" ? result : -result;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const providerItems = [
    { value: "", label: copy.common.allProviders },
    ...[...new Set((filterOptions.data?.rows ?? []).map((row) => row.provider).filter(Boolean))].map(
      (value) => ({ value, label: value }),
    ),
  ];
  const modelItems = [
    { value: "", label: copy.common.allModels },
    ...[...new Set((filterOptions.data?.rows ?? []).map((row) => row.model).filter(Boolean))].map(
      (value) => ({ value, label: value }),
    ),
  ];
  const workspaceItems = [
    { value: "", label: copy.common.allWorkspaces },
    ...(workspaceList.data?.items.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })) ?? []),
  ];

  const dimensionItems = dimensions.map((value) => ({
    value,
    label:
      value === "workspace"
        ? copy.common.workspaceGroup
        : value === "agent"
          ? copy.common.agentGroup
          : value === "model"
            ? copy.common.modelGroup
            : value === "project"
              ? copy.common.projectGroup
              : value === "runtime"
                ? copy.common.runtimeGroup
                : copy.common.providerGroup,
  }));

  const trendPoints = trend.data?.points ?? [];
  const bucketTotals = new Map<string, number>();
  const workspaceTotals = new Map<string, { name: string; tokens: number }>();
  for (const point of trendPoints) {
    const tokens = totalTokens(point);
    bucketTotals.set(point.bucket_start, (bucketTotals.get(point.bucket_start) ?? 0) + tokens);
    const current = workspaceTotals.get(point.workspace_id) ?? {
      name: point.workspace_name,
      tokens: 0,
    };
    current.tokens += tokens;
    workspaceTotals.set(point.workspace_id, current);
  }
  const topWorkspaces = [...workspaceTotals.entries()]
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .slice(0, 5)
    .map(([id, value]) => ({ id, ...value }));
  const topIds = new Set(topWorkspaces.map((item) => item.id));
  const bucketKeys = [...bucketTotals.keys()].sort();
  const maxBucket = Math.max(1, ...bucketTotals.values());

  const cells = matrix.data?.cells ?? [];
  const matrixWorkspaces = [...new Map(cells.map((cell) => [cell.workspace_id, cell.workspace_name])).entries()]
    .map(([id, name]) => ({ id, name, tokens: cells.filter((cell) => cell.workspace_id === id).reduce((sum, cell) => sum + totalTokens(cell), 0) }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);
  const matrixModels = [...new Set(cells.map((cell) => `${cell.provider} / ${cell.model}`))]
    .map((key) => ({
      key,
      tokens: cells.filter((cell) => `${cell.provider} / ${cell.model}` === key).reduce((sum, cell) => sum + totalTokens(cell), 0),
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 6);
  const cellMap = new Map(
    cells.map((cell) => [`${cell.workspace_id}|${cell.provider} / ${cell.model}`, totalTokens(cell)]),
  );
  const maxCell = Math.max(1, ...cellMap.values());

  const exportCsv = () => {
    const header = [
      copy.common.name,
      copy.common.workspace,
      copy.common.issues,
      copy.usage.tasks,
      copy.usage.workTime,
      copy.usage.lastActive,
      copy.usage.totalTokens,
      copy.usage.cacheRead,
      copy.usage.cacheHit,
      copy.usage.perTask,
      copy.usage.share,
    ];
    const body = sortedRows.map((row) => [
      row.name || row.workspace_name,
      row.workspace_name,
      dimension === "workspace" ? issuesFor(row) : "",
      row.task_count,
      (row.duration_seconds / 3600).toFixed(2),
      row.last_active_at,
      totalTokens(row),
      row.cache_read_tokens,
      cacheHit(row).toFixed(4),
      Math.round(perTask(totalTokens(row), row.task_count)),
      totalsTokens > 0 ? (totalTokens(row) / totalsTokens).toFixed(4) : "0",
    ]);
    downloadCsv(`multica-usage-${dimension}-${fromDay}-${toDay}.csv`, [header, ...body]);
  };

  if (usage.isLoading) {
    return <p className="text-body text-muted-foreground">{copy.common.loading}</p>;
  }
  if (usage.isError || !usage.data || !totals) {
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

  const previousTotals = previous.data?.totals;
  const kpis = [
    {
      label: copy.usage.input,
      value: formatNumber(totals.input_tokens, locale),
      current: totals.input_tokens,
      prev: previousTotals?.input_tokens ?? 0,
    },
    {
      label: copy.usage.output,
      value: formatNumber(totals.output_tokens, locale),
      current: totals.output_tokens,
      prev: previousTotals?.output_tokens ?? 0,
    },
    {
      label: copy.usage.cacheRead,
      value: formatNumber(totals.cache_read_tokens, locale),
      current: totals.cache_read_tokens,
      prev: previousTotals?.cache_read_tokens ?? 0,
    },
    {
      label: copy.usage.cacheWrite,
      value: formatNumber(totals.cache_write_tokens, locale),
      current: totals.cache_write_tokens,
      prev: previousTotals?.cache_write_tokens ?? 0,
    },
    {
      label: copy.usage.tasks,
      value: formatNumber(totals.task_count, locale),
      current: totals.task_count,
      prev: previousTotals?.task_count ?? 0,
    },
    {
      label: copy.usage.activeWorkspaces,
      value: formatNumber(totals.active_workspaces, locale),
      current: totals.active_workspaces,
      prev: previousTotals?.active_workspaces ?? 0,
    },
    {
      label: copy.usage.activeAgents,
      value: formatNumber(totals.active_agents, locale),
      current: totals.active_agents,
      prev: previousTotals?.active_agents ?? 0,
    },
    {
      label: copy.usage.cost,
      value: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(totals.cost_usd),
      current: 0,
      prev: 0,
    },
  ];

  const linkFor = (row: AdminUsageRow) => {
    if (dimension === "workspace") return adminPaths.workspace(row.id);
    if (dimension === "agent") return adminPaths.agent(row.id);
    if (dimension === "runtime") return adminPaths.runtime(row.id);
    return null;
  };

  const rangeLabel = `${formatDateOnly(fromDay, { month: "short", day: "numeric" }, locale)} – ${formatDateOnly(toDay, { month: "short", day: "numeric" }, locale)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([7, 30, 90] as const).map((days) => (
          <Button
            key={days}
            variant={preset === days ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(days)}
          >
            {days === 7 ? copy.usage.last7 : days === 30 ? copy.usage.last30 : copy.usage.last90}
          </Button>
        ))}
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
        <FilterSelect
          value={workspaceId}
          onChange={(value) => {
            setWorkspaceId(value);
            setPage(1);
          }}
          items={workspaceItems}
          label={copy.common.workspace}
          className="w-52"
        />
        <FilterSelect
          value={provider}
          onChange={(value) => {
            setProvider(value);
            setPage(1);
          }}
          items={providerItems}
          label={copy.common.provider}
          className="w-40"
        />
        <FilterSelect
          value={model}
          onChange={(value) => {
            setModel(value);
            setPage(1);
          }}
          items={modelItems}
          label={copy.common.model}
          className="w-56"
        />
        <div className="ml-auto flex items-center gap-2">
          <Select
            items={dimensionItems}
            value={dimension}
            onValueChange={(next) => {
              if (dimensions.includes(next as Dimension)) {
                setDimension(next as Dimension);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-40" aria-label={copy.common.groupBy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {dimensionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-caption text-muted-foreground">
        {rangeLabel} · {copy.usage.excludedNote} · {copy.usage.costNote}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={
              <>
                {kpi.value}
                <Delta current={kpi.current} previous={kpi.prev} />
              </>
            }
          />
        ))}
      </div>

      <SectionCard
        title={`${copy.usage.ranking} · ${dimensionItems.find((item) => item.value === dimension)?.label ?? ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="size-3.5" />
            {copy.usage.exportCsv}
          </Button>
        }
      >
        {pageRows.length === 0 ? (
          <EmptyState label={copy.common.noData} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead
                    label={dimensionItems.find((item) => item.value === dimension)?.label ?? copy.common.name}
                    column="name"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                  />
                  <SortHead
                    label={copy.common.issues}
                    column="issueCount"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.tasks}
                    column="taskCount"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.workTime}
                    column="duration"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.lastActive}
                    column="lastActiveAt"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                  />
                  <SortHead
                    label={copy.usage.totalTokens}
                    column="totalTokens"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.cacheRead}
                    column="cacheReadTokens"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.cacheHit}
                    column="cacheHit"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.perTask}
                    column="perTask"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                  <SortHead
                    label={copy.usage.share}
                    column="share"
                    sort={sort}
                    order={order}
                    onSort={onSort}
                    className="text-right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const href = linkFor(row);
                  const label = row.name || row.workspace_name;
                  return (
                    <TableRow key={`${row.id}-${row.name}`}>
                      <TableCell>
                        <div className="max-w-[9rem] truncate" title={label}>
                          {href ? <EntityLink href={href}>{label}</EntityLink> : <span>{label}</span>}
                          {dimension !== "workspace" && row.workspace_name ? (
                            <span className="ml-2 text-caption text-muted-foreground">
                              {row.workspace_name}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dimension === "workspace"
                          ? formatNumber(issuesFor(row), locale)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.task_count, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatWorkTime(row.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.last_active_at, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <TokenCell value={totalTokens(row)} locale={locale} />
                      </TableCell>
                      <TableCell className="text-right">
                        <TokenCell value={row.cache_read_tokens} locale={locale} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percent(cacheHit(row))}
                      </TableCell>
                      <TableCell className="text-right">
                        <TokenCell
                          value={Math.round(perTask(totalTokens(row), row.task_count))}
                          locale={locale}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totalsTokens > 0 ? percent(totalTokens(row) / totalsTokens) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <AdminPagination
          page={currentPage}
          pageSize={pageSize}
          total={sortedRows.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          labels={{
            results: `${copy.common.showing} ${formatNumber(sortedRows.length, locale)} ${copy.common.results}`,
            pageSize: copy.common.pageSize,
            previous: copy.common.previous,
            next: copy.common.next,
          }}
        />
      </SectionCard>

      <SectionCard
        title={copy.usage.trendTitle}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant={bucket === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setBucket("day")}
            >
              {copy.usage.bucketDay}
            </Button>
            <Button
              variant={bucket === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setBucket("week")}
            >
              {copy.usage.bucketWeek}
            </Button>
          </div>
        }
      >
        {bucketKeys.length === 0 ? (
          <EmptyState label={copy.common.noData} />
        ) : (
          <div className="space-y-3">
            <div className="flex h-44 items-end gap-2">
              {bucketKeys.map((key) => {
                const total = bucketTotals.get(key) ?? 0;
                const height = Math.max(4, (total / maxBucket) * 100);
                const segments = topWorkspaces.map((workspace) => {
                  const value =
                    trendPoints
                      .filter((point) => point.bucket_start === key && point.workspace_id === workspace.id)
                      .reduce((sum, point) => sum + totalTokens(point), 0) ?? 0;
                  return { id: workspace.id, name: workspace.name, value };
                });
                const others =
                  trendPoints
                    .filter((point) => point.bucket_start === key && !topIds.has(point.workspace_id))
                    .reduce((sum, point) => sum + totalTokens(point), 0) ?? 0;
                return (
                  <div key={key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                      style={{ height: `${height}%` }}
                      title={`${bucketLabel(key, locale)} · ${formatNumber(total, locale)}`}
                    >
                      {segments.map((segment, index) =>
                        segment.value > 0 ? (
                          <div
                            key={segment.id}
                            className={CHART_BARS[index] ?? CHART_BARS[0]}
                            style={{ height: `${(segment.value / total) * 100}%` }}
                            title={`${segment.name} · ${formatNumber(segment.value, locale)}`}
                          />
                        ) : null,
                      )}
                      {others > 0 ? (
                        <div
                          className={CHART_BARS[5]}
                          style={{ height: `${(others / total) * 100}%` }}
                          title={`${copy.usage.others} · ${formatNumber(others, locale)}`}
                        />
                      ) : null}
                    </div>
                    <span className="truncate text-caption text-muted-foreground">
                      {bucketLabel(key, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
              {topWorkspaces.map((workspace, index) => (
                <span key={workspace.id} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${CHART_BARS[index] ?? CHART_BARS[0]}`} />
                  {workspace.name}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${CHART_BARS[5]}`} />
                {copy.usage.others}
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={copy.usage.matrixTitle} description={copy.usage.matrixNote}>
        {matrixWorkspaces.length === 0 || matrixModels.length === 0 ? (
          <EmptyState label={copy.common.noData} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.common.workspace}</TableHead>
                  {matrixModels.map((model) => (
                    <TableHead key={model.key} className="text-right">
                      {model.key.split(" / ").slice(1).join(" / ") || model.key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixWorkspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell>
                      <EntityLink href={adminPaths.workspace(workspace.id)}>
                        {workspace.name}
                      </EntityLink>
                    </TableCell>
                    {matrixModels.map((model) => {
                      const value = cellMap.get(`${workspace.id}|${model.key}`) ?? 0;
                      const ratio = value > 0 ? 0.08 + 0.42 * (value / maxCell) : 0;
                      return (
                        <TableCell key={model.key} className="text-right tabular-nums">
                          <span
                            className="inline-block rounded px-2 py-1"
                            style={
                              value > 0
                                ? {
                                    backgroundColor: `color-mix(in oklab, var(--color-chart-1) ${Math.round(ratio * 100)}%, transparent)`,
                                  }
                                : undefined
                            }
                            title={formatNumber(value, locale)}
                          >
                            {value > 0 ? compact(value) : "—"}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
