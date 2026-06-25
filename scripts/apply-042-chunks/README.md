# Migration 042 — owner onboarding wizard

Adds `profiles.onboarding_step` and `profiles.onboarding_completed_at` for the `/get-started` first-run wizard.

**Apply this** if you use owner signup + guided setup. Safe to run after 041 (ignores org/subscription tables).

Existing owners with a linked property are marked as already onboarded.

If you applied migration 041, you already have these columns — 042 is a no-op for the `ADD COLUMN` parts.
