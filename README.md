# Linewatch

Household internet watch. Linewatch classifies outbound traffic leaving the house, splits **Amazon Sidewalk** from **WAN data**, filters by person, and alerts when a kid’s device hits an adult destination.

**Public repo:** [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)

## Watch your own router

A browser cannot sniff the WAN. Whoever downloads Linewatch watches **their** house by running the collector on a computer that stays on the home Wi-Fi:

```bash
npm run collector
```

It finds this computer’s LAN IP and the default gateway (usually the router), fingerprints the admin page if it answers, and listens for syslog/DNS on UDP 5514.

1. Point the router (or Pi-hole) at that LAN IP.
2. In Linewatch → **Setup → Your house** → paste `http://THAT_IP:8787` → Connect.
3. Live operations switches from the demo household to real queries.

Pi-hole: `LINEWATCH_DNS_LOG=/var/log/pihole.log npm run collector`

ISP gateways (eero / Nest / many cable modems) often cannot syslog. Use Pi-hole as DNS, then tail that log.

## Put it on your phone

Linewatch is a Home Screen web app, not an App Store / Play binary. The Drive zip is source for a computer — it will not install on a phone.

Full steps: **[PHONE.md](./PHONE.md)**

- **iPhone (iOS 16+):** open Linewatch in **Safari** → Share → **Add to Home Screen**
- **Android 10+:** open Linewatch in **Chrome** → **Install app**
- **Google Drive:** [Linewatch folder](https://drive.google.com/drive/folders/1dov_LjlNvk5ybb0hsNBPws84ws9XzL_H) — keep the zip, reports, and the phone guide there. Share that folder to your other devices.

## What it does

- **Live operations** — every hit with person, device, source IP, dest IP, host, path (WAN / Sidewalk / Amazon net), genre, and size
- **Person profiles** — Riley, Sam, Jordan, Avery, House: devices, MAC, IP, Sidewalk vs WAN, location-class destinations, personal blocklist
- **House firewall** — monitor, blacklist, or whitelist traffic for the whole house; push a site onto one person
- **Site log** — filter hosts, deny for the house, or block per profile
- **Log repository** — auto-archives every 50 events (and every few minutes if traffic is light); download CSV
- **Adult alerts** — device, IP, host, time; sound + optional desktop notifications
- **Installable app** — same desk on Windows 11, iPhone, Android, and Mac (Add to Dock)

## Honest limits

A phone or PC cannot sniff the router’s WAN port by itself. Linewatch classifies a demo household plus any DNS log you paste (Pi-hole / dnsmasq, or `time,source_ip,host`). Sidewalk is tagged from Amazon / Ring / Tile hosts, not the 900 MHz radio. Location flags mean Maps / Weather / Apple Location — there is no GPS pin on the wire. Dest IP region is the **server**, not where someone is standing.

## Run it

```bash
npm install
npm run dev
```

Open the app, then install it from **Setup** on the computer or phone you want to watch from.

## Layout

| Path | What |
|---|---|
| `/` | Live operations — person chips, Sidewalk / WAN / Location filters |
| `/people` | Household people |
| `/people/:owner` | One person: devices, location, personal blocks |
| `/house` | Home firewall + site log |
| `/logs` | Archive repository + alerts |
| `/settings` | PWA install, collector, DNS ingest |

Rules and logs persist in the browser (`localStorage`). Point a collector at the house LAN when you have one.

## Stack

React 19, TanStack Start / Router, Tailwind v4, Zustand, Recharts.
