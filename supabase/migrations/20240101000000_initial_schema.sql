-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('ADMIN', 'COLLECTION_AGENT', 'STAFF');
create type employee_status as enum ('ACTIVE', 'INACTIVE');
create type attendance_status as enum ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF');
create type collection_status as enum ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');
create type due_status as enum ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
create type reconciliation_status as enum ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');
create type expense_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type payment_mode as enum ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');
create type notification_type as enum ('PENDING_CUSTOMER', 'MISSED_ATTENDANCE', 'CASH_HANDOVER', 'RECONCILIATION_DIFF', 'TARGET_ALERT', 'GENERAL');

-- ============================================================
-- SETTINGS (company / org level)
-- ============================================================
create table settings (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null default 'My Company',
  currency text not null default 'INR',
  currency_symbol text not null default '₹',
  timezone text not null default 'Asia/Kolkata',
  financial_year_start integer not null default 4, -- April
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one settings row
insert into settings (company_name) values ('Demo Company');

-- ============================================================
-- BRANCHES
-- ============================================================
create table branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique not null,
  address text,
  city text,
  state text,
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  role user_role not null default 'STAFF',
  branch_id uuid references branches(id),
  employee_code text unique,
  department text,
  designation text,
  joining_date date,
  avatar_url text,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Update last_login_at on sign in (via app logic, but also track here)
create or replace function update_last_login(user_id uuid)
returns void language plpgsql security definer as $$
begin
  update profiles set last_login_at = now() where id = user_id;
end;
$$;

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  customer_code text unique not null,
  full_name text not null,
  phone text,
  email text,
  address text,
  area text,
  city text,
  state text,
  pincode text,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  assigned_agent_id uuid references profiles(id),
  branch_id uuid references branches(id),
  opening_balance numeric(12,2) not null default 0,
  is_active boolean default true,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DUES
-- ============================================================
create table dues (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id),
  invoice_number text,
  reference text,
  amount numeric(12,2) not null check (amount > 0),
  outstanding_amount numeric(12,2) not null,
  due_date date,
  status due_status not null default 'OPEN',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recalculate outstanding on update (never silently overwrite)
create or replace function recalculate_due_outstanding()
returns trigger language plpgsql as $$
declare
  paid numeric(12,2);
begin
  select coalesce(sum(amount), 0) into paid
  from collections
  where due_id = new.id and status = 'CONFIRMED';
  
  new.outstanding_amount := greatest(new.amount - paid, 0);
  
  if new.outstanding_amount = 0 then
    new.status := 'PAID';
  elsif new.outstanding_amount < new.amount then
    new.status := 'PARTIALLY_PAID';
  elsif new.due_date < current_date and new.status = 'OPEN' then
    new.status := 'OVERDUE';
  end if;
  
  return new;
end;
$$;

-- ============================================================
-- COLLECTIONS (immutable — no hard delete, only cancel)
-- ============================================================
create table collections (
  id uuid primary key default uuid_generate_v4(),
  collection_number text unique not null,
  customer_id uuid not null references customers(id),
  due_id uuid references dues(id),
  agent_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_mode payment_mode not null default 'CASH',
  payment_reference text,
  receipt_url text,
  notes text,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gps_accuracy numeric(8,2),
  status collection_status not null default 'PENDING',
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  rejected_reason text,
  collected_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Idempotency: prevent double-submission
  idempotency_key text unique
);

-- Auto-generate collection number
create sequence collection_number_seq start 1000;
create or replace function generate_collection_number()
returns trigger language plpgsql as $$
begin
  if new.collection_number is null or new.collection_number = '' then
    new.collection_number := 'COL-' || lpad(nextval('collection_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger set_collection_number
  before insert on collections
  for each row execute function generate_collection_number();

-- After confirmed collection, update due outstanding
create trigger update_due_after_collection
  after insert or update on collections
  for each row
  when (new.due_id is not null)
  execute function recalculate_due_outstanding();

-- ============================================================
-- ATTENDANCE
-- ============================================================
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_gps_lat numeric(10,7),
  check_in_gps_lng numeric(10,7),
  check_in_gps_accuracy numeric(8,2),
  check_out_gps_lat numeric(10,7),
  check_out_gps_lng numeric(10,7),
  check_out_gps_accuracy numeric(8,2),
  total_hours numeric(4,2),
  status attendance_status not null default 'ABSENT',
  notes text,
  corrected_by uuid references profiles(id),
  corrected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, date)
);

-- Auto-calculate total hours
create or replace function calculate_attendance_hours()
returns trigger language plpgsql as $$
begin
  if new.check_in_at is not null and new.check_out_at is not null then
    new.total_hours := round(extract(epoch from (new.check_out_at - new.check_in_at)) / 3600.0, 2);
    if new.total_hours >= 8 then
      new.status := 'PRESENT';
    elsif new.total_hours >= 4 then
      new.status := 'HALF_DAY';
    end if;
  end if;
  return new;
end;
$$;
create trigger calc_hours_on_attendance
  before insert or update on attendance
  for each row execute function calculate_attendance_hours();

-- ============================================================
-- CASH RECONCILIATION
-- ============================================================
create table reconciliations (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  date date not null,
  cash_collected numeric(12,2) not null default 0,
  cash_submitted numeric(12,2) not null default 0,
  difference numeric(12,2) generated always as (cash_collected - cash_submitted) stored,
  status reconciliation_status not null default 'PENDING',
  notes text,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- EXPENSES
-- ============================================================
create table expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  description text,
  is_active boolean default true
);

insert into expense_categories (name) values
  ('Travel'), ('Food'), ('Office Supplies'), ('Communication'), ('Utilities'), ('Miscellaneous');

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references expense_categories(id),
  employee_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_mode payment_mode not null default 'CASH',
  description text not null,
  receipt_url text,
  expense_date date not null,
  status expense_status not null default 'PENDING',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CASHBOOK (append-only ledger)
-- ============================================================
create table cashbook_entries (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid references branches(id),
  date date not null,
  entry_type text not null check (entry_type in ('OPENING', 'COLLECTION', 'EXPENSE', 'ADJUSTMENT', 'CLOSING')),
  payment_mode payment_mode,
  amount numeric(12,2) not null, -- positive = money-in, negative = money-out
  reference_id uuid, -- collection_id or expense_id
  description text,
  running_balance numeric(12,2), -- calculated by trigger
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- IN-APP NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references profiles(id),
  type notification_type not null,
  title text not null,
  body text not null,
  is_read boolean default false,
  reference_id uuid,
  reference_type text,
  created_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOG (append-only — no updates, no deletes)
-- ============================================================
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  actor_name text,
  action text not null, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT, ASSIGN, ROLE_CHANGE
  entity_type text not null, -- collection, customer, employee, attendance, etc.
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- ============================================================
-- AGENT DAILY TARGETS
-- ============================================================
create table agent_targets (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  date date not null,
  target_amount numeric(12,2) not null default 0,
  target_customers integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(agent_id, date)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_collections_agent on collections(agent_id);
create index idx_collections_customer on collections(customer_id);
create index idx_collections_status on collections(status);
create index idx_collections_date on collections(collected_at);
create index idx_dues_customer on dues(customer_id);
create index idx_dues_status on dues(status);
create index idx_attendance_employee_date on attendance(employee_id, date);
create index idx_customers_agent on customers(assigned_agent_id);
create index idx_customers_branch on customers(branch_id);
create index idx_notifications_recipient on notifications(recipient_id, is_read);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs(actor_id);
create index idx_reconciliations_agent_date on reconciliations(agent_id, date);
