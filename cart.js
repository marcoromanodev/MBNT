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
    alert('Checkout flow not implemented. Integrate with third-party payment.');
}

function updateCartCounter() {
    const counter = document.getElementById('cart-count');
    if (counter) {
        counter.textContent = cart.length;
    }
}

function ensureCartCounter() {
    const time = document.querySelector('.time');
    let headerLine = document.querySelector('.header-line');

    // Make sure the header line exists and sits directly below the clock
    if (time) {
        if (!headerLine) {
            headerLine = document.createElement('div');
            headerLine.className = 'header-line';
        }
        time.insertAdjacentElement('afterend', headerLine);
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
    } else if (time) {
        time.insertAdjacentElement('afterend', counter);
    }
    counter.style.marginTop = '5px';

    updateCartCounter();

    // Inject shared styles if not already present
    if (!document.getElementById('cart-counter-style')) {
        const style = document.createElement('style');
        style.id = 'cart-counter-style';
        style.textContent = '.cart-counter{font-size:0.7rem;text-align:center;font-weight:600;}.header-line{border-top:1px solid #000;width:100%;}.product-item img{width:300px;height:300px;object-fit:cover;}';
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
