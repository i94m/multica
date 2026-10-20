"use client";

import { useQuery } from "@tanstack/react-query";
import { agentRoleListOptions } from "@multica/core/agents";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { useT } from "../../i18n";

const NO_ROLE = "__no_role__";

/**
 * Selects an optional explicit role. An empty selection still inherits the
 * workspace default, so the "none" label is intentionally "no explicit role"
 * rather than "no role".
 */
export function AgentRoleSelect({
  value,
  onChange,
  disabled = false,
  id,
}: {
  value: string | null | undefined;
  onChange: (roleId: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const wsId = useWorkspaceId();
  const { t } = useT("agents");
  const { data: roles = [], isLoading } = useQuery(agentRoleListOptions(wsId));
  const defaultRole = roles.find((role) => role.is_default);
  // Global roles are workspace-wide defaults, not per-agent choices. They stay
  // visible on the Roles page and as the inherited default, but the agent
  // picker only offers roles owned by this workspace.
  const selectableRoles = roles.filter((role) => role.scope !== "global");
  const selectedValue = selectableRoles.some((role) => role.id === value)
    ? (value as string)
    : NO_ROLE;
  const items = [
    { value: NO_ROLE, label: t(($) => $.role_select.none) },
    ...selectableRoles.map((role) => ({
      value: role.id,
      label: role.is_default
        ? `${role.name}${t(($) => $.role_select.default_suffix)}`
        : role.name,
    })),
  ];

  return (
    <div className="space-y-1.5">
      <Select
        items={items}
        value={selectedValue}
        onValueChange={(next) =>
          onChange(next === NO_ROLE ? null : (next as string))
        }
        disabled={disabled || isLoading}
      >
        <SelectTrigger id={id} className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {defaultRole ? (
        <p className="text-caption text-muted-foreground">
          {t(($) => $.role_select.default_hint, { name: defaultRole.name })}
        </p>
      ) : null}
    </div>
  );
}
