"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export default function UsagePage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [groupBy, setGroupBy] = useState<"workspace" | "agent" | "model">("workspace");
  const usage = useQuery(adminUsageOptions({ group_by: groupBy }));

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
        description={copy.common.days30}
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
