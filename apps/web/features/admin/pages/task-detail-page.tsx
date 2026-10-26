"use client";

import { useParams } from "next/navigation";
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
import { adminTaskOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  DetailGrid,
  EntityLink,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatusBadge,
  formatCost,
  formatDateTime,
  formatDuration,
  formatNumber,
} from "../components/shared";

export default function TaskDetailPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const task = useQuery(adminTaskOptions(id));

  if (task.isLoading) return <LoadingState label={copy.common.loading} />;
  if (task.isError || !task.data) {
    return (
      <ErrorState
        label={copy.common.notFound}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void task.refetch();
        }}
      />
    );
  }

  const data = task.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.trigger_summary || data.id}
        actions={<StatusBadge status={data.status} />}
      />

      <SectionCard title={copy.nav.tasks}>
        <DetailGrid
          items={[
            { label: copy.common.id, value: <code className="text-caption">{data.id}</code> },
            {
              label: copy.common.agent,
              value: (
                <EntityLink href={adminPaths.agent(data.agent_id)}>{data.agent_name}</EntityLink>
              ),
            },
            {
              label: copy.common.workspace,
              value: (
                <EntityLink href={adminPaths.workspace(data.workspace_id)}>
                  {data.workspace_name}
                </EntityLink>
              ),
            },
            {
              label: copy.common.issue,
              value: data.issue_title
                ? `${data.issue_number ? `#${data.issue_number} ` : ""}${data.issue_title}`
                : copy.common.none,
            },
            { label: copy.common.runtime, value: data.runtime_name ?? copy.common.none },
            { label: copy.common.created, value: formatDateTime(data.created_at, locale) },
            { label: copy.common.started, value: formatDateTime(data.started_at, locale) },
            { label: copy.common.completed, value: formatDateTime(data.completed_at, locale) },
            { label: copy.common.duration, value: formatDuration(data.started_at, data.completed_at) },
            { label: copy.common.attempts, value: `${data.attempt} / ${data.max_attempts}` },
            { label: copy.common.tokens, value: `${formatNumber(data.input_tokens, locale)} / ${formatNumber(data.output_tokens, locale)}` },
            { label: copy.common.cost, value: formatCost(data.cost_usd, locale) },
            { label: copy.common.workflowStep, value: data.workflow_step ?? copy.common.none },
            { label: copy.common.branch, value: data.branch_name ?? copy.common.none },
          ]}
        />
      </SectionCard>

      {data.failure_reason || data.error ? (
        <SectionCard title={copy.common.failure}>
          <div className="space-y-2 text-body">
            {data.failure_reason ? <p className="font-medium">{data.failure_reason}</p> : null}
            {data.error ? (
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-caption whitespace-pre-wrap">
                {data.error}
              </pre>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={copy.nav.usage}>
        {data.usage.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.common.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.provider}</TableHead>
                <TableHead>{copy.common.model}</TableHead>
                <TableHead className="text-right">{copy.usage.input}</TableHead>
                <TableHead className="text-right">{copy.usage.output}</TableHead>
                <TableHead className="text-right">{copy.common.cost}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.usage.map((row) => (
                <TableRow key={`${row.provider}-${row.model}`}>
                  <TableCell>{row.provider}</TableCell>
                  <TableCell className="text-muted-foreground">{row.model}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.input_tokens, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.output_tokens, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCost(row.cost_usd, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
