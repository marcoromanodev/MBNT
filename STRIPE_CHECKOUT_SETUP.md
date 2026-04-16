# Stripe one-time Checkout integration

This project now includes a server-side Stripe Checkout flow:

1. Frontend sends `lineItems` (or `cart`) to `POST /api/stripe/create-checkout-session`.
2. Server validates Stripe price IDs (`price_...`) and quantity values.
3. Server calls `POST /v1/checkout/sessions` with:
   - `line_items`
   - `mode=payment`
   - `success_url` and `cancel_url`
4. Server returns JSON `{ id, url }` to the browser.

## Environment variables

Set these before running:

- `STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}`
- `STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}`
- `STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}`

Get the key values from your Stripe Dashboard.

Optional overrides:

- `PORT=4242`
- `STRIPE_SUCCESS_URL=https://your-site.example/success.html`
- `STRIPE_CANCEL_URL=https://your-site.example/cart.html`
- `STRIPE_ALLOWED_ORIGIN=https://your-site.example`

## Endpoint configuration tips

- In production, point `checkoutEndpoint` to an HTTPS URL on the same origin as your storefront (for example `/api/stripe/create-checkout-session`).
- Avoid `http://localhost:4242/...` in production `stripe-config.json`; that causes browser network errors like `TypeError: Failed to fetch` for real users.
- If frontend and API are on different origins, allow the storefront origin with CORS on your checkout-session API route.
- This repo no longer relies on Netlify Functions or Netlify redirects for checkout-session creation.

## Hosting note for maybenot.com (GitHub Pages)

GitHub Pages serves static files only, so it cannot execute `POST /api/stripe/create-checkout-session` by itself.
Run `stripe-checkout-server.mjs` on the platform that serves your production domain requests, and route:

- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`
- `GET /api/stripe/health`

to that Node process.

## Run

```bash
node stripe-checkout-server.mjs
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
