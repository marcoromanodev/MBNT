#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSigningSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const storePath = process.env.STRIPE_STORE_PATH || 'stripe-runtime-store.json';

const defaultSuccessUrl =
  process.env.STRIPE_SUCCESS_URL ||
  'https://dashboard.stripe.com/workbench/blueprints/one-time-payment/checkout-chapter?confirmation-redirect=create-checkout-session';
const defaultCancelUrl =
  process.env.STRIPE_CANCEL_URL ||
  'https://dashboard.stripe.com/workbench/blueprints/one-time-payment/checkout-chapter?confirmation-redirect=create-checkout-session';

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload)}\n`);
}

function flattenFormBody(value, keyPrefix = '') {
  const entries = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const childKey = `${keyPrefix}[${index}]`;
      entries.push(...flattenFormBody(item, childKey));
    });
    return entries;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, childValue]) => {
      const childKey = keyPrefix ? `${keyPrefix}[${key}]` : key;
      entries.push(...flattenFormBody(childValue, childKey));
    });
    return entries;
  }

  if (value === undefined || value === null) {
    return entries;
  }

  entries.push([keyPrefix, String(value)]);
  return entries;
}

function toFormBody(params) {
  const body = new URLSearchParams();
  flattenFormBody(params).forEach(([key, val]) => body.append(key, val));
  return body;
}

async function stripeRequest(path, { method = 'GET', params } = {}) {
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params ? toFormBody(params) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe API request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

async function loadStore() {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      product_id: parsed.product_id || '',
      default_price_id: parsed.default_price_id || '',
      checkout_sessions: Array.isArray(parsed.checkout_sessions) ? parsed.checkout_sessions : [],
      completed_sessions: Array.isArray(parsed.completed_sessions) ? parsed.completed_sessions : []
    };
  } catch {
    return {
      product_id: '',
      default_price_id: '',
      checkout_sessions: [],
      completed_sessions: []
    };
  }
}

async function saveStore(store) {
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

async function ensureExampleProduct(store) {
  if (store.product_id && store.default_price_id) {
    return { productId: store.product_id, defaultPriceId: store.default_price_id };
  }

  const product = await stripeRequest('/v1/products', {
    method: 'POST',
    params: {
      name: 'Example Product',
      default_price_data: {
        currency: 'usd',
        unit_amount: 2000
      }
    }
  });

  store.product_id = product.id;
  store.default_price_id = product.default_price;
  await saveStore(store);

  return { productId: product.id, defaultPriceId: product.default_price };
}

function parseStripeSignatureHeader(headerValue = '') {
  return headerValue.split(',').reduce(
    (acc, part) => {
      const [k, v] = part.split('=');
      if (k === 't') acc.timestamp = v;
      if (k === 'v1') acc.signatures.push(v);
      return acc;
    },
    { timestamp: '', signatures: [] }
  );
}

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!webhookSigningSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable.');
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || !signatures.length) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', webhookSigningSecret).update(signedPayload, 'utf8').digest('hex');

  return signatures.some((provided) => {
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleCreateCheckoutSession(req, res) {
  const rawBody = await readBody(req);
  let body = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid JSON body.' });
  }

  const store = await loadStore();
  const { defaultPriceId } = await ensureExampleProduct(store);

  const session = await stripeRequest('/v1/checkout/sessions', {
    method: 'POST',
    params: {
      line_items: [
        {
          price: defaultPriceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: body.successUrl || defaultSuccessUrl,
      cancel_url: body.cancelUrl || defaultCancelUrl
    }
  });

  store.checkout_sessions.push({
    id: session.id,
    url: session.url,
    created: new Date().toISOString()
  });
  await saveStore(store);

  return jsonResponse(res, 200, {
    id: session.id,
    url: session.url,
    product_id: store.product_id,
    default_price_id: store.default_price_id
  });
}

async function handleStripeWebhook(req, res) {
  const signatureHeader = req.headers['stripe-signature'];
  const rawBody = await readBody(req);

  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    return jsonResponse(res, 400, { error: 'Webhook signature verification failed.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid webhook payload.' });
  }

  if (event.type === 'checkout.session.completed') {
    const store = await loadStore();
    store.completed_sessions.push({
      event_id: event.id,
      session_id: event.data?.object?.id || '',
      customer: event.data?.object?.customer || '',
      payment_status: event.data?.object?.payment_status || '',
      received: new Date().toISOString()
    });
    await saveStore(store);
  }

  return jsonResponse(res, 200, { received: true });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/stripe/create-checkout-session') {
      return await handleCreateCheckoutSession(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/stripe/webhook') {
      return await handleStripeWebhook(req, res);
    }

    if (req.method === 'GET' && req.url === '/api/stripe/health') {
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 404, { error: 'Not found.' });
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Internal server error.' });
  }
});

server.listen(port, () => {
  console.log(`Stripe checkout server listening on http://localhost:${port}`);
});
