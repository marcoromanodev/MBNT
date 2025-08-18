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

  const style = document.createElement('style');
  style.innerHTML = `
    a { color: red !important; }
    a:visited { color: red !important; }
  `;
  document.head.appendChild(style);
});
