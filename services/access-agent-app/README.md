# MOJO Access Agent (desktop)

Installable Windows / Mac app for the apartment PC. Staff **do not** use Terminal or `npm`.

Current release: **1.2.1** (opens status window on launch; portal URL hardening; cloud controllers).

## What staff see

1. Install **MOJO Access Agent** (`.exe` / `.dmg`) from the portal (Owner → Access → Setup)
2. App opens → paste config from Owner → Access → **Start setup** → **Copy full .env**
3. Confirm `MOJO_API_URL=https://portal.mojoapartmentsgh.com` (origin only)
4. Click **Save & start**
5. App lives in the system tray / menu bar and starts at login
6. PC must stay on the **same LAN** as the Hikvision controllers

### macOS “damaged and can’t be opened”

The Mac build is not Apple Developer ID–notarized yet. After download, Gatekeeper often shows
a false “damaged” dialog. Clear quarantine, then open:

```bash
xattr -cr "/Applications/MOJO Access Agent.app"
open "/Applications/MOJO Access Agent.app"
```

Long-term fix: sign + notarize with an Apple Developer ID certificate in `electron-builder`
(`mac.identity` + notarize env).

## Build installers (developer machine)

```bash
cd services/access-agent-app
npm install
npm run dist:mac    # macOS .dmg + zip (Apple Silicon)
npm run dist:win    # Windows .exe (NSIS + portable)
```

`sync:agent` runs automatically before dist/start. Outputs land in `services/access-agent-app/dist/`.

### Dev run (no installer)

```bash
cd services/access-agent-app
npm start
```

## Requirements

- Apartment PC on the same LAN as Hikvision controllers
- Internet to reach `https://portal.mojoapartmentsgh.com`
- Controllers saved in MOJO Access (**Store in MOJO** mode recommended)
