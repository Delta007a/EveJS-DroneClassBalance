"use strict";

const MARKER = "droneClassBalance: resource-state hook";
const HOOK_SYMBOL = "evejs.droneClassBalance.applyResourceState";
const FUNCTION_TOKEN = "function buildShipResourceState(";
const LABEL = "liveFittingState drone resource-state pipeline";

const VANILLA_SEAM_LF = [
  "  };",
  "",
  "  return synchronizeShipResourceStateSummary(resourceState);",
  "}",
].join("\n");

const INSTALLED_SEAM_LF = [
  "  };",
  "",
  `  /* ${MARKER} */`,
  `  const droneClassBalanceHook = globalThis[Symbol.for("${HOOK_SYMBOL}")];`,
  "  if (typeof droneClassBalanceHook === \"function\") {",
  "    droneClassBalanceHook(resourceState, shipItem, shipMetadata);",
  "  }",
  "",
  "  return synchronizeShipResourceStateSummary(resourceState);",
  "}",
].join("\n");

function countText(source, token) {
  return String(source).split(token).length - 1;
}

function findUniqueFunctionScope(source) {
  const text = String(source);
  const count = countText(text, FUNCTION_TOKEN);
  if (count !== 1) {
    throw new Error(`${LABEL}: function anchor count ${count}, expected 1`);
  }
  const start = text.indexOf(FUNCTION_TOKEN);
  const nextFunction = text.indexOf("\nfunction ", start + FUNCTION_TOKEN.length);
  const end = nextFunction >= 0 ? nextFunction + 1 : text.length;
  return { start, end, scoped: text.slice(start, end) };
}

function withEol(source, value) {
  const eol = String(source).includes("\r\n") ? "\r\n" : "\n";
  return value.replace(/\n/gu, eol);
}

function analyzeOwnedSeam(source) {
  const scope = findUniqueFunctionScope(source);
  const vanilla = withEol(scope.scoped, VANILLA_SEAM_LF);
  const installed = withEol(scope.scoped, INSTALLED_SEAM_LF);

  const markerOutside =
    countText(source, MARKER) - countText(scope.scoped, MARKER);
  const symbolOutside =
    countText(source, `Symbol.for("${HOOK_SYMBOL}")`) -
    countText(scope.scoped, `Symbol.for("${HOOK_SYMBOL}")`);
  if (markerOutside !== 0 || symbolOutside !== 0) {
    throw new Error(`${LABEL}: DroneClassBalance marker found outside owned function`);
  }

  const vanillaCount = countText(scope.scoped, vanilla);
  const installedCount = countText(scope.scoped, installed);
  const markerCount = countText(scope.scoped, MARKER);
  const symbolCount = countText(scope.scoped, `Symbol.for("${HOOK_SYMBOL}")`);
  const callCount = countText(
    scope.scoped,
    "droneClassBalanceHook(resourceState, shipItem, shipMetadata);",
  );

  if (
    vanillaCount === 1 &&
    installedCount === 0 &&
    markerCount === 0 &&
    symbolCount === 0 &&
    callCount === 0
  ) {
    return { ...scope, status: "vanilla", vanilla, installed };
  }

  if (
    vanillaCount === 0 &&
    installedCount === 1 &&
    markerCount === 1 &&
    symbolCount === 1 &&
    callCount === 1
  ) {
    return { ...scope, status: "installed", vanilla, installed };
  }

  if (
    vanillaCount > 1 ||
    installedCount > 1 ||
    markerCount > 1 ||
    symbolCount > 1 ||
    callCount > 1
  ) {
    throw new Error(
      `${LABEL}: ambiguous owned seam ` +
        `(vanilla=${vanillaCount}, installed=${installedCount}, marker=${markerCount}, ` +
        `symbol=${symbolCount}, call=${callCount})`,
    );
  }

  if (
    installedCount > 0 ||
    markerCount > 0 ||
    symbolCount > 0 ||
    callCount > 0
  ) {
    throw new Error(`${LABEL}: partial/conflicting DroneClassBalance transform`);
  }

  throw new Error(`${LABEL}: required semantic seam missing or changed`);
}

function transformLiveFittingStateSource(source) {
  const text = String(source);
  const analysis = analyzeOwnedSeam(text);
  if (analysis.status === "installed") {
    return { source: text, alreadyInstalled: true };
  }

  const transformedScope = analysis.scoped.replace(
    analysis.vanilla,
    analysis.installed,
  );
  const transformed =
    text.slice(0, analysis.start) +
    transformedScope +
    text.slice(analysis.end);

  const verified = analyzeOwnedSeam(transformed);
  if (verified.status !== "installed") {
    throw new Error(`${LABEL}: transformed source did not verify as installed`);
  }
  return { source: transformed, alreadyInstalled: false };
}

module.exports = {
  FUNCTION_TOKEN,
  HOOK_SYMBOL,
  INSTALLED_SEAM_LF,
  LABEL,
  MARKER,
  VANILLA_SEAM_LF,
  analyzeOwnedSeam,
  transformLiveFittingStateSource,
};
