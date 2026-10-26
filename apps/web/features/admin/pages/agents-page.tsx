"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { adminAgentsOptions, adminWorkspacesOptions } from "../queries";
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
  formatDateTime,
  formatNumber,
} from "../components/shared";

export default function AgentsPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const list = useAdminListState();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [kind, setKind] = useState("");
  const [permissionMode, setPermissionMode] = useState("");

  const workspaceOptions = useQuery(
    adminWorkspacesOptions({ page_size: 100, sort: "name", order: "asc" }),
  );
  const agents = useQuery(
    adminAgentsOptions({
      page: list.page,
      page_size: list.pageSize,
      sort: list.sort,
      order: list.order,
      q: query,
      workspace_id: workspaceId,
      include_archived: includeArchived ? "true" : "",
      kind,
      permission_mode: permissionMode,
    }),
  );

  if (agents.isLoading) return <LoadingState label={copy.common.loading} />;
  if (agents.isError || !agents.data) {
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

  const data = agents.data;
  const workspaceItems = [
    { value: "", label: copy.common.allWorkspaces },
    ...(workspaceOptions.data?.items.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })) ?? []),
  ];
  const kindItems = [
    { value: "", label: copy.common.allKinds },
    { value: "user", label: "user" },
    { value: "system", label: "system" },
  ];
  const permissionItems = [
    { value: "", label: copy.common.allPermissions },
    { value: "private", label: "private" },
    { value: "public_to", label: "public_to" },
  ];

  const resetPage = list.resetPage;

  return (
    <div className="space-y-4">
      <PageHeader
        title={copy.nav.agents}
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
          value={kind}
          onChange={(value) => {
            setKind(value);
            resetPage();
          }}
          items={kindItems}
          label={copy.common.kind}
        />
        <FilterSelect
          value={permissionMode}
          onChange={(value) => {
            setPermissionMode(value);
            resetPage();
          }}
          items={permissionItems}
          label={copy.common.permission}
          className="w-48"
        />
        <Button
          variant={includeArchived ? "brandSubtle" : "outline"}
          size="sm"
          onClick={() => {
            setIncludeArchived((value) => !value);
            resetPage();
          }}
        >
          {copy.common.archived}
        </Button>
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
                <TableHead>{copy.common.owner}</TableHead>
                <SortableHead
                  label={copy.common.runs30d}
                  column="runs"
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
              {data.items.map((agent) => (
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
