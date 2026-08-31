# Linewatch

**Chris Decker**

Watch what leaves the house. Linewatch is a household outbound monitor: it
classifies traffic (including adult destinations), splits Amazon Sidewalk from
ordinary WAN data, ties hits to a person and device, and alerts you on your
phone.

If you have kids, the simple setup is: **Pi-hole as house DNS → Linewatch
collector on that box → this app on your phone.** Full steps in
[SETUP.md](./SETUP.md).

Public source: [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)

## Why this exists

Phones, iPads, and game consoles all go out through one router. You should be
able to see:

- which **person / IP** opened a site
- **when**
- whether it was **adult**, social, streaming, or Sidewalk (Ring / Alexa / Tile)
- whether a **location-class** destination (Maps, Weather) was in the mix

and then block that site for one kid or for the house.

This is for **your own LAN**. It is not a school or workplace surveillance
product.

## Simple path if you have kids

1. Put a Raspberry Pi or spare computer on your Wi-Fi. Install Pi-hole. Point
   the router’s DNS at it. Every device in the house now asks that box for
   names.
2. `LINEWATCH_DNS_LOG=/var/log/pihole.log npm run collector`
3. Open Linewatch → Setup → Your house → Connect.
4. Safari (iPhone) or Chrome (Android) → Add to Home Screen. Alerts on.

That is the whole watch. You do not install anything on the kids’ phones.

Details, including UniFi / Asus syslog if you already have a real router:
**[SETUP.md](./SETUP.md)**. Phone pin: **[PHONE.md](./PHONE.md)**.

## Run it

```bash
npm install
npm run dev
npm run collector    # on the always-on computer
```

## What the desk does

| Screen | Use |
|---|---|
| Live | Person chips, Sidewalk vs WAN, adult highlights |
| People | One profile per person — devices, IP, MAC, location-class hits, personal blocks |
| House | Home firewall: monitor / blacklist / whitelist + site log |
| Logs | Auto-archive repository, CSV, alerts |
| Setup | Your house collector, phone install, DNS paste |

Logs stay in this browser (`localStorage`) unless you download CSV.

## Honest limits

A phone cannot sniff the router by itself. Sidewalk is tagged from Amazon /
Ring / Tile **hosts**, not the 900 MHz radio. Location is a destination class,
not GPS. Dest IP “region” is the **server**, not where your kid is standing.

## License

Copyright (c) 2026 Chris Decker. See [LICENSE](./LICENSE).
