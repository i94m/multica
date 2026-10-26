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
import { adminRuntimesOptions } from "../queries";
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
  StatusBadge,
  formatDateTime,
} from "../components/shared";

export default function RuntimesPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const runtimes = useInfiniteQuery(adminRuntimesOptions({ q: query }));

  if (runtimes.isLoading) return <LoadingState label={copy.common.loading} />;
  if (runtimes.isError) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void runtimes.refetch();
        }}
      />
    );
  }

  const items = runtimes.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.runtimes}
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
                <TableHead>{copy.common.workspace}</TableHead>
                <TableHead>{copy.common.owner}</TableHead>
                <TableHead>{copy.common.provider}</TableHead>
                <TableHead>{copy.common.status}</TableHead>
                <TableHead>{copy.common.lastSeen}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((runtime) => (
                <TableRow key={runtime.id}>
                  <TableCell>
                    <EntityLink href={adminPaths.runtime(runtime.id)}>
                      {runtime.display_name}
                    </EntityLink>
                  </TableCell>
                  <TableCell>
                    <EntityLink href={adminPaths.workspace(runtime.workspace_id)}>
                      {runtime.workspace_name}
                    </EntityLink>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {runtime.owner_name ?? runtime.owner_email ?? copy.common.none}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{runtime.provider}</TableCell>
                  <TableCell>
                    <StatusBadge status={runtime.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(runtime.last_seen_at, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasNext={runtimes.hasNextPage}
            loading={runtimes.isFetchingNextPage}
            label={copy.common.loadMore}
            onClick={() => {
              void runtimes.fetchNextPage();
            }}
          />
        </div>
      )}
    </div>
  );
}
