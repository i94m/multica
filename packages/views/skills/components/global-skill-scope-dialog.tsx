"use client";

import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SkillSummary } from "@multica/core/types";
import { useSetSkillScope } from "@multica/core/skills/mutations";
import { Button } from "@multica/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { useT } from "../../i18n";

/**
 * Confirms promoting a workspace skill to the global namespace, or moving a
 * global skill back into the current workspace.
 */
export function GlobalSkillScopeDialog({
  skill,
  wsId,
  open,
  onOpenChange,
}: {
  skill: SkillSummary;
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT("skills");
  const setScope = useSetSkillScope(wsId);
  const toGlobal = skill.scope !== "global";

  const handleConfirm = async () => {
    try {
      await setScope.mutateAsync({
        skillId: skill.id,
        scope: toGlobal ? "global" : "workspace",
      });
      toast.success(
        toGlobal
          ? t(($) => $.actions.globalized_toast)
          : t(($) => $.actions.moved_to_workspace_toast),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t(($) => $.actions.scope_failed_toast),
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!setScope.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {toGlobal
              ? t(($) => $.actions.global_dialog_title)
              : t(($) => $.actions.move_dialog_title)}
          </DialogTitle>
          <DialogDescription>
            {toGlobal
              ? t(($) => $.actions.global_dialog_description, {
                  name: skill.name,
                })
              : t(($) => $.actions.move_dialog_description, {
                  name: skill.name,
                })}
          </DialogDescription>
        </DialogHeader>
        {toGlobal && (
          <div className="rounded-md bg-warning/10 px-3 py-2 text-caption text-muted-foreground">
            {t(($) => $.actions.global_dialog_warning)}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={setScope.isPending}
          >
            {t(($) => $.actions.cancel)}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={setScope.isPending}
          >
            {setScope.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t(($) => $.actions.saving_scope)}
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                {toGlobal
                  ? t(($) => $.actions.global_dialog_confirm)
                  : t(($) => $.actions.move_dialog_confirm)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
