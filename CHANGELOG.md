# Changelog

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
