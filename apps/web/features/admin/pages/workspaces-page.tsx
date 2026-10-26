"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { adminWorkspacesOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import {
  EmptyState,
  EntityLink,
  ErrorState,
  LoadMoreButton,
  LoadingState,
  PageHeader,
  SearchBar,
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function WorkspacesPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const workspaces = useInfiniteQuery(adminWorkspacesOptions({ q: query }));

  if (workspaces.isLoading) return <LoadingState label={copy.common.loading} />;
  if (workspaces.isError) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void workspaces.refetch();
        }}
      />
    );
  }

  const items = workspaces.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.workspaces}
        actions={
          <SearchBar
            value={search}
            onChange={setSearch}
            onSubmit={() => setQuery(search.trim())}
            placeholder={copy.common.searchPlaceholder}
            label={copy.common.search}
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState label={copy.common.empty} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.name}</TableHead>
                <TableHead className="text-right">{copy.common.members}</TableHead>
                <TableHead className="text-right">{copy.common.issues}</TableHead>
                <TableHead className="text-right">{copy.common.agents}</TableHead>
                <TableHead className="text-right">{copy.common.runtimes}</TableHead>
                <TableHead>{copy.common.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <EntityLink href={adminPaths.workspace(workspace.id)}>
                      {workspace.name}
                    </EntityLink>
                    <span className="ml-2 text-caption text-muted-foreground">{workspace.slug}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(workspace.member_count, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(workspace.issue_count, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(workspace.agent_count, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(workspace.runtime_count, locale)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(workspace.created_at, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasNext={workspaces.hasNextPage}
            loading={workspaces.isFetchingNextPage}
            label={copy.common.loadMore}
            onClick={() => {
              void workspaces.fetchNextPage();
            }}
          />
        </div>
      )}
    </div>
  );
}
