"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { Button } from "@multica/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { useAdminCopy } from "../i18n";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  formatDateTime,
} from "../components/shared";
import { adminKeys, adminWorkspacesOptions } from "../queries";
import { skillsApi, type AdminGlobalSkill } from "../skills";

// The global skill pool. A global skill belongs to no workspace and applies to
// every agent; this page is the only place a skill changes scope, so a
// workspace owner cannot publish into every tenant.
export default function SkillsPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const globalSkills = useQuery({
    queryKey: [...adminKeys.all(), "global-skills"],
    queryFn: skillsApi.listGlobal,
  });
  const workspaces = useQuery(adminWorkspacesOptions({ page: 1, page_size: 100 }));
  const workspaceItems = useMemo(
    () => (workspaces.data?.items ?? []).map((ws) => ({ value: ws.id, label: ws.name })),
    [workspaces.data],
  );

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteWorkspace, setPromoteWorkspace] = useState("");
  const [demoting, setDemoting] = useState<AdminGlobalSkill | null>(null);
  const [demoteWorkspace, setDemoteWorkspace] = useState("");
  const [error, setError] = useState("");

  const workspaceSkills = useQuery({
    queryKey: [...adminKeys.all(), "workspace-skills", promoteWorkspace],
    queryFn: () => skillsApi.listWorkspace(promoteWorkspace),
    enabled: promoteWorkspace !== "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...adminKeys.all(), "global-skills"] });
    queryClient.invalidateQueries({ queryKey: [...adminKeys.all(), "workspace-skills"] });
  };

  const promote = useMutation({
    mutationFn: (skillId: string) => skillsApi.promote(skillId),
    onSuccess: () => {
      invalidate();
      setPromoteOpen(false);
      setPromoteWorkspace("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const demote = useMutation({
    mutationFn: (vars: { skillId: string; workspaceId: string }) =>
      skillsApi.demote(vars.skillId, vars.workspaceId),
    onSuccess: () => {
      invalidate();
      setDemoting(null);
      setDemoteWorkspace("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const skills = globalSkills.data?.skills ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.skills.title}
        description={copy.skills.description}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setError("");
              setPromoteOpen(true);
            }}
          >
            {copy.skills.promote}
          </Button>
        }
      />

      {globalSkills.isLoading ? (
        <LoadingState label={copy.common.loading} />
      ) : globalSkills.isError ? (
        <ErrorState
          label={copy.common.error}
          onRetry={() => globalSkills.refetch()}
          retryLabel={copy.common.refresh}
        />
      ) : skills.length === 0 ? (
        <EmptyState label={copy.skills.empty} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.skills.name}</TableHead>
              <TableHead>{copy.skills.rolesColumn}</TableHead>
              <TableHead className="w-40">{copy.skills.updated}</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => (
              <TableRow key={skill.id}>
                <TableCell>
                  <div className="font-medium">{skill.name}</div>
                  {skill.description ? (
                    <div className="text-caption text-muted-foreground">{skill.description}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {skill.roles.length > 0 ? skill.roles.join(" · ") : copy.skills.noRoles}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(skill.updated_at, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setDemoteWorkspace("");
                      setDemoting(skill);
                    }}
                  >
                    {copy.skills.moveToWorkspace}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={promoteOpen}
        onOpenChange={(next) => {
          setPromoteOpen(next);
          if (!next) setError("");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.skills.promoteTitle}</DialogTitle>
            <DialogDescription>{copy.skills.promoteBody}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Select
              items={workspaceItems}
              value={promoteWorkspace}
              onValueChange={(next) => setPromoteWorkspace(next ?? "")}
            >
              <SelectTrigger className="w-full" aria-label={copy.skills.workspace}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {workspaceItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {promoteWorkspace === "" ? (
              <p className="text-caption text-muted-foreground">{copy.skills.pickWorkspace}</p>
            ) : workspaceSkills.isLoading ? (
              <LoadingState label={copy.common.loading} />
            ) : (workspaceSkills.data?.skills ?? []).length === 0 ? (
              <p className="text-caption text-muted-foreground">{copy.skills.noWorkspaceSkills}</p>
            ) : (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {(workspaceSkills.data?.skills ?? []).map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-body">{skill.name}</div>
                      {skill.description ? (
                        <div className="truncate text-caption text-muted-foreground">
                          {skill.description}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      disabled={promote.isPending}
                      onClick={() => promote.mutate(skill.id)}
                    >
                      {copy.skills.promote}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {error ? <p className="text-caption text-destructive">{error}</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={demoting !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDemoting(null);
            setError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.skills.demoteTitle}</DialogTitle>
            <DialogDescription>
              {copy.skills.demoteBody.replace("{name}", demoting?.name ?? "")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Select
              items={workspaceItems}
              value={demoteWorkspace}
              onValueChange={(next) => setDemoteWorkspace(next ?? "")}
            >
              <SelectTrigger className="w-full" aria-label={copy.skills.workspace}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {workspaceItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {demoting && demoting.roles.length > 0 ? (
              <p className="text-caption text-muted-foreground">
                {copy.skills.demoteImpact.replace("{roles}", demoting.roles.join(" · "))}
              </p>
            ) : null}
            {error ? <p className="text-caption text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoting(null)}>
              {copy.common.cancel}
            </Button>
            <Button
              disabled={demoteWorkspace === "" || demote.isPending}
              onClick={() => {
                if (demoting && demoteWorkspace) {
                  demote.mutate({ skillId: demoting.id, workspaceId: demoteWorkspace });
                }
              }}
            >
              {copy.skills.moveToWorkspace}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
