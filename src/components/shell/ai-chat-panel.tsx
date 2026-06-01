"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FolderOpen,
  Info,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useAiChatStore, type AiChatMessage, type AiChatModel } from "@/lib/ai-chat-store";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MarkdownPreviewStandalone } from "@/components/editor/markdown-preview-standalone";

const OPEN_LINK_PICKER_EVENT = "open-link-picker";
const CHAT_ENDPOINT = "/api/ai/openrouter";
const DEFAULT_PANEL_WIDTH = 360;
const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 720;

function stripExtension(title: string): string {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
}

function getDisplayTitle(title: string, hideMd: boolean): string {
  return hideMd ? stripExtension(title) : title;
}

function formatDetails(details?: unknown): string | undefined {
  if (!details) return undefined;
  if (typeof details === "string") {
    return details.length > 1200 ? `${details.slice(0, 1200)}...` : details;
  }
  try {
    const serialized = JSON.stringify(details, null, 2);
    return serialized.length > 1200 ? `${serialized.slice(0, 1200)}...` : serialized;
  } catch {
    return undefined;
  }
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type ExtractionResult =
  | { ok: true; text: string }
  | { ok: false; message: string; details?: string };

function extractCompletionText(payload: unknown): ExtractionResult {
  if (typeof payload === "string" && payload.trim().length) {
    return { ok: true, text: payload };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "OpenRouter returned an empty response." };
  }
  const record = payload as { choices?: Array<Record<string, unknown>> };
  const choice = record.choices?.[0];
  if (choice) {
    const finishReason = choice.finish_reason;
    const choiceError = choice.error as Record<string, unknown> | undefined;
    if (finishReason === "error" || choiceError) {
      const providerMessage =
        typeof choiceError?.message === "string"
          ? choiceError.message
          : "The model provider returned an error.";
      return { ok: false, message: providerMessage, details: choiceError ? formatDetails(choiceError) : undefined };
    }
  }
  const message = choice?.message as { content?: unknown } | undefined;
  if (message && typeof message.content === "string" && message.content.trim().length) {
    return { ok: true, text: message.content };
  }
  const text = choice?.text;
  if (typeof text === "string" && text.trim().length) return { ok: true, text };
  return { ok: false, message: "OpenRouter returned an empty response.", details: formatDetails(payload) };
}

function buildAttachmentContext(attachedNotes: Tab[], hideMd: boolean): string {
  return attachedNotes
    .map((note) => {
      const title = getDisplayTitle(note.title, hideMd);
      const body = note.content.trim().length ? note.content.trim() : "(Empty note)";
      return `# ${title}\n${body}`;
    })
    .join("\n\n---\n\n");
}

function buildSystemPrompt(attachedNotes: Tab[], hideMd: boolean): string {
  const base = "You are Markup AI, a helpful writing and planning assistant. Respond in Markdown.";
  if (attachedNotes.length === 0) return base;
  const context = buildAttachmentContext(attachedNotes, hideMd);
  return `${base}\n\nAttached notes:\n${context}`;
}

type StatusNotice = { title: string; message: string; details?: string };

function useActiveTab() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId && getTabWorkspaceId(tab) === activeProfileId) ?? null,
    [activeProfileId, activeTabId, tabs]
  );
  return { activeTab };
}

// Inline model picker popover used both in the toolbar and in the retry dropdown
function ModelPickerPopover({
  models,
  selectedModelId,
  modelStatus,
  onSelect,
  children,
  align = "start",
  side = "top",
}: {
  models: AiChatModel[];
  selectedModelId: string | null;
  modelStatus: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [models, query]);

  const disabled = modelStatus !== "ready" || models.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children as React.ReactElement}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className="flex max-h-[min(60vh,calc(100dvh-6rem))] w-[480px] max-w-[92vw] flex-col overflow-hidden p-0"
      >
        <div className="shrink-0 border-b border-border/60 bg-background px-2 py-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            aria-label="Search models"
            autoComplete="off"
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 w-full rounded-md border border-border/70 bg-background px-2 text-[11px] outline-none focus:border-primary"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No models</div>
            ) : (
              filtered.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => { onSelect(model.id); setOpen(false); }}
                  className="flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <div className="mt-0.5">
                    {model.id === selectedModelId
                      ? <Check className="h-3.5 w-3.5 text-primary" />
                      : <div className="h-3.5 w-3.5" />}
                  </div>
                  <p className="min-w-0 text-sm font-medium leading-snug break-words">{model.name}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChatMessageBubble({
  message,
  compact,
  models,
  selectedModelId,
  modelStatus,
  isSending,
  onRevealComplete,
  onCopy,
  onRetry,
}: {
  message: AiChatMessage;
  compact?: boolean;
  models: AiChatModel[];
  selectedModelId: string | null;
  modelStatus: string;
  isSending: boolean;
  onRevealComplete: (id: string) => void;
  onCopy: (content: string) => void;
  onRetry: (messageId: string, modelId: string) => void;
}) {
  const [revealedText, setRevealedText] = useState(message.content);
  const [isRevealing, setIsRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (message.role !== "assistant" || !message.reveal || message.status === "loading") {
      setRevealedText(message.content);
      setIsRevealing(false);
      return;
    }
    const text = message.content;
    let index = 0;
    const step = Math.max(1, Math.floor(text.length / 80));
    setIsRevealing(true);
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setRevealedText(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
        setIsRevealing(false);
        onRevealComplete(message.id);
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [message.content, message.id, message.reveal, message.role, message.status, onRevealComplete]);

  const isUser = message.role === "user";
  const isError = message.role === "error";
  const isLoading = message.status === "loading";
  const displayContent = isRevealing ? revealedText : message.content;

  const handleCopy = useCallback(() => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content, onCopy]);

  return (
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 text-sm leading-relaxed",
          isUser ? "py-2" : "py-1",
          compact && "text-[13px]",
          isUser && "bg-foreground text-background",
          !isUser && !isError && "bg-muted/50 text-foreground",
          isError && "border border-destructive/40 bg-destructive/10 text-destructive"
        )}
      >
        {isLoading ? (
          <div className="py-1">
            <div className="h-2 w-8 animate-pulse rounded-full bg-muted-foreground/40" />
          </div>
        ) : isError ? (
          <div className="flex flex-col gap-1.5 py-0.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words text-xs leading-relaxed">{message.content}</span>
            </div>
            {message.details && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-5 w-5 self-end text-destructive/80 hover:text-destructive"
                    aria-label="View error details"
                  >
                    <Info className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 text-xs">
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                    {message.details}
                  </pre>
                </PopoverContent>
              </Popover>
            )}
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-pre:my-1 prose-headings:mb-1 prose-headings:mt-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <MarkdownPreviewStandalone content={displayContent} />
          </div>
        )}
      </div>

      {/* Action buttons — shown on hover for assistant/error, hidden for user/loading */}
      {!isUser && !isLoading && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isError && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={copied ? "Copied" : "Copy message"}
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          )}
          <ModelPickerPopover
            models={models}
            selectedModelId={selectedModelId}
            modelStatus={modelStatus}
            onSelect={(modelId) => onRetry(message.id, modelId)}
            align="start"
            side="top"
          >
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Retry with model"
              disabled={isSending}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </ModelPickerPopover>
        </div>
      )}
    </div>
  );
}

function AiChatPanelContent({
  onClose,
  compact = false,
}: {
  onClose: () => void;
  compact?: boolean;
}) {
  const models = useAiChatStore((s) => s.models);
  const modelStatus = useAiChatStore((s) => s.modelStatus);
  const modelError = useAiChatStore((s) => s.modelError);
  const selectedModelId = useAiChatStore((s) => s.selectedModelId);
  const sendStatus = useAiChatStore((s) => s.sendStatus);
  const sendError = useAiChatStore((s) => s.sendError);
  const messages = useAiChatStore((s) => s.messages);
  const attachedNoteIds = useAiChatStore((s) => s.attachedNoteIds);
  const setSelectedModelId = useAiChatStore((s) => s.setSelectedModelId);
  const setSendStatus = useAiChatStore((s) => s.setSendStatus);
  const addMessage = useAiChatStore((s) => s.addMessage);
  const updateMessage = useAiChatStore((s) => s.updateMessage);
  const clearMessages = useAiChatStore((s) => s.clearMessages);
  const attachNote = useAiChatStore((s) => s.attachNote);
  const detachNote = useAiChatStore((s) => s.detachNote);
  const ensureModels = useAiChatStore((s) => s.ensureModels);

  const tabs = useEditorStore((s) => s.tabs);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);
  const { activeTab } = useActiveTab();

  const [draft, setDraft] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const attachedNotes = useMemo(() => {
    return attachedNoteIds.map((id) => tabs.find((tab) => tab.id === id)).filter(Boolean) as Tab[];
  }, [attachedNoteIds, tabs]);

  const activeAttached = !!activeTab && attachedNoteIds.includes(activeTab.id);

  const modelLabel = useMemo(() => {
    if (modelStatus === "loading") return "Loading";
    if (modelStatus === "missing_key") return "Setup";
    if (modelStatus === "auth_failed") return "Auth error";
    if (modelStatus === "error") return "Unavailable";
    const m = models.find((m) => m.id === selectedModelId);
    return m ? m.name : "Select model";
  }, [modelStatus, models, selectedModelId]);

  const statusNotice = useMemo<StatusNotice | null>(() => {
    if (sendStatus === "error" && sendError) return { title: sendError.title, message: sendError.message, details: sendError.details };
    if ((modelStatus === "missing_key" || modelStatus === "auth_failed" || modelStatus === "error") && modelError) {
      return { title: modelError.title, message: modelError.message, details: modelError.details };
    }
    return null;
  }, [modelError, modelStatus, sendError, sendStatus]);

  const canSend = draft.trim().length > 0 && sendStatus !== "sending" && modelStatus === "ready" && !!selectedModelId;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages.length, scrollToBottom]);

  // Scroll during streaming reveal
  const lastMessageContent = messages[messages.length - 1]?.content ?? "";
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (isAtBottom) scrollToBottom("smooth");
  }, [lastMessageContent, scrollToBottom]);

  const handleRevealComplete = useCallback((id: string) => {
    updateMessage(id, { reveal: false });
  }, [updateMessage]);

  const handleCopy = useCallback((content: string) => {
    void navigator.clipboard.writeText(content);
  }, []);

  // Core send logic — accepts an explicit model override and a history override for retry
  const sendRequest = useCallback(async (opts: {
    userMessage: AiChatMessage;
    assistantMessageId: string;
    modelId: string;
    history: AiChatMessage[];
  }) => {
    const { userMessage, assistantMessageId, modelId, history } = opts;
    setSendStatus("sending", null);
    try {
      const apiHistory = [...history, userMessage]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      const systemPrompt = buildSystemPrompt(attachedNotes, hideMd);
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, messages: [{ role: "system", content: systemPrompt }, ...apiHistory] }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; completion: unknown }
        | { ok: false; error?: { message?: string; details?: unknown } }
        | null;
      if (!res.ok || !data || !data.ok) {
        const summary = data && !data.ok && data.error?.message ? data.error.message : "We could not reach OpenRouter. Please try again.";
        const details = formatDetails(data && !data.ok ? data.error?.details : null);
        updateMessage(assistantMessageId, { role: "error", content: summary, details, status: "complete" });
        setSendStatus("error", { title: "OpenRouter error", message: summary, details });
        return;
      }
      const result = extractCompletionText(data.completion);
      if (!result.ok) {
        updateMessage(assistantMessageId, { role: "error", content: result.message, details: result.details, status: "complete" });
        setSendStatus("error", { title: "OpenRouter error", message: result.message, details: result.details });
        return;
      }
      updateMessage(assistantMessageId, { role: "assistant", content: result.text, status: "complete", reveal: true });
      setSendStatus("idle", null);
    } catch (error) {
      const details = error instanceof Error ? error.message : undefined;
      updateMessage(assistantMessageId, { role: "error", content: "We could not reach OpenRouter. Please try again.", details, status: "complete" });
      setSendStatus("error", { title: "OpenRouter error", message: "We could not reach OpenRouter. Please try again.", details });
    }
  }, [attachedNotes, hideMd, setSendStatus, updateMessage]);

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedModelId) return;
    const trimmed = draft.trim();
    const userMessage: AiChatMessage = { id: createMessageId(), role: "user", content: trimmed, createdAt: Date.now(), status: "complete" };
    const assistantMessageId = createMessageId();
    addMessage(userMessage);
    addMessage({ id: assistantMessageId, role: "assistant", content: "", createdAt: Date.now(), status: "loading" });
    setDraft("");
    await sendRequest({ userMessage, assistantMessageId, modelId: selectedModelId, history: messages });
  }, [addMessage, canSend, draft, messages, selectedModelId, sendRequest]);

  // Retry: find the last user message before this assistant/error message, replay with chosen model
  const handleRetry = useCallback(async (messageId: string, modelId: string) => {
    if (sendStatus === "sending") return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    // Find the last user message before this position
    let userMsgIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userMsgIdx = i; break; }
    }
    if (userMsgIdx === -1) return;
    const userMessage = messages[userMsgIdx];
    const historyBeforeUser = messages.slice(0, userMsgIdx);
    // Replace the assistant/error message with a fresh loading one
    const newAssistantId = createMessageId();
    updateMessage(messageId, { id: newAssistantId, role: "assistant", content: "", status: "loading", details: undefined, reveal: false });
    setSelectedModelId(modelId);
    await sendRequest({ userMessage, assistantMessageId: newAssistantId, modelId, history: historyBeforeUser });
  }, [messages, sendRequest, sendStatus, setSelectedModelId, updateMessage]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setSendStatus("idle", null);
  }, [clearMessages, setSendStatus]);

  const handleOpenPicker = useCallback(() => {
    document.dispatchEvent(new CustomEvent(OPEN_LINK_PICKER_EVENT, {
      detail: { title: "Add context", description: "Select a note to attach.", onPick: (tabId: string) => attachNote(tabId) },
    }));
  }, [attachNote]);

  const handleToggleAttachment = useCallback(() => {
    if (!activeTab) return;
    activeAttached ? detachNote(activeTab.id) : attachNote(activeTab.id);
  }, [activeAttached, activeTab, attachNote, detachNote]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDropActive(true); }, []);
  const handleDragLeave = useCallback(() => setDropActive(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDropActive(false);
    const tabId = e.dataTransfer.getData("text/tab-id");
    if (tabId) attachNote(tabId);
  }, [attachNote]);

  useEffect(() => { if (modelStatus === "idle") void ensureModels(); }, [ensureModels, modelStatus]);

  return (
    <div className={cn("relative flex h-full flex-col bg-background", compact && "text-[13px]")}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">Markup AI</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={handleNewChat} aria-label="New chat" title="New chat">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close Markup AI">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("flex flex-col gap-2 px-3 pb-4 pt-3")}>
          {statusNotice && (
            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0 break-words">{statusNotice.message}</span>
              {statusNotice.details && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground" aria-label="View status details">
                      <Info className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 text-xs">
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{statusNotice.details}</pre>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              compact={compact}
              models={models}
              selectedModelId={selectedModelId}
              modelStatus={modelStatus}
              isSending={sendStatus === "sending"}
              onRevealComplete={handleRevealComplete}
              onCopy={handleCopy}
              onRetry={handleRetry}
            />
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <div
          className={cn("flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground", dropActive && "rounded-md bg-muted/50")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" aria-label="Attach notes">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={handleToggleAttachment} disabled={!activeTab}>
                {activeAttached ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {activeAttached ? "Remove active note" : "Add active note"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenPicker}>
                <FolderOpen className="h-3.5 w-3.5" />
                Browse notes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {attachedNotes.map((note) => (
            <div key={note.id} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2 py-1 text-[11px]">
              <span className="max-w-[140px] truncate">{getDisplayTitle(note.title, hideMd)}</span>
              <Button variant="ghost" size="icon-xs" onClick={() => detachNote(note.id)} aria-label={`Remove ${note.title}`}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <ModelPickerPopover
              models={models}
              selectedModelId={selectedModelId}
              modelStatus={modelStatus}
              onSelect={setSelectedModelId}
              align="start"
              side="top"
            >
              <Button
                variant="ghost"
                size="xs"
                className="absolute bottom-2 left-2 z-10 h-6 max-w-[200px] gap-1 px-2 text-[11px] text-muted-foreground"
                disabled={modelStatus !== "ready" || models.length === 0}
              >
                <span className="truncate">{modelLabel}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </ModelPickerPopover>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
              placeholder="Ask Markup AI..."
              rows={3}
              className={cn(
                "min-h-[88px] w-full resize-none rounded-md border border-border bg-background px-3 pb-10 pt-3 text-sm leading-relaxed shadow-sm outline-none focus:border-primary",
                compact && "text-[13px]"
              )}
            />
          </div>
          <Button size="icon" disabled={!canSend} aria-label="Send message" onClick={() => void handleSend()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AiChatPanel() {
  const panelOpen = useAiChatStore((s) => s.panelOpen);
  const setPanelOpen = useAiChatStore((s) => s.setPanelOpen);
  const [width, setWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_PANEL_WIDTH);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setPanelOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, setPanelOpen]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth.current + delta));
      setWidth(next);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width]);

  return (
    <div
      id="markup-ai-panel"
      style={{ width }}
      className={cn(
        "fixed right-0 top-8 z-50 h-[calc(100%-2rem)] max-w-[92vw] border-l border-border bg-card shadow-2xl transition-transform duration-300",
        panelOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
      aria-hidden={!panelOpen}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        aria-hidden
      />
      <AiChatPanelContent onClose={() => setPanelOpen(false)} />
    </div>
  );
}

export function AiChatMobileModal() {
  const panelOpen = useAiChatStore((s) => s.panelOpen);
  const setPanelOpen = useAiChatStore((s) => s.setPanelOpen);
  return (
    <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
      <DialogContent showCloseButton={false} className="h-[100dvh] w-[100dvw] max-w-none rounded-none p-0">
        <AiChatPanelContent onClose={() => setPanelOpen(false)} compact />
      </DialogContent>
    </Dialog>
  );
}

export function AiChatToggleButton() {
  const panelOpen = useAiChatStore((s) => s.panelOpen);
  const setPanelOpen = useAiChatStore((s) => s.setPanelOpen);
  const modelStatus = useAiChatStore((s) => s.modelStatus);
  const ensureStatus = useAiChatStore((s) => s.ensureStatus);

  useEffect(() => { if (modelStatus === "idle") void ensureStatus(); }, [ensureStatus, modelStatus]);

  const needsSetup = modelStatus === "missing_key";
  const hasError = modelStatus === "auth_failed" || modelStatus === "error";
  const label = needsSetup ? "Setup AI" : "Markup AI";

  return (
    <button
      type="button"
      onClick={() => setPanelOpen(true)}
      aria-label={label}
      aria-expanded={panelOpen}
      className={cn("fixed right-2 top-1/2 z-40 -translate-y-1/2", panelOpen && "pointer-events-none opacity-0")}
    >
      <div className={cn(
        "flex h-20 w-7 items-center justify-center rounded-l-lg border border-border/60 bg-card/80 px-1 shadow-sm transition-colors",
        needsSetup && "border-amber-400/60 bg-amber-100/60 text-amber-900",
        hasError && !needsSetup && "border-red-400/60 bg-red-100/60 text-red-900",
        !needsSetup && !hasError && "text-muted-foreground"
      )}>
        <span className="block rotate-90 text-[10px] font-semibold uppercase tracking-[0.2em]">Markup AI</span>
      </div>
    </button>
  );
}
