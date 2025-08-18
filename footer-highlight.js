document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const isShopPage = current === 'shop.html' || document.querySelector('.product-item');
  document.querySelectorAll('footer a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current || (isShopPage && href === 'shop.html')) {
      link.style.fontWeight = 'bold';
    }
  });

  // Bold the current category in navigation lists
  document.querySelectorAll('.desktop-nav a, .mobile-nav a').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.style.fontWeight = 'bold';
    }
  });

  // Recolor only links that still use the browser's default blue or purple
  document.querySelectorAll('a').forEach(link => {
    const color = getComputedStyle(link).color;
    if (
      color === 'rgb(0, 0, 238)' ||
      color === 'rgb(0, 0, 255)' ||
      color === 'blue' ||
      color === 'rgb(85, 26, 139)' ||
      color === 'purple'
    ) {
      link.style.color = 'red';
    }
  });
});
