"use strict";

const fs = require("node:fs");
const path = require("node:path");

function object(value) { return value && typeof value === "object" && !Array.isArray(value); }

function readSettings(modDir) {
  const file = path.join(modDir, "settings.json");
  if (!fs.existsSync(file)) return {};
  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!object(settings)) throw new Error("Drone settings.json must contain an object");
  for (const key of Object.keys(settings)) {
    if (!["logMatches", "classes", "shipOverrides"].includes(key)) throw new Error(`Unknown Drone settings key: ${key}`);
  }
  if (settings.classes !== undefined && !object(settings.classes)) throw new Error("Drone settings.classes must be an object");
  if (settings.shipOverrides !== undefined && !object(settings.shipOverrides)) throw new Error("Drone settings.shipOverrides must be an object");
  return settings;
}

module.exports = { readSettings };
