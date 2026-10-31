"use strict";
const path = require("node:path");
const { attachMember } = require("./familyRuntime");
const { readBundle, getRuntimeVersion } = require("./delivery");
const { buildDronePolicy } = require("./policy");
const { permitted } = require("./capability");
function install(gameplayState, runtimeRoot, modRoot) {
  if (!gameplayState?.active) return { active: false, reason: "gameplay-inactive" };
  const bundle = readBundle(__dirname);
  let policy;
  return attachMember(runtimeRoot, { id: "droneclassbalance", bundle,
    eligible: () => permitted(modRoot, runtimeRoot, bundle), policy() {
    if (!gameplayState.transformApplied) return null;
    if (policy === undefined) {
      const { listItemTypes } = require(path.join(runtimeRoot, "server/src/services/inventory/itemTypeRegistry"));
      policy = buildDronePolicy(gameplayState, listItemTypes(), getRuntimeVersion(runtimeRoot));
      console.log(`[droneClassBalance/simulation] policy ${policy?.revision || "unavailable"}`);
    }
    return policy;
  } });
}
module.exports = { install };
