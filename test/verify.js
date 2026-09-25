"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CONFIG = require("../config");
const SHIP_OVERRIDES = require("../shipOverrides");
const {
  MARKER,
  VANILLA_SEAM_LF,
  transformLiveFittingStateSource,
} = require("../lib/sourceTransforms");
const {
  SHIP_GROUPS,
  compileConfiguration,
  createRuntime,
} = require("../lib/runtime");

const root = process.env.EVEJS_ROOT
  ? path.resolve(process.env.EVEJS_ROOT)
  : path.resolve(__dirname, "../../..");
const target = path.join(
  root,
  "server/src/services/fitting/liveFittingState.js",
);

function countText(source, token) {
  return String(source).split(token).length - 1;
}

function withEol(source, value) {
  const eol = String(source).includes("\r\n") ? "\r\n" : "\n";
  return value.replace(/\n/gu, eol);
}

function assertNodeCheck(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drone-class-balance-verify-"));
  const file = path.join(dir, "liveFittingState.js");
  try {
    fs.writeFileSync(file, source, "utf8");
    const result = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `transformed liveFittingState failed node --check:\n${result.stderr || result.stdout}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The configuration contract retains vanilla/no-op defaults independently of
// the user's deployed per-class tuning.
const compiled = compileConfiguration(CONFIG, SHIP_OVERRIDES);
const defaultConfig = {
  classes: Object.fromEntries(
    Object.keys(CONFIG.classes).map((className) => [className, {
      bandwidthMultiplier: 1,
      maxActiveDrones: null,
      droneBayMultiplier: 1,
    }]),
  ),
};
const compiledDefaults = compileConfiguration(defaultConfig, { byName: {}, byTypeID: {} });
assert.equal(Object.keys(SHIP_GROUPS).length, 47, "expected 47 internal ship-group mappings");
assert.equal(Object.keys(CONFIG.classes).length, 47, "expected 47 ship classes in config");
assert.equal(compiled.classByGroupID.size, 47, "expected 47 ship groups in config");
assert.equal(compiled.classByName.size, 47, "expected 47 unique ship class names");
for (const rule of compiledDefaults.classByGroupID.values()) {
  assert.equal(rule.bandwidthMultiplier, 1);
  assert.equal(rule.maxActiveDrones, null);
  assert.equal(rule.droneBayMultiplier, 1);
}

// Source ownership: exact semantic seam inside buildShipResourceState only.
const source = fs.readFileSync(target, "utf8");
const clean = transformLiveFittingStateSource(source);
assert.equal(clean.alreadyInstalled, false);
assert.equal(countText(clean.source, MARKER), 1);
assert.equal(
  countText(
    clean.source,
    "droneClassBalanceHook(resourceState, shipItem, shipMetadata);",
  ),
  1,
);
assertNodeCheck(clean.source);

const functionToken = "function buildShipResourceState(";
const unrelatedToken = "  // unrelated-mod-edit-kept\n";
const unrelated = source.replace(
  functionToken,
  functionToken + withEol(source, unrelatedToken),
);
const unrelatedResult = transformLiveFittingStateSource(unrelated);
assert.ok(
  unrelatedResult.source.includes("// unrelated-mod-edit-kept"),
  "unrelated same-function edit was not preserved",
);

const again = transformLiveFittingStateSource(clean.source);
assert.equal(again.alreadyInstalled, true);
assert.equal(again.source, clean.source);

const vanillaSeam = withEol(source, VANILLA_SEAM_LF);
assert.equal(countText(source, vanillaSeam), 1, "test fixture seam must be unique");
assert.throws(
  () =>
    transformLiveFittingStateSource(
      source.replace(
        vanillaSeam,
        withEol(
          source,
          [
            "  };",
            "",
            "  return resourceState;",
            "}",
          ].join("\n"),
        ),
      ),
    ),
  /required semantic seam missing or changed/,
);
assert.throws(
  () =>
    transformLiveFittingStateSource(
      source.replace(vanillaSeam, vanillaSeam + withEol(source, "\n") + vanillaSeam),
    ),
  /ambiguous owned seam/,
);
assert.throws(
  () =>
    transformLiveFittingStateSource(
      source.replace(
        functionToken,
        functionToken + withEol(source, `\n  /* ${MARKER} */`),
      ),
    ),
  /partial\/conflicting/,
);
assert.throws(
  () => transformLiveFittingStateSource(`/* ${MARKER} */\n` + source),
  /marker found outside owned function/,
);

// Runtime application: all three values are independent and maxActive is exact.
const runtime = createRuntime({ config: CONFIG, overrides: SHIP_OVERRIDES });
const state = {
  attributes: { 1271: 50, 352: 5, 283: 125 },
  droneCapacity: 125,
};
const result = runtime.applyRuleToResourceState(state, {
  bandwidthMultiplier: 5,
  maxActiveDrones: 10,
  droneBayMultiplier: 2,
});
assert.equal(result.changed, true);
assert.deepEqual(state.attributes, { 1271: 250, 352: 10, 283: 250 });
assert.equal(state.droneCapacity, 250);

const reduced = { attributes: { 1271: 75, 352: 5, 283: 125 } };
runtime.applyRuleToResourceState(reduced, {
  bandwidthMultiplier: 1,
  maxActiveDrones: 3,
  droneBayMultiplier: 1,
});
assert.equal(reduced.attributes[352], 3, "maxActiveDrones must be an exact override");

const noDrone = { attributes: { 1271: 0, 352: 0, 283: 0 } };
const noDroneResult = runtime.applyRuleToResourceState(noDrone, {
  bandwidthMultiplier: 5,
  maxActiveDrones: 10,
  droneBayMultiplier: 2,
});
assert.equal(noDroneResult.changed, false);
assert.deepEqual(noDrone.attributes, { 1271: 0, 352: 0, 283: 0 });

// Override precedence and partial overrides.
const overrideRuntime = createRuntime({
  config: defaultConfig,
  overrides: {
    byName: {
      Myrmidon: { maxActiveDrones: 9 },
      Porpoise: { enabled: false },
    },
    byTypeID: {
      24700: { droneBayMultiplier: 3 },
      99000001: { maxActiveDrones: 8 },
    },
  },
});
const myrmidonRule = overrideRuntime.selectRule({
  typeID: 24700,
  name: "Myrmidon",
  groupID: 419,
  groupName: "Combat Battlecruiser",
  categoryID: 6,
});
assert.equal(myrmidonRule.bandwidthMultiplier, 1);
assert.equal(myrmidonRule.maxActiveDrones, 9);
assert.equal(myrmidonRule.droneBayMultiplier, 3);

const futureHullRule = overrideRuntime.selectRule({
  typeID: 99000001,
  name: "Future Hull",
  groupID: 990001,
  groupName: "Future Ship Group",
  categoryID: 6,
});
assert.equal(futureHullRule.bandwidthMultiplier, 1);
assert.equal(futureHullRule.maxActiveDrones, 8);
assert.equal(futureHullRule.droneBayMultiplier, 1);

assert.equal(
  overrideRuntime.selectRule({
    typeID: 28606,
    name: "Porpoise",
    groupID: 941,
    groupName: "Industrial Command Ship",
    categoryID: 6,
  }),
  null,
  "enabled:false must exclude one hull from its class rule",
);

assert.equal(
  overrideRuntime.selectRule({
    typeID: 99000002,
    name: "Not A Ship",
    groupID: 419,
    groupName: "Combat Battlecruiser",
    categoryID: 7,
  }),
  null,
  "non-ship categories must never receive ship rules",
);

console.log("DroneClassBalance verifier PASS");
console.log("- 47 ship groups and the vanilla/no-op field contract verified");
console.log("- semantic seam transform scoped / idempotent / unrelated-edit preserving");
console.log("- missing, duplicated, partial, and misplaced owned seams fail closed");
console.log("- bandwidth / exact active-drone limit / bay rule application verified");
console.log("- partial ship overrides and precedence verified");
