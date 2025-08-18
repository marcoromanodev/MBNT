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

  // Allow long press on the logo to return to the homepage
  const logoOverlay = document.querySelector('.logo-overlay');
  if (logoOverlay) {
    let pressTimer;
    let moved = false;

    const restoreOverlay = () => {
      logoOverlay.style.display = 'block';
    };

    const cancel = () => {
      clearTimeout(pressTimer);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('mouseup', cancel);
      document.removeEventListener('touchend', cancel);
      document.removeEventListener('touchcancel', cancel);
      logoOverlay.style.display = 'none';
      setTimeout(restoreOverlay, 1000);
    };

    const moveHandler = () => {
      moved = true;
      cancel();
    };

    const startPress = () => {
      moved = false;
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('mouseup', cancel);
      document.addEventListener('touchend', cancel);
      document.addEventListener('touchcancel', cancel);
      pressTimer = setTimeout(() => {
        if (!moved) {
          window.location.href = 'index.html';
        }
        cancel();
      }, 600);
    };

    logoOverlay.addEventListener('mousedown', startPress);
    logoOverlay.addEventListener('touchstart', startPress);
  }
});
