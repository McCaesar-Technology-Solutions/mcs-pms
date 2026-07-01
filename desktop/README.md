# MOJO Apartments — Desktop (Tauri)

**Prefer browser install?** Use the **PWA** instead: open your hosted `/login` in Chrome or Edge and click the **install** icon in the address bar (same idea as Snapchat Web). No download required.

This folder is an **optional** native shell (`.msi` / `.dmg`) if you want installers outside the browser.

Online-only desktop app for **owners and staff**. Opens your hosted PMS in a dedicated window (no browser tabs). Requires internet — same backend as the web app.

**Platforms:** Windows 10+ and macOS 10.15+

---

## Prerequisites

Install once on the machine you use to **build** installers:

| Tool | Install |
|------|---------|
| **Node.js** 20+ | [nodejs.org](https://nodejs.org) |
| **Rust** | [rustup.rs](https://rustup.rs) |
| **macOS extras** | Xcode Command Line Tools: `xcode-select --install` |
| **Windows extras** | [Visual Studio Build Tools](https://learn.microsoft.com/en-us/windows/dev-environment/rust/setup) with C++ workload |

Full list: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

---

## Configure app URL

Copy env example and set your production domain:

```bash
cd desktop
cp .env.example .env
# Edit MOJO_APP_URL if not using the default Vercel URL
```

Sync URL into Tauri config:

```bash
export MOJO_APP_URL=https://your-app.vercel.app   # or source .env
npm run sync:url
```

---

## Develop locally

Terminal 1 — Next.js web app:

```bash
# repo root
npm run dev
```

Terminal 2 — desktop shell (loads `http://127.0.0.1:3000/login`):

```bash
cd desktop
npm install
npm run dev
```

To point dev at production instead:

```bash
MOJO_APP_URL=https://mcs-pms.vercel.app npm run dev
```

---

## Build installers

```bash
cd desktop
npm install
export MOJO_APP_URL=https://your-app.vercel.app
npm run build
```

Artifacts:

| OS | Output |
|----|--------|
| **macOS** | `src-tauri/target/release/bundle/dmg/*.dmg` and `.app` |
| **Windows** | `src-tauri/target/release/bundle/msi/*.msi` and `nsis/*.exe` |

Ship the `.msi` / `.dmg` to staff internally. Unsigned builds may show Smart Gatekeeper / Defender warnings until you code-sign (optional for pilot).

---

## GitHub Actions (Windows + Mac)

Workflow: [`.github/workflows/desktop-build.yml`](../.github/workflows/desktop-build.yml)

1. GitHub → **Actions** → **Desktop builds** → **Run workflow**
2. Set **App URL** (e.g. `https://mcs-pms.vercel.app`)
3. Download artifacts from the completed run

---

## Custom icon

Replace default Tauri icons with your brand:

```bash
# 1024×1024 PNG recommended (export from public/icon.svg)
cd desktop
npm run tauri icon path/to/mojo-icon-1024.png
npm run build
```

---

## Test after install

1. Sign in as owner or staff
2. Complete MFA (SMS/WhatsApp)
3. Password reset email link (opens in-app)
4. Staff invite link
5. Realtime updates (complaints board)

---

## Not included

- Offline mode
- Guest portal (keep in browser on guest phones)
- Embedded secrets — only loads your public HTTPS URL
