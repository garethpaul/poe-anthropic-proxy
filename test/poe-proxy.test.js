import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildAnthropicResponse,
  buildPoeMessages,
  buildPoePayload,
  createServer,
  isDebugEnabled,
  loadConfig,
  mapModelName,
  mapStopReason,
  removeUriFormat,
} from "../poe-proxy.js";

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

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

test("loadConfig binds localhost by default and reads proxy auth", () => {
  const config = loadConfig({
    POE_API_KEY: "poe-key",
    POE_PROXY_API_KEY: "proxy-key",
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.proxyApiKey, "proxy-key");
  assert.equal(loadConfig({ HOST: "0.0.0.0" }).host, "0.0.0.0");
});

test("loadConfig trims environment values and ignores blank credentials", () => {
  const config = loadConfig({
    POE_API_KEY: "  poe-key  ",
    POE_PROXY_API_KEY: "   ",
    HOST: " 127.0.0.1 ",
    POE_BASE_URL: " ",
    POE_MODEL: " Claude-Sonnet-4 ",
    PORT: " ",
  });

  assert.equal(config.apiKey, "poe-key");
  assert.equal(config.proxyApiKey, undefined);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.baseUrl, "https://api.poe.com");
  assert.equal(config.defaultModel, "Claude-Sonnet-4");
  assert.equal(config.port, 3000);
});

test(".env.example documents required proxy credentials", () => {
  const example = readProjectFile(".env.example");
  for (const name of [
    "POE_API_KEY",
    "POE_PROXY_API_KEY",
    "POE_BASE_URL",
    "POE_MODEL",
    "HOST",
    "PORT",
  ]) {
    assert.match(example, new RegExp(`^${name}=.+$`, "m"));
  }

  assert.match(example, /^HOST=127\.0\.0\.1$/m);
  assert.match(example, /^POE_PROXY_API_KEY=your_private_proxy_token_here$/m);
});

test("repository check wrapper is documented and preserved", () => {
  const makefile = readProjectFile("Makefile");
  const readme = readProjectFile("README.md");
  const changes = readProjectFile("CHANGES.md");
  const plan = readProjectFile("docs/plans/2026-06-08-poe-proxy-check-wrapper.md");

  assert.match(makefile, /^check: verify$/m);
  assert.match(makefile, /\$\(NPM\) run verify/);
  assert.match(readme, /make check/);
  assert.match(changes, /make check/);
  assert.match(plan, /status: completed/);
  assert.match(plan, /make check/);
  assert.match(plan, /npm run verify/);
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
    assert.deepEqual(JSON.parse(capturedRequest.options.body), {
      model: "Claude-Sonnet-4",
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
