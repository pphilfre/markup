const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const build = import("../scripts/vercel-build.mjs");
const productionKey = "prod:example-chipmunk-123|synthetic-secret";

test("the Vercel entry point overrides the dashboard wrapper and builds cannot recurse", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.equal(vercel.buildCommand, "npm run build:vercel");
  assert.equal(pkg.scripts.build, "prisma generate && next build");
  assert.equal(
    pkg.scripts["build:convex"],
    'convex deploy --cmd "npm run build"',
  );
});

test("a PR with a production key builds only the frontend and derives its public URL", async () => {
  const { vercelBuildPlan } = await build;
  const plan = vercelBuildPlan({
    VERCEL_ENV: "preview",
    CONVEX_DEPLOY_KEY: productionKey,
  });
  assert.equal(plan.script, "build");
  assert.equal(
    plan.env.NEXT_PUBLIC_CONVEX_URL,
    "https://example-chipmunk-123.convex.cloud",
  );
  assert.equal(JSON.stringify(plan).includes("synthetic-secret"), false);
});

test("existing and custom backend URLs take precedence over a production key's hostname", async () => {
  const { vercelBuildPlan } = await build;
  const plan = vercelBuildPlan({
    VERCEL_ENV: "preview",
    CONVEX_DEPLOY_KEY: productionKey,
    NEXT_PUBLIC_CONVEX_URL: "https://backend.example.com",
  });
  assert.equal(plan.env.NEXT_PUBLIC_CONVEX_URL, "https://backend.example.com");
});

test("a Preview Deploy Key creates an isolated backend without nesting deploy commands", async () => {
  const { vercelBuildPlan } = await build;
  assert.equal(
    vercelBuildPlan({
      VERCEL_ENV: "preview",
      CONVEX_DEPLOY_KEY: "preview:team:project|synthetic-secret",
    }).script,
    "build:convex",
  );
});

test("only Production builds with a production key deploy to production", async () => {
  const { vercelBuildPlan } = await build;
  assert.equal(
    vercelBuildPlan({
      VERCEL_ENV: "production",
      CONVEX_DEPLOY_KEY: productionKey,
    }).script,
    "build:convex",
  );
  assert.throws(
    () =>
      vercelBuildPlan({
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "preview:team:project|synthetic-secret",
      }),
    /production CONVEX_DEPLOY_KEY/,
  );
});

test("PostgreSQL builds do not need Convex keys, while unconfigured Convex previews fail clearly", async () => {
  const { vercelBuildPlan } = await build;
  assert.equal(
    vercelBuildPlan({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_DB_PROVIDER: "postgres",
    }).script,
    "build",
  );
  assert.throws(
    () => vercelBuildPlan({ VERCEL_ENV: "preview" }),
    /NEXT_PUBLIC_CONVEX_URL/,
  );
});

test("the runner passes the public URL to the build and propagates failures and signals", async () => {
  const { runVercelBuild } = await build;
  const env = {
    VERCEL_ENV: "preview",
    CONVEX_DEPLOY_KEY: productionKey,
    npm_execpath: "/test/npm-cli.js",
  };
  let called = false;
  assert.equal(
    runVercelBuild(env, (command, args, options) => {
      called = true;
      assert.equal(command, process.execPath);
      assert.deepEqual(args, ["/test/npm-cli.js", "run", "build"]);
      assert.equal(
        options.env.NEXT_PUBLIC_CONVEX_URL,
        "https://example-chipmunk-123.convex.cloud",
      );
      return { status: 7 };
    }),
    7,
  );
  assert.equal(called, true);
  assert.equal(
    runVercelBuild(env, () => ({ status: null, signal: "SIGTERM" })),
    1,
  );
});
