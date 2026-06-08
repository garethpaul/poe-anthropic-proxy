import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnthropicResponse,
  buildPoeMessages,
  buildPoePayload,
  createServer,
  isDebugEnabled,
  isProxyRequestAuthorized,
  loadConfig,
  mapModelName,
  mapStopReason,
  removeUriFormat,
} from "../poe-proxy.js";

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

test("loadConfig reads separate upstream and proxy authentication tokens", () => {
  const config = loadConfig({
    POE_API_KEY: "poe-test-key",
    PROXY_AUTH_TOKEN: "proxy-test-token",
    ALLOW_UNAUTHENTICATED_PROXY: "false",
    POE_MODEL: "Claude-Sonnet-4",
    PORT: "3333",
  });

  assert.equal(config.apiKey, "poe-test-key");
  assert.equal(config.proxyAuthToken, "proxy-test-token");
  assert.equal(config.allowUnauthenticated, false);
  assert.equal(config.defaultModel, "Claude-Sonnet-4");
  assert.equal(config.port, "3333");
});

test("isProxyRequestAuthorized validates bearer tokens in constant time", () => {
  assert.equal(
    isProxyRequestAuthorized(
      { headers: { authorization: "Bearer proxy-test-token" } },
      "proxy-test-token"
    ),
    true
  );
  assert.equal(
    isProxyRequestAuthorized(
      { headers: { authorization: "Bearer wrong-token" } },
      "proxy-test-token"
    ),
    false
  );
  assert.equal(
    isProxyRequestAuthorized({ headers: {} }, "proxy-test-token"),
    false
  );
  assert.equal(isProxyRequestAuthorized({ headers: {} }, undefined, true), true);
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
    proxyAuthToken: "proxy-test-token",
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
        authorization: "Bearer proxy-test-token",
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

test("createServer rejects unauthenticated proxy requests before calling Poe", async () => {
  let fetchCalled = false;
  const server = createServer({
    apiKey: "test-key",
    proxyAuthToken: "proxy-test-token",
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
      payload: {
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 25,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(
      response.headers["www-authenticate"],
      'Bearer realm="poe-anthropic-proxy"'
    );
    assert.deepEqual(response.json(), { error: "Unauthorized" });
    assert.equal(fetchCalled, false);
  } finally {
    await server.close();
  }
});
