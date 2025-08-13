let cart = [];

const SESSION_LIMIT = 5 * 60 * 1000; // 5 minutes

function initCart() {
    const now = Date.now();
    cart = (JSON.parse(localStorage.getItem('cart') || '[]')).filter(item => {
        return now - (item.timestamp || 0) < SESSION_LIMIT;
    });
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
                <p class="consent-text">By submitting this form, you consent to receive informational (eg, order updates) and/or marketing texts (eg, cart reminders) from us.bape.com including texts sent by autodialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Privacy Policy & Terms.</p>
                <button type="submit">Submit</button>
                <h3>Express checkout</h3>
                <div class="payment-icons">
                    <button class="pay-btn" data-method="Shop Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Shop_Pay_logo.svg" alt="Shop Pay"></button>
                    <button class="pay-btn" data-method="Apple Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Apple_Pay_logo.svg" alt="Apple Pay"></button>
                    <button class="pay-btn" data-method="PayPal"><img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal"></button>
                    <button class="pay-btn" data-method="Google Pay"><img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Pay_logo.svg" alt="Google Pay"></button>
                </div>
            </form>
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
    modal.querySelector('#checkout-form').addEventListener('submit', e => {
        e.preventDefault();
        alert('Order submitted!');
        closeCart();
    });

    if (!document.getElementById('cart-modal-style')) {
        const style = document.createElement('style');
        style.id = 'cart-modal-style';
        style.textContent = `
            #cart-modal {position:fixed;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:1000;}
            #cart-modal .cart-content {background:#fff;padding:20px;max-width:400px;width:90%;text-align:center;position:relative;font-family:sans-serif;}
            #cart-modal .close-btn {position:absolute;top:10px;left:10px;background:#000;color:#fff;border:none;padding:5px 10px;cursor:pointer;}
            #cart-modal .cart-buttons {display:flex;flex-direction:column;align-items:center;}
            #cart-modal button {background:#000;color:#fff;border:none;padding:10px;margin:5px;cursor:pointer;width:100%;}
            #cart-modal .payment-icons {display:flex;flex-direction:column;gap:5px;margin:10px 0;align-items:center;}
            #cart-modal .payment-icons img {height:24px;}
            #cart-modal .cost-summary div, #cart-modal .cart-item {display:flex;justify-content:space-between;margin:5px 0;}
            #cart-modal .or {margin:10px 0;}
            #cart-modal footer a {color:#000;margin:0 5px;font-size:0.8em;text-decoration:none;}
            #cart-modal button:hover,#cart-modal button:focus,#cart-modal button:active,#cart-modal footer a:hover,#cart-modal footer a:focus,#cart-modal footer a:active{border:2px solid red;color:red;background:#fff;}
            #checkout-form input {display:block;width:90%;margin:5px auto;padding:8px;}
            .consent-text {font-size:0.7rem;margin-top:10px;}
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
}

function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showCheckoutForm(root = document.getElementById('cart-modal')) {
    root.querySelector('.cart-items').style.display = 'none';
    root.querySelector('.cost-summary').style.display = 'none';
    root.querySelector('.cart-buttons')?.style.display = 'none';
    root.querySelector('.or').style.display = 'none';
    root.querySelector('.express-checkout').style.display = 'none';
    root.querySelector('#checkout-form').style.display = 'block';
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
    page.querySelector('#checkout-form').addEventListener('submit', e => {
        e.preventDefault();
        alert('Order submitted!');
    });
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
