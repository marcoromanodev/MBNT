const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed. Use POST.' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json(500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const lineItems = sanitizeLineItems(body);
  if (!lineItems.length) {
    return json(400, { error: 'Request must include lineItems or cart with valid Stripe price IDs.' });
  }

  const successUrl = typeof body.successUrl === 'string' && body.successUrl ? body.successUrl : 'https://maybenot.com/success.html';
  const cancelUrl = typeof body.cancelUrl === 'string' && body.cancelUrl ? body.cancelUrl : 'https://maybenot.com/cart.html';

  const payload = {
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl
  };

  try {
    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toFormBody(payload)
    });

    const stripePayload = await response.json();
    if (!response.ok) {
      const message = stripePayload?.error?.message || 'Stripe session creation failed.';
      return json(response.status, { error: message });
    }

    return json(200, {
      id: stripePayload.id,
      url: stripePayload.url
    });
  } catch (error) {
    return json(500, { error: error.message || 'Unable to create checkout session.' });
  }
};
