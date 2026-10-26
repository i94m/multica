"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multica/ui/components/ui/card";
import { Input } from "@multica/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { TableHead } from "@multica/ui/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-heading text-title-lg font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card size="sm">
      <CardContent className="px-3">
        <p className="text-body text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-title-sm font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-body text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorState({
  label,
  retryLabel = "Retry",
  onRetry,
}: {
  label: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-body text-muted-foreground">
      <span>{label}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center text-body text-muted-foreground">
      {label}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "user_cancelled" ||
    normalized === "offline"
      ? "destructive"
      : normalized === "running" ||
          normalized === "completed" ||
          normalized === "online" ||
          normalized === "active"
        ? "default"
        : "outline";
  return <Badge variant={variant}>{status || "—"}</Badge>;
}

export function DetailGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(8rem,14rem)_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-body text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-body">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EntityLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
}) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-64"
      />
      <Button type="submit" variant="outline" size="sm">
        {label}
      </Button>
    </form>
  );
}

export function LoadMoreButton({
  hasNext,
  loading,
  label,
  onClick,
}: {
  hasNext: boolean;
  loading: boolean;
  label: string;
  onClick: () => void;
}) {
  if (!hasNext) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" size="sm" disabled={loading} onClick={onClick}>
        {loading ? "…" : label}
      </Button>
    </div>
  );
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCost(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "—";
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export type SortOrder = "asc" | "desc";

export function SortableHead({
  label,
  column,
  sort,
  order,
  onSort,
  className,
}: {
  label: string;
  column: string;
  sort: string;
  order: SortOrder;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sort === column;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left hover:text-foreground"
        onClick={() => onSort(column)}
        aria-label={`${label}: ${active ? order : "unsorted"}`}
      >
        {label}
        <Icon className={active ? "size-3.5" : "size-3.5 opacity-40"} />
      </button>
    </TableHead>
  );
}

export function FilterSelect({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  label: string;
  className?: string;
}) {
  const allValue = "__all__";
  const normalized = items.map((item) => ({
    ...item,
    value: item.value || allValue,
  }));

  return (
    <Select
      items={normalized}
      value={value || allValue}
      onValueChange={(next) => onChange(!next || next === allValue ? "" : next)}
    >
      <SelectTrigger className={className ?? "w-44"} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {normalized.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function pageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = Array.from(wanted)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const page of pages) {
    if (previous && page - previous > 1) out.push("ellipsis");
    out.push(page);
    previous = page;
  }
  return out;
}

export function AdminPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  labels,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  labels: {
    results: string;
    pageSize: string;
    previous: string;
    next: string;
  };
}) {
  const pages = pageNumbers(page, totalPages);
  const sizeItems = [10, 25, 50, 100].map((size) => ({
    value: String(size),
    label: `${size} / ${labels.pageSize}`,
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border bg-surface px-3 py-3">
      <p className="text-caption text-muted-foreground">{labels.results}</p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={labels.previous}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-caption text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "default" : "outline"}
              size="sm"
              className="min-w-8"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={labels.next}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="w-40">
        <FilterSelect
          value={String(pageSize)}
          onChange={(value) => onPageSizeChange(Number(value))}
          items={sizeItems}
          label={labels.pageSize}
          className="w-40"
        />
      </div>
    </div>
  );
}
