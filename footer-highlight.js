document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const isShopPage = current === 'shop.html' || document.querySelector('.product-item');
  document.querySelectorAll('footer a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current || (isShopPage && href === 'shop.html')) {
      link.style.fontWeight = 'bold';
    }
  });

  document.querySelectorAll('.full-site-link a').forEach(link => {
    link.style.color = 'red';
  });
});
