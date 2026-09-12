# Changelog

## 0.1.8 — Automatic launch update

- LineWatch checks the published GitHub branch on desktop launch.
- Clean installs update, restart, and verify before opening the app.
- Tracked local code changes remain protected.


## 0.1.7 — 2026-09-12

- Added automatic installed-versus-published Git version checks on Setup.
- The update button now pulses slowly in green only when `origin/main` is ahead and stops as soon as installation begins.
- The interface reports protected local edits and keeps household setup and saved data outside the update path.

## 0.1.6 — 2026-09-12

- Ensured production-triggered updates install the build-time packages required by Vite and Nitro.

## 0.1.5 — 2026-09-12

- Resolved the updater helper from the LaunchAgent working directory so it remains available after Nitro bundles the server route.

## 0.1.4 — 2026-09-12

- Allowed the local updater through Nitro's preview runtime when the socket address is unavailable but the launcher is using an explicit loopback host.

## 0.1.3 — 2026-09-12

- Added a local-only **Update & Restart** control that pulls the latest Git release, installs dependencies, builds the app, and restarts the managed desktop service.
- Added progress reporting, an update lock, fast-forward-only pulls, and tracked-change protection.

## 0.1.2 — 2026-09-12

- Kept demo-mode recovery safe when a live-to-demo transition begins with an empty device list.

## 0.1.1 — 2026-09-12

- Removed bundled demonstration identities from live browser state and collector policy.
- Added a one-time exact-fingerprint migration that preserves real household devices and settings.
- Added a macOS desktop launcher for the locally deployed LineWatch desk.
