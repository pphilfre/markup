import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Select a build without ever using a production deploy key to deploy from a PR. */
export function vercelBuildPlan(env) {
  if (env.NEXT_PUBLIC_DB_PROVIDER?.trim().toLowerCase() === "postgres") {
    return {
      script: "build",
      env: {},
      message: "Building the PostgreSQL frontend.",
    };
  }

  const key = env.CONVEX_DEPLOY_KEY?.trim() ?? "";
  if (env.VERCEL_ENV === "production") {
    if (!key.startsWith("prod:")) {
      throw new Error(
        "Set a production CONVEX_DEPLOY_KEY for Vercel's Production environment.",
      );
    }
    return {
      script: "build:convex",
      env: {},
      message: "Building and deploying the production Convex app.",
    };
  }
  if (env.VERCEL_ENV === "preview" && key.startsWith("preview:")) {
    return {
      script: "build:convex",
      env: {},
      message: "Building with an isolated Convex preview deployment.",
    };
  }

  // The public hostname is in the production key's header, before its secret.
  const deployment = key
    .split("|", 1)[0]
    .match(/^prod:([a-z0-9]+(?:-[a-z0-9]+)+)$/)?.[1];
  const url =
    env.NEXT_PUBLIC_CONVEX_URL?.trim() ||
    (deployment ? `https://${deployment}.convex.cloud` : "");
  if (!url) {
    throw new Error(
      "Set NEXT_PUBLIC_CONVEX_URL to build against an existing backend, or set a Preview Deploy Key as CONVEX_DEPLOY_KEY for isolated previews.",
    );
  }
  return {
    script: "build",
    env: { NEXT_PUBLIC_CONVEX_URL: url },
    message:
      "Building the frontend against the existing Convex backend; no backend deployment will run. Use a Preview Deploy Key to preview backend changes too.",
  };
}

/** Run the chosen npm script and propagate its failure to Vercel. */
export function runVercelBuild(env = process.env, run = spawnSync) {
  const plan = vercelBuildPlan(env);
  if (!env.npm_execpath)
    throw new Error("Run this entry point with npm run build:vercel.");
  console.log(plan.message);
  const result = run(process.execPath, [env.npm_execpath, "run", plan.script], {
    stdio: "inherit",
    env: { ...env, ...plan.env },
  });
  if (result.error)
    throw new Error(`Could not start ${plan.script}: ${result.error.message}`);
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = runVercelBuild();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Vercel build failed.",
    );
    process.exitCode = 1;
  }
}
