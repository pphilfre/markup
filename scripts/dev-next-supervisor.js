#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const nextCliPath = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
const RESTART_DELAY_MS = 1200;
let child = null;
let stopping = false;

function startNext() {
  child = spawn(process.execPath, [nextCliPath, "dev", "--webpack"], {
    stdio: "inherit",
    env: process.env,
    detached: true,
  });

  child.on("exit", (code, signal) => {
    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0));
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

function stopNext(signal) {
  if (stopping) {
    return;
  }
  stopping = true;

  if (child && child.pid) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      process.exit(0);
      return;
    }

    setTimeout(() => {
      if (child && child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // no-op
        }
      }
    }, 500).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => stopNext("SIGINT"));
process.on("SIGTERM", () => stopNext("SIGTERM"));

startNext();
