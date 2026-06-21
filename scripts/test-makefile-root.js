#!/usr/bin/env node
"use strict";

import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const ATTACKER_NODE = "/tmp/poe-proxy-attacker-node";

function writeExecutable(filePath, contents) {
  writeFileSync(filePath, contents);
  chmodSync(filePath, 0o755);
}

function makeEnvironment(fakeBin, commandLog, extra = {}) {
  const environment = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    POE_PROXY_COMMAND_LOG: commandLog,
  };
  delete environment.MAKEFILES;
  delete environment.MAKEFILE_LIST;
  Object.assign(environment, extra);
  return environment;
}

function runMake(makefiles, target, args, environment, workingDirectory) {
  const makefileArguments = makefiles.flatMap((makefile) => ["--file", makefile]);
  return spawnSync(
    "make",
    ["--no-print-directory", ...makefileArguments, ...args, target],
    {
      cwd: workingDirectory,
      env: environment,
      encoding: "utf8",
    },
  );
}

function combinedOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "poe-proxy-root-control-"));
const controlDirectory = path.join(temporaryRoot, "control");
const checkoutPath = path.join(
  temporaryRoot,
  "Poe proxy's [gate] \"quoted\" `touch POE_PROXY_BACKTICK_MARKER`",
);
const fakeBin = path.join(temporaryRoot, "fake-bin");
const commandLog = path.join(temporaryRoot, "commands.log");
const fakeShellLog = path.join(temporaryRoot, "fake-shell.log");

try {
  mkdirSync(controlDirectory);
  mkdirSync(checkoutPath);
  const checkout = realpathSync(checkoutPath);
  const makefile = path.join(checkout, "Makefile");
  mkdirSync(fakeBin);
  mkdirSync(path.join(checkout, "scripts"));
  copyFileSync(path.join(ROOT, "Makefile"), makefile);

  const logger =
    "#!/bin/sh\n" +
    "printf '%s|%s\\n' \"$PWD\" \"$*\" >> \"$POE_PROXY_COMMAND_LOG\"\n";
  writeExecutable(path.join(fakeBin, "npm"), logger);
  writeExecutable(path.join(fakeBin, "node"), logger);
  writeExecutable(path.join(checkout, "scripts", "check-baseline.sh"), logger);
  const fakeShell = path.join(temporaryRoot, "fake-shell");
  writeExecutable(
    fakeShell,
    `#!/bin/sh\nprintf '%s\\n' invoked >> '${fakeShellLog}'\nexec /bin/sh "$@"\n`,
  );

  const scenarios = [
    ["default", [], {}],
    ["command REPO_ROOT override", [`REPO_ROOT=${ATTACKER_ROOT}`], {}],
    ["environment REPO_ROOT override", [], { REPO_ROOT: ATTACKER_ROOT }],
    ["command NPM override", [`NPM=${ATTACKER_NPM}`], {}],
    ["environment NPM override", [], { NPM: ATTACKER_NPM }],
    ["command NODE override", [`NODE=${ATTACKER_NODE}`], {}],
    ["environment NODE override", [], { NODE: ATTACKER_NODE }],
    ["command SHELL override", [`SHELL=${fakeShell}`], {}],
    ["environment SHELL override", [], { SHELL: fakeShell }],
    ["command .SHELLFLAGS override", [".SHELLFLAGS=-eu -c"], {}],
    ["environment .SHELLFLAGS override", [], { ".SHELLFLAGS": "-eu -c" }],
  ];

  for (const [scenario, args, extraEnvironment] of scenarios) {
    for (const target of TARGETS) {
      rmSync(commandLog, { force: true });
      const result = runMake(
        [makefile],
        target,
        args,
        makeEnvironment(fakeBin, commandLog, extraEnvironment),
        controlDirectory,
      );
      const output = combinedOutput(result);
      assert.equal(result.status, 0, `${scenario} ${target} failed:\n${output}`);
      assert.ok(existsSync(commandLog), `${scenario} ${target} executed no quality command`);
      const commands = readFileSync(commandLog, "utf8").trim().split("\n");
      assert.ok(
        commands.every((command) => command.startsWith(`${checkout}|`)),
        `${scenario} ${target} escaped the checkout:\n${commands.join("\n")}`,
      );
    }
  }

  for (const marker of ["POE_PROXY_BACKTICK_MARKER"]) {
    assert.ok(
      !existsSync(path.join(controlDirectory, marker)),
      `${marker} proved checkout-path command execution`,
    );
  }
  assert.ok(!existsSync(fakeShellLog), "caller-controlled SHELL was executed");

  for (const [scenario, args, environment] of [
    [
      "command MAKEFILE_LIST override",
      ["MAKEFILE_LIST=/tmp/untrusted"],
      makeEnvironment(fakeBin, commandLog),
    ],
    [
      "environment MAKEFILE_LIST override",
      ["--environment-overrides"],
      makeEnvironment(fakeBin, commandLog, { MAKEFILE_LIST: "/tmp/untrusted" }),
    ],
  ]) {
    const result = runMake([makefile], "check", args, environment, controlDirectory);
    const output = combinedOutput(result);
    assert.notEqual(result.status, 0, `${scenario} unexpectedly passed`);
    assert.ok(
      output.includes("MAKEFILE_LIST must not be overridden"),
      `${scenario} did not fail closed:\n${output}`,
    );
  }

  const preloadedMakefile = path.join(temporaryRoot, "preloaded.mk");
  writeFileSync(preloadedMakefile, "REPO_ROOT := /tmp/preloaded-attacker-root\n");
  rmSync(commandLog, { force: true });
  const preloadedEnvironment = makeEnvironment(fakeBin, commandLog, {
    MAKEFILES: preloadedMakefile,
  });
  preloadedEnvironment.MAKEFILES = preloadedMakefile;
  const preloadedResult = runMake(
    [makefile],
    "check",
    [],
    preloadedEnvironment,
    controlDirectory,
  );
  assert.notEqual(preloadedResult.status, 0, "MAKEFILES preload unexpectedly passed");
  assert.ok(
    combinedOutput(preloadedResult).includes("MAKEFILES must be empty"),
    `MAKEFILES preload did not fail closed:\n${combinedOutput(preloadedResult)}`,
  );
  assert.ok(!existsSync(commandLog), "MAKEFILES preload reached a quality command");

  const earlierMakefile = path.join(temporaryRoot, "earlier.mk");
  writeFileSync(earlierMakefile, "# Explicit caller-controlled Makefile.\n");
  rmSync(commandLog, { force: true });
  const multiMakefileResult = runMake(
    [earlierMakefile, makefile],
    "check",
    [],
    makeEnvironment(fakeBin, commandLog),
    controlDirectory,
  );
  assert.notEqual(multiMakefileResult.status, 0, "multiple -f Makefiles unexpectedly passed");
  assert.ok(
    combinedOutput(multiMakefileResult).includes(
      "repository Makefile path could not be resolved",
    ),
    `multiple -f Makefiles did not fail closed:\n${combinedOutput(multiMakefileResult)}`,
  );
  assert.ok(!existsSync(commandLog), "multiple -f Makefiles reached a quality command");

  console.log(
    "Makefile root tests passed: 77 executed target/authority cases, " +
      "2 MAKEFILE_LIST rejections, 1 MAKEFILES rejection, and 1 multi-Makefile rejection",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
