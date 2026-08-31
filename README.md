# Linewatch

Household internet watch. Linewatch classifies outbound traffic leaving the house, splits **Amazon Sidewalk** from **WAN data**, filters by person, and alerts when a kid’s device hits an adult destination.

## What it does

- **Live operations** — every hit with person, device, source IP, dest IP, host, path (WAN / Sidewalk / Amazon net), genre, and size
- **Person profiles** — Riley, Sam, Jordan, Avery, House: devices, MAC, IP, Sidewalk vs WAN, location-class destinations, personal blocklist
- **House firewall** — monitor, blacklist, or whitelist traffic for the whole house; push a site onto one person
- **Site log** — filter hosts, deny for the house, or block per profile
- **Log repository** — auto-archives every 50 events (and every few minutes if traffic is light); download CSV
- **Adult alerts** — device, IP, host, time; sound + optional desktop notifications
- **Installable app** — same desk on Windows 11, iPhone (iOS 16+ Safari Add to Home Screen), Android 10+ Chrome, and Mac (Add to Dock)

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
