#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Missing VERCEL_TOKEN."
  echo "Create one at: https://vercel.com/account/tokens (log in with the McCaesar org account)"
  exit 1
fi

if [[ -z "${VERCEL_ORG_ID:-}" || -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "Missing VERCEL_ORG_ID and/or VERCEL_PROJECT_ID."
  echo "Open https://vercel.com → McCaesar org → mcs-pms → Settings → General"
  echo "Copy Team ID and Project ID from that page."
  exit 1
fi

mkdir -p .vercel
cat > .vercel/project.json <<EOF
{
  "orgId": "${VERCEL_ORG_ID}",
  "projectId": "${VERCEL_PROJECT_ID}"
}
EOF

echo "Deploying to mcs-pms production..."
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"

echo ""
echo "Done. Test: https://mcs-pms.vercel.app/login (incognito)"
