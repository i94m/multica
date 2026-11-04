"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  agentRoleSkillsOptions,
  useSetAgentRoleSkills,
} from "@multica/core/agents";
import { useWorkspaceId } from "@multica/core/hooks";
import type { AgentRole } from "@multica/core/types";
import { skillListOptions } from "@multica/core/workspace/queries";
import { Button } from "@multica/ui/components/ui/button";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { useT } from "../../i18n";

// Skills a role hands to every agent bound to it. The server treats them as
// mandatory: an agent cannot switch one off, so this dialog is the only place
// to change the set.
export function RoleSkillsDialog({
  role,
  canEdit,
  open,
  onOpenChange,
}: {
  role: AgentRole;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT("agents");
  const wsId = useWorkspaceId();
  const { data: available = [] } = useQuery(skillListOptions(wsId));
  const { data: assigned = [] } = useQuery(
    agentRoleSkillsOptions(wsId, open ? role.id : null),
  );
  const save = useSetAgentRoleSkills(wsId, role.id);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Seed the selection from the server each time the dialog opens, so a
  // cancelled edit never leaks into the next open.
  useEffect(() => {
    if (open) setSelected(new Set(assigned.map((skill) => skill.id)));
  }, [open, assigned]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save.mutateAsync(Array.from(selected));
      toast.success(t(($) => $.roles.skills_saved));
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : t(($) => $.roles.skills_save_failed),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(($) => $.roles.skills_dialog_title)}</DialogTitle>
          <DialogDescription>
            {t(($) => $.roles.skills_dialog_hint)}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto py-1">
          {available.length === 0 ? (
            <p className="px-1 py-2 text-body text-muted-foreground">
              {t(($) => $.roles.skills_dialog_empty)}
            </p>
          ) : (
            available.map((skill) => (
              <label
                key={skill.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent/60"
              >
                <Checkbox
                  checked={selected.has(skill.id)}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    toggle(skill.id, checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-medium">
                      {skill.name}
                    </span>
                    {skill.scope === "global" ? (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
                        {t(($) => $.roles.global_badge)}
                      </span>
                    ) : null}
                  </span>
                  {skill.description ? (
                    <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                      {skill.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t(($) => $.roles.cancel)}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t(($) => $.roles.saving) : t(($) => $.roles.save)}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
