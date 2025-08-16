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
        let msg = 'Please select ';
        if (missing.length === 2) {
            msg += 'a size and color.';
        } else {
            msg += `a ${missing[0]}.`;
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
    if (showForm && cart.length > 0) {
        showCheckoutForm(modal);
    }
}

function showSelectionError(message) {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = createCartModal();
    }
    const content = modal.querySelector('.cart-content');
    const hideSelectors = ['.logo-container', '#cart-current-time', 'h2', '.item-count', '.order-summary-bar', '#order-summary-details', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.footer-links', '.cart-footer'];
    hideSelectors.forEach(sel => {
        const el = content.querySelector(sel);
        if (el) el.style.display = 'none';
    });
    let msg = content.querySelector('.empty-cart-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'empty-cart-message';
        content.appendChild(msg);
    }
    msg.textContent = message;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
        populateCartModal();
    }, 2000);
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
                <input type="email" name="email" placeholder="Email" required>
                <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                <button type="submit">Submit</button>
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
                            <div><strong>Total</strong><strong class="total">$0.00</strong></div>
                        </div>
                    </div>
                    <h3>Sign up and know first!</h3>
                    <input type="email" name="signup_email" placeholder="Enter an email" required>
                    <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                    <button type="submit">Submit</button>
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
                        <button type="button" id="login-btn">Log in</button>
                    </div>
                    <input type="email" name="contact_email" placeholder="Enter an email" required>
                    <h3>Delivery</h3>
                    <p>This will also be used as your billing address for this order.</p>
                    <input type="text" name="first_name" placeholder="Enter a first name" required>
                    <input type="text" name="last_name" placeholder="Enter a last name" required>
                    <input type="text" name="address" placeholder="Enter an address" required>
                    <input type="text" name="city" placeholder="Enter a city" required>
                    <input type="text" name="state" placeholder="Enter a state" required>
                    <input type="text" name="zip" placeholder="Enter a ZIP / postal code" required>
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
                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo_%282018%29.svg" alt="American Express">
                                <span class="more-logos" id="more-cards">+5
                                    <div class="more-logos-box" id="more-cards-box">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/50/Discover_Card_logo.svg" alt="Discover">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/80/Elo_logo.svg" alt="Elo">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/JCB_logo.svg" alt="JCB">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/1/1b/UnionPay_logo.svg" alt="UnionPay">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b3/Stripe_Logo%2C_revised_2016.svg" alt="Stripe">
                                    </div>
                                </span>
                            </span>
                        </label>
                    </div>
                    <div class="credit-card-fields" style="display:none;">
                        <input type="text" name="card_number" placeholder="Enter a card number">
                        <input type="text" name="exp_date" placeholder="Enter a valid expiration date">
                        <input type="text" name="cvv" placeholder="Enter the CVV or security code on your card">
                        <input type="text" name="card_name" placeholder="Enter your name exactly as it’s written on your card">
                    </div>
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
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-shop" value="shop">
                        <label for="cart-pay-shop">
                            <span class="payment-label">Shop Pay<span class="subtext">Pay in full or in installments</span></span>
                            <span class="payment-logos"><img src="shoppay.png" alt="Shop Pay"></span>
                        </label>
                    </div>
                    <div class="payment-option">
                        <input type="radio" name="payment-method" id="cart-pay-klarna" value="klarna">
                        <label for="cart-pay-klarna">
                            <span class="payment-label">Klarna - Flexible payments</span>
                            <span class="payment-logos"><img src="klarna.png" alt="Klarna" class="klarna-logo"></span>
                        </label>
                    </div>
                    <div id="payment-message"></div>
                    <div class="remember-section">
                        <strong class="remember-heading">Remember me</strong>
                        <div class="remember-check">
                            <input type="checkbox" name="remember" id="remember-me">
                        </div>
                        <label for="remember-me" class="remember-text">Save my information for a faster checkout with a Shop account</label>
                        <div id="phone-container" class="phone-input" style="display:none;">
                            <span class="phone-icon">📱</span>
                            <span class="phone-prefix">+1</span>
                            <input type="tel" name="remember_phone" placeholder="Mobile phone number">
                        </div>
                        <p class="phone-error" style="display:none;color:red;">The specified phone number does not match the expected pattern.</p>
                        <div class="secure-row">
                            <span class="secure-text">Secure and encrypted</span>
                            <div class="shop-logo"><img src="shoppay.png" alt="Shop Pay"></div>
                        </div>
                    </div>
                    <div class="order-summary-details bottom-summary">
                        <div class="cart-items"></div>
                        <div class="cost-summary">
                            <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                            <div><span>Tax</span><span class="tax">$0.00</span></div>
                            <div><span>Shipping</span><span class="shipping">$15.00</span></div>
                            <div><strong>Total</strong><strong class="total">$0.00</strong></div>
                        </div>
                    </div>
                    <button id="final-order-submit" type="submit">Pay now</button>
                    <p id="remember-message" style="display:none;">Your info will be saved to a Shop account. By continuing, you agree to Shop’s Terms of Service and acknowledge the Privacy Policy.</p>
                </form>
            </div>
            <footer>
                <div class="footer-links">
                    <div class="footer-line extra-padding">
                        <a href="shop.html">shop</a>
                        <a href="all.html">view all</a>
                        <a href="soon.html">preview</a>
                        <a href="soon.html">lookbook</a>
                        <a href="soon.html">news</a>
                    </div>
                </div>
                <div class="cart-footer">
                    <a href="#">refund policy</a> |
                    <a href="#">shipping</a> |
                    <a href="#">privacy policy</a> |
                    <a href="#">terms of service</a> |
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
            #cart-modal .cart-content {background:#fff;padding:20px;max-width:400px;width:90%;text-align:center;position:relative;font-family:sans-serif;max-height:90vh;overflow-y:auto;}
            #cart-modal .close-btn {position:absolute;top:10px;left:10px;background:#000;color:#fff;border:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;padding:0;font-size:14px;font-family:Arial,sans-serif;line-height:0;cursor:pointer;text-indent:-2px;}
            #cart-modal .cart-buttons {display:flex;flex-direction:column;align-items:center;}
            #cart-modal button:not(.pay-btn):not(.summary-toggle){background:#000;color:#fff;border:none;padding:10px;margin:5px auto;cursor:pointer;display:block;}
            #cart-modal .pay-btn{background:transparent;border:none;margin:0;padding:0;display:flex;justify-content:center;align-items:center;}
            #cart-modal .pay-btn.paypal{background:#ffc439;padding:5px;}
            #cart-modal .pay-btn.paypal img{width:60px;}
            #cart-modal .payment-icons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0;justify-items:center;}
            #cart-modal .payment-icons img{width:80px;height:auto;}
            #cart-modal .payment-icons img.klarna-logo{width:100px;}
            #cart-modal .cost-summary div{display:flex;justify-content:space-between;margin:5px 0;}
            #cart-modal .cart-item{display:flex;align-items:center;justify-content:space-between;margin:5px 0;position:relative;padding-top:10px;}
            #cart-modal .cart-item.no-remove{padding-top:0;}
            #cart-modal .cart-item img{width:50px;height:50px;object-fit:contain;margin-right:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.1));}
            #cart-modal .cart-item .cart-item-info{text-align:left;flex:1;}
            #cart-modal .cart-item .remove-item{background:#000;color:#fff;border:none;position:absolute;top:0;right:0;cursor:pointer;font-size:14px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;padding:0;font-family:Arial,sans-serif;line-height:0;text-indent:-2px;}
            #cart-modal .or {margin:10px 0;}
            #cart-modal footer a {color:#000;margin:0 5px;font-size:0.8em;text-decoration:none;}
            #cart-modal button:not(.pay-btn):not(.summary-toggle):hover,#cart-modal button:not(.pay-btn):not(.summary-toggle):focus,#cart-modal button:not(.pay-btn):not(.summary-toggle):active,#cart-modal footer a:hover,#cart-modal footer a:focus,#cart-modal footer a:active{border:2px solid red;color:red;background:#fff;}
            #checkout-form input {display:block;width:100%;margin:5px auto;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}
            .consent-text {font-size:0.7rem;margin-top:10px;}
            #final-checkout{text-align:center;}
            #final-checkout input {display:block;width:100%;margin:5px auto;padding:10px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;}
            .contact-header{position:relative;width:100%;}
            .contact-header h3{text-align:center;margin:0;}
            #login-btn{background:none;border:none;color:#000;cursor:pointer;text-decoration:underline;font-size:0.9em;padding:0;position:absolute;right:0;top:50%;transform:translateY(-50%);}
            #login-btn:hover{color:red;}
            .remember-section{text-align:center;margin-top:10px;}
            .remember-heading{display:block;font-weight:700;text-align:center;}
            .remember-check{width:100%;text-align:center;margin-top:5px;}
            .remember-check input{width:20px;height:20px;display:inline-block;}
            .remember-text{display:block;margin-top:5px;text-align:center;}
            .phone-input{position:relative;margin-top:5px;}
            .phone-input .phone-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);}
            .phone-input .phone-prefix{position:absolute;left:35px;top:50%;transform:translateY(-50%);}
            .phone-input input{padding-left:60px;}
            .secure-row{display:flex;justify-content:space-between;align-items:center;margin-top:5px;width:100%;}
            .secure-text{color:#888;font-size:0.8em;}
            .shop-logo{overflow:hidden;width:50px;height:20px;}
            .shop-logo img{width:80px;height:100%;object-fit:cover;object-position:right;filter:grayscale(100%);transform:translateX(-5px);}
            .checkout-domain{margin-top:5px;}
            .credit-card-fields input{width:100%;}
            .payment-option{display:flex;align-items:center;border:1px solid #ccc;padding:10px;margin:5px 0;cursor:pointer;width:100%;box-sizing:border-box;overflow:hidden;}
            .payment-option input{margin:0 10px 0 0;}
            .payment-option label{display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;gap:10px;}
            .payment-label{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .payment-option.shop-pay .payment-label{white-space:normal;display:flex;flex-direction:column;} .payment-option.shop-pay .payment-label .subtext{font-size:0.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
            .payment-logos{margin-left:10px;display:flex;align-items:center;gap:5px;flex-shrink:0;}
            .payment-logos img{height:20px;}
            .payment-logos img.klarna-logo{height:30px;}
            .more-logos{position:relative;margin-left:5px;cursor:pointer;color:#000;font-weight:600;}
            .more-logos-box{display:none;position:absolute;bottom:100%;right:0;background:#000;padding:5px;z-index:10;}
            .more-logos-box img{height:20px;margin:0 2px;filter:invert(1);}
            .shipping-method{display:flex;justify-content:space-between;border:1px solid #ccc;padding:10px;margin:5px 0;}
            #cart-modal .logo-container{width:80px;height:80px;margin:0 auto;}
            #cart-modal .logo-container iframe{width:100%;height:100%;border:none;}
            #cart-modal .cart-time{text-align:center;font-size:0.7rem;font-weight:600;margin-top:5px;}
            #cart-modal .order-summary-bar{display:flex;align-items:center;margin:10px 0;width:100%;justify-content:space-between;}
            #cart-modal .summary-toggle{background:#000;color:#fff;border:none;font-size:1em;display:inline-flex;align-items:center;justify-content:flex-start;cursor:pointer;padding:10px;margin:0;margin-left:0;}
            #cart-modal .summary-toggle .arrow{margin-left:5px;}
            #cart-modal .order-total{font-weight:bold;margin:0;margin-left:auto;}
            #cart-modal footer{background:#fff;padding:10px 0;position:static;}
            #cart-modal .footer-links{display:flex;justify-content:center;flex-wrap:wrap;gap:15px;background:#fff;}
            #cart-modal .footer-line{display:flex;justify-content:center;flex-wrap:wrap;gap:15px;padding-bottom:10px;}
            #cart-modal .footer-line.extra-padding{padding-bottom:10px;}
            #cart-modal .footer-links a{color:#000;text-decoration:none;font-size:0.7rem;transition:all 0.3s ease;background:#fff;}
            #cart-modal .footer-links a:hover,#cart-modal .footer-links a:focus,#cart-modal .footer-links a:active{border:2px solid red;color:red;background:#fff;}
            
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
        const hideSelectors = ['.logo-container', '#cart-current-time', 'h2', '.item-count', '.order-summary-bar', '#order-summary-details', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.footer-links', '.cart-footer'];
        hideSelectors.forEach(sel => { const el = modal.querySelector(sel); if (el) el.style.display = 'none'; });
        const content = modal.querySelector('.cart-content');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'center';
        const finalPage = modal.querySelector('#final-checkout');
        if (finalPage) finalPage.style.display = 'none';
        let msg = modal.querySelector('.empty-cart-message');
        if (!msg) {
            msg = document.createElement('p');
            msg.className = 'empty-cart-message';
            msg.textContent = 'Your cart is currently empty.';
            content.appendChild(msg);
        }
        msg.style.display = 'block';
        return;
    }
    let total = 0;
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
        total += parseFloat(item.price);
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    modal.querySelector('.item-count').textContent = `${cart.length} Item(s)`;
    modal.querySelector('.subtotal').textContent = `$${total.toFixed(2)}`;
    modal.querySelector('.total').textContent = `$${total.toFixed(2)}`;
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
    const footerLinks = modal.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'flex';
    const footer = modal.querySelector('.cart-footer');
    if (footer) footer.style.display = 'block';
    const msg = modal.querySelector('.empty-cart-message');
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
}

function populateOrderSummary(section, state = '') {
    if (!section) return;
    const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    const rate = stateTaxRates[state] || 0;
    const tax = subtotal * rate;
    const total = subtotal + tax + shippingCost;

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
        if (shippingEl) shippingEl.textContent = `$${shippingCost.toFixed(2)}`;
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
    populateOrderSummary(checkout, state);
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
}

function setupFinalForm(form) {
    if (!form) return;
    const payBtn = form.querySelector('#final-order-submit');
    const paymentMsg = form.querySelector('#payment-message');
    const creditFields = form.querySelector('.credit-card-fields');
    form.querySelectorAll('input[name="payment-method"]').forEach(input => {
        input.addEventListener('change', () => {
            paymentMsg.innerHTML = '';
            if (creditFields) {
                creditFields.style.display = input.value === 'credit' ? 'block' : 'none';
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
    const moreCards = form.querySelector('#more-cards');
    const moreCardsBox = form.querySelector('#more-cards-box');
    if (moreCards && moreCardsBox) {
        moreCards.addEventListener('click', e => {
            e.stopPropagation();
            moreCardsBox.style.display = moreCardsBox.style.display === 'flex' ? 'none' : 'flex';
        });
        document.addEventListener('click', () => {
            moreCardsBox.style.display = 'none';
        });
    }
    const addressFields = form.querySelectorAll('input[name="address"], input[name="city"], input[name="state"], input[name="zip"]');
    addressFields.forEach(f => f.addEventListener('input', () => updateShippingAndTax(form)));
    updateShippingAndTax(form);

    const remember = form.querySelector('#remember-me');
    const phone = form.querySelector('#phone-container');
    const msg = form.querySelector('#remember-message');
    if (remember) {
        remember.addEventListener('change', () => {
            const show = remember.checked;
            if (phone) phone.style.display = show ? 'block' : 'none';
            if (msg) msg.style.display = show ? 'block' : 'none';
        });
    }
    form.addEventListener('submit', e => {
        e.preventDefault();
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
        const toHide = ['h2', '.item-count', '.cart-items', '.cost-summary', '.cart-buttons', '.or', '.express-checkout', '#checkout-form', '.footer-links', '.cart-footer'];
        toHide.forEach(sel => {
            const el = page.querySelector(sel) || document.querySelector(sel);
            if (el) el.style.display = 'none';
        });
        const finalPage = page.querySelector('#final-checkout');
        if (finalPage) finalPage.style.display = 'none';
        let msg = page.querySelector('.empty-cart-message');
        if (!msg) {
            msg = document.createElement('p');
            msg.className = 'empty-cart-message';
            msg.textContent = 'Your cart is currently empty.';
            page.appendChild(msg);
        }
        msg.style.display = 'block';
        return;
    }
    let total = 0;
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
        total += parseFloat(item.price);
    });
    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.index)));
    });
    const itemCountEl = page.querySelector('.item-count');
    if (itemCountEl) itemCountEl.textContent = `${cart.length} Item(s)`;
    const subtotalEl = page.querySelector('.subtotal');
    if (subtotalEl) subtotalEl.textContent = `$${total.toFixed(2)}`;
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
    if (footer) footer.style.display = 'block';
    const footerLinks = document.querySelector('.footer-links');
    if (footerLinks) footerLinks.style.display = 'flex';
    const finalPage = page.querySelector('#final-checkout');
    if (finalPage) finalPage.style.display = 'none';
    const msg = page.querySelector('.empty-cart-message');
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
            header.insertAdjacentElement('afterend', headerLine);
            headerLine.style.marginTop = '5px';
        }
        if (headerLine) {
            headerLine.insertAdjacentElement('afterend', counter);
        } else if (header) {
            header.insertAdjacentElement('afterend', counter);
        }
    }
    counter.style.marginTop = '5px';
    counter.addEventListener('click', () => openCart());

    updateCartCounter();

    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.cart-counter{font-size:0.7rem;text-align:center;font-weight:600;cursor:pointer;display:inline-block;outline:2px solid transparent;padding:2px;} .cart-counter:hover,.cart-counter:focus,.cart-counter:active{outline-color:red;} .header-line{border-top:1px solid #000;width:100%;} .product-item{aspect-ratio:1/1;} .product-item img{width:100%;height:100%;object-fit:contain;object-position:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.1));} .product-item a:hover img,.product-item a:focus img,.product-item a:active img{outline:4px solid #ff0000;outline-offset:-4px;} .payment-icons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;justify-items:center;margin:10px 0;} .pay-btn{outline:2px solid transparent;} .pay-btn:hover,.pay-btn:focus,.pay-btn:active,.pay-btn.selected{outline-color:red;} .pay-btn.paypal{background:#ffc439;width:80px;height:40px;padding:0;} .pay-btn.paypal img{width:100%;height:100%;object-fit:contain;} .payment-icons img.klarna-logo{width:100px;} .payment-option{display:flex;align-items:center;border:1px solid #ccc;padding:10px;margin:5px 0;cursor:pointer;width:100%;box-sizing:border-box;overflow:hidden;} .payment-option input{margin:0 10px 0 0;} .payment-option label{display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;gap:10px;} .payment-label{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .payment-option.shop-pay .payment-label{white-space:normal;display:flex;flex-direction:column;} .payment-option.shop-pay .payment-label .subtext{font-size:0.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;} .payment-logos{margin-left:10px;display:flex;align-items:center;gap:5px;flex-shrink:0;} .payment-logos img{height:20px;} .payment-logos img.klarna-logo{height:30px;} .more-logos{position:relative;margin-left:5px;cursor:pointer;color:#000;font-weight:600;} .more-logos-box{display:none;position:absolute;top:100%;right:0;background:#000;padding:5px;z-index:10;} .more-logos-box img{height:20px;margin:0 2px;filter:invert(1);} .redirect-icon{text-align:center;font-size:2rem;} .paypal-inline{height:1em;vertical-align:middle;filter:invert(1);} .empty-cart-message{text-align:center;} a,button{transition:all 0.3s ease;} button:hover,button:focus,button:active,a:hover,a:focus,a:active{border:2px solid red;color:red;background:#fff;} .color-option{border:1px solid #000;} .color-option.selected,.color-option:hover,.color-option:focus,.color-option:active{border:2px solid red !important;}';
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCart();
    ensureCartCounter();
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
