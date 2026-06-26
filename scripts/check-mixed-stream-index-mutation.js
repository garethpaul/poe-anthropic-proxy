#!/usr/bin/env node
"use strict";

import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "poe-mixed-stream-mutation-"));

try {
  mkdirSync(path.join(temporaryRoot, "test"));
  symlinkSync(path.join(root, "node_modules"), path.join(temporaryRoot, "node_modules"));
  writeFileSync(
    path.join(temporaryRoot, "package.json"),
    JSON.stringify({ type: "module" })
  );

  const source = readFileSync(path.join(root, "poe-proxy.js"), "utf8");
  const mutated = source.replace(
    "index: contentBlockIndex,",
    "index: upstreamIndex,"
  );
  if (mutated === source) {
    throw new Error("mixed-stream index mutation target was not found");
  }

  writeFileSync(path.join(temporaryRoot, "poe-proxy.js"), mutated);
  writeFileSync(
    path.join(temporaryRoot, "test", "poe-proxy.test.js"),
    readFileSync(path.join(root, "test", "poe-proxy.test.js"), "utf8")
  );

  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-name-pattern=assigns unique Anthropic indexes",
      "test/poe-proxy.test.js",
    ],
    { cwd: temporaryRoot, encoding: "utf8" }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (
    result.status === 0 ||
    !output.includes("assigns unique Anthropic indexes")
  ) {
    throw new Error("mixed-stream regression did not reject the index mutation");
  }

  console.log("Mixed-stream index mutation rejected.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
