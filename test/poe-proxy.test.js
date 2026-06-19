import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_MODEL_MAPPINGS,
  buildAnthropicResponse,
  buildPoeMessages,
  buildPoePayload,
  createSseLineDecoder,
  createServer,
  isDebugEnabled,
  loadConfig,
  mapModelName,
  mapStopReason,
  parseModelMappings,
  removeUriFormat,
} from "../poe-proxy.js";

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

async function withMutedConsoleError(callback) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = originalError;
  }
}

test("createSseLineDecoder preserves split JSON, UTF-8, and final lines", () => {
  const decoder = createSseLineDecoder();
  const encoded = new TextEncoder().encode(
    'data: {"choices":[{"delta":{"content":"café"}}]}\n\ndata: [DONE]'
  );
  const splitIndex = encoded.indexOf(0xc3) + 1;

  assert.deepEqual(decoder.push(encoded.slice(0, splitIndex)), []);
  assert.deepEqual(decoder.push(encoded.slice(splitIndex)), [
    'data: {"choices":[{"delta":{"content":"café"}}]}',
    "",
  ]);
  assert.deepEqual(decoder.finish(), ["data: [DONE]"]);
  assert.deepEqual(decoder.finish(), []);
});

test("buildPoeMessages converts Anthropic messages to Poe chat messages", () => {
  const messages = buildPoeMessages({
    system: [{ text: "Be concise." }, { content: [{ text: "Use tools." }] }],
    messages: [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "lookup_weather",
            input: { city: "San Francisco" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_1",
            content: [{ type: "text", text: "Clear skies" }],
          },
        ],
      },
    ],
  });

  assert.deepEqual(messages, [
    { role: "system", content: "Be concise." },
    { role: "system", content: "Use tools." },
    { role: "user", content: "Hello" },
    {
      role: "assistant",
      tool_calls: [
        {
          id: "toolu_1",
          type: "function",
          function: {
            name: "lookup_weather",
            arguments: JSON.stringify({ city: "San Francisco" }),
          },
        },
      ],
    },
    {
      role: "tool",
      content: "Clear skies",
      tool_call_id: "toolu_1",
    },
  ]);
  assert.equal(
    buildPoeMessages({ messages: [{ role: "user", content: [] }] }).length,
    0
  );
});

test("buildPoeMessages accepts string system prompts", () => {
  assert.deepEqual(
    buildPoeMessages({
      system: "Prefer short answers.",
      messages: [{ role: "user", content: "Hello" }],
    }),
    [
      { role: "system", content: "Prefer short answers." },
      { role: "user", content: "Hello" },
    ]
  );
});

test("buildPoePayload maps model, defaults, tools, and stream flags", () => {
  const inputSchema = {
    type: "object",
    properties: {
      url: { type: "string", format: "uri" },
      nested: {
        type: "array",
        items: { type: "string", format: "uri" },
      },
    },
    anyOf: [{ type: "string", format: "uri" }],
  };

  const payload = buildPoePayload(
    {
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 100,
      temperature: 0,
      stream: true,
      tools: [
        {
          name: "fetch_url",
          description: "Fetch a URL",
          input_schema: inputSchema,
        },
        { name: "BatchTool", input_schema: { type: "object" } },
      ],
    },
    "Fallback"
  );

  assert.equal(payload.model, "Claude-Sonnet-4");
  assert.equal(payload.max_tokens, 100);
  assert.equal(payload.temperature, 0);
  assert.equal(payload.stream, true);
  assert.equal(payload.tools.length, 1);
  assert.deepEqual(payload.tools[0].function.parameters, {
    type: "object",
    properties: {
      url: { type: "string" },
      nested: {
        type: "array",
        items: { type: "string" },
      },
    },
    anyOf: [{ type: "string" }],
  });
  assert.equal(inputSchema.properties.url.format, "uri");
});

test("buildPoePayload ignores malformed tool definitions", () => {
  const payload = buildPoePayload({
    messages: [{ role: "user", content: "Hello" }],
    tools: [
      null,
      "not-a-tool",
      { name: "BatchTool", input_schema: { type: "object" } },
      { description: "Missing name", input_schema: { type: "object" } },
      { name: "bad tool name", input_schema: { type: "object" } },
      { name: "missing_schema" },
      { name: "array_schema", input_schema: [] },
      {
        name: "lookup_weather",
        description: "Lookup weather",
        input_schema: { type: "object" },
      },
    ],
  });

  assert.equal(payload.tools.length, 1);
  assert.equal(payload.tools[0].function.name, "lookup_weather");
  assert.equal(
    buildPoePayload({
      messages: [{ role: "user", content: "Hello" }],
      tools: { name: "lookup_weather" },
    }).tools,
    undefined
  );
});

test("removeUriFormat handles nested schemas without mutating input", () => {
  const schema = {
    additionalProperties: { type: "string", format: "uri" },
    oneOf: [{ type: "string", format: "uri" }],
  };

  assert.deepEqual(removeUriFormat(schema), {
    additionalProperties: { type: "string" },
    oneOf: [{ type: "string" }],
  });
  assert.equal(schema.additionalProperties.format, "uri");
});

test("model, stop reason, and debug mappings are deterministic", () => {
  assert.equal(mapModelName("claude-3-5-sonnet-20241022"), "Claude-Sonnet-3.5");
  assert.equal(mapModelName("Grok-4"), "Grok-4");
  assert.equal(mapStopReason("length"), "max_tokens");
  assert.equal(mapStopReason("tool_calls"), "tool_use");
  assert.equal(mapStopReason("unknown"), "end_turn");
  assert.equal(isDebugEnabled("false"), false);
  assert.equal(isDebugEnabled("true"), true);
  assert.equal(isDebugEnabled("1"), true);
});

test("custom model mappings override visible defaults and reject invalid config", () => {
  assert.equal(DEFAULT_MODEL_MAPPINGS["claude-sonnet-4-20250514"], "Claude-Sonnet-4");
  const mappings = parseModelMappings(
    '{"claude-sonnet-4-20250514":"Private-Sonnet","custom-model":"Custom-Bot"}'
  );
  assert.equal(mapModelName("claude-sonnet-4-20250514", mappings), "Private-Sonnet");
  assert.equal(mapModelName("custom-model", mappings), "Custom-Bot");
  assert.equal(mapModelName("unknown-model", mappings), "unknown-model");
  for (const invalid of ["[]", '{"model":1}', '{" ":"target"}', '{"__proto__":"target"}']) {
    assert.throws(() => parseModelMappings(invalid), /POE_MODEL_MAPPINGS_JSON/);
  }
  assert.throws(
    () => parseModelMappings(JSON.stringify({ model: "x".repeat(16_384) })),
    /exceeds 16384 bytes/
  );
  assert.throws(
    () => parseModelMappings(JSON.stringify(Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`model-${index}`, `target-${index}`])
    ))),
    /exceeds 100 entries/
  );
});

test("model mapping ignores inherited object properties", () => {
  const modelMappings = parseModelMappings("{}");

  for (const modelName of [
    "toString",
    "valueOf",
    "hasOwnProperty",
    "constructor",
    "__proto__",
  ]) {
    assert.equal(mapModelName(modelName, modelMappings), modelName);
    assert.equal(
      buildPoePayload({ model: modelName, messages: [] }, undefined, modelMappings)
        .model,
      modelName
    );
  }
});

test("loadConfig binds localhost by default and reads proxy auth", () => {
  const config = loadConfig({
    POE_API_KEY: "poe-key",
    POE_PROXY_API_KEY: "proxy-key",
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.proxyApiKey, "proxy-key");
  assert.equal(config.upstreamTimeoutMs, 30000);
  assert.equal(config.rateLimitMax, 60);
  assert.equal(config.rateLimitWindowMs, 60000);
  assert.equal(loadConfig({ HOST: "0.0.0.0" }).host, "0.0.0.0");
  assert.equal(loadConfig({ POE_UPSTREAM_TIMEOUT_MS: " 5000 " }).upstreamTimeoutMs, 5000);
  assert.equal(loadConfig({ POE_UPSTREAM_TIMEOUT_MS: "invalid" }).upstreamTimeoutMs, 30000);
  assert.equal(loadConfig({ POE_UPSTREAM_TIMEOUT_MS: "0" }).upstreamTimeoutMs, 30000);
  assert.equal(loadConfig({ POE_UPSTREAM_TIMEOUT_MS: "300001" }).upstreamTimeoutMs, 30000);
  assert.equal(loadConfig({ POE_RATE_LIMIT_MAX: " 120 " }).rateLimitMax, 120);
  assert.equal(loadConfig({ POE_RATE_LIMIT_MAX: "0" }).rateLimitMax, 60);
  assert.equal(loadConfig({ POE_RATE_LIMIT_MAX: "10001" }).rateLimitMax, 60);
  assert.equal(loadConfig({ POE_RATE_LIMIT_WINDOW_MS: " 5000 " }).rateLimitWindowMs, 5000);
  assert.equal(loadConfig({ POE_RATE_LIMIT_WINDOW_MS: "3600001" }).rateLimitWindowMs, 60000);
});

test("loadConfig trims environment values and ignores blank credentials", () => {
  const config = loadConfig({
    POE_API_KEY: "  poe-key  ",
    POE_PROXY_API_KEY: "   ",
    HOST: " 127.0.0.1 ",
    POE_BASE_URL: " ",
    POE_MODEL: " Claude-Sonnet-4 ",
    POE_MODEL_MAPPINGS_JSON: '{"claude-sonnet-4-20250514":"Private-Sonnet"}',
    PORT: " ",
  });

  assert.equal(config.apiKey, "poe-key");
  assert.equal(config.proxyApiKey, undefined);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.baseUrl, "https://api.poe.com");
  assert.equal(config.defaultModel, "Claude-Sonnet-4");
  assert.equal(config.modelMappings["claude-sonnet-4-20250514"], "Private-Sonnet");
  assert.equal(config.port, 3000);
});

test(".env.example documents required proxy credentials", () => {
  const example = readProjectFile(".env.example");
  for (const name of [
    "POE_API_KEY",
    "POE_PROXY_API_KEY",
    "POE_BASE_URL",
    "POE_MODEL",
    "POE_MODEL_MAPPINGS_JSON",
    "POE_UPSTREAM_TIMEOUT_MS",
    "POE_RATE_LIMIT_MAX",
    "POE_RATE_LIMIT_WINDOW_MS",
    "HOST",
    "PORT",
  ]) {
    assert.match(example, new RegExp(`^${name}=.+$`, "m"));
  }

  assert.match(example, /^HOST=127\.0\.0\.1$/m);
  assert.match(example, /^POE_PROXY_API_KEY=your_private_proxy_token_here$/m);
});

test("repository check wrapper is documented and preserved", () => {
  const pkg = JSON.parse(readProjectFile("package.json"));
  const makefile = readProjectFile("Makefile");
  const readme = readProjectFile("README.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile("docs/plans/2026-06-08-poe-proxy-check-wrapper.md");
  const aliasPlan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-gate-aliases.md"
  );

  assert.equal(pkg.scripts.lint, "node --check poe-proxy.js");
  assert.equal(pkg.scripts.build, "node --check poe-proxy.js");
  assert.equal(
    pkg.scripts.verify,
    "npm run lint && npm test && npm run build && npm run audit"
  );
  assert.match(
    makefile,
    /^override REPO_ROOT := \$\(abspath \$\(dir \$\(lastword \$\(MAKEFILE_LIST\)\)\)\)$/m
  );
  for (const recipe of [
    'cd "$(REPO_ROOT)" && $(NPM) run lint',
    'cd "$(REPO_ROOT)" && $(NPM) test',
    'cd "$(REPO_ROOT)" && $(NPM) run build',
    'cd "$(REPO_ROOT)" && $(NPM) run audit',
    'cd "$(REPO_ROOT)" && $(NPM) run verify',
    'cd "$(REPO_ROOT)" && scripts/check-baseline.sh',
  ]) {
    assert.ok(makefile.includes(`\t${recipe}\n`), recipe);
  }
  assert.match(makefile, /^check: verify$/m);
  assert.match(readme, /make lint/);
  assert.match(readme, /make build/);
  assert.match(readme, /npm run lint/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /make check/);
  assert.match(changes, /make check/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /make check/);
  assert.match(plan, /npm run verify/);
  assert.match(aliasPlan, /status: completed/);
  assert.match(aliasPlan, /make lint/);
  assert.match(aliasPlan, /npm run build/);
});

test("upstream Poe API key route guard is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-upstream-api-key-route-guard.md"
  );

  assert.match(source, /validateUpstreamApiKey/);
  assert.match(source, /POE_API_KEY is not configured/);
  assert.match(readme, /upstream Poe key/);
  assert.match(security, /POE_API_KEY/);
  assert.match(vision, /server-side Poe key/);
  assert.match(changes, /upstream Poe API key/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /POE_API_KEY is not configured/);
  assert.match(plan, /npm test/);
});

test("environment value normalization is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-env-normalization.md"
  );

  assert.match(source, /function configValue/);
  assert.match(source, /\.trim\(\)/);
  assert.match(readme, /blank/i);
  assert.match(security, /blank/i);
  assert.match(vision, /blank/i);
  assert.match(changes, /blank/i);
  assert.match(plan, /status: completed/);
  assert.match(plan, /POE_PROXY_API_KEY/);
});

test("buildAnthropicResponse maps non-streaming Poe text responses", () => {
  const response = buildAnthropicResponse(
    {
      id: "chatcmpl_123",
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "Done",
          },
        },
      ],
      usage: {
        prompt_tokens: 7,
        completion_tokens: 2,
      },
    },
    {
      model: "Claude-Sonnet-4",
      messages: [{ role: "user", content: "Hello" }],
    }
  );

  assert.deepEqual(response, {
    content: [{ text: "Done", type: "text" }],
    id: "msg_123",
    model: "Claude-Sonnet-4",
    role: "assistant",
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      input_tokens: 7,
      output_tokens: 2,
    },
  });
});

test("buildAnthropicResponse rejects malformed non-streaming Poe responses", () => {
  assert.throws(
    () =>
      buildAnthropicResponse(
        {
          id: "chatcmpl_empty",
          choices: [],
        },
        {
          model: "Claude-Sonnet-4",
          messages: [{ role: "user", content: "Hello" }],
        }
      ),
    /Poe response missing choices\[0\]\.message/
  );
});

test("buildAnthropicResponse rejects malformed Poe tool call arguments", () => {
  assert.throws(
    () =>
      buildAnthropicResponse(
        {
          id: "chatcmpl_bad_tool",
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    function: {
                      name: "lookup_weather",
                      arguments: "{not-json",
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          model: "Claude-Sonnet-4",
          messages: [{ role: "user", content: "Hello" }],
        }
      ),
    /Poe tool call arguments must be valid JSON/
  );
});

test("malformed upstream Poe response guard is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-upstream-response-shape.md"
  );

  assert.match(source, /function firstPoeChoice/);
  assert.match(source, /Poe response missing choices\[0\]\.message/);
  assert.match(readme, /malformed non-streaming upstream responses/i);
  assert.match(security, /malformed upstream Poe responses/i);
  assert.match(vision, /malformed upstream response shapes/);
  assert.match(changes, /malformed non-streaming Poe responses/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /Poe response missing choices\[0\]\.message/);
});

test("malformed Poe tool call argument guard is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-tool-call-arguments.md"
  );

  assert.match(source, /function parseToolCallInput/);
  assert.match(source, /Poe tool call arguments must be valid JSON/);
  assert.match(readme, /malformed Poe tool call arguments/i);
  assert.match(security, /malformed Poe tool call arguments/i);
  assert.match(vision, /malformed tool arguments/);
  assert.match(changes, /malformed Poe tool call arguments/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /Poe tool call arguments must be valid JSON/);
});

test("malformed Poe tool definition guard is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-tool-definition-shape.md"
  );

  assert.match(source, /if \(!Array\.isArray\(tools\)\) return \[\]/);
  assert.match(source, /function isValidPoeTool/);
  assert.match(source, /POE_TOOL_NAME_RE/);
  assert.match(source, /!Array\.isArray\(tool\.input_schema\)/);
  assert.match(readme, /malformed Poe tool definitions/i);
  assert.match(readme, /invalid names or schemas/i);
  assert.match(security, /malformed Poe tool definitions/i);
  assert.match(security, /invalid tool names or schemas/i);
  assert.match(vision, /malformed tool definitions/);
  assert.match(vision, /tool names and schemas/);
  assert.match(changes, /malformed Poe tool definitions/);
  assert.match(changes, /invalid Poe tool names or schemas/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /buildPoeTools/);

  const nameSchemaPlan = readProjectFile(
    "docs/plans/2026-06-09-poe-proxy-tool-name-schema-validation.md"
  );
  assert.match(nameSchemaPlan, /status: completed/);
  assert.match(nameSchemaPlan, /input_schema/);
  assert.match(nameSchemaPlan, /npm test/);
});

test("upstream Poe error payload handling is documented and preserved", () => {
  const source = readProjectFile("poe-proxy.js");
  const readme = readProjectFile("README.md");
  const security = readProjectFile("SECURITY.md");
  const vision = readProjectFile("VISION.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile(
    "docs/plans/2026-06-10-poe-proxy-upstream-error-payloads.md"
  );

  assert.match(source, /function readUpstreamErrorDetails/);
  assert.match(source, /Poe upstream request failed/);
  assert.match(readme, /upstream Poe error payloads/i);
  assert.match(security, /upstream Poe error payloads/i);
  assert.match(vision, /upstream error payloads/);
  assert.match(changes, /upstream Poe error payloads/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /Poe upstream request failed/);
});

test("buildAnthropicResponse maps tool calls and fallback usage", () => {
  const response = buildAnthropicResponse(
    {
      id: "chatcmpl_456",
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "lookup_weather",
                  arguments: JSON.stringify({ city: "San Francisco" }),
                },
              },
            ],
          },
        },
      ],
    },
    {
      model: "Claude-Sonnet-4",
      messages: [
        { role: "system", content: "Use tools carefully" },
        { role: "user", content: "weather please" },
      ],
    }
  );

  assert.equal(response.stop_reason, "tool_use");
  assert.equal(response.usage.output_tokens, 0);
  assert.deepEqual(response.content, [
    {
      type: "tool_use",
      id: "call_1",
      name: "lookup_weather",
      input: { city: "San Francisco" },
    },
  ]);
  assert.equal(response.usage.input_tokens, 5);
});

test("createServer handles non-streaming requests with injected fetch", async () => {
  let capturedRequest;
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    baseUrl: "https://example.test",
    defaultModel: "claude-sonnet-4-20250514",
    modelMappings: parseModelMappings(
      '{"claude-sonnet-4-20250514":"Private-Sonnet"}'
    ),
    logger: false,
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        async json() {
          return {
            id: "chatcmpl_route",
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "Hello from Poe",
                },
              },
            ],
            usage: {
              prompt_tokens: 3,
              completion_tokens: 3,
            },
          };
        },
      };
    },
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: {
        authorization: "Bearer proxy-key",
      },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 25,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(capturedRequest.url, "https://example.test/v1/chat/completions");
    assert.equal(capturedRequest.options.headers.Authorization, "Bearer test-key");
    assert.ok(capturedRequest.options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(capturedRequest.options.body), {
      model: "Private-Sonnet",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 25,
      temperature: 1,
      stream: false,
    });
    assert.deepEqual(response.json().content, [
      { text: "Hello from Poe", type: "text" },
    ]);
  } finally {
    await server.close();
  }
});

test("createServer rate limits requests before additional upstream work", async () => {
  let fetchCalls = 0;
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    rateLimitMax: 1,
    rateLimitWindowMs: 60_000,
    logger: false,
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                finish_reason: "stop",
                message: { role: "assistant", content: "first response" },
              },
            ],
          };
        },
      };
    },
  });

  const request = {
    method: "POST",
    url: "/v1/messages",
    headers: { authorization: "Bearer proxy-key" },
    payload: { messages: [{ role: "user", content: "Hello" }] },
  };

  try {
    const first = await server.inject(request);
    const limited = await server.inject(request);

    assert.equal(first.statusCode, 200);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers["retry-after"], "60");
    assert.equal(fetchCalls, 1);
  } finally {
    await server.close();
  }
});

test("createServer preserves streamed SSE data split across byte chunks", async () => {
  const encoded = new TextEncoder().encode(
    'data: {"choices":[{"delta":{"content":"café"}}]}\n\ndata: [DONE]'
  );
  const splitIndex = encoded.indexOf(0xc3) + 1;
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoded.slice(0, splitIndex));
          controller.enqueue(encoded.slice(splitIndex));
          controller.close();
        },
      }),
    }),
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: {
        authorization: "Bearer proxy-key",
      },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /event: message_start/);
    assert.match(response.body, /"text":"café"/);
    assert.match(response.body, /event: message_stop/);
  } finally {
    await server.close();
  }
});

test("createServer preserves streamed tool argument delta fragments", async () => {
  const encoded = new TextEncoder().encode(
    [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"weather","arguments":"{\\"city\\""}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"Paris\\"}"}}]}}]}',
      "data: [DONE]",
    ].join("\n\n")
  );
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      }),
    }),
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: { authorization: "Bearer proxy-key" },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
    });

    assert.equal(response.statusCode, 200);
    const argumentDeltas = response.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)))
      .filter((event) => event.type === "content_block_delta")
      .map((event) => event.delta.partial_json);
    assert.deepEqual(argumentDeltas, ['{"city"', ':"Paris"}']);
    assert.equal(argumentDeltas.join(""), '{"city":"Paris"}');
    assert.match(response.body, /event: message_stop/);
  } finally {
    await server.close();
  }
});

test("createServer returns a stable gateway timeout for stalled Poe requests", async () => {
  let capturedSignal;
  const loggedErrors = [];
  const originalConsoleError = console.error;
  const timeoutError = new Error("private upstream timeout detail");
  timeoutError.name = "TimeoutError";
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    upstreamTimeoutMs: 5000,
    fetchImpl: async (url, options) => {
      capturedSignal = options.signal;
      throw timeoutError;
    },
  });

  try {
    console.error = (...args) => loggedErrors.push(args.join(" "));
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: {
        authorization: "Bearer proxy-key",
      },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });

    assert.ok(capturedSignal instanceof AbortSignal);
    assert.equal(response.statusCode, 504);
    assert.deepEqual(response.json(), {
      error: "Poe upstream request timed out",
    });
    assert.doesNotMatch(response.body, /private upstream timeout detail/);
    assert.deepEqual(loggedErrors, ["Poe upstream request timed out"]);
  } finally {
    console.error = originalConsoleError;
    await server.close();
  }
});

test("createServer redacts unexpected internal errors from clients", async (t) => {
  const privateDetail =
    "private endpoint https://user:secret@example.test failed";
  const loggedErrors = [];
  t.mock.method(console, "error", (...args) => loggedErrors.push(args));
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => {
      throw new Error(privateDetail);
    },
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: { authorization: "Bearer proxy-key" },
      payload: { messages: [{ role: "user", content: "Hello" }] },
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), { error: "Internal proxy error" });
    assert.equal(response.body.includes(privateDetail), false);
    assert.deepEqual(loggedErrors, [["Unexpected internal proxy failure"]]);
    assert.equal(JSON.stringify(loggedErrors).includes(privateDetail), false);
  } finally {
    await server.close();
  }
});

test("createServer ends failed streams without exposing internal errors", async (t) => {
  const privateDetail = "private stream diagnostic secret";
  const encodedEvent = new TextEncoder().encode(
    'data: {"choices":[{"delta":{"content":"hello"}}]}\n'
  );
  let reads = 0;
  const loggedErrors = [];
  t.mock.method(console, "error", (...args) => loggedErrors.push(args));
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            reads += 1;
            if (reads === 1) return { value: encodedEvent, done: false };
            throw new Error(privateDetail);
          },
        }),
      },
    }),
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: { authorization: "Bearer proxy-key" },
      payload: {
        stream: true,
        messages: [{ role: "user", content: "Hello" }],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /event: message_start/);
    assert.equal(response.body.includes(privateDetail), false);
    assert.equal(response.body.includes("Internal proxy error"), false);
    assert.deepEqual(loggedErrors, [["Unexpected internal proxy failure"]]);
    assert.equal(JSON.stringify(loggedErrors).includes(privateDetail), false);
  } finally {
    await server.close();
  }
});

test("createServer returns upstream Poe error payloads with upstream status", async () => {
  let jsonCalled = false;
  const upstreamError = JSON.stringify({ error: { message: "rate limited" } });
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    baseUrl: "https://example.test",
    logger: false,
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      async text() {
        return upstreamError;
      },
      async json() {
        jsonCalled = true;
        throw new Error("json should not be called");
      },
    }),
  });

  try {
    const response = await withMutedConsoleError(() =>
      server.inject({
        method: "POST",
        url: "/v1/messages",
        headers: {
          authorization: "Bearer proxy-key",
        },
        payload: {
          messages: [{ role: "user", content: "Hello" }],
        },
      })
    );

    assert.equal(response.statusCode, 429);
    assert.deepEqual(response.json(), { error: upstreamError });
    assert.equal(jsonCalled, false);
  } finally {
    await server.close();
  }
});

test("createServer returns a useful fallback for empty upstream Poe errors", async () => {
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      async text() {
        return "";
      },
    }),
  });

  try {
    const response = await withMutedConsoleError(() =>
      server.inject({
        method: "POST",
        url: "/v1/messages",
        headers: {
          authorization: "Bearer proxy-key",
        },
        payload: {
          messages: [{ role: "user", content: "Hello" }],
        },
      })
    );

    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), {
      error: "Poe upstream request failed with 502 Bad Gateway",
    });
  } finally {
    await server.close();
  }
});

test("createServer rejects unauthenticated requests before upstream fetch", async () => {
  let fetchCalled = false;
  const server = createServer({
    apiKey: "test-key",
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    },
  });

  try {
    const missing = await server.inject({
      method: "POST",
      url: "/v1/messages",
      payload: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });
    const invalid = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: {
        authorization: "Bearer wrong-key",
      },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });

    assert.equal(missing.statusCode, 401);
    assert.equal(invalid.statusCode, 403);
    assert.equal(fetchCalled, false);
  } finally {
    await server.close();
  }
});

test("createServer rejects missing upstream Poe key before upstream fetch", async () => {
  let fetchCalled = false;
  const server = createServer({
    proxyApiKey: "proxy-key",
    logger: false,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    },
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/messages",
      headers: {
        authorization: "Bearer proxy-key",
      },
      payload: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: "POE_API_KEY is not configured",
    });
    assert.equal(fetchCalled, false);
  } finally {
    await server.close();
  }
});
