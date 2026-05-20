"use client";

import type { ReactNode } from "react";
import { AuthLoader } from "@/components/convex-client-provider";

export function PostgresClientProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoader />
      {children}
    </>
  );
}
