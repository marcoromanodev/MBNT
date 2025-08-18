let cart = [];

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

const paymentHandlers = {
    'Shop Pay': () => alert('Shop Pay integration pending.'),
    'Apple Pay': () => alert('Apple Pay integration pending.'),
    'PayPal': () => alert('PayPal integration pending.'),
    'Google Pay': () => alert('Google Pay integration pending.'),
    'Klarna': () => alert('Klarna integration pending.'),
    'Venmo': () => alert('Venmo integration pending.'),
    'Stripe': () => alert('Stripe integration pending.')
};

function handlePayment(method) {
    const handler = paymentHandlers[method];
    if (handler) {
        handler();
    } else {
        alert(`${method} payment not implemented.`);
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
        image: item.querySelector('img') ? item.querySelector('img').src : '',
        style: item.dataset.style || '',
        size: item.dataset.size || '',
        timestamp: Date.now()
    };
    cart.push(product);
    localStorage.setItem('cart', JSON.stringify(cart));
    // TODO: sync with store server for inventory management
    updateCartCounter();
    animateStar(button);
}

function checkout(button) {
    // If triggered from a product page, add the item to the cart first
    if (button && button.closest('.product-item')) {
        addToCart(button);
    }
    openCart(true);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
    populateCartModal();
    populateCartPage();
    document.querySelectorAll('#final-checkout').forEach(section => {
        populateOrderSummary(section);
    });
}

function openCart(showForm = false) {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = createCartModal();
    }
    populateCartModal();
    modal.style.display = 'flex';
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
                <iframe id="cart-logo" src="https://www.vectary.com/viewer/v1/?model=8b9281ad-097b-4408-88e2-ef824efa63eb&env=studio3&turntable=1" frameborder="0"></iframe>
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
                <div class="payment-icons">
                    <button class="pay-btn" data-method="Shop Pay"><img src="shoppay.png" alt="Shop Pay"></button>
                    <button class="pay-btn" data-method="Apple Pay"><img src="applepay.png" alt="Apple Pay"></button>
                    <button class="pay-btn paypal" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                    <button class="pay-btn" data-method="Google Pay"><img src="googlepay.png" alt="Google Pay"></button>
                    <button class="pay-btn" data-method="Klarna"><img src="klarna.png" alt="Klarna" class="klarna-logo"></button>
                    <button class="pay-btn" data-method="Venmo"><img src="venmo.png" alt="Venmo"></button>
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
                <div class="payment-icons">
                    <button class="pay-btn" data-method="Shop Pay"><img src="shoppay.png" alt="Shop Pay"></button>
                    <button class="pay-btn" data-method="Apple Pay"><img src="applepay.png" alt="Apple Pay"></button>
                    <button class="pay-btn paypal" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                    <button class="pay-btn" data-method="Google Pay"><img src="googlepay.png" alt="Google Pay"></button>
                    <button class="pay-btn" data-method="Klarna"><img src="klarna.png" alt="Klarna" class="klarna-logo"></button>
                    <button class="pay-btn" data-method="Venmo"><img src="venmo.png" alt="Venmo"></button>
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
                    <div class="payment-icons">
                        <button class="pay-btn" data-method="Shop Pay"><img src="shoppay.png" alt="Shop Pay"></button>
                        <button class="pay-btn" data-method="Apple Pay"><img src="applepay.png" alt="Apple Pay"></button>
                        <button class="pay-btn paypal" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                        <button class="pay-btn" data-method="Google Pay"><img src="googlepay.png" alt="Google Pay"></button>
                        <button class="pay-btn" data-method="Klarna"><img src="klarna.png" alt="Klarna" class="klarna-logo"></button>
                        <button class="pay-btn" data-method="Venmo"><img src="venmo.png" alt="Venmo"></button>
                    </div>
                    <div class="or">OR</div>
                    <div class="contact-header">
                        <h3>Contact</h3>
                        <button type="button" id="login-btn" onclick="window.location.href='/account/login';">Log in</button>
                    </div>
                    <input type="email" name="contact_email" placeholder="Enter an email" required>
                    <p class="email-warning empty-cart-message" style="display:none;">Please provide your contact email for this order.</p>
                    <h3>Delivery</h3>
                    <p>This will also be used as your billing address for this order.</p>
                    <input type="text" name="first_name" placeholder="Enter a first name" required>
                    <p class="field-warning empty-cart-message" data-field="first_name" style="display:none;">Please enter a first name.</p>
                    <input type="text" name="last_name" placeholder="Enter a last name" required>
                    <p class="field-warning empty-cart-message" data-field="last_name" style="display:none;">Please enter a last name.</p>
                    <input type="text" name="address" placeholder="Enter an address" required>
                    <p class="field-warning empty-cart-message" data-field="address" style="display:none;">Please enter an address.</p>
                    <input type="text" name="city" placeholder="Enter a city" required>
                    <p class="field-warning empty-cart-message" data-field="city" style="display:none;">Please enter a city.</p>
                    <input type="text" name="state" placeholder="Enter a state" required>
                    <p class="field-warning empty-cart-message" data-field="state" style="display:none;">Please enter a state.</p>
                    <input type="text" name="zip" placeholder="Enter a ZIP / postal code" required>
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
                        <input type="text" name="card_number" placeholder="Enter a card number">
                        <p class="field-warning empty-cart-message" data-field="card_number" style="display:none;">Please enter a card number.</p>
                        <input type="text" name="exp_date" placeholder="Enter a valid expiration date">
                        <p class="field-warning empty-cart-message" data-field="exp_date" style="display:none;">Please enter an expiration date.</p>
                        <input type="text" name="cvv" placeholder="Enter the CVV or security code on your card">
                        <p class="field-warning empty-cart-message" data-field="cvv" style="display:none;">Please enter the CVV or security code.</p>
                        <input type="text" name="card_name" placeholder="Enter your name exactly as it’s written on your card">
                        <p class="field-warning empty-cart-message" data-field="card_name" style="display:none;">Please enter the name on your card.</p>
                    </div>
                    <p class="card-warning empty-cart-message" style="display:none;">Please complete the card details.</p>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-apple" value="apple">
                        <label for="cart-pay-apple">
                            <span class="payment-label">Apple Pay</span>
                            <span class="payment-logos"><img src="applepay.png" alt="Apple Pay"></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-paypal" value="paypal">
                        <label for="cart-pay-paypal">
                            <span class="payment-label">PayPal</span>
                            <span class="payment-logos"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></span>
                        </label>
                    </div>
                    <div class="payment-option shop-pay">
                        <input type="radio" name="payment-method" id="cart-pay-shop" value="shop">
                        <label for="cart-pay-shop">
                            <span class="payment-label">
                                <span>Shop Pay</span>
                                <span class="subtext">Pay in full or in installments</span>
                            </span>
                            <span class="payment-logos"><img src="shoppay.png" alt="Shop Pay"></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-klarna" value="klarna">
                        <label for="cart-pay-klarna">
                            <span class="payment-label">Klarna - <span class="subtext">Flexible payments</span></span>
                            <span class="payment-logos"><img src="klarna.png" alt="Klarna" class="klarna-logo"></span>
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
                            <div class="shop-logo"><img src="shoppayhalf.png" alt="Shop Pay"></div>
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
        btn.addEventListener('click', () => {
            handlePayment(btn.dataset.method);
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
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <span>${item.name}</span>
                ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                ${item.size ? `<div>Size: ${item.size}</div>` : ''}
            </div>
            <span>$${parseFloat(item.price).toFixed(2)}</span>
            <button class="remove-item" data-index="${index}">&times;</button>`;
        itemsContainer.appendChild(div);
        subtotal += parseFloat(item.price);
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    modal.querySelector('.item-count').textContent = `${cart.length} Item(s)`;
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
            const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
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
    root.querySelector('#checkout-form').style.display = 'block';
    const footer = root.querySelector('.cart-footer');
    if (footer) footer.style.display = 'block';
    const footerLinks = root.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'flex';
}

function populateOrderSummary(section, state = '', addressFilled = false) {
    if (!section) return;
    const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    const rate = state && stateTaxRates[state] !== undefined ? stateTaxRates[state] : defaultTaxRate;
    const tax = subtotal * rate;
    const shipping = addressFilled ? shippingCost : 0;
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
            const div = document.createElement('div');
            div.className = 'cart-item no-remove';
            div.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <span>${item.name}</span>
                    ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                    ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                    ${item.size ? `<div>Size: ${item.size}</div>` : ''}
                </div>
                <span>$${parseFloat(item.price).toFixed(2)}</span>`;
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

function setupFinalForm(form) {
    if (!form) return;
    const payBtn = form.querySelector('#final-order-submit');
    const paymentMsg = form.querySelector('#payment-message');
    const creditFields = form.querySelector('.credit-card-fields');
    const cardInputs = creditFields ? creditFields.querySelectorAll('input') : [];
    const cardWarning = form.querySelector('.card-warning');
    const emailInput = form.querySelector('input[name="contact_email"]');
    const emailWarning = form.querySelector('.email-warning');
    const creditRadio = form.querySelector('input[name="payment-method"][value="credit"]');
    const addressInputs = form.querySelectorAll('input[name="first_name"], input[name="last_name"], input[name="address"], input[name="city"], input[name="state"], input[name="zip"]');
    const fieldWarnings = {};
    form.querySelectorAll('.field-warning').forEach(p => { fieldWarnings[p.dataset.field] = p; });
    ensureStarStyles();
    const signupBtn = form.querySelector('.signup-btn');
    const signupPhone = form.querySelector('input[name="signup_phone"]');

    form.querySelectorAll('input[name="payment-method"]').forEach(input => {
        input.addEventListener('change', () => {
            paymentMsg.innerHTML = '';
            if (creditFields) {
                creditFields.style.display = input.value === 'credit' ? 'block' : 'none';
                if (input.value !== 'credit' && cardWarning) cardWarning.style.display = 'none';
            }
            switch (input.value) {
                case 'apple':
                    payBtn.textContent = 'Pay with Apple Pay';
                    break;
                case 'paypal':
                    payBtn.innerHTML = 'Pay now with <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" class="paypal-inline">';
                    paymentMsg.innerHTML = '<div class="redirect-icon">↗</div>After clicking "Pay with PayPal", you will be redirected to PayPal to complete your purchase securely.';
                    break;
                case 'shop':
                    payBtn.textContent = 'Pay now';
                    break;
                case 'klarna':
                    payBtn.textContent = 'Pay now';
                    paymentMsg.innerHTML = '<div class="redirect-icon">↗</div>After clicking "Pay now", you will be redirected to Klarna - Flexible payments to complete your purchase securely.';
                    break;
                default:
                    payBtn.textContent = 'Pay now';
            }
        });
    });

    cardInputs.forEach(inp => inp.addEventListener('input', () => {
        if (cardWarning) cardWarning.style.display = 'none';
        const warn = fieldWarnings[inp.name];
        if (warn) warn.style.display = 'none';
    }));
    addressInputs.forEach(inp => inp.addEventListener('input', () => {
        const warn = fieldWarnings[inp.name];
        if (warn) warn.style.display = 'none';
    }));
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            if (emailWarning) emailWarning.style.display = 'none';
        });
    }
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
    form.addEventListener('submit', e => {
        e.preventDefault();
        let valid = true;
        let firstInvalid = null;
        if (remember && remember.checked && phoneInput && phoneInput.value.trim() === '') {
            if (warn) warn.style.display = 'block';
            firstInvalid = firstInvalid || phoneInput;
            valid = false;
        }
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
        if (creditRadio && creditRadio.checked) {
            let cardValid = true;
            cardInputs.forEach(inp => {
                const fw = fieldWarnings[inp.name];
                if (inp.value.trim() === '') {
                    if (fw) fw.style.display = 'block';
                    firstInvalid = firstInvalid || inp;
                    cardValid = false;
                    valid = false;
                } else if (fw) {
                    fw.style.display = 'none';
                }
            });
            if (!cardValid && cardWarning) {
                cardWarning.style.display = 'block';
            } else if (cardWarning) {
                cardWarning.style.display = 'none';
            }
        } else if (cardWarning) {
            cardWarning.style.display = 'none';
        }
        if (emailInput && emailInput.value.trim() === '') {
            if (emailWarning) emailWarning.style.display = 'block';
            firstInvalid = firstInvalid || emailInput;
            valid = false;
        }
        if (!valid) {
            highlightField(firstInvalid);
            return;
        }
        if (phoneInput && phoneInput.value.trim() && !phoneInput.value.startsWith('+1')) {
            phoneInput.value = '+1' + phoneInput.value;
        }
        handlePayment('Stripe');
        const modal = form.closest('#cart-modal');
        if (modal) {
            closeCart();
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
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <span>${item.name}</span>
                ${item.style ? `<div>Style: ${item.style}</div>` : ''}
                ${item.color ? `<div>Color: ${item.color}</div>` : ''}
                ${item.size ? `<div>Size: ${item.size}</div>` : ''}
            </div>
            <span>$${parseFloat(item.price).toFixed(2)}</span>
            <button class="remove-item" data-index="${index}">&times;</button>`;
        itemsContainer.appendChild(div);
        subtotal += parseFloat(item.price);
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    const itemCountEl = page.querySelector('.item-count');
    if (itemCountEl) itemCountEl.textContent = `${cart.length} Item(s)`;
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
        window.location.href = 'checkout.html';
    });
    page.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('pointerdown', () => {
            page.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        btn.addEventListener('click', () => {
            handlePayment(btn.dataset.method);
        });
    });
    const finalForm = page.querySelector('#final-form');
    if (finalForm) {
        finalForm.addEventListener('submit', e => {
            e.preventDefault();
            handlePayment('Stripe');
        });
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
        btn.addEventListener('click', () => {
            handlePayment(btn.dataset.method);
        });
    });
}

function updateCartCounter() {
    const counter = document.getElementById('cart-count');
    if (counter) {
        counter.textContent = cart.length;
    }
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
    counter.addEventListener('click', () => openCart());

    updateCartCounter();

    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.cart-counter{font-size:0.7rem;text-align:center;font-weight:600;cursor:pointer;display:inline-block;outline:2px solid transparent;padding:2px;} .cart-counter:hover,.cart-counter:focus,.cart-counter:active{outline-color:red;} .header-line{border-top:1px solid #000;width:100%;} .product-item{position:relative;aspect-ratio:1/1;padding:10px;box-sizing:border-box;} .product-grid .product-item:hover,.product-grid .product-item:focus-within{border:2px solid red;z-index:10;} .product-item img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;object-position:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.1));} .product-info{top:0;left:0;width:100%;height:100%;} .payment-icons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;justify-content:center;justify-items:center;margin:10px auto;max-width:260px;width:100%;} .pay-btn{outline:2px solid transparent;} .pay-btn:hover,.pay-btn:focus,.pay-btn:active,.pay-btn.selected{outline-color:red;} .pay-btn.paypal{background:#ffc439;width:80px;height:40px;padding:0;margin-top:10px;align-self:center;} .pay-btn.paypal img{width:100%;height:100%;object-fit:contain;} .payment-icons img[alt="Apple Pay"]{width:120px;} .payment-icons img.klarna-logo{width:140px;} .payment-option{display:flex;align-items:center;border:1px solid #ccc;padding:10px;margin:5px 0;cursor:pointer;width:100%;box-sizing:border-box;gap:10px;flex-wrap:wrap;} .payment-option input{margin:0;flex-shrink:0;width:auto;padding:0;} .payment-option label{display:flex;align-items:center;justify-content:space-between;flex:1;cursor:pointer;gap:10px;flex-wrap:wrap;width:100%;} .payment-label{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .payment-label .subtext{font-size:0.8em;} .payment-option.shop-pay .payment-label{white-space:normal;display:flex;flex-direction:column;align-items:flex-start;overflow:visible;text-overflow:unset;} .payment-option.shop-pay .payment-label .subtext{white-space:normal;margin-top:2px;} .payment-logos{margin-left:10px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:100%;position:relative;} .payment-logos img{height:20px;max-width:100%;} .payment-logos img[alt="Apple Pay"]{height:30px;} .payment-logos img.klarna-logo{height:40px;} .payment-logos img[alt="Visa"],.payment-logos img[alt="Mastercard"],.payment-logos img[alt="American Express"]{height:20px;width:32px;object-fit:contain;} .more-logos{margin-left:5px;cursor:pointer;color:#000;font-weight:600;} .more-logos-box{display:none;position:absolute;bottom:100%;left:0;right:auto;transform:translateX(0);background:#fff;padding:5px;z-index:10;border:1px solid #ccc;box-shadow:0 2px 8px rgba(0,0,0,0.15);} .more-logos-box img{width:32px;height:20px;margin:0 2px;object-fit:contain;} .summary-label{background:#000;color:#fff;font-size:1em;display:inline-block;padding:10px;margin:0;margin-left:0;} .redirect-icon{text-align:center;font-size:2rem;} .paypal-inline{height:1em;vertical-align:middle;filter:brightness(0) invert(1);} .empty-cart-message{text-align:center;color:#000;} a,button{transition:all 0.3s ease;} button:hover,button:focus,button:active{border:2px solid red;color:red;background:#fff;} .color-option{border:1px solid #000;} .color-option.selected,.color-option:hover,.color-option:focus,.color-option:active{border:2px solid red !important;} @media (max-width:480px){.payment-option{flex-wrap:wrap;}.payment-option label{flex-direction:row;align-items:center;flex-wrap:wrap;width:100%;}.payment-logos{margin-left:10px;justify-content:flex-start;position:relative;}.payment-option.shop-pay .payment-label .subtext{font-size:0.6em;}}';
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCart();
    const page = window.location.pathname.split('/').pop();
    if (page !== 'cart.html' && page !== 'checkout.html') {
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
});
