"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { adminRuntimeOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  DetailGrid,
  EntityLink,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function RuntimeDetailPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const runtime = useQuery(adminRuntimeOptions(id));

  if (runtime.isLoading) return <LoadingState label={copy.common.loading} />;
  if (runtime.isError || !runtime.data) {
    return (
      <ErrorState
        label={copy.common.notFound}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void runtime.refetch();
        }}
      />
    );
  }

  const data = runtime.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.display_name}
        actions={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label={copy.common.tasks} value={formatNumber(data.task_count, locale)} />
        <StatCard label={copy.common.active} value={formatNumber(data.active_task_count, locale)} />
      </div>

      <SectionCard title={copy.nav.runtimes}>
        <DetailGrid
          items={[
            { label: copy.common.id, value: <code className="text-caption">{data.id}</code> },
            {
              label: copy.common.workspace,
              value: (
                <EntityLink href={adminPaths.workspace(data.workspace_id)}>
                  {data.workspace_name}
                </EntityLink>
              ),
            },
            {
              label: copy.common.owner,
              value: data.owner_name ?? data.owner_email ?? copy.common.none,
            },
            { label: copy.common.provider, value: data.provider },
            { label: copy.common.lastSeen, value: formatDateTime(data.last_seen_at, locale) },
            { label: copy.common.created, value: formatDateTime(data.created_at, locale) },
            { label: copy.common.visibility, value: data.visibility },
            { label: copy.common.device, value: data.device_info || copy.common.none },
          ]}
        />
      </SectionCard>
    </div>
  );
}
