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
import { adminUserOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  DetailGrid,
  EntityLink,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function UserDetailPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const user = useQuery(adminUserOptions(id));

  if (user.isLoading) return <LoadingState label={copy.common.loading} />;
  if (user.isError || !user.data) {
    return (
      <ErrorState
        label={copy.common.notFound}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void user.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={user.data.name || user.data.email} />
      <SectionCard title={copy.common.name}>
        <DetailGrid
          items={[
            { label: copy.common.email, value: user.data.email },
            { label: copy.common.id, value: <code className="text-caption">{user.data.id}</code> },
            { label: copy.common.created, value: formatDateTime(user.data.created_at, locale) },
            {
              label: copy.common.joined,
              value: formatDateTime(user.data.onboarded_at, locale),
            },
            {
              label: copy.common.workspaces,
              value: formatNumber(user.data.workspace_count, locale),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title={copy.nav.workspaces}>
        {user.data.memberships.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.common.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.name}</TableHead>
                <TableHead>{copy.common.role}</TableHead>
                <TableHead>{copy.common.joined}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.data.memberships.map((membership) => (
                <TableRow key={membership.id}>
                  <TableCell>
                    <EntityLink href={adminPaths.workspace(membership.workspace_id)}>
                      {membership.workspace_name}
                    </EntityLink>
                    <span className="ml-2 text-caption text-muted-foreground">
                      {membership.workspace_slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code className="text-caption">{membership.role}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(membership.created_at, locale)}
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
