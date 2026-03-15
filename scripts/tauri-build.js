/**
 * Cross-platform build script for the Tauri static export.
 *
 * Temporarily removes server-only files (API routes, middleware, server actions)
 * so Next.js can do a static export, then restores them afterwards.
 */
async function main() {
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");

  const ROOT = path.resolve(__dirname, "..");
  const BACKUP_DIR = path.join(ROOT, ".tauri-backup");

  const SERVER_ONLY = [
    path.join(ROOT, "src", "app", "api"),
    path.join(ROOT, "src", "app", "callback"),
    path.join(ROOT, "src", "app", "sites"),
    path.join(ROOT, "src", "middleware.ts"),
    path.join(ROOT, "src", "lib", "auth-actions.ts"),
  ];

  function backupFiles() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    for (const item of SERVER_ONLY) {
      if (fs.existsSync(item)) {
        const dest = path.join(BACKUP_DIR, path.basename(item));
        fs.renameSync(item, dest);
      }
    }
  }

  function restoreFiles() {
    for (const item of SERVER_ONLY) {
      const src = path.join(BACKUP_DIR, path.basename(item));
      if (fs.existsSync(src)) {
        if (fs.existsSync(item)) {
          fs.rmSync(item, { recursive: true, force: true });
        }
        fs.renameSync(src, item);
      }
    }
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }

  try {
    backupFiles();
    execSync("npx next build", {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, TAURI_ENV_PLATFORM: process.env.TAURI_ENV_PLATFORM || "true" },
    });
    console.log("✓ Static export complete → out/");
  } finally {
    restoreFiles();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
