import packageJson from "../../package.json";
import { isDocker } from "./tauri";

export interface DockerUpdateInfo {
  version: string;
  body?: string;
}

export type DockerUpdateStatus = "idle" | "checking" | "available" | "up-to-date" | "error";

interface DockerUpdateState {
  status: DockerUpdateStatus;
  info: DockerUpdateInfo | null;
  error: string | null;
}

const DEFAULT_DOCKER_UPDATE_URL =
  "https://raw.githubusercontent.com/pphilfre/markup/main/version.json";
const DEFAULT_DOCKER_UPDATE_DOCS_URL =
  "https://github.com/pphilfre/markup#docker-updates";
const IGNORE_VERSION_KEY = "markup-docker-update-ignore-v1";

let _state: DockerUpdateState = {
  status: "idle",
  info: null,
  error: null,
};

const _listeners = new Set<() => void>();

function setState(next: Partial<DockerUpdateState>) {
  _state = { ..._state, ...next };
  _listeners.forEach((fn) => fn());
}

function normalizeVersion(input: unknown): string {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

function parseVersionParts(value: string): number[] {
  return normalizeVersion(value)
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareSemver(a: string, b: string): number {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const max = Math.max(left.length, right.length);

  for (let i = 0; i < max; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function readIgnoredVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(IGNORE_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeIgnoredVersion(version: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (version) {
      window.localStorage.setItem(IGNORE_VERSION_KEY, version);
    } else {
      window.localStorage.removeItem(IGNORE_VERSION_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
}

export function getDockerUpdateDocsUrl(): string {
  return process.env.NEXT_PUBLIC_DOCKER_UPDATE_DOCS_URL || DEFAULT_DOCKER_UPDATE_DOCS_URL;
}

export function getDockerUpdateState(): DockerUpdateState {
  return _state;
}

export function subscribeToDockerUpdateState(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function ignoreDockerUpdate(version: string | null): void {
  if (version) {
    writeIgnoredVersion(version);
  }
  setState({ status: "up-to-date", info: null, error: null });
}

export async function checkForDockerUpdate(): Promise<void> {
  if (!isDocker()) return;
  if (_state.status === "checking") return;

  setState({ status: "checking", error: null });

  try {
    const updateUrl = process.env.NEXT_PUBLIC_DOCKER_UPDATE_URL || DEFAULT_DOCKER_UPDATE_URL;
    const res = await fetch(updateUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Update check failed (${res.status})`);
    }

    const data = (await res.json()) as { version?: string; body?: string };
    const latestVersion = normalizeVersion(data.version);
    if (!latestVersion) {
      throw new Error("Update check failed (missing version)");
    }

    const currentVersion = normalizeVersion(packageJson.version);
    const ignoredVersion = readIgnoredVersion();

    if (ignoredVersion && compareSemver(latestVersion, ignoredVersion) <= 0) {
      setState({ status: "up-to-date", info: null, error: null });
      return;
    }

    if (compareSemver(latestVersion, currentVersion) <= 0) {
      setState({ status: "up-to-date", info: null, error: null });
      return;
    }

    setState({
      status: "available",
      info: {
        version: latestVersion,
        body: data.body,
      },
    });
  } catch (err) {
    console.error("[Docker Updater] Check failed:", err);
    setState({ status: "error", error: String(err) });
  }
}

export async function checkDockerOnStartup(): Promise<void> {
  if (!isDocker()) return;

  await new Promise((r) => setTimeout(r, 3000));
  await checkForDockerUpdate();
}
