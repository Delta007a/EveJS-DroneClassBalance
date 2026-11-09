# DroneClassBalance 0.2.6

EveJS 261108.1 support updates the optional login payload and keeps the native numeric Placebo signature. Drone rules and hull overrides are unchanged.

Optional fitting simulation adds its payload to the existing login packet on supported EveJS versions. DCB and Solo still share one private controller when both are installed.

Offline login composition checks passed. The maintainer also checked the updated build in-game on EveJS 261028.1.

Supports native EveJS `0.12.8`, `0.12.9`, `261018.1`, `261028.1`, `261108.1`. The 261028.1 port was checked with **EveJS Launcher 1.0.76** and EVE client **build 3396210**. The user confirmed all four mods passed in-game verification on 2026-10-31; the automated port checks remain separate evidence. Older declared server support is retained, without claiming a new full certification of those versions.

The maintainer confirmed the four updated mods work together in-game on EveJS 261108.1.

## Install and update

Download `EveJS-DroneClassBalance-0.2.6.zip` from [Releases](https://github.com/Delta007a/EveJS-DroneClassBalance/releases/latest). Open Launcher **Mods > Add ZIP**, enable the mod and open **Configure**. Release ZIPs contain `loader.js.disabled` and start disabled. Configuration changes require a Game server restart; transient client features require a fresh client connection.

The package contains no personal `settings.json`, `.env`, runtime database or client archive. Launcher carries forward package-local files declared by the settings schema. Back up personal configuration before updating or removing a mod. For legacy customized source installations, transfer settings to the documented JSON configuration before updating; source files are replaced by updates.

## Behavior and defaults

Per-class bandwidth multiplier, exact maximum active drones and Drone Bay multiplier for 47 ship groups, with sparse hull overrides. Missing rules retain native values. Hulls without native drone capability do not gain it.

| Setting | Default |
| --- | --- |
| Bandwidth multiplier, every class | 1x |
| Maximum active drones | 0 in Configure = native limit |
| Drone Bay multiplier, every class | 1x |
| Hull overrides | empty |
| Match logging | true |

Configure exposes seven common ship groups; advanced settings reveal the remaining groups and logging. Without personal configuration the mod is a no-op. `mods/droneClassBalance/settings.json` stores `classes`, `logMatches` and `shipOverrides.byName` / `shipOverrides.byTypeID`. Type ID overrides take precedence over name, then class; unspecified fields inherit. `settings.example.json` is a neutral example. Legacy customized `config.js` / `shipOverrides.js` rules must be migrated to JSON before update; source files are replaced.

## Embedded fitting simulation

Projects bandwidth, bay capacity and the exact drone limit, including the three reviewed limit/picker hooks. Works independently or with the matching SoloProgressionBalance candidate (0.4.6). The private aggregate runtime retains ABI 1, wire schema 1 and bundle revision 5, with one aggregate controller/login transform and per-family isolation. No standalone companion is required; remove an old standalone Fitting Simulation Companion first.

Simulation supports reviewed source/version pairs 0.12.9, 261018.1, 261028.1 and 261108.1 with client build 3396210 and exact method fingerprints. 0.12.8 remains gameplay-only. Unsupported, absent, malformed or conflicting delivery retains native simulation. Gameplay remains server-authoritative; arbitrary third-party login hooks are not certified. Injection is transient and never writes vendor client files.

## Removal

Disable in Launcher, then use your normal server restart and client reconnect procedure. Back up `settings.json` before Remove, which deletes package-local settings. No client archive restoration is needed.

License: AGPL-3.0-only. No vendor source is included.
