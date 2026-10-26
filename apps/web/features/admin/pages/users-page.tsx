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
import { adminUsersOptions } from "../queries";
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

export default function UsersPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const users = useInfiniteQuery(adminUsersOptions({ q: query }));

  if (users.isLoading) return <LoadingState label={copy.common.loading} />;
  if (users.isError) {
    return (
      <ErrorState
        label={copy.common.error}
        retryLabel={copy.common.retry}
        onRetry={() => {
          void users.refetch();
        }}
      />
    );
  }

  const items = users.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.users}
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
                <TableHead>{copy.common.email}</TableHead>
                <TableHead className="text-right">{copy.common.workspaces}</TableHead>
                <TableHead>{copy.common.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <EntityLink href={adminPaths.user(user.id)}>{user.name || user.email}</EntityLink>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(user.workspace_count, locale)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(user.created_at, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LoadMoreButton
            hasNext={users.hasNextPage}
            loading={users.isFetchingNextPage}
            label={copy.common.loadMore}
            onClick={() => {
              void users.fetchNextPage();
            }}
          />
        </div>
      )}
    </div>
  );
}
