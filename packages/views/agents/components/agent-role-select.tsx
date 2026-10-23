"use client";

import { useQuery } from "@tanstack/react-query";
import { agentRoleListOptions } from "@multica/core/agents";
import { useWorkspaceId } from "@multica/core/hooks";
import { Button } from "@multica/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@multica/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { Info } from "lucide-react";
import { useT } from "../../i18n";

const NO_ROLE = "__no_role__";

/**
 * Selects an optional role. The info button beside it reveals the instructions
 * of the currently selected role.
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
  // Every visible role is selectable, including global roles: choosing one for
  // an agent is a read-only use of the shared prompt. Creating or editing a
  // role definition stays restricted to workspace owner/admin (enforced by the
  // Roles page and the API).
  const selectedRole = roles.find((role) => role.id === value) ?? null;
  const selectedValue = roles.some((role) => role.id === value)
    ? (value as string)
    : NO_ROLE;
  const items = [
    { value: NO_ROLE, label: t(($) => $.role_select.none) },
    ...roles.map((role) => ({
      value: role.id,
      label: role.name,
    })),
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
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
        </div>
        {selectedRole ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t(($) => $.role_select.view_instructions)}
                >
                  <Info className="size-4" />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-80">
              <PopoverHeader>
                <PopoverTitle>{selectedRole.name}</PopoverTitle>
              </PopoverHeader>
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-caption leading-5 text-muted-foreground">
                {selectedRole.instructions.trim() ||
                  t(($) => $.role_select.no_instructions)}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
