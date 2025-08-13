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
        showCheckoutForm();
    }
}

function createCartModal() {
    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.innerHTML = `
        <div class="cart-content">
            <h2>Your Cart</h2>
            <div class="cart-items"></div>
            <div class="cart-total"></div>
            <div class="cart-actions">
                <button id="cart-close">Close</button>
                <button id="cart-checkout">Checkout</button>
            </div>
            <div class="pay-options">
                <button class="pay-btn" data-method="Apple Pay">Apple Pay</button>
                <button class="pay-btn" data-method="Google Pay">Google Pay</button>
                <button class="pay-btn" data-method="Samsung Pay">Samsung Pay</button>
                <button class="pay-btn" data-method="PayPal">PayPal</button>
                <button class="pay-btn" data-method="MetaMask">MetaMask</button>
            </div>
            <form id="checkout-form" style="display:none;">
                <h3>Checkout</h3>
                <input type="text" name="name" placeholder="Name" required>
                <input type="email" name="email" placeholder="Email" required>
                <input type="text" name="address" placeholder="Address" required>
                <button type="submit">Submit Order</button>
            </form>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#cart-close').addEventListener('click', closeCart);
    modal.querySelector('#cart-checkout').addEventListener('click', showCheckoutForm);
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
            #cart-modal .cart-content {background:#fff;padding:20px;max-width:400px;width:90%;text-align:center;}
            #cart-modal .cart-items div {margin-bottom:5px;}
            #cart-modal button {margin:5px;}
            #checkout-form input {display:block;width:90%;margin:5px auto;padding:8px;}
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
        div.textContent = `${item.name} ${item.color ? '(' + item.color + ')' : ''} - $${item.price}`;
        itemsContainer.appendChild(div);
        total += parseFloat(item.price);
    });
    modal.querySelector('.cart-total').textContent = `Total: $${total.toFixed(2)}`;
    modal.querySelector('#checkout-form').style.display = 'none';
    modal.querySelector('.cart-items').style.display = 'block';
    modal.querySelector('.cart-total').style.display = 'block';
    modal.querySelector('.cart-actions').style.display = 'block';
    modal.querySelector('.pay-options').style.display = 'block';
}

function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showCheckoutForm() {
    const modal = document.getElementById('cart-modal');
    modal.querySelector('.cart-items').style.display = 'none';
    modal.querySelector('.cart-total').style.display = 'none';
    modal.querySelector('.cart-actions').style.display = 'none';
    modal.querySelector('.pay-options').style.display = 'none';
    modal.querySelector('#checkout-form').style.display = 'block';
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
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const item = opt.closest('.product-item');
            const img = item.querySelector('img');
            img.src = opt.dataset.image;
            item.dataset.selectedColor = opt.dataset.color;
        });
    });
});
