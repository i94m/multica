"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Building2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Monitor,
  Shield,
  Users,
} from "lucide-react";
import { useAuthStore } from "@multica/core/auth";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { useAdminCopy } from "../i18n";
import { adminPaths } from "../paths";

const navItems = [
  { key: "overview", href: adminPaths.root(), icon: LayoutDashboard },
  { key: "users", href: adminPaths.users(), icon: Users },
  { key: "workspaces", href: adminPaths.workspaces(), icon: Building2 },
  { key: "tasks", href: adminPaths.tasks(), icon: ListChecks },
  { key: "agents", href: adminPaths.agents(), icon: Bot },
  { key: "runtimes", href: adminPaths.runtimes(), icon: Monitor },
  { key: "usage", href: adminPaths.usage(), icon: BarChart3 },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const copy = useAdminCopy();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const signOut = () => {
    useAuthStore.getState().logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-svh overflow-hidden bg-app-shell text-foreground">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-surface-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-surface-border px-4">
          <Shield className="size-4" />
          <span className="font-heading text-body font-semibold">{copy.title}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-body transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {copy.nav[item.key]}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-surface-border p-2">
          <p className="truncate px-3 py-2 text-caption text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={signOut}
          >
            <LogOut className="size-4" />
            {copy.signOut}
          </Button>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-2 border-b border-surface-border bg-surface px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-caption",
                    active ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {copy.nav[item.key]}
                </Link>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/" />}>
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{copy.backToApp}</span>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={signOut} aria-label={copy.signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="min-h-0 w-full flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
