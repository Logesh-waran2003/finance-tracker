-- NOTE: These RLS policies are currently INERT. This app connects via plain Drizzle + postgres
-- directly as the superuser (see lib/db/index.ts, docker-compose.yml). auth.uid() is always NULL
-- and superusers bypass RLS unless FORCE ROW LEVEL SECURITY is set (it is not).
-- These policies only take effect if/when the app is migrated to Supabase Auth with per-request
-- roles and FORCE ROW LEVEL SECURITY added to each table.

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table branches enable row level security;
alter table customers enable row level security;
alter table dues enable row level security;
alter table collections enable row level security;
alter table attendance enable row level security;
alter table reconciliations enable row level security;
alter table expenses enable row level security;
alter table expense_categories enable row level security;
alter table cashbook_entries enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table agent_targets enable row level security;
alter table settings enable row level security;

-- Helper: get current user's role (security definer to avoid recursion)
create or replace function get_my_role()
returns user_role language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'ADMIN' and is_active = true)
$$;

create or replace function is_agent()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'COLLECTION_AGENT' and is_active = true)
$$;

-- ============================================================
-- SETTINGS — admin read/write, others read-only
-- ============================================================
create policy "settings_read" on settings for select using (auth.uid() is not null);
create policy "settings_admin_write" on settings for update using (is_admin());

-- ============================================================
-- BRANCHES — admin CRUD, others read
-- ============================================================
create policy "branches_read" on branches for select using (auth.uid() is not null);
create policy "branches_admin_insert" on branches for insert with check (is_admin());
create policy "branches_admin_update" on branches for update using (is_admin());
create policy "branches_admin_delete" on branches for delete using (is_admin());

-- ============================================================
-- PROFILES — users see their own, admins see all
-- ============================================================
create policy "profiles_own" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_own_update" on profiles for update using (id = auth.uid() or is_admin());
create policy "profiles_admin_insert" on profiles for insert with check (is_admin());

-- ============================================================
-- CUSTOMERS — agents see assigned, admins see all
-- ============================================================
create policy "customers_admin_all" on customers for all using (is_admin());
create policy "customers_agent_select" on customers for select using (
  is_agent() and assigned_agent_id = auth.uid()
);
create policy "customers_staff_select" on customers for select using (
  get_my_role() = 'STAFF'
);

-- ============================================================
-- DUES — follow customer access
-- ============================================================
create policy "dues_admin_all" on dues for all using (is_admin());
create policy "dues_agent_select" on dues for select using (
  is_agent() and exists(
    select 1 from customers where id = dues.customer_id and assigned_agent_id = auth.uid()
  )
);
create policy "dues_staff_select" on dues for select using (get_my_role() = 'STAFF');

-- ============================================================
-- COLLECTIONS — agents own theirs, admins see all
-- ============================================================
create policy "collections_admin_all" on collections for all using (is_admin());
create policy "collections_agent_own" on collections for select using (
  is_agent() and agent_id = auth.uid()
);
create policy "collections_agent_insert" on collections for insert with check (
  is_agent() and agent_id = auth.uid()
);
create policy "collections_agent_cancel" on collections for update using (
  is_agent() and agent_id = auth.uid() and status = 'PENDING'
);
create policy "collections_staff_select" on collections for select using (get_my_role() = 'STAFF');

-- ============================================================
-- ATTENDANCE — own record or admin
-- ============================================================
create policy "attendance_admin_all" on attendance for all using (is_admin());
create policy "attendance_own_select" on attendance for select using (employee_id = auth.uid());
create policy "attendance_own_checkin" on attendance for insert with check (employee_id = auth.uid());
create policy "attendance_own_checkout" on attendance for update using (
  employee_id = auth.uid() and check_out_at is null
);

-- ============================================================
-- RECONCILIATION — own or admin
-- ============================================================
create policy "recon_admin_all" on reconciliations for all using (is_admin());
create policy "recon_agent_own" on reconciliations for select using (agent_id = auth.uid());
create policy "recon_agent_insert" on reconciliations for insert with check (
  is_agent() and agent_id = auth.uid()
);
create policy "recon_agent_update_pending" on reconciliations for update using (
  agent_id = auth.uid() and status = 'PENDING'
);

-- ============================================================
-- EXPENSES — own or admin
-- ============================================================
create policy "expenses_admin_all" on expenses for all using (is_admin());
create policy "expenses_own_select" on expenses for select using (employee_id = auth.uid());
create policy "expenses_own_insert" on expenses for insert with check (employee_id = auth.uid());
create policy "expenses_own_update_pending" on expenses for update using (
  employee_id = auth.uid() and status = 'PENDING'
);
create policy "expense_categories_read" on expense_categories for select using (auth.uid() is not null);
create policy "expense_categories_admin" on expense_categories for all using (is_admin());

-- ============================================================
-- CASHBOOK — admin only write, all read
-- ============================================================
create policy "cashbook_read" on cashbook_entries for select using (auth.uid() is not null);
create policy "cashbook_admin_write" on cashbook_entries for insert with check (is_admin());

-- ============================================================
-- NOTIFICATIONS — own only
-- ============================================================
create policy "notifications_own" on notifications for select using (recipient_id = auth.uid());
create policy "notifications_own_update" on notifications for update using (recipient_id = auth.uid());
create policy "notifications_admin_insert" on notifications for insert with check (is_admin() or auth.uid() is not null);

-- ============================================================
-- AUDIT LOGS — admin read all, system inserts
-- ============================================================
create policy "audit_admin_read" on audit_logs for select using (is_admin());
create policy "audit_insert" on audit_logs for insert with check (auth.uid() is not null);

-- ============================================================
-- AGENT TARGETS — admin CRUD, agents read own
-- ============================================================
create policy "targets_admin_all" on agent_targets for all using (is_admin());
create policy "targets_agent_own" on agent_targets for select using (agent_id = auth.uid());
