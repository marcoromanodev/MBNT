let cart = [];

const ANALYTICS_KEY = 'mbnt_analytics_events';
function buildAnalyticsEvent(type, payload = {}) {
    return {
        type,
        timestamp: new Date().toISOString(),
        pagePath: window.location.pathname.split('/').pop() || 'index.html',
        productId: payload.productId || null,
        productName: payload.product || payload.productName || null,
        sessionId: sessionStorage.getItem('mbnt_session_id') || (sessionStorage.setItem('mbnt_session_id', crypto.randomUUID()), sessionStorage.getItem('mbnt_session_id')),
        cartCount: payload.cartCount ?? getTotalQuantity(),
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer || ''
    };
}

function trackAnalyticsEvent(type, payload = {}) {
    const event = buildAnalyticsEvent(type, payload);
    try {
        const events = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
        events.push({ ...event, timestampMs: Date.now() });
        localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
    } catch (_) {}
    fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
    }).catch(() => {});
}


function getTotalQuantity() {
    return cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
}

const shippingCost = 15;
const stateTaxRates = {
    AL: 0.04, AK: 0, AZ: 0.056, AR: 0.065, CA: 0.0725, CO: 0.029,
    CT: 0.0635, DE: 0, FL: 0.06, GA: 0.04, HI: 0.04, ID: 0.06,
    IL: 0.0625, IN: 0.07, IA: 0.06, KS: 0.065, KY: 0.06, LA: 0.0445,
    ME: 0.055, MD: 0.06, MA: 0.0625, MI: 0.06, MN: 0.06875, MS: 0.07,
    MO: 0.04225, MT: 0, NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.06625,
    NM: 0.05125, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575, OK: 0.045,
    OR: 0, PA: 0.06, RI: 0.07, SC: 0.06, SD: 0.045, TN: 0.07,
    TX: 0.0625, UT: 0.047, VT: 0.06, VA: 0.043, WA: 0.065,
    WV: 0.06, WI: 0.05, WY: 0.04, DC: 0.06
};

// Default tax rate when the customer's state is unknown (store based in IL)
const defaultTaxRate = stateTaxRates['IL'];

const defaultPriceLookup = {
    't-shirt': 'price_1TMrxb6vAbsTB4QVVI8wB6tb',
    hoodie: 'price_1TMrwq6vAbsTB4QVGhANJDBO',
    shorts: 'price_1TMs0e6vAbsTB4QV0IU5JIPS',
    joggers: 'price_1TMryV6vAbsTB4QVd9G1WVH1',
    hat: 'price_1TMrw26vAbsTB4QVfnxBgAmB',
    truckerhat: 'price_1TMs6P6vAbsTB4QVIB0j7b7k',
    camohat: 'price_1TQzjz6vAbsTB4QVWyt4CNNh',
    'blank-shirt': 'price_1TQzi06vAbsTB4QVO9peR055',
    'blank-shirt-3pack': 'price_1TQzi06vAbsTB4QVO9peR055',
    'blank-hoodie': 'price_1TQzjB6vAbsTB4QV5y30tIN3',
    socks: 'price_1TMs9R6vAbsTB4QVRn8SawXZ',
    dufflebag: 'price_1TMs4N6vAbsTB4QV2N9UmUs1',
    backpack: 'price_1TMwLe6vAbsTB4QVyFZu293b',
    'american-denim': 'price_1TMs366vAbsTB4QVlEHmGj1A',
    skateboard1: 'price_1TMsAJ6vAbsTB4QVof4P9O6J',
    skateboard2: 'price_1TMsB66vAbsTB4QVgdK0paRD',
    skateboard3: 'price_1TMsBv6vAbsTB4QVwwDsrvmn'
};

const defaultStripeSettings = {
    publishableKey: window.STRIPE_PUBLISHABLE_KEY || '',
    successUrl: window.STRIPE_SUCCESS_URL || `${window.location.origin}/success.html`,
    cancelUrl: window.STRIPE_CANCEL_URL || `${window.location.origin}/cart.html`,
    checkoutEndpoint: window.STRIPE_CHECKOUT_ENDPOINT || '',
    priceLookup: { ...defaultPriceLookup, ...(window.STRIPE_PRICE_LOOKUP || {}) }
};

const stripeSettings = { ...defaultStripeSettings };
const stripeProductAliases = {
    hat: ['baseball-cap', 'baseballcap', 'hat-baseball-cap', 'hats', 'cap'],
    truckerhat: ['trucker-hat', 'trucker'],
    't-shirt': ['tshirt', 'tee', 'shirt'],
    'blank-shirt': ['blankshirt', 'blank-tee'],
    'blank-shirt-3pack': ['blankshirt3pack', 'blank-shirt-3-pack', 'blank-tee-3pack'],
    'blank-hoodie': ['blankhoodie'],
    camohat: ['camo-hat', 'camo'],
    'american-denim': ['americandenim', 'denim', 'jeans'],
    dufflebag: ['duffle-bag', 'duffelbag', 'duffel-bag'],
    backpack: ['back-pack', 'back-packs', 'backpacks'],
    skateboard2: ['stakeboard2', 'stakeboard-2']
};

function buildStripeLookupAliasMap() {
    const aliasMap = {};
    const register = (alias, canonical) => {
        const normalized = toSlug(alias).replace(/-/g, '');
        if (normalized) aliasMap[normalized] = canonical;
    };

    Object.keys(defaultPriceLookup).forEach(canonical => {
        register(canonical, canonical);
        const aliases = stripeProductAliases[canonical] || [];
        aliases.forEach(alias => register(alias, canonical));
    });

    return aliasMap;
}

const stripeLookupAliasMap = buildStripeLookupAliasMap();
const activeStripeProductKeys = new Set([
    ...Object.keys(defaultPriceLookup),
    'blank-shirt',
    'blank-shirt-3pack',
    'blank-hoodie',
    'camohat'
]);

function filterActivePriceLookup(config = {}) {
    return Object.entries(config).reduce((lookup, [rawKey, value]) => {
        if (typeof value !== 'string' || !value) return lookup;
        const canonicalKey = canonicalizeStripeProductKey(rawKey);
        if (!canonicalKey || !activeStripeProductKeys.has(canonicalKey)) return lookup;
        lookup[canonicalKey] = value;
        return lookup;
    }, {});
}


function normalizeCheckoutUrl(url, fallback) {
    if (typeof url !== 'string' || !url.trim()) return fallback;
    try {
        const resolvedUrl = new URL(url, window.location.origin);
        if (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:') {
            return resolvedUrl.toString();
        }
    } catch (_) {
        // Fall through to fallback when URL parsing fails
    }
    return fallback;
}

function sanitizeConfigString(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\$\{[^}]+\}$/.test(trimmed)) return '';
    return trimmed;
}

function canonicalizeStripeProductKey(key) {
    const normalized = toSlug(key).replace(/-/g, '');
    if (!normalized) return '';
    return stripeLookupAliasMap[normalized] || '';
}

function normalizePriceLookupMap(config = {}) {
    return Object.entries(config).reduce((lookup, [rawKey, value]) => {
        if (typeof value !== 'string' || !value) return lookup;

        const canonicalKey = canonicalizeStripeProductKey(rawKey);
        if (canonicalKey) {
            lookup[canonicalKey] = value;
        }

        const slugKey = toSlug(rawKey);
        if (slugKey) {
            lookup[slugKey] = value;
            lookup[slugKey.replace(/-/g, '')] = value;
        }

        return lookup;
    }, {});
}

function applyStripeSettings(overrides = {}) {
    const publishableKey = sanitizeConfigString(overrides.publishableKey);
    if (publishableKey) {
        stripeSettings.publishableKey = publishableKey;
    }
    stripeSettings.checkoutEndpoint = normalizeCheckoutUrl(
        overrides.checkoutEndpoint || stripeSettings.checkoutEndpoint || defaultStripeSettings.checkoutEndpoint,
        ''
    );
    stripeSettings.successUrl = normalizeCheckoutUrl(
        overrides.successUrl || stripeSettings.successUrl || defaultStripeSettings.successUrl,
        defaultStripeSettings.successUrl
    );
    stripeSettings.cancelUrl = normalizeCheckoutUrl(
        overrides.cancelUrl || stripeSettings.cancelUrl || defaultStripeSettings.cancelUrl,
        defaultStripeSettings.cancelUrl
    );
    stripeSettings.priceLookup = {
        ...defaultPriceLookup,
        ...filterActivePriceLookup(overrides.priceLookup || {}),
        ...filterActivePriceLookup(window.STRIPE_PRICE_LOOKUP || {})
    };
}

function readInlinePriceLookup(config = {}) {
    return Object.entries(config).reduce((lookup, [rawKey, value]) => {
        if (typeof value !== 'string' || !value) return lookup;
        const canonicalKey = canonicalizeStripeProductKey(rawKey);
        if (!canonicalKey) return lookup;
        lookup[canonicalKey] = value;
        return lookup;
    }, {});
}

applyStripeSettings();

let stripeConfigPromise = null;
async function loadStripeConfig() {
    if (window.STRIPE_PUBLISHABLE_KEY || window.STRIPE_PRICE_LOOKUP) {
        applyStripeSettings({
            publishableKey: window.STRIPE_PUBLISHABLE_KEY,
            checkoutEndpoint: window.STRIPE_CHECKOUT_ENDPOINT,
            successUrl: window.STRIPE_SUCCESS_URL,
            cancelUrl: window.STRIPE_CANCEL_URL,
            priceLookup: window.STRIPE_PRICE_LOOKUP
        });
        return;
    }

    if (!stripeConfigPromise) {
        stripeConfigPromise = fetch('stripe-config.json')
            .then(res => (res.ok ? res.json() : {}))
            .then(config => {
                window.STRIPE_PUBLISHABLE_KEY = sanitizeConfigString(config.publishableKey);
                window.STRIPE_CHECKOUT_ENDPOINT = sanitizeConfigString(config.checkoutEndpoint);
                window.STRIPE_SUCCESS_URL = sanitizeConfigString(config.successUrl);
                window.STRIPE_CANCEL_URL = sanitizeConfigString(config.cancelUrl);
                window.STRIPE_PRICE_LOOKUP = {
                    ...(config.priceLookup || {}),
                    ...readInlinePriceLookup(config)
                };

                applyStripeSettings({
                    publishableKey: window.STRIPE_PUBLISHABLE_KEY,
                    checkoutEndpoint: window.STRIPE_CHECKOUT_ENDPOINT,
                    successUrl: window.STRIPE_SUCCESS_URL,
                    cancelUrl: window.STRIPE_CANCEL_URL,
                    priceLookup: window.STRIPE_PRICE_LOOKUP
                });
            })
            .catch(() => {
                stripeConfigPromise = null;
            });
    }

    return stripeConfigPromise;
}

const unsupportedMethodNotices = {
    'Shop Pay': 'Shop Pay is not directly supported in this checkout. Opening Stripe Checkout with available payment methods.',
    PayPal: 'PayPal is not directly supported in this checkout. Opening Stripe Checkout with available payment methods.',
    Venmo: 'Venmo is not directly supported in this checkout. Opening Stripe Checkout with available payment methods.'
};

const paymentHandlers = {
    'Shop Pay': (customerEmail) => startStripeCheckout('Shop Pay', customerEmail),
    'PayPal': (customerEmail) => startStripeCheckout('PayPal', customerEmail),
    'Google Pay': (customerEmail) => startStripeCheckout('Google Pay', customerEmail),
    'Klarna': (customerEmail) => startStripeCheckout('Klarna', customerEmail),
    'Venmo': (customerEmail) => startStripeCheckout('Venmo', customerEmail),
    Stripe: (customerEmail) => startStripeCheckout('Stripe', customerEmail)
};

async function handlePayment(method, customerEmail = '') {
    const handler = paymentHandlers[method];
    if (!handler) {
        alert(`${method} payment not implemented.`);
        return false;
    }
    try {
        await handler(customerEmail);
        return true;
    } catch (err) {
        alert(err.message || `${method} payment failed.`);
        return false;
    }
}

function handleExpressButtonClick(root, method) {
    if (method === 'Apple Pay') {
        const appleOption = root?.querySelector('input[name="payment-method"][value="apple"]');
        if (appleOption) {
            appleOption.checked = true;
            appleOption.dispatchEvent(new Event('change', { bubbles: true }));
            const paymentSection = appleOption.closest('.payment-option');
            if (paymentSection) paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
    handlePayment(method);
}

let stripePromise = null;
function loadStripeJs() {
    if (window.Stripe) return Promise.resolve();
    if (stripePromise) return stripePromise;
    stripePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Stripe.js failed to load.'));
        document.head.appendChild(script);
    });
    return stripePromise;
}

async function getStripe() {
    if (!stripeSettings.publishableKey || stripeSettings.publishableKey.includes('REPLACE')) {
        throw new Error('Stripe is not configured. Please set a live STRIPE_PUBLISHABLE_KEY and STRIPE_PRICE_LOOKUP.');
    }
    if (stripeSettings.publishableKey.startsWith('pk_test_')) {
        throw new Error('Stripe publishable key is in test mode. Configure a live pk_live_ key to match production checkout.');
    }
    await loadStripeJs();
    if (!window.Stripe) {
        throw new Error('Stripe.js not available.');
    }
    return window.Stripe(stripeSettings.publishableKey);
}

function normalizeProductKey(item) {
    if (!item) return '';
    if (item.stripePriceId) return item.stripePriceId;
    if (item.priceId) return item.priceId;
    return (item.name || item.product || '').toLowerCase();
}

function toSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getPriceLookupCandidates(key) {
    const slug = toSlug(key);
    if (!slug) return [];
    const compact = slug.replace(/-/g, '');
    const singular = slug.endsWith('s') ? slug.slice(0, -1) : '';
    const plural = slug.endsWith('s') ? '' : `${slug}s`;
    const aliases = stripeProductAliases[slug] || [];
    return [...new Set([slug, compact, singular, plural, ...aliases].filter(Boolean))];
}

function buildStripeLineItems() {
    const lineItems = [];
    const missing = [];
    cart.forEach(item => {
        const key = normalizeProductKey(item);
        const directPrice = item.stripePriceId && item.stripePriceId.startsWith('price_') ? item.stripePriceId : '';
        const candidates = getPriceLookupCandidates(key);
        const lookedUpPriceId = candidates.reduce((matched, candidate) => {
            if (matched) return matched;
            return stripeSettings.priceLookup[candidate] || '';
        }, '');
        const priceId = directPrice || lookedUpPriceId;
        const validPriceId = priceId && !priceId.includes('REPLACE') ? priceId : '';
        if (!validPriceId) {
            missing.push(key || 'unknown item');
            return;
        }
        lineItems.push({ price: validPriceId, quantity: parseInt(item.quantity) || 1 });
    });
    return { lineItems, missing };
}

function buildCheckoutEndpointCandidates(primaryEndpoint) {
    const configured = normalizeCheckoutUrl(primaryEndpoint, '');
    if (!configured) return [];
    const candidates = new Set([configured]);

    try {
        const url = new URL(configured);
        if (url.pathname !== '/api/stripe/create-checkout-session') {
            url.pathname = '/api/stripe/create-checkout-session';
            url.search = '';
            url.hash = '';
            candidates.add(url.toString());
        }
    } catch (_) {
        // Ignore malformed configured endpoint; normalizeCheckoutUrl already handled validation.
    }

    return [...candidates];
}

async function postCheckoutSession(endpoint, payload) {
    return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function startServerCheckout(method, lineItems, customerEmail = '') {
    const requestPayload = {
        method,
        lineItems,
        cart,
        customerEmail,
        successUrl: stripeSettings.successUrl,
        cancelUrl: stripeSettings.cancelUrl
    };
    const endpointCandidates = buildCheckoutEndpointCandidates(stripeSettings.checkoutEndpoint);
    if (!endpointCandidates.length) {
        throw new Error(
            'Stripe checkout endpoint is not configured. Set checkoutEndpoint in stripe-config.json to your Render API URL.'
        );
    }
    let response;
    let endpointUsed = endpointCandidates[0] || stripeSettings.checkoutEndpoint || '';
    const attemptedEndpoints = [];

    for (const endpoint of endpointCandidates) {
        endpointUsed = endpoint;
        try {
            response = await postCheckoutSession(endpoint, requestPayload);
        } catch (err) {
            attemptedEndpoints.push(`${endpoint} (network error)`);
            continue;
        }

        if (response.status === 404 || response.status === 405) {
            attemptedEndpoints.push(`${endpoint} (${response.status})`);
            continue;
        }
        attemptedEndpoints.push(`${endpoint} (${response.status})`);
        break;
    }

    if (!response) {
        const endpoint = endpointUsed || '(missing endpoint)';
        throw new Error(`Network error calling checkout endpoint (${endpoint}). Verify the endpoint is reachable from this site, uses HTTPS in production, and allows this origin (CORS).`);
    }

    let payload = {};
    let rawText = '';
    try {
        payload = await response.json();
    } catch (_) {
        try {
            rawText = await response.text();
        } catch (_) {
            rawText = '';
        }
        payload = {};
    }

    if (!response.ok) {
        const status = `${response.status} ${response.statusText}`.trim();
        const fallbackDetail = rawText ? ` ${rawText.slice(0, 180)}` : '';
        const endpointHint = endpointUsed ? ` Endpoint: ${endpointUsed}.` : '';
        const attemptedHint = attemptedEndpoints.length ? ` Tried: ${attemptedEndpoints.join(', ')}.` : '';
        if (response.status === 404 || response.status === 405) {
            throw new Error(
                `Unable to create Stripe Checkout session (${status}).${endpointHint}${attemptedHint} Ensure your server exposes POST /api/stripe/create-checkout-session in production.`
            );
        }
        throw new Error(payload.error || `Unable to create Stripe Checkout session (${status}).${endpointHint}${fallbackDetail}`);
    }

    if (payload.url) {
        window.location.assign(payload.url);
        return;
    }

    if (!payload.id) {
        throw new Error('Checkout session response is missing "url" or "id".');
    }

    const stripe = await getStripe();
    const { error } = await stripe.redirectToCheckout({ sessionId: payload.id });
    if (error) throw error;
}

async function startClientCheckout(lineItems) {
    const stripe = await getStripe();
    const { error } = await stripe.redirectToCheckout({
        lineItems,
        mode: 'payment',
        successUrl: stripeSettings.successUrl,
        cancelUrl: stripeSettings.cancelUrl
    });
    if (!error) return;

    const errorMessage = error.message || 'Unable to start Stripe Checkout.';
    const isClientOnlyDisabled = /client-only integration is not enabled/i.test(errorMessage);
    if (isClientOnlyDisabled) {
        throw new Error('Stripe blocked this checkout because "Checkout client-only integration" is off for this account. Enable it in Stripe Dashboard → Settings → Checkout, or fix the checkoutEndpoint server route.');
    }
    throw new Error(errorMessage);
}

function buildPaymentIntentEndpoint(checkoutEndpoint) {
    const normalized = normalizeCheckoutUrl(checkoutEndpoint, '');
    if (!normalized) return '';
    try {
        const url = new URL(normalized);
        url.pathname = '/api/stripe/create-payment-intent';
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch (_) {
        return '';
    }
}

let expressCheckoutCache = {
    signature: "",
    clientSecret: "",
    promise: null,
    totals: null
};
let stripeInstancePromise = null;
let expressCheckoutReadyPromise = null;
const expressMountState = new Map();
const EXPRESS_MOUNT_RETRY_DELAYS_MS = [300, 1000];

function preloadStripe() {
    if (!stripeInstancePromise) {
        stripeInstancePromise = loadStripeConfig()
            .then(() => loadStripeJs())
            .then(() => getStripe())
            .catch((error) => {
                console.warn("Express checkout mount failed", "stripe-preload", error);
                stripeInstancePromise = null;
                throw error;
            });
    }
    return stripeInstancePromise;
}

function invalidateExpressCheckoutCache() {
    expressCheckoutCache.signature = "";
    expressCheckoutCache.clientSecret = "";
    expressCheckoutCache.promise = null;
    expressCheckoutCache.totals = null;
    expressCheckoutReadyPromise = null;
    document.querySelectorAll('.apple-pay-express-element, #express-checkout-element').forEach((el) => {
        delete el.dataset.expressMounted;
        delete el.dataset.expressSignature;
        el.innerHTML = '';
    });
}

function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function getExpressCheckoutSignature(container = document, options = {}) {
    const totals = getCurrentCheckoutTotalCents(container, options);
    return JSON.stringify({
        cart: cart.map((item) => ({
            id: item.id || item.name || item.product,
            price: item.price,
            quantity: item.quantity || 1
        })),
        wallet: options.wallet || 'all',
        totalCents: totals.totalCents,
        taxCents: totals.taxCents,
        shippingCents: totals.shippingCents,
        context: options.context || 'default'
    });
}

async function createExpressCheckoutPaymentIntent(container = document, options = {}) {
    await preloadStripe();
    const { lineItems, missing } = buildStripeLineItems();
    if (missing.length) throw new Error(`Stripe price IDs missing for: ${missing.join(', ')}.`);
    const paymentIntentEndpoint = buildPaymentIntentEndpoint(stripeSettings.checkoutEndpoint);
    if (!paymentIntentEndpoint) throw new Error('Stripe payment intent endpoint is not configured.');
    const totals = getCurrentCheckoutTotalCents(container, options);
    console.log("Express Checkout totals", totals);
    const response = await fetch(paymentIntentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            lineItems,
            cart,
            orderAmountCents: totals.totalCents,
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            shippingCents: totals.shippingCents,
            totalCents: totals.totalCents
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.clientSecret) throw new Error(payload.error || 'Unable to initialize express checkout.');
    expressCheckoutCache.totals = totals;
    return payload.clientSecret;
}

async function getExpressCheckoutClientSecret(container = document, options = {}) {
    const signature = getExpressCheckoutSignature(container, options);
    if (expressCheckoutCache.signature === signature && expressCheckoutCache.clientSecret) return expressCheckoutCache.clientSecret;
    if (expressCheckoutCache.signature === signature && expressCheckoutCache.promise) return expressCheckoutCache.promise;
    expressCheckoutCache.signature = signature;
    expressCheckoutCache.clientSecret = '';
    expressCheckoutCache.promise = createExpressCheckoutPaymentIntent(container, options)
        .then((clientSecret) => {
            expressCheckoutCache.clientSecret = clientSecret;
            return clientSecret;
        })
        .finally(() => {
            expressCheckoutCache.promise = null;
        });
    return expressCheckoutCache.promise;
}

function prewarmExpressCheckout(container = document, options = {}) {
    if (!cart.length) return;
    if (!expressCheckoutReadyPromise) {
        expressCheckoutReadyPromise = Promise.resolve()
            .then(() => preloadStripe())
            .then(() => getExpressCheckoutClientSecret(container, options))
            .finally(() => {
                expressCheckoutReadyPromise = null;
            });
    }
    expressCheckoutReadyPromise.catch((err) => console.warn("Express checkout mount failed", options.context || 'prewarm', err));
    return expressCheckoutReadyPromise;
}

function getExpressMountKey(expressContainer, signature, options = {}) {
    const wallet = options.wallet || 'all';
    const context = options.context || 'default';
    const target = expressContainer?.dataset?.expressMountId || expressContainer?.className || 'express-target';
    return `${context}|${wallet}|${signature}|${target}`;
}

async function mountExpressCheckout(container = document, options = {}) {
    const contextSelector = options.context ? `[data-express-context="${options.context}"]` : '';
    const isCartPageContext = options.context === 'cart-page';
    const expressContainer = isCartPageContext
        ? container.querySelector('[data-express-context="cart-page"] .apple-pay-express-element')
        : ((contextSelector && container.querySelector(`${contextSelector} .apple-pay-express-element`)) ||
            container.querySelector('.apple-pay-express-element') ||
            container.querySelector('#express-checkout-element'));
    const expressError = isCartPageContext
        ? container.querySelector('[data-express-context="cart-page"] .apple-pay-express-error')
        : ((contextSelector && container.querySelector(`${contextSelector} .apple-pay-express-error`)) ||
            container.querySelector('.apple-pay-express-error') ||
            container.querySelector('#express-error'));
    if (!expressContainer) return;
    expressContainer.innerHTML = '<div style="font-size:12px;color:#666;padding:6px 0;">Loading express checkout...</div>';
    if (expressError) expressError.textContent = '';
    if (!cart.length) {
        expressContainer.style.display = 'none';
        return;
    }
    if (!isCartPageContext && !isElementVisible(expressContainer)) {
        requestAnimationFrame(() => mountExpressCheckout(container, options));
        return;
    }
    const signature = getExpressCheckoutSignature(container, options);
    if (expressContainer.dataset.expressMounted === 'true' && expressContainer.dataset.expressSignature === signature) return;
    if (!expressContainer.dataset.expressMountId) expressContainer.dataset.expressMountId = `m${Math.random().toString(36).slice(2, 8)}`;
    const mountKey = getExpressMountKey(expressContainer, signature, options);
    if (expressMountState.has(mountKey)) return expressMountState.get(mountKey);
    expressContainer.dataset.expressMounted = 'mounting';
    const mountPromise = (async () => {
        const attemptMount = async () => {
            const stripe = await preloadStripe();
            const clientSecret = await getExpressCheckoutClientSecret(container, options);
            const elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe', variables: { colorText: '#000000', fontFamily: "'Courier New', Courier, monospace" } } });
            const expressCheckoutElement = elements.create('expressCheckout', {
                buttonHeight: 50,
                buttonTheme: { applePay: 'white-outline', googlePay: 'white', link: 'black', amazonPay: 'gold', klarna: 'light' },
                paymentMethods: { applePay: 'always', googlePay: 'always', link: 'auto', amazonPay: 'auto', klarna: 'auto', paypal: 'never' }
            });
            expressContainer.innerHTML = '';
            expressCheckoutElement.mount(expressContainer);
            expressContainer.dataset.expressMounted = 'true';
            expressContainer.dataset.expressSignature = signature;
            expressCheckoutElement.on('ready', ({ availablePaymentMethods }) => { expressContainer.style.display = availablePaymentMethods ? 'block' : 'none'; });
            expressCheckoutElement.on('confirm', async () => {
                if (expressError) expressError.textContent = '';
                const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: new URL(stripeSettings.successUrl || '/success.html', window.location.origin).toString() } });
                if (error && expressError) expressError.textContent = error.message || 'Express checkout failed.';
            });
        };
        for (let attempt = 0; attempt <= EXPRESS_MOUNT_RETRY_DELAYS_MS.length; attempt += 1) {
            try {
                await attemptMount();
                return;
            } catch (error) {
                if (attempt < EXPRESS_MOUNT_RETRY_DELAYS_MS.length) {
                    await new Promise((resolve) => setTimeout(resolve, EXPRESS_MOUNT_RETRY_DELAYS_MS[attempt]));
                    continue;
                }
                delete expressContainer.dataset.expressMounted;
                expressContainer.style.display = 'none';
                if (expressError) expressError.textContent = error.message || 'Unable to load express checkout.';
                console.warn("Express checkout mount failed", options.context || 'default', error);
                throw error;
            }
        }
    })().finally(() => expressMountState.delete(mountKey));
    expressMountState.set(mountKey, mountPromise);
    return mountPromise;
}



async function mountWalletExpressCheckout(form, wallet = 'apple') {
    const wrapper = form.querySelector('.wallet-bottom-action');
    if (!wrapper) return false;
    const expressContainer = wrapper.querySelector('.wallet-express-element');
    const expressError = wrapper.querySelector('.wallet-express-error');
    if (!expressContainer) return false;
    wrapper.style.display = 'block';
    expressContainer.innerHTML = '<div style="font-size:12px;color:#666;padding:6px 0;">Loading express checkout...</div>';
    if (expressError) expressError.textContent = '';
    const mountOptions = { wallet, context: 'wallet-bottom' };
    const signature = getExpressCheckoutSignature(form, mountOptions);
    if (expressContainer.dataset.expressMounted === 'true' && expressContainer.dataset.expressSignature === signature) return true;
    const mountKey = getExpressMountKey(expressContainer, signature, mountOptions);
    if (expressMountState.has(mountKey)) return expressMountState.get(mountKey);
    const mountPromise = (async () => {
        const stripe = await preloadStripe();
        const clientSecret = await getExpressCheckoutClientSecret(form, mountOptions);
        const elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe', variables: { colorText: '#000000', fontFamily: "'Courier New', Courier, monospace" } } });
        let element;
        try {
            element = elements.create('expressCheckout', { buttonHeight: 50, paymentMethods: { applePay: wallet === 'apple' ? 'always' : 'never', googlePay: wallet === 'google' ? 'always' : 'never', amazonPay: wallet === 'amazon' ? 'always' : 'never', link: 'auto', klarna: 'never', paypal: 'never' }, buttonTheme: { applePay: 'white-outline', googlePay: 'white', amazonPay: 'gold', link: 'black' } });
        } catch (_) {
            element = elements.create('expressCheckout', { buttonHeight: 50, paymentMethods: { link: 'auto' }, buttonTheme: { link: 'black' } });
        }
        element.mount(expressContainer);
        expressContainer.dataset.expressMounted = 'true';
        expressContainer.dataset.expressSignature = signature;
        element.on('confirm', async () => {
            const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: new URL(stripeSettings.successUrl || '/success.html', window.location.origin).toString() } });
            if (error && expressError) expressError.textContent = error.message || 'Wallet checkout failed.';
        });
        return true;
    })().catch((error) => {
        if (expressError) expressError.textContent = error.message || 'Unable to load wallet checkout.';
        console.warn("Express checkout mount failed", 'wallet-bottom', error);
        return false;
    }).finally(() => expressMountState.delete(mountKey));
    expressMountState.set(mountKey, mountPromise);
    return mountPromise;
}

function updatePaymentMethodUI(form) {
    const selected = form.querySelector('input[name="payment-method"]:checked')?.value;
    const submitButton = form.querySelector('#final-order-submit');
    const creditFields = form.querySelector('.credit-card-fields');
    const walletAction = form.querySelector('.wallet-bottom-action');

    const walletMap = {
        apple: 'apple',
        google: 'google',
        amazon: 'amazon'
    };

    const selectedWallet = walletMap[selected];

    if (selectedWallet) {
        if (submitButton) submitButton.style.display = 'none';
        if (creditFields) creditFields.style.display = 'none';
        if (walletAction) walletAction.style.display = 'block';

        mountWalletExpressCheckout(form, selectedWallet).catch((error) => {
            console.error('Wallet button mount failed:', error);
            const err = form.querySelector('.wallet-express-error');
            if (err) err.textContent = error.message || 'Unable to load wallet button.';
        });
        return;
    }

    if (walletAction) walletAction.style.display = 'none';

    if (selected === 'credit') {
        if (submitButton) submitButton.style.display = 'block';
        if (creditFields) creditFields.style.display = 'block';
        return;
    }

    if (submitButton) submitButton.style.display = 'block';
    if (creditFields) creditFields.style.display = 'none';
}

const stripeEmbeddedState = {
    stripe: null,
    elements: null,
    paymentElement: null,
    clientSecret: '',
    lineItemsSignature: '',
    mountedForm: null
};

function clearEmbeddedPaymentState() {
    if (stripeEmbeddedState.paymentElement) {
        stripeEmbeddedState.paymentElement.unmount();
    }
    stripeEmbeddedState.elements = null;
    stripeEmbeddedState.paymentElement = null;
    stripeEmbeddedState.clientSecret = '';
    stripeEmbeddedState.lineItemsSignature = '';
    stripeEmbeddedState.mountedForm = null;
}

async function ensureEmbeddedPaymentReady(form) {
    await loadStripeConfig();
    const paymentIntentEndpoint = buildPaymentIntentEndpoint(stripeSettings.checkoutEndpoint);
    if (!paymentIntentEndpoint) {
        throw new Error('Stripe payment intent endpoint is not configured. Set checkoutEndpoint in stripe-config.json to your Render API URL.');
    }

    const creditFields = form.querySelector('.credit-card-fields');
    if (!creditFields) {
        throw new Error('Payment form container is missing.');
    }

    let elementContainer = creditFields.querySelector('.stripe-payment-element');
    if (!elementContainer) {
        elementContainer = document.createElement('div');
        elementContainer.className = 'stripe-payment-element';
        creditFields.appendChild(elementContainer);
    }

    let status = creditFields.querySelector('.stripe-payment-status');
    if (!status) {
        status = document.createElement('div');
        status.className = 'stripe-payment-status';
        creditFields.appendChild(status);
    }
    status.textContent = 'Loading secure payment form...';

    const { lineItems, missing } = buildStripeLineItems();
    if (missing.length) {
        throw new Error(`Stripe price IDs missing for: ${missing.join(', ')}.`);
    }
    const contactEmail = form.querySelector('input[name="contact_email"]')?.value?.trim() || '';
    const normalizedEmail = contactEmail.toLowerCase();
    const lineItemsSignature = JSON.stringify({ lineItems, contactEmail: normalizedEmail });
    const shouldReuse = (
        stripeEmbeddedState.elements &&
        stripeEmbeddedState.lineItemsSignature === lineItemsSignature &&
        stripeEmbeddedState.mountedForm === form
    );
    if (shouldReuse) {
        status.textContent = '';
        return stripeEmbeddedState;
    }

    clearEmbeddedPaymentState();
    const intentResponse = await fetch(paymentIntentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems, cart, customerEmail: normalizedEmail })
    });
    const intentPayload = await intentResponse.json().catch(() => ({}));
    if (!intentResponse.ok || !intentPayload.clientSecret) {
        throw new Error(intentPayload.error || 'Unable to initialize Stripe Payment Element.');
    }

    const stripe = await getStripe();
    const elements = stripe.elements({
        clientSecret: intentPayload.clientSecret,
        appearance: {
            theme: 'stripe',
            variables: {
                colorText: '#000000',
                fontFamily: "'Courier New', Courier, monospace"
            }
        }
    });

    const paymentElement = elements.create('payment', { layout: 'tabs' });
    paymentElement.mount(elementContainer);
    status.textContent = '';

    stripeEmbeddedState.stripe = stripe;
    stripeEmbeddedState.elements = elements;
    stripeEmbeddedState.paymentElement = paymentElement;
    stripeEmbeddedState.clientSecret = intentPayload.clientSecret;
    stripeEmbeddedState.lineItemsSignature = lineItemsSignature;
    stripeEmbeddedState.mountedForm = form;
    return stripeEmbeddedState;
}

async function submitEmbeddedPayment(form, paymentMsg) {
    const state = await ensureEmbeddedPaymentReady(form);
    const { error, paymentIntent } = await state.stripe.confirmPayment({
        elements: state.elements,
        confirmParams: {
            return_url: normalizeCheckoutUrl(stripeSettings.successUrl, `${window.location.origin}/success.html`)
        },
        redirect: 'if_required'
    });

    if (error) {
        throw new Error(error.message || 'Unable to confirm payment.');
    }

    if (!paymentIntent || !['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) {
        throw new Error('Payment is not complete yet. Please follow any additional prompts and try again.');
    }

    if (paymentMsg) {
        paymentMsg.innerHTML = '<div>Payment received. Redirecting...</div>';
    }
    localStorage.setItem('cart', '[]');
    const successUrl = new URL(normalizeCheckoutUrl(stripeSettings.successUrl, `${window.location.origin}/success.html`), window.location.origin);
    successUrl.searchParams.set('payment_intent', paymentIntent.id);
    window.location.assign(successUrl.toString());
}

function activateEmbeddedCardFallback(message) {
    const activeCheckout = document.querySelector('#cart-modal #final-checkout[style*="display: block"], #cart-modal #final-checkout:not([style*="display: none"])')
        || document.querySelector('#final-checkout');
    if (!activeCheckout) {
        if (message) alert(message);
        return false;
    }

    const creditRadio = activeCheckout.querySelector('input[name="payment-method"][value="credit"]');
    if (creditRadio) {
        creditRadio.checked = true;
        creditRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const form = activeCheckout.querySelector('form.checkout-form');
    if (form) {
        ensureEmbeddedPaymentReady(form).catch(() => {});
    }

    if (message) {
        alert(message + ' Please continue with secure card checkout below.');
    }
    return true;
}

async function startStripeCheckout(method = 'Stripe', customerEmail = '') {
    if (!cart.length) {
        alert('Your cart is empty.');
        return;
    }

    const unsupportedMessage = unsupportedMethodNotices[method];
    if (unsupportedMessage) {
        alert(unsupportedMessage);
    }

    await loadStripeConfig();

    const { lineItems, missing } = buildStripeLineItems();
    if (missing.length) {
        alert(`Stripe price IDs missing for: ${missing.join(', ')}. Checkout requires real price_... IDs in stripe-config.json (or data-price-id on cart items).`);
        return;
    }
    if (!lineItems.length) {
        alert('Unable to start checkout without items.');
        return;
    }
    if (stripeSettings.checkoutEndpoint) {
        try {
            await startServerCheckout(method, lineItems, customerEmail);
            return;
        } catch (err) {
            alert(`${err.message || 'Unable to start server-side checkout.'} Trying direct Stripe checkout.`);
            try {
                await startClientCheckout(lineItems);
                return;
            } catch (clientErr) {
                alert(clientErr.message || 'Unable to start direct Stripe checkout.');
                return;
            }
        }
    }

    try {
        await startClientCheckout(lineItems);
    } catch (err) {
        alert(err.message || 'Unable to start Stripe Checkout.');
    }
}

function initCart() {
    try {
        const stored = JSON.parse(localStorage.getItem('cart') || '[]');
        cart = Array.isArray(stored) ? stored : [];
    } catch (e) {
        cart = [];
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
    populateCartPage();
    document.querySelectorAll('#final-checkout').forEach(section => {
        populateOrderSummary(section);
    });
    preloadStripe().catch(() => {});
    prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
}

// animate a star from the clicked button to the cart icon
function animateStar(button) {
    const cartIcon = document.querySelector('.cart-icon');
    if (!cartIcon || !button) return;

    const startRect = button.getBoundingClientRect();
    const endRect = cartIcon.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    const star = document.createElement('div');
    star.textContent = '★';
    star.style.position = 'fixed';
    star.style.left = `${startX}px`;
    star.style.top = `${startY}px`;
    star.style.fontSize = '24px';
    star.style.color = 'gold';
    star.style.pointerEvents = 'none';
    star.style.zIndex = '1000';
    document.body.appendChild(star);

    const animation = star.animate(
        [
            { transform: 'translate(0, 0)', opacity: 1 },
            { transform: `translate(${endX - startX}px, ${endY - startY}px)`, opacity: 0 }
        ],
        {
            duration: 1000,
            easing: 'ease-in-out'
        }
    );
    animation.onfinish = () => star.remove();
}

function addToCart(button) {
    const item = button.closest('.product-item');
    const hasColor = item.querySelector('.color-option') !== null;
    const hasSize = item.querySelector('.size-select select') !== null;
    const colorSelected = item.querySelector('.color-option.selected');
    const sizeSelected = item.dataset.size && item.dataset.size !== '';

    const missing = [];
    if (hasSize && !sizeSelected) missing.push('size');
    if (hasColor && !colorSelected) missing.push('color');

    if (missing.length) {
        let msg = '';
        if (missing.length === 2) {
            msg = 'Please select a style/color and size.';
        } else if (missing[0] === 'color') {
            msg = 'Please select a style/color.';
        } else {
            msg = 'Please select a size.';
        }
        if (missing.includes('color')) {
            highlightField(item.querySelector('.color-options'));
        }
        if (missing.includes('size')) {
            highlightField(item.querySelector('.size-select select'));
        }
        showSelectionError(msg);
        return;
    }

    const product = {
        name: item.dataset.product,
        color: colorSelected ? colorSelected.dataset.color : item.dataset.selectedColor || '',
        price: item.dataset.price,
        stripePriceId: item.dataset.priceId || '',
        image: item.querySelector('img') ? item.querySelector('img').src : '',
        style: item.dataset.style || '',
        size: item.dataset.size || '',
        quantity: parseInt(item.dataset.quantity) || 1,
        timestamp: Date.now()
    };
    cart.push(product);
    trackAnalyticsEvent('add_to_cart', { product: product.name, priceId: product.stripePriceId });
    invalidateExpressCheckoutCache();
    prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
    localStorage.setItem('cart', JSON.stringify(cart));
    // TODO: sync with store server for inventory management
    updateCartCounter();
    ensureCartTriggerBound();
    animateStar(button);
}

function checkout(button) {
    trackAnalyticsEvent('checkout_click');
    // If triggered from a product page, add the item to the cart first
    if (button && button.closest('.product-item')) {
        addToCart(button);
    }
    openCart(true);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    invalidateExpressCheckoutCache();
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
    populateCartModal();
    populateCartPage();
    document.querySelectorAll('#final-checkout').forEach(section => {
        populateOrderSummary(section);
    });
    prewarmExpressCheckout(document);
    prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
}

function openCart(showForm = false) {
    trackAnalyticsEvent('cart_visit');
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = createCartModal();
    }
    populateCartModal();
    modal.style.display = 'flex';
    setTimeout(() => { mountExpressCheckout(modal, { context: 'cart-popup', forceEstimate: true }); }, 0);
    if (cart.length === 0) {
        const msg = modal.querySelector('.cart-empty-message');
        if (msg) {
            msg.textContent = 'Your cart is empty.';
            msg.style.display = 'block';
            msg.style.color = '#000';
        }
    } else if (showForm) {
        showCheckoutForm(modal);
    }
}

function showSelectionError(message) {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = createCartModal();
    }
    const content = modal.querySelector('.cart-content');
    const hideSelectors = ['.logo-container', '#cart-current-time', 'h2', '.item-count', '.order-summary-bar', '#order-summary-details', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.cart-footer', '.footer-links', '.cart-empty-message'];
    hideSelectors.forEach(sel => {
        const el = content.querySelector(sel);
        if (el) el.style.display = 'none';
    });
    let msg = content.querySelector('.selection-error');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'selection-error';
        msg.style.textAlign = 'center';
        msg.style.color = 'black';
        msg.style.fontWeight = 'bold';
        content.appendChild(msg);
    }
    msg.textContent = message;
    modal.style.display = 'flex';
    setTimeout(() => {
        msg.remove();
        modal.style.display = 'none';
        populateCartModal();
    }, 2000);
}

function highlightField(field) {
    if (!field) return;
    field.focus();
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.style.outline = '2px solid red';
    const clear = () => { field.style.outline = ''; };
    field.addEventListener('input', clear, { once: true });
    field.addEventListener('change', clear, { once: true });
    field.addEventListener('click', clear, { once: true });
}

function createCartModal() {
    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.innerHTML = `
        <div class="cart-content">
            <button id="cart-close" class="close-btn">&times;</button>
            <div class="logo-container">
                <iframe allowfullscreen width="640" height="480" loading="lazy" frameborder="0" src="https://p3d.in/e/307lu+clean+spin+load"></iframe>
            </div>
            <div class="cart-time" id="cart-current-time"></div>
            <h2>Cart</h2>
            <div class="item-count"></div>
            <div class="order-summary-bar" style="display:none;">
                <button id="toggle-order-summary" class="summary-toggle" type="button">Order summary <span class="arrow">▼</span></button>
                <strong class="order-total">$0.00</strong>
            </div>
            <div id="order-summary-details">
                <div class="cart-items"></div>
                <div class="cost-summary">
                    <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                    <div><span>Tax</span><span class="tax">Calculated at checkout</span></div>
                    <div><span>Shipping</span><span class="shipping">Calculated at checkout</span></div>
                    <div><strong>Total</strong><strong class="total">$0.00</strong></div>
                </div>
            </div>
            <div class="cart-buttons">
                <button id="view-cart">VIEW CART</button>
                <button id="cart-checkout">CHECKOUT</button>
            </div>
            <div class="or">OR</div>
            <div class="express-checkout">
                <h3>Express checkout</h3>
                <div class="express-checkout-container" data-express-context="checkout-form">
                    <div class="apple-pay-express-element"></div>
                    <div class="apple-pay-express-error" style="color:red; font-size:12px; margin-top:8px;"></div>
                </div>
            </div>
            <form id="checkout-form" style="display:none;">
                <h3>Sign up and know first!</h3>
                <div class="phone-input">
                    <span class="phone-icon">📱</span>
                    <span class="phone-prefix">+1</span>
                    <input type="tel" name="signup_phone" placeholder="Mobile phone number">
                </div>
                <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                <button type="button" class="signup-btn">Sign Up</button>
                <h3>Express checkout</h3>
        <div class="express-checkout-container" data-express-context="checkout-form">
                    <div class="apple-pay-express-element"></div>
                    <div class="apple-pay-express-error" style="color:red; font-size:12px; margin-top:8px;"></div>
                </div>
            </form>
            <div id="final-checkout" style="display:none;">
                <form id="final-form">
                    <h2 class="checkout-domain">maybenot.com</h2>
                    <div class="order-summary-bar">
                        <button id="final-toggle-order-summary" class="summary-toggle" type="button">Order summary <span class="arrow">▼</span></button>
                        <strong class="order-total">$0.00</strong>
                    </div>
                    <div class="order-summary-details top-summary">
                        <div class="cart-items"></div>
                        <div class="cost-summary">
                            <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                            <div><span>Tax</span><span class="tax">$0.00</span></div>
                            <div><span>Shipping</span><span class="shipping">Select shipping method</span></div>
                            <div><strong>Total</strong><strong class="total">$0.00</strong></div>
                        </div>
                    </div>
                    <h3>Sign up and know first!</h3>
                    <div class="phone-input">
                        <span class="phone-icon">📱</span>
                        <span class="phone-prefix">+1</span>
                        <input type="tel" name="signup_phone" placeholder="Mobile phone number">
                    </div>
                    <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                    <button type="button" class="signup-btn">Sign Up</button>
                    <h3>Express checkout</h3>
        <div class="express-checkout-container" data-express-context="checkout-form">
                    <div class="apple-pay-express-element"></div>
                    <div class="apple-pay-express-error" style="color:red; font-size:12px; margin-top:8px;"></div>
                </div>
                    <div class="or">OR</div>
                    <div class="contact-header">
                        <h3>Contact</h3>
                        <button type="button" id="login-btn" onclick="window.location.href='/account';">Log in</button>
                    </div>
                    <input type="email" name="contact_email" placeholder="Enter an email">
                    <p class="email-warning empty-cart-message" style="display:none;">Please provide your contact email for this order.</p>
                    <h3>Delivery</h3>
                    <p>This will also be used as your billing address for this order.</p>
                    <input type="text" name="first_name" placeholder="Enter a first name">
                    <p class="field-warning empty-cart-message" data-field="first_name" style="display:none;">Please enter a first name.</p>
                    <input type="text" name="last_name" placeholder="Enter a last name">
                    <p class="field-warning empty-cart-message" data-field="last_name" style="display:none;">Please enter a last name.</p>
                    <input type="text" name="address" placeholder="Enter an address">
                    <p class="field-warning empty-cart-message" data-field="address" style="display:none;">Please enter an address.</p>
                    <input type="text" name="city" placeholder="Enter a city">
                    <p class="field-warning empty-cart-message" data-field="city" style="display:none;">Please enter a city.</p>
                    <input type="text" name="state" placeholder="Enter a state">
                    <p class="field-warning empty-cart-message" data-field="state" style="display:none;">Please enter a state.</p>
                    <input type="text" name="zip" placeholder="Enter a ZIP / postal code">
                    <p class="field-warning empty-cart-message" data-field="zip" style="display:none;">Please enter a ZIP / postal code.</p>
                    <h3>Shipping method</h3>
                    <p class="shipping-placeholder">Enter your shipping address to view available shipping methods.</p>
                    <div class="shipping-method" style="display:none;"><span>UPS Ground</span><span>$15.00</span></div>
                    <h3>Payment</h3>
                    <p>Your payment method’s billing address must match the shipping address. All transactions are secure and encrypted.</p>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-credit" value="credit">
                        <label for="cart-pay-credit">
                            <span class="payment-label">Credit card</span>
                            <span class="payment-logos">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png" alt="Visa">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png" alt="Mastercard">
                                <img src="amex.png" alt="American Express">
                                <span class="more-logos" id="more-cards">+5</span>
                                <div class="more-logos-box" id="more-cards-box">
                                    <img src="discover.png" alt="Discover">
                                    <img src="elo.png" alt="Elo">
                                    <img src="jcb.png" alt="JCB">
                                    <img src="unionpay.png" alt="UnionPay">
                                    <img src="oo.png" alt="OO">
                                </div>
                            </span>
                        </label>
                    </div>
                    <div class="credit-card-fields" style="display:none;">
                        <div class="stripe-payment-element" aria-label="Secure payment form"></div>
                    </div>
                    <p class="card-warning empty-cart-message" style="display:none;">Please complete your secure payment details.</p>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-apple" value="apple">
                        <label for="cart-pay-apple">
                            <span class="payment-label">Apple Pay</span>
                            <span class="payment-logos"><img src="applepay.png" alt="Apple Pay"></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-google" value="google">
                        <label for="cart-pay-google">
                            <span class="payment-label">Google Pay</span>
                            <span class="payment-logos"><span>G Pay</span></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-amazon" value="amazon">
                        <label for="cart-pay-amazon">
                            <span class="payment-label">Amazon Pay</span>
                            <span class="payment-logos"><span>Amazon Pay</span></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-klarna" value="klarna">
                        <label for="cart-pay-klarna">
                            <span class="payment-label">Klarna - <span class="subtext">Flexible payments</span></span>
                            <span class="payment-logos"><img src="klarna.png" alt="Klarna" class="klarna-logo"></span>
                        </label>
                    </div>
                    <div class="payment-option shop-pay">
                        <input type="radio" name="payment-method" id="cart-pay-shop" value="shop">
                        <label for="cart-pay-shop">
                            <span class="payment-label"><span>Shop Pay</span><span class="subtext">Pay in full or in installments</span></span>
                            <span class="payment-logos"><img src="shoppay.png" alt="Shop Pay"></span>
                        </label>
                    </div>
                    <div id="payment-message"></div>
                    <div class="remember-section">
                        <strong class="remember-heading">Remember me</strong>
                        <div class="remember-check">
                            <input type="checkbox" name="remember" id="remember-me" checked>
                        </div>
                        <label for="remember-me" class="remember-text">Save my information for a faster checkout with a Shop account</label>
                        <div id="phone-container" class="phone-input" style="display:none;">
                            <span class="phone-icon">📱</span>
                            <span class="phone-prefix">+1</span>
                            <input type="tel" name="remember_phone" placeholder="Mobile phone number">
                        </div>
                        <p class="remember-warning empty-cart-message" style="display:none;">Please provide a mobile phone number to continue or deselect this option.</p>
                        <div class="secure-row">
                            <span class="secure-text">Secure and encrypted</span>
                            <div class="shop-logo"><img src="/shoppayhalf.png" alt="Shop Pay"></div>
                        </div>
                    </div>
                    <div class="order-summary-bar">
                        <div class="summary-label">Order summary</div>
                    </div>
                    <p class="order-note">PLEASE NOTE: WE DO NOT PROCESS ORDERS ON SATURDAYS AND SUNDAYS, PLEASE ALLOW AN ADDITIONAL 2 - 3 BUSINESS DAYS FOR PROCESSING TIME WHEN PLACED ON THE WEEKEND.
ALL SALES FINAL. NO EXCHANGES OR RETURNS</p>
                    <div class="order-summary-details bottom-summary">
                        <div class="cart-items"></div>
                        <div class="cost-summary">
                            <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                            <div><span>Tax</span><span class="tax">$0.00</span></div>
                            <div><span>Shipping</span><span class="shipping">Select shipping method</span></div>
                            <div><strong>Total</strong><strong class="total">$0.00</strong></div>
                        </div>
                    </div>
                    <div class="wallet-bottom-action" style="display:none;">
                        <div class="wallet-express-element"></div>
                        <div class="wallet-express-error" style="color:red; font-size:12px; margin-top:8px;"></div>
                    </div>
                    <button id="final-order-submit" type="submit">Pay now</button>
                    <p id="remember-message" style="display:none;">Your info will be saved to a Shop account. By continuing, you agree to Shop’s <a href="https://shop.app/terms-of-service" target="_blank" style="color:red;">Terms of Service</a> and acknowledge the <a href="https://www.shopify.com/legal/privacy/consumers" target="_blank" style="color:red;">Privacy Policy</a>.</p>
                </form>
            </div>
            <footer>
                <div class="footer-links" style="display:none;">
                    <div class="footer-line extra-padding">
                        <a href="shop.html">shop</a>
                        <a href="all.html">view all</a>
                        <a href="soon.html">preview</a>
                        <a href="soon.html">lookbook</a>
                        <a href="news.html">news</a>
                    </div>
                </div>
                <div class="cart-footer" style="display:none;">
                    <a href="#">refund policy</a> |
                    <a href="#">shipping</a> |
                    <a href="privacy.html">privacy policy</a> |
                    <a href="terms.html">terms of service</a> |
                    <a href="#">cookies</a>
                </div>
            </footer>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#cart-close').addEventListener('click', closeCart);
    modal.querySelector('#view-cart').addEventListener('click', () => {
        window.location.href = 'cart.html';
    });
    modal.querySelector('#cart-checkout').addEventListener('click', () => showCheckoutForm(modal));
    modal.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('pointerdown', () => {
            modal.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (btn.dataset.method === "express") {
                mountExpressCheckout(modal, { context: 'cart-popup', forceEstimate: true });
                return;
            }
            handleExpressButtonClick(modal, btn.dataset.method);
        });
    });


    function updateCartTime() {
        const options = {
            timeZone: 'America/Chicago',
            hour: '2-digit',
            minute: '2-digit',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };
        const currentTime = new Intl.DateTimeFormat('en-US', options).format(new Date()).replace(',', '');
        const timeEl = modal.querySelector('#cart-current-time');
        if (timeEl) timeEl.textContent = `${currentTime} CHICAGO`;
    }
    updateCartTime();
    setInterval(updateCartTime, 1000);

    if (!document.getElementById('cart-modal-style')) {
        const style = document.createElement('style');
        style.id = 'cart-modal-style';
        style.textContent = `
            #cart-modal {position:fixed;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:1000;}
            #cart-modal .cart-content {background:#fff;padding:20px;max-width:600px;width:90%;text-align:center;position:relative;font-family:sans-serif;max-height:90vh;overflow-y:auto;}
            #cart-modal .close-btn {position:absolute;top:10px;left:10px;background:#000;color:#fff;border:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;padding:0;font-size:14px;font-family:Arial,sans-serif;line-height:0;cursor:pointer;text-indent:-2px;}
            #cart-modal .cart-buttons {display:flex;flex-direction:column;align-items:center;}
            #cart-modal button:not(.pay-btn):not(.summary-toggle){background:#000;color:#fff;border:none;padding:10px;margin:5px auto;cursor:pointer;display:block;}
            #cart-modal .pay-btn{background:transparent;border:none;margin:0;padding:0;display:flex;justify-content:center;align-items:center;}
            #cart-modal .pay-btn.paypal{background:#ffc439;width:80px;height:40px;padding:0;margin-top:10px;align-self:center;}
            #cart-modal .pay-btn.paypal img{width:100%;height:100%;object-fit:contain;}
            #cart-modal .payment-icons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px auto;justify-content:center;justify-items:center;max-width:260px;width:100%;}
            #cart-modal .payment-icons img{width:80px;height:auto;}
            #cart-modal .payment-icons img[alt="Apple Pay"]{width:120px;}
            #cart-modal .payment-icons img.klarna-logo{width:140px;}
            #cart-modal .cost-summary div{display:flex;justify-content:space-between;margin:5px 0;}
            #cart-modal .cart-item{display:flex;align-items:center;justify-content:space-between;margin:5px 0;position:relative;padding-top:10px;}
            #cart-modal .cart-item.no-remove{padding-top:0;}
            #cart-modal .cart-item img{width:50px;height:50px;object-fit:contain;margin-right:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.1));}
            #cart-modal .cart-item .cart-item-info{text-align:left;flex:1;}
            #cart-modal .cart-item .remove-item{background:#000;color:#fff;border:none;position:absolute;top:0;right:0;cursor:pointer;font-size:14px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;padding:0;font-family:Arial,sans-serif;line-height:0;text-indent:-2px;}
            #cart-modal .or {margin:10px 0;}
            #cart-modal footer a {color:#000;margin:0 5px;font-size:0.8em;text-decoration:none;}
            #cart-modal .footer-links{display:flex;justify-content:center;flex-wrap:wrap;gap:15px;background:#fff;}
            #cart-modal .footer-line{display:flex;justify-content:center;flex-wrap:wrap;gap:15px;padding-bottom:10px;}
            #cart-modal .footer-line.extra-padding{padding-bottom:10px;}
            #cart-modal .footer-links a{color:#000;text-decoration:none;font-size:0.8em;}
            #cart-modal .footer-links a:hover,#cart-modal .footer-links a:focus,#cart-modal .footer-links a:active{border:2px solid red;color:red;background:#fff;}
            #cart-modal button:not(.pay-btn):not(.summary-toggle):hover,#cart-modal button:not(.pay-btn):not(.summary-toggle):focus,#cart-modal button:not(.pay-btn):not(.summary-toggle):active,#cart-modal footer a:hover,#cart-modal footer a:focus,#cart-modal footer a:active{border:2px solid red;color:red;background:#fff;}
            #checkout-form input {display:block;width:100%;margin:5px auto;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}
            .consent-text {font-size:0.7rem;margin-top:10px;}
            #final-checkout{text-align:center;}
            #final-checkout input:not([type="radio"]) {display:block;width:100%;margin:5px auto;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}
            .contact-header{position:relative;width:100%;}
            .contact-header h3{text-align:center;margin:0;}
            #login-btn{background:none;border:none;color:#000;cursor:pointer;text-decoration:underline;font-size:0.9em;padding:0;position:absolute;right:0;top:50%;transform:translateY(-50%);}
            #login-btn:hover{color:red;}
            .remember-section{text-align:center;margin-top:10px;display:flex;flex-direction:column;align-items:center;}
            .remember-heading{display:block;font-weight:700;text-align:center;}
            .remember-check{margin-top:5px;display:flex;justify-content:center;align-items:center;width:auto;margin-left:auto;margin-right:auto;}
            .remember-check input{width:20px;height:20px;margin:0;}
            .remember-text{display:block;margin-top:5px;text-align:center;}
            .order-note{text-align:left;font-size:0.8em;margin:0 0 10px;}
            .phone-input{margin-top:5px;display:flex;align-items:center;width:100%;}
            .phone-input .phone-icon{margin-right:5px;}
            .phone-input .phone-prefix{margin-right:5px;}
            .phone-input input{flex:1;padding-left:0;}
            .secure-row{display:flex;justify-content:space-between;align-items:center;margin-top:5px;width:100%;}
            .secure-text{color:#888;font-size:0.8em;}
            .shop-logo{width:40px;height:auto;}
            .shop-logo img{width:100%;height:auto;object-fit:contain;filter:grayscale(100%);}
            .checkout-domain{margin-top:5px;}
            .credit-card-fields input{width:100%;}
            .stripe-payment-element{width:100%;min-height:52px;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;background:#fff;}
            .stripe-payment-status{margin-top:8px;font-size:0.8rem;text-align:left;}
            .payment-option{display:flex;align-items:center;border:1px solid #ccc;padding:10px;margin:5px 0;cursor:pointer;width:100%;box-sizing:border-box;gap:10px;flex-wrap:wrap;}
            .payment-option input{margin:0;flex-shrink:0;width:auto;padding:0;}
            .payment-option label{display:flex;align-items:center;justify-content:space-between;flex:1;cursor:pointer;gap:10px;flex-wrap:wrap;width:100%;}
            .payment-label{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .payment-label .subtext{font-size:0.8em;}
            .payment-option.shop-pay .payment-label{white-space:normal;display:flex;flex-direction:column;align-items:flex-start;overflow:visible;text-overflow:unset;} .payment-option.shop-pay .payment-label .subtext{white-space:normal;margin-top:2px;}
            .payment-logos{margin-left:10px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:100%;position:relative;}
            .payment-logos img{height:20px;max-width:100%;}
            .payment-logos img[alt="Apple Pay"]{height:30px;}
            .payment-logos img.klarna-logo{height:40px;} .payment-logos img[alt="Visa"],.payment-logos img[alt="Mastercard"],.payment-logos img[alt="American Express"]{height:20px;width:32px;object-fit:contain;}
            .more-logos{margin-left:5px;cursor:pointer;color:#000;font-weight:600;}
            .more-logos-box{display:none;position:absolute;bottom:100%;left:0;right:auto;transform:translateX(0);background:#fff;padding:5px;z-index:10;border:1px solid #ccc;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
            .more-logos-box img{width:32px;height:20px;margin:0 2px;object-fit:contain;}
            .shipping-method{display:flex;justify-content:space-between;border:1px solid #ccc;padding:10px;margin:5px 0;}
            #cart-modal .logo-container{width:80px;height:80px;margin:0 auto;}
            #cart-modal .logo-container iframe{width:100%;height:100%;border:none;}
            #cart-modal .cart-time{text-align:center;font-size:0.7rem;font-weight:600;margin-top:5px;}
            #cart-modal .order-summary-bar{display:flex;align-items:center;margin:10px 0;width:100%;justify-content:space-between;}
            #cart-modal .summary-toggle{background:#000;color:#fff;border:none;font-size:1em;display:inline-flex;align-items:center;justify-content:flex-start;cursor:pointer;padding:10px;margin:0;margin-left:0;}
            #cart-modal .summary-toggle .arrow{margin-left:5px;}
            .summary-label{background:#000;color:#fff;font-size:1em;display:inline-block;padding:10px;margin:0;margin-left:0;}
            #cart-modal .order-total{font-weight:bold;margin:0;margin-left:auto;}
            #cart-modal footer{background:#fff;padding:10px 0;position:static;text-align:center;}
            
            @media (max-width:480px){#cart-modal .payment-option{flex-wrap:wrap;}#cart-modal .payment-option label{flex-direction:row;align-items:center;flex-wrap:wrap;width:100%;}#cart-modal .payment-logos{margin-left:10px;justify-content:flex-start;position:relative;}#cart-modal .payment-option.shop-pay .payment-label .subtext{font-size:0.6em;}}
        `;
        document.head.appendChild(style);
    }

    return modal;
}

function populateCartModal() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    const itemsContainer = modal.querySelector('.cart-items');
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';
    if (cart.length === 0) {
        const hideSelectors = ['.logo-container', '#cart-current-time', 'h2', '.item-count', '.order-summary-bar', '#order-summary-details', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.cart-footer', '.footer-links'];
        hideSelectors.forEach(sel => { const el = modal.querySelector(sel); if (el) el.style.display = 'none'; });
        const content = modal.querySelector('.cart-content');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'center';
        const finalPage = modal.querySelector('#final-checkout');
        if (finalPage) finalPage.style.display = 'none';
        let msg = content.querySelector('.cart-empty-message');
        if (!msg) {
            msg = document.createElement('p');
            msg.className = 'empty-cart-message cart-empty-message';
            msg.textContent = 'Your cart is empty.';
            content.appendChild(msg);
        }
        msg.style.color = '#000';
        msg.style.display = 'block';
        return;
    }
    let subtotal = 0;
    cart.forEach((item, index) => {
        const qty = parseInt(item.quantity) || 1;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <span>${item.name}</span>
                ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                ${item.size ? `<div>Size: ${item.size}</div>` : ''}
                <div>Qty: ${qty}</div>
            </div>
            <span>$${(parseFloat(item.price) * qty).toFixed(2)}</span>
            <button class="remove-item" data-index="${index}">&times;</button>`;
        itemsContainer.appendChild(div);
        subtotal += parseFloat(item.price) * qty;
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    modal.querySelector('.item-count').textContent = `${getTotalQuantity()} Item(s)`;
    const total = subtotal;
    modal.querySelector('.subtotal').textContent = `$${subtotal.toFixed(2)}`;
    modal.querySelector('.tax').textContent = 'Calculated at checkout';
    modal.querySelector('.shipping').textContent = 'Calculated at checkout';
    modal.querySelector('.total').textContent = `$${total.toFixed(2)}`;
    const orderTotal = modal.querySelector('.order-summary-bar .order-total');
    if (orderTotal) orderTotal.textContent = `$${total.toFixed(2)}`;
    modal.querySelector('#checkout-form').style.display = 'none';
    const content = modal.querySelector('.cart-content');
    content.style.display = 'block';
    content.style.justifyContent = '';
    content.style.alignItems = '';
    modal.querySelector('.logo-container').style.display = 'block';
    modal.querySelector('#cart-current-time').style.display = 'block';
    modal.querySelector('h2').style.display = 'block';
    modal.querySelector('.item-count').style.display = 'block';
    const bar = modal.querySelector('.order-summary-bar');
    if (bar) bar.style.display = 'none';
    const details = modal.querySelector('#order-summary-details');
    if (details) details.style.display = 'block';
    modal.querySelector('.cart-items').style.display = 'block';
    modal.querySelector('.cost-summary').style.display = 'block';
    modal.querySelector('.cart-buttons').style.display = 'flex';
    modal.querySelector('.or').style.display = 'block';
    modal.querySelector('.express-checkout').style.display = 'block';
    const finalPage = modal.querySelector('#final-checkout');
    if (finalPage) finalPage.style.display = 'none';
    const footer = modal.querySelector('.cart-footer');
    if (footer) footer.style.display = 'none';
    const footerLinks = modal.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'none';
    const msg = modal.querySelector('.cart-empty-message');
    if (msg) msg.style.display = 'none';
}

function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showCheckoutForm(root = document.getElementById('cart-modal')) {
    const finalPage = root.querySelector('#final-checkout');
    if (finalPage) {
        // If a final checkout page exists, show it immediately without requiring
        // submission of the initial email form.
        showFinalPage(root);
        return;
    }
    // Fallback to original behaviour if no final page is present.
    const bar = root.querySelector('.order-summary-bar');
    const details = root.querySelector('#order-summary-details');
    if (bar && details) {
        bar.style.display = 'flex';
        details.style.display = 'none';
        const totalEl = bar.querySelector('.order-total');
        if (totalEl) {
            const total = cart.reduce((sum, item) => sum + parseFloat(item.price) * (parseInt(item.quantity) || 1), 0);
            totalEl.textContent = `$${total.toFixed(2)}`;
        }
        const toggle = root.querySelector('#toggle-order-summary');
        const arrow = bar.querySelector('.arrow');
        if (toggle && !toggle.dataset.bound) {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const hidden = details.style.display === 'none';
                details.style.display = hidden ? 'block' : 'none';
                if (arrow) arrow.textContent = hidden ? '▲' : '▼';
            });
            toggle.dataset.bound = 'true';
        }
    }
    const cartButtons = root.querySelector('.cart-buttons');
    if (cartButtons) cartButtons.style.display = 'none';
    const or = root.querySelector('.or');
    if (or) or.style.display = 'none';
    const express = root.querySelector('.express-checkout');
    if (express) express.style.display = 'none';
    const header = root.querySelector('h2');
    if (header) header.style.display = 'none';
    const count = root.querySelector('.item-count');
    if (count) count.style.display = 'none';
    const checkoutFormElement = root.querySelector('#checkout-form');
    checkoutFormElement.style.display = 'block';
    mountExpressCheckout(checkoutFormElement, { context: 'checkout-form', forceEstimate: true });
    const footer = root.querySelector('.cart-footer');
    if (footer) footer.style.display = 'block';
    const footerLinks = root.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'flex';
}

function populateOrderSummary(section, state = '', addressFilled = false) {
    if (!section) return;
    const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price) * (parseInt(item.quantity) || 1), 0);
    const rate = state && stateTaxRates[state] !== undefined ? stateTaxRates[state] : defaultTaxRate;
    const tax = subtotal * rate;
    const shipping = shippingCost;
    const total = subtotal + tax + shipping;

    section.querySelectorAll('.order-summary-details').forEach(details => {
        const itemsContainer = details.querySelector('.cart-items');
        const subtotalEl = details.querySelector('.subtotal');
        const taxEl = details.querySelector('.tax');
        const shippingEl = details.querySelector('.shipping');
        const totalEl = details.querySelector('.total');
        if (!itemsContainer || !subtotalEl || !totalEl) return;
        itemsContainer.innerHTML = '';
        cart.forEach(item => {
            const qty = parseInt(item.quantity) || 1;
            const div = document.createElement('div');
            div.className = 'cart-item no-remove';
            div.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <span>${item.name}</span>
                    ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                    ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                    ${item.size ? `<div>Size: ${item.size}</div>` : ''}
                    <div>Qty: ${qty}</div>
                </div>
                <span>$${(parseFloat(item.price) * qty).toFixed(2)}</span>`;
            itemsContainer.appendChild(div);
        });
        subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
        if (shippingEl) shippingEl.textContent = addressFilled ? `$${shippingCost.toFixed(2)}` : 'Select shipping method';
        totalEl.textContent = `$${total.toFixed(2)}`;
    });

    const barTotal = section.querySelector('.order-summary-bar .order-total');
    if (barTotal) barTotal.textContent = `$${total.toFixed(2)}`;
}

function updateShippingAndTax(form) {
    if (!form) return;
    const checkout = form.closest('#final-checkout');
    if (!checkout) return;
    const addressFilled = ['address', 'city', 'state', 'zip'].every(name => {
        const input = form.querySelector(`input[name="${name}"]`);
        return input && input.value.trim();
    });
    const placeholder = checkout.querySelector('.shipping-placeholder');
    const method = checkout.querySelector('.shipping-method');
    if (placeholder) placeholder.style.display = addressFilled ? 'none' : 'block';
    if (method) method.style.display = addressFilled ? 'flex' : 'none';
    const state = form.querySelector('input[name="state"]')?.value.trim().toUpperCase() || '';
    populateOrderSummary(checkout, state, addressFilled);
}

function showFinalPage(root = document.getElementById('cart-modal')) {
    root.querySelector('#checkout-form').style.display = 'none';
    const mainBar = [...root.querySelectorAll('.order-summary-bar')].find(el => !el.closest('#final-checkout'));
    if (mainBar) mainBar.style.display = 'none';
    const mainDetails = [...root.querySelectorAll('#order-summary-details')].find(el => !el.closest('#final-checkout'));
    if (mainDetails) mainDetails.style.display = 'none';
    root.querySelector('.cart-items').style.display = 'none';
    root.querySelector('.cost-summary').style.display = 'none';
    const cartButtons = root.querySelector('.cart-buttons');
    if (cartButtons) cartButtons.style.display = 'none';
    root.querySelector('.or').style.display = 'none';
    root.querySelector('.express-checkout').style.display = 'none';
    const extraHeader = [...root.querySelectorAll('h2')].find(el => !el.closest('#final-checkout'));
    const extraCount = [...root.querySelectorAll('.item-count')].find(el => !el.closest('#final-checkout'));
    if (extraHeader) extraHeader.style.display = 'none';
    if (extraCount) extraCount.style.display = 'none';
    const finalPage = root.querySelector('#final-checkout');
    if (finalPage) {
        finalPage.style.display = 'block';
        const finalFormElement = finalPage.querySelector('#final-form');
        mountExpressCheckout(finalFormElement || finalPage, { context: 'checkout-form', forceEstimate: true });
        populateOrderSummary(finalPage);
        const bar = finalPage.querySelector('.order-summary-bar');
        const details = finalPage.querySelector('.order-summary-details.top-summary');
        if (bar && details) {
            bar.style.display = 'flex';
            details.style.display = 'none';
            const toggle = finalPage.querySelector('#final-toggle-order-summary');
            const arrow = bar.querySelector('.arrow');
            if (toggle && !toggle.dataset.bound) {
                toggle.addEventListener('click', e => {
                    e.preventDefault();
                    const hidden = details.style.display === 'none';
                    details.style.display = hidden ? 'block' : 'none';
                    if (arrow) arrow.textContent = hidden ? '▲' : '▼';
                });
                toggle.dataset.bound = 'true';
            }
        }
        setupFinalForm(finalPage.querySelector('#final-form'));
    }
    const footer = root.querySelector('.cart-footer');
    if (footer) footer.style.display = 'block';
    const footerLinks = root.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'flex';
}

function ensureStarStyles() {
    if (document.getElementById('star-style')) return;
    const style = document.createElement('style');
    style.id = 'star-style';
    style.textContent = `
    .shooting-star{position:fixed;font-size:30px;color:#FFD700;pointer-events:none;animation:shoot 1s ease-in-out forwards;text-shadow:0 0 6px #FFD700,0 0 12px #FFD700,0 0 20px #FFD700;z-index:9999;}
    @keyframes shoot{0%{transform:translate(0,0) scale(1);opacity:1;}50%{transform:translate(calc(var(--dx)/2),calc(var(--dy)/2 - 80px)) scale(1.8);opacity:1;}100%{transform:translate(var(--dx),var(--dy)) scale(0.5);opacity:0;}}
    `;
    document.head.appendChild(style);
}


function parseCurrencyToNumber(value) {
    if (!value) return 0;
    const cleaned = String(value).replace(/[^0-9.\-]/g, '');
    const amount = Number.parseFloat(cleaned);
    return Number.isFinite(amount) ? amount : 0;
}

function getCheckoutTotalsFromForm(form) {
    if (!form) return null;
    const checkout = form.closest('#final-checkout');
    if (!checkout) return null;
    const summary = checkout.querySelector('.order-summary-details.bottom-summary') || checkout.querySelector('.order-summary-details');
    if (!summary) return null;
    const subtotal = parseCurrencyToNumber(summary.querySelector('.subtotal')?.textContent);
    const tax = parseCurrencyToNumber(summary.querySelector('.tax')?.textContent);
    const shipping = parseCurrencyToNumber(summary.querySelector('.shipping')?.textContent);
    const total = subtotal + tax + shipping;
    return { subtotal, tax, shipping, total };
}

function getCurrentCheckoutTotalCents(container = document, options = {}) {
    const root = container && container.querySelector ? container : document;
    const preCheckoutContexts = new Set(['cart-popup', 'cart-page', 'checkout-form']);
    const isPreCheckoutContext = options.forceEstimate === true || preCheckoutContexts.has(options.context || '');
    const subtotalText = isPreCheckoutContext ? '' : root.querySelector('.total')?.textContent;
    const displayedTotal = parseCurrencyToNumber(subtotalText);
    if (displayedTotal > 0) {
        const subtotal = parseCurrencyToNumber(root.querySelector('.subtotal')?.textContent);
        const tax = parseCurrencyToNumber(root.querySelector('.tax')?.textContent);
        const shipping = parseCurrencyToNumber(root.querySelector('.shipping')?.textContent);
        const total = displayedTotal;
        return {
            subtotal,
            tax,
            shipping,
            total,
            subtotalCents: Math.round(subtotal * 100),
            taxCents: Math.round(tax * 100),
            shippingCents: Math.round(shipping * 100),
            totalCents: Math.max(1, Math.round(total * 100))
        };
    }
    return getEstimatedPreCheckoutTotals(container);
}

function getEstimatedPreCheckoutTotals(container = document) {
    const subtotal = cart.reduce((sum, item) => {
        const price = Number(item.price || item.unitPrice || 0);
        const quantity = parseInt(item.quantity, 10) || 1;
        return sum + price * quantity;
    }, 0);
    const stateInput = container.querySelector ? container.querySelector('input[name="state"]') : null;
    const state = (stateInput?.value || '').trim().toUpperCase();
    const taxRate = state && stateTaxRates[state] !== undefined ? stateTaxRates[state] : defaultTaxRate;
    const tax = subtotal * taxRate;
    const shipping = shippingCost;
    const total = subtotal + tax + shipping;
    return {
        subtotal,
        tax,
        shipping,
        total,
        subtotalCents: Math.round(subtotal * 100),
        taxCents: Math.round(tax * 100),
        shippingCents: Math.round(shipping * 100),
        totalCents: Math.max(1, Math.round(total * 100))
    };
}

function setupFinalForm(form) {
    if (!form) return;
    const payBtn = form.querySelector('#final-order-submit');
    const paymentMsg = form.querySelector('#payment-message');
    const creditFields = form.querySelector('.credit-card-fields');
    const cardWarning = form.querySelector('.card-warning');
    const emailInput = form.querySelector('input[name="contact_email"]');
    const emailWarning = form.querySelector('.email-warning');
    const creditRadio = form.querySelector('input[name="payment-method"][value="credit"]');
    const getSelectedPaymentMethod = () => form.querySelector('input[name="payment-method"]:checked')?.value;
    const requiresContactAndDeliveryDetails = () => ['credit'].includes(getSelectedPaymentMethod());
    const addressInputs = form.querySelectorAll('input[name="first_name"], input[name="last_name"], input[name="address"], input[name="city"], input[name="state"], input[name="zip"]');
    const fieldWarnings = {};
    form.querySelectorAll('.field-warning').forEach(p => { fieldWarnings[p.dataset.field] = p; });
    ensureStarStyles();
    const signupBtn = form.querySelector('.signup-btn');
    const signupPhone = form.querySelector('input[name="signup_phone"]');

    const paymentMethodInputs = form.querySelectorAll('input[name="payment-method"]');
    const walletBottomAction = form.querySelector('.wallet-bottom-action');

    paymentMethodInputs.forEach(input => {
        input.addEventListener('change', () => {
            paymentMsg.innerHTML = '';
            if (emailInput) emailInput.required = requiresContactAndDeliveryDetails();
            addressInputs.forEach(field => {
                field.required = requiresContactAndDeliveryDetails();
            });
            if (emailWarning) emailWarning.style.display = 'none';
            if (input.value !== 'credit' && cardWarning) cardWarning.style.display = 'none';
            if (input.value === 'credit') {
                ensureEmbeddedPaymentReady(form).catch(err => {
                    if (cardWarning) {
                        cardWarning.textContent = err.message || 'Unable to load secure payment form.';
                        cardWarning.style.display = 'block';
                    }
                });
            }
            payBtn.textContent = 'Pay now';
            if (walletBottomAction) {
                const err = walletBottomAction.querySelector('.wallet-express-error');
                if (err) err.textContent = '';
            }
            updatePaymentMethodUI(form);
        });
    });

    form.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', (event) => {
            if (event.target.closest('.more-logos') || event.target.closest('.more-logos-box')) {
                return;
            }
            const radio = option.querySelector('input[name="payment-method"]');
            if (!radio) return;
            if (!radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });

    addressInputs.forEach(inp => inp.addEventListener('input', () => {
        const warn = fieldWarnings[inp.name];
        if (warn) warn.style.display = 'none';
    }));
    if (emailInput) {
        emailInput.required = requiresContactAndDeliveryDetails();
        emailInput.addEventListener('input', () => {
            if (emailWarning) emailWarning.style.display = 'none';
        });
    }
    updatePaymentMethodUI(form);
    if (signupBtn && signupPhone && emailInput) {
        signupBtn.addEventListener('click', () => {
            const phone = signupPhone.value.trim();
            if (phone === '') {
                signupPhone.focus();
                return;
            }

            // store phone locally for newsletter signup and detect duplicates
            let msgText = 'Welcome to the Maybe Not newsletter!';
            try {
                const stored = JSON.parse(localStorage.getItem('newsletterPhones') || '[]');
                if (!stored.includes(phone)) {
                    stored.push(phone);
                    localStorage.setItem('newsletterPhones', JSON.stringify(stored));
                    // send phone via email only if it's new
                    fetch('https://formsubmit.co/ajax/reach@maybenot.com', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone })
                    }).catch(() => {});
                } else {
                    msgText = 'This phone number is already in the Newsletter!';
                }
            } catch (e) {}

            signupPhone.value = '';

            const welcome = document.createElement('div');
            welcome.textContent = msgText;
            welcome.style.color = 'red';
            welcome.style.textAlign = 'center';
            signupBtn.insertAdjacentElement('afterend', welcome);
            setTimeout(() => welcome.remove(), 3000);

            const star = document.createElement('div');
            star.className = 'shooting-star';
            star.textContent = '★';
            document.body.appendChild(star);
            const startRect = signupBtn.getBoundingClientRect();
            const endRect = emailInput.getBoundingClientRect();
            star.style.left = startRect.left + startRect.width / 2 + 'px';
            star.style.top = startRect.top + startRect.height / 2 + 'px';
            star.style.setProperty('--dx', endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2) + 'px');
            star.style.setProperty('--dy', endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2) + 'px');
            star.addEventListener('animationend', () => {
                star.remove();
                emailInput.focus();
            });
            emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
    const moreCards = form.querySelector('#more-cards');
    const moreCardsBox = form.querySelector('#more-cards-box');
    if (moreCards && moreCardsBox) {
        const showBox = () => { moreCardsBox.style.display = 'flex'; };
        const hideBox = () => { moreCardsBox.style.display = 'none'; };
        moreCards.addEventListener('mouseenter', showBox);
        moreCards.addEventListener('mouseleave', e => {
            if (!moreCardsBox.contains(e.relatedTarget)) hideBox();
        });
        moreCardsBox.addEventListener('mouseenter', showBox);
        moreCardsBox.addEventListener('mouseleave', e => {
            if (!moreCards.contains(e.relatedTarget)) hideBox();
        });
        moreCards.addEventListener('click', () => {
            if (moreCardsBox.style.display === 'flex') {
                hideBox();
            } else {
                showBox();
            }
        });
    }
    const shippingFields = form.querySelectorAll('input[name="address"], input[name="city"], input[name="state"], input[name="zip"]');
    shippingFields.forEach(f => f.addEventListener('input', () => updateShippingAndTax(form)));
    updateShippingAndTax(form);
    const finalCheckoutContainer = form.closest('#final-checkout');
    if (finalCheckoutContainer) {
        const applePayExpressWrapper = finalCheckoutContainer.querySelector('.apple-pay-express-wrapper');
        if (applePayExpressWrapper) applePayExpressWrapper.style.display = 'none';
        const applePayBottomAction = finalCheckoutContainer.querySelector('.apple-pay-bottom-action');
        if (applePayBottomAction) applePayBottomAction.style.display = 'none';
    }

    const remember = form.querySelector('#remember-me');
    const phone = form.querySelector('#phone-container');
    const msg = form.querySelector('#remember-message');
    const phoneInput = phone ? phone.querySelector('input[name="remember_phone"]') : null;
    const warn = form.querySelector('.remember-warning');
    if (remember) {
        remember.addEventListener('change', () => {
            const show = remember.checked;
            if (phone) phone.style.display = show ? 'flex' : 'none';
            if (msg) msg.style.display = show ? 'block' : 'none';
            if (!show && warn) warn.style.display = 'none';
        });
        if (remember.checked) {
            if (phone) phone.style.display = 'flex';
            if (msg) msg.style.display = 'block';
        }
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
            if (warn) warn.style.display = 'none';
        });
    }
    form.addEventListener('submit', async e => {
        e.preventDefault();
        let valid = true;
        let firstInvalid = null;
        const requiresDetails = requiresContactAndDeliveryDetails();
        const contactEmail = emailInput ? emailInput.value.trim() : '';
        if (requiresDetails && !contactEmail) {
            if (emailWarning) emailWarning.style.display = 'block';
            firstInvalid = firstInvalid || emailInput;
            valid = false;
        } else if (emailWarning) {
            emailWarning.style.display = 'none';
        }
        if (remember && remember.checked && phoneInput && phoneInput.value.trim() === '') {
            if (warn) warn.style.display = 'block';
            firstInvalid = firstInvalid || phoneInput;
            valid = false;
        }
        if (requiresDetails) {
            addressInputs.forEach(inp => {
                const fw = fieldWarnings[inp.name];
                if (inp.value.trim() === '') {
                    if (fw) fw.style.display = 'block';
                    firstInvalid = firstInvalid || inp;
                    valid = false;
                } else if (fw) {
                    fw.style.display = 'none';
                }
            });
        } else {
            Object.values(fieldWarnings).forEach(w => {
                if (w) w.style.display = 'none';
            });
        }
        if (creditRadio && creditRadio.checked) {
            if (cardWarning) cardWarning.style.display = 'none';
        } else if (cardWarning) {
            cardWarning.style.display = 'none';
        }
        if (!valid) {
            highlightField(firstInvalid);
            return;
        }
        if (phoneInput && phoneInput.value.trim() && !phoneInput.value.startsWith('+1')) {
            phoneInput.value = '+1' + phoneInput.value;
        }
        const selectedPayment = form.querySelector('input[name="payment-method"]:checked')?.value || 'credit';
        if (['apple', 'google', 'amazon'].includes(selectedPayment)) {
            return;
        }
        if (selectedPayment === 'credit') {
            submitEmbeddedPayment(form, paymentMsg).catch(err => {
                if (cardWarning) {
                    cardWarning.textContent = err.message || 'Unable to complete payment.';
                    cardWarning.style.display = 'block';
                }
            });
            return;
        }

        const methodMap = {
            apple: 'Apple Pay',
            google: 'Google Pay',
            amazon: 'Amazon Pay',
            paypal: 'PayPal',
            shop: 'Shop Pay',
            klarna: 'Klarna'
        };
        const success = await handlePayment(methodMap[selectedPayment] || 'Stripe', contactEmail);
        if (success) {
            const modal = form.closest('#cart-modal');
            if (modal) {
                closeCart();
            }
        }
    });
}

function populateCartPage() {
    const page = document.getElementById('cart-page');
    if (!page) return;
    const itemsContainer = page.querySelector('.cart-items');
    itemsContainer.innerHTML = '';
    if (cart.length === 0) {
        const toHide = ['h2', '.item-count', '.cart-items', '.cost-summary', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.cart-footer', '.footer-links'];
        toHide.forEach(sel => {
            const el = page.querySelector(sel) || document.querySelector(sel);
            if (el) el.style.display = 'none';
        });
        const finalPage = page.querySelector('#final-checkout');
        if (finalPage) finalPage.style.display = 'none';
        page.style.display = 'flex';
        page.style.flexDirection = 'column';
        page.style.alignItems = 'center';
        page.style.justifyContent = 'center';
        let msg = page.querySelector('.cart-empty-message');
        if (!msg) {
            msg = document.createElement('p');
            msg.className = 'empty-cart-message cart-empty-message';
            msg.textContent = 'Your cart is empty.';
            page.appendChild(msg);
        }
        msg.style.color = '#000';
        msg.style.display = 'block';
        const fullSite = document.getElementById('full-site-link');
        if (fullSite) {
            page.appendChild(fullSite);
            fullSite.style.display = 'block';
            fullSite.style.marginTop = '10px';
            if (typeof toggleFullSiteLink === 'function') {
                window.removeEventListener('scroll', toggleFullSiteLink);
            }
        }
        const footer = document.querySelector('footer');
        if (footer) footer.style.display = 'none';
        return;
    }
    let subtotal = 0;
    cart.forEach((item, index) => {
        const qty = parseInt(item.quantity) || 1;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <span>${item.name}</span>
                ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                ${item.size ? `<div>Size: ${item.size}</div>` : ''}
                <div>Qty: ${qty}</div>
            </div>
            <span>$${(parseFloat(item.price) * qty).toFixed(2)}</span>
            <button class="remove-item" data-index="${index}">&times;</button>`;
        itemsContainer.appendChild(div);
        subtotal += parseFloat(item.price) * qty;
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    const itemCountEl = page.querySelector('.item-count');
    if (itemCountEl) itemCountEl.textContent = `${getTotalQuantity()} Item(s)`;
    const total = subtotal;
    const subtotalEl = page.querySelector('.subtotal');
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    const taxEl = page.querySelector('.tax');
    if (taxEl) taxEl.textContent = 'Calculated at checkout';
    const shippingEl = page.querySelector('.shipping');
    if (shippingEl) shippingEl.textContent = 'Calculated at checkout';
    const totalEl = page.querySelector('.total');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    const orderTotal = page.querySelector('.order-summary-bar .order-total');
    if (orderTotal) orderTotal.textContent = `$${total.toFixed(2)}`;
    const checkoutForm = page.querySelector('#checkout-form');
    if (checkoutForm) checkoutForm.style.display = 'none';
    const header = page.querySelector('h2');
    if (header) header.style.display = 'block';
    if (itemCountEl) itemCountEl.style.display = 'block';
    const itemsEl = page.querySelector('.cart-items');
    if (itemsEl) itemsEl.style.display = 'block';
    const costSummary = page.querySelector('.cost-summary');
    if (costSummary) costSummary.style.display = 'block';
    const cartButtons = page.querySelector('.cart-buttons');
    if (cartButtons) cartButtons.style.display = 'flex';
    const or = page.querySelector('.or');
    if (or) or.style.display = 'block';
    const express = page.querySelector('.express-checkout');
    if (express) express.style.display = 'block';
    const footer = document.querySelector('.cart-footer');
    if (footer) footer.style.display = 'none';
    const footerLinks = document.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'none';
    const finalPage = page.querySelector('#final-checkout');
    if (finalPage) finalPage.style.display = 'none';
    const msg = page.querySelector('.cart-empty-message');
    if (msg) msg.style.display = 'none';
}

function setupCartPage() {
    const page = document.getElementById('cart-page');
    if (!page) return;
    populateCartPage();
    page.querySelector('#cart-checkout').addEventListener('click', () => {
        showFinalPage(page);
    });
    page.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('pointerdown', () => {
            page.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleExpressButtonClick(page, btn.dataset.method);
        });
    });
    const finalForm = page.querySelector('#final-form');
    if (finalForm) {
        setupFinalForm(finalForm);
    }
    const checkoutForm = page.querySelector('#checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', e => {
            e.preventDefault();
            alert('Order submitted!');
        });
    }
}

function setupCheckoutPage() {
    const finalPage = document.getElementById('final-checkout');
    if (!finalPage) return;
    if (document.getElementById('cart-page') && cart.length === 0) {
        return;
    }
    if (cart.length === 0) {
        finalPage.innerHTML = '';
        finalPage.style.display = 'flex';
        finalPage.style.flexDirection = 'column';
        finalPage.style.alignItems = 'center';
        finalPage.style.justifyContent = 'center';
        const msg = document.createElement('p');
        msg.className = 'empty-cart-message cart-empty-message';
        msg.textContent = 'Your cart is empty.';
        msg.style.color = '#000';
        finalPage.appendChild(msg);
        const fullSite = document.getElementById('full-site-link');
        if (fullSite) {
            finalPage.appendChild(fullSite);
            fullSite.style.display = 'block';
            fullSite.style.marginTop = '10px';
            if (typeof toggleFullSiteLink === 'function') {
                window.removeEventListener('scroll', toggleFullSiteLink);
            }
        }
        const footer = document.querySelector('footer');
        if (footer) footer.style.display = 'none';
        return;
    }
    populateOrderSummary(finalPage);
    const bar = finalPage.querySelector('.order-summary-bar');
    const details = finalPage.querySelector('.order-summary-details.top-summary');
    if (bar && details) {
        bar.style.display = 'flex';
        details.style.display = 'none';
        const toggle = finalPage.querySelector('#toggle-order-summary');
        const arrow = bar.querySelector('.arrow');
        if (toggle) {
            toggle.addEventListener('click', e => {
                e.preventDefault();
                const hidden = details.style.display === 'none';
                details.style.display = hidden ? 'block' : 'none';
                if (arrow) arrow.textContent = hidden ? '▲' : '▼';
            });
        }
    }
    setupFinalForm(finalPage.querySelector('#final-form'));
    finalPage.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('pointerdown', () => {
            finalPage.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleExpressButtonClick(finalPage, btn.dataset.method);
        });
    });
}

function updateCartCounter() {
    const counter = document.getElementById('cart-count');
    if (counter) {
        counter.textContent = getTotalQuantity();
    }
}

function ensureCartTriggerBound() {
    if (window.__mbntCartTriggerBound) return;
    window.__mbntCartTriggerBound = true;

    document.addEventListener('click', (event) => {
        const cartTrigger = event.target.closest(
            '#cart-icon, .cart-icon, [data-cart-trigger], .shopping-cart, .cart-link, .cart-counter'
        );

        if (!cartTrigger) return;
        if (cartTrigger.closest('#cart-modal .cart-content')) return;

        event.preventDefault();
        event.stopPropagation();
        openCart();
    });
}

function ensureCartCounter() {
    let counter = document.getElementById('cart-count')?.closest('.cart-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'cart-counter';
        counter.innerHTML = '<span class="cart-icon">🛒</span><span id="cart-count">0</span>';
    }

    const isCheckoutPage = document.getElementById('final-checkout') && !document.getElementById('cart-page');
    if (isCheckoutPage) {
        const domain = document.querySelector('.checkout-domain');
        if (domain) domain.insertAdjacentElement('afterend', counter);
    } else {
        const header = document.querySelector('.header-container');
        let headerLine = document.querySelector('.header-line');
        if (header) {
            if (!headerLine) {
                headerLine = document.createElement('div');
                headerLine.className = 'header-line';
            }
            if (headerLine.parentElement !== header) {
                header.appendChild(headerLine);
            }
            headerLine.style.marginTop = '5px';
            if (counter.parentElement !== headerLine.parentElement) {
                headerLine.insertAdjacentElement('afterend', counter);
            }
        }
    }
    counter.style.marginTop = '5px';
    ensureCartTriggerBound();

    updateCartCounter();

    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.header-container{position:sticky;top:0;z-index:1000;} .logo-container{height:10vh;} .time{margin-top:-5px;} .cart-counter{font-size:0.7rem;text-align:center;font-weight:600;cursor:pointer;display:inline-block;outline:2px solid transparent;padding:2px;} .cart-counter:hover,.cart-counter:focus,.cart-counter:active{outline-color:red;} .header-line{border-top:1px solid #000;width:100%;} .product-item{position:relative;aspect-ratio:1/1;} .product-grid .product-item:hover,.product-grid .product-item:focus-within{z-index:10;} .product-item img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;object-position:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5));} .product-info{top:0;left:0;width:100%;height:100%;} .payment-icons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;justify-content:center;justify-items:center;margin:10px auto;max-width:260px;width:100%;} .pay-btn{outline:2px solid transparent;} .pay-btn:hover,.pay-btn:focus,.pay-btn:active,.pay-btn.selected{outline-color:red;} .pay-btn.paypal{background:#ffc439;width:80px;height:40px;padding:0;margin-top:10px;align-self:center;} .pay-btn.paypal img{width:100%;height:100%;object-fit:contain;} .payment-icons img[alt="Apple Pay"]{width:120px;} .payment-icons img.klarna-logo{width:140px;} .payment-option{display:flex;align-items:center;border:1px solid #ccc;padding:10px;margin:5px 0;cursor:pointer;width:100%;box-sizing:border-box;gap:10px;flex-wrap:wrap;} .payment-option input{margin:0;flex-shrink:0;width:auto;padding:0;} .payment-option label{display:flex;align-items:center;justify-content:space-between;flex:1;cursor:pointer;gap:10px;flex-wrap:wrap;width:100%;} .payment-label{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .payment-label .subtext{font-size:0.8em;} .payment-option.shop-pay .payment-label{white-space:normal;display:flex;flex-direction:column;align-items:flex-start;overflow:visible;text-overflow:unset;} .payment-option.shop-pay .payment-label .subtext{white-space:normal;margin-top:2px;} .payment-logos{margin-left:10px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:100%;position:relative;} .payment-logos img{height:20px;max-width:100%;} .payment-logos img[alt="Apple Pay"]{height:30px;} .payment-logos img.klarna-logo{height:40px;} .payment-logos img[alt="Visa"],.payment-logos img[alt="Mastercard"],.payment-logos img[alt="American Express"]{height:20px;width:32px;object-fit:contain;} .more-logos{margin-left:5px;cursor:pointer;color:#000;font-weight:600;} .more-logos-box{display:none;position:absolute;bottom:100%;left:0;right:auto;transform:translateX(0);background:#fff;padding:5px;z-index:10;border:1px solid #ccc;box-shadow:0 2px 8px rgba(0,0,0,0.15);} .more-logos-box img{width:32px;height:20px;margin:0 2px;object-fit:contain;} .summary-label{background:#000;color:#fff;font-size:1em;display:inline-block;padding:10px;margin:0;margin-left:0;} .redirect-icon{text-align:center;font-size:2rem;} .paypal-inline{height:1em;vertical-align:middle;filter:brightness(0) invert(1);} .stripe-payment-element{width:100%;min-height:52px;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;background:#fff;} .stripe-payment-status{margin-top:8px;font-size:0.8rem;text-align:left;} .empty-cart-message{text-align:center;color:#000;} a,button{transition:all 0.3s ease;} button:hover,button:focus,button:active{border:2px solid red;color:red;background:#fff;} .color-option{border:1px solid #000;} .color-option.selected,.color-option:hover,.color-option:focus,.color-option:active{border:2px solid red !important;} @media (max-width:480px){.payment-option{flex-wrap:wrap;}.payment-option label{flex-direction:row;align-items:center;flex-wrap:wrap;width:100%;}.payment-logos{margin-left:10px;justify-content:flex-start;position:relative;}.payment-option.shop-pay .payment-label .subtext{font-size:0.6em;}}';
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    trackAnalyticsEvent('page_visit', { page });
    trackAnalyticsEvent('page_event', { page, action: 'view' });
    if (document.querySelector('.product-item')) {
        const productName = document.querySelector('.product-item')?.dataset?.product || '';
        trackAnalyticsEvent('product_page_visit', { product: productName });
        trackAnalyticsEvent('product_event', { product: productName, action: 'view' });
    }
    preloadStripe().catch(() => {});
    initCart();
    ensureCartTriggerBound();
    prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'cart.html' && currentPage !== 'checkout.html') {
        ensureCartCounter();
    }
    document.querySelectorAll('button:not(.pay-btn)').forEach(btn => {
        btn.style.background = '#000';
        btn.style.color = '#fff';
    });
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const item = opt.closest('.product-item');
            const img = item.querySelector('img');
            img.src = opt.dataset.image;
            item.dataset.selectedColor = opt.dataset.color;
        });
    });
    setupCartPage();
    setupCheckoutPage();
    const cartPageExpress = document.querySelector('[data-express-context="cart-page"]');
    if (cartPageExpress) {
        const cartExpressEl = document.querySelector('[data-express-context="cart-page"] .apple-pay-express-element');
        if (cartExpressEl) {
            cartExpressEl.innerHTML = '<div style="font-size:12px;color:#666;padding:6px 0;">Loading express checkout...</div>';
        }
        mountExpressCheckout(document, {
            context: 'cart-page',
            forceEstimate: true
        }).catch((error) => {
            const cartExpressError = document.querySelector('[data-express-context="cart-page"] .apple-pay-express-error');
            if (cartExpressError) cartExpressError.textContent = error.message || 'Unable to load express checkout.';
            console.error('Cart page Express Checkout mount failed:', error);
        });
        setTimeout(() => {
            preloadStripe().catch(console.warn);
            prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
        }, 0);
        return;
    }

    setTimeout(() => {
        preloadStripe().catch(console.warn);
        prewarmExpressCheckout(document, { context: 'cart-page', forceEstimate: true }).catch(() => {});
        mountExpressCheckout(document);
    }, 0);
});
