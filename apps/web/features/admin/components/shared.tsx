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
