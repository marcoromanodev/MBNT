#!/usr/bin/env node
import fs from 'node:fs/promises';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY environment variable.');
  process.exit(1);
}

const configPath = process.env.STRIPE_CONFIG_PATH || 'stripe-config.json';

const catalog = [
  { key: 't-shirt', name: 'T-Shirt', unitAmount: 3000, aliases: ['T Shirt', 'Tee'] },
  { key: 'hoodie', name: 'Hoodie', unitAmount: 7000, aliases: [] },
  { key: 'shorts', name: 'Shorts', unitAmount: 5000, aliases: [] },
  { key: 'joggers', name: 'Joggers', unitAmount: 7000, aliases: [] },
  { key: 'hat', name: 'Hat -Baseball Cap', unitAmount: 4000, aliases: ['Baseball Cap', 'Hat'] },
  { key: 'truckerhat', name: 'Trucker Hat', unitAmount: 5000, aliases: ['Trucker'] },
  { key: 'socks', name: 'Socks', unitAmount: 2000, aliases: [] },
  { key: 'backpack', name: 'Backpack', unitAmount: 6000, aliases: [] },
  { key: 'dufflebag', name: 'Duffle Bag', unitAmount: 8000, aliases: ['Duffel Bag'] },
  { key: 'american-denim', name: 'American Denim Jeans', unitAmount: 9000, aliases: ['American Denim', 'Jeans'] },
  { key: 'skateboard1', name: 'Skateboard 1', unitAmount: 10000, aliases: [] },
  { key: 'skateboard2', name: 'Skateboard 2', unitAmount: 10000, aliases: ['Stakeboard 2'] },
  { key: 'skateboard3', name: 'Skateboard 3', unitAmount: 10000, aliases: [] }
];

function formBody(data) {
  return new URLSearchParams(data).toString();
}

async function stripeRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body ? formBody(body) : undefined
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || `Stripe API request failed (${response.status})`;
    throw new Error(message);
  }

  return json;
}

async function listAll(path) {
  let hasMore = true;
  let startingAfter = null;
  const data = [];

  while (hasMore) {
    const query = new URLSearchParams({ limit: '100' });
    if (startingAfter) query.set('starting_after', startingAfter);

    const page = await stripeRequest(`${path}?${query.toString()}`);
    data.push(...(page.data || []));
    hasMore = !!page.has_more;
    startingAfter = hasMore && page.data.length ? page.data[page.data.length - 1].id : null;
  }

  return data;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findByAliases(aliases, productsByName) {
  for (const alias of aliases || []) {
    const match = productsByName.get(normalizeName(alias));
    if (match) return match;
  }
  return null;
}

async function ensureProduct(item, productsByKey, productsByName) {
  const byKey = productsByKey.get(item.key);
  if (byKey) return byKey;

  const byName = productsByName.get(normalizeName(item.name));
  if (byName) return byName;

  const byAlias = findByAliases(item.aliases, productsByName);
  if (byAlias) return byAlias;

  const created = await stripeRequest('/products', {
    method: 'POST',
    body: {
      name: item.name,
      'metadata[store_key]': item.key
    }
  });

  productsByKey.set(item.key, created);
  productsByName.set(normalizeName(item.name), created);
  return created;
}

async function ensurePrice(productId, unitAmount, pricesByProduct) {
  const existing = (pricesByProduct.get(productId) || []).find(
    (price) =>
      price.active &&
      price.currency === 'usd' &&
      price.type === 'one_time' &&
      price.unit_amount === unitAmount
  );

  if (existing) return existing;

  const created = await stripeRequest('/prices', {
    method: 'POST',
    body: {
      product: productId,
      currency: 'usd',
      unit_amount: String(unitAmount)
    }
  });

  const list = pricesByProduct.get(productId) || [];
  list.push(created);
  pricesByProduct.set(productId, list);
  return created;
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const [products, prices, existingConfig] = await Promise.all([
    listAll('/products'),
    listAll('/prices'),
    loadConfig()
  ]);

  const productsByKey = new Map();
  const productsByName = new Map();

  for (const product of products) {
    const storeKey = product?.metadata?.store_key;
    if (storeKey) productsByKey.set(storeKey, product);
    productsByName.set(normalizeName(product.name), product);
  }

  const pricesByProduct = new Map();
  for (const price of prices) {
    const list = pricesByProduct.get(price.product) || [];
    list.push(price);
    pricesByProduct.set(price.product, list);
  }

  const priceLookup = {};
  for (const item of catalog) {
    const product = await ensureProduct(item, productsByKey, productsByName);
    const price = await ensurePrice(product.id, item.unitAmount, pricesByProduct);
    priceLookup[item.key] = price.id;
  }

  const nextConfig = {
    publishableKey:
      process.env.STRIPE_PUBLISHABLE_KEY ||
      existingConfig.publishableKey ||
      'pk_test_REPLACE_WITH_YOUR_PUBLISHABLE_KEY',
    successUrl: existingConfig.successUrl || '/success.html',
    cancelUrl: existingConfig.cancelUrl || '/cart.html',
    priceLookup
  };

  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  console.log(`Updated ${configPath} with ${Object.keys(priceLookup).length} Stripe price IDs.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
