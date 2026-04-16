#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSigningSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const allowedOrigin = process.env.STRIPE_ALLOWED_ORIGIN || '*';

const defaultSuccessUrl = process.env.STRIPE_SUCCESS_URL || 'https://maybenot.com/success.html';
const defaultCancelUrl = process.env.STRIPE_CANCEL_URL || 'https://maybenot.com/cart.html';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature'
  };
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders()
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function sanitizeLineItems(body) {
  const directItems = Array.isArray(body?.lineItems) ? body.lineItems : [];
  const direct = directItems
    .map((item) => ({
      price: typeof item?.price === 'string' ? item.price.trim() : '',
      quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Number(item.quantity)) : 1
    }))
    .filter((item) => item.price.startsWith('price_'));

  if (direct.length) return direct;

  const cartItems = Array.isArray(body?.cart) ? body.cart : [];
  return cartItems
    .map((item) => ({
      price: typeof item?.stripePriceId === 'string' ? item.stripePriceId.trim() : '',
      quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Number(item.quantity)) : 1
    }))
    .filter((item) => item.price.startsWith('price_'));
}

function toFormBody(params) {
  const form = new URLSearchParams();
  params.line_items.forEach((item, index) => {
    form.append(`line_items[${index}][price]`, item.price);
    form.append(`line_items[${index}][quantity]`, String(item.quantity));
  });
  form.append('mode', params.mode);
  form.append('success_url', params.success_url);
  form.append('cancel_url', params.cancel_url);
  return form;
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
  if (!stripeSecretKey) {
    return jsonResponse(res, 500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  const rawBody = await readBody(req);
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid JSON body.' });
  }

  const lineItems = sanitizeLineItems(body);
  if (!lineItems.length) {
    return jsonResponse(res, 400, { error: 'Request must include lineItems or cart with valid Stripe price IDs.' });
  }

  const successUrl = typeof body.successUrl === 'string' && body.successUrl ? body.successUrl : defaultSuccessUrl;
  const cancelUrl = typeof body.cancelUrl === 'string' && body.cancelUrl ? body.cancelUrl : defaultCancelUrl;

  const payload = {
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl
  };

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toFormBody(payload)
    });

    const stripePayload = await response.json();
    if (!response.ok) {
      const message = stripePayload?.error?.message || 'Stripe session creation failed.';
      return jsonResponse(res, response.status, { error: message });
    }

    return jsonResponse(res, 200, {
      id: stripePayload.id,
      url: stripePayload.url
    });
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to create checkout session.' });
  }
}

async function handleStripeWebhook(req, res) {
  const signatureHeader = req.headers['stripe-signature'];
  const rawBody = await readBody(req);

  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    return jsonResponse(res, 400, { error: 'Webhook signature verification failed.' });
  }

  return jsonResponse(res, 200, { received: true });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

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
