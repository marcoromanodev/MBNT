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
  if (params.customer_creation) {
    form.append('customer_creation', params.customer_creation);
  }
  if (params.customer_email) {
    form.append('customer_email', params.customer_email);
  }
  return form;
}

async function stripeApiRequest(path, options = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      ...(options.contentType ? { 'Content-Type': options.contentType } : {})
    },
    body: options.body
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || 'Stripe API request failed.';
    throw new Error(message);
  }
  return payload;
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
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';

  const payload = {
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl.includes('?')
      ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
      : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    customer_creation: 'always',
    customer_email: customerEmail
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

async function handleVerifyReturn(req, res, requestUrl) {
  const requestOrigin = req.headers.origin || '';
  if (!stripeSecretKey) {
    return jsonResponse(res, 500, { error: 'Missing STRIPE_SECRET_KEY.' }, requestOrigin);
  }

  const sessionId = (requestUrl.searchParams.get('session_id') || '').trim();
  const paymentIntentId = (requestUrl.searchParams.get('payment_intent') || '').trim();
  if (!sessionId && !paymentIntentId) {
    return jsonResponse(res, 400, { error: 'session_id or payment_intent is required.' }, requestOrigin);
  }

  try {
    if (sessionId) {
      const session = await stripeApiRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
      const paid = session.payment_status === 'paid' || session.status === 'complete';
      const email = session.customer_details?.email || session.customer_email || '';
      return jsonResponse(res, 200, { paid, source: 'checkout_session', id: session.id, email }, requestOrigin);
    }

    const paymentIntent = await stripeApiRequest(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
    const paidStatuses = new Set(['succeeded', 'processing', 'requires_capture']);
    const paid = paidStatuses.has(String(paymentIntent.status || '').toLowerCase());
    const email = paymentIntent.receipt_email || paymentIntent.metadata?.customer_email || '';
    return jsonResponse(
      res,
      200,
      { paid, source: 'payment_intent', id: paymentIntent.id, status: paymentIntent.status, email },
      requestOrigin
    );
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to verify Stripe return status.' }, requestOrigin);
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

async function handleCreatePaymentIntent(req, res) {
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
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  const providedAmount = body.orderAmountCents ?? body.amountCents;
  const hasProvidedAmount = providedAmount !== undefined && providedAmount !== null && providedAmount !== '';
  const normalizedProvidedAmount = hasProvidedAmount ? Number(providedAmount) : null;
  if (hasProvidedAmount && (!Number.isInteger(normalizedProvidedAmount) || normalizedProvidedAmount <= 0)) {
    return jsonResponse(res, 400, { error: 'orderAmountCents must be a positive integer.' }, requestOrigin);
  }

  try {
    const priceCache = new Map();
    let currency = '';
    let amount = 0;

    for (const item of lineItems) {
      if (!priceCache.has(item.price)) {
        const price = await stripeApiRequest(`/v1/prices/${encodeURIComponent(item.price)}`);
        priceCache.set(item.price, price);
      }
      const priceData = priceCache.get(item.price);
      const unitAmount = Number(priceData?.unit_amount || 0);
      if (!unitAmount) {
        throw new Error(`Stripe price ${item.price} is missing unit_amount.`);
      }
      if (!currency) {
        currency = String(priceData.currency || 'usd').toLowerCase();
      }
      if (currency !== String(priceData.currency || '').toLowerCase()) {
        throw new Error('Cart contains mixed currencies, which is not supported.');
      }
      amount += unitAmount * item.quantity;
    }

    if (!amount || !currency) {
      throw new Error('Unable to calculate payment amount from Stripe prices.');
    }

    const finalAmount = hasProvidedAmount ? normalizedProvidedAmount : amount;

    const params = new URLSearchParams();
    params.set('amount', String(finalAmount));
    params.set('currency', currency);
    params.set('automatic_payment_methods[enabled]', 'true');
    if (customerEmail) {
      params.set('receipt_email', customerEmail);
      params.set('metadata[customer_email]', customerEmail);
    }
    const totals = body && typeof body.totals === 'object' && body.totals ? body.totals : {};
    const subtotal = Number(totals.subtotal);
    const tax = Number(totals.tax);
    const shipping = Number(totals.shipping);
    const total = Number(totals.total);
    if (Number.isFinite(subtotal)) params.set('metadata[subtotal]', subtotal.toFixed(2));
    if (Number.isFinite(tax)) params.set('metadata[tax]', tax.toFixed(2));
    if (Number.isFinite(shipping)) params.set('metadata[shipping]', shipping.toFixed(2));
    if (Number.isFinite(total)) params.set('metadata[total]', total.toFixed(2));
    if (Array.isArray(body.cart)) params.set('metadata[cart]', JSON.stringify(body.cart).slice(0, 450));

    const paymentIntent = await stripeApiRequest('/v1/payment_intents', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: params
    });

    return jsonResponse(
      res,
      200,
      {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret
      },
      requestOrigin
    );
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to create payment intent.' }, requestOrigin);
  }
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

    if (req.method === 'POST' && pathname === '/api/stripe/create-payment-intent') {
      return await handleCreatePaymentIntent(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/stripe/webhook') {
      return await handleStripeWebhook(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/stripe/verify-return') {
      return await handleVerifyReturn(req, res, requestUrl);
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
