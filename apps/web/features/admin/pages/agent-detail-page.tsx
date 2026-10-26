"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { adminAgentOptions } from "../queries";
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
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function AgentDetailPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const agent = useQuery(adminAgentOptions(id));

  if (agent.isLoading) return <LoadingState label={copy.common.loading} />;
  if (agent.isError || !agent.data) {
    return (
      <ErrorState
        label={copy.common.notFound}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void agent.refetch();
        }}
      />
    );
  }

  const data = agent.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        actions={
          data.archived_at ? <StatusBadge status={copy.common.archived} /> : <StatusBadge status={data.status || copy.common.active} />
        }
      />

      <SectionCard title={copy.nav.agents}>
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
            { label: copy.common.runtime, value: data.runtime_name ?? copy.common.none },
            { label: copy.common.model, value: data.model ?? copy.common.none },
            { label: copy.common.kind, value: data.kind },
            { label: copy.common.permission, value: data.permission_mode },
            { label: copy.common.runs30d, value: formatNumber(data.runs_30d, locale) },
            { label: copy.common.created, value: formatDateTime(data.created_at, locale) },
            { label: copy.common.updated, value: formatDateTime(data.updated_at, locale) },
            { label: copy.common.archived, value: formatDateTime(data.archived_at, locale) },
          ]}
        />
      </SectionCard>

      {data.description ? (
        <SectionCard title={copy.common.description}>
          <p className="text-body whitespace-pre-wrap">{data.description}</p>
        </SectionCard>
      ) : null}
    </div>
  );
}
