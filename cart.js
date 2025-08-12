let cart = [];

function initCart() {
    cart = JSON.parse(localStorage.getItem('cart') || '[]');
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
    alert('Added to cart');
}

function checkout(button) {
    alert('Checkout flow not implemented. Integrate with third-party payment.');
}

document.addEventListener('DOMContentLoaded', () => {
    initCart();
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const item = opt.closest('.product-item');
            const img = item.querySelector('img');
            img.src = opt.dataset.image;
            item.dataset.selectedColor = opt.dataset.color;
        });
    });
});
