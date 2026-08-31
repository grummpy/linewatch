# Linewatch

**Chris Decker**

This computer is house DNS. Every phone, iPad, and Xbox on your Wi-Fi asks it
for names. Linewatch inspects the **domain** (not the page), blocks adult /
VPN bypasses / random malware names, rewrites search to safe search, and
alerts you in a sentence — not a raw dump.

If you have kids: **double-click Install Linewatch on a Mac or PC that stays
on → set the router DNS to that computer → open Linewatch on your phone.**
The phone never sniffs the line. Close it. The computer keeps a 7-day log.

Public source: [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)

## Click install

| You have | Double-click |
|---|---|
| Mac | `install/macos/Install Linewatch.command` |
| Windows | `install/windows/Install-Linewatch.bat` |
| Linux | `install/linux/install.sh` |

That starts house DNS and opens the parent desk. Then one step you still do
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
- Phone on the same Wi-Fi is the remote: live, approve, block, release, alerts

## Honest limits

A phone cannot be house DNS. Isolation is DNS sinkhole, not a VLAN. The
scan is a TCP connect to known-danger ports, not a full nmap of the internet.
Safe search is a DNS rewrite — a child using a VPN you have not blocked can
still walk around it, which is why VPN names are denied.

## License

Copyright (c) 2026 Chris Decker. See [LICENSE](./LICENSE).
