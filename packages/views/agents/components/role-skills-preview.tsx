"use client";

import { useQuery } from "@tanstack/react-query";
import { agentRoleSkillsOptions } from "@multica/core/agents";
import { useWorkspaceId } from "@multica/core/hooks";
import { Badge } from "@multica/ui/components/ui/badge";
import { useT } from "../../i18n";

/**
 * The skills a role grants, as read-only chips.
 *
 * The set is maintained with the role in the platform console; every agent
 * bound to the role inherits it and cannot switch one off. Shared by the
 * create flow, the inline instructions editor and the settings form so the
 * three surfaces cannot drift.
 */
export function RoleSkillsPreview({ roleId }: { roleId: string }) {
  const { t } = useT("agents");
  const wsId = useWorkspaceId();
  const { data: skills = [] } = useQuery(agentRoleSkillsOptions(wsId, roleId));

  return (
    <div className="space-y-1.5">
      <span className="text-caption font-medium text-muted-foreground">
        {t(($) => $.role_select.skills_label)}
      </span>
      {skills.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          {t(($) => $.role_select.skills_empty)}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <Badge key={skill.id} variant="outline" className="max-w-full">
              <span className="truncate">{skill.name}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
