# Linewatch setup — Chris Decker

The computer is the watch. The phone is the window.

---

## Click and run (Mac / Windows)

1. Unzip Linewatch on a computer that **stays on** this Wi-Fi.
2. Double-click:
   - Mac: `install/macos/Install Linewatch.command`
   - Windows: `install/windows/Install-Linewatch.bat`
3. Approve the one administrator prompt. A browser opens the parent desk and the always-on service starts.
4. On the **router**, set DNS to this computer’s address (the installer prints it).
5. On your phone, same Wi-Fi: open Linewatch → it finds the computer → Add to Home Screen.

Kids’ phones get nothing installed. They just use Wi-Fi.

Python: `python3 collector/python/linewatch_dns.py`  
Java: `javac collector/java/LinewatchDns.java && java -cp collector/java LinewatchDns`

---

## House profile (the easy buttons)

Under **House**:

- **Bedtime** and **Homework** sliders — on/off, then drag the hours
- **Block adult / social / gaming**
- **Safe search**
- **Auto-isolate kids** — three high-severity hits in fifteen minutes
- Site log: **Approve** or **House deny**, or a person’s name

Under **People**: turn auto-isolate off for one kid, **Release** a quarantined device.

Under **Setup**: **Scan this Wi-Fi** — on demand only.

Alerts speak in sentences: “Riley tried pornhub.com 4 times in 8 minutes. Linewatch blocked it.”

---

## Always-on (Linux)

```bash
sudo mkdir -p /opt/linewatch /var/lib/linewatch
sudo cp -R . /opt/linewatch
sudo cp collector/linewatch.service /etc/systemd/system/linewatch.service
sudo systemctl enable --now linewatch
```

The click installers create the macOS LaunchDaemon or Windows startup task automatically. You may close the installer and browser; keep the collector computer powered on.

The **phone can close**. This computer is the watch. Logs older than **7 days** are overwritten.

---

## Schema (on the computer)

See [collector/SCHEMA.md](./collector/SCHEMA.md): timestamp, device MAC, requested domain, category, action, reason. Global and profile blocklists for adult / gaming / social.

---

Chris Decker · [github.com/grummpy/linewatch](https://github.com/grummpy/linewatch)
