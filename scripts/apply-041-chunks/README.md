# Migration 041 — optional (not used by app)

This migration added `organizations`, `subscriptions`, and onboarding columns for a multi-tenant SaaS trial flow that was **removed** from the application.

**Do not apply** unless those tables already exist from a prior deploy.

If you already applied 041, the extra tables are harmless and unused. No rollback required.

The app uses direct owner signup (`/signup`) with property name — no plans, trials, or `/get-started` wizard.
