-- Seed demo data
-- NOTE: Users must be created via auth.users first (done via Supabase admin API in setup script)
-- This seed creates branch and settings data only
-- Users are seeded via supabase/seed-users.ts script

-- Demo branch
insert into branches (name, code, address, city, state, phone, email) values
  ('Head Office', 'HO-001', '123 Main Street', 'Chennai', 'Tamil Nadu', '+91-9876543210', 'admin@demo.com'),
  ('South Branch', 'SO-001', '456 Anna Salai', 'Chennai', 'Tamil Nadu', '+91-9876543211', 'south@demo.com')
on conflict (code) do nothing;
