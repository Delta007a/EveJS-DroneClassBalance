# DroneClassBalance 0.2.1

Drone bandwidth, maximum active drones and drone bay rules for 47 ship groups, with optional per-hull exceptions. Server gameplay supports native **EveJS 0.12.8 and final 0.12.9**.

Version 0.2.1 adds automatic **Fitting > Simulate** support for bandwidth, bay capacity and exact active-drone limits, including the drone picker. No separate companion is required. Existing gameplay rules and configuration are unchanged; actual gameplay remains server-authoritative.

**Install and configure.** Download `EveJS-DroneClassBalance-0.2.1.zip` from Releases. In **EveJS Launcher 1.0.66 > Mods > Add ZIP**, select it, enable DroneClassBalance, configure and restart the Game server. Reconnect a fresh EVE client. The ZIP starts disabled. Existing manually copied folders can use Launcher's Adopt flow.

Configure shows seven common ship groups; Show advanced settings reveals the other 40 and logging. Each group has bandwidth, active-drone and bay controls. Active-drone limit `0` keeps the native limit. Missing rules use native values, and hulls without native drone capability do not gain it.

Sparse hull exceptions live in `mods/droneClassBalance/settings.json` under `shipOverrides.byName` and `shipOverrides.byTypeID`; `settings.example.json` supplies examples. Type ID takes precedence over ship name, then class. Unspecified fields inherit. Launcher updates preserve `settings.json`. If upgrading an older customized `config.js`/`shipOverrides.js` installation, transfer those rules into `settings.json` and retain a backup before upgrading. The package contains no personal settings; defaults are no-op class rules and empty hull exceptions.

**Simulation compatibility.** Currently verified only on **EveJS 0.12.9 / EVE client build 3396210 / Launcher 1.0.66**. Client simulation support is not claimed for EveJS 0.12.8. Native skills and module effects remain part of the simulated result. DroneClassBalance and SoloProgressionBalance 0.4.1 can be used together; either also works alone. Disable/remove the historical standalone Fitting Simulation Companion before using this release.

Unsupported client/server seams, missing compatible Launcher delivery or invalid policy safely retain native simulation; normal server gameplay continues. The known AutoMining login-transform conflict also retains native simulation. Arbitrary third-party client hooks are not certified. Settings changes require a server restart and fresh client reconnect.

**Removal.** Close clients gracefully, stop the server, disable DroneClassBalance in Launcher, then restart and reconnect. Client hooks are transient; no vendor files need restoration. Back up `settings.json` before Launcher Remove, which removes the package and local settings. Manual server gameplay can still preload `mods/droneClassBalance/loader.js` with Node `--require` before EveJS loads; automatic simulation delivery uses Launcher.

License: AGPL-3.0-only. EveJS itself is AGPL-3.0-only; no vendor source is included in this package.
