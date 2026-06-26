#!/usr/bin/env node
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DEFAULT_BASE_URL = "https://api.poe.com";
const DEFAULT_MODEL = "GPT-4.1";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_UPSTREAM_TIMEOUT_MS = 300_000;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_MAX = 10_000;
const MAX_RATE_LIMIT_WINDOW_MS = 3_600_000;
const MAX_MODEL_MAPPINGS_BYTES = 16_384;
const MAX_MODEL_MAPPINGS_ENTRIES = 100;
const INTERNAL_PROXY_ERROR = "Internal proxy error";
const INTERNAL_PROXY_LOG = "Unexpected internal proxy failure";
const POE_TOOL_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const DEFAULT_MODEL_MAPPINGS = Object.freeze({
  "claude-sonnet-4-20250514": "Claude-Sonnet-4",
  "claude-3-5-sonnet-20241022": "Claude-Sonnet-3.5",
  "claude-3-5-sonnet-20240620": "Claude-Sonnet-3.5",
  "claude-3-5-haiku-20241022": "Claude-Haiku-3.5",
  "claude-3-opus-20240229": "Claude-Opus-3",
  "claude-3-sonnet-20240229": "Claude-Sonnet-3",
  "claude-3-haiku-20240307": "Claude-Haiku-3",
});

export function isDebugEnabled(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "")
      .trim()
      .toLowerCase()
  );
}

function configValue(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function optionalConfigValue(value) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function positiveIntegerConfig(value, fallback, maximum) {
  const normalized = String(value || "").trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

function upstreamTimeoutConfig(value) {
  return positiveIntegerConfig(
    value,
    DEFAULT_UPSTREAM_TIMEOUT_MS,
    MAX_UPSTREAM_TIMEOUT_MS
  );
}

export function parseModelMappings(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return DEFAULT_MODEL_MAPPINGS;
  if (Buffer.byteLength(normalized, "utf8") > MAX_MODEL_MAPPINGS_BYTES) {
    throw new Error("POE_MODEL_MAPPINGS_JSON exceeds 16384 bytes");
  }

  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("POE_MODEL_MAPPINGS_JSON must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("POE_MODEL_MAPPINGS_JSON must be a JSON object");
  }

  const entries = Object.entries(parsed);
  if (entries.length > MAX_MODEL_MAPPINGS_ENTRIES) {
    throw new Error("POE_MODEL_MAPPINGS_JSON exceeds 100 entries");
  }
  const mappings = { ...DEFAULT_MODEL_MAPPINGS };
  for (const [rawName, rawTarget] of entries) {
    const name = rawName.trim();
    const target = typeof rawTarget === "string" ? rawTarget.trim() : "";
    if (!name || !target || ["__proto__", "constructor", "prototype"].includes(name)) {
      throw new Error("POE_MODEL_MAPPINGS_JSON entries must be safe nonempty strings");
    }
    mappings[name] = target;
  }
  return Object.freeze(mappings);
}

export function loadConfig(env = process.env) {
  return {
    baseUrl: configValue(env.POE_BASE_URL, DEFAULT_BASE_URL),
    apiKey: optionalConfigValue(env.POE_API_KEY),
    proxyApiKey: optionalConfigValue(env.POE_PROXY_API_KEY),
    defaultModel: configValue(env.POE_MODEL, DEFAULT_MODEL),
    modelMappings: parseModelMappings(env.POE_MODEL_MAPPINGS_JSON),
    host: configValue(env.HOST, DEFAULT_HOST),
    port: configValue(env.PORT, DEFAULT_PORT),
    upstreamTimeoutMs: upstreamTimeoutConfig(env.POE_UPSTREAM_TIMEOUT_MS),
    rateLimitMax: positiveIntegerConfig(
      env.POE_RATE_LIMIT_MAX,
      DEFAULT_RATE_LIMIT_MAX,
      MAX_RATE_LIMIT_MAX
    ),
    rateLimitWindowMs: positiveIntegerConfig(
      env.POE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      MAX_RATE_LIMIT_WINDOW_MS
    ),
    debug: isDebugEnabled(env.DEBUG),
  };
}

function debugLog(enabled, ...args) {
  if (enabled) console.log(...args);
}

function printMissingApiKeyHelp() {
  console.error("POE_API_KEY environment variable is required");
  console.error("You can set it in .env file or as an OS environment variable:");
  console.error("  export POE_API_KEY=your_api_key");
  console.error("  or create .env file with: POE_API_KEY=your_api_key");
}

function printMissingProxyApiKeyHelp() {
  console.error("POE_PROXY_API_KEY environment variable is required");
  console.error("Set it to a private token that callers must send as:");
  console.error("  Authorization: Bearer your_proxy_token");
}

function safeTokenEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getHeaderValue(headers, name) {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function extractProxyToken(headers) {
  const authorization = getHeaderValue(headers, "authorization");
  if (typeof authorization === "string") {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }

  const proxyHeader =
    getHeaderValue(headers, "x-proxy-api-key") ||
    getHeaderValue(headers, "x-api-key");
  return typeof proxyHeader === "string" ? proxyHeader.trim() : "";
}

function validateProxyAuthorization(headers, proxyApiKey) {
  if (!proxyApiKey) {
    return { statusCode: 503, error: "POE_PROXY_API_KEY is not configured" };
  }

  const token = extractProxyToken(headers);
  if (!token) {
    return { statusCode: 401, error: "Proxy authorization is required" };
  }

  if (!safeTokenEqual(token, proxyApiKey)) {
    return { statusCode: 403, error: "Proxy authorization is invalid" };
  }

  return null;
}

function validateUpstreamApiKey(apiKey) {
  if (!apiKey) {
    return { statusCode: 503, error: "POE_API_KEY is not configured" };
  }

  return null;
}

function isUpstreamTimeoutError(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

async function readUpstreamErrorDetails(response) {
  const details = await response.text();
  if (details) return details;

  const statusText = response.statusText ? ` ${response.statusText}` : "";
  return `Poe upstream request failed with ${response.status}${statusText}`;
}

function sendSSE(reply, event, data) {
  const sseMessage = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  reply.raw.write(sseMessage);
  if (typeof reply.raw.flush === "function") {
    reply.raw.flush();
  }
}

export function createSseLineDecoder() {
  const decoder = new TextDecoder("utf-8");
  let pending = "";

  return {
    push(chunk) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop();
      return lines;
    },
    finish() {
      pending += decoder.decode();
      if (!pending) return [];
      const finalLine = pending;
      pending = "";
      return [finalLine];
    },
  };
}

export function mapStopReason(finishReason) {
  switch (finishReason) {
    case "tool_calls":
      return "tool_use";
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

export function mapModelName(modelName, modelMappings = DEFAULT_MODEL_MAPPINGS) {
  return Object.hasOwn(modelMappings, modelName)
    ? modelMappings[modelName]
    : modelName;
}

export function normalizeContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return null;
}

export function buildPoeMessages(payload = {}) {
  const messages = [];

  if (typeof payload.system === "string") {
    messages.push({
      role: "system",
      content: payload.system,
    });
  } else if (payload.system && Array.isArray(payload.system)) {
    payload.system.forEach((sysMsg) => {
      const normalized = normalizeContent(sysMsg.text || sysMsg.content);
      if (normalized) {
        messages.push({
          role: "system",
          content: normalized,
        });
      }
    });
  }

  if (payload.messages && Array.isArray(payload.messages)) {
    payload.messages.forEach((msg) => {
      const toolCalls = (Array.isArray(msg.content) ? msg.content : [])
        .filter((item) => item.type === "tool_use")
        .map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.input || {}),
          },
        }));

      const newMsg = { role: msg.role };
      const normalized = normalizeContent(msg.content);
      if (normalized) newMsg.content = normalized;
      if (toolCalls.length > 0) newMsg.tool_calls = toolCalls;
      if (newMsg.content || newMsg.tool_calls) messages.push(newMsg);

      if (Array.isArray(msg.content)) {
        msg.content
          .filter((item) => item.type === "tool_result")
          .forEach((toolResult) => {
            messages.push({
              role: "tool",
              content:
                normalizeContent(toolResult.text || toolResult.content) || "",
              tool_call_id: toolResult.tool_use_id,
            });
          });
      }
    });
  }

  return messages;
}

export function removeUriFormat(schema) {
  if (!schema || typeof schema !== "object") return schema;

  if (schema.type === "string" && schema.format === "uri") {
    const { format, ...rest } = schema;
    return rest;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => removeUriFormat(item));
  }

  const result = {};
  for (const key in schema) {
    if (key === "properties" && typeof schema[key] === "object") {
      result[key] = {};
      for (const propKey in schema[key]) {
        result[key][propKey] = removeUriFormat(schema[key][propKey]);
      }
    } else if (key === "items" && typeof schema[key] === "object") {
      result[key] = removeUriFormat(schema[key]);
    } else if (
      key === "additionalProperties" &&
      typeof schema[key] === "object"
    ) {
      result[key] = removeUriFormat(schema[key]);
    } else if (
      ["anyOf", "allOf", "oneOf"].includes(key) &&
      Array.isArray(schema[key])
    ) {
      result[key] = schema[key].map((item) => removeUriFormat(item));
    } else {
      result[key] = removeUriFormat(schema[key]);
    }
  }
  return result;
}

function isValidPoeTool(tool) {
  return (
    tool &&
    typeof tool === "object" &&
    !Array.isArray(tool) &&
    tool.name !== "BatchTool" &&
    typeof tool.name === "string" &&
    POE_TOOL_NAME_RE.test(tool.name) &&
    tool.input_schema &&
    typeof tool.input_schema === "object" &&
    !Array.isArray(tool.input_schema)
  );
}

export function buildPoeTools(tools = []) {
  if (!Array.isArray(tools)) return [];

  return tools
    .filter((tool) => isValidPoeTool(tool))
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: removeUriFormat(tool.input_schema),
      },
    }));
}

export function buildPoePayload(
  payload = {},
  defaultModel = DEFAULT_MODEL,
  modelMappings = DEFAULT_MODEL_MAPPINGS
) {
  const messages = buildPoeMessages(payload);
  const tools = buildPoeTools(payload.tools || []);
  const poePayload = {
    model: mapModelName(payload.model || defaultModel, modelMappings),
    messages,
    max_tokens: payload.max_tokens,
    temperature: payload.temperature !== undefined ? payload.temperature : 1,
    stream: payload.stream === true,
  };

  if (tools.length > 0) poePayload.tools = tools;
  return poePayload;
}

function estimateTokens(text) {
  if (!text) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function firstPoeChoice(data) {
  if (!Array.isArray(data?.choices) || !data.choices[0]?.message) {
    throw new Error("Poe response missing choices[0].message");
  }
  return data.choices[0];
}

function parseToolCallInput(toolCall) {
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("Poe tool call arguments must be valid JSON");
  }
}

export function buildAnthropicResponse(data, poePayload) {
  if (data.error) {
    throw new Error(data.error.message);
  }

  const choice = firstPoeChoice(data);
  const poeMessage = choice.message;
  const toolCalls = poeMessage.tool_calls || [];
  const textContent =
    poeMessage.content === null || poeMessage.content === undefined
      ? []
      : [
          {
            text: poeMessage.content,
            type: "text",
          },
        ];

  return {
    content: [
      ...textContent,
      ...toolCalls.map((toolCall) => ({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input: parseToolCallInput(toolCall),
      })),
    ],
    id: data.id
      ? data.id.replace("chatcmpl", "msg")
      : "msg_" + Math.random().toString(36).substr(2, 24),
    model: poePayload.model,
    role: poeMessage.role,
    stop_reason: mapStopReason(choice.finish_reason),
    stop_sequence: null,
    type: "message",
    usage: {
      input_tokens: data.usage
        ? data.usage.prompt_tokens
        : poePayload.messages.reduce(
            (acc, msg) => acc + estimateTokens(msg.content),
            0
          ),
      output_tokens: data.usage
        ? data.usage.completion_tokens
        : estimateTokens(poeMessage.content),
    },
  };
}

export function createServer({
  baseUrl = DEFAULT_BASE_URL,
  apiKey,
  proxyApiKey,
  defaultModel = DEFAULT_MODEL,
  modelMappings = DEFAULT_MODEL_MAPPINGS,
  fetchImpl = fetch,
  upstreamTimeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
  rateLimitMax = DEFAULT_RATE_LIMIT_MAX,
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  debug = false,
  logger = true,
} = {}) {
  const fastify = Fastify({
    logger,
  });
  const requestTimeoutMs = upstreamTimeoutConfig(upstreamTimeoutMs);
  const requestRateLimitMax = positiveIntegerConfig(
    rateLimitMax,
    DEFAULT_RATE_LIMIT_MAX,
    MAX_RATE_LIMIT_MAX
  );
  const requestRateLimitWindowMs = positiveIntegerConfig(
    rateLimitWindowMs,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    MAX_RATE_LIMIT_WINDOW_MS
  );

  fastify.register(rateLimit, {
    global: false,
    max: requestRateLimitMax,
    timeWindow: requestRateLimitWindowMs,
  });

  async function handleMessages(request, reply) {
    try {
      const authError = validateProxyAuthorization(request.headers, proxyApiKey);
      if (authError) {
        reply.code(authError.statusCode);
        return { error: authError.error };
      }

      const upstreamKeyError = validateUpstreamApiKey(apiKey);
      if (upstreamKeyError) {
        reply.code(upstreamKeyError.statusCode);
        return { error: upstreamKeyError.error };
      }

      const poePayload = buildPoePayload(request.body, defaultModel, modelMappings);
      debugLog(debug, "Poe payload:", poePayload);

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      const poeResponse = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(poePayload),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (!poeResponse.ok) {
        const errorDetails = await readUpstreamErrorDetails(poeResponse);
        console.error(
          `Poe API Error: ${poeResponse.status} ${poeResponse.statusText}`
        );
        console.error(`Error details: ${errorDetails}`);
        console.error(`Request model: ${poePayload.model}`);
        console.error(`Request URL: ${baseUrl}/v1/chat/completions`);
        reply.code(poeResponse.status);
        return { error: errorDetails };
      }

      if (!poePayload.stream) {
        const data = await poeResponse.json();
        debugLog(debug, "Poe response:", data);
        return buildAnthropicResponse(data, poePayload);
      }

      let isSucceeded = false;
      function sendSuccessMessage() {
        if (isSucceeded) return;
        isSucceeded = true;

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const messageId = "msg_" + Math.random().toString(36).substr(2, 24);

        sendSSE(reply, "message_start", {
          type: "message_start",
          message: {
            id: messageId,
            type: "message",
            role: "assistant",
            model: poePayload.model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });

        sendSSE(reply, "ping", { type: "ping" });
      }

      let accumulatedContent = "";
      let accumulatedReasoning = "";
      let usage = null;
      let textBlockIndex = null;
      let encounteredToolCall = false;
      let nextContentBlockIndex = 0;
      const pendingToolCalls = new Map();
      const lineDecoder = createSseLineDecoder();
      const reader = poeResponse.body.getReader();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const lines = [];
        if (value) {
          const decodedLines = lineDecoder.push(value);
          debugLog(debug, "Poe response lines:", decodedLines);
          lines.push(...decodedLines);
        }
        if (doneReading) {
          lines.push(...lineDecoder.finish());
        }

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "" || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") {
            sendSuccessMessage();
            if (textBlockIndex !== null) {
              sendSSE(reply, "content_block_stop", {
                type: "content_block_stop",
                index: textBlockIndex,
              });
            }
            for (const toolCall of pendingToolCalls.values()) {
              const contentBlockIndex = nextContentBlockIndex;
              nextContentBlockIndex += 1;
              sendSSE(reply, "content_block_start", {
                type: "content_block_start",
                index: contentBlockIndex,
                content_block: {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: {},
                },
              });
              for (const argumentDelta of toolCall.argumentDeltas) {
                sendSSE(reply, "content_block_delta", {
                  type: "content_block_delta",
                  index: contentBlockIndex,
                  delta: {
                    type: "input_json_delta",
                    partial_json: argumentDelta,
                  },
                });
              }
              sendSSE(reply, "content_block_stop", {
                type: "content_block_stop",
                index: contentBlockIndex,
              });
            }
            sendSSE(reply, "message_delta", {
              type: "message_delta",
              delta: {
                stop_reason: encounteredToolCall ? "tool_use" : "end_turn",
                stop_sequence: null,
              },
              usage: usage
                ? { output_tokens: usage.completion_tokens }
                : {
                    output_tokens:
                      estimateTokens(accumulatedContent) +
                      estimateTokens(accumulatedReasoning),
                  },
            });
            sendSSE(reply, "message_stop", {
              type: "message_stop",
            });
            reply.raw.end();
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch (err) {
            debugLog(debug, "Failed to parse JSON:", dataStr);
            continue;
          }
          if (parsed.error) {
            throw new Error(parsed.error.message);
          }
          sendSuccessMessage();
          if (parsed.usage) {
            usage = parsed.usage;
          }
          const delta = parsed.choices[0].delta;
          if (delta && delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              encounteredToolCall = true;
              const upstreamIndex = toolCall.index;
              const functionDelta = toolCall.function || {};
              if (!pendingToolCalls.has(upstreamIndex)) {
                pendingToolCalls.set(upstreamIndex, {
                  id: toolCall.id,
                  name: functionDelta.name,
                  argumentDeltas: [],
                });
              }
              const pendingToolCall = pendingToolCalls.get(upstreamIndex);
              if (toolCall.id) pendingToolCall.id = toolCall.id;
              if (functionDelta.name) pendingToolCall.name = functionDelta.name;
              const argumentDelta = functionDelta.arguments || "";
              if (argumentDelta) {
                pendingToolCall.argumentDeltas.push(argumentDelta);
              }
            }
          } else if (delta && delta.content) {
            if (textBlockIndex === null) {
              textBlockIndex = nextContentBlockIndex;
              nextContentBlockIndex += 1;
              sendSSE(reply, "content_block_start", {
                type: "content_block_start",
                index: textBlockIndex,
                content_block: {
                  type: "text",
                  text: "",
                },
              });
            }
            accumulatedContent += delta.content;
            sendSSE(reply, "content_block_delta", {
              type: "content_block_delta",
              index: textBlockIndex,
              delta: {
                type: "text_delta",
                text: delta.content,
              },
            });
          } else if (delta && delta.reasoning) {
            if (textBlockIndex === null) {
              textBlockIndex = nextContentBlockIndex;
              nextContentBlockIndex += 1;
              sendSSE(reply, "content_block_start", {
                type: "content_block_start",
                index: textBlockIndex,
                content_block: {
                  type: "text",
                  text: "",
                },
              });
            }
            accumulatedReasoning += delta.reasoning;
            sendSSE(reply, "content_block_delta", {
              type: "content_block_delta",
              index: textBlockIndex,
              delta: {
                type: "thinking_delta",
                thinking: delta.reasoning,
              },
            });
          }
        }
      }

      reply.raw.end();
    } catch (err) {
      if (isUpstreamTimeoutError(err)) {
        console.error("Poe upstream request timed out");
        if (reply.raw.headersSent) {
          reply.raw.end();
          return;
        }
        reply.code(504);
        return { error: "Poe upstream request timed out" };
      }
      console.error(INTERNAL_PROXY_LOG);
      if (reply.raw.headersSent) {
        reply.raw.end();
        return;
      }
      reply.code(500);
      return { error: INTERNAL_PROXY_ERROR };
    }
  }

  fastify.after(() => {
    fastify.post(
      "/v1/messages",
      {
        config: {
          rateLimit: {
            max: requestRateLimitMax,
            timeWindow: requestRateLimitWindowMs,
          },
        },
      },
      handleMessages
    );
  });

  return fastify;
}

export async function start(env = process.env) {
  const config = loadConfig(env);
  if (!config.apiKey) {
    printMissingApiKeyHelp();
    process.exit(1);
  }
  if (!config.proxyApiKey) {
    printMissingProxyApiKeyHelp();
    process.exit(1);
  }

  const fastify = createServer(config);
  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(
      `Poe-Anthropic bridge listening on ${config.host}:${config.port}`
    );
    console.log(`Using Poe API at: ${config.baseUrl}`);
    console.log(`Default model: ${config.defaultModel}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMainModule()) {
  start();
}
