"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@multica/views/i18n";
import { Button } from "@multica/ui/components/ui/button";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { Input } from "@multica/ui/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multica/ui/components/ui/table";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { useAdminCopy } from "../i18n";
import { PageHeader, EmptyState, ErrorState, LoadingState, formatDateTime, formatNumber } from "../components/shared";
import { rolesApi, type AdminRole } from "../roles";

// Roles are platform-level: a role carries a prompt and, optionally, global
// skills that every agent bound to it inherits. Managed here and nowhere else.
export default function RolesPage() {
  const copy = useAdminCopy();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: rolesApi.list });
  const pool = useQuery({ queryKey: ["admin", "role-skills-pool"], queryFn: rolesApi.skillPool });

  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", instructions: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skillDialogRole, setSkillDialogRole] = useState<AdminRole | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminRole | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
  };

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ name: "", description: "", instructions: "" });
    setSelected(new Set());
    // A new role starts with no skills; the role is created first, then the
    // skill set is written against its id.
  };

  const openEdit = (role: AdminRole) => {
    setCreating(false);
    setEditing(role);
    setForm({ name: role.name, description: role.description, instructions: role.instructions });
  };

  const save = useMutation({
    mutationFn: async () => {
      const data = {
        name: form.name.trim(),
        description: form.description,
        instructions: form.instructions,
      };
      if (editing) return rolesApi.update(editing.id, data);
      return rolesApi.create(data);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setCreating(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
  });

  const saveSkills = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      rolesApi.setSkills(id, ids),
    onSuccess: () => {
      invalidate();
      setSkillDialogRole(null);
    },
  });

  const roleSkills = useQuery({
    queryKey: ["admin", "role-skills", skillDialogRole?.id],
    queryFn: () => rolesApi.skills(skillDialogRole?.id ?? ""),
    enabled: !!skillDialogRole,
  });

  const openSkills = async (role: AdminRole) => {
    const current = await queryClient.fetchQuery({
      queryKey: ["admin", "role-skills", role.id],
      queryFn: () => rolesApi.skills(role.id),
    });
    setSelected(new Set(current.skills.map((s) => s.id)));
    setSkillDialogRole(role);
  };

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const dialogOpen = creating || !!editing;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.roles.title}
        description={copy.roles.description}
        actions={
          <Button size="sm" onClick={openCreate}>
            {copy.roles.newRole}
          </Button>
        }
      />

      {roles.isLoading ? (
        <LoadingState label={copy.common.loading} />
      ) : roles.isError ? (
        <ErrorState label={copy.common.error} onRetry={() => roles.refetch()} />
      ) : (roles.data?.roles.length ?? 0) === 0 ? (
        <EmptyState label={copy.roles.empty} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.common.name}</TableHead>
                <TableHead>{copy.common.created}</TableHead>
                <TableHead>{copy.roles.skillCount}</TableHead>
                <TableHead>{copy.roles.agentCount}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.data?.roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="font-medium">{role.name}</div>
                    {role.description ? (
                      <div className="text-caption text-muted-foreground">{role.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(role.updated_at, locale)}
                  </TableCell>
                  <TableCell>{formatNumber(role.skill_count, locale)}</TableCell>
                  <TableCell>{formatNumber(role.agent_count, locale)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                        {copy.common.edit}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void openSkills(role)}>
                        {copy.roles.skills}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(role)}
                      >
                        {copy.common.delete}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreating(false);
          setEditing(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? copy.roles.editRole : copy.roles.newRole}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={form.name}
              placeholder={copy.roles.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              value={form.description}
              placeholder={copy.roles.shortDescription}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Textarea
              value={form.instructions}
              placeholder={copy.roles.instructions}
              rows={10}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setEditing(null); }}>
              {copy.common.cancel}
            </Button>
            <Button size="sm" disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate()}>
              {save.isPending ? copy.common.saving : copy.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!skillDialogRole} onOpenChange={(open) => { if (!open) setSkillDialogRole(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.roles.skillsFor.replace("{name}", skillDialogRole?.name ?? "")}</DialogTitle>
          </DialogHeader>
          <p className="text-caption text-muted-foreground">{copy.roles.skillsHint}</p>
          <div className="max-h-80 space-y-1 overflow-y-auto py-1">
            {(pool.data?.skills.length ?? 0) === 0 ? (
              <p className="px-1 py-2 text-body text-muted-foreground">{copy.roles.noSkills}</p>
            ) : (
              pool.data?.skills.map((skill) => (
                <label key={skill.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent/60">
                  <Checkbox
                    checked={selected.has(skill.id)}
                    onCheckedChange={(checked) => toggle(skill.id, checked === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{skill.name}</span>
                    {skill.description ? (
                      <span className="block truncate text-caption text-muted-foreground">{skill.description}</span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSkillDialogRole(null)}>
              {copy.common.cancel}
            </Button>
            <Button
              size="sm"
              disabled={saveSkills.isPending}
              onClick={() =>
                skillDialogRole && saveSkills.mutate({ id: skillDialogRole.id, ids: Array.from(selected) })
              }
            >
              {saveSkills.isPending ? copy.common.saving : copy.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.roles.deleteTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-body text-muted-foreground">
            {copy.roles.deleteBody.replace("{name}", pendingDelete?.name ?? "")}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              {copy.common.cancel}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {copy.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
