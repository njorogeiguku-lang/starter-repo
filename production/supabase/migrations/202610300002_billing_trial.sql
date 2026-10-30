create table if not exists public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reference text not null unique check (reference ~ '^[A-Za-z0-9.-]{12,100}$'),
  tier text not null check (tier in ('solo', 'studio', 'agency')),
  plan_code text not null,
  plan_amount integer not null check (plan_amount > 0),
  plan_currency text not null check (plan_currency ~ '^[A-Z]{3}$'),
  verification_amount integer not null default 300 check (verification_amount = 300),
  status text not null default 'initializing' check (status in ('initializing', 'awaiting_payment', 'payment_verified', 'refund_pending', 'creating_subscription', 'subscribed', 'failed')),
  provider_transaction_id bigint,
  trial_ends_at timestamptz,
  authorization_ciphertext text,
  customer_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_checkouts_user_created_idx on public.billing_checkouts(user_id, created_at desc);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checkout_reference text not null unique references public.billing_checkouts(reference),
  tier text not null check (tier in ('solo', 'studio', 'agency')),
  provider_subscription_code text not null unique,
  provider_email_token_ciphertext text not null,
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled', 'non_renewing', 'completed')),
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

alter table public.billing_checkouts enable row level security;
alter table public.billing_subscriptions enable row level security;

revoke all on public.billing_checkouts from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;

create policy billing_subscription_owner_read on public.billing_subscriptions
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_workspace_member(workspace_id)));

comment on table public.billing_checkouts is 'Server-managed payment attempts. Never expose card details or provider authorization codes to the browser.';
comment on table public.billing_subscriptions is 'Server-managed billing entitlement. Provider tokens are encrypted and may only be decrypted by the app server.';
