#!/usr/bin/env node
"use strict";

import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
  "audit",
  "build",
  "check",
  "lint",
  "root-test",
  "test",
  "verify",
];
const ATTACKER_ROOT = "/tmp/poe-proxy-attacker-root";
const ATTACKER_NPM = "/tmp/poe-proxy-attacker-npm";

function runMake(makefile, target, args = [], environment = process.env) {
  return spawnSync(
    "make",
    ["--no-print-directory", "--dry-run", "--file", makefile, ...args, target],
    {
      cwd: path.dirname(path.dirname(makefile)),
      env: environment,
      encoding: "utf8",
    },
  );
}

function output(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "Poe proxy's [gate] "));
const checkout = path.join(temporaryRoot, "exact head");
mkdirSync(checkout);
const makefile = path.join(checkout, "Makefile");
copyFileSync(path.join(ROOT, "Makefile"), makefile);

const scenarios = [
  ["default", [], process.env],
  ["command REPO_ROOT override", [`REPO_ROOT=${ATTACKER_ROOT}`], process.env],
  ["environment REPO_ROOT override", [], { ...process.env, REPO_ROOT: ATTACKER_ROOT }],
  ["command NPM override", [`NPM=${ATTACKER_NPM}`], process.env],
  ["environment NPM override", [], { ...process.env, NPM: ATTACKER_NPM }],
];

for (const [scenario, args, environment] of scenarios) {
  for (const target of TARGETS) {
    const result = runMake(makefile, target, args, environment);
    const combined = output(result);
    assert.equal(result.status, 0, `${scenario} ${target} failed:\n${combined}`);
    assert.ok(combined.includes(checkout), `${scenario} ${target} missed ${checkout}`);
    assert.ok(!combined.includes(ATTACKER_ROOT), `${scenario} ${target} used attacker root`);
    assert.ok(!combined.includes(ATTACKER_NPM), `${scenario} ${target} used attacker npm`);
  }
}

for (const [scenario, args, environment] of [
  ["command MAKEFILE_LIST override", ["MAKEFILE_LIST=/tmp/untrusted"], process.env],
  [
    "environment MAKEFILE_LIST override",
    ["--environment-overrides"],
    { ...process.env, MAKEFILE_LIST: "/tmp/untrusted" },
  ],
]) {
  const result = runMake(makefile, "check", args, environment);
  const combined = output(result);
  assert.notEqual(result.status, 0, `${scenario} unexpectedly passed`);
  assert.ok(
    combined.includes("MAKEFILE_LIST must not be overridden"),
    `${scenario} did not fail closed:\n${combined}`,
  );
}

console.log(
  "Makefile root tests passed: 35 target/override cases and " +
    "2 MAKEFILE_LIST rejection cases",
);
