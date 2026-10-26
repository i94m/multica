"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { Button } from "@multica/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { adminAgentsOptions } from "../queries";
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

export default function AgentsPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const agents = useInfiniteQuery(
    adminAgentsOptions({ q: query, include_archived: includeArchived ? "true" : "" }),
  );

  if (agents.isLoading) return <LoadingState label={copy.common.loading} />;
  if (agents.isError) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void agents.refetch();
        }}
      />
    );
  }

  const items = agents.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.agents}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={includeArchived ? "brandSubtle" : "outline"}
              size="sm"
              onClick={() => setIncludeArchived((value) => !value)}
            >
              {copy.common.archived}
            </Button>
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={() => setQuery(search.trim())}
              placeholder={copy.common.searchPlaceholder}
              label={copy.common.search}
            />
          </div>
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
                <TableHead>{copy.common.workspace}</TableHead>
                <TableHead>{copy.common.owner}</TableHead>
                <TableHead>{copy.common.runtime}</TableHead>
                <TableHead className="text-right">{copy.common.runs30d}</TableHead>
                <TableHead>{copy.common.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <EntityLink href={adminPaths.agent(agent.id)}>{agent.name}</EntityLink>
                    <span className="ml-2 text-caption text-muted-foreground">{agent.kind}</span>
                    {agent.archived_at ? (
                      <span className="ml-2 text-caption text-destructive">{copy.common.archived}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <EntityLink href={adminPaths.workspace(agent.workspace_id)}>
                      {agent.workspace_name}
                    </EntityLink>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.owner_name ?? agent.owner_email ?? copy.common.none}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.runtime_name ?? copy.common.none}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(agent.runs_30d, locale)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(agent.created_at, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasNext={agents.hasNextPage}
            loading={agents.isFetchingNextPage}
            label={copy.common.loadMore}
            onClick={() => {
              void agents.fetchNextPage();
            }}
          />
        </div>
      )}
    </div>
  );
}
