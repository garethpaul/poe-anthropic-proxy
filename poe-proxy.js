#!/usr/bin/env node
import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DEFAULT_BASE_URL = "https://api.poe.com";
const DEFAULT_MODEL = "GPT-4.1";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;

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

export function loadConfig(env = process.env) {
  return {
    baseUrl: configValue(env.POE_BASE_URL, DEFAULT_BASE_URL),
    apiKey: optionalConfigValue(env.POE_API_KEY),
    proxyApiKey: optionalConfigValue(env.POE_PROXY_API_KEY),
    defaultModel: configValue(env.POE_MODEL, DEFAULT_MODEL),
    host: configValue(env.HOST, DEFAULT_HOST),
    port: configValue(env.PORT, DEFAULT_PORT),
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

function sendSSE(reply, event, data) {
  const sseMessage = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  reply.raw.write(sseMessage);
  if (typeof reply.raw.flush === "function") {
    reply.raw.flush();
  }
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

export function mapModelName(modelName) {
  const modelMappings = {
    "claude-sonnet-4-20250514": "Claude-Sonnet-4",
    "claude-3-5-sonnet-20241022": "Claude-Sonnet-3.5",
    "claude-3-5-sonnet-20240620": "Claude-Sonnet-3.5",
    "claude-3-5-haiku-20241022": "Claude-Haiku-3.5",
    "claude-3-opus-20240229": "Claude-Opus-3",
    "claude-3-sonnet-20240229": "Claude-Sonnet-3",
    "claude-3-haiku-20240307": "Claude-Haiku-3",
  };

  return modelMappings[modelName] || modelName;
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

export function buildPoeTools(tools = []) {
  return tools
    .filter((tool) => !["BatchTool"].includes(tool.name))
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: removeUriFormat(tool.input_schema),
      },
    }));
}

export function buildPoePayload(payload = {}, defaultModel = DEFAULT_MODEL) {
  const messages = buildPoeMessages(payload);
  const tools = buildPoeTools(payload.tools || []);
  const poePayload = {
    model: mapModelName(payload.model || defaultModel),
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
        input: JSON.parse(toolCall.function.arguments),
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
  fetchImpl = fetch,
  debug = false,
  logger = true,
} = {}) {
  const fastify = Fastify({
    logger,
  });

  fastify.post("/v1/messages", async (request, reply) => {
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

      const poePayload = buildPoePayload(request.body, defaultModel);
      debugLog(debug, "Poe payload:", poePayload);

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      const poeResponse = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(poePayload),
      });

      if (!poeResponse.ok) {
        const errorDetails = await poeResponse.text();
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
      let textBlockStarted = false;
      let encounteredToolCall = false;
      const toolCallAccumulators = {};
      const decoder = new TextDecoder("utf-8");
      const reader = poeResponse.body.getReader();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          debugLog(debug, "Poe response chunk:", chunk);
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "" || !trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") {
              if (encounteredToolCall) {
                for (const idx in toolCallAccumulators) {
                  sendSSE(reply, "content_block_stop", {
                    type: "content_block_stop",
                    index: parseInt(idx, 10),
                  });
                }
              } else if (textBlockStarted) {
                sendSSE(reply, "content_block_stop", {
                  type: "content_block_stop",
                  index: 0,
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
                const idx = toolCall.index;
                const functionDelta = toolCall.function || {};
                if (toolCallAccumulators[idx] === undefined) {
                  toolCallAccumulators[idx] = "";
                  sendSSE(reply, "content_block_start", {
                    type: "content_block_start",
                    index: idx,
                    content_block: {
                      type: "tool_use",
                      id: toolCall.id,
                      name: functionDelta.name,
                      input: {},
                    },
                  });
                }
                const newArgs = functionDelta.arguments || "";
                const oldArgs = toolCallAccumulators[idx];
                if (newArgs.length > oldArgs.length) {
                  const deltaText = newArgs.substring(oldArgs.length);
                  sendSSE(reply, "content_block_delta", {
                    type: "content_block_delta",
                    index: idx,
                    delta: {
                      type: "input_json_delta",
                      partial_json: deltaText,
                    },
                  });
                  toolCallAccumulators[idx] = newArgs;
                }
              }
            } else if (delta && delta.content) {
              if (!textBlockStarted) {
                textBlockStarted = true;
                sendSSE(reply, "content_block_start", {
                  type: "content_block_start",
                  index: 0,
                  content_block: {
                    type: "text",
                    text: "",
                  },
                });
              }
              accumulatedContent += delta.content;
              sendSSE(reply, "content_block_delta", {
                type: "content_block_delta",
                index: 0,
                delta: {
                  type: "text_delta",
                  text: delta.content,
                },
              });
            } else if (delta && delta.reasoning) {
              if (!textBlockStarted) {
                textBlockStarted = true;
                sendSSE(reply, "content_block_start", {
                  type: "content_block_start",
                  index: 0,
                  content_block: {
                    type: "text",
                    text: "",
                  },
                });
              }
              accumulatedReasoning += delta.reasoning;
              sendSSE(reply, "content_block_delta", {
                type: "content_block_delta",
                index: 0,
                delta: {
                  type: "thinking_delta",
                  thinking: delta.reasoning,
                },
              });
            }
          }
        }
      }

      reply.raw.end();
    } catch (err) {
      console.error(err);
      reply.code(500);
      return { error: err.message };
    }
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
