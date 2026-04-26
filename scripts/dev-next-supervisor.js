const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

const workspaceRoot = path.join(__dirname, "..");
const nextCliPath = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
const nextDevLockPath = path.join(workspaceRoot, ".next", "dev", "lock");
const RESTART_DELAY_MS = 1200;
let child = null;
let stopping = false;

/**
 * Reads and parses JSON from disk.
 *
 * @param {string} filePath
 * @returns {unknown | null}
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Checks whether a process id currently exists.
 *
 * @param {number} pid
 * @returns {boolean}
 */
function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 1) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads cwd and command line information for a Linux process.
 *
 * @param {number} pid
 * @returns {{ cwd: string, cmdline: string } | null}
 */
function getLinuxProcessInfo(pid) {
  try {
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    const cmdlineRaw = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    const cmdline = cmdlineRaw.split("\u0000").filter(Boolean).join(" ");
    return { cwd, cmdline };
  } catch {
    return null;
  }
}

/**
 * Determines whether a pid belongs to this workspace's Next.js dev process.
 *
 * @param {number} pid
 * @returns {boolean}
 */
function isWorkspaceNextDevProcess(pid) {
  if (pid === process.pid || !processExists(pid) || process.platform !== "linux") {
    return false;
  }
  const info = getLinuxProcessInfo(pid);
  if (!info || info.cwd !== workspaceRoot) {
    return false;
  }
  return info.cmdline.includes("node_modules/next/dist/bin/next") && info.cmdline.includes(" dev");
}

/**
 * Sends a signal to a process group, falling back to a direct pid signal.
 *
 * @param {number} pid
 * @param {NodeJS.Signals} [signal="SIGTERM"]
 * @returns {void}
 */
function killProcessTree(pid, signal = "SIGTERM") {
  if (!processExists(pid)) {
    return;
  }
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // Fall back to direct pid when process groups are unavailable.
  }
  try {
    process.kill(pid, signal);
  } catch {
    // no-op
  }
}

/**
 * Removes the Next.js dev lock file if it exists.
 *
 * @returns {void}
 */
function removeLockFile() {
  try {
    fs.unlinkSync(nextDevLockPath);
  } catch {
    // no-op
  }
}

/**
 * Stops stale workspace Next.js dev processes and clears the lock file.
 *
 * @returns {void}
 */
function cleanupPreviousNextDev() {
  const lock = readJson(nextDevLockPath);
  const lockPid = Number.isInteger(lock?.pid) ? lock.pid : null;

  if (lockPid && isWorkspaceNextDevProcess(lockPid)) {
    console.warn(`[dev-next] Stopping previous next dev process (${lockPid})...`);
    killProcessTree(lockPid, "SIGTERM");
  }

  if (process.platform === "linux") {
    let entries = [];
    try {
      entries = fs.readdirSync("/proc", { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) {
        continue;
      }
      const pid = Number(entry.name);
      if (!Number.isInteger(pid) || pid <= 1 || pid === lockPid) {
        continue;
      }
      if (isWorkspaceNextDevProcess(pid)) {
        console.warn(`[dev-next] Stopping orphan next dev process (${pid})...`);
        killProcessTree(pid, "SIGTERM");
      }
    }
  }

  removeLockFile();
}

/**
 * Starts Next.js dev and restarts it when it exits unexpectedly.
 *
 * @returns {void}
 */
function startNext() {
  cleanupPreviousNextDev();

  child = spawn(process.execPath, [nextCliPath, "dev", "--webpack"], {
    stdio: "inherit",
    env: process.env,
    detached: true,
  });

  child.on("exit", (code, signal) => {
    if (stopping) {
      process.exitCode = code ?? (signal ? 1 : 0);
      return;
    }

    const exitedPid = child?.pid;
    if (exitedPid) {
      try {
        process.kill(-exitedPid, "SIGKILL");
      } catch {
        // The process group may already be gone.
      }
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.warn(`[dev-next] Next exited (${reason}); restarting in ${RESTART_DELAY_MS}ms...`);
    setTimeout(() => {
      if (!stopping) {
        startNext();
      }
    }, RESTART_DELAY_MS).unref();
  });
}

/**
 * Stops the currently running Next.js dev child process.
 *
 * @param {NodeJS.Signals} signal
 * @returns {void}
 */
function stopNext(signal) {
  if (stopping) {
    return;
  }
  stopping = true;

  const childPid = child?.pid;
  if (childPid) {
    try {
      process.kill(-childPid, signal);
    } catch {
      process.exitCode = 0;
      return;
    }

    setTimeout(() => {
      if (child?.exitCode === null && child?.signalCode === null) {
        try {
          process.kill(-childPid, "SIGKILL");
        } catch {
          // no-op
        }
      }
    }, 500).unref();
  } else {
    process.exitCode = 0;
  }
}

process.on("SIGINT", () => stopNext("SIGINT"));
process.on("SIGTERM", () => stopNext("SIGTERM"));

startNext();
