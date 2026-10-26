"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { adminOverviewOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  formatCost,
  formatNumber,
} from "../components/shared";

export default function OverviewPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const overview = useQuery(adminOverviewOptions());

  if (overview.isLoading) return <LoadingState label={copy.common.loading} />;
  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void overview.refetch();
        }}
      />
    );
  }

  const { counts, usage } = overview.data;
  const stats = [
    { label: copy.overview.users, value: formatNumber(counts.users, locale) },
    { label: copy.overview.workspaces, value: formatNumber(counts.workspaces, locale) },
    { label: copy.overview.members, value: formatNumber(counts.members, locale) },
    { label: copy.overview.issues, value: formatNumber(counts.issues, locale) },
    { label: copy.overview.agents, value: formatNumber(counts.agents, locale) },
    {
      label: copy.overview.runtimes,
      value: `${formatNumber(counts.runtimes_online, locale)} / ${formatNumber(
        counts.runtimes_online + counts.runtimes_offline,
        locale,
      )}`,
    },
    { label: copy.overview.activeTasks, value: formatNumber(counts.tasks_active, locale) },
    { label: copy.overview.tasks24h, value: formatNumber(counts.tasks_24h, locale) },
    { label: copy.overview.failed24h, value: formatNumber(counts.tasks_failed_24h, locale) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.nav.overview}
        description={copy.subtitle}
        actions={
          <span className="text-caption text-muted-foreground">
            {overview.data.generated_at ? new Date(overview.data.generated_at).toLocaleString(locale) : ""}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={copy.overview.tasksByStatus}>
          {overview.data.tasks_by_status.length === 0 ? (
            <EmptyState label={copy.common.empty} />
          ) : (
            <ul className="divide-y divide-surface-border">
              {overview.data.tasks_by_status.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-3 py-2">
                  <StatusBadge status={row.status || copy.common.none} />
                  <span className="text-body tabular-nums">{formatNumber(row.count, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={copy.overview.usage30d}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <UsageFact label={copy.usage.input} value={formatNumber(usage.input_tokens, locale)} />
            <UsageFact label={copy.usage.output} value={formatNumber(usage.output_tokens, locale)} />
            <UsageFact
              label={copy.usage.cacheRead}
              value={formatNumber(usage.cache_read_tokens, locale)}
            />
            <UsageFact
              label={copy.usage.cacheWrite}
              value={formatNumber(usage.cache_write_tokens, locale)}
            />
            <UsageFact label={copy.usage.cost} value={formatCost(usage.cost_usd, locale)} />
            <UsageFact label={copy.usage.tasks} value={formatNumber(usage.task_count, locale)} />
          </dl>
        </SectionCard>

        <SectionCard title={copy.overview.signups}>
          {overview.data.signups_daily.length === 0 ? (
            <EmptyState label={copy.common.noData} />
          ) : (
            <DailyRows rows={overview.data.signups_daily.map((row) => ({ day: row.day, values: [row.count] }))} locale={locale} />
          )}
        </SectionCard>

        <SectionCard title={copy.overview.tasksDaily}>
          {overview.data.tasks_daily.length === 0 ? (
            <EmptyState label={copy.common.noData} />
          ) : (
            <DailyRows
              rows={overview.data.tasks_daily.map((row) => ({ day: row.day, values: [row.completed, row.failed] }))}
              locale={locale}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function UsageFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function DailyRows({
  rows,
  locale,
}: {
  rows: Array<{ day: string; values: number[] }>;
  locale: string;
}) {
  return (
    <ul className="max-h-64 divide-y divide-surface-border overflow-y-auto">
      {rows.map((row) => (
        <li key={row.day} className="flex items-center justify-between gap-3 py-1.5 text-body">
          <span className="text-muted-foreground">{row.day}</span>
          <span className="tabular-nums">
            {row.values.map((value) => formatNumber(value, locale)).join(" / ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
