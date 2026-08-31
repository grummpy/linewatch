# Add Linewatch to your phone

Linewatch is not an App Store / Play Store download. It is a **web app** you pin to the Home Screen. The Google Drive zip is the **source code** (for a computer). Unzipping it on a phone will not install the app.

Use the Drive folder to keep the files and this guide. Use Safari (iPhone) or Chrome (Android) to pin the running app.

Drive folder: https://drive.google.com/drive/folders/1dov_LjlNvk5ybb0hsNBPws84ws9XzL_H

GitHub (public): https://github.com/grummpy/linewatch

---

## 1. Open Linewatch on the phone

Open the **running** Linewatch desk, not the zip.

1. On a computer on home Wi-Fi, run `node collector/linewatch-collector.mjs` (or `npm run collector`).
2. It prints this computer’s IP and a router/gateway guess.
3. Point the router’s syslog or DNS log at that IP, UDP 5514.
4. On the phone, open Linewatch in Safari (iPhone) or Chrome (Android).
5. **Setup → Your house** → paste `http://THAT_IP:8787` → Connect.
6. Then pin Linewatch to the Home Screen (steps below).

The Drive zip is source. Unzipping it on a phone will not watch the router.

---

## 2. iPhone / iPad (iOS 16+)

1. Open Linewatch in **Safari**.
2. Tap the **Share** button (square with an arrow).
3. Scroll and tap **Add to Home Screen**.
4. Name it `Linewatch`. Tap **Add**.
5. Open it from the Home Screen — it runs full-screen like a native app.
6. In Linewatch, open **Setup** and turn on **Desktop notifications** if you want adult alerts as banners.

Do this on the phone you carry, not only on a kid’s device.

---

## 3. Android (10+)

1. Open Linewatch in **Chrome**.
2. Tap the address-bar **Install** icon, or menu (⋮) → **Install app** / **Add to Home screen**.
3. Confirm. Linewatch appears in the app drawer and on the Home Screen.
4. Open **Setup** and allow notifications for adult hits.

---

## 4. Using Google Drive on the phone

This is how Drive fits in. It holds the files; it does not install the app.

1. Install **Google Drive** from the App Store / Play Store if you do not have it.
2. Sign in with the same Google account that owns the Linewatch folder.
3. Open **Linewatch**.
4. You should see:
   - **Linewatch-app.zip** — source for a computer (`npm install` then `npm run dev`)
   - **Linewatch household report** / **adult incidents** — the spreadsheets
   - **Add Linewatch to your phone** — this guide
5. To share the folder with another phone (spouse, your other device):
   - Open the **Linewatch** folder
   - Tap the three dots → **Share**
   - Add their Gmail, or **Copy link**
6. On a **computer**, download the zip from Drive if you want the source next to GitHub.

---

## 5. What will not work

- Opening **Linewatch-app.zip** on the phone and expecting an Install button
- Sideloading an `.ipa` / `.apk` — there isn’t one
- Chrome on iPhone for Home Screen install — use Safari
- App Store / Play Store search for “Linewatch”

The Home Screen icon **is** the iPhone, Android, Windows, and Mac app.
