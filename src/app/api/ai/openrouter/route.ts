import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const APP_TITLE = "Markup";

type ErrorCode = "missing_api_key" | "auth_failed" | "provider_error" | "invalid_request";
type ErrorStatus = "missing_key" | "auth_failed" | "provider_error" | "invalid_request";

type ErrorPayload = {
  ok: false;
  status: ErrorStatus;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

type ModelPricing = {
  prompt?: string;
  completion?: string;
  image?: string;
  request?: string;
};

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string | null;
  contextLength?: number | null;
  pricing?: ModelPricing | null;
};

type ModelsPayload = {
  ok: true;
  status: "ready";
  models: OpenRouterModel[];
};

type ChatPayload = {
  ok: true;
  status: "ready";
  completion: unknown;
};

type ApiResponse = ErrorPayload | ModelsPayload | ChatPayload;

type ChatMessage = {
  role: string;
  content: string;
  name?: string;
};

type ChatRequestBody = {
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  top_p?: unknown;
};

function jsonError(
  status: ErrorStatus,
  code: ErrorCode,
  message: string,
  details?: unknown,
  httpStatus = 200
): NextResponse<ApiResponse> {
  return NextResponse.json(
    { ok: false, status, error: { code, message, details } },
    { status: httpStatus }
  );
}

function getApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  return typeof key === "string" && key.trim().length ? key.trim() : null;
}

async function readProviderPayload(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

function mapModels(payload: unknown): OpenRouterModel[] {
  const models = Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data
    : [];

  return models
    .map((model) => {
      const record = model as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      if (!id) return null;
      const pricingValue = record.pricing;
      const pricing = pricingValue && typeof pricingValue === "object"
        ? {
            prompt: typeof (pricingValue as Record<string, unknown>).prompt === "string"
              ? (pricingValue as Record<string, unknown>).prompt as string
              : undefined,
            completion: typeof (pricingValue as Record<string, unknown>).completion === "string"
              ? (pricingValue as Record<string, unknown>).completion as string
              : undefined,
            image: typeof (pricingValue as Record<string, unknown>).image === "string"
              ? (pricingValue as Record<string, unknown>).image as string
              : undefined,
            request: typeof (pricingValue as Record<string, unknown>).request === "string"
              ? (pricingValue as Record<string, unknown>).request as string
              : undefined,
          }
        : null;
      return {
        id,
        name: typeof record.name === "string" && record.name.trim().length
          ? record.name
          : id,
        description: typeof record.description === "string" ? record.description : null,
        contextLength: typeof record.context_length === "number"
          ? record.context_length
          : null,
        pricing,
      } satisfies OpenRouterModel;
    })
    .filter((model): model is OpenRouterModel => Boolean(model));
}

function normalizeMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const role = typeof record.role === "string" ? record.role : null;
    const content = typeof record.content === "string" ? record.content : null;
    if (!role || !content) return null;
    const message: ChatMessage = { role, content };
    if (typeof record.name === "string") {
      message.name = record.name;
    }
    messages.push(message);
  }
  return messages;
}

function buildProviderHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Title": APP_TITLE,
  };
}

async function handleProviderError(res: Response, payload: unknown) {
  const status = res.status === 401 || res.status === 403
    ? "auth_failed"
    : "provider_error";
  const message = status === "auth_failed"
    ? "OpenRouter authentication failed."
    : "OpenRouter returned an error.";
  return jsonError(status, status === "auth_failed" ? "auth_failed" : "provider_error", message, payload, res.status);
}

export async function GET(req: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return jsonError(
      "missing_key",
      "missing_api_key",
      "OpenRouter API key is not configured."
    );
  }

  const statusOnly = req.nextUrl.searchParams.get("status");
  if (statusOnly === "1" || statusOnly === "true") {
    return NextResponse.json({
      ok: true,
      status: "ready",
      models: [],
    } satisfies ModelsPayload);
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: buildProviderHeaders(apiKey),
    });
    const payload = await readProviderPayload(res);

    if (!res.ok) {
      return handleProviderError(res, payload);
    }

    return NextResponse.json({
      ok: true,
      status: "ready",
      models: mapModels(payload),
    } satisfies ModelsPayload);
  } catch (error) {
    console.error("[openrouter] models", error);
    return jsonError(
      "provider_error",
      "provider_error",
      "OpenRouter is unavailable right now."
    );
  }
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return jsonError(
      "missing_key",
      "missing_api_key",
      "OpenRouter API key is not configured.",
      undefined,
      400
    );
  }

  let body: ChatRequestBody | null = null;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    body = null;
  }

  if (!body) {
    return jsonError(
      "invalid_request",
      "invalid_request",
      "Invalid JSON body.",
      undefined,
      400
    );
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) {
    return jsonError(
      "invalid_request",
      "invalid_request",
      "Missing model.",
      undefined,
      400
    );
  }

  const messages = normalizeMessages(body.messages);
  if (!messages) {
    return jsonError(
      "invalid_request",
      "invalid_request",
      "Missing or invalid messages.",
      undefined,
      400
    );
  }

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };

  if (typeof body.temperature === "number") {
    payload.temperature = body.temperature;
  }
  if (typeof body.max_tokens === "number") {
    payload.max_tokens = body.max_tokens;
  }
  if (typeof body.top_p === "number") {
    payload.top_p = body.top_p;
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: buildProviderHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const providerPayload = await readProviderPayload(res);
    if (!res.ok) {
      return handleProviderError(res, providerPayload);
    }

    return NextResponse.json({
      ok: true,
      status: "ready",
      completion: providerPayload,
    } satisfies ChatPayload);
  } catch (error) {
    console.error("[openrouter] chat", error);
    return jsonError(
      "provider_error",
      "provider_error",
      "OpenRouter is unavailable right now."
    );
  }
}
