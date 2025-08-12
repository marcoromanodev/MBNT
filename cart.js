let cart = [];

function initCart() {
    cart = JSON.parse(localStorage.getItem('cart') || '[]');
    updateCartCounter();
}

function addToCart(button) {
    const item = button.closest('.product-item');
    const product = {
        name: item.dataset.product,
        color: item.dataset.selectedColor || '',
        price: item.dataset.price
    };
    cart.push(product);
    localStorage.setItem('cart', JSON.stringify(cart));
    // TODO: sync with store server for inventory management
    updateCartCounter();
    alert('Added to cart');
}

function checkout(button) {
    alert('Checkout flow not implemented. Integrate with third-party payment.');
}

function updateCartCounter() {
    const counter = document.getElementById('cart-count');
    if (counter) {
        counter.textContent = cart.length;
    }
}

function ensureCartCounter() {
    if (!document.getElementById('cart-count')) {
        const header = document.querySelector('.header-container');
        if (header) {
            const counter = document.createElement('div');
            counter.className = 'cart-counter';
            counter.innerHTML = '<span class="cart-icon">🛒</span><span id="cart-count">0</span>';
            header.appendChild(counter);
            updateCartCounter();
        }
    }

    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.cart-counter{margin-top:5px;font-size:0.7rem;text-align:center;font-weight:600;}';
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
