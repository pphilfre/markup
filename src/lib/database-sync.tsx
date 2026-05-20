"use client";

import { getDbProvider } from "@/lib/db-provider";
import { ConvexSync } from "@/lib/convex-sync";
import { PostgresSync } from "@/lib/postgres-sync";

export function DatabaseSync() {
  return getDbProvider() === "postgres" ? <PostgresSync /> : <ConvexSync />;
}
