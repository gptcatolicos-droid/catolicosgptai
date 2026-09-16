'use strict';
// Suscripciones PayPal para el plan Premium de CatólicosGPT.
//
// Regla central: el estado de la suscripción SIEMPRE se confirma contra la API
// de PayPal. Nunca se activa un plan por lo que diga el navegador al volver del
// checkout, porque esa URL la puede escribir cualquiera a mano.
//
// PAYPAL_ENV controla el entorno y su valor por defecto es 'sandbox' a
// propósito: si alguien despliega credenciales de producción sin declararlo, la
// autenticación falla de forma visible en vez de empezar a cobrar de verdad.

const LIVE = 'https://api-m.paypal.com';
const SANDBOX = 'https://api-m.sandbox.paypal.com';

function settings() {
  const env = String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase();
  return {
    clientId: String(process.env.PAYPAL_CLIENT_ID || '').trim(),
    secret: String(process.env.PAYPAL_CLIENT_SECRET || '').trim(),
    env: env === 'live' ? 'live' : 'sandbox',
    base: env === 'live' ? LIVE : SANDBOX,
    planId: String(process.env.PAYPAL_PLAN_ID || '').trim(),
    webhookId: String(process.env.PAYPAL_WEBHOOK_ID || '').trim(),
    price: String(process.env.PAYPAL_PLAN_PRICE || '4.99').trim(),
    currency: String(process.env.PAYPAL_PLAN_CURRENCY || 'USD').trim().toUpperCase()
  };
}

function isConfigured() {
  const s = settings();
  return Boolean(s.clientId && s.secret);
}

// Listo para cobrar de verdad: hacen falta además el plan y el webhook.
function isReady() {
  const s = settings();
  return Boolean(s.clientId && s.secret && s.planId);
}

function status() {
  const s = settings();
  return {
    configured: isConfigured(),
    ready: isReady(),
    env: s.env,
    hasPlan: Boolean(s.planId),
    hasWebhook: Boolean(s.webhookId),
    price: s.price,
    currency: s.currency
  };
}

let cachedToken = null; // { value, expiresAt }

async function accessToken() {
  const s = settings();
  if (!s.clientId || !s.secret) throw new Error('paypal_not_configured');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;

  const res = await fetch(`${s.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${s.clientId}:${s.secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // El error más común aquí es tener credenciales de un entorno y PAYPAL_ENV
    // apuntando al otro: PayPal responde 401 aunque las claves sean válidas.
    throw new Error(`paypal_auth_failed_${res.status}_env_${s.env}`);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in || 0) * 1000) };
  return cachedToken.value;
}

async function api(method, path, body) {
  const s = settings();
  const token = await accessToken();
  const res = await fetch(`${s.base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!res.ok) {
    const detail = data?.details?.[0]?.description || data?.message || `http_${res.status}`;
    const err = new Error(`paypal_${res.status}: ${String(detail).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Creación del producto + plan de $4.99/mes. Es una acción con efecto real en la
// cuenta de PayPal, así que se dispara solo desde la consola de administración,
// una vez, y el id resultante se guarda en PAYPAL_PLAN_ID.
async function createMonthlyPlan(name = 'CatólicosGPT Premium') {
  const s = settings();
  const product = await api('POST', '/v1/catalogs/products', {
    name,
    description: 'Acceso Premium a CatólicosGPT: chat IA con fuentes del Magisterio sin límite diario.',
    type: 'SERVICE',
    category: 'SOFTWARE'
  });
  const plan = await api('POST', '/v1/billing/plans', {
    product_id: product.id,
    name: `${name} mensual`,
    description: `Suscripción mensual de ${s.currency} ${s.price}`,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: s.price, currency_code: s.currency } }
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    }
  });
  return { productId: product.id, planId: plan.id, env: s.env };
}

// Eventos mínimos que necesitamos: alta, bajas y fallos de cobro. Sin
// BILLING.SUBSCRIPTION.CANCELLED/EXPIRED un usuario seguiría siendo Premium
// después de dejar de pagar.
const WEBHOOK_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED'
];

async function listWebhooks() {
  const data = await api('GET', '/v1/notifications/webhooks');
  return (data.webhooks || []).map(w => ({ id: w.id, url: w.url, events: (w.event_types || []).map(e => e.name) }));
}

// Crea (o reutiliza) el webhook que apunta a nuestra URL. PayPal rechaza dos
// webhooks con la misma URL, así que si ya existe se devuelve el que hay.
async function createWebhook(url) {
  const existing = await listWebhooks().catch(() => []);
  const already = existing.find(w => w.url === url);
  if (already) return { ...already, reused: true };
  const data = await api('POST', '/v1/notifications/webhooks', {
    url,
    event_types: WEBHOOK_EVENTS.map(name => ({ name }))
  });
  return { id: data.id, url: data.url, events: (data.event_types || []).map(e => e.name), reused: false };
}

async function createSubscription({ userId, email, returnUrl, cancelUrl, brandName = 'CatólicosGPT' }) {
  const s = settings();
  if (!s.planId) throw new Error('paypal_plan_missing');
  const body = {
    plan_id: s.planId,
    // custom_id ata la suscripción a la cuenta: es lo que permite activar al
    // usuario correcto cuando llega el webhook, sin confiar en la sesión.
    custom_id: String(userId),
    application_context: {
      brand_name: brandName,
      locale: 'es-ES',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };
  if (email) body.subscriber = { email_address: email };
  const data = await api('POST', '/v1/billing/subscriptions', body);
  const approve = (data.links || []).find(l => l.rel === 'approve');
  if (!approve?.href) throw new Error('paypal_no_approval_link');
  return { id: data.id, status: data.status, approveUrl: approve.href };
}

async function getSubscription(id) {
  const data = await api('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  return {
    id: data.id,
    status: data.status, // APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
    userId: data.custom_id || null,
    nextBilling: data.billing_info?.next_billing_time || null,
    email: data.subscriber?.email_address || null
  };
}

async function cancelSubscription(id, reason = 'Cancelada por el usuario') {
  await api('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason });
  return true;
}

// Verificación de firma del webhook contra PayPal. Sin PAYPAL_WEBHOOK_ID no se
// puede verificar nada, así que en ese caso se rechaza: aceptar eventos sin
// verificar dejaría que cualquiera se regale el plan con un POST.
async function verifyWebhook(headers, event) {
  const s = settings();
  if (!s.webhookId) return false;
  const h = name => headers[name] || headers[name.toLowerCase()] || '';
  const payload = {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: s.webhookId,
    webhook_event: event
  };
  if (!payload.transmission_id || !payload.transmission_sig) return false;
  try {
    const data = await api('POST', '/v1/notifications/verify-webhook-signature', payload);
    return data.verification_status === 'SUCCESS';
  } catch (_) {
    return false;
  }
}

// Estados de PayPal que dan derecho a Premium.
function grantsAccess(subscriptionStatus) {
  return ['ACTIVE', 'APPROVED'].includes(String(subscriptionStatus || '').toUpperCase());
}

module.exports = {
  settings, isConfigured, isReady, status,
  createMonthlyPlan, createSubscription, getSubscription, cancelSubscription,
  createWebhook, listWebhooks, WEBHOOK_EVENTS,
  verifyWebhook, grantsAccess
};
