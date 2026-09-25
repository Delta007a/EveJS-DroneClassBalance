"use strict";

const SHIP_GROUPS = require("./lib/shipGroups");
const { readSettings } = require("./lib/settings");

const baseRule = Object.freeze({ bandwidthMultiplier: 1, maxActiveDrones: null, droneBayMultiplier: 1 });
const settings = readSettings(__dirname);
const classSettings = settings.classes || {};
const classes = Object.fromEntries(Object.keys(SHIP_GROUPS).map((name) => {
  const rule = { ...baseRule, ...(classSettings[name] || {}) };
  // Launcher stores 0 for the native active-drone rule.
  if (rule.maxActiveDrones === 0) rule.maxActiveDrones = null;
  return [name, rule];
}));
for (const name of Object.keys(classSettings)) {
  if (!Object.prototype.hasOwnProperty.call(SHIP_GROUPS, name)) throw new Error(`Unknown drone ship class: ${name}`);
}

module.exports = { logMatches: settings.logMatches === undefined ? true : settings.logMatches, classes };
