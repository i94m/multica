"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { ErrorState } from "@/features/admin/components/shared";
import { adminMeOptions } from "@/features/admin/queries";
import { AdminApiError } from "@/features/admin/api";
import { useAdminCopy } from "@/features/admin/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const copy = useAdminCopy();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const me = useQuery(adminMeOptions());

  const forbidden =
    me.error instanceof AdminApiError &&
    (me.error.status === 403 || me.error.status === 404);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?next=/admin");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (forbidden) router.replace("/");
  }, [forbidden, router]);

  if (isLoading || me.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-body text-muted-foreground">
        {copy.common.loading}
      </div>
    );
  }

  if (!user || forbidden) {
    return (
      <div className="flex min-h-svh items-center justify-center text-body text-muted-foreground">
        {copy.common.loading}
      </div>
    );
  }

  if (me.isError || !me.data?.is_admin) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <ErrorState
          label={copy.common.error}
          retryLabel={copy.common.retry}
          onRetry={() => {
            void me.refetch();
          }}
        />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
