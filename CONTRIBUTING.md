# Contributing to Abɔfa PMS

Thank you for building with us. This guide explains how our team uses Git, GitHub, and pull requests so multiple developers can work in parallel without stepping on each other.

**Team lead:** read [Team lead checklist](#team-lead-checklist) first.  
**Developers:** read [Daily workflow](#daily-workflow-for-developers) before your first PR.

Related docs: [README.md](README.md) (roadmap), [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) (code patterns), [ARCHITECTURE.md](ARCHITECTURE.md) (system design).

---

## Branch strategy (the short version)

| Branch | Purpose | Who merges |
|--------|---------|------------|
| `main` | Production-ready code; Vercel production deploys from here | Lead (via approved PR only) |
| `develop` | Optional integration branch during heavy parallel work in a phase | Lead |
| `feature/*` | All feature work — **one branch per issue/PR** | Author opens PR → review → merge |

We do **not** use personal branches (`john/dev`). We do **not** commit directly to `main`.

**Phases** (Phase 0, Phase 1, …) are tracked with:

- GitHub **Milestones** (group issues)
- Git **tags** on `main` when a phase completes (e.g. `v0.1.0-phase1`)
- Optional short-lived `phase/N-integration` branches (lead only, max ~2 weeks) — see below

---

## Branch naming

```text
feature/<phase>-<short-description>
```

| Phase | Prefix | Example |
|-------|--------|---------|
| Phase 0 (UI) | `p0` | `feature/p0-guest-modal-center` |
| Phase 1 (Foundation) | `p1` | `feature/p1-api-reservations` |
| Phase 2 (Operations) | `p2` | `feature/p2-housekeeping-kanban-api` |
| Phase 3 (Ghana/payments) | `p3` | `feature/p3-gra-export-csv` |
| Phase 4 (Channels/SaaS) | `p4` | `feature/p4-ical-sync` |
| Phase 5 (Launch) | `p5` | `feature/p5-e2e-reservations` |
| Bugfix | `fix` | `fix/p1-reservation-date-timezone` |
| Chore (deps, CI) | `chore` | `chore/add-eslint-ci` |

Rules:

- Lowercase, hyphens only (no spaces).
- Keep names under ~50 characters.
- One logical change per branch (one GitHub issue).

---

## Daily workflow for developers

### 1. Pick up work

1. Find an assigned issue in the GitHub project board (status: **Ready**).
2. Comment on the issue: “Taking this” so nobody duplicates effort.
3. Move the issue to **In progress**.

### 2. Create a branch from latest `main`

```bash
git checkout main
git pull origin main
git checkout -b feature/p1-api-guests
```

If the team uses `develop` for the current phase:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/p1-api-guests
```

### 3. Work in small commits

```bash
git add .
git commit -m "feat(api): add GET /api/guests with property filter"
```

**Commit message format** (recommended):

```text
<type>(<scope>): <short summary>

feat     — new feature
fix      — bug fix
chore    — tooling, deps, no production code change
docs     — documentation only
refactor — code change, no behavior change
test     — tests only
```

Examples:

- `feat(auth): add login page and session middleware`
- `fix(reservations): prevent double booking same room`
- `docs(readme): update Phase 1 checklist`

### 4. Stay up to date

Rebase or merge `main` (or `develop`) frequently to avoid huge conflicts:

```bash
git fetch origin
git merge origin/main
# resolve conflicts if any, then:
git push origin feature/p1-api-guests
```

### 5. Open a pull request

1. Push your branch: `git push -u origin feature/p1-api-guests`
2. Open a PR on GitHub against `main` (or `develop` if that’s the integration branch).
3. Fill out the PR template completely.
4. Link the issue: `Closes #12` in the PR description.
5. Request review from the lead or code owner.
6. Move issue to **In review**.

### 6. After merge

1. Delete your remote branch (GitHub offers a button after merge).
2. Pull latest locally: `git checkout main && git pull`
3. Issue moves to **Done**.

---

## Pull request rules

- **One PR per issue** — avoid “kitchen sink” PRs.
- **Target size:** aim for &lt; 400 lines changed when possible.
- **Must pass:** `npm run build` (and `npm run lint` when CI is added).
- **Must include:** description, test plan, phase label.
- **Must not include:** secrets (`.env`, API keys), unrelated refactors.
- **Reviews:** at least **1 approval** before merge to `main`.
- **Merge method:** **Squash and merge** (keeps `main` history readable for new contributors).

---

## Phase completion (for the whole team)

Phases are **not** long-lived parallel universes. When Phase 1 is done:

1. All Phase 1 PRs are merged to `main`.
2. Lead runs full test plan (see README Phase 1.5 vertical slice).
3. Lead tags: `git tag -a v0.1.0-phase1 -m "Phase 1: foundation complete"` and `git push origin v0.1.0-phase1`.
4. Close the **Phase 1 – Foundation** milestone on GitHub.
5. Open Phase 2 milestone and issues.

### Optional: short-lived phase integration branch

Use only if many features must land together before `main` (small team, ~1–2 week window):

```bash
git checkout main && git pull
git checkout -b phase/1-integration
git push -u origin phase/1-integration
```

Feature PRs target `phase/1-integration` instead of `main`. When the phase checklist is complete, **one PR** merges `phase/1-integration` → `main`, then **delete** `phase/1-integration`.

Do not keep phase branches open across multiple months.

---

## Team lead checklist

### One-time GitHub setup

- [ ] Create repo `abofa-pms` under your organisation (private).
- [ ] Push Phase 0 UI as initial commit on `main`.
- [ ] Tag prototype: `v0.0.0-phase0-ui`.
- [ ] Enable branch protection on `main`:
  - Require pull request before merging
  - Require 1 approval
  - Dismiss stale approvals when new commits are pushed
  - Do not allow bypassing (including admins, unless you need an emergency escape hatch)
- [ ] Add collaborators with appropriate roles (maintain vs write).
- [ ] Connect Vercel: preview deploys on PRs, production on `main`.
- [ ] Create GitHub labels: `phase-0` … `phase-5`, `bug`, `enhancement`, `api`, `ui`, `blocked`, `good first issue`.
- [ ] Create Project board: **Backlog → Ready → In progress → In review → Done**.

### Phase 1 kickoff issues (create these first)

Copy each row into a GitHub issue under milestone **Phase 1 – Foundation**:

| # | Title | Suggested branch | Depends on |
|---|--------|------------------|------------|
| 1 | Add `.env.example` and document env vars | `chore/p1-env-example` | — |
| 2 | Set up Drizzle + Neon PostgreSQL connection | `feature/p1-database-setup` | — |
| 3 | Define core DB schema + migrations | `feature/p1-database-schema` | #2 |
| 4 | Seed script from mock data | `feature/p1-database-seed` | #3 |
| 5 | Better Auth: login, logout, sessions | `feature/p1-auth` | #3 |
| 6 | Protect dashboard routes + role middleware | `feature/p1-auth-guards` | #5 |
| 7 | API: properties CRUD | `feature/p1-api-properties` | #3, #6 |
| 8 | API: rooms (by propertyId) | `feature/p1-api-rooms` | #3, #6 |
| 9 | API: guests CRUD | `feature/p1-api-guests` | #3, #6 |
| 10 | API: reservations CRUD | `feature/p1-api-reservations` | #8, #9 |
| 11 | API: housekeeping tasks PATCH | `feature/p1-api-tasks` | #8 |
| 12 | Wire property context to API | `feature/p1-ui-property-api` | #7 |
| 13 | Wire reservations table to API | `feature/p1-ui-reservations` | #10, #12 |
| 14 | Wire room status grid to API | `feature/p1-ui-room-status` | #8, #10 |
| 15 | Vertical slice: booking → occupied room → task | `feature/p1-vertical-slice` | #10, #11, #13, #14 |

**Parallelism after #3 and #6 merge:** issues #7–#11 can split across developers. UI issues (#12–#14) wait for their APIs.

### Definition of done — Phase 1

Do not close the milestone until this story works on staging:

> Admin logs in → selects property → views rooms/reservations → creates booking → room shows **occupied** → housekeeping task in **To Do** → refresh preserves data.

---

## Code standards

- **TypeScript** — no `any` unless commented why.
- **Match existing patterns** — read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) before new components.
- **API routes** — validate with Zod; scope by `organization_id` / `property_id`.
- **UI** — use design tokens in `app/globals.css`; prefer explicit text colors where Tailwind semantic utilities fail (`#111827`, `#5f6b78`).
- **Secrets** — never commit `.env`; use `.env.example` with placeholder keys only.
- **Scope** — one issue per PR; no drive-by refactors.

---

## Local setup

```bash
git clone https://github.com/McCaesar-Technology-Solutions/mcs-pms.git
cd abofa-pms
npm install
cp .env.example .env.local   # after Phase 1.1 lands
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

---

## Getting help

- **Blocked on a dependency?** Comment on your issue, add label `blocked`, pick another **Ready** issue if possible.
- **Architecture question?** Ask in the team channel; update [ARCHITECTURE.md](ARCHITECTURE.md) if the decision affects everyone.
- **Merge conflict?** Pull latest `main`, merge into your branch, resolve locally, push again.

---

## What good looks like

```text
Issue #9  →  branch feature/p1-api-guests  →  PR #24  →  review  →  squash merge to main  →  delete branch
```

Phases advance on `main` with tags — not by hoarding work on stale branches.

Welcome aboard.
