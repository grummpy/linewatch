# Linewatch

**Chris Decker**

This computer is house DNS. Every phone, iPad, and Xbox on your Wi-Fi asks it
for names. Linewatch inspects the **domain** (not the page), blocks adult /
VPN bypasses / random malware names, rewrites search to safe search, and
alerts you in a sentence — not a raw dump.

If you have kids: **double-click Install Linewatch on a Mac or PC that stays
on → set the router DNS to that computer → open the parent desk on that
computer.** The computer keeps a 7-day log.

Public source: [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)

## Click install

| You have | Double-click |
|---|---|
| Mac | `install/macos/Install Linewatch.command` |
| Windows | `install/windows/Install-Linewatch.bat` |
| Linux | `install/linux/install.sh` |

That installs an always-on background service, starts house DNS, and opens the parent desk. Then one step you still do
on the router: DNS = this computer.

Python and Java collectors live in `collector/python` and `collector/java`
if you do not want Node.

## What it does

- Intercepts DNS, matches a device/MAC to a person profile
- Global + per-person blocklists (adult, gaming, social)
- Safe search rewrite (Google, Bing, YouTube, DuckDuckGo)
- Bedtime and homework sliders
- VPN / private DNS / iCloud Relay flagged as bypass
- High-randomness names (DGA / malware) flagged by entropy
- Repeated blocks in ten minutes become a sentence, not four identical rows
- Three high-severity hits isolate that device until you release it (on for
  kids, off per person if you want)
- On-demand Wi-Fi exposure scan (open Telnet/SMB/RDP) — never background
- The parent desk can be made available on the home LAN only with an explicit
  authenticated Node collector configuration (below)

## Honest limits

A phone cannot be house DNS. Isolation is DNS sinkhole, not a VLAN. The
scan is a TCP connect to known-danger ports, not a full nmap of the internet.
Safe search is a DNS rewrite — a child using a VPN you have not blocked can
still walk around it, which is why VPN names are denied.

## Management access

The collector's management API controls DNS policy and can start an on-demand
LAN scan. It therefore binds to `127.0.0.1` by default and sends no permissive
CORS header. The Python and Java compatibility collectors remain local-only.

If an administrator intentionally needs the **Node** parent desk from a phone
or another home computer, configure all three values in the service environment
before starting it:

```sh
LINEWATCH_MANAGEMENT_BIND=0.0.0.0
LINEWATCH_MANAGEMENT_TOKEN=replace-with-a-long-random-secret
LINEWATCH_MANAGEMENT_ORIGIN=https://the-exact-parent-desk-origin.example
```

The collector refuses a non-loopback bind without a token. Browser requests
are accepted only from the exact configured origin and must send that token as
a bearer token. Enter the token in Linewatch's connection screen for the
current browser session; it is not stored in the browser. This configuration
does not change router DNS, firewall, service, or other installed settings.

## License

Copyright (c) 2026 Chris Decker. See [LICENSE](./LICENSE).
