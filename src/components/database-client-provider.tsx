"use client";

import type { ReactNode } from "react";
import { getDbProvider } from "@/lib/db-provider";
import { DbHooksProvider } from "@/lib/db-hooks";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { PostgresClientProvider } from "@/components/postgres-client-provider";

export function DatabaseClientProvider({ children }: { children: ReactNode }) {
  const provider = getDbProvider();

  if (provider === "postgres") {
    return (
      <PostgresClientProvider>
        <DbHooksProvider provider={provider}>{children}</DbHooksProvider>
      </PostgresClientProvider>
    );
  }

  return (
    <ConvexClientProvider>
      <DbHooksProvider provider={provider}>{children}</DbHooksProvider>
    </ConvexClientProvider>
  );
}
