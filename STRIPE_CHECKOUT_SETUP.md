# Stripe one-time Checkout integration

This project now uses a production-hosted server-side Stripe Checkout flow:

1. Frontend sends `lineItems` (or `cart`) to `POST /api/stripe/create-checkout-session`.
2. Server validates Stripe price IDs (`price_...`) and quantity values.
3. Server calls `POST /v1/checkout/sessions` with:
   - `line_items`
   - `mode=payment`
   - `success_url` and `cancel_url`
4. Server returns JSON `{ id, url }` to the browser.

## Production backend URL

- **Checkout API base:** `https://maybenot-stripe-api.onrender.com`
- **Create session endpoint:** `https://maybenot-stripe-api.onrender.com/api/stripe/create-checkout-session`
- **Health endpoint:** `https://maybenot-stripe-api.onrender.com/api/stripe/health`

`stripe-config.json` is now configured to call that exact create-session endpoint.

## Hosting / deployment

- Render blueprint is included in `render.yaml`.
- Runtime/start metadata is included in `package.json`.
- The backend entrypoint is `stripe-checkout-server.mjs`.

Deploy with Render Blueprint from this repo and service name `maybenot-stripe-api`.

## Required environment variables

Set these in your production host (Render service environment):

- `STRIPE_SECRET_KEY` (required)
- `STRIPE_WEBHOOK_SECRET` (required for webhook signature verification)
- `STRIPE_ALLOWED_ORIGINS=https://maybenot.com,https://www.maybenot.com`
- `STRIPE_SUCCESS_URL=https://maybenot.com/success.html`
- `STRIPE_CANCEL_URL=https://maybenot.com/cart.html`

Optional:

- `PORT=4242`

## CORS

The server now enforces origin allowlisting and includes `https://maybenot.com` and `https://www.maybenot.com` by default.

To customize allowed origins, set `STRIPE_ALLOWED_ORIGINS` as a comma-separated list.

## Verify deployed environment

After deployment, run:

```bash
curl -i https://maybenot-stripe-api.onrender.com/api/stripe/health
```

Expected response includes:

- `"ok": true`
- `"hasStripeSecretKey": true`
- `"allowedOrigins"` containing `https://maybenot.com`

Then validate checkout-session route against the deployed host:

```bash
curl -i -X POST https://maybenot-stripe-api.onrender.com/api/stripe/create-checkout-session \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://maybenot.com' \
  --data '{
    "lineItems": [{"price": "price_1TMrxb6vAbsTB4QVVI8wB6tb", "quantity": 1}],
    "successUrl": "https://maybenot.com/success.html",
    "cancelUrl": "https://maybenot.com/cart.html"
  }'
```

Expected response:

- HTTP `200`
- JSON containing `id` and `url`

If `STRIPE_SECRET_KEY` is missing, the endpoint returns `500` with `Missing STRIPE_SECRET_KEY.`.

## Local run

```bash
npm start
```

Server routes:

- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`
- `GET /api/stripe/health`

## Local webhook forwarding (Stripe CLI)

```bash
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Then use the printed webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
