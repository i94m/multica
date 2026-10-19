"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agentRoleListOptions,
  useCreateAgentRole,
  useDeleteAgentRole,
  useSetDefaultAgentRole,
  useUpdateAgentRole,
} from "@multica/core/agents";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import type { AgentRole, AgentRoleScope } from "@multica/core/types";
import { memberListOptions } from "@multica/core/workspace/queries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { Button } from "@multica/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { Input } from "@multica/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { cn } from "@multica/ui/lib/utils";
import { CircleUser, Globe, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "../../i18n";
import {
  CollectionPageHeader,
  CollectionPageHeaderAction,
  CollectionPageState,
} from "../../layout/collection-page";

type RoleDraft = {
  name: string;
  description: string;
  instructions: string;
  scope: AgentRoleScope;
};

const EMPTY_DRAFT: RoleDraft = {
  name: "",
  description: "",
  instructions: "",
  scope: "workspace",
};

export function RolesPage() {
  const { t } = useT("agents");
  const wsId = useWorkspaceId();
  const { data: roles = [], isLoading } = useQuery(agentRoleListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = members.find((m) => m.user_id === currentUser.id)?.role;
    return role === "owner" || role === "admin";
  }, [currentUser, members]);

  const createRole = useCreateAgentRole(wsId);
  const updateRole = useUpdateAgentRole(wsId);
  const deleteRole = useDeleteAgentRole(wsId);
  const setDefault = useSetDefaultAgentRole(wsId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentRole | null>(null);
  const [draft, setDraft] = useState<RoleDraft>(EMPTY_DRAFT);
  const [pendingDelete, setPendingDelete] = useState<AgentRole | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };
  const openEdit = (role: AgentRole) => {
    setEditing(role);
    setDraft({
      name: role.name,
      description: role.description,
      instructions: role.instructions,
      scope: role.scope,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error(t(($) => $.roles.name_required));
      return;
    }
    try {
      if (editing) {
        await updateRole.mutateAsync({
          id: editing.id,
          data: {
            name,
            description: draft.description,
            instructions: draft.instructions,
          },
        });
      } else {
        await createRole.mutateAsync({
          name,
          description: draft.description,
          instructions: draft.instructions,
          scope: draft.scope,
        });
      }
      toast.success(t(($) => $.roles.saved));
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t(($) => $.roles.save_failed),
      );
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRole.mutateAsync(pendingDelete.id);
      toast.success(t(($) => $.roles.deleted));
      setPendingDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t(($) => $.roles.delete_failed),
      );
    }
  };

  const toggleDefault = async (role: AgentRole) => {
    try {
      await setDefault.mutateAsync(role.is_default ? null : role.id);
      toast.success(t(($) => $.roles.default_saved));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t(($) => $.roles.save_failed),
      );
    }
  };

  const saving = createRole.isPending || updateRole.isPending;

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <CollectionPageHeader
        icon={CircleUser}
        title={t(($) => $.roles.title)}
        count={roles.length}
        description={t(($) => $.roles.tagline)}
        actions={
          isAdmin ? (
            <CollectionPageHeaderAction
              icon={Plus}
              label={t(($) => $.roles.new_role)}
              onClick={openCreate}
            />
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          {isLoading ? (
            <p className="text-body text-muted-foreground">
              {t(($) => $.roles.loading)}
            </p>
          ) : roles.length === 0 ? (
            <CollectionPageState
              icon={CircleUser}
              title={t(($) => $.roles.empty_title)}
              description={t(($) => $.roles.empty_description)}
              actions={
                isAdmin ? (
                  <Button type="button" size="sm" onClick={openCreate}>
                    <Plus className="size-3" />
                    {t(($) => $.roles.new_role)}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isAdmin={isAdmin}
                defaultBusy={setDefault.isPending}
                onEdit={() => openEdit(role)}
                onDelete={() => setPendingDelete(role)}
                onToggleDefault={() => toggleDefault(role)}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t(($) => $.roles.edit_title)
                : t(($) => $.roles.create_title)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-body font-medium">
                {t(($) => $.roles.name)}
              </span>
              <Input
                value={draft.name}
                maxLength={120}
                placeholder={t(($) => $.roles.name_placeholder)}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
            {!editing ? (
              <label className="block space-y-1.5">
                <span className="text-body font-medium">
                  {t(($) => $.roles.scope)}
                </span>
                <Select
                  items={[
                    {
                      value: "workspace",
                      label: t(($) => $.roles.scope_workspace),
                    },
                    { value: "global", label: t(($) => $.roles.scope_global) },
                  ]}
                  value={draft.scope}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      scope: value as AgentRoleScope,
                    }))
                  }
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">
                      {t(($) => $.roles.scope_workspace)}
                    </SelectItem>
                    <SelectItem value="global">
                      {t(($) => $.roles.scope_global)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-body font-medium">
                {t(($) => $.roles.description)}
              </span>
              <Textarea
                value={draft.description}
                maxLength={255}
                rows={2}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-body font-medium">
                {t(($) => $.roles.instructions)}
              </span>
              <p className="text-caption text-muted-foreground">
                {t(($) => $.roles.instructions_hint)}
              </p>
              <Textarea
                value={draft.instructions}
                rows={14}
                className="min-h-72 resize-y font-mono text-label leading-6"
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    instructions: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t(($) => $.roles.cancel)}
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t(($) => $.roles.saving) : t(($) => $.roles.save)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(($) => $.roles.delete_title)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(($) => $.roles.delete_description, {
                name: pendingDelete?.name ?? "",
                count: pendingDelete?.agent_count ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(($) => $.roles.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteRole.isPending}
            >
              {t(($) => $.roles.delete_confirm)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleCard({
  role,
  isAdmin,
  defaultBusy,
  onEdit,
  onDelete,
  onToggleDefault,
}: {
  role: AgentRole;
  isAdmin: boolean;
  defaultBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
}) {
  const { t } = useT("agents");
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="truncate text-body font-medium">{role.name}</h2>
          {role.scope === "global" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
              <Globe className="size-3" />
              {t(($) => $.roles.global_badge)}
            </span>
          ) : null}
          {role.is_default ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
              <Star className="size-3" />
              {t(($) => $.roles.default_badge)}
            </span>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onToggleDefault}
              disabled={defaultBusy}
            >
              <Star className="size-3" />
              {role.is_default
                ? t(($) => $.roles.clear_default)
                : t(($) => $.roles.set_default)}
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={onEdit}>
              <Pencil className="size-3" />
              {t(($) => $.roles.edit)}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t(($) => $.roles.delete)}
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ) : null}
      </div>
      {role.description ? (
        <p className="mt-1 text-caption text-muted-foreground">
          {role.description}
        </p>
      ) : null}
      <p
        className={cn(
          "mt-3 whitespace-pre-wrap text-caption leading-5 text-muted-foreground",
          "line-clamp-3",
        )}
      >
        {role.instructions}
      </p>
      <p className="mt-3 text-caption text-muted-foreground">
        {t(($) => $.roles.agent_count, { count: role.agent_count })}
        {role.is_default ? ` · ${t(($) => $.roles.default_hint)}` : ""}
      </p>
    </div>
  );
}
