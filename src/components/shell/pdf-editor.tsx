"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { useConvex, useMutation } from "convex/react";
import { CloudUpload, FileDown, HardDrive, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/components/convex-client-provider";
import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { IAnnotationStore, PdfAnnotatorProps } from "pdfjs-annotation-extension-for-react";
import "pdfjs-annotation-extension-for-react/style";

const PDF_WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const PdfAnnotator = dynamic<PdfAnnotatorProps>(
  async () => (await import("pdfjs-annotation-extension-for-react")).PdfAnnotator,
  { ssr: false }
);

interface PdfTabData {
  version: number;
  fileName: string | null;
  source: "local" | "convex";
  dataBase64: string | null;
  storageId: string | null;
  annotations: IAnnotationStore[];
}

interface PdfActionsProps {
  save: () => void;
  exportToExcel: (fileName?: string) => void;
  exportToPdf: (fileName?: string) => void;
  getAnnotations: () => IAnnotationStore[];
}

const EMPTY_PDF_DATA: PdfTabData = {
  version: 1,
  fileName: null,
  source: "local",
  dataBase64: null,
  storageId: null,
  annotations: [],
};

function parsePdfTabData(content: string): PdfTabData {
  try {
    const parsed = JSON.parse(content) as Partial<PdfTabData>;
    if (!parsed || typeof parsed !== "object") return EMPTY_PDF_DATA;
    return {
      version: 1,
      fileName: typeof parsed.fileName === "string" ? parsed.fileName : null,
      source: parsed.source === "convex" ? "convex" : "local",
      dataBase64: typeof parsed.dataBase64 === "string" ? parsed.dataBase64 : null,
      storageId: typeof parsed.storageId === "string" ? parsed.storageId : null,
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
    };
  } catch {
    return EMPTY_PDF_DATA;
  }
}

function normalizePdfTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function fileNameWithoutExt(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function PdfEditorView() {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateContent = useEditorStore((s) => s.updateContent);
  const updateTitle = useEditorStore((s) => s.updateTitle);
  const closeTab = useEditorStore((s) => s.closeTab);

  const { isAuthenticated, user } = useAuthState();
  const userId = user?.id ?? null;
  const convex = useConvex();

  const generateUploadUrl = useMutation(api.pdfFiles.generateUploadUrl);
  const upsertPdfFile = useMutation(api.pdfFiles.upsert);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [remotePdfData, setRemotePdfData] = useState<number[] | null>(null);
  const [isLoadingRemotePdf, setIsLoadingRemotePdf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tabData = useMemo(() => parsePdfTabData(activeTab?.content ?? ""), [activeTab?.content]);

  useEffect(() => {
    let cancelled = false;

    const setupPdfWorker = async () => {
      try {
        await import("pdfjs-annotation-extension-for-react");
        const pdfjsLib = (
          globalThis as typeof globalThis & {
            pdfjsLib?: {
              GlobalWorkerOptions?: { workerSrc?: string };
            };
          }
        ).pdfjsLib;

        if (pdfjsLib?.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        }
      } finally {
        if (!cancelled) {
          setPdfWorkerReady(true);
        }
      }
    };

    void setupPdfWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  const writeTabData = useCallback(
    (next: PdfTabData) => {
      if (!activeTabId) return;
      updateContent(activeTabId, JSON.stringify(next));
    },
    [activeTabId, updateContent]
  );

  const setTabOrigin = useCallback((origin: "local" | "online") => {
    if (!activeTabId) return;
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, origin } : t)),
    }));
  }, [activeTabId]);

  useEffect(() => {
    if (!activeTabId || !userId) return;
    if (tabData.source === "convex") return;
    if (tabData.dataBase64) return;

    let cancelled = false;

    const detectRemotePdf = async () => {
      try {
        const remoteFileUrl = await convex.query(api.pdfFiles.getFileUrl, { userId, tabId: activeTabId });
        if (!remoteFileUrl || cancelled) return;

        writeTabData({
          ...tabData,
          source: "convex",
        });
        setTabOrigin("online");
      } catch {
        // Keep local state if remote lookup fails.
      }
    };

    void detectRemotePdf();

    return () => {
      cancelled = true;
    };
  }, [activeTabId, convex, setTabOrigin, tabData, userId, writeTabData]);

  useEffect(() => {
    if (!activeTabId || !userId || tabData.source !== "convex" || tabData.dataBase64) {
      setIsLoadingRemotePdf(false);
      setRemotePdfData(null);
      return;
    }

    let cancelled = false;

    const loadRemotePdf = async () => {
      setIsLoadingRemotePdf(true);
      setRemotePdfData(null);

      try {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const remoteFileUrl = await convex.query(api.pdfFiles.getFileUrl, { userId, tabId: activeTabId });
            if (!remoteFileUrl) {
              throw new Error("No online PDF found for this tab.");
            }

            const response = await fetch(remoteFileUrl, { cache: "no-store" });
            if (!response.ok) {
              throw new Error(`Failed to download online PDF (${response.status}).`);
            }

            const buffer = await response.arrayBuffer();
            if (buffer.byteLength <= 0) {
              throw new Error("Online PDF is empty (0 bytes). Please re-upload the file.");
            }

            if (cancelled) return;
            setRemotePdfData(Array.from(new Uint8Array(buffer)));
            setStatus("");
            return;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error("Failed to load online PDF.");
          }
        }

        throw lastError ?? new Error("Failed to load online PDF.");
      } catch (err) {
        if (cancelled) return;
        setRemotePdfData(null);
        const message = err instanceof Error ? err.message : "Failed to load online PDF.";
        setStatus(message);
      } finally {
        if (!cancelled) {
          setIsLoadingRemotePdf(false);
        }
      }
    };

    void loadRemotePdf();

    return () => {
      cancelled = true;
    };
  }, [activeTabId, convex, tabData.dataBase64, tabData.source, userId]);

  const uploadFileToConvex = useCallback(
    async (file: File): Promise<string> => {
      if (!userId || !activeTabId) throw new Error("You need to be signed in to save online.");
      if (file.size <= 0) throw new Error("Cannot upload an empty PDF file.");

      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/pdf",
        },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Upload failed.");
      }

      const body = (await uploadResult.json()) as { storageId?: string };
      if (!body.storageId) {
        throw new Error("Upload did not return a storageId.");
      }

      await upsertPdfFile({
        userId,
        tabId: activeTabId,
        storageId: body.storageId as Id<"_storage">,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        size: file.size,
      });

      return body.storageId;
    },
    [activeTabId, generateUploadUrl, upsertPdfFile, userId]
  );

  const importPdfFile = useCallback(
    async (file: File) => {
      if (!activeTabId) return;
      setBusy(true);
      setStatus("");

      try {
        const fileName = normalizePdfTitle(file.name);
        updateTitle(activeTabId, fileName);

        if (isAuthenticated && userId) {
          const storageId = await uploadFileToConvex(file);
          writeTabData({
            version: 1,
            fileName,
            source: "convex",
            storageId,
            dataBase64: null,
            annotations: [],
          });
          setTabOrigin("online");
          setStatus("Saved to Convex.");
          return;
        }

        const base64 = toBase64(await file.arrayBuffer());
        writeTabData({
          version: 1,
          fileName,
          source: "local",
          storageId: null,
          dataBase64: base64,
          annotations: [],
        });
        setTabOrigin("local");
        setStatus("Saved locally.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to import PDF.";
        setStatus(message);
      } finally {
        setBusy(false);
      }
    },
    [activeTabId, isAuthenticated, setTabOrigin, updateTitle, uploadFileToConvex, userId, writeTabData]
  );

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      await importPdfFile(file);
    },
    [importPdfFile]
  );

  const saveOnline = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setStatus("Sign in to save online.");
      return;
    }
    if (!activeTabId) return;

    if (tabData.source === "convex") {
      setStatus("Already saved online.");
      return;
    }
    if (!tabData.dataBase64) {
      setStatus("Import a PDF first.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const bytes = fromBase64(tabData.dataBase64);
      const fileName = normalizePdfTitle(tabData.fileName ?? activeTab?.title ?? "Document.pdf");
      const file = new File([toArrayBuffer(bytes)], fileName, { type: "application/pdf" });
      const storageId = await uploadFileToConvex(file);

      writeTabData({
        ...tabData,
        source: "convex",
        storageId,
        dataBase64: null,
        fileName,
      });
      setTabOrigin("online");
      setStatus("Saved online.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save online.";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }, [activeTab?.title, activeTabId, isAuthenticated, setTabOrigin, tabData, uploadFileToConvex, userId, writeTabData]);

  const saveLocal = useCallback(async () => {
    if (!activeTabId) return;

    if (!tabData.dataBase64 && (!remotePdfData || remotePdfData.length === 0)) {
      setStatus("Wait for the online PDF to load before saving locally.");
      return;
    }

    if (!tabData.dataBase64 && tabData.source !== "convex") {
      setStatus("Import a PDF first.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      let nextBase64 = tabData.dataBase64;

      if (!nextBase64 && tabData.source === "convex" && remotePdfData && remotePdfData.length > 0) {
        nextBase64 = toBase64(toArrayBuffer(Uint8Array.from(remotePdfData)));
      }

      if (!nextBase64) {
        throw new Error("No PDF data available to save locally.");
      }

      const fileName = normalizePdfTitle(tabData.fileName ?? activeTab?.title ?? "Document.pdf");
      writeTabData({
        ...tabData,
        source: "local",
        storageId: null,
        dataBase64: nextBase64,
        fileName,
      });
      setTabOrigin("local");
      setStatus("Saved locally.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save locally.";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }, [activeTab?.title, activeTabId, remotePdfData, setTabOrigin, tabData, writeTabData]);

  const saveAnnotations = useCallback((annotations: IAnnotationStore[]) => {
    writeTabData({ ...tabData, annotations });
    setStatus(tabData.source === "convex" ? "Saved online." : "Saved locally.");
  }, [tabData, writeTabData]);

  const annotatorActions = useMemo(() => {
    const Actions = ({ save, exportToPdf }: PdfActionsProps) => (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleImportChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            save();
          }}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={saveLocal}
          disabled={busy || (!tabData.dataBase64 && (!remotePdfData || remotePdfData.length === 0))}
        >
          <HardDrive className="h-3.5 w-3.5" />
          Save Local
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={saveOnline}
          disabled={busy || !isAuthenticated || (tabData.source === "convex" && !!tabData.storageId)}
        >
          <CloudUpload className="h-3.5 w-3.5" />
          Save Online
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => exportToPdf(fileNameWithoutExt(activeTab?.title ?? "document"))}
          disabled={busy}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            if (activeTabId) closeTab(activeTabId);
          }}
        >
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      </div>
    );

    Actions.displayName = "PdfAnnotatorActions";
    return Actions;
  }, [activeTab?.title, activeTabId, busy, closeTab, handleImportChange, isAuthenticated, remotePdfData, saveLocal, saveOnline, tabData.dataBase64, tabData.source, tabData.storageId]);

  const pdfData = useMemo(() => {
    if (tabData.source === "local" && tabData.dataBase64) {
      try {
        // Use number[] for local payloads to avoid ambiguous string parsing in the PDF loader.
        return Array.from(fromBase64(tabData.dataBase64));
      } catch {
        return undefined;
      }
    }
    if (tabData.source === "convex" && remotePdfData && remotePdfData.length > 0) {
      return remotePdfData;
    }
    return undefined;
  }, [remotePdfData, tabData.dataBase64, tabData.source]);
  const hasPdf = Boolean(pdfData && pdfData.length > 0);

  if (!activeTabId) {
    return null;
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {!hasPdf ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleImportChange}
          />
          {isLoadingRemotePdf ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Import a PDF to start annotating.</p>
              <Button onClick={() => inputRef.current?.click()} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import PDF
              </Button>
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground">Not signed in: PDF is stored locally until you choose Save Online.</p>
              )}
              {status && <p className="text-xs text-muted-foreground">{status}</p>}
            </>
          )}
        </div>
      ) : !pdfWorkerReady ? (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing PDF viewer...
        </div>
      ) : (
        <>
          <PdfAnnotator
            title={activeTab?.title ?? "PDF Editor"}
            locale="en-US"
            user={{ id: userId ?? "local-user", name: user?.firstName ?? user?.email ?? "Local User" }}
            {...(pdfData ? { data: pdfData } : {})}
            initialAnnotations={tabData.annotations}
            actions={annotatorActions}
            onSave={saveAnnotations}
            layoutStyle={{ width: "100%", height: "100%" }}
            enableNativeAnnotations
            defaultShowAnnotationsSidebar
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow",
              status ? "opacity-100" : "opacity-0"
            )}
          >
            {status}
          </div>
        </>
      )}
    </div>
  );
}
