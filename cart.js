let cart = [];

const SESSION_LIMIT = 5 * 60 * 1000; // 5 minutes

function initCart() {
    const now = Date.now();
    try {
        const stored = JSON.parse(localStorage.getItem('cart') || '[]');
        cart = Array.isArray(stored) ? stored.filter(item => now - (item.timestamp || 0) < SESSION_LIMIT) : [];
    } catch (e) {
        cart = [];
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
}

function addToCart(button) {
    const item = button.closest('.product-item');
    const product = {
        name: item.dataset.product,
        color: item.dataset.selectedColor || '',
        price: item.dataset.price,
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

function openCart(showForm = false) {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = createCartModal();
    }
    populateCartModal();
    modal.style.display = 'flex';
    if (showForm) {
        showCheckoutForm(modal);
    }
}

function createCartModal() {
    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.innerHTML = `
        <div class="cart-content">
            <button id="cart-close" class="close-btn">&times;</button>
            <div class="checkout-header">
                <iframe src="https://www.vectary.com/viewer/v1/?model=8b9281ad-097b-4408-88e2-ef824efa63eb&env=studio3&turntable=1" frameborder="0" class="checkout-logo"></iframe>
            </div>
            <h2>Cart</h2>
            <div class="item-count"></div>
            <div class="cart-items"></div>
            <div class="cost-summary">
                <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                <div><span>Tax</span><span class="tax">Calculated at checkout</span></div>
                <div><span>Shipping</span><span class="shipping">Calculated at checkout</span></div>
                <div><strong>Total</strong><strong class="total">$0.00</strong></div>
            </div>
            <div class="cart-buttons">
                <button id="view-cart">VIEW CART</button>
                <button id="cart-checkout">CHECKOUT</button>
            </div>
            <div class="or">OR</div>
            <div class="express-checkout">
                <h3>Express checkout</h3>
                <div class="payment-icons">
                    <button class="pay-btn" data-method="Shop Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Shop_Pay_logo.svg" alt="Shop Pay"></button>
                    <button class="pay-btn" data-method="Apple Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Apple_Pay_logo.svg" alt="Apple Pay"></button>
                    <button class="pay-btn" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                    <button class="pay-btn" data-method="Google Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Pay_logo.svg" alt="Google Pay"></button>
                </div>
            </div>
            <form id="checkout-form" style="display:none;">
                <h3>Sign up and know first!</h3>
                <input type="email" name="email" placeholder="Email" required>
                <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                <button type="submit">Submit</button>
                <h3>Express checkout</h3>
                <div class="payment-icons">
                    <button class="pay-btn" data-method="Shop Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Shop_Pay_logo.svg" alt="Shop Pay"></button>
                    <button class="pay-btn" data-method="Apple Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Apple_Pay_logo.svg" alt="Apple Pay"></button>
                    <button class="pay-btn" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                    <button class="pay-btn" data-method="Google Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Pay_logo.svg" alt="Google Pay"></button>
                </div>
            </form>
            <div id="final-checkout" style="display:none;">
                <div class="checkout-header">
                    <iframe src="https://www.vectary.com/viewer/v1/?model=8b9281ad-097b-4408-88e2-ef824efa63eb&env=studio3&turntable=1" frameborder="0" class="checkout-logo"></iframe>
                    <div class="time" id="modal-time"></div>
                    <h2 class="checkout-domain">maybenot.com</h2>
                    <h2 class="checkout-title">Checkout</h2>
                </div>
                <h3>Order summary</h3>
                <p>Original price</p>
                <p class="original-price">$0.00</p>
                <form id="final-form">
                    <h3>Sign up and know first!</h3>
                    <input type="email" name="signup_email" placeholder="Enter an email" required>
                    <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from maybenot.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                    <button type="submit">Submit</button>
                    <h3>Express checkout</h3>
                    <div class="payment-icons">
                        <button class="pay-btn" data-method="Shop Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Shop_Pay_logo.svg" alt="Shop Pay"></button>
                        <button class="pay-btn" data-method="Apple Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Apple_Pay_logo.svg" alt="Apple Pay"></button>
                        <button class="pay-btn" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                        <button class="pay-btn" data-method="Google Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Pay_logo.svg" alt="Google Pay"></button>
                    </div>
                    <div class="or">OR</div>
                    <h3>Contact</h3>
                    <button type="button" id="login-btn">Log in</button>
                    <input type="email" name="contact_email" placeholder="Enter an email" required>
                    <h3>Delivery</h3>
                    <p>This will also be used as your billing address for this order.</p>
                    <input type="text" name="first_name" placeholder="Enter a first name" required>
                    <input type="text" name="last_name" placeholder="Enter a last name" required>
                    <input type="text" name="address" placeholder="Enter an address" required>
                    <input type="text" name="city" placeholder="Enter a city" required>
                    <input type="text" name="zip" placeholder="Enter a ZIP / postal code" required>
                    <h3>Shipping method</h3>
                    <p>Enter your shipping address to view available shipping methods.</p>
                    <h3>Payment</h3>
                    <p>Your payment method’s billing address must match the shipping address. All transactions are secure and encrypted.</p>
                    <div class="credit-card">
                        <input type="text" name="card_number" placeholder="Enter a card number" required>
                        <input type="text" name="exp_date" placeholder="Enter a valid expiration date" required>
                        <input type="text" name="cvv" placeholder="Enter the CVV or security code on your card" required>
                        <input type="text" name="card_name" placeholder="Enter your name exactly as it’s written on your card" required>
                    </div>
                    <h4>Apple Pay</h4>
                    <h4>PayPal</h4>
                    <h4>Shop Pay</h4>
                    <p>Pay in full or in installments</p>
                    <h4>Klarna - Flexible payments</h4>
                    <label><input type="checkbox" name="remember"> Save my information for a faster checkout with a Shop account</label>
                    <p class="phone-error" style="display:none;color:red;">The specified phone number does not match the expected pattern.</p>
                    <p>Secure and encrypted</p>
                    <h3>Order summary</h3>
                    <p class="order-note">PLEASE NOTE: WE DO NOT PROCESS ORDERS ON SATURDAYS AND SUNDAYS, PLEASE ALLOW AN ADDITIONAL 2 - 3 BUSINESS DAYS FOR PROCESSING TIME WHEN PLACED ON THE WEEKEND. ALL SALES FINAL. NO EXCHANGES OR RETURNS. EXPECT ALL ORDERS TO BE SHIPPED WITH DELAYS DUE TO THE 4TH OF JULY HOLIDAY.</p>
                    <h4>Shopping cart</h4>
                    <div class="cart-summary"></div>
                    <button id="final-order-submit" type="submit">Submit</button>
                    <h4>Cost summary</h4>
                    <div class="cost-summary">
                        <div><span>Subtotal</span><span class="subtotal">$0.00</span></div>
                        <div><span>Shipping</span><span>Enter shipping address</span></div>
                        <div><span>Total</span><span class="total">$0.00</span></div>
                    </div>
                    <p>Your info will be saved to a Shop account. By continuing, you agree to Shop’s Terms of Service and acknowledge the Privacy Policy.</p>
                </form>
            </div>
            <footer class="cart-footer">
                <a href="#">refund policy</a> |
                <a href="#">shipping</a> |
                <a href="#">privacy policy</a> |
                <a href="#">terms of service</a> |
                <a href="#">cookies</a>
            </footer>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#cart-close').addEventListener('click', closeCart);
    modal.querySelector('#view-cart').addEventListener('click', () => {
        window.location.href = 'cart.html';
    });
    modal.querySelector('#cart-checkout').addEventListener('click', () => showCheckoutForm(modal));
    modal.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            alert(`${btn.dataset.method} payment not implemented.`);
        });
    });
    modal.querySelector('#final-form').addEventListener('submit', e => {
        e.preventDefault();
        alert('Order submitted!');
        closeCart();
    });

    if (!document.getElementById('cart-modal-style')) {
        const style = document.createElement('style');
        style.id = 'cart-modal-style';
        style.textContent = `
            #cart-modal {position:fixed;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:1000;}
            #cart-modal .cart-content {background:#fff;padding:20px;max-width:400px;width:90%;text-align:center;position:relative;font-family:sans-serif;max-height:90vh;overflow-y:auto;}
            #cart-modal .close-btn {position:absolute;top:10px;left:10px;background:#000;color:#fff;border:none;width:20px;height:20px;line-height:20px;padding:0;font-size:14px;cursor:pointer;}
            #cart-modal .cart-buttons {display:flex;flex-direction:column;align-items:center;}
            #cart-modal button {background:#000;color:#fff;border:none;padding:10px;margin:5px auto;cursor:pointer;display:block;}
            #cart-modal .payment-icons {display:flex;flex-direction:column;gap:5px;margin:10px 0;align-items:center;}
            #cart-modal .payment-icons img {height:24px;}
            #cart-modal .cost-summary div, #cart-modal .cart-item {display:flex;justify-content:space-between;margin:5px 0;}
            #cart-modal .or {margin:10px 0;}
            #cart-modal footer a {color:#000;margin:0 5px;font-size:0.8em;text-decoration:none;}
            #cart-modal button:hover,#cart-modal button:focus,#cart-modal button:active,#cart-modal footer a:hover,#cart-modal footer a:focus,#cart-modal footer a:active{border:2px solid red;color:red;background:#fff;}
            #checkout-form input {display:block;width:90%;margin:5px auto;padding:8px;}
            .consent-text {font-size:0.7rem;margin-top:10px;}
            #final-checkout{text-align:center;}
            #final-checkout input {display:block;width:90%;margin:5px auto;padding:8px;}
            .checkout-header{display:flex;flex-direction:column;align-items:center;}
            .checkout-logo{display:block;margin:0 auto;width:80px;height:80px;border:none;}
            #final-checkout .time{font-size:0.7rem;text-align:center;margin-top:5px;font-weight:600;}
            .checkout-domain,.checkout-title{margin-top:5px;}
            .credit-card input{width:90%;}
        `;
        document.head.appendChild(style);
    }

    return modal;
}

function populateCartModal() {
    const modal = document.getElementById('cart-modal');
    const itemsContainer = modal.querySelector('.cart-items');
    itemsContainer.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<span>${item.name} ${item.color ? '(' + item.color + ')' : ''}</span><span>$${parseFloat(item.price).toFixed(2)}</span>`;
        itemsContainer.appendChild(div);
        total += parseFloat(item.price);
    });
    modal.querySelector('.item-count').textContent = `${cart.length} Item(s)`;
    modal.querySelector('.subtotal').textContent = `$${total.toFixed(2)}`;
    modal.querySelector('.total').textContent = `$${total.toFixed(2)}`;
    modal.querySelector('#checkout-form').style.display = 'none';
    modal.querySelector('.cart-items').style.display = 'block';
    modal.querySelector('.cost-summary').style.display = 'block';
    modal.querySelector('.cart-buttons').style.display = 'flex';
    modal.querySelector('.or').style.display = 'block';
    modal.querySelector('.express-checkout').style.display = 'block';
    const finalPage = modal.querySelector('#final-checkout');
    if (finalPage) finalPage.style.display = 'none';
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
    root.querySelector('.cart-items').style.display = 'none';
    root.querySelector('.cost-summary').style.display = 'none';
    const cartButtons = root.querySelector('.cart-buttons');
    if (cartButtons) cartButtons.style.display = 'none';
    root.querySelector('.or').style.display = 'none';
    root.querySelector('.express-checkout').style.display = 'none';
    root.querySelector('#checkout-form').style.display = 'block';
}

function updateModalTime() {
    const options = {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    const el = document.getElementById('modal-time');
    if (el) {
        const currentTime = new Intl.DateTimeFormat('en-US', options).format(new Date()).replace(',', '');
        el.textContent = currentTime + ' CHICAGO';
    }
}

function showFinalPage(root = document.getElementById('cart-modal')) {
    root.querySelector('#checkout-form').style.display = 'none';
    root.querySelector('.cart-items').style.display = 'none';
    root.querySelector('.cost-summary').style.display = 'none';
    const cartButtons = root.querySelector('.cart-buttons');
    if (cartButtons) cartButtons.style.display = 'none';
    root.querySelector('.or').style.display = 'none';
    root.querySelector('.express-checkout').style.display = 'none';
    const finalPage = root.querySelector('#final-checkout');
    if (finalPage) {
        finalPage.style.display = 'block';
        const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
        const summary = finalPage.querySelector('.cart-summary');
        summary.innerHTML = '';
        cart.forEach(item => {
            summary.innerHTML += `<p>${item.name} ${item.color ? '(' + item.color + ')' : ''} - $${parseFloat(item.price).toFixed(2)}</p>`;
        });
        finalPage.querySelector('.original-price').textContent = `$${total.toFixed(2)}`;
        finalPage.querySelector('.subtotal').textContent = `$${total.toFixed(2)}`;
        finalPage.querySelector('.total').textContent = `$${total.toFixed(2)}`;
        updateModalTime();
        if (!window.modalTimeInterval) {
            window.modalTimeInterval = setInterval(updateModalTime, 1000);
        }
    }
}

function populateCartPage() {
    const page = document.getElementById('cart-page');
    if (!page) return;
    const itemsContainer = page.querySelector('.cart-items');
    itemsContainer.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<span>${item.name} ${item.color ? '(' + item.color + ')' : ''}</span><span>$${parseFloat(item.price).toFixed(2)}</span>`;
        itemsContainer.appendChild(div);
        total += parseFloat(item.price);
    });
    page.querySelector('.item-count').textContent = `${cart.length} Item(s)`;
    page.querySelector('.subtotal').textContent = `$${total.toFixed(2)}`;
    page.querySelector('.total').textContent = `$${total.toFixed(2)}`;
    page.querySelector('#checkout-form').style.display = 'none';
    page.querySelector('.cart-items').style.display = 'block';
    page.querySelector('.cost-summary').style.display = 'block';
    page.querySelector('.cart-buttons').style.display = 'flex';
    page.querySelector('.or').style.display = 'block';
    page.querySelector('.express-checkout').style.display = 'block';
    const finalPage = page.querySelector('#final-checkout');
    if (finalPage) finalPage.style.display = 'none';
}

function setupCartPage() {
    const page = document.getElementById('cart-page');
    if (!page) return;
    populateCartPage();
    page.querySelector('#cart-checkout').addEventListener('click', () => showCheckoutForm(page));
    page.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            alert(`${btn.dataset.method} payment not implemented.`);
        });
    });
    const finalForm = page.querySelector('#final-form');
    if (finalForm) {
        finalForm.addEventListener('submit', e => {
            e.preventDefault();
            alert('Order submitted!');
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

function updateCartCounter() {
    const counter = document.getElementById('cart-count');
    if (counter) {
        counter.textContent = cart.length;
    }
}

function ensureCartCounter() {
    const header = document.querySelector('.header-container');
    let headerLine = document.querySelector('.header-line');

    // Make sure the header line exists and sits directly below the header
    if (header) {
        if (!headerLine) {
            headerLine = document.createElement('div');
            headerLine.className = 'header-line';
        }
        header.insertAdjacentElement('afterend', headerLine);
        headerLine.style.marginTop = '5px';
    }

    // Ensure cart counter exists and appears below the header line
    let counter = document.getElementById('cart-count')?.closest('.cart-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'cart-counter';
        counter.innerHTML = '<span class="cart-icon">🛒</span><span id="cart-count">0</span>';
    }
    if (headerLine) {
        headerLine.insertAdjacentElement('afterend', counter);
    } else if (header) {
        header.insertAdjacentElement('afterend', counter);
    }
    counter.style.marginTop = '5px';
    counter.addEventListener('click', () => openCart());

    updateCartCounter();

    // Inject shared styles if not already present
    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.cart-counter{font-size:0.7rem;text-align:center;font-weight:600;cursor:pointer;}.header-line{border-top:1px solid #000;width:100%;}.product-item img{width:300px;height:450px;object-fit:contain;}';
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCart();
    ensureCartCounter();
    document.querySelectorAll('button').forEach(btn => {
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
});
