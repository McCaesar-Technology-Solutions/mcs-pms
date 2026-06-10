-- MOJO APARTMENTS seed data
-- Auth users and profiles are created via: npm run seed
-- (scripts/seed.mjs uses Supabase Admin API for auth.users + full dataset)

-- After running migrations, configure .env.local then:
--   npm run seed

-- The seed script creates:
--   1 hotel (MOJO APARTMENTS, Accra)
--   5 staff accounts (owner, manager, 3 technicians)
--   30 rooms across 3 floors
--   10 active guests with portal tokens
--   20 reservations
--   15 complaints with timeline events (3 pending_approval, 2 rejected, 1 urgent open)
