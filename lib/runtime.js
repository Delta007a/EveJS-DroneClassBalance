"use strict";

const ATTRIBUTE_DRONE_CAPACITY = 283;
const ATTRIBUTE_MAX_ACTIVE_DRONES = 352;
const ATTRIBUTE_DRONE_BANDWIDTH = 1271;
const SHIP_CATEGORY_ID = 6;
const SHIP_GROUPS = require("./shipGroups");

const BASE_RULE = Object.freeze({
  bandwidthMultiplier: 1,
  maxActiveDrones: null,
  droneBayMultiplier: 1,
});

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function positiveNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} must be a finite number greater than 0`);
  }
  return numeric;
}

function nullablePositiveInteger(value, label) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${label} must be null or a positive integer`);
  }
  return numeric;
}

function validateRule(rule, label, { partial = false } = {}) {
  const source = plainObject(rule);
  if (!source) throw new Error(`${label} must be an object`);

  const allowed = new Set([
    "enabled",
    "bandwidthMultiplier",
    "maxActiveDrones",
    "droneBayMultiplier",
  ]);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) throw new Error(`${label}: unknown field ${key}`);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(source, "bandwidthMultiplier")) {
    positiveNumber(source.bandwidthMultiplier, `${label}.bandwidthMultiplier`);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(source, "droneBayMultiplier")) {
    positiveNumber(source.droneBayMultiplier, `${label}.droneBayMultiplier`);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(source, "maxActiveDrones")) {
    nullablePositiveInteger(source.maxActiveDrones, `${label}.maxActiveDrones`);
  }
  if (
    Object.prototype.hasOwnProperty.call(source, "enabled") &&
    typeof source.enabled !== "boolean"
  ) {
    throw new Error(`${label}.enabled must be boolean`);
  }
  return source;
}

function compileConfiguration(config, overrides) {
  if (!plainObject(config) || !plainObject(config.classes)) {
    throw new Error("config.classes must be an object");
  }
  if (
    Object.prototype.hasOwnProperty.call(config, "logMatches") &&
    typeof config.logMatches !== "boolean"
  ) {
    throw new Error("config.logMatches must be boolean");
  }
  if (
    !plainObject(overrides) ||
    !plainObject(overrides.byName) ||
    !plainObject(overrides.byTypeID)
  ) {
    throw new Error("shipOverrides must export byName and byTypeID objects");
  }

  const classByGroupID = new Map();
  const classByName = new Map();
  for (const [name, rawRule] of Object.entries(config.classes)) {
    const label = `classes[${JSON.stringify(name)}]`;
    const rule = validateRule(rawRule, label);
    const groupID = Number(SHIP_GROUPS[name]);
    if (!Number.isInteger(groupID) || groupID <= 0) {
      throw new Error(`${label}: unknown ship class name`);
    }
    if (classByGroupID.has(groupID)) {
      throw new Error(`${label}: duplicate internal groupID ${groupID}`);
    }
    const normalizedName = normalizeKey(name);
    if (!normalizedName || classByName.has(normalizedName)) {
      throw new Error(`${label}: duplicate/empty class name`);
    }
    const compiledRule = Object.freeze({
      ...BASE_RULE,
      ...rule,
      groupID,
      className: name,
    });
    classByGroupID.set(groupID, compiledRule);
    classByName.set(normalizedName, compiledRule);
  }

  const byName = new Map();
  for (const [name, rawRule] of Object.entries(overrides.byName)) {
    const normalized = normalizeKey(name);
    if (!normalized || byName.has(normalized)) {
      throw new Error(
        `shipOverrides.byName: duplicate/empty ship name ${JSON.stringify(name)}`,
      );
    }
    byName.set(
      normalized,
      Object.freeze(
        validateRule(
          rawRule,
          `shipOverrides.byName[${JSON.stringify(name)}]`,
          { partial: true },
        ),
      ),
    );
  }

  const byTypeID = new Map();
  for (const [rawTypeID, rawRule] of Object.entries(overrides.byTypeID)) {
    const typeID = Number(rawTypeID);
    if (!Number.isInteger(typeID) || typeID <= 0 || byTypeID.has(typeID)) {
      throw new Error(`shipOverrides.byTypeID: invalid/duplicate typeID ${rawTypeID}`);
    }
    byTypeID.set(
      typeID,
      Object.freeze(
        validateRule(rawRule, `shipOverrides.byTypeID[${rawTypeID}]`, {
          partial: true,
        }),
      ),
    );
  }

  return Object.freeze({ classByGroupID, classByName, byName, byTypeID });
}

function createRuntime({ config, overrides }) {
  const compiled = compileConfiguration(config, overrides);
  const ruleCache = new Map();
  const loggedTypeIDs = new Set();

  function resolveMetadata(shipItem, shipMetadata) {
    const primary = plainObject(shipMetadata) || {};
    const fallback = plainObject(shipItem) || {};
    const typeID = Number(primary.typeID || fallback.typeID || 0);
    if (!Number.isInteger(typeID) || typeID <= 0) return null;

    return {
      typeID,
      name: String(primary.name || fallback.name || ""),
      groupID: Number(primary.groupID || fallback.groupID || 0),
      groupName: String(primary.groupName || fallback.groupName || ""),
      categoryID: Number(primary.categoryID || fallback.categoryID || 0),
    };
  }

  function selectRule(metadata) {
    if (!metadata) return null;
    const typeID = Number(metadata.typeID);
    if (Number.isInteger(typeID) && typeID > 0 && ruleCache.has(typeID)) {
      return ruleCache.get(typeID);
    }

    if (
      Number(metadata.categoryID) > 0 &&
      Number(metadata.categoryID) !== SHIP_CATEGORY_ID
    ) {
      if (typeID > 0) ruleCache.set(typeID, null);
      return null;
    }

    const groupID = Number(metadata.groupID);
    const classRule =
      (Number.isInteger(groupID) && groupID > 0
        ? compiled.classByGroupID.get(groupID) || null
        : null) ||
      (metadata.groupName
        ? compiled.classByName.get(normalizeKey(metadata.groupName)) || null
        : null);
    const nameOverride = compiled.byName.get(normalizeKey(metadata.name)) || null;
    const typeOverride = compiled.byTypeID.get(typeID) || null;

    const hasRule = Boolean(classRule || nameOverride || typeOverride);
    let rule = hasRule ? { ...BASE_RULE } : null;
    if (classRule) rule = { ...rule, ...classRule };
    if (nameOverride) rule = { ...rule, ...nameOverride };
    if (typeOverride) rule = { ...rule, ...typeOverride };

    if (rule && rule.enabled === false) rule = null;
    if (rule) {
      rule = Object.freeze({
        ...rule,
        bandwidthMultiplier: positiveNumber(
          rule.bandwidthMultiplier,
          "resolvedRule.bandwidthMultiplier",
        ),
        maxActiveDrones: nullablePositiveInteger(
          rule.maxActiveDrones,
          "resolvedRule.maxActiveDrones",
        ),
        droneBayMultiplier: positiveNumber(
          rule.droneBayMultiplier,
          "resolvedRule.droneBayMultiplier",
        ),
      });
    }

    if (typeID > 0) ruleCache.set(typeID, rule);
    return rule;
  }

  function applyRuleToResourceState(resourceState, rule) {
    if (!resourceState || !plainObject(resourceState.attributes) || !rule) {
      return { changed: false, before: null, after: null };
    }
    const attributes = resourceState.attributes;
    const before = {
      bandwidth: Number(attributes[ATTRIBUTE_DRONE_BANDWIDTH]) || 0,
      maxActive: Number(attributes[ATTRIBUTE_MAX_ACTIVE_DRONES]) || 0,
      droneBay: Number(attributes[ATTRIBUTE_DRONE_CAPACITY]) || 0,
    };

    // Do not turn a hull that has no Drone Bandwidth and no Drone Bay into a
    // drone ship merely because a broad class rule was edited.
    const droneCapable = before.bandwidth > 0 || before.droneBay > 0;
    if (!droneCapable) return { changed: false, before, after: { ...before } };

    const bandwidthMultiplier = positiveNumber(
      rule.bandwidthMultiplier,
      "resolvedRule.bandwidthMultiplier",
    );
    const droneBayMultiplier = positiveNumber(
      rule.droneBayMultiplier,
      "resolvedRule.droneBayMultiplier",
    );
    const maxActive = nullablePositiveInteger(
      rule.maxActiveDrones,
      "resolvedRule.maxActiveDrones",
    );

    if (before.bandwidth > 0 && bandwidthMultiplier !== 1) {
      attributes[ATTRIBUTE_DRONE_BANDWIDTH] =
        before.bandwidth * bandwidthMultiplier;
    }
    if (before.droneBay > 0 && droneBayMultiplier !== 1) {
      attributes[ATTRIBUTE_DRONE_CAPACITY] =
        before.droneBay * droneBayMultiplier;
    }
    if (maxActive !== null) {
      attributes[ATTRIBUTE_MAX_ACTIVE_DRONES] = maxActive;
    }

    const after = {
      bandwidth: Number(attributes[ATTRIBUTE_DRONE_BANDWIDTH]) || 0,
      maxActive: Number(attributes[ATTRIBUTE_MAX_ACTIVE_DRONES]) || 0,
      droneBay: Number(attributes[ATTRIBUTE_DRONE_CAPACITY]) || 0,
    };
    if (Object.prototype.hasOwnProperty.call(resourceState, "droneCapacity")) {
      resourceState.droneCapacity = after.droneBay;
    }
    return {
      changed:
        before.bandwidth !== after.bandwidth ||
        before.maxActive !== after.maxActive ||
        before.droneBay !== after.droneBay,
      before,
      after,
    };
  }

  function applyDroneClassBalance(resourceState, shipItem, shipMetadata) {
    const metadata = resolveMetadata(shipItem, shipMetadata);
    const rule = selectRule(metadata);
    if (!rule) return resourceState;

    const result = applyRuleToResourceState(resourceState, rule);
    if (
      result.changed &&
      config.logMatches !== false &&
      metadata &&
      metadata.typeID > 0 &&
      !loggedTypeIDs.has(metadata.typeID)
    ) {
      loggedTypeIDs.add(metadata.typeID);
      console.log(
        `[droneClassBalance] ${metadata.name || `type ${metadata.typeID}`} ` +
          `(type=${metadata.typeID}, group=${metadata.groupName || rule.className || "?"}/${metadata.groupID || "?"}) ` +
          `bandwidth ${result.before.bandwidth}->${result.after.bandwidth}, ` +
          `maxActive ${result.before.maxActive}->${result.after.maxActive}, ` +
          `droneBay ${result.before.droneBay}->${result.after.droneBay}`,
      );
    }
    return resourceState;
  }

  return Object.freeze({
    applyDroneClassBalance,
    applyRuleToResourceState,
    compiled,
    resolveMetadata,
    selectRule,
  });
}

module.exports = {
  ATTRIBUTE_DRONE_CAPACITY,
  ATTRIBUTE_MAX_ACTIVE_DRONES,
  ATTRIBUTE_DRONE_BANDWIDTH,
  BASE_RULE,
  SHIP_CATEGORY_ID,
  SHIP_GROUPS,
  compileConfiguration,
  createRuntime,
};
