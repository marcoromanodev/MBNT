# Stripe one-time Checkout integration

This project now includes a server-side Stripe Checkout flow that follows the blueprint:

1. `POST /v1/products` with:
   - `name=Example Product`
   - `default_price_data[currency]=usd`
   - `default_price_data[unit_amount]=2000`
2. `POST /v1/checkout/sessions` with:
   - `line_items[0][price]=<default_price from product creation>`
   - `line_items[0][quantity]=1`
   - `mode=payment`
   - `success_url` and `cancel_url`
3. Receive `checkout.session.completed` at a webhook endpoint.

## Environment variables

Set these before running:

- `STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}`
- `STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}`
- `STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}`

Get the key values from your Stripe Dashboard.

Optional overrides:

- `PORT=4242`
- `STRIPE_STORE_PATH=stripe-runtime-store.json`
- `STRIPE_SUCCESS_URL=https://your-site.example/success.html`
- `STRIPE_CANCEL_URL=https://your-site.example/cart.html`

## Run

```bash
node stripe-checkout-server.mjs
```

Server routes:

- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`
- `GET /api/stripe/health`

Data persisted to `stripe-runtime-store.json`:

- `product_id`
- `default_price_id`
- created checkout sessions
- completed checkout sessions from webhook events

## Local webhook forwarding (Stripe CLI)

```bash
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Then use the printed webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
