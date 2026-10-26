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
import { adminWorkspacesOptions } from "../queries";
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

export default function WorkspacesPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const list = useAdminListState();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const workspaces = useQuery(
    adminWorkspacesOptions({
      page: list.page,
      page_size: list.pageSize,
      sort: list.sort,
      order: list.order,
      q: query,
    }),
  );

  if (workspaces.isLoading) return <LoadingState label={copy.common.loading} />;
  if (workspaces.isError || !workspaces.data) {
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

  const data = workspaces.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.workspaces}
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
                  label={copy.common.members}
                  column="members"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                  className="text-right"
                />
                <SortableHead
                  label={copy.common.issues}
                  column="issues"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                  className="text-right"
                />
                <SortableHead
                  label={copy.common.agents}
                  column="agents"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                  className="text-right"
                />
                <SortableHead
                  label={copy.common.runtimes}
                  column="runtimes"
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
              {data.items.map((workspace) => (
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
