# Access Agent installers (local cache only)

Production downloads use **GitHub Releases**:

https://github.com/McCaesar-Technology-Solutions/mcs-pms/releases/tag/access-agent-v1.3.8

## Publish a new version

1. Build: `npm run access-agent:dist:mac` (and Windows if needed)
2. Copy stable names: `npm run publish:access-agent`
3. Create/update the release:

```bash
gh release create "access-agent-vX.Y.Z" \
  --title "MOJO Access Agent X.Y.Z" \
  --notes "Desktop agent for Hikvision door access." \
  "public/downloads/access-agent/MOJO-Access-Agent-mac.dmg" \
  "public/downloads/access-agent/MOJO-Access-Agent-mac.zip" \
  "public/downloads/access-agent/MOJO-Access-Agent-windows-setup.exe" \
  "public/downloads/access-agent/MOJO-Access-Agent-windows.exe"
```

4. Bump `ACCESS_AGENT_VERSION` default in `lib/access/agent-downloads.ts` (or set `NEXT_PUBLIC_ACCESS_AGENT_VERSION`).

Binaries here are gitignored (~100MB each) — use them only as a local staging area before `gh release create`.
