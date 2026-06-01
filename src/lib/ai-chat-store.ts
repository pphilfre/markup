"use client";

import { create } from "zustand";

type ModelPricing = {
  prompt?: string;
  completion?: string;
  image?: string;
  request?: string;
};

export type AiChatModel = {
  id: string;
  name: string;
  description?: string | null;
  contextLength?: number | null;
  pricing?: ModelPricing | null;
};

export type AiChatModelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing_key"
  | "auth_failed"
  | "error";

export type AiChatSendStatus = "idle" | "sending" | "error";

export type AiChatMessageRole = "user" | "assistant" | "error";

export type AiChatMessage = {
  id: string;
  role: AiChatMessageRole;
  content: string;
  createdAt: number;
  status?: "loading" | "complete";
  details?: string;
  reveal?: boolean;
};

export type AiChatError = {
  title: string;
  message: string;
  details?: string;
};

type ModelListResponse =
  | {
      ok: true;
      status: "ready";
      models: AiChatModel[];
    }
  | {
      ok: false;
      status: "missing_key" | "auth_failed" | "provider_error" | "invalid_request";
      error: { code: string; message: string; details?: unknown };
    };

type AiChatState = {
  panelOpen: boolean;
  models: AiChatModel[];
  modelStatus: AiChatModelStatus;
  modelError: AiChatError | null;
  selectedModelId: string | null;
  sendStatus: AiChatSendStatus;
  sendError: AiChatError | null;
  messages: AiChatMessage[];
  attachedNoteIds: string[];
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setSelectedModelId: (modelId: string | null) => void;
  setSendStatus: (status: AiChatSendStatus, error?: AiChatError | null) => void;
  addMessage: (message: AiChatMessage) => void;
  updateMessage: (id: string, update: Partial<AiChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  attachNote: (noteId: string) => void;
  detachNote: (noteId: string) => void;
  clearAttachments: () => void;
  ensureStatus: () => Promise<void> | void;
  ensureModels: () => Promise<void> | void;
};

const MODEL_ENDPOINT = "/api/ai/openrouter";
const STATUS_ENDPOINT = `${MODEL_ENDPOINT}?status=1`;
let inflightModels: Promise<void> | null = null;
let inflightStatus: Promise<void> | null = null;

function formatDetails(details?: unknown): string | undefined {
  if (!details) return undefined;
  if (typeof details === "string") {
    return details.length > 800 ? `${details.slice(0, 800)}...` : details;
  }
  try {
    const serialized = JSON.stringify(details);
    return serialized.length > 800 ? `${serialized.slice(0, 800)}...` : serialized;
  } catch {
    return undefined;
  }
}

function buildModelError(data: ModelListResponse | null): { status: AiChatModelStatus; error: AiChatError } {
  const fallback: AiChatError = {
    title: "Unable to load models",
    message: "We could not fetch the OpenRouter model list. Please try again.",
  };

  if (!data || data.ok) {
    return { status: "error", error: fallback };
  }

  switch (data.status) {
    case "missing_key":
      return {
        status: "missing_key",
        error: {
          title: "OpenRouter not configured",
          message: "Set OPENROUTER_API_KEY to enable Markup AI.",
        },
      };
    case "auth_failed":
      return {
        status: "auth_failed",
        error: {
          title: "OpenRouter authentication failed",
          message: "Check your OPENROUTER_API_KEY and try again.",
          details: formatDetails(data.error?.details) ?? formatDetails(data.error?.message),
        },
      };
    case "provider_error":
      return {
        status: "error",
        error: {
          title: "OpenRouter error",
          message: data.error?.message || fallback.message,
          details: formatDetails(data.error?.details),
        },
      };
    default:
      return {
        status: "error",
        error: {
          title: "OpenRouter error",
          message: data.error?.message || fallback.message,
          details: formatDetails(data.error?.details),
        },
      };
  }
}

export const useAiChatStore = create<AiChatState>((set, get) => ({
  panelOpen: false,
  models: [],
  modelStatus: "idle",
  modelError: null,
  selectedModelId: null,
  sendStatus: "idle",
  sendError: null,
  messages: [],
  attachedNoteIds: [],

  setPanelOpen: (open) => {
    set({ panelOpen: open });
    if (open) {
      void get().ensureModels();
    }
  },

  togglePanel: () => {
    const nextOpen = !get().panelOpen;
    set({ panelOpen: nextOpen });
    if (nextOpen) {
      void get().ensureModels();
    }
  },

  setSelectedModelId: (modelId) => set({ selectedModelId: modelId }),

  setSendStatus: (status, error = null) => set({ sendStatus: status, sendError: error }),

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, update) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...update } : message
      ),
    })),

  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((message) => message.id !== id) })),

  clearMessages: () => set({ messages: [] }),

  attachNote: (noteId) => set((state) => {
    if (state.attachedNoteIds.includes(noteId)) return state;
    return { attachedNoteIds: [...state.attachedNoteIds, noteId] };
  }),

  detachNote: (noteId) => set((state) => ({
    attachedNoteIds: state.attachedNoteIds.filter((id) => id !== noteId),
  })),

  clearAttachments: () => set({ attachedNoteIds: [] }),

  ensureStatus: async () => {
    const { modelStatus, models } = get();
    if (modelStatus === "loading") return;
    if (modelStatus === "ready" && models.length > 0) return;
    if (modelStatus === "missing_key" || modelStatus === "auth_failed") return;
    if (inflightStatus) return inflightStatus;

    inflightStatus = (async () => {
      try {
        const res = await fetch(STATUS_ENDPOINT);
        const data = (await res.json().catch(() => null)) as ModelListResponse | null;

        if (!data || !data.ok) {
          const { status, error } = buildModelError(data);
          set({ modelStatus: status, modelError: error, models: [] });
          return;
        }

        set((state) => ({
          modelStatus: state.modelStatus === "ready" ? state.modelStatus : "ready",
          modelError: null,
        }));
      } catch (error) {
        set({
          modelStatus: "error",
          modelError: {
            title: "Unable to reach OpenRouter",
            message: "We could not check the AI status. Please try again.",
            details: error instanceof Error ? error.message : undefined,
          },
        });
      } finally {
        inflightStatus = null;
      }
    })();

    return inflightStatus;
  },

  ensureModels: async () => {
    const { modelStatus, models } = get();
    if (modelStatus === "loading") return;
    if (modelStatus === "ready" && models.length > 0) return;
    if (inflightModels) return inflightModels;

    set({ modelStatus: "loading", modelError: null });

    inflightModels = (async () => {
      try {
        const res = await fetch(MODEL_ENDPOINT);
        const data = (await res.json().catch(() => null)) as ModelListResponse | null;

        if (!data || !data.ok) {
          const { status, error } = buildModelError(data);
          set({ modelStatus: status, modelError: error, models: [] });
          return;
        }

        const nextModels = Array.isArray(data.models) ? data.models : [];
        const currentSelected = get().selectedModelId;

        const DEFAULT_MODEL_ID = "openai/gpt-oss-20b:free";
        const preferredDefault =
          nextModels.find((m) => m.id === DEFAULT_MODEL_ID) ?? nextModels[0] ?? null;

        const nextSelected = currentSelected
          ? (nextModels.find((model) => model.id === currentSelected)?.id ?? preferredDefault?.id ?? null)
          : (preferredDefault?.id ?? null);

        set({
          models: nextModels,
          modelStatus: "ready",
          modelError: null,
          selectedModelId: nextSelected,
        });
      } catch (error) {
        set({
          modelStatus: "error",
          modelError: {
            title: "Unable to load models",
            message: "We could not reach OpenRouter. Please try again.",
            details: error instanceof Error ? error.message : undefined,
          },
        });
      } finally {
        inflightModels = null;
      }
    })();

    return inflightModels;
  },
}));
