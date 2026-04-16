#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSigningSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const renderGitCommit = process.env.RENDER_GIT_COMMIT || '';
const renderGitBranch = process.env.RENDER_GIT_BRANCH || '';
const renderServiceName = process.env.RENDER_SERVICE_NAME || '';

const defaultAllowedOrigins = [
  'https://maybenot.com',
  'https://www.maybenot.com',
  'http://localhost:4242',
  'http://127.0.0.1:4242'
];

const configuredAllowedOrigins = (process.env.STRIPE_ALLOWED_ORIGINS || process.env.STRIPE_ALLOWED_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = configuredAllowedOrigins.length ? configuredAllowedOrigins : defaultAllowedOrigins;

const defaultSuccessUrl = process.env.STRIPE_SUCCESS_URL || 'https://maybenot.com/success.html';
const defaultCancelUrl = process.env.STRIPE_CANCEL_URL || 'https://maybenot.com/cart.html';

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return allowedOrigins[0] || 'https://maybenot.com';
  }

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : '';
}

function corsHeaders(requestOrigin) {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    Vary: 'Origin'
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  return headers;
}

function jsonResponse(res, statusCode, payload, requestOrigin = '') {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(requestOrigin)
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
  const requestOrigin = req.headers.origin || '';

  if (!stripeSecretKey) {
    return jsonResponse(res, 500, { error: 'Missing STRIPE_SECRET_KEY.' }, requestOrigin);
  }

  const rawBody = await readBody(req);
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid JSON body.' }, requestOrigin);
  }

  const lineItems = sanitizeLineItems(body);
  if (!lineItems.length) {
    return jsonResponse(
      res,
      400,
      { error: 'Request must include lineItems or cart with valid Stripe price IDs.' },
      requestOrigin
    );
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
      return jsonResponse(res, response.status, { error: message }, requestOrigin);
    }

    return jsonResponse(
      res,
      200,
      {
        id: stripePayload.id,
        url: stripePayload.url
      },
      requestOrigin
    );
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to create checkout session.' }, requestOrigin);
  }
}

async function handleStripeWebhook(req, res) {
  const requestOrigin = req.headers.origin || '';
  const signatureHeader = req.headers['stripe-signature'];
  const rawBody = await readBody(req);

  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    return jsonResponse(res, 400, { error: 'Webhook signature verification failed.' }, requestOrigin);
  }

  return jsonResponse(res, 200, { received: true }, requestOrigin);
}

const server = createServer(async (req, res) => {
  const requestOrigin = req.headers.origin || '';
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname.replace(/\/+$/, '') || '/';
  try {
    if (req.method === 'OPTIONS') {
      const responseOrigin = getAllowedOrigin(requestOrigin);
      if (requestOrigin && !responseOrigin) {
        return jsonResponse(res, 403, { error: 'Origin not allowed by CORS.' }, requestOrigin);
      }

      res.writeHead(204, corsHeaders(requestOrigin));
      res.end();
      return;
    }

    if (req.method === 'POST' && pathname === '/api/stripe/create-checkout-session') {
      return await handleCreateCheckoutSession(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/stripe/webhook') {
      return await handleStripeWebhook(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/stripe/health') {
      return jsonResponse(
        res,
        200,
        {
          ok: true,
          hasStripeSecretKey: Boolean(stripeSecretKey),
          allowedOrigins,
          service: renderServiceName || null,
          branch: renderGitBranch || null,
          commit: renderGitCommit || null
        },
        requestOrigin
      );
    }

    return jsonResponse(res, 404, { error: 'Not found.' }, requestOrigin);
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Internal server error.' }, requestOrigin);
  }
});

server.listen(port, () => {
  console.log(`Stripe checkout server listening on http://localhost:${port}`);
});
