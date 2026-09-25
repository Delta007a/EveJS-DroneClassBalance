"use strict";

const Module = require("node:module");
const path = require("node:path");
const { isMainThread } = require("node:worker_threads");

const CONFIG = require("./config");
const SHIP_OVERRIDES = require("./shipOverrides");
const { createRuntime } = require("./lib/runtime");
const {
  HOOK_SYMBOL,
  transformLiveFittingStateSource,
} = require("./lib/sourceTransforms");

const MOD_VERSION = "0.2.0";
const MOD_DIR = __dirname;
const RUNTIME_ROOT = path.resolve(MOD_DIR, "../..");
const TARGET = path.resolve(
  RUNTIME_ROOT,
  "server/src/services/fitting/liveFittingState.js",
);

const INSTALL_FLAG = Symbol.for("evejs.droneClassBalance.loaderInstalled");
const APPLY_HOOK = Symbol.for(HOOK_SYMBOL);

function canonical(filename) {
  const resolved = path.resolve(String(filename || ""));
  return process.platform === "win32"
    ? path.win32.normalize(resolved.replace(/\//gu, "\\")).toLowerCase()
    : path.posix.normalize(resolved.replace(/\\/gu, "/"));
}

const CANONICAL_TARGET = canonical(TARGET);

function install() {
  if (!isMainThread) return { active: false, reason: "worker-thread" };
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];

  const alreadyCached = Object.keys(Module._cache).find(
    (filename) => canonical(filename) === CANONICAL_TARGET,
  );
  if (alreadyCached) {
    throw new Error(
      `required target was cached before DroneClassBalance loaded: ${alreadyCached}`,
    );
  }

  const runtime = createRuntime({
    config: CONFIG,
    overrides: SHIP_OVERRIDES,
  });
  globalThis[APPLY_HOOK] = runtime.applyDroneClassBalance;

  const previousCompile = Module.prototype._compile;
  let transformApplied = false;

  function compileWithDroneClassBalance(content, filename) {
    let incoming = content;
    if (canonical(filename) === CANONICAL_TARGET) {
      const transformed = transformLiveFittingStateSource(incoming);
      incoming = transformed.source;
      transformApplied = true;
    }
    return previousCompile.call(this, incoming, filename);
  }

  Module.prototype._compile = compileWithDroneClassBalance;
  const state = Object.freeze({
    active: true,
    target: TARGET,
    runtime,
    previousCompile,
    compileWithDroneClassBalance,
    get transformApplied() {
      return transformApplied;
    },
  });
  globalThis[INSTALL_FLAG] = state;

  console.log(
    `[droneClassBalance] v${MOD_VERSION} armed — class-based drone bandwidth, active limit, and bay scaling`,
  );
  return state;
}

let installResult;
try {
  installResult = install();
} catch (error) {
  console.error(`[droneClassBalance] loader failed: ${error.message}`);
  if (error && error.stack) console.error(error.stack);
  throw error;
}

module.exports = {
  MOD_VERSION,
  CONFIG,
  SHIP_OVERRIDES,
  install,
  installResult,
};
