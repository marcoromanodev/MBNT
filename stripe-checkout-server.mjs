#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync=promisify(execFile);

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSigningSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const baseUrl = process.env.BASE_URL || 'https://maybenot.com';
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
    return jsonResponse(res, 500, { error: 'Stripe secret key is not configured.' }, requestOrigin);
  }

  const rawBody = await readBody(req);
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid JSON body.' }, requestOrigin);
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const lineItems = items
    .map((item) => ({
      price: typeof item?.priceId === 'string' ? item.priceId.trim() : '',
      quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Number(item.quantity)) : 1
    }))
    .filter((item) => item.price.startsWith('price_'));
  if (!lineItems.length) {
    return jsonResponse(
      res,
      400,
      { error: 'Request must include items with valid Stripe Price IDs.' },
      requestOrigin
    );
  }

  const successUrl = `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/cart.html`;

  const payload = {
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_creation: 'always'
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
    return jsonResponse(res, 500, { error: 'Stripe secret key is not configured.' }, requestOrigin);
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



async function handleAdminOrders(req, res) {
  const requestOrigin = req.headers.origin || '';
  if (!isAdmin(req)) {
    return jsonResponse(res, 401, { error: 'Unauthorized admin request.' }, requestOrigin);
  }
  if (!stripeSecretKey) {
    return jsonResponse(res, 500, { error: 'Stripe secret key is not configured.' }, requestOrigin);
  }
  try {
    const sessions = await stripeApiRequest('/v1/checkout/sessions?limit=100&expand[]=data.line_items&expand[]=data.customer_details&expand[]=data.payment_intent');
    const orders = [];
    for (const session of sessions.data || []) {
      let lineItemsData = session.line_items?.data;
      if (!Array.isArray(lineItemsData)) {
        try {
          const lineItemsResp = await stripeApiRequest(`/v1/checkout/sessions/${encodeURIComponent(session.id)}/line_items?limit=100`);
          lineItemsData = lineItemsResp.data || [];
        } catch {
          lineItemsData = [];
        }
      }
      orders.push({
        id: session.id,
        payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        created: session.created,
        created_iso: new Date(session.created * 1000).toISOString(),
        customer_name: session.customer_details?.name || '',
        customer_email: session.customer_details?.email || '',
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        status: session.status,
        items: lineItemsData.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          amount_total: item.amount_total,
          price_id: item.price?.id,
          product_id: item.price?.product
        }))
      });
    }
    return jsonResponse(res, 200, { orders }, requestOrigin);
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to load Stripe orders.' }, requestOrigin);
  }
}
async function handleCreateProduct(req, res) {
  const requestOrigin = req.headers.origin || '';
  if (!stripeSecretKey) return jsonResponse(res, 500, { error: 'Stripe secret key is not configured.' }, requestOrigin);
  const rawBody = await readBody(req);
  let body;
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { return jsonResponse(res, 400, { error: 'Invalid JSON body.' }, requestOrigin); }
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const priceAmount = Number(body.price);
  const quantity = Number(body.inventoryQuantity || 0);
  const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (!name || !Number.isFinite(priceAmount) || priceAmount <= 0) return jsonResponse(res, 400, { error: 'name and valid price are required.' }, requestOrigin);
  try {
    const productForm = new URLSearchParams();
    productForm.append('name', name);
    if (description) productForm.append('description', description);
    images.forEach((img, i) => productForm.append(`images[${i}]`, img));
    if (category) productForm.append('metadata[category]', category);
    productForm.append('metadata[inventoryQuantity]', String(Math.max(0, quantity)));
    const stripeProduct = await stripeApiRequest('/v1/products', { method: 'POST', contentType: 'application/x-www-form-urlencoded', body: productForm });
    const priceForm = new URLSearchParams();
    priceForm.append('product', stripeProduct.id);
    priceForm.append('unit_amount', String(Math.round(priceAmount * 100)));
    priceForm.append('currency', 'usd');
    const stripePrice = await stripeApiRequest('/v1/prices', { method: 'POST', contentType: 'application/x-www-form-urlencoded', body: priceForm });
    return jsonResponse(res, 200, { stripe_product_id: stripeProduct.id, stripe_price_id: stripePrice.id }, requestOrigin);
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Unable to create product in Stripe.' }, requestOrigin);
  }
}


async function readJsonFile(fileName, fallback = []) {
  try {
    const raw = await fs.readFile(path.join(repoRoot, fileName), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function readDashboardDefaults() {
  const html = await fs.readFile(path.join(repoRoot, 'dashboard.html'), 'utf8');
  const productsMatch = html.match(/const DEFAULT_PRODUCTS=\[(.*?)\];\s*const DEFAULT_PAGES=/s);
  const pagesMatch = html.match(/const DEFAULT_PAGES=\[(.*?)\];\s*function seedDefaultData/s);
  const evalArray = (body) => Function(`"use strict"; return [${body}];`)();
  return {
    products: productsMatch ? evalArray(productsMatch[1]) : [],
    pages: pagesMatch ? evalArray(pagesMatch[1]) : []
  };
}

function slugifyProductPage(name){return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')+'.html'}

async function handleAdminProducts(req,res){
  const requestOrigin=req.headers.origin||'';
  const defaults=await readDashboardDefaults();
  const adminProducts=await readJsonFile('admin-products.json',[]);
  const map=new Map();
  [...defaults.products,...adminProducts].forEach((p)=>{if(p&&p.id) map.set(p.id,{...map.get(p.id),...p});});
  const products=[...map.values()].map((p)=>({
    id:p.id,name:p.name||'',slug:p.slug||slugifyProductPage(p.name||p.id),images:Array.isArray(p.images)?p.images:[],description:p.description||'',price:Number(p.price||0),inventoryQuantity:Number(p.inventoryQuantity||0),category:p.category||'',placement:Array.isArray(p.placement)?p.placement:[],status:p.status||'active',manualSold:Boolean(p.manualSold),soldOut:Boolean(p.manualSold)||Number(p.inventoryQuantity||0)<1,stripe_product_id:p.stripe_product_id||'',stripe_price_id:p.stripe_price_id||'',variants:Array.isArray(p.variants)?p.variants:[]
  }));
  return jsonResponse(res,200,{products,source:'repo+registry'},requestOrigin);
}

async function handleAdminPages(req,res){
  const requestOrigin=req.headers.origin||'';
  const htmlFiles=(await fs.readdir(repoRoot)).filter((f)=>f.endsWith('.html'));
  const defaults=await readDashboardDefaults();
  const adminPages=await readJsonFile('admin-pages.json',[]);
  const products=(await handleProductsData());
  const productSlugs=products.map((p)=>slugifyProductPage(p.name||p.id));
  const names=new Set([...htmlFiles,...productSlugs,...defaults.pages.map((p)=>p.slug),...adminPages.map((p)=>p.slug)]);
  const collectionHints=['shop.html','all.html','new.html','jackets.html','shirts.html','tops-sweaters.html','sweatshirts.html','pants.html','t-shirts.html','hats.html','bags.html','accessories.html','shoes.html','gym.html','skate.html','babynot.html'];
  const infoHints=['about.html','privacy.html','terms.html','faq.html','contact.html','accessibility.html','mailinglist.html','news.html','stores.html'];
  const pages=[...names].map((slug)=>{
    let type='Blank Page';
    if(slug==='vintage.html') type='Redirect Page';
    else if(productSlugs.includes(slug)) type='Product Page';
    else if(collectionHints.includes(slug)) type='Collection Page';
    else if(slug==='index.html'||infoHints.includes(slug)) type='Blank Page';
    const existing=adminPages.find((p)=>p.slug===slug)||defaults.pages.find((p)=>p.slug===slug)||{};
    return {slug,label:existing.label||slug,type,visible:existing.visible!==false,redirectUrl:existing.redirectUrl||'',content:existing.content||''};
  });
  return jsonResponse(res,200,{pages},requestOrigin);
}

async function handleProductsData(){
  const defaults=await readDashboardDefaults();
  const adminProducts=await readJsonFile('admin-products.json',[]);
  const map=new Map();
  [...defaults.products,...adminProducts].forEach((p)=>{if(p&&p.id) map.set(p.id,{...map.get(p.id),...p});});
  return [...map.values()];
}
const analyticsEvents = [];

const repoRoot=process.cwd();
const githubCfg=['GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO','GITHUB_BRANCH'].reduce((m,k)=>(m[k]=process.env[k]||'',m),{});
function isAdmin(req){
  const headerAuth = (req.headers['x-admin-auth'] || '').toString().trim();
  if (headerAuth) return true;
  const bearer = (req.headers.authorization || '').toString().trim();
  if (bearer.toLowerCase().startsWith('bearer ') && bearer.slice(7).trim()) return true;
  const cookie = (req.headers.cookie || '').toString();
  return /(?:^|;\s*)(mbnt_admin_auth|mbnt_dash_session)=([^;]+)/.test(cookie);
}
async function gitCommit(filePath,message){await execFileAsync('git',['add',filePath],{cwd:repoRoot});await execFileAsync('git',['commit','-m',message],{cwd:repoRoot});}
function ensureGitHubConfigured(){return githubCfg.GITHUB_TOKEN&&githubCfg.GITHUB_OWNER&&githubCfg.GITHUB_REPO&&githubCfg.GITHUB_BRANCH;}
async function upsertJsonArray(fileName,key,val){const fp=path.join(repoRoot,fileName);let arr=[];try{arr=JSON.parse(await fs.readFile(fp,'utf8'));}catch{}if(!Array.isArray(arr))arr=[];const idx=arr.findIndex(x=>x[key]===val[key]);if(idx>=0)arr[idx]=val;else arr.push(val);await fs.writeFile(fp,JSON.stringify(arr,null,2));return fp;}


function normalizeAnalyticsEvent(event={}){return {type:String(event.type||'page_event'),timestamp:event.timestamp||new Date().toISOString(),timestampMs:Date.parse(event.timestamp||'')||Date.now(),pagePath:String(event.pagePath||event.page||'index.html'),productId:event.productId||null,productName:event.productName||null,sessionId:event.sessionId||null,cartCount:Number.isFinite(Number(event.cartCount))?Number(event.cartCount):null,userAgent:String(event.userAgent||''),timezone:String(event.timezone||''),referrer:String(event.referrer||'')};}

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

    if (req.method === 'POST' && (pathname === '/api/stripe/create-checkout-session' || pathname === '/api/create-checkout-session')) {
      return await handleCreateCheckoutSession(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/stripe/create-payment-intent') {
      return await handleCreatePaymentIntent(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/products/create') {
      return await handleCreateProduct(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/analytics/track') {
      const rawBody = await readBody(req);
      let body;
      try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { return jsonResponse(res, 400, { error: 'Invalid JSON body.' }, requestOrigin); }
      const event = normalizeAnalyticsEvent(body);
      analyticsEvents.push(event);
      if (analyticsEvents.length > 10000) analyticsEvents.splice(0, analyticsEvents.length - 10000);
      return jsonResponse(res, 200, { ok: true }, requestOrigin);
    }

    if (req.method === 'GET' && pathname === '/api/analytics/summary') {
      return jsonResponse(res, 200, { events: analyticsEvents, storage:'memory', note:'Analytics resets when server restarts. Add database persistence for durability.' }, requestOrigin);
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


    if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/orders' && !isAdmin(req)) {
      return jsonResponse(res, 401, { error: 'Admin session required.' }, requestOrigin);
    }

    if (req.method === 'POST' && pathname === '/api/admin/update-product') {
      const body=JSON.parse((await readBody(req))||'{}');
      const fp=await upsertJsonArray('admin-products.json','id',body.product||{});
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: update product');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }
    if (req.method === 'POST' && pathname === '/api/admin/create-product') {
      const body=JSON.parse((await readBody(req))||'{}');
      const fp=await upsertJsonArray('admin-products.json','id',body.product||{});
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: create product');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }
    if (req.method === 'POST' && pathname === '/api/admin/update-page') {
      const body=JSON.parse((await readBody(req))||'{}');
      const fp=await upsertJsonArray('admin-pages.json','slug',body.page||{});
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: update page');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }
    if (req.method === 'POST' && pathname === '/api/admin/upload-image') {
      return jsonResponse(res,501,{error:'Upload endpoint expects multipart parser setup.'},requestOrigin);
    }

    if (req.method === 'GET' && pathname === '/api/admin/orders') {
      return await handleAdminOrders(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/admin/products') {
      return await handleAdminProducts(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/admin/pages') {
      return await handleAdminPages(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/delete-product') {
      const body=JSON.parse((await readBody(req))||'{}');
      const arr=await readJsonFile('admin-products.json',[]);
      const next=arr.filter(p=>p.id!==(body.product?.id||body.id));
      const fp=path.join(repoRoot,'admin-products.json');
      await fs.writeFile(fp,JSON.stringify(next,null,2));
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: delete product');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }
    if (req.method === 'POST' && pathname === '/api/admin/delete-page') {
      const body=JSON.parse((await readBody(req))||'{}');
      const arr=await readJsonFile('admin-pages.json',[]);
      const next=arr.filter(p=>p.slug!==(body.slug||body.page?.slug));
      const fp=path.join(repoRoot,'admin-pages.json');
      await fs.writeFile(fp,JSON.stringify(next,null,2));
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: delete page');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }

    if (req.method === 'POST' && pathname === '/api/admin/create-page') {
      const body=JSON.parse((await readBody(req))||'{}');
      const fp=await upsertJsonArray('admin-pages.json','slug',body.page||{});
      if(!ensureGitHubConfigured()) return jsonResponse(res,503,{error:'GitHub save is not configured yet. Changes were not published permanently.'},requestOrigin);
      await gitCommit(path.relative(repoRoot,fp),'admin: create page');
      return jsonResponse(res,200,{ok:true},requestOrigin);
    }

    return jsonResponse(res, 404, { error: 'Not found.' }, requestOrigin);
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message || 'Internal server error.' }, requestOrigin);
  }
});

server.listen(port, () => {
  console.log(`Stripe checkout server listening on http://localhost:${port}`);
});
