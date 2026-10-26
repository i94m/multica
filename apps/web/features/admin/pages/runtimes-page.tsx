"use client";

import { useState } from "react";
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
import { adminRuntimesOptions, adminWorkspacesOptions } from "../queries";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";
import { useAdminListState } from "../use-list-state";
import {
  AdminPagination,
  EmptyState,
  EntityLink,
  ErrorState,
  FilterSelect,
  LoadingState,
  PageHeader,
  SearchBar,
  SortableHead,
  StatusBadge,
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function RuntimesPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const list = useAdminListState();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");

  const workspaceOptions = useQuery(
    adminWorkspacesOptions({ page_size: 100, sort: "name", order: "asc" }),
  );
  const runtimes = useQuery(
    adminRuntimesOptions({
      page: list.page,
      page_size: list.pageSize,
      sort: list.sort,
      order: list.order,
      q: query,
      workspace_id: workspaceId,
      status,
      provider,
    }),
  );

  if (runtimes.isLoading) return <LoadingState label={copy.common.loading} />;
  if (runtimes.isError || !runtimes.data) {
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

  const data = runtimes.data;
  const workspaceItems = [
    { value: "", label: copy.common.allWorkspaces },
    ...(workspaceOptions.data?.items.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })) ?? []),
  ];
  const statusItems = [
    { value: "", label: copy.common.allStatuses },
    { value: "online", label: "online" },
    { value: "offline", label: "offline" },
  ];
  const providerItems = [
    { value: "", label: copy.common.allProviders },
    ...Array.from(new Set(data.items.map((runtime) => runtime.provider))).map((value) => ({
      value,
      label: value,
    })),
  ];

  const resetPage = list.resetPage;

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.runtimes}
        actions={
          <SearchBar
            value={search}
            onChange={setSearch}
            onSubmit={() => {
              setQuery(search.trim());
              resetPage();
            }}
            placeholder={copy.common.searchPlaceholder}
            label={copy.common.search}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={workspaceId}
          onChange={(value) => {
            setWorkspaceId(value);
            resetPage();
          }}
          items={workspaceItems}
          label={copy.common.workspace}
          className="w-56"
        />
        <FilterSelect
          value={status}
          onChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          items={statusItems}
          label={copy.common.status}
        />
        <FilterSelect
          value={provider}
          onChange={(value) => {
            setProvider(value);
            resetPage();
          }}
          items={providerItems}
          label={copy.common.provider}
        />
      </div>

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
                <TableHead>{copy.common.workspace}</TableHead>
                <SortableHead
                  label={copy.common.provider}
                  column="provider"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.status}
                  column="status"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
                <SortableHead
                  label={copy.common.lastSeen}
                  column="last_seen_at"
                  sort={list.sort}
                  order={list.order}
                  onSort={list.onSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((runtime) => (
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
