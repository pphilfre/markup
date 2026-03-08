"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, X } from "lucide-react";
import {
  apiBase,
  getClientAuthToken,
  getDesktopToken,
  isTauri,
} from "@/lib/tauri";

type Level = "error" | "warn";

interface Notice {
  id: string;
  level: Level;
  source: string;
  message: string;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function uniqId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DesktopDebugNotice() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const enabled = useMemo(() => isTauri(), []);

  useEffect(() => {
    if (!enabled) return;

    const addNotice = (level: Level, source: string, message: string) => {
      setNotices((prev) => {
        const exists = prev.some((n) => n.source === source && n.message === message);
        if (exists) return prev;
        return [...prev, { id: uniqId(source), level, source, message }];
      });
    };

    (async () => {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        addNotice("error", "Convex", "NEXT_PUBLIC_CONVEX_URL is missing in this build.");
      } else {
        try {
          // We only care about network reachability here. Some Convex endpoints
          // may respond with non-200 statuses depending on deployment config.
          await fetch(convexUrl, {
            method: "GET",
            signal: timeoutSignal(6000),
          });
        } catch {
          addNotice("error", "Convex", "Unable to reach Convex from desktop app.");
        }
      }

      try {
        const auth = await getClientAuthToken();
        const hadDesktopToken = !!getDesktopToken();
        // Don't show a warning for normal logged-out state on launch.
        // Warn only if a previously stored desktop token fails validation.
        if (!auth.accessToken && hadDesktopToken) {
          addNotice("warn", "WorkOS", "Stored desktop session is no longer valid. Please sign in again.");
        }
      } catch {
        addNotice("error", "WorkOS", `Auth check failed for ${apiBase() || "local"} backend.`);
      }
    })();

    const onError = (event: ErrorEvent) => {
      addNotice("error", "Runtime", event.message || "Unhandled script error.");
    };

    const onPromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "Unhandled promise rejection.";
      addNotice("error", "Runtime", message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onPromiseRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onPromiseRejection);
    };
  }, [enabled]);

  if (!enabled || notices.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[60] w-[min(92vw,420px)] space-y-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="rounded-md border border-amber-500/40 bg-amber-950/80 px-3 py-2 text-xs text-amber-100 shadow-lg backdrop-blur"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium">
              {notice.level === "error" ? <Bug className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              <span>{notice.source}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotices((prev) => prev.filter((n) => n.id !== notice.id))}
              className="rounded p-0.5 text-amber-200/80 hover:bg-amber-200/10 hover:text-amber-100"
              aria-label="Dismiss debug notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p>{notice.message}</p>
        </div>
      ))}
    </div>
  );
}
