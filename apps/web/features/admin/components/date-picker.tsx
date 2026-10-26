"use client";

import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import {
  dateOnlyToLocalDate,
  formatDateOnly,
  toDateOnly,
} from "@multica/core/issues/date";
import { Button } from "@multica/ui/components/ui/button";
import { Calendar } from "@multica/ui/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@multica/ui/components/ui/popover";
import { useLocale } from "@multica/views/i18n";

/**
 * Calendar-day filter input. Mirrors the shared DateOnlyPicker used by issue
 * and project properties so the admin console uses the same popover/calendar
 * interaction instead of the browser's native date field.
 */
export function AdminDatePicker({
  value,
  onChange,
  label,
  placeholder,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const date = dateOnlyToLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 px-2.5" aria-label={label} />
        }
      >
        <CalendarDays className="size-3.5 text-muted-foreground" />
        {date ? (
          <span>{formatDateOnly(value, { month: "short", day: "numeric" }, locale)}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-body transition-colors hover:bg-accent"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
            {emptyLabel}
          </span>
          <Check
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground ${date ? "invisible" : ""}`}
          />
        </button>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected: Date | undefined) => {
            onChange(selected ? toDateOnly(selected) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
