const heading = document.getElementById('heading');
const lede = document.getElementById('lede');
const plansEl = document.getElementById('plans');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('trial-status');
const params = new URLSearchParams(location.search);
let busy = false;

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function showMessage(text, kind = '') { messageEl.textContent = text; messageEl.className = `message ${kind}`; messageEl.hidden = false; }
function formatPrice(amount, currency) {
  const value = Number(amount) / 100;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'not available' : date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }); }

async function postJson(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || result.message || 'That request could not be completed.');
  return result;
}

function renderPlans(plans) {
  plansEl.innerHTML = plans.map(plan => `<article class="plan"><span class="tier-label">30 days free</span><h2>${escapeHtml(plan.name)}</h2><div class="price">${escapeHtml(formatPrice(plan.amount, plan.currency))}<span class="interval"> / month</span></div><p class="plan-note">Choose card for a free trial with monthly auto-renewal, or pay by bank for 30 days with no auto-renewal.</p><button type="button" data-tier="${escapeHtml(plan.tier)}">Start card trial</button><label class="bank-consent"><input type="checkbox" data-bank-consent="${escapeHtml(plan.tier)}"><span>Pay once for 30 days. No automatic renewal.</span></label><button type="button" class="bank-button" data-bank-tier="${escapeHtml(plan.tier)}" disabled>Pay directly from bank</button></article>`).join('');
  const consent = document.getElementById('billing-consent');
  const updateButtons = () => plansEl.querySelectorAll('[data-tier]').forEach(button => { button.disabled = !consent.checked; });
  consent.onchange = updateButtons; updateButtons();
  plansEl.querySelectorAll('[data-tier]').forEach(button => button.addEventListener('click', () => startCheckout(button.dataset.tier, button)));
  plansEl.querySelectorAll('[data-bank-consent]').forEach(checkbox => checkbox.addEventListener('change', () => {
    plansEl.querySelector(`[data-bank-tier="${checkbox.dataset.bankConsent}"]`).disabled = !checkbox.checked;
  }));
  plansEl.querySelectorAll('[data-bank-tier]').forEach(button => button.addEventListener('click', () => startBankCheckout(button.dataset.bankTier, button)));
}

async function startCheckout(tier, button) {
  if (busy) return;
  busy = true; button.disabled = true; button.textContent = 'Opening secure checkout…';
  try {
    const result = await postJson('/api/billing/start', { tier, consent: document.getElementById('billing-consent').checked });
    if (!result.checkoutUrl || !result.checkoutUrl.startsWith('https://checkout.paystack.com/')) throw new Error('Paystack did not return a secure checkout page.');
    location.assign(result.checkoutUrl);
  } catch (error) {
    showMessage(error.message, 'error'); button.disabled = false; button.textContent = 'Try again'; busy = false;
  }
}

async function startBankCheckout(tier, button) {
  if (busy) return;
  busy = true; button.disabled = true; button.textContent = 'Opening bank checkout…';
  try {
    const consent = plansEl.querySelector(`[data-bank-consent="${tier}"]`).checked;
    const result = await postJson('/api/billing/start-bank', { tier, consent });
    if (!result.checkoutUrl || !result.checkoutUrl.startsWith('https://checkout.paystack.com/')) throw new Error('Paystack did not return a secure checkout page.');
    location.assign(result.checkoutUrl);
  } catch (error) { showMessage(error.message, 'error'); button.disabled = false; button.textContent = 'Try again'; busy = false; }
}

async function confirmCheckout(reference, isBank = false) {
  heading.textContent = isBank ? 'Confirming your bank payment' : 'Confirming your card verification';
  lede.textContent = isBank ? 'Paystack is securely checking your bank transfer. It may take a moment to confirm.' : 'Paystack is confirming the refundable KES 3 verification and scheduling your first monthly payment for after the 30-day trial.';
  plansEl.innerHTML = '<div class="loading">Securely checking the payment status…</div>';
  try {
    const result = await postJson(isBank ? '/api/billing/confirm-bank' : '/api/billing/confirm', { reference });
    if (result.pending) { plansEl.innerHTML = ''; showMessage(result.message || 'Your checkout is still processing. Refresh this page shortly.', ''); return; }
    plansEl.innerHTML = '';
    if (isBank) {
      showMessage(`Bank payment confirmed. Your ${result.tier} plan is active until ${dateLabel(result.currentPeriodEnd)}. It will not renew automatically.`, 'success');
      renderTrial({ tier: result.tier, status: 'active', currentPeriodEnd: result.currentPeriodEnd, paymentMethod: 'bank', autoRenew: false });
      return;
    }
    showMessage(`Your 30-day trial is active until ${dateLabel(result.trialEndsAt)}. The KES 3 verification refund has been requested.`, 'success');
    renderTrial({ tier: result.tier, status: 'trialing', trialEndsAt: result.trialEndsAt });
  } catch (error) { plansEl.innerHTML = ''; showMessage(error.message, 'error'); }
}

function renderTrial(subscription) {
  if (!subscription) return;
  document.getElementById('consent-wrap').hidden = true;
  const state = subscription.status === 'trialing' ? `Your ${subscription.tier} plan is in its free trial until ${dateLabel(subscription.trialEndsAt)}.`
    : subscription.status === 'active' && subscription.paymentMethod === 'bank' ? `Your ${subscription.tier} plan is active through ${dateLabel(subscription.currentPeriodEnd)}. It will not renew automatically.`
    : subscription.status === 'active' ? `Your ${subscription.tier} plan is active. Next billing date: ${dateLabel(subscription.currentPeriodEnd)}.`
    : subscription.status === 'past_due' ? 'Your last payment needs attention. Update your card through Paystack or contact support.'
    : `Subscription status: ${subscription.status}.`;
  heading.textContent = 'Your FlowForge plan';
  lede.textContent = state;
  plansEl.innerHTML = '';
  const canCancel = subscription.autoRenew !== false && ['trialing', 'active', 'past_due', 'non_renewing'].includes(subscription.status);
  statusEl.hidden = false;
  statusEl.innerHTML = `<div class="trial-card"><strong>${escapeHtml(state)}</strong><p>Plan: ${escapeHtml(subscription.tier)}${subscription.paymentMethod === 'bank' ? ' · paid directly from bank · no auto-renewal' : subscription.amount && subscription.currency ? ` · ${escapeHtml(formatPrice(subscription.amount, subscription.currency))} per month after trial` : ''}</p>${canCancel ? '<button class="action" id="cancel-subscription">Cancel subscription</button>' : ''}<a class="footer" href="/">Open FlowForge</a></div>`;
  document.getElementById('cancel-subscription')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'Cancelling…';
    try { await postJson('/api/billing/cancel', {}); showMessage('Subscription cancelled. No future subscription charge will be made.', 'success'); await load(); }
    catch (error) { showMessage(error.message, 'error'); button.disabled = false; button.textContent = 'Cancel subscription'; }
  });
}

async function load() {
  const sessionResponse = await fetch('/api/session', { credentials: 'same-origin' });
  const session = await sessionResponse.json().catch(() => ({}));
  if (session.authRequired && !session.authenticated) {
    plansEl.innerHTML = '<div class="loading">Sign in to choose a FlowForge plan.</div>';
    lede.textContent = 'Create an account or sign in before choosing your 30-day trial.';
    return;
  }
  if (!session.authRequired) {
    plansEl.innerHTML = '<div class="loading">Billing becomes available after production account and payment setup. This local preview does not accept payments.</div>';
    return;
  }
  if (params.has('reference')) { await confirmCheckout(params.get('reference'), params.get('mode') === 'bank'); return; }
  const statusResponse = await fetch('/api/billing/status', { credentials: 'same-origin' });
  const billing = await statusResponse.json().catch(() => ({}));
  if (billing.subscription) { renderTrial(billing.subscription); if (billing.subscription.status === 'cancelled' || billing.subscription.status === 'completed') showMessage('This workspace has already used its trial or subscription. Contact support to restart billing.', ''); return; }
  if (!billing.configured) { plansEl.innerHTML = '<div class="loading">Payment setup is not complete. No card will be requested and no payment will be taken until Paystack is configured.</div>'; return; }
  const planResponse = await fetch('/api/billing/plans', { credentials: 'same-origin' });
  const planData = await planResponse.json().catch(() => ({}));
  if (!planResponse.ok || !Array.isArray(planData.plans) || !planData.plans.length) { plansEl.innerHTML = ''; showMessage(planData.error || 'Monthly plans are not available yet.', 'error'); return; }
  renderPlans(planData.plans);
}

load().catch(error => showMessage(error.message || 'Could not load billing information.', 'error'));
