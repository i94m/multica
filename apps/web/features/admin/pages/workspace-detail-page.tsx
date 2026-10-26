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
import { adminWorkspaceOptions } from "../queries";
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
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function WorkspaceDetailPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const workspace = useQuery(adminWorkspaceOptions(id));

  if (workspace.isLoading) return <LoadingState label={copy.common.loading} />;
  if (workspace.isError || !workspace.data) {
    return (
      <ErrorState
        label={copy.common.notFound}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void workspace.refetch();
        }}
      />
    );
  }

  const data = workspace.data;

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} description={data.slug} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={copy.common.members} value={formatNumber(data.member_count, locale)} />
        <StatCard label={copy.common.issues} value={formatNumber(data.issue_count, locale)} />
        <StatCard label={copy.common.agents} value={formatNumber(data.agent_count, locale)} />
        <StatCard label={copy.common.runtimes} value={formatNumber(data.runtime_count, locale)} />
      </div>

      <SectionCard title={copy.common.workspace}>
        <DetailGrid
          items={[
            { label: copy.common.id, value: <code className="text-caption">{data.id}</code> },
            { label: copy.common.created, value: formatDateTime(data.created_at, locale) },
          ]}
        />
      </SectionCard>

      <SectionCard title={copy.common.owner}>
        {data.owners.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.common.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.name}</TableHead>
                <TableHead>{copy.common.email}</TableHead>
                <TableHead>{copy.common.joined}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.owners.map((owner) => (
                <TableRow key={owner.user_id}>
                  <TableCell>
                    <EntityLink href={adminPaths.user(owner.user_id)}>{owner.name}</EntityLink>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{owner.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(owner.created_at, locale)}
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
