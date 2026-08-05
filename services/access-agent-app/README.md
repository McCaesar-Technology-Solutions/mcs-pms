# MOJO Access Agent (desktop)

Installable Windows / Mac app for the apartment PC. Staff **do not** use Terminal or `npm`.

## What staff see

1. Install **MOJO Access Agent** (`.exe` / `.dmg`)
2. App opens → paste config from Owner → Access → **Start setup** → **Copy full .env**
3. Click **Save & start**
4. App lives in the system tray / menu bar and starts at login

## Build installers (developer machine)

```bash
cd services/access-agent-app
npm run sync:agent
npm install
npm run dist:win    # Windows .exe (NSIS + portable) — build on Windows or CI
npm run dist:mac    # macOS .dmg — build on a Mac
```

Outputs land in `services/access-agent-app/dist/`.

### Dev run (no installer)

```bash
cd services/access-agent-app
npm run sync:agent
npm install
npm start
```

## Requirements

- Apartment PC on the same LAN as Hikvision controllers
- Internet to reach the MOJO website
- Controllers saved in MOJO Access (**Store in MOJO** mode recommended)
