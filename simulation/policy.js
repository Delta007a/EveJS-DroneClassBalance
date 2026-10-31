"use strict";
const crypto = require("node:crypto");

// Wire schema is provider-based so later phases can add independent providers.
// Phase 1 emits only DroneClassBalance, resolved by the existing loaded runtime.
function buildDronePolicy(state, shipMetadata, evejsVersion = "0.12.9") {
  if (!state || state.active !== true || state.transformApplied !== true) return null;
  const runtime = state.runtime;
  if (!runtime || typeof runtime.resolveMetadata !== "function" || typeof runtime.selectRule !== "function") return null;
  const rules = [];
  const hulls = {};
  const indices = new Map();
  for (const metadata of [...shipMetadata].sort((a, b) => a.typeID - b.typeID)) {
    if (Number(metadata.categoryID) !== 6) continue;
    const identity = runtime.resolveMetadata(null, metadata);
    if (!identity) continue;
    const rule = runtime.selectRule(identity);
    if (!rule) continue;
    const values = [rule.bandwidthMultiplier, rule.droneBayMultiplier, rule.maxActiveDrones];
    if (!values.slice(0, 2).every(value => typeof value === "number" && Number.isFinite(value) && value > 0) ||
        !(values[2] === null || Number.isSafeInteger(values[2]) && values[2] > 0)) throw Error("Invalid loaded drone policy");
    if (values[0] === 1 && values[1] === 1 && values[2] === null) continue;
    const key = JSON.stringify(values);
    if (!indices.has(key)) { indices.set(key, rules.length); rules.push(values); }
    hulls[identity.typeID] = indices.get(key);
  }
  const provider = { schema: 1, rules, hulls };
  const policy = { schema: 1, evejs: evejsVersion, clientBuild: 3396210, providers: { droneclassbalance: provider } };
  policy.revision = crypto.createHash("sha256").update(JSON.stringify(policy)).digest("hex");
  return policy;
}

module.exports = { buildDronePolicy };
