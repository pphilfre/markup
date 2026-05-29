export type DbProvider = "convex" | "postgres";

const DEFAULT_PROVIDER: DbProvider = "convex";
const PROVIDER_ENV_KEY = "NEXT_PUBLIC_DB_PROVIDER";

function normalizeDbProvider(value?: string | null): DbProvider {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "postgres") return "postgres";
  if (normalized === "convex" || !normalized) return DEFAULT_PROVIDER;

  console.warn(
    `[DB] ${PROVIDER_ENV_KEY}=${value ?? ""} is not recognized. Falling back to ${DEFAULT_PROVIDER}.`
  );
  return DEFAULT_PROVIDER;
}

export function getDbProvider(): DbProvider {
  return normalizeDbProvider(process.env.NEXT_PUBLIC_DB_PROVIDER);
}

export function isConvexProvider(provider: DbProvider = getDbProvider()): boolean {
  return provider === "convex";
}

export function isPostgresProvider(provider: DbProvider = getDbProvider()): boolean {
  return provider === "postgres";
}

export type DbEnvRuntime = "client" | "server";

export type DbEnvCheckResult = {
  provider: DbProvider;
  runtime: DbEnvRuntime;
  missing: string[];
  ok: boolean;
};

export function checkDbProviderEnv(options: {
  provider?: DbProvider;
  runtime?: DbEnvRuntime;
} = {}): DbEnvCheckResult {
  const provider = options.provider ?? getDbProvider();
  const runtime = options.runtime ?? "client";
  const missing: string[] = [];

  if (provider === "convex") {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      missing.push("NEXT_PUBLIC_CONVEX_URL");
    }
  } else if (runtime === "server") {
    if (!process.env.DATABASE_URL) {
      missing.push("DATABASE_URL");
    }
  }

  return {
    provider,
    runtime,
    missing,
    ok: missing.length === 0,
  };
}

export function assertDbProviderEnv(options: {
  provider?: DbProvider;
  runtime?: DbEnvRuntime;
} = {}): DbEnvCheckResult {
  const result = checkDbProviderEnv(options);
  if (!result.ok) {
    throw new Error(
      `[DB] Missing required env for ${result.provider}: ${result.missing.join(", ")}`
    );
  }
  return result;
}
