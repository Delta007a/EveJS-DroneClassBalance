# DroneClassBalance 0.2.0

Server-side drone bandwidth, active-drone and bay rules by ship class, with optional per-ship exceptions. Supports native EveJS 0.12.8 and final 0.12.9. No EVE client patch is needed.

## Install and configure

Use **EveJS Launcher v1.0.65 → Mods → Add ZIP**, select the release ZIP, enable the mod and restart the Game server. The release ZIP starts disabled. For an existing manually copied folder, use the Launcher's **Adopt** flow. Manual starts can preload `mods/droneClassBalance/loader.js` with Node `--require` before EveJS modules load.

**Configure** exposes bandwidth, active-drone and bay controls for Destroyer, Cruiser, Battleship, Mining Barge, Exhumer, Industrial Command Ship and Capital Industrial Ship. These 22 controls, including logging, are a practical subset of the 47 supported classes. `0` for an active-drone limit means EveJS's native limit. Restart the Game server after saving. Other classes and sparse per-ship exceptions live in advanced `mods/droneClassBalance/settings.json`; copy `settings.example.json` as a starting point. A ship type ID exception wins over a ship-name exception, which wins over its class rule. Missing class rules retain native behavior.

The Launcher carries `settings.json` forward during an update. Before upgrading from the earlier `config.js`/`shipOverrides.js` format, transfer custom rules to `settings.json` and keep a backup of those old files. The public ZIP contains no personal rules. A missing `settings.json` uses no-op class defaults and empty ship exceptions.

## Compatibility and removal

The loader changes only the live fitting resource-state seam in memory. It composes with SoloProgressionBalance in either load order. Disabling the mod and restarting restores native values; Launcher Remove removes its package folder, including package-local settings, so back up `settings.json` first if you want to keep it.

Final 0.12.9 certification: targeted transform/config verifier passed, unrelated source edits and both Drone/Solo transform orders passed, and the four-loader composition gate passed. Live final gameplay still needs its own run before claiming a gameplay pass.

License: AGPL-3.0-only. EveJS itself is AGPL-3.0-only; no vendor source is included in this package.
