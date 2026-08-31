# Linewatch setup — Chris Decker

A simple way to watch house traffic when you have kids: put one always-on
computer on your Wi-Fi, send DNS there, and read it in Linewatch on your phone.

You do **not** install an App Store app on the kids’ phones. You watch what
leaves the **router**.

The phone can close. The collector computer stays on, keeps writing, and
**overwrites logs older than 7 days**.

---

## The simple path (recommended if you have kids)

Most consumer routers (eero, Nest, ISP gateways) will not show you every site.
**Pi-hole** is the straightforward fix: it becomes DNS for the house, so every
device — phones, iPads, Xbox, the TV — asks it for names. Linewatch reads that
log.

### What you need

- A Raspberry Pi, old laptop, or Mac mini that stays on, on **your** Wi-Fi
- 20 minutes
- The phone you carry (for alerts)

### 1. Make that computer the house DNS

1. Install [Pi-hole](https://pi-hole.net) on the always-on computer.
2. In the **router** DHCP settings, set DNS to the Pi-hole’s LAN IP
   (example: `192.168.1.10`).
3. Renew Wi-Fi on the kids’ devices, or reboot them once.
4. Open the Pi-hole dashboard. You should see queries from their IPs.

Now every lookup in the house hits that box. That is the watch point.

### 2. Run Linewatch’s collector next to Pi-hole

On the same computer:

```bash
git clone https://github.com/grummpy/linewatch.git
cd linewatch
npm install
LINEWATCH_DNS_LOG=/var/log/pihole.log npm run collector
```

It prints this computer’s IP and the router/gateway it found.

Leave that window running, or install the always-on service so it survives reboot:

```bash
sudo mkdir -p /opt/linewatch /var/lib/linewatch
sudo cp -R . /opt/linewatch
sudo cp collector/linewatch.service /etc/systemd/system/linewatch.service
sudo systemctl enable --now linewatch
```

Mac: keep Terminal open, or add `npm run collector` as a Login Item.

The **phone can close**. This computer is the watch. Logs older than **7 days** are overwritten.

### 3. Open Linewatch — it finds the router

On a phone on the **same Wi-Fi**, open Linewatch. Setup fills in your router
(.1) and looks for the collector on this network. If it does not connect by
itself, tap **Find my router**, then **Connect**.

If you also run the desk from that computer:

```bash
npm run dev
```

then open Linewatch → **Setup**. It should say **Watching**.

The demo family (Riley, Sam, …) stops. Live is **your** LAN: device IP, site,
time, Sidewalk vs WAN, adult hits.

### 4. Put it on your phone

- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → Install app

Turn on alerts in **Setup**. Adult destinations on a kid’s IP fire immediately.

---

## If you already have a serious router

Skip Pi-hole. Run the collector and send **syslog** to it (UDP 5514):

| Router | Where |
|---|---|
| UniFi | Settings → System → syslog |
| Asus / Merlin | System log → forwarding |
| OpenWrt / pfSense / OPNsense | remote syslog server |
| Firewalla | already logs DNS — export or syslog |

Then open Linewatch on the same Wi-Fi. It autocompletes the collector.

---

## What you will see (and what you will not)

- **Site name, device IP, time, size, path** (WAN vs Amazon Sidewalk)
- **Adult** classified from the destination host — not from page content
- **Location** means Maps / Weather / Apple Location, not a GPS pin
- You will **not** get packet payloads, passwords, or camera video
- A phone alone cannot tap the WAN. The collector + DNS/syslog is the line.
- Closing the app does **not** stop the watch. The collector computer does.

Assign devices to people under **People** (name, role: child / parent). Block a
site for one kid or for the whole house under **House**.

---

## Quick commands

```bash
npm install
npm run dev          # the desk
npm run collector    # finds the gateway, takes DNS/syslog, keeps 7 days
```

Paste a Pi-hole / dnsmasq line if you do not want the collector yet:

```
Aug 31 12:14:01 query[A] example.com from 192.168.1.31
```

---

Chris Decker · [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)
