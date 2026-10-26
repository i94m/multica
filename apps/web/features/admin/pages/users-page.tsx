"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { adminUsersOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import { useAdminListState } from "../use-list-state";
import {
  AdminPagination,
  EmptyState,
  EntityLink,
  ErrorState,
  LoadingState,
  PageHeader,
  SearchBar,
  SortableHead,
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function UsersPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const list = useAdminListState();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const users = useQuery(
    adminUsersOptions({
      page: list.page,
      page_size: list.pageSize,
      sort: list.sort,
      order: list.order,
      q: query,
    }),
  );

  if (users.isLoading) return <LoadingState label={copy.common.loading} />;
  if (users.isError || !users.data) {
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

  const data = users.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.users}
        actions={
          <SearchBar
            value={search}
            onChange={setSearch}
            onSubmit={() => {
              setQuery(search.trim());
              list.resetPage();
            }}
            placeholder={copy.common.searchPlaceholder}
            label={copy.common.search}
          />
        }
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        {data.items.length === 0 ? (
          <EmptyState label={copy.common.empty} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label={copy.common.name}
                  column="name"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.email}
                  column="email"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.workspaces}
                  column="workspaces"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                  className="text-right"
                />
                <SortableHead
                  label={copy.common.created}
                  column="created_at"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
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
        )}
        <AdminPagination
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          totalPages={data.total_pages}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          labels={{
            results: `${copy.common.showing} ${formatNumber(data.total, locale)} ${copy.common.results}`,
            pageSize: copy.common.pageSize,
            previous: copy.common.previous,
            next: copy.common.next,
          }}
        />
      </div>
    </div>
  );
}
