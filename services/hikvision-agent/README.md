# MOJO Hikvision Access Agent

On-site bridge between MOJO cloud and Hikvision access controllers on the apartment LAN.

**Device admin passwords stay only in this agent's `.env` — never in MOJO cloud.**

## Requirements

- Node.js 20+
- Always-on machine on the same LAN as Hikvision controllers (mini PC / NVR PC / Raspberry Pi)
- Controllers reachable via ISAPI (Digest auth)

## Setup (easiest)

1. In MOJO: Owner → **Access** → **Start setup** → **Copy full .env**
2. On this PC:

```bash
cd services/hikvision-agent
# paste into .env, edit only DEVICES host + password
npm install && npm start
```

Or interactive:

```bash
npm run setup
npm install && npm start
```

3. In MOJO, map doors using the same device key (e.g. `lobby`).
4. Status should show **Agent online** within ~30s.

### Device config

`DEVICES` is JSON:

```json
[
  {
    "key": "lobby",
    "host": "192.168.1.64",
    "port": 80,
    "username": "admin",
    "password": "YOUR_DEVICE_PASSWORD",
    "useHttps": false
  }
]
```

`key` must match **Device key** on door mappings in MOJO.

## Operations

| Job | When |
|-----|------|
| `provision` | Guest check-in |
| `revoke` | Checkout / walkout |
| `update_validity` | Stay extend |
| `assign_card` | Staff assigns card number |
| `unlock` | Remote unlock from MOJO |

Agent polls every `POLL_INTERVAL_MS` (default 5000). Stuck claims are reclaimed by cloud cron `/api/cron/access-jobs`.

## Production checklist

- [ ] Run under systemd / Docker restart=always
- [ ] Restrict firewall: agent host → controllers only; outbound HTTPS to MOJO
- [ ] Do not commit `.env`
- [ ] Rotate agent token if the machine is compromised
- [ ] Verify one test check-in enrolls on a spare door before go-live
