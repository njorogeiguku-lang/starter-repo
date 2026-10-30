alter table public.billing_checkouts
  add column if not exists payment_mode text not null default 'card_trial';
alter table public.billing_checkouts
  add column if not exists trial_started_at timestamptz;
alter table public.billing_checkouts
  drop constraint if exists billing_checkouts_verification_amount_check;
alter table public.billing_checkouts
  alter column verification_amount drop not null,
  alter column verification_amount drop default;

alter table public.billing_checkouts
  drop constraint if exists billing_checkouts_payment_mode_check;
alter table public.billing_checkouts
  add constraint billing_checkouts_payment_mode_check check (payment_mode in ('card_trial', 'bank_once'));

alter table public.billing_checkouts
  drop constraint if exists billing_checkouts_status_check;
alter table public.billing_checkouts
  add constraint billing_checkouts_status_check check (status in ('initializing', 'awaiting_payment', 'payment_verified', 'refund_pending', 'creating_subscription', 'subscribed', 'bank_paid', 'failed'));

alter table public.billing_subscriptions
  alter column provider_subscription_code drop not null,
  alter column provider_email_token_ciphertext drop not null;
alter table public.billing_subscriptions
  add column if not exists payment_method text not null default 'card',
  add column if not exists auto_renew boolean not null default true;
alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_payment_method_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_payment_method_check check (payment_method in ('card', 'bank'));
